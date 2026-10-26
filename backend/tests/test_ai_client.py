"""
AI client checks against a fake OpenAI-style server (what Gemini and OpenAI speak).
Run from backend/:  python -m tests.test_ai_client
"""
import asyncio
import json

import httpx

from app.services.ai_client import AIClient, AIUnavailable, parse_json

calls = []


def fake_server(request: httpx.Request) -> httpx.Response:
    calls.append(request)
    assert request.headers["Authorization"] == "Bearer test-key"
    if request.url.path.endswith("/models"):
        return httpx.Response(200, json={"data": [{"id": "models/gemini-2.0-flash"}, {"id": "models/gemini-2.5-flash-lite"}]})
    body = json.loads(request.content)
    if "reasoning_effort" in body and body.get("max_tokens") == 7:
        return httpx.Response(400, json={"error": "unknown field"})          # forces the plain retry
    if body.get("stream"):
        sse = "".join(f'data: {json.dumps({"choices": [{"delta": {"content": p}}]})}\n\n' for p in ["Fever ", "for 3 ", "days"])
        return httpx.Response(200, text=sse + "data: [DONE]\n\n")
    return httpx.Response(200, json={"choices": [{"message": {"content": '```json\n{"summary": "ok"}\n```'}}]})


def make() -> AIClient:
    c = AIClient()
    c.provider, c.base, c.model, c.key = "gemini", "https://fake/v1beta/openai", "gemini-9-flash", "test-key"
    c._transport = httpx.MockTransport(fake_server)
    return c


def test_gemini_style_requests():
    async def run():
        c = make()
        assert await c.online(force=True)
        assert c.model == "gemini-2.5-flash-lite", c.model          # configured model missing -> a flash one
        assert c.destination() == "third_party"
        text = "".join([p async for p in c.stream_chat([{"role": "user", "content": "hi"}])])
        assert text == "Fever for 3 days", text
        assert await c.chat_json([{"role": "user", "content": "hi"}]) == {"summary": "ok"}
        out = await c.chat([{"role": "user", "content": "x"}], max_tokens=7)          # 400 -> retried plainly
        assert "summary" in out
        assert "reasoning_effort" not in json.loads(calls[-1].content)
    asyncio.run(run())


def test_budget_keeps_room_for_important_requests():
    async def run():
        c = make()
        c._rpm = lambda: 4                                                         # 4 requests per minute
        msgs = [{"role": "user", "content": "x"}]
        await c.chat(msgs, important=False)
        await c.chat(msgs, important=False)
        try:
            await c.chat(msgs, important=False)                                    # autocomplete: over its half
            raise AssertionError("budget not enforced")
        except AIUnavailable as exc:
            assert "budget" in str(exc)
        await c.chat(msgs, important=True)                                         # the agent still gets through
    asyncio.run(run())


def test_rate_limit_and_timeouts_fall_back():
    async def run():
        c = make()
        def limited(request):
            if request.url.path.endswith("/models"):
                return httpx.Response(200, json={"data": []})
            return httpx.Response(429, headers={"Retry-After": "30"}, json={"error": "quota"})
        c._transport = httpx.MockTransport(limited)
        try:
            await c.chat([{"role": "user", "content": "x"}])
            raise AssertionError("429 not reported")
        except AIUnavailable:
            pass
        assert c.info()["rate_limited_for_s"] >= 25, c.info()           # pauses as long as the provider asked
        try:
            await c.chat([{"role": "user", "content": "x"}])
            raise AssertionError("request sent during the cooldown")
        except AIUnavailable as exc:
            assert "budget" in str(exc)
        c._cooldown_until = 0
        def slow(request):
            raise httpx.ReadTimeout("slow", request=request)
        c._transport = httpx.MockTransport(slow)
        for call in (c.chat([{"role": "user", "content": "x"}]),):
            try:
                await call
                raise AssertionError("timeout not converted")
            except AIUnavailable:
                pass
        try:
            async for _ in c.stream_chat([{"role": "user", "content": "x"}]):
                pass
            raise AssertionError("stream timeout not converted")
        except AIUnavailable:
            pass
    asyncio.run(run())


def test_parse_json():
    assert parse_json('Sure! {"a": 1} hope that helps') == {"a": 1}
    assert parse_json("not json") == {}


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok ", name)
    print("AI client checks passed")
