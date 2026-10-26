"""
SETU-Shield checks. Run from backend/:  python -m tests.test_privacy_gateway   (also works under pytest)
"""
import asyncio

from app.config import settings
from app.services import privacy_gateway as pg
from app.services.deidentify import Deidentifier

PATIENT = "Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)"
DOCTOR = "Dr. Ananya Sharma (MBBS, MD)"


def make_shield() -> pg.Shield:
    deid = Deidentifier([PATIENT], [DOCTOR], ["Hassan, Karnataka"])
    return pg.Shield("enc_9481", deid,
                     identifiers=["enc_9481", "usr_ramesh_gowda", "ramesh.gowda@abdm", "+91 98450 12345", "NMC-KA-581920"],
                     names=[PATIENT, DOCTOR, "Hassan, Karnataka"])


NOTE = ("Ramesh Gowda, 54M from Hassan, Karnataka. Ph 98450 12345, ABHA ramesh.gowda@abdm, id usr_ramesh_gowda.\n"
        "ರಮೇಶ್ ಗೌಡ ಅವರಿಗೆ ಜ್ವರ. Fever for 3 days, BP 130/85, SpO2 98%. Paracetamol 500mg SOS. Seen by Dr. Ananya Sharma.")


def test_mask_and_keep_clinical():
    sh = make_shield()
    sent = sh.prepare("notepad_autocomplete", {"note": NOTE, "age": 54, "sex": "Male"})
    out = sent["note"]
    for secret in ("Ramesh", "Gowda", "ರಮೇಶ್", "Hassan", "98450", "ramesh.gowda@abdm", "usr_ramesh_gowda", "Ananya", "Sharma"):
        assert secret not in out, (secret, out)
    for clinical in ("Fever for 3 days", "BP 130/85", "SpO2 98%", "Paracetamol 500mg", "Karnataka"):
        assert clinical in out, (clinical, out)
    assert sh.scan(sent) == [], sh.scan(sent)


def test_misspelt_names():
    sh = make_shield()
    out = sh.mask("Ramesh Goda and Mr Ramsh, seen by Dr Anaya Sharmaa. Fever with chills, rash, dose, share, comes.")
    for misspelt in ("Goda", "Ramsh", "Anaya", "Sharmaa"):
        assert misspelt not in out, (misspelt, out)
    for word in ("Fever", "chills", "rash", "dose", "share", "comes"):
        assert word in out, (word, out)
    try:
        sh.release("notepad_autocomplete", {"prompt": "patient Gowdaa has fever"})
        raise AssertionError("misspelt name not blocked")
    except pg.OutboundBlocked as exc:
        assert "misspelt name" in exc.kinds


def test_generalise_and_minimise():
    sh = make_shield()
    sent = sh.prepare("notepad_autocomplete", {"note": "x y", "age": 54, "sex": "M", "patient_id": "usr_ramesh_gowda",
                                               "district": "Hassan"})
    assert sent["age_band"] == "50s" and sent["sex"] == "male"
    assert "age" not in sent and "patient_id" not in sent and "district" not in sent, sent
    assert [pg.age_band(a) for a in (0, 7, 15, 30, 85)] == ["infant", "child", "teenager", "30s", "80+"]


def test_verify_blocks_leaks():
    sh = make_shield()
    for leaky, kind in [("Patient Ramesh complains of fever", "name or place"),
                        ("call him on 98450-12345", "phone or ID number"),
                        ("record usr_ramesh_gowda", "record identifier"),
                        ("ರಮೇಶ್ ಗೌಡ ಅವರಿಗೆ ಜ್ವರ", "name or place"),
                        ("lives in Hassan", "name or place"),
                        ("DOB 12/04/1971", "full date")]:
        try:
            sh.release("notepad_autocomplete", {"prompt": leaky})
        except pg.OutboundBlocked as exc:
            assert kind in exc.kinds, (leaky, exc.kinds)
        else:
            raise AssertionError(f"not blocked: {leaky}")
    assert pg.LEDGER[-1]["outcome"] == "blocked" and "prompt" not in pg.LEDGER[-1]   # no content in the ledger


def test_clean_request_is_recorded_without_content():
    sh = make_shield()
    sent = sh.prepare("live_suggestions", {"transcript": "[PATIENT]: fever for 3 days", "note": NOTE, "allergies": "Penicillin"})
    rid = sh.release("live_suggestions", [{"role": "user", "content": str(sent)}])
    row = pg.LEDGER[-1]
    assert row["request_id"] == rid and row["outcome"] == "sent" and len(row["sha256"]) == 16
    assert all(NOTE[:20] not in str(v) for v in row.values())


def test_voice_never_to_third_party():
    sh = make_shield()
    old = settings.AI_SPEECH_DESTINATION
    try:
        settings.AI_SPEECH_DESTINATION = "self_hosted"
        sh.release("speech_to_text", b"\x00" * 100, kind="speech")
        settings.AI_SPEECH_DESTINATION = "third_party"
        try:
            sh.release("speech_to_text", b"\x00" * 100, kind="speech")
            raise AssertionError("voice sent to a third party")
        except pg.OutboundBlocked as exc:
            assert exc.kinds == ["voice to a third party"]
    finally:
        settings.AI_SPEECH_DESTINATION = old


def test_restore_only_for_doctor():
    sh = make_shield()
    sent = sh.prepare("notepad_autocomplete", {"note": "Ramesh Gowda has fever"})
    assert "[PATIENT]" in sent["note"]
    assert sh.restore("[PATIENT] advised rest") == "Ramesh Gowda advised rest"


def test_autocomplete_service_masks_before_sending():
    """The model receives only the masked prompt; the doctor gets real names back."""
    from app.services import llm_completion as lc

    seen = {}

    class Spy:
        name, model = "spy", "spy"

        async def complete(self, ctx, prompt):
            seen["prompt"] = prompt
            return " [PATIENT] advised rest"

        async def health(self):
            return True

        async def warm_up(self):
            return None

        async def close(self):
            return None

    svc = lc.CompletionService(Spy(), 1)
    svc._healthy = True
    text = "Ramesh Gowda 54M ph 98450 12345 c/o fever since 3 days and"
    res = asyncio.run(svc.complete(text, len(text), {"age": 54, "sex": "male"}, "", make_shield()))
    assert "Ramesh" not in seen["prompt"] and "98450" not in seen["prompt"] and "54-year-old" not in seen["prompt"], seen
    assert "50s" in seen["prompt"] and "54M" not in seen["prompt"]
    assert pg.generalise_ages("54M, 7 yrs F, a 66-year-old, aged 81; fever 3 days, BP 130/85") ==         "50s M, child F, a 60s, aged 80+; fever 3 days, BP 130/85"
    assert res["completion"] and "Ramesh Gowda" in res["completion"], res


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print("ok ", t.__name__)
    print(f"{len(tests)} SETU-Shield checks passed")
