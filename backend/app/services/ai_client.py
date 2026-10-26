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
HEALTH_TTL_S = 300
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
        return {"provider": self.provider or "none", "model": self.model, "enabled": self.enabled,
                "online": self._health["ok"], "destination": self.destination(), "detail": self._health["detail"],
                "budget_per_min": self._rpm()}

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
        if not force and time.time() - self._health["at"] < HEALTH_TTL_S:
            return self._health["ok"]
        ok, detail = False, ""
        try:
            async with httpx.AsyncClient(timeout=8.0, headers=self._headers(), transport=self._transport) as client:
                if self.provider == "ollama":
                    res = await client.get(f"{self.base}/api/tags")
                    ok = res.status_code == 200 and "ngrok-error-code" not in res.headers
                    detail = "" if ok else f"Ollama server answered {res.status_code}"
                else:
                    res = await client.get(f"{self.base}/models")
                    ok = res.status_code == 200
                    detail = "" if ok else f"{self.provider} answered {res.status_code} (check AI_API_KEY)"
                    if ok and not self._model_checked:
                        self._pick_model([m.get("id", "") for m in res.json().get("data", [])])
        except (httpx.HTTPError, ValueError) as exc:
            detail = f"{type(exc).__name__}: AI server unreachable"
        self._health.update(ok=ok, at=time.time(), detail=detail)
        return ok

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
        async with httpx.AsyncClient(timeout=timeout, headers=self._headers(), transport=self._transport) as client:
            res = await client.post(self._url(), json=payload)
            if res.status_code == 400 and self.provider != "ollama":
                # Some OpenAI-style servers reject optional fields; retry with the plain request.
                for k in ("reasoning_effort", "response_format", "stop"):
                    payload.pop(k, None)
                res = await client.post(self._url(), json=payload)
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
        async with httpx.AsyncClient(timeout=timeout, headers=self._headers(), transport=self._transport) as client:
            async with client.stream("POST", self._url(), json=payload) as res:
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
