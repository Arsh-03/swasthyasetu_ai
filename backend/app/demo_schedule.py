"""
Demo schedule for the doctor portal: past visits (with signed notes), today's and upcoming appointments,
a few extra patients, and some notifications, all relative to the current date.

Runs at startup. It does nothing while the demo schedule is current, and rebuilds it once every demo
appointment is in the past (so a demo machine always has a "today"). Only rows whose ids start with
`demo_` / `apt_demo_` / `enc_demo_` / `ntf_demo_` / `aud_demo_` are ever replaced; real data is untouched.

    python -m app.demo_schedule --rebuild     rebuild now
"""
import asyncio
import random
import sys
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.models.models import (
    Appointment, AuditEvent, CareTask, ChatMessage, ClinicalNote, ConsultationNotepad, Encounter, HealthWorker, Notification,
    PatientProfile, Practitioner, User, VitalReading, WorkerConsent,
)

IST = timezone(timedelta(hours=5, minutes=30))
DOCTOR = "usr_dr_ananya"

# Extra patients so the portal has a realistic list (the four seeded patients have full charts).
EXTRA_PATIENTS = [
    ("demo_pat_manjunath", "Manjunath S", 47, "Male", "Tumakuru, Karnataka", "Bus conductor", "9845100001",
     ["Type 2 Diabetes Mellitus"], []),
    ("demo_pat_lakshmi", "Lakshmi Narayan", 61, "Female", "Hassan, Karnataka", "Retired teacher", "9845100002",
     ["Essential Hypertension", "Osteoarthritis of knee"], ["Sulfa drugs"]),
    ("demo_pat_imran", "Imran Pasha", 33, "Male", "Mysuru, Karnataka", "Electrician", "9845100003",
     ["Bronchial Asthma"], []),
    ("demo_pat_geetha", "Geetha Ramesh", 29, "Female", "Mandya, Karnataka", "Garment worker", "9845100004",
     ["Iron deficiency anaemia"], []),
    ("demo_pat_basavaraj", "Basavaraj Patil", 72, "Male", "Belagavi, Karnataka", "Farmer", "9845100005",
     ["COPD", "Benign prostatic hyperplasia"], ["Aspirin"]),
    ("demo_pat_ayesha", "Ayesha Begum", 41, "Female", "Chikkamagaluru, Karnataka", "Tailor", "9845100006",
     ["Hypothyroidism"], []),
]

SEEDED_PATIENTS = ["usr_ramesh_gowda", "pat_kamla_devi", "pat_rajesh_kumar", "pat_sunita_patil"]

