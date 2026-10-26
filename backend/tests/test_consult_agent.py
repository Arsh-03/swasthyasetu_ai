"""
CHIBI agent checks with a fake Gemini-style AI: memory is carried between batches, the AI only sees masked
text, and names come back on the doctor's screen. Run from backend/:  python -m tests.test_consult_agent
"""
import asyncio
import json

import httpx

from app.services import call_minutes as cm
from app.services import consult_agent as agent
from app.services.ai_client import ai
from app.services.asr import Segment
from app.services.deidentify import deidentifier_for

seen_prompts = []


def fake_gemini(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/models"):
        return httpx.Response(200, json={"data": [{"id": "models/gemini-2.5-flash"}]})
    body = json.loads(request.content)
    user = body["messages"][-1]["content"]
    seen_prompts.append(user)
    if "MEMORY:\n(nothing yet)" in user:
        reply = {"memory": "[PATIENT] has fever for 3 days, worse at night. Allergic to penicillin.",
                 "facts": [{"key": "complaints", "text": "Fever x 3 days, worse at night"},
                           {"key": "allergies", "text": "Penicillin (rash)"}],
                 "missed": [], "suggest": [{"kind": "ASK", "text": "Ask about the highest temperature recorded."}]}
    elif "FACTS:" in user:
        reply = {"summary": "[PATIENT] presented with fever and chest pain on exertion.", "key_points": ["Fever x 3 days"],
                 "considerations": ["Evaluate exertional chest pain"], "follow_up": ["Review in 3 days"], "gaps": []}
    else:
        reply = {"memory": "[PATIENT] has fever for 3 days, penicillin allergy, and chest pain on exertion.",
                 "facts": [{"key": "complaints", "text": "Chest pain on climbing stairs"}],
                 "missed": [{"key": "complaints", "text": "Chest pain on exertion", "why": "red flag"}], "suggest": []}
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(reply)}}]})


def test_agent_memory_and_masking():
    async def run():
        old = (ai.provider, ai.base, ai.model, ai.key, ai._transport, dict(ai._health))
        ai.provider, ai.base, ai.model, ai.key = "gemini", "https://fake/v1beta/openai", "gemini-2.5-flash", "k"
        ai._transport = httpx.MockTransport(fake_gemini)
        ai._health.update(ok=True, at=1e12)
        try:
            s = cm.create_session("enc_test", deidentifier_for("Ramesh Gowda", "Dr. Ananya Sharma"))
            st = agent.agent_of(s)
            cm.add_segments(s, [Segment("patient", 0, 1, t, t) for t in (
                "I am Ramesh Gowda, I have fever for three days, worse at night",
                "I am allergic to penicillin", "My phone is 98450 12345")])
            await agent.run_turn(s)
            assert "Ramesh" not in seen_prompts[0] and "98450" not in seen_prompts[0], seen_prompts[0]
            assert st.memory.startswith("[PATIENT]")                      # memory stays masked internally
            assert agent.view(s)["memory"].startswith("Ramesh Gowda")     # ...and real on the doctor's screen
            cm.add_segments(s, [Segment("patient", 2, 3, "Sometimes chest pain when I climb stairs", "Sometimes chest pain when I climb stairs")])
            await agent.run_turn(s)
            assert "fever for 3 days" in seen_prompts[1], "previous memory must be sent with the next batch"
            assert any("Chest pain on climbing stairs" == f["text"] for f in st.facts)
            assert any(a["title"].startswith("Chest pain") for a in st.alerts)
            final = await agent.finish(s)
            assert final["engine"] == "ai" and final["summary"].startswith("Ramesh Gowda"), final
            keys = {f["key"] for f in st.facts}
            assert {"complaints", "allergies"} <= keys, keys
        finally:
            ai.provider, ai.base, ai.model, ai.key, ai._transport = old[:5]
            ai._health.clear(); ai._health.update(old[5])
    asyncio.run(run())


def test_restated_lines_update_in_place():
    """The AI restates the complaint with one more symptom each batch: the note keeps one line, updated."""
    st = agent.AgentState()

    class Same:
        def restore(self, t):
            return t
    sh = Same()
    seq = ["Fever x 4 days",
           "Fever x 4 days, chills at night, alternating headaches",
           "Fever x 4 days, chills at night, alternating headaches, sore throat, cold, cough",
           "fever x 4 days, chills at night, headaches, sore throat, cold, cough, body pain",
           "Rash",
           "Fever x 4 days, chills at night, headaches, sore throat, cold, cough, body pain, severe body pain, difficulty swallowing",
           "Fever x 4 days, chills at night, headaches, sore throat, cold, cough, body pain, difficulty swallowing"]
    out = [agent._add_fact(st, "complaints", t, "ai", sh) for t in seq]
    assert out[1]["replaces"] == [out[0]["id"]], out[1]
    assert out[4]["replaces"] == [], out[4]
    assert out[6] is None                                      # adds nothing over the line before
    texts = [f["text"] for f in st.facts]
    assert len(texts) == 2 and texts[1] == "Rash" and "difficulty swallowing" in texts[0], texts


if __name__ == "__main__":
    test_agent_memory_and_masking()
    print("ok  test_agent_memory_and_masking")
    test_restated_lines_update_in_place()
    print("ok  test_restated_lines_update_in_place")
