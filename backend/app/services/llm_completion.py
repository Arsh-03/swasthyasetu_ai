"""
Tier 3: context-aware language-model completion for the IntelliSense notepad.

Suggests a short continuation of the doctor's current sentence, shown as ghost text that the
doctor must accept with Tab. Sovereign by design: the model runs on infrastructure you control,
never a third-party AI API. Choose with INTELLISENSE_LLM_PROVIDER:

  "stub"   Built-in canned suggestions. No model, no GPU. For development and demos.
  "local"  A self-hosted open model served by Ollama (e.g. Med-Gemma) on your own server.
  unset    Tier 3 disabled; Tiers 1-2 and nomenclature keep working.

Protecting the app from a slow or broken model server:
  - The model runs in its own process; every request has a hard deadline.
  - At most INTELLISENSE_LLM_MAX_CONCURRENCY requests run at once; extra ones are skipped, not queued.
  - After FAILURE_THRESHOLD consecutive failures, Tier 3 pauses itself for PAUSE_SECONDS.
  - A background health check marks the server offline so requests aren't even attempted.

Keeping wasted work low:
  - Replies are streamed and the connection is closed as soon as the answer is complete, or when
    the doctor types again (the request task is cancelled), which makes Ollama stop generating.
  - The note excerpt starts at a stable word boundary that only moves every CONTEXT_STEP words,
    so the model server can reuse its cached computation of the earlier note (prefix caching).

Privacy (DPDP Act 2023): only the recent note excerpt plus age/sex are sent to the model server.
No name, ABHA address or identifiers. Nothing is logged or persisted.

Safety: a completion is dropped if it introduces any number (dose, vital, date) that is not
already in the note, or if the model is unsure.
"""
import asyncio
import hashlib
import json
import re
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Tuple

import httpx

from app.config import ai_headers, settings
from app.services.intellisense_engine import detect_section, is_word

CONTEXT_WORDS = 120          # most words sent to the model
CONTEXT_STEP = 60            # excerpt start moves in steps of this many words (prefix-cache friendly)
MAX_COMPLETION_WORDS = 15
MAX_COMPLETION_CHARS = 120
NONE_MARKER = "<none>"
CACHE_SIZE = 256
FAILURE_THRESHOLD = 3
PAUSE_SECONDS = 60
WARMUP_TIMEOUT_S = 180

SECTION_NAMES = {
    "complaints": "Chief Complaints", "history": "Past History", "exam": "Vitals & Examination",
    "assessment": "Assessment", "labs": "Investigations", "plan": "Plan / Medications",
}

# Static, so the model server can cache it across every request.
SYSTEM_PROMPT = f"""You are the autocomplete engine inside a doctor's tele-consultation notepad in India.
The doctor is typing clinical notes during a live call. You predict the next few words of the sentence
they are currently typing, so they can accept it with one keystroke instead of typing it.

Rules:
- Output ONLY the text that should come directly after the last character of the note. No quotes, no explanation.
- If the continuation starts a new word, begin your output with a single space. If it finishes a partly typed word, do not.
- At most 12 words. Stop at the end of the current sentence or clause. Never start a new line.
- Use standard clinical English and the doctor's existing abbreviations/style.
- Complete what the doctor is already describing. Do not invent new findings, diagnoses, drugs, doses,
  vitals, durations, dates or any numbers that are not already in the note.
- Prefer common, neutral phrasing (e.g. completing "pain radiating to the" -> " left arm").
- If you cannot predict a continuation with confidence, output exactly {NONE_MARKER}"""


class ProviderError(Exception):
    """The model server failed or timed out. Counts toward the auto-pause."""


@dataclass
class CompletionContext:
    text_before: str
    section: Optional[str]
    patient: Dict[str, Any]


class CompletionProvider(Protocol):
    name: str
    model: str

    async def complete(self, ctx: CompletionContext, prompt: str) -> str:
        """Return the raw model text ("" or NONE_MARKER for no suggestion). Raise ProviderError on failure."""
        ...

    async def health(self) -> bool: ...

    async def warm_up(self) -> None: ...

    async def close(self) -> None: ...