# (complaint, vitals, subjective, objective, assessment, plan)
VISITS = [
    ("Follow-up: blood sugar control", "BP 132/84 • FBS 148 mg/dL", "Missed evening doses twice this week. No hypoglycaemia.",
     "Alert, well hydrated. Feet: no ulcers, pulses felt.", "Type 2 diabetes, sub-optimal control",
     {"medicine": "Metformin 500 mg twice daily after food", "advice": "Walk 30 minutes daily; reduce rice portion.", "follow_up": "2 weeks"}),
    ("Headache and dizziness", "BP 156/96 • HR 82", "Morning headaches for 5 days; stopped amlodipine when tablets ran out.",
     "No focal neurological deficit.", "Uncontrolled hypertension (non-adherence)",
     {"medicine": "Amlodipine 5 mg once daily", "advice": "Low salt diet; check BP at the PHC every 3 days.", "follow_up": "1 week"}),
    ("Cough and wheeze at night", "SpO2 96% • RR 20", "Night cough for 10 days after dust exposure at work.",
     "Bilateral scattered wheeze, no crackles.", "Asthma exacerbation, mild",
     {"medicine": "Salbutamol inhaler 2 puffs as needed; Budesonide inhaler 200 mcg twice daily", "advice": "Use a mask at work. Rinse mouth after inhaler.", "follow_up": "10 days"}),
    ("Tiredness, breathless on stairs", "Hb 9.1 g/dL • HR 96", "Fatigue for a month, heavy periods.",
     "Pallor present. No pedal oedema.", "Iron deficiency anaemia",
     {"medicine": "Ferrous sulphate 200 mg once daily", "advice": "Green leafy vegetables, jaggery; take iron with lemon water.", "follow_up": "4 weeks with repeat Hb"}),
    ("Fever for 2 days", "Temp 101.2°F • SpO2 98%", "Fever with body ache, no cough, no rash.",
     "Throat mildly congested. Chest clear.", "Acute viral fever",
     {"medicine": "Paracetamol 650 mg up to three times a day", "advice": "Fluids, rest. Return if fever lasts beyond 3 days.", "follow_up": "As needed"}),
    ("Knee pain worse in the morning", "BP 138/86 • BMI 29", "Both knees stiff for 20 minutes after waking.",
     "Crepitus both knees, no effusion.", "Osteoarthritis, both knees",
     {"medicine": "Diclofenac gel twice daily", "advice": "Quadriceps exercises; avoid squatting.", "follow_up": "6 weeks"}),
    ("Review of thyroid report", "TSH 6.8 mIU/L • HR 68", "Feels tired; weight up 2 kg.",
     "No goitre.", "Hypothyroidism, dose adjustment needed",
     {"medicine": "Levothyroxine 75 mcg empty stomach", "advice": "Take 30 minutes before tea.", "follow_up": "6 weeks with TSH"}),
    ("Breathlessness on walking", "SpO2 93% • RR 22", "More breathless in the cold mornings; smoker for 40 years.",
     "Reduced air entry bases, prolonged expiration.", "COPD, stable",
     {"medicine": "Tiotropium inhaler once daily", "advice": "Stop beedi; breathing exercises.", "follow_up": "1 month"}),
    ("Flank pain review", "BP 128/82 • Temp 98.6°F", "Pain reduced; passed small gravel yesterday.",
     "Mild right renal angle tenderness.", "Right ureteric calculus, passing",
     {"medicine": "Tamsulosin 0.4 mg at bedtime", "advice": "3 litres of water daily.", "follow_up": "Ultrasound in 2 weeks"}),
    ("Burning urination", "Temp 99.4°F", "Burning and frequency for 3 days.",
     "Suprapubic tenderness.", "Lower urinary tract infection",
     {"medicine": "Nitrofurantoin 100 mg twice daily for 5 days", "advice": "Plenty of water.", "follow_up": "If not better in 3 days"}),
]

UPCOMING_AGENDAS = [
    "Review blood sugar log", "BP check after dose change", "Inhaler technique review", "Repeat haemoglobin result",
    "Thyroid report review", "Post-fever follow-up", "Ultrasound result discussion", "Knee pain follow-up",
    "Medication refill and review", "Diet and exercise counselling",
]


def _at(day: datetime, hh: int, mm: int) -> datetime:
    """A local (IST) clock time on `day`, as UTC."""
    return datetime.combine(day.date(), time(hh, mm), tzinfo=IST).astimezone(timezone.utc)


def _labels(start: datetime) -> tuple[str, str]:
    local = start.astimezone(IST)
    return local.strftime("%Y-%m-%d"), local.strftime("%I:%M %p").lstrip("0")


async def _is_current(session) -> bool:
    rows = (await session.execute(select(Appointment.scheduled_at).where(
        Appointment.appointment_id.like("apt_demo_%")))).scalars().all()
    now = datetime.now(timezone.utc)
    return any(r and (r if r.tzinfo else r.replace(tzinfo=timezone.utc)) > now for r in rows)


async def _clear(session) -> None:
    enc_ids = (await session.execute(select(Encounter.encounter_id).where(
        Encounter.encounter_id.like("enc_demo_%")))).scalars().all()
    if enc_ids:
        await session.execute(delete(ClinicalNote).where(ClinicalNote.encounter_id.in_(enc_ids)))
        await session.execute(delete(ConsultationNotepad).where(ConsultationNotepad.encounter_id.in_(enc_ids)))
    await session.execute(delete(Appointment).where(Appointment.appointment_id.like("apt_demo_%")))
    await session.execute(delete(Encounter).where(Encounter.encounter_id.like("enc_demo_%")))
    await session.execute(delete(Notification).where(Notification.notification_id.like("ntf_demo_%")))
    await session.execute(delete(ChatMessage).where(ChatMessage.message_id.like("chat_demo_%")))
    await session.execute(delete(CareTask).where(CareTask.task_id.like("task_demo_%")))
    await session.execute(delete(VitalReading).where(VitalReading.reading_id.like("vr_demo_%")))
    await session.execute(delete(WorkerConsent).where(WorkerConsent.consent_id.like("wc_demo_%")))
    await session.execute(delete(AuditEvent).where(AuditEvent.event_id.like("aud_demo_%")))
    await session.flush()


