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
                "I am Ramesh Gowda, I am 21 years old, I have fever for three days, worse at night. My phone is 98450 12345",
                "I am allergic to penicillin")])
            await agent.run_turn(s)
            assert "Ramesh" not in seen_prompts[0] and "98450" not in seen_prompts[0], seen_prompts[0]
            assert "21 years" not in seen_prompts[0], "exact age must not be in model prompt"
            assert "20-29 years" in seen_prompts[0], "age range must be sent to model"
            assert "Ramesh" not in st.memory                               # memory never stores patient personal details
            assert "21" not in st.memory                                   # exact age never in memory
            assert agent.view(s)["memory"].startswith("Patient 1")         # ...and displays as Patient 1 on doctor's screen
            assert "98450" not in agent.view(s)["memory"]                  # phone never revealed in CHIBI's memory
            transcript_line = agent.view(s)["transcript"][0]["text"]
            assert "Patient 1" in transcript_line
            assert "20-29 years old" in transcript_line
            assert "[Phone masked]" in transcript_line
            cm.add_segments(s, [Segment("patient", 2, 3, "Sometimes chest pain when I climb stairs", "Sometimes chest pain when I climb stairs")])
            await agent.run_turn(s)
            assert "fever for 3 days" in seen_prompts[1], "previous memory must be sent with the next batch"
            assert any("Chest pain on climbing stairs" == f["text"] for f in st.facts)
            assert any(a["title"].startswith("Chest pain") for a in st.alerts)
            final = await agent.finish(s)
            assert final["engine"] == "ai" and final["summary"].startswith("Patient 1"), final
            assert "Ramesh" not in final["summary"]
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


def test_patient_pii_masked_in_chibi_memory_and_transcript():
    """Verify that name, exact age, and phone number are masked as Patient 1, age range, and [Phone masked] in transcript and CHIBI memory."""
    d = deidentifier_for(None, "Dr. Rao")
    # 1. Exact phrases from the user's screenshot
    line1 = d.mask_patient_details("Patient I am suffering from kidney stone from past four years")
    assert line1 == "Patient I am suffering from kidney stone from past four years" # symptom duration preserved

    line2 = d.mask_patient_details("Patient I am 21 years old.")
    assert "20-29 years old" in line2 and "21" not in line2

    line3 = d.mask_patient_details("Patient I am 21 years old, दिखा रहा हूँ जाता हूँ")
    assert "20-29 years old" in line3 and "21" not in line3

    # 2. Spoken introduction, age, and phone number
    line4 = d.mask_patient_details("My name is Ramesh Gowda, I am 21 years old. Call me at 9845012345")
    assert "Patient 1" in line4 and "Ramesh" not in line4
    assert "20-29 years old" in line4 and "21" not in line4
    assert "[Phone masked]" in line4 and "9845012345" not in line4

    # 3. CHIBI memory masking
    mem_input = "Ramesh Gowda is 21 years old with kidney stone. Phone: 9845012345."
    mem_masked = d.mask_patient_details(mem_input)
    assert "Patient 1" in mem_masked and "Ramesh" not in mem_masked
    assert "20-29 years old" in mem_masked and "21" not in mem_masked
    assert "[Phone masked]" in mem_masked and "9845012345" not in mem_masked


if __name__ == "__main__":
    test_agent_memory_and_masking()
    print("ok  test_agent_memory_and_masking")
    test_restated_lines_update_in_place()
    print("ok  test_restated_lines_update_in_place")
    test_patient_pii_masked_in_chibi_memory_and_transcript()
    print("ok  test_patient_pii_masked_in_chibi_memory_and_transcript")