def build_prompt(ctx: CompletionContext) -> str:
    age = ctx.patient.get("age")
    sex = ctx.patient.get("sex") or ctx.patient.get("gender")
    patient = " ".join(p for p in [f"{age}-year-old" if age else "", str(sex).lower() if sex else ""] if p) or "unknown"
    section = SECTION_NAMES.get(ctx.section or "", "unspecified")
    # Stable parts first, the growing note next, and the parts that vary per request last,
    # so consecutive requests share the longest possible prefix.
    return (
        f"Patient: {patient}\n"
        "Note so far (most recent text; it may be cut off at the start):\n"
        f"<note>\n{ctx.text_before}</note>\n"
        f"The doctor is writing in the section: {section}\n"
        "Continue the sentence the doctor is typing."
    )


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------
class StubProvider:
    """Canned completions for development on machines that can't run a model."""
    name = "stub"
    model = "stub"

    RULES: List[Tuple[str, str]] = [
        (r"radiating to( the)?$", " left arm"),
        (r"radiating$", " to the left arm"),
        (r"worse (during|on)$", " exertion and relieved by rest"),
        (r"associated with$", " sweating and shortness of breath"),
        (r"no (h/o|history of)$", " similar complaints in the past"),
        (r"on examination,?$", " patient is conscious and oriented"),
        (r"patient (is )?advised to$", " follow up if symptoms worsen"),
        (r"rule out$", " acute coronary syndrome"),
        (r"(not|non) compliant (with|to)$", " prescribed medication"),
        (r"since$", " morning"),
    ]

    def __init__(self, delay_ms: int):
        self._delay = delay_ms / 1000
        self._rules = [(re.compile(p, re.IGNORECASE), out) for p, out in self.RULES]

    async def complete(self, ctx: CompletionContext, prompt: str) -> str:
        await asyncio.sleep(self._delay)  # behaves like a real model wrt. cancellation
        tail = ctx.text_before.rstrip()
        for regex, out in self._rules:
            if regex.search(tail):
                return out
        return NONE_MARKER

    async def health(self) -> bool:
        return True

    async def warm_up(self) -> None:
        return None

    async def close(self) -> None:
        return None


class LocalOllamaProvider:
    """Self-hosted model via Ollama's native API. Streams, so generation can be stopped early."""
    name = "local"

    def __init__(self, base_url: str, model: str, timeout_s: float, keep_alive: str, num_ctx: int, num_thread: int):
        self.model = model
        self._base = base_url.rstrip("/")
        self._timeout_s = timeout_s
        self._keep_alive = keep_alive
        self._options: Dict[str, Any] = {"num_predict": 40, "temperature": 0.2, "stop": ["\n"], "num_ctx": num_ctx}
        if num_thread > 0:
            self._options["num_thread"] = num_thread
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout_s, connect=5.0), headers=ai_headers())

    async def complete(self, ctx: CompletionContext, prompt: str) -> str:
        payload = {
            "model": self.model, "system": SYSTEM_PROMPT, "prompt": prompt, "stream": True,
            "keep_alive": self._keep_alive,  # keep the model (and its prompt cache) loaded between requests
            "options": self._options,
        }
        out = ""
        try:
            async with asyncio.timeout(self._timeout_s):
                async with self._client.stream("POST", f"{self._base}/api/generate", json=payload) as res:
                    if res.status_code != 200:
                        raise ProviderError(f"HTTP {res.status_code}")
                    async for line in res.aiter_lines():
                        if not line:
                            continue
                        data = json.loads(line)
                        if data.get("error"):
                            raise ProviderError("model error")
                        out += data.get("response", "")
                        # Leaving this block closes the stream, which stops Ollama generating.
                        if data.get("done") or "\n" in out or NONE_MARKER in out or len(out) > MAX_COMPLETION_CHARS + 20:
                            break
        except (TimeoutError, httpx.HTTPError, ValueError) as exc:
            raise ProviderError(type(exc).__name__) from exc
        return out

    async def health(self) -> bool:
        try:
            res = await self._client.get(f"{self._base}/api/tags", timeout=3.0)
            res.raise_for_status()
            names = [m.get("name", "") for m in res.json().get("models", [])]
        except (httpx.HTTPError, ValueError):
            return False
        return any(n == self.model or n.startswith(self.model + ":") for n in names)

    async def warm_up(self) -> None:
        """Load the model into memory so the doctor's first suggestion isn't slow."""
        try:
            await self._client.post(
                f"{self._base}/api/generate",
                json={"model": self.model, "keep_alive": self._keep_alive},
                timeout=WARMUP_TIMEOUT_S,
            )
        except httpx.HTTPError:
            pass

    async def close(self) -> None:
        await self._client.aclose()


