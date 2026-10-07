import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.models import (
    User, PatientProfile, Practitioner, Representative,
    Encounter, RecordMetadata, AuditEvent
)

async def seed_database():
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        check = await session.execute(select(User))
        if check.scalars().first():
            print("Database already seeded.")
            return

        print("Seeding database with CareBridge demo personas & clinical records...")

        # 1. Patient User & Profile (Ramesh Gowda)
        u_patient = User(
            user_id="usr_ramesh_gowda",
            role="patient",
            login_identifier="ramesh.gowda@abdm.in",
            phone_number="9845012345",
            password_hash="password123"
        )
        session.add(u_patient)

        p_patient = PatientProfile(
            patient_id="usr_ramesh_gowda",
            preferred_language="kn",
            full_name="Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)",
            abha_address="91-4820-1928-1120@abdm",
            demographics_json={
                "age": 54,
                "gender": "male",
                "district": "Hassan, Karnataka (ಹಾಸನ, ಕರ್ನಾಟಕ)",
                "occupation": "Agriculture",
                "phone_masked": "+91 98450 12345"
            }
        )
        session.add(p_patient)

        # 2. Doctor User & Profile (Dr. Ananya Sharma)
        u_doctor = User(
            user_id="usr_dr_ananya",
            role="practitioner",
            login_identifier="dr.ananya@telehealth.gov.in",
            phone_number="9876543210",
            password_hash="password123"
        )
        session.add(u_doctor)

        p_doctor = Practitioner(
            practitioner_id="usr_dr_ananya",
            display_name="Dr. Ananya Sharma (MBBS, MD)",
            registration_number="NMC-KA-581920",
            specialty="General Medicine & Tele-triage",
            credential_status="verified"
        )
        session.add(p_doctor)

        # 3. Authorised Representative (Sunita Devi)
        u_rep = User(
            user_id="usr_sunita_devi",
            role="representative",
            login_identifier="sunita.devi@carebridge.in",
            password_hash="hashed_pw_sunita"
        )
        session.add(u_rep)

        p_rep = Representative(
            representative_id="rep_sunita_1",
            patient_id="usr_ramesh_gowda",
            representative_user_id="usr_sunita_devi",
            relationship_type="Daughter-in-law (ಸೊಸೆ / बहु)",
            full_name="Sunita Devi (ಸುನೀತಾ ದೇವಿ)",
            authority_status="active"
        )
        session.add(p_rep)

        # 4. Encounter #ENC-9481
        enc = Encounter(
            encounter_id="enc_9481",
            patient_id="usr_ramesh_gowda",
            practitioner_id="usr_dr_ananya",
            mode="video",
            status="in_progress",
            symptoms_text="Acute right flank pain radiating to groin for 3 days; intermittent colic with nausea.",
            allergies_json=["Penicillin (Mild urticaria rash)"],
            current_meds_json=["Antacid Suspension (Gelusil / Magnesium Hydroxide 10ml TDS)", "Paracetamol 500mg PRN"]
        )
        session.add(enc)

        # 5. ABDM Diagnostic Records (Protected in Vault)
        rec_usg = RecordMetadata(
            record_id="rec_usg_pelvis_2026",
            patient_id="usr_ramesh_gowda",
            record_type="ultrasound",
            title="Ultrasound Pelvis & Abdomen (ಉದರ ಮತ್ತು ಶ್ರೋಣಿಯ ಸ್ಕ್ಯಾನ್ ವರದಿ)",
            date_str="24 May 2026",
            file_mime_type="application/pdf",
            file_size_bytes=2450000,
            secure_storage_reference="vault://abdm/patients/ramesh/scans/usg_pelvis_20260524.enc",
            encryption_key_id="kms-aes256-gcm-hassan-dist",
            summary_findings="Mild right hydronephrosis with a 4.1mm calculus identified at the right vesicoureteric junction (VUJ). Urinary bladder normal. No perinephric fluid collection.",
            raw_preview_text="ULTRASONOGRAPHY REPORT - HASSAN DISTRICT DIAGNOSTIC CENTER\nPatient: Ramesh Gowda, 54Y/M | Ref: Dr. Ananya Sharma\nFindings: Right kidney measures 10.4 x 4.8 cm. Corticomedullary differentiation preserved. Mild pelvicalyceal dilation (hydronephrosis grade 1). Acoustic shadowing confirms 4.1 mm calculus lodged at distal ureter."
        )
        session.add(rec_usg)

        rec_blood = RecordMetadata(
            record_id="rec_blood_panel_2026",
            patient_id="usr_ramesh_gowda",
            record_type="blood_panel",
            title="Comprehensive Metabolic & Renal Panel (ರಕ್ತ ಮತ್ತು ಮೂತ್ರಪಿಂಡ ಪರೀಕ್ಷೆ)",
            date_str="10 April 2026",
            file_mime_type="application/pdf",
            file_size_bytes=1120000,
            secure_storage_reference="vault://abdm/patients/ramesh/labs/renal_panel_20260410.enc",
            encryption_key_id="kms-aes256-gcm-hassan-dist",
            summary_findings="Serum Creatinine: 0.95 mg/dL (Normal). Blood Urea Nitrogen (BUN): 16 mg/dL. Serum Electrolytes: Na+ 139, K+ 4.2. eGFR: 88 mL/min/1.73m².",
            raw_preview_text="BIOCHEMISTRY REPORT - APEX LABS HASSAN\nSerum Creatinine: 0.95 mg/dL [Ref 0.7 - 1.2]\nSerum Uric Acid: 5.4 mg/dL [Ref 3.5 - 7.2]\neGFR: 88 mL/min (Adequate renal reserve)"
        )
        session.add(rec_blood)

        rec_ecg = RecordMetadata(
            record_id="rec_ecg_resting_2026",
            patient_id="usr_ramesh_gowda",
            record_type="ecg",
            title="12-Lead Resting Electrocardiogram (ಹೃದಯ ಇಸಿಜಿ ವರದಿ)",
            date_str="15 January 2026",
            file_mime_type="application/pdf",
            file_size_bytes=840000,
            secure_storage_reference="vault://abdm/patients/ramesh/cardio/ecg_20260115.enc",
            encryption_key_id="kms-aes256-gcm-hassan-dist",
            summary_findings="Normal sinus rhythm at 72 bpm. PR interval 158 ms. QTc 412 ms. No ischemic ST depressions.",
            raw_preview_text="ECG INTERPRETATION REPORT\nHeart Rate: 72 bpm | Axis: Normal\nConclusion: Baseline normal tracing. No acute ischemic repolarization changes."
        )
        session.add(rec_ecg)

        # 6. Initial Audit Log
        audit = AuditEvent(
            actor_id="system_init",
            action="VAULT_SEEDED_COMPLIANT_DPDP",
            resource_id="abdm_vault_init",
            outcome="SUCCESS"
        )
        session.add(audit)

        await session.commit()
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_database())
