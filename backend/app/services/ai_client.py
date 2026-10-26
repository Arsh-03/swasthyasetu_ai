"""
One client for every text AI call (autocomplete, live assistant, minutes check, patient summary, CHIBI agent).

Providers (AI_PROVIDER in .env):
  ollama   your own Ollama server, e.g. the Colab gateway (INTELLISENSE_LOCAL_URL + INTELLISENSE_LOCAL_MODEL)
  gemini   Google Gemini through its OpenAI-compatible endpoint (AI_API_KEY or GEMINI_API_KEY)
  openai   OpenAI (AI_API_KEY or OPENAI_API_KEY)
  openai_compatible   any other OpenAI-style server (AI_API_BASE + AI_API_KEY), e.g. Groq, OpenRouter, vLLM

Gemini / OpenAI are third parties: SETU-Shield treats them that way automatically (masked text only, never voice).
Free API tiers allow few requests per minute, so requests share a per-minute budget; background features
(autocomplete) give way first so the important ones (the agent's batch updates) still get through.
"""
import asyncio
import json
import re
import time
from collections import deque
from typing import Any, AsyncIterator, Deque, Dict, List, Optional

import httpx

from app.config import ai_headers, settings

DEFAULTS = {
    "gemini": {"base": "https://generativelanguage.googleapis.com/v1beta/openai", "model": "gemini-2.5-flash",
               "prefer": ("flash-lite", "flash")},
    "openai": {"base": "https://api.openai.com/v1", "model": "gpt-4o-mini", "prefer": ("mini",)},
    "openai_compatible": {"base": "", "model": "", "prefer": ()},
}
HEALTH_TTL_S = 300            # re-check a working server every 5 minutes
OFFLINE_RECHECK_S = 30        # ...but an offline one every 30 s, so it recovers soon after Colab is up
PULL_TIMEOUT_S = 1800         # downloading a 7B model on Colab takes a few minutes
# Low-priority requests (autocomplete) keep this share of the minute's budget free for the important ones.
RESERVE_FOR_IMPORTANT = 0.5


class AIUnavailable(Exception):
    """No AI configured, offline, out of budget, or the provider returned an error."""