def _build_provider() -> Optional[CompletionProvider]:
    kind = settings.INTELLISENSE_LLM_PROVIDER
    if kind == "stub":
        return StubProvider(settings.INTELLISENSE_STUB_DELAY_MS)
    if kind == "local" and settings.INTELLISENSE_LOCAL_MODEL:
        return LocalOllamaProvider(
            settings.INTELLISENSE_LOCAL_URL, settings.INTELLISENSE_LOCAL_MODEL, settings.INTELLISENSE_LLM_TIMEOUT_S,
            settings.INTELLISENSE_LOCAL_KEEP_ALIVE, settings.INTELLISENSE_LOCAL_NUM_CTX, settings.INTELLISENSE_LOCAL_NUM_THREAD,
        )
    return None


# ---------------------------------------------------------------------------
# Post-processing & safety filter
# ---------------------------------------------------------------------------
_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


def clean_completion(raw: Optional[str], text_before: str) -> Optional[str]:
    if not raw:
        return None
    out = raw.split("\n", 1)[0]
    if NONE_MARKER in out:
        return None
    out = out.strip("\"'`")
    out = re.sub(r"\s+", " ", out)
    # Models sometimes drop the brackets and answer a bare "none" / "N/A".
    if out.strip().strip("<>.[]()").lower() in ("", "none", "n/a", "na", "null"):
        return None

    # Whitespace at the join: the note already ends in a space, so drop the model's leading one.
    if text_before.endswith((" ", "\n")):
        out = out.lstrip()
    elif text_before and text_before[-1] in ",.;:" and not out.startswith(" "):
        out = " " + out
    elif text_before and text_before[-1].isalpha() and not out.startswith(" "):
        # Models often drop the space before a new word ("and" + "shakes"). Add it when both halves are
        # whole words but the joined form is not; a genuine word ending ("radiat" + "ing") is left alone.
        last = re.search(r"[A-Za-z]+$", text_before).group(0)
        first = re.match(r"[A-Za-z]*", out).group(0)
        if first and is_word(last) and is_word(first) and not is_word(last + first):
            out = " " + out

    words = out.split()
    if len(words) > MAX_COMPLETION_WORDS:
        out = (" " if out.startswith(" ") else "") + " ".join(words[:MAX_COMPLETION_WORDS])
    out = out[:MAX_COMPLETION_CHARS].rstrip()

    # Never let the model introduce numbers (doses, vitals, dates) the doctor hasn't written.
    known = set(_NUMBER_RE.findall(text_before))
    if any(n not in known for n in _NUMBER_RE.findall(out)):
        return None
    return out or None


