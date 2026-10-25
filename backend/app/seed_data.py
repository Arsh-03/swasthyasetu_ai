"""
Demo data for SwasthyaSetu / CareBridge.

Runs on server startup and only seeds an empty database. To wipe and reseed
(e.g. after a schema change) run:  python -m app.seed_data --reset
"""
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal, Base, migration_engine
from app.models.models import (
    Appointment, AuditEvent, Consent, Encounter, PatientProfile, Practitioner,
    RecordMetadata, Representative, User,
)

SEED_DIR = Path(__file__).parent / "seed"


def _load(name: str):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def _digits(phone: str) -> str:
    """'+91 98450 12345' -> '9845012345'"""
    d = "".join(ch for ch in phone if ch.isdigit())
    return d[-10:]


async def reset_database():
    async with migration_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("Dropped all tables.")


async def seed_database():
    async with migration_engine.begin() as conn:
        # Create all tables (direct connection, not the pooler)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        check = await session.execute(select(User))
        if check.scalars().first():
            print("Database already seeded.")
            return

        print("Seeding database with CareBridge demo personas & clinical records...")
        now = datetime.now(timezone.utc)
        charts = _load("patient_charts.json")
        queue = {p["patient_id"]: p for p in _load("queue_patients.json")}

        # --- Doctors -------------------------------------------------------
        doctors = [
            ("usr_dr_ananya", "dr.ananya@telehealth.gov.in", "9876543210", "Dr. Ananya Sharma (MBBS, MD)",
             "NMC-KA-581920", "General Medicine & Tele-triage", "Hassan District Telemedicine Hub"),
            ("usr_dr_ks_rao", "dr.ksrao@arasikere-phc.in", "9876543211", "Dr. K. S. Rao (MBBS)",
             "NMC-KA-441092", "Family Medicine", "Arasikere Primary Health Centre"),
        ]
        for uid, login, phone, name, reg, specialty, facility in doctors:
            session.add(User(user_id=uid, role="practitioner", login_identifier=login,
                             phone_number=phone, password_hash="password123"))
            session.add(Practitioner(practitioner_id=uid, display_name=name, registration_number=reg,
                                     specialty=specialty, facility=facility, credential_status="verified"))

        # --- Patients (profile + full chart) --------------------------------
        for pid, chart in charts.items():
            q = queue.get(pid, {})
            phone = q.get("phone_number") or _digits(chart["phoneNumber"])
            login = "ramesh.gowda@abdm.in" if pid == "usr_ramesh_gowda" else chart["abhaAddress"]
            session.add(User(user_id=pid, role="patient", login_identifier=login,
                             phone_number=phone, password_hash="password123"))

            demographics = dict(q.get("demographics") or {})
            demographics.setdefault("age", chart["age"])
            demographics.setdefault("gender", chart["gender"])
            demographics.setdefault("district", chart["district"])
            demographics.setdefault("occupation", chart["occupation"])
            demographics.setdefault("phone_masked", chart["phoneNumber"])

            stored_chart = {k: v for k, v in chart.items() if k != "nextAppointment"}
            session.add(PatientProfile(
                patient_id=pid,
                preferred_language=q.get("preferred_language", "kn"),
                full_name=chart["fullName"],
                abha_address=chart["abhaAddress"],
                demographics_json=demographics,
                avatar_url=q.get("avatar_url"),
                chart_json=stored_chart,
            ))

        # Authorised representative (needs her user row first)
        session.add(User(user_id="usr_sunita_devi", role="representative",
                         login_identifier="sunita.devi@carebridge.in", password_hash="hashed_pw_sunita"))
        # Representative has foreign keys but no ORM relationships, so SQLAlchemy
        # can't infer the insert order on its own: write users/profiles first.
        await session.flush()
        session.add(Representative(
            representative_id="rep_sunita_1",
            patient_id="usr_ramesh_gowda",
            representative_user_id="usr_sunita_devi",
            relationship_type="Daughter-in-law (ಸೊಸೆ / बहु)",
            full_name="Sunita Devi (ಸುನೀತಾ ದೇವಿ)",
            authority_status="active",
        ))

        # --- Triage queue: one open encounter per patient -------------------
        encounter_ids = {"usr_ramesh_gowda": "enc_9481"}
        for pid, q in queue.items():
            minutes_waiting = int("".join(ch for ch in q.get("wait_time", "0") if ch.isdigit()) or 0)
            enc_id = encounter_ids.get(pid, f"enc_{pid.split('_', 1)[1]}")
            encounter_ids[pid] = enc_id
            session.add(Encounter(
                encounter_id=enc_id,
                patient_id=pid,
                practitioner_id="usr_dr_ananya",
                start_time=now - timedelta(minutes=minutes_waiting),
                mode="video",
                status="in_progress" if pid == "usr_ramesh_gowda" else "queued",
                symptoms_text=q.get("complaint"),
                vitals_summary=q.get("vitals"),
                urgency=q.get("urgency", "routine"),
                allergies_json=q.get("allergies", []),
                current_meds_json=q.get("active_rx", []),
            ))

        # --- Upcoming appointments ------------------------------------------
        for pid, chart in charts.items():
            apt = chart["nextAppointment"]
            session.add(Appointment(
                appointment_id=apt["appointmentId"],
                patient_id=pid,
                practitioner_id="usr_dr_ananya",
                date_label=apt["date"],
                time_label=apt["time"],
                relative_label=apt.get("relativeTime"),
                mode=apt["mode"],
                doctor_name=apt["doctorName"],
                specialty=apt["specialty"],
                facility=apt["facility"],
                agenda=apt["agenda"],
                status=apt["status"],
                instructions_json=apt.get("instructionsForPatient", []),
                is_rescheduled=False,
            ))

        # --- ABDM diagnostic records (Ramesh) -------------------------------
        records = [
            RecordMetadata(
                record_id="rec_usg_pelvis_2026",
                patient_id="usr_ramesh_gowda",
                record_type="ultrasound",
                category="diagnostic",
                type_label="Diagnostic Ultrasound Imaging",
                title="Ultrasound Pelvis & Abdomen",
                facility="Hassan District Telemedicine Centre",
                date_str="14 Sep 2026",
                file_mime_type="application/dicom",
                file_size_bytes=2450000,
                secure_storage_reference="vault://abdm/patients/ramesh/scans/usg_pelvis_20260914.enc",
                encryption_key_id="kms-aes256-gcm-hassan-dist",
                summary_findings="Right kidney reveals mild hydronephrosis with a 4.2mm non-obstructing calculus in the lower pole calyx. Left kidney, urinary bladder, and liver appear normal.",
                raw_preview_text="ULTRASONOGRAPHY REPORT - HASSAN DISTRICT TELEMEDICINE CENTRE\nPatient: Ramesh Gowda, 54Y/M\nFindings: Mild pelvicalyceal dilation (hydronephrosis grade 1). Acoustic shadowing confirms 4.2 mm calculus in right lower pole calyx.",
                imaging_json={
                    "modality": "2D B-Mode Real-Time Ultrasound (Curvilinear 3.5MHz)",
                    "organ": "Renal / Urinary Tract & Lower Abdomen",
                    "findingsSummary": "Nephrolithiasis (4.2mm right lower pole) + Grade I Hydronephrosis",
                    "caliperMeasurement": "4.2 mm x 3.8 mm (Caliper L1)",
                    "operator": "Dr. C. R. Patil, Consultant Sonologist",
                },
                created_at=now - timedelta(days=39),
            ),
            RecordMetadata(
                record_id="rec_blood_panel_2026",
                patient_id="usr_ramesh_gowda",
                record_type="blood_panel",
                category="lab",
                type_label="Laboratory Biochemistry",
                title="Serum Creatinine & Blood Urea Nitrogen",
                facility="Primary Health Centre Arasikere",
                date_str="12 Aug 2026",
                file_mime_type="application/fhir+json",
                file_size_bytes=420000,
                secure_storage_reference="vault://abdm/patients/ramesh/labs/renal_panel_20260812.enc",
                encryption_key_id="kms-aes256-gcm-hassan-dist",
                summary_findings="Serum Creatinine: 0.9 mg/dL (Normal). BUN: 14 mg/dL. Fasting Plasma Glucose: 118 mg/dL. Electrolytes within normal limits.",
                raw_preview_text="BIOCHEMISTRY REPORT - PHC ARASIKERE\nSerum Creatinine: 0.9 mg/dL [Ref 0.7 - 1.3]\nBUN: 14 mg/dL [Ref 7 - 20]",
                lab_results_json=[
                    {"test": "Serum Creatinine", "value": "0.9", "unit": "mg/dL", "range": "0.7 - 1.3", "flag": "normal"},
                    {"test": "Blood Urea Nitrogen (BUN)", "value": "14", "unit": "mg/dL", "range": "7 - 20", "flag": "normal"},
                    {"test": "Fasting Plasma Glucose", "value": "118", "unit": "mg/dL", "range": "70 - 99", "flag": "elevated"},
                    {"test": "Serum Sodium (Na+)", "value": "139", "unit": "mEq/L", "range": "135 - 145", "flag": "normal"},
                    {"test": "Serum Potassium (K+)", "value": "4.3", "unit": "mEq/L", "range": "3.5 - 5.1", "flag": "normal"},
                ],
                created_at=now - timedelta(days=72),
            ),
            RecordMetadata(
                record_id="rec_discharge_2026",
                patient_id="usr_ramesh_gowda",
                record_type="discharge_summary",
                category="diagnostic",
                type_label="Discharge Summary",
                title="Inpatient Care Summary",
                facility="Hassan General Hospital",
                date_str="28 Jan 2026",
                file_mime_type="application/pdf",
                file_size_bytes=1100000,
                secure_storage_reference="vault://abdm/patients/ramesh/summaries/discharge_20260128.enc",
                encryption_key_id="kms-aes256-gcm-hassan-dist",
                summary_findings="Admitted for observation of acute gastritis; discharged stable after 2 days with dietary advice.",
                raw_preview_text="DISCHARGE SUMMARY - HASSAN GENERAL HOSPITAL",
                created_at=now - timedelta(days=268),
            ),
            RecordMetadata(
                record_id="rec_ecg_resting_2026",
                patient_id="usr_ramesh_gowda",
                record_type="ecg",
                category="diagnostic",
                type_label="Cardiology (ECG)",
                title="12-Lead Resting Electrocardiogram",
                facility="Hassan District Hospital",
                date_str="15 Jan 2026",
                file_mime_type="application/pdf",
                file_size_bytes=840000,
                secure_storage_reference="vault://abdm/patients/ramesh/cardio/ecg_20260115.enc",
                encryption_key_id="kms-aes256-gcm-hassan-dist",
                summary_findings="Normal sinus rhythm at 72 bpm. PR interval 158 ms. QTc 412 ms. No ischemic ST depressions.",
                raw_preview_text="ECG INTERPRETATION REPORT\nHeart Rate: 72 bpm | Axis: Normal",
                created_at=now - timedelta(days=281),
            ),
        ]
        session.add_all(records)
        await session.flush()

        # --- Consent history ------------------------------------------------
        session.add(Consent(
            consent_id="cst_usg_ananya",
            encounter_id="enc_9481",
            patient_id="usr_ramesh_gowda",
            practitioner_id="usr_dr_ananya",
            record_id="rec_usg_pelvis_2026",
            purpose="Evaluating acute flank colic & suspected nephrolithiasis",
            status="approved",
            created_at=now - timedelta(minutes=12),
            expires_at=now + timedelta(minutes=48),
        ))
        session.add(Consent(
            consent_id="cst_labs_ksrao",
            encounter_id="enc_9481",
            patient_id="usr_ramesh_gowda",
            practitioner_id="usr_dr_ks_rao",
            record_id="rec_blood_panel_2026",
            purpose="Routine kidney function monitoring & pre-operative review",
            status="approved",
            created_at=datetime(2026, 9, 14, 10, 45, tzinfo=timezone.utc),
            expires_at=datetime(2026, 9, 14, 11, 45, tzinfo=timezone.utc),
        ))

        # --- Audit trail ----------------------------------------------------
        audit_rows = [
            ("system_init", "VAULT_SEEDED_COMPLIANT_DPDP", "abdm_vault_init", "SUCCESS", None, now - timedelta(minutes=30)),
            ("usr_dr_ks_rao", "CONSENT_EXPIRED_REVOKED", "rec_blood_panel_2026", "REVOKED",
             "Token TTL Expired (60m window lapsed)", datetime(2026, 9, 14, 11, 45, tzinfo=timezone.utc)),
            ("usr_dr_ananya", "CONSENT_REQUEST", "rec_usg_pelvis_2026", "PENDING",
             "Encounter #ENC-9481 Triage", now - timedelta(minutes=14)),
            ("patient:usr_ramesh_gowda", "DPDP_OTP_VERIFIED_APPROVAL", "usr_ramesh_gowda", "SUCCESS",
             "Granted 60-min purpose-bound access", now - timedelta(minutes=12, seconds=30)),
            ("usr_dr_ananya", "CONSENT_TOKEN_MINTED", "rec_usg_pelvis_2026", "SUCCESS",
             "Evaluating suspected nephrolithiasis / colic", now - timedelta(minutes=12)),
        ]
        for actor, action, resource, outcome, purpose, ts in audit_rows:
            session.add(AuditEvent(actor_id=actor, action=action, resource_id=resource,
                                   outcome=outcome, purpose=purpose, timestamp=ts))

        await session.commit()
        print("Database seeding completed successfully.")


async def _main():
    if "--reset" in sys.argv:
        await reset_database()
    await seed_database()


if __name__ == "__main__":
    asyncio.run(_main())