async def _ensure_extra_patients(session) -> None:
    for pid, name, age, gender, district, job, phone, conditions, allergies in EXTRA_PATIENTS:
        if await session.get(PatientProfile, pid):
            continue
        session.add(User(user_id=pid, role="patient", login_identifier=f"{pid}@abdm", phone_number=phone,
                         password_hash="password123"))
        await session.flush()
        session.add(PatientProfile(
            patient_id=pid, preferred_language="kn", full_name=name,
            abha_address=f"91-77{phone[-2:]}-2026-{phone[-4:]}@abdm",
            demographics_json={"age": age, "gender": gender, "district": district, "occupation": job,
                               "phone_masked": f"+91 {phone[:5]} {phone[5:]}"},
            chart_json={
                "chronicConditions": [{"id": f"c{i}", "name": c, "icd10": "", "diagnosedYear": 2024, "status": "Active",
                                       "severity": "Moderate", "notes": ""} for i, c in enumerate(conditions)],
                "allergies": [{"id": f"a{i}", "allergen": a, "reaction": "Rash", "severity": "Moderate",
                               "diagnosedDate": "2023"} for i, a in enumerate(allergies)],
            },
        ))
    await session.flush()


ASHA_ID = "usr_asha_lakshmamma"


async def _ensure_asha(session) -> None:
    """Demo ASHA worker (sign in with ASHA-HSN-0142 / password123). Kept across rebuilds."""
    if await session.get(HealthWorker, ASHA_ID):
        return
    session.add(User(user_id=ASHA_ID, role="asha", login_identifier="asha.lakshmamma@nhm.karnataka.gov.in",
                     phone_number="9845070142", password_hash="password123"))
    await session.flush()
    session.add(HealthWorker(worker_id=ASHA_ID, display_name="Lakshmamma K", worker_code="ASHA-HSN-0142",
                             area="Hassan, Karnataka", facility="Ayushman Arogya Mandir, Arasikere"))
    await session.flush()