def _excerpt(text_before: str) -> str:
    """Last ~CONTEXT_WORDS words, starting at a word index that only moves every CONTEXT_STEP words."""
    words = re.findall(r"\S+\s*", text_before)
    n = len(words)
    if n <= CONTEXT_WORDS:
        return text_before
    start = -(-(n - CONTEXT_WORDS) // CONTEXT_STEP) * CONTEXT_STEP  # ceil to a step boundary
    return "".join(words[start:])


def extract_context(text: str, cursor: int, patient: Dict[str, Any]) -> Optional[CompletionContext]:
    """Return context for a completion, or None when completing here makes no sense."""
    cursor = max(0, min(cursor, len(text)))
    if cursor < len(text) and text[cursor] != "\n":
        return None  # only at the end of a line
    line = text[text.rfind("\n", 0, cursor) + 1: cursor]
    if len(line.split()) < 2 or line.rstrip().endswith(":"):
        return None  # empty line or a section heading
    return CompletionContext(text_before=_excerpt(text[:cursor]), section=detect_section(text, cursor), patient=patient)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class CompletionService:
    def __init__(self, provider: Optional[CompletionProvider], max_concurrency: int):
        self.provider = provider
        self._cache: "OrderedDict[str, Optional[str]]" = OrderedDict()  # in RAM only
        self._slots = asyncio.Semaphore(max(1, max_concurrency))
        self._failures = 0
        self._paused_until = 0.0
        self._healthy: Optional[bool] = None  # None = not checked yet
        self._health_task: Optional["asyncio.Task[None]"] = None

    @property
    def enabled(self) -> bool:
        return self.provider is not None

    def state(self) -> str:
        if not self.provider:
            return "disabled"
        if self._healthy is False:
            return "offline"
        if time.monotonic() < self._paused_until:
            return "paused"
        return "ready" if self._healthy else "starting"

    def info(self) -> Dict[str, Any]:
        if not self.provider:
            return {"enabled": False, "state": "disabled"}
        return {"enabled": True, "provider": self.provider.name, "model": self.provider.model, "state": self.state()}

    # --- lifecycle -----------------------------------------------------------
    async def start(self) -> None:
        if self.provider and not self._health_task:
            self._health_task = asyncio.create_task(self._health_loop())

    async def stop(self) -> None:
        await cancel_task(self._health_task)
        self._health_task = None
        if self.provider:
            await self.provider.close()

    async def _health_loop(self) -> None:
        warmed = False
        while True:
            assert self.provider
            self._healthy = await self.provider.health()
            if self._healthy and not warmed:
                warmed = True
                await self.provider.warm_up()
            await asyncio.sleep(settings.INTELLISENSE_HEALTH_INTERVAL_S)

    def _record_failure(self) -> None:
        self._failures += 1
        if self._failures >= FAILURE_THRESHOLD:
            self._paused_until = time.monotonic() + PAUSE_SECONDS
            self._failures = 0

    # --- request -------------------------------------------------------------
    async def complete(self, text: str, cursor: int, patient: Dict[str, Any]) -> Dict[str, Any]:
        started = time.perf_counter()
        result: Dict[str, Any] = {"completion": None, "cached": False}

        def done(**extra: Any) -> Dict[str, Any]:
            result.update(extra)
            result["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
            result["tier3"] = self.info()
            return result

        provider = self.provider
        if not provider:
            return done(skipped="disabled")
        if self.state() in ("offline", "paused"):
            return done(skipped=self.state())
        ctx = extract_context(text, cursor, patient)
        if not ctx:
            return done(skipped="no_context")

        prompt = build_prompt(ctx)
        key = hashlib.sha256(prompt.encode()).hexdigest()
        if key in self._cache:
            self._cache.move_to_end(key)
            return done(completion=self._cache[key], cached=True)

        if self._slots.locked():
            return done(skipped="busy")  # never queue: a queued suggestion would arrive too late
        async with self._slots:
            try:
                raw = await provider.complete(ctx, prompt)
            except ProviderError:
                self._record_failure()
                return done(skipped="error")
        self._failures = 0

        completion = clean_completion(raw, ctx.text_before)
        self._cache[key] = completion
        if len(self._cache) > CACHE_SIZE:
            self._cache.popitem(last=False)
        return done(completion=completion, provider=provider.name, model=provider.model)


completion_service = CompletionService(_build_provider(), settings.INTELLISENSE_LLM_MAX_CONCURRENCY)


async def cancel_task(task: Optional["asyncio.Task[Any]"]) -> None:
    if task and not task.done():
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