class AIClient:
    def __init__(self) -> None:
        import os
        self.provider = settings.AI_PROVIDER
        if self.provider not in ("ollama", "gemini", "openai", "openai_compatible"):
            # Not set: a Gemini / OpenAI key in .env picks that provider; otherwise your own Ollama server.
            self.provider = ("gemini" if os.getenv("GEMINI_API_KEY") else "openai" if os.getenv("OPENAI_API_KEY")
                             else "ollama" if settings.INTELLISENSE_LOCAL_MODEL else "")
        d = DEFAULTS.get(self.provider, {})
        if self.provider == "ollama":
            self.base = settings.INTELLISENSE_LOCAL_URL.rstrip("/")
            self.model = settings.AI_MODEL or settings.SCRIBE_LLM_MODEL or settings.INTELLISENSE_LOCAL_MODEL
            self.key = ""
        else:
            self.base = (settings.AI_API_BASE or d.get("base", "")).rstrip("/")
            self.model = settings.AI_MODEL or d.get("model", "")
            self.key = settings.AI_API_KEY
        self._health: Dict[str, Any] = {"ok": False, "at": 0.0, "detail": ""}
        self._sent: Deque[float] = deque()
        self._cooldown_until = 0.0            # provider said "too many requests": wait until then
        self._pull_task: Optional["asyncio.Task[None]"] = None
        self._warm_task: Optional["asyncio.Task[None]"] = None
        self._warm = False                    # model loaded into the GPU (the first load takes ~40 s)
        self._model_checked = False
        self._transport: Optional[httpx.AsyncBaseTransport] = None   # tests plug in a fake server here

    # ---- what / where ---------------------------------------------------------------------------------
    @property
    def enabled(self) -> bool:
        if self.provider == "ollama":
            return bool(self.base and self.model)
        return bool(self.base and self.model and self.key)

    @property
    def third_party(self) -> bool:
        return self.provider in ("gemini", "openai", "openai_compatible")

    def destination(self) -> str:
        if self.third_party or settings.AI_TEXT_DESTINATION == "third_party":
            return "third_party"
        return "self_hosted"

    def info(self) -> Dict[str, Any]:
        cooling = max(0, int(self._cooldown_until - time.time()))
        return {"provider": self.provider or "none", "model": self.model, "enabled": self.enabled,
                "online": self._health["ok"], "destination": self.destination(), "detail": self._health["detail"],
                "budget_per_min": self._rpm(), "rate_limited_for_s": cooling,
                "downloading_model": bool(self._pull_task and not self._pull_task.done())}

    def _headers(self) -> Dict[str, str]:
        if self.provider == "ollama":
            return ai_headers()
        return {"Authorization": f"Bearer {self.key}"}

    # ---- budget -------------------------------------------------------------------------------------------
    def _rpm(self) -> int:
        if settings.AI_MAX_RPM > 0:
            return settings.AI_MAX_RPM
        return {"gemini": 10, "openai": 60, "openai_compatible": 30}.get(self.provider, 0)   # 0 = unlimited

    def _take(self, important: bool) -> bool:
        if time.time() < self._cooldown_until:
            return False
        limit = self._rpm()
        if not limit:
            return True
        now = time.time()
        while self._sent and now - self._sent[0] > 60:
            self._sent.popleft()
        allowed = limit if important else int(limit * (1 - RESERVE_FOR_IMPORTANT))
        if len(self._sent) >= max(1, allowed):
            return False
        self._sent.append(now)
        return True

    # ---- health ---------------------------------------------------------------------------------------
    async def online(self, force: bool = False) -> bool:
        if not self.enabled:
            return False
        ttl = HEALTH_TTL_S if self._health["ok"] else OFFLINE_RECHECK_S
        if not force and time.time() - self._health["at"] < ttl:
            return self._health["ok"]
        ok, detail = False, ""
        try:
            async with httpx.AsyncClient(timeout=8.0, headers=self._headers(), transport=self._transport) as client:
                if self.provider == "ollama":
                    res = await client.get(f"{self.base}/api/tags")
                    reachable = res.status_code == 200 and "ngrok-error-code" not in res.headers
                    names = [m.get("name", "") for m in res.json().get("models", [])] if reachable else []
                    ok = any(n in (self.model, f"{self.model}:latest") for n in names)
                    if not reachable:
                        detail = f"Ollama server answered {res.status_code} (is Colab running? is the ngrok URL current?)"
                    elif not ok:
                        detail = (f"Downloading {self.model} on your AI server (a few minutes)…" if self._pull_task and not self._pull_task.done()
                                  else f"Your AI server has no '{self.model}' model; starting the download")
                        self._start_pull()
                else:
                    res = await client.get(f"{self.base}/models")
                    ok = res.status_code == 200
                    detail = "" if ok else f"{self.provider} answered {res.status_code} (check AI_API_KEY)"
                    if ok and not self._model_checked:
                        self._pick_model([m.get("id", "") for m in res.json().get("data", [])])
        except (httpx.HTTPError, ValueError) as exc:
            detail = f"{type(exc).__name__}: AI server unreachable"
        if ok and self.provider == "ollama" and not self._warm:
            self._start_warm()
            detail = detail or "Loading the model into the GPU (about 40 s the first time)…"
        self._health.update(ok=ok, at=time.time(), detail=detail)
        return ok

    def _start_warm(self) -> None:
        """Load the model into GPU memory in the background, so the first doctor doesn't wait for it."""
        if self._warm_task and not self._warm_task.done():
            return

        async def warm() -> None:
            try:
                async with httpx.AsyncClient(timeout=300.0, headers=self._headers(), transport=self._transport) as client:
                    res = await client.post(f"{self.base}/api/generate",
                                            json={"model": self.model, "keep_alive": settings.INTELLISENSE_LOCAL_KEEP_ALIVE})
                    self._warm = res.status_code == 200
                    if self._warm and self._health["detail"].startswith("Loading"):
                        self._health["detail"] = ""
            except httpx.HTTPError:
                pass
        try:
            self._warm_task = asyncio.get_running_loop().create_task(warm())
        except RuntimeError:
            pass

    def _start_pull(self) -> None:
        """Ask Ollama to download the configured model (once at a time). Colab sessions start empty."""
        if self._pull_task and not self._pull_task.done():
            return

        async def pull() -> None:
            try:
                async with httpx.AsyncClient(timeout=PULL_TIMEOUT_S, headers=self._headers(), transport=self._transport) as client:
                    await client.post(f"{self.base}/api/pull", json={"model": self.model, "stream": False})
            except httpx.HTTPError:
                pass
            self._health["at"] = 0.0          # check again straight away
        try:
            self._pull_task = asyncio.get_running_loop().create_task(pull())
        except RuntimeError:
            pass

    def _pick_model(self, ids: List[str]) -> None:
        """Keep the configured model if the provider has it; otherwise pick a fast one it does have."""
        self._model_checked = True
        names = [i.split("/")[-1] for i in ids]
        if not names or self.model in names:
            return
        for want in DEFAULTS.get(self.provider, {}).get("prefer", ()):
            match = sorted((n for n in names if want in n and "preview" not in n and "tts" not in n
                            and "image" not in n and "audio" not in n), reverse=True)
            if match:
                self.model = match[0]
                return

    def _rate_limited(self, res: httpx.Response) -> None:
        """The provider's per-minute limit was hit: pause all AI requests for as long as it asks (default 20 s)."""
        try:
            wait = float(res.headers.get("retry-after", "20"))
        except ValueError:
            wait = 20.0
        self._cooldown_until = time.time() + min(max(wait, 5.0), 120.0)
        self._health["detail"] = f"{self.provider} rate limit reached; pausing AI for {int(wait)} s (rules engine meanwhile)"

    def mark_offline(self, detail: str = "") -> None:
        self._health.update(ok=False, at=time.time(), detail=detail or self._health["detail"])

    # ---- requests -----------------------------------------------------------------------------------------
    def _payload(self, messages: List[Dict[str, str]], stream: bool, json_mode: bool, max_tokens: int,
                 temperature: float, stop: Optional[List[str]]) -> Dict[str, Any]:
        if self.provider == "ollama":
            p: Dict[str, Any] = {"model": self.model, "messages": messages, "stream": stream,
                                 "keep_alive": settings.INTELLISENSE_LOCAL_KEEP_ALIVE,
                                 "options": {"temperature": temperature, "num_predict": max_tokens}}
            if stop:
                p["options"]["stop"] = stop
            if json_mode:
                p["format"] = "json"
            return p
        p = {"model": self.model, "messages": messages, "stream": stream, "temperature": temperature,
             "max_tokens": max_tokens}
        if stop:
            p["stop"] = stop
        if json_mode:
            p["response_format"] = {"type": "json_object"}
        if self.provider == "gemini" and "2.5" in self.model:
            p["reasoning_effort"] = "none" if "flash" in self.model else "low"   # fast answers, no long thinking
        return p

    def _url(self) -> str:
        return f"{self.base}/api/chat" if self.provider == "ollama" else f"{self.base}/chat/completions"

    async def chat(self, messages: List[Dict[str, str]], *, json_mode: bool = False, max_tokens: int = 600,
                   temperature: float = 0.2, timeout: float = 40.0, important: bool = True,
                   stop: Optional[List[str]] = None) -> str:
        if not self.enabled:
            raise AIUnavailable("No AI provider configured")
        if not self._take(important):
            raise AIUnavailable("AI request budget for this minute is used up")
        payload = self._payload(messages, False, json_mode, max_tokens, temperature, stop)
        try:
            return await self._post_chat(payload, timeout)
        except httpx.HTTPError as exc:
            if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
                self.mark_offline(f"{type(exc).__name__}: AI server unreachable")
            raise AIUnavailable(f"{type(exc).__name__} talking to {self.provider}") from exc

    async def _post_chat(self, payload: Dict[str, Any], timeout: float) -> str:
        async with httpx.AsyncClient(timeout=timeout, headers=self._headers(), transport=self._transport) as client:
            res = await client.post(self._url(), json=payload)
            if res.status_code == 400 and self.provider != "ollama":
                # Some OpenAI-style servers reject optional fields; retry with the plain request.
                for k in ("reasoning_effort", "response_format", "stop"):
                    payload.pop(k, None)
                res = await client.post(self._url(), json=payload)
            if res.status_code == 429:
                self._rate_limited(res)
            if res.status_code >= 400:
                if res.status_code in (401, 403, 404) or res.status_code >= 500:
                    self.mark_offline(f"{self.provider} answered {res.status_code}")
                raise AIUnavailable(f"{self.provider} answered {res.status_code}: {res.text[:200]}")
            data = res.json()
        self._health.update(ok=True, at=time.time(), detail="")
        if self.provider == "ollama":
            return (data.get("message") or {}).get("content") or ""
        return ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""

    async def chat_json(self, messages: List[Dict[str, str]], **kw: Any) -> Dict[str, Any]:
        return parse_json(await self.chat(messages, json_mode=True, **kw))

    async def stream_chat(self, messages: List[Dict[str, str]], *, max_tokens: int = 300, temperature: float = 0.2,
                          timeout: float = 25.0, important: bool = True,
                          stop: Optional[List[str]] = None) -> AsyncIterator[str]:
        """Yields text pieces as the model writes them. Leaving the loop early stops the request."""
        if not self.enabled:
            raise AIUnavailable("No AI provider configured")
        if not self._take(important):
            raise AIUnavailable("AI request budget for this minute is used up")
        payload = self._payload(messages, True, False, max_tokens, temperature, stop)
        try:
            async for piece in self._stream(payload, timeout):
                yield piece
        except httpx.HTTPError as exc:
            raise AIUnavailable(f"{type(exc).__name__} talking to {self.provider}") from exc

    async def _stream(self, payload: Dict[str, Any], timeout: float) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=timeout, headers=self._headers(), transport=self._transport) as client:
            async with client.stream("POST", self._url(), json=payload) as res:
                if res.status_code == 429:
                    self._rate_limited(res)
                if res.status_code >= 400:
                    body = (await res.aread()).decode(errors="ignore")[:200]
                    if res.status_code in (401, 403, 404) or res.status_code >= 500:
                        self.mark_offline(f"{self.provider} answered {res.status_code}")
                    raise AIUnavailable(f"{self.provider} answered {res.status_code}: {body}")
                async for line in res.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if self.provider == "ollama":
                        chunk = json.loads(line)
                        piece = (chunk.get("message") or {}).get("content") or ""
                        if piece:
                            yield piece
                        if chunk.get("done"):
                            break
                    else:
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        delta = ((json.loads(data).get("choices") or [{}])[0].get("delta") or {}).get("content") or ""
                        if delta:
                            yield delta
        self._health.update(ok=True, at=time.time(), detail="")


def parse_json(text: str) -> Dict[str, Any]:
    """JSON from a model reply, tolerating ```json fences or a sentence around it."""
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except ValueError:
                pass
    return {}


ai = AIClient()


async def warm_check() -> None:
    """Check once at startup so the first doctor doesn't wait for it."""
    try:
        await asyncio.wait_for(ai.online(force=True), timeout=10)
    except Exception:
        pass