async def build(session) -> None:
    rnd = random.Random(42)
    await _clear(session)
    await _ensure_extra_patients(session)
    doctor = await session.get(Practitioner, DOCTOR)
    if not doctor:
        return
    patients = SEEDED_PATIENTS + [p[0] for p in EXTRA_PATIENTS]
    profiles = {p.patient_id: p for p in (await session.execute(
        select(PatientProfile).where(PatientProfile.patient_id.in_(patients)))).scalars()}
    patients = [p for p in patients if p in profiles]
    now = datetime.now(timezone.utc)
    today = now.astimezone(IST)
    n = 0

    def appointment(pid, start, *, status, agenda, enc_id=None, mode="Telehealth Video", minutes=20):
        nonlocal n
        n += 1
        date_label, time_label = _labels(start)
        return Appointment(
            appointment_id=f"apt_demo_{n:03d}", patient_id=pid, practitioner_id=DOCTOR, doctor_name=doctor.display_name,
            specialty=doctor.specialty, facility=doctor.facility, date_label=date_label, time_label=time_label,
            relative_label="", mode=mode, agenda=agenda, status="Confirmed by Patient", instructions_json=[],
            scheduled_at=start, duration_minutes=minutes, visit_status=status, encounter_id=enc_id,
        )

    # --- Past 14 days: completed visits with signed notes ---------------------------------------
    for back in range(14, 0, -1):
        day = today - timedelta(days=back)
        if day.weekday() == 6:
            continue  # Sundays off
        for slot in range(rnd.randint(1, 4)):
            pid = rnd.choice(patients)
            visit = rnd.choice(VISITS)
            start = _at(day, 9 + slot * 2, rnd.choice([0, 15, 30]))
            end = start + timedelta(minutes=rnd.randint(12, 25))
            enc_id = f"enc_demo_{n + 1:03d}"
            session.add(Encounter(
                encounter_id=enc_id, patient_id=pid, practitioner_id=DOCTOR, start_time=start, end_time=end,
                mode="video", status="completed", symptoms_text=visit[0], vitals_summary=visit[1], urgency="routine",
                allergies_json=[a.get("allergen") for a in (profiles[pid].chart_json or {}).get("allergies", [])],
                current_meds_json=[],
            ))
            await session.flush()
            session.add(ClinicalNote(
                encounter_id=enc_id, practitioner_id=DOCTOR, subjective=visit[2], objective=f"{visit[1]}. {visit[3]}",
                assessment=visit[4], plan_json=visit[5], status="clinician_approved",
                clinician_signature=f"NMC-SIG-SHA256:demo{n:04d}", signed_at=end,
            ))
            session.add(ConsultationNotepad(
                encounter_id=enc_id, practitioner_id=DOCTOR,
                content=f"C/o {visit[0].lower()}. {visit[2]}\nO/E: {visit[3]}\nImp: {visit[4]}\nRx: {visit[5]['medicine']}\nAdv: {visit[5]['advice']}",
                coded_terms_json=[],
            ))
            session.add(appointment(pid, start, status="completed", agenda=visit[0], enc_id=enc_id))
            session.add(AuditEvent(event_id=f"aud_demo_{n:03d}", actor_id=DOCTOR, action="CARE_PLAN_SIGNED_AND_ISSUED",
                                   resource_id=enc_id, outcome="SUCCESS", purpose=visit[4], timestamp=end))

    # --- Today: the four open consultations, plus a couple already done ------------------------
    open_encs = {e.patient_id: e for e in (await session.execute(
        select(Encounter).where(Encounter.status.in_(["queued", "in_progress"]),
                                Encounter.patient_id.in_(SEEDED_PATIENTS)))).scalars()}
    first = (now + timedelta(minutes=10)).astimezone(IST)
    first = first.replace(minute=(first.minute // 15) * 15, second=0, microsecond=0)
    for i, pid in enumerate(SEEDED_PATIENTS):
        enc = open_encs.get(pid)
        start = (first + timedelta(minutes=40 * i)).astimezone(timezone.utc)
        session.add(appointment(pid, start, status="scheduled", agenda=(enc.symptoms_text if enc else "Follow-up"),
                                enc_id=enc.encounter_id if enc else None))
    for i, pid in enumerate(patients[4:6]):
        start = now - timedelta(hours=3 - i, minutes=10)
        if start.astimezone(IST).date() != today.date():
            continue
        visit = VISITS[(i + 4) % len(VISITS)]
        enc_id = f"enc_demo_t{i}"
        session.add(Encounter(encounter_id=enc_id, patient_id=pid, practitioner_id=DOCTOR, start_time=start,
                              end_time=start + timedelta(minutes=18), mode="video", status="completed",
                              symptoms_text=visit[0], vitals_summary=visit[1], urgency="routine"))
        await session.flush()
        session.add(ClinicalNote(encounter_id=enc_id, practitioner_id=DOCTOR, subjective=visit[2], objective=visit[3],
                                 assessment=visit[4], plan_json=visit[5], status="clinician_approved",
                                 clinician_signature="NMC-SIG-SHA256:demotoday", signed_at=start + timedelta(minutes=18)))
        session.add(appointment(pid, start, status="completed", agenda=visit[0], enc_id=enc_id))

    # --- Next 10 days ------------------------------------------------------------------------------
    for ahead in range(1, 11):
        day = today + timedelta(days=ahead)
        if day.weekday() == 6:
            continue
        for slot in range(rnd.randint(1, 3)):
            pid = rnd.choice(patients)
            start = _at(day, 9 + slot * 2 + (1 if slot else 0), rnd.choice([0, 30]))
            mode = "In-Person Warm Clinic" if rnd.random() < 0.25 else "Telehealth Video"
            session.add(appointment(pid, start, status="scheduled", agenda=rnd.choice(UPCOMING_AGENDAS), mode=mode))

    # --- Notifications (one urgent alert shows as a pop-up on the home screen) ------------------
    def note(i, kind, severity, title, body, link, minutes_ago, read=False):
        at = now - timedelta(minutes=minutes_ago)
        session.add(Notification(notification_id=f"ntf_demo_{i}", practitioner_id=DOCTOR, kind=kind, severity=severity,
                                 title=title, body=body, link_json=link, created_at=at, read_at=at if read else None))

    kamla = profiles.get("pat_kamla_devi")
    if kamla:
        note(1, "alert", "critical", f"{kamla.full_name.split(',')[0]} reported feeling worse",
             "Recovery check-in from the patient app: fever back since last night. Review or call the patient.",
             {"page": "patient", "patient_id": "pat_kamla_devi"}, 25)
        session.add(AuditEvent(event_id="aud_demo_alert1", actor_id="pat_kamla_devi", action="RECOVERY_CHECKIN",
                               resource_id="pat_kamla_devi", outcome="ALERT", purpose="Patient reported feeling worse",
                               timestamp=now - timedelta(minutes=25)))
    note(2, "appointment", "info", "New consultation request from Rajesh Kumar",
         "Symptoms submitted from the patient app.", {"page": "patient", "patient_id": "pat_rajesh_kumar"}, 50)
    note(3, "consent", "info", "Ramesh Gowda approved record access", "Ultrasound Pelvis & Abdomen · 1 hour",
         {"page": "patient", "patient_id": "usr_ramesh_gowda", "tab": "records"}, 180, read=True)
    note(4, "appointment", "info", "Appointment confirmed by Lakshmi Narayan", "Tomorrow's follow-up was confirmed.",
         {"page": "patient", "patient_id": "demo_pat_lakshmi", "tab": "visits"}, 300, read=True)
    # --- ASHA worker: requests waiting for her, and a week of BP readings she took for Ramesh -----
    await _ensure_asha(session)
    tomorrow = (today + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    session.add(CareTask(task_id="task_demo_1", patient_id="usr_ramesh_gowda", practitioner_id=DOCTOR, worker_id=ASHA_ID,
                         kinds_json=["blood_pressure"], note="Two readings, 1 minute apart, before Thursday's video visit.",
                         due_at=tomorrow, created_at=now - timedelta(hours=5)))
    if "pat_kamla_devi" in profiles:
        session.add(CareTask(task_id="task_demo_2", patient_id="pat_kamla_devi", practitioner_id=DOCTOR, worker_id=ASHA_ID,
                             kinds_json=["blood_pressure", "blood_sugar", "temperature"], note="Fever follow-up; diabetic.",
                             due_at=tomorrow + timedelta(days=1), created_at=now - timedelta(hours=3)))
    session.add(WorkerConsent(consent_id="wc_demo_1", patient_id="usr_ramesh_gowda", worker_id=ASHA_ID, method="thumb",
                              granted_at=now - timedelta(days=9), expires_at=now + timedelta(days=81)))
    for i, (sys_, dia) in enumerate([(152, 96), (148, 94), (146, 92), (144, 90)]):
        at = now - timedelta(days=8 - 2 * i, hours=3)
        session.add(VitalReading(reading_id=f"vr_demo_{i}", patient_id="usr_ramesh_gowda", kind="blood_pressure",
                                 value=sys_, value2=dia, unit="mmHg", method="asha_device", details_json={"readings_averaged": 2},
                                 recorded_by=ASHA_ID, recorded_by_role="asha", recorded_by_name="Lakshmamma K", created_at=at))

    # --- A few chat conversations ----------------------------------------------------------------
    chats = [
        ("usr_ramesh_gowda", [
            ("patient", "kn", "ಡಾಕ್ಟರ್, ಔಷಧಿ ಊಟದ ಮೊದಲು ತೆಗೆದುಕೊಳ್ಳಬೇಕೇ ಅಥವಾ ನಂತರವೇ?", 300, True),
            ("doctor", "en", "After food, Ramesh. Tamsulosin at bedtime after dinner. Keep drinking 3 litres of water.", 290, True),
            ("patient", "kn", "ಸರಿ ಡಾಕ್ಟರ್, ಧನ್ಯವಾದಗಳು. ನೋವು ಸ್ವಲ್ಪ ಕಡಿಮೆ ಆಗಿದೆ.", 40, False),
        ]),
        ("demo_pat_lakshmi", [
            ("doctor", "en", "Lakshmi, please send your BP readings from this week before tomorrow's visit.", 600, True),
            ("patient", "en", "Morning 138/86, evening 142/88. Knee pain is better with the gel.", 120, False),
        ]),
    ]
    k = 0
    for pid, rows in chats:
        if pid not in profiles:
            continue
        last_enc = (await session.execute(select(Encounter.encounter_id).where(
            Encounter.patient_id == pid, Encounter.status == "completed").order_by(Encounter.end_time.desc()))).scalars().first()
        for sender, lang, body, minutes_ago, read in rows:
            k += 1
            at = now - timedelta(minutes=minutes_ago)
            session.add(ChatMessage(message_id=f"chat_demo_{k:03d}", patient_id=pid, practitioner_id=DOCTOR,
                                    sender_role=sender, body=body, lang=lang, encounter_id=last_enc,
                                    created_at=at, read_at=at + timedelta(minutes=5) if read else None))
    await session.flush()


async def ensure_demo_schedule(force: bool = False) -> None:
    async with AsyncSessionLocal() as session:
        if not force and await _is_current(session):
            return
        await build(session)
        await session.commit()
        print("Demo schedule (re)built for the doctor portal.")


if __name__ == "__main__":
    asyncio.run(ensure_demo_schedule(force="--rebuild" in sys.argv))
