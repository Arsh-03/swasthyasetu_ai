"""
Demo OPD doctors (at least one per department) and Ramesh's starting care team.

Runs at startup after the demo schedule. It only adds what is missing and never changes real data:
  - gives every doctor without one a department (from their specialty), and old appointments the doctor's department
  - adds the demo doctors below (login: their phone number or email, password `password123`)
  - Ramesh sees three doctors: General Medicine (diabetes), Urology (kidney stone, also prescribed his stone
    medicines) and Cardiology (blood pressure). His upcoming visits with the last two are moved forward
    whenever they are in the past, so a demo always has upcoming appointments.

    python -m app.care_network      run it now
"""
import asyncio
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select

from app.care_catalog import department_for_specialty
from app.database import AsyncSessionLocal
from app.models.models import (
    Appointment, AuditEvent, CareTeamMember, ClinicalNote, Encounter, PatientProfile, Practitioner,
    PractitionerSettings, User,
)
from app.routers.doctor import DEFAULT_PREFS, WEEKDAYS

IST = timezone(timedelta(hours=5, minutes=30))
RAMESH = "usr_ramesh_gowda"
HIMS = "Hassan Institute of Medical Sciences · OPD Block"

MORNING = [{"start": "09:00", "end": "13:00"}]
FULL_DAY = [{"start": "09:00", "end": "13:00"}, {"start": "14:00", "end": "17:00"}]


def _week(days, slots=FULL_DAY, saturday=MORNING):
    """Weekly hours: `days` like 'mon tue wed' get `slots`; Saturday half-day unless excluded."""
    weekly = {d: [] for d in WEEKDAYS}
    for d in days.split():
        weekly[d] = list(slots)
    if saturday and "sat" not in days.split():
        weekly["sat"] = list(saturday)
    return {"weekly": weekly, "leaves": []}


# id, email, phone, display name, registration, specialty, department, facility, years, languages, hours
DOCTORS = [
    ("usr_dr_vikram_hegde", "dr.vikram.hegde@hims.karnataka.gov.in", "9900100001", "Dr. Vikram Hegde (MD, DM Cardiology)",
     "NMC-KA-612034", "Cardiology", "cardiology", HIMS, 14, ["en", "kn", "hi"], _week("mon tue wed thu fri")),
    ("usr_dr_shalini_murthy", "dr.shalini.murthy@jayadeva.org", "9900100002", "Dr. Shalini Murthy (MD, DM Cardiology)",
     "NMC-KA-598812", "Cardiology", "cardiology", "Sri Jayadeva Institute (Mysuru) · Tele-OPD", 9, ["en", "kn"],
     _week("tue thu", MORNING, saturday=MORNING)),
    ("usr_dr_farah_khan", "dr.farah.khan@hims.karnataka.gov.in", "9900100003", "Dr. Farah Khan (MD Dermatology)",
     "NMC-KA-633190", "Dermatology, Venereology & Leprosy", "dermatology", HIMS, 8, ["en", "hi", "kn"],
     _week("mon wed fri")),
    ("usr_dr_suresh_naik", "dr.suresh.naik@hims.karnataka.gov.in", "9900100004", "Dr. Suresh Naik (MS Orthopaedics)",
     "NMC-KA-574410", "Orthopaedics", "orthopaedics", HIMS, 17, ["en", "kn"], _week("mon tue wed thu fri")),
    ("usr_dr_meera_kulkarni", "dr.meera.kulkarni@hims.karnataka.gov.in", "9900100005", "Dr. Meera Kulkarni (MS ENT)",
     "NMC-KA-645521", "Otorhinolaryngology (ENT)", "ent", HIMS, 11, ["en", "kn", "hi"], _week("mon wed thu")),
    ("usr_dr_arjun_shetty", "dr.arjun.shetty@hims.karnataka.gov.in", "9900100006", "Dr. Arjun Shetty (MS Ophthalmology)",
     "NMC-KA-602278", "Ophthalmology", "ophthalmology", "District Eye Hospital, Hassan", 12, ["en", "kn"],
     _week("tue wed fri")),
    ("usr_dr_kavya_reddy", "dr.kavya.reddy@hims.karnataka.gov.in", "9900100007", "Dr. Kavya Reddy (MS OBG)",
     "NMC-KA-651904", "Obstetrics & Gynaecology", "obgyn", "Hassan Women & Children Hospital", 10, ["en", "kn", "hi"],
     _week("mon tue wed thu fri")),
    ("usr_dr_nandini_iyer", "dr.nandini.iyer@hims.karnataka.gov.in", "9900100008", "Dr. Nandini Iyer (MD Paediatrics)",
     "NMC-KA-588340", "Paediatrics", "paediatrics", "Hassan Women & Children Hospital", 13, ["en", "kn", "hi"],
     _week("mon tue wed thu fri")),
    ("usr_dr_prakash_joshi", "dr.prakash.joshi@hims.karnataka.gov.in", "9900100009", "Dr. Prakash Joshi (MD, DM Endocrinology)",
     "NMC-KA-579915", "Endocrinology (Diabetes & Thyroid)", "endocrinology", HIMS, 15, ["en", "kn", "hi"],
     _week("mon thu", FULL_DAY)),
    ("usr_dr_rehana_begum", "dr.rehana.begum@hims.karnataka.gov.in", "9900100010", "Dr. Rehana Begum (MD Pulmonary Medicine)",
     "NMC-KA-624467", "Pulmonary Medicine (Chest)", "pulmonology", "District TB & Chest Centre, Hassan", 9, ["en", "kn", "hi"],
     _week("tue wed fri")),
    ("usr_dr_mohan_gowda", "dr.mohan.gowda@hims.karnataka.gov.in", "9900100011", "Dr. Mohan Gowda (MD, DM Gastroenterology)",
     "NMC-KA-566102", "Gastroenterology", "gastroenterology", HIMS, 18, ["en", "kn"], _week("mon wed fri")),
    ("usr_dr_sanjay_kamath", "dr.sanjay.kamath@nimhans.ac.in", "9900100012", "Dr. Sanjay Kamath (MD, DM Neurology)",
     "NMC-KA-591736", "Neurology", "neurology", "NIMHANS Tele-OPD (Bengaluru)", 16, ["en", "kn", "hi"],
     _week("tue thu", FULL_DAY)),
    ("usr_dr_leela_menon", "dr.leela.menon@nimhans.ac.in", "9900100013", "Dr. Leela Menon (MD Psychiatry)",
     "NMC-KA-608853", "Psychiatry", "psychiatry", "NIMHANS Tele-OPD (Bengaluru)", 12, ["en", "kn", "hi"],
     _week("mon wed fri")),
    ("usr_dr_cr_patil", "dr.cr.patil@hims.karnataka.gov.in", "9900100014", "Dr. C. R. Patil (MS, MCh Urology)",
     "NMC-KA-547729", "Urology", "urology", HIMS, 21, ["en", "kn"], _week("mon tue thu fri")),
    ("usr_dr_rahul_bhat", "dr.rahul.bhat@hassandental.in", "9900100015", "Dr. Rahul Bhat (BDS, MDS)",
     "DCI-KA-A-18342", "Dental Surgery", "dental", "Government Dental Clinic, Hassan", 7, ["en", "kn"],
     _week("mon tue wed thu fri")),
]

# Existing seeded doctors: departments, experience and languages for the directory
EXISTING = {
    "usr_dr_ananya": ("general_medicine", 11, ["en", "kn", "hi"]),
    "usr_dr_ks_rao": ("general_medicine", 24, ["kn", "en"]),
}

# Ramesh's care team: doctor, health issue id, what they look after
RAMESH_TEAM = [
    ("usr_dr_ananya", "general", "Diabetes & general check-ups"),
    ("usr_dr_cr_patil", "urine_kidney", "Kidney stone (right side)"),
    ("usr_dr_vikram_hegde", "heart_bp", "Blood pressure"),
]

# Upcoming visits kept in the future: id, doctor, days ahead (at least), IST time, mode, agenda
RAMESH_UPCOMING = [
    ("apt_care_uro_next", "usr_dr_cr_patil", 2, (10, 0), "Telehealth Video",
     "Kidney stone follow-up: review repeat ultrasound and pain"),
    ("apt_care_cardio_next", "usr_dr_vikram_hegde", 4, (11, 20), "In-Person OPD",
     "BP review and ECG at the Cardiology OPD"),
]


def _labels(start: datetime) -> tuple[str, str]:
    local = start.astimezone(IST)
    return local.strftime("%Y-%m-%d"), local.strftime("%I:%M %p").lstrip("0")


def _next_working_day(availability, earliest: datetime, hhmm) -> datetime:
    """First day from `earliest` (IST date) on which the doctor works at hh:mm."""
    day = earliest.astimezone(IST).date()
    begin = f"{hhmm[0]:02d}:{hhmm[1]:02d}"
    for _ in range(14):
        slots = availability["weekly"].get(WEEKDAYS[day.weekday()], [])
        if any(s["start"] <= begin < s["end"] for s in slots):
            break
        day += timedelta(days=1)
    return datetime.combine(day, time(*hhmm), tzinfo=IST).astimezone(timezone.utc)


async def _ensure_doctors(session) -> None:
    for (uid, email, phone, name, reg, specialty, dept, facility, years, langs, hours) in DOCTORS:
        doc = await session.get(Practitioner, uid)
        if not doc:
            if not await session.get(User, uid):
                session.add(User(user_id=uid, role="practitioner", login_identifier=email, phone_number=phone,
                                 password_hash="password123"))
                await session.flush()
            session.add(Practitioner(practitioner_id=uid, display_name=name, registration_number=reg, specialty=specialty,
                                     facility=facility, credential_status="verified", department=dept,
                                     experience_years=years, languages_json=langs))
            await session.flush()
        if not await session.get(PractitionerSettings, uid):
            session.add(PractitionerSettings(practitioner_id=uid, prefs_json=dict(DEFAULT_PREFS), availability_json=hours))
            await session.flush()
    for uid, (dept, years, langs) in EXISTING.items():
        doc = await session.get(Practitioner, uid)
        if doc:
            doc.department = doc.department or dept
            doc.experience_years = doc.experience_years or years
            doc.languages_json = doc.languages_json or langs
        if not await session.get(PractitionerSettings, uid):
            session.add(PractitionerSettings(practitioner_id=uid, prefs_json=dict(DEFAULT_PREFS),
                                             availability_json=_week("mon tue wed thu fri")))
            await session.flush()
    await session.flush()
    # Everyone else (e.g. doctors who signed up before departments existed)
    for doc in (await session.execute(select(Practitioner).where(Practitioner.department.is_(None)))).scalars():
        doc.department = department_for_specialty(doc.specialty)
    await session.flush()
    depts = {d.practitioner_id: d.department for d in (await session.execute(select(Practitioner))).scalars()}
    for apt in (await session.execute(select(Appointment).where(
            Appointment.department.is_(None), Appointment.practitioner_id.is_not(None)))).scalars():
        apt.department = depts.get(apt.practitioner_id)
    await session.flush()


async def _ensure_ramesh(session) -> None:
    ramesh = await session.get(PatientProfile, RAMESH)
    if not ramesh:
        return
    docs = {d.practitioner_id: d for d in (await session.execute(select(Practitioner))).scalars()}
    members = {m.practitioner_id: m for m in (await session.execute(
        select(CareTeamMember).where(CareTeamMember.patient_id == RAMESH))).scalars()}
    for pid, issue, reason in RAMESH_TEAM:
        if pid in docs and pid not in members:
            session.add(CareTeamMember(patient_id=RAMESH, practitioner_id=pid, department=docs[pid].department,
                                       issue_id=issue, reason=reason, added_by="system"))

    # A past urology visit (the one that started his stone medicines), signed by Dr. Patil
    patil = docs.get("usr_dr_cr_patil")
    if patil and not await session.get(Encounter, "enc_care_uro_1"):
        start = datetime(2026, 9, 14, 10, 30, tzinfo=IST).astimezone(timezone.utc)
        end = start + timedelta(minutes=22)
        session.add(Encounter(encounter_id="enc_care_uro_1", patient_id=RAMESH, practitioner_id=patil.practitioner_id,
                              start_time=start, end_time=end, mode="in_person", status="completed",
                              symptoms_text="Right flank pain coming in waves for 3 days",
                              vitals_summary="BP 134/86 • Temp 98.8°F", urgency="routine"))
        await session.flush()
        session.add(ClinicalNote(
            encounter_id="enc_care_uro_1", practitioner_id=patil.practitioner_id,
            subjective="Colicky right flank pain radiating to groin for 3 days. No fever. Burning urination once.",
            objective="Right renal angle tenderness. USG: 4.2 mm right lower pole calculus, Grade I hydronephrosis.",
            assessment="Right nephrolithiasis (4.2 mm), suitable for medical expulsive therapy",
            plan_json={"medicine": "Tamsulosin 0.4 mg at bedtime; Potassium magnesium citrate 10 mL three times daily; "
                                   "Drotaverine 80 mg if pain",
                       "advice": "Drink 3 litres of water a day. Avoid painkillers like diclofenac. "
                                 "Come at once if fever, vomiting or no urine.",
                       "follow_up": "Repeat ultrasound in 4–6 weeks"},
            status="clinician_approved", clinician_signature="NMC-SIG-SHA256:care-uro-1", signed_at=end))
        date_label, time_label = _labels(start)
        session.add(Appointment(
            appointment_id="apt_care_uro_past", patient_id=RAMESH, practitioner_id=patil.practitioner_id,
            doctor_name=patil.display_name, specialty=patil.specialty, facility=patil.facility, department="urology",
            date_label=date_label, time_label=time_label, mode="In-Person OPD", agenda="Right flank pain",
            status="Confirmed by Patient", instructions_json=[], scheduled_at=start, duration_minutes=20,
            visit_status="completed", encounter_id="enc_care_uro_1", booked_by="patient"))
        session.add(AuditEvent(actor_id=patil.practitioner_id, action="CARE_PLAN_SIGNED_AND_ISSUED",
                               resource_id="enc_care_uro_1", outcome="SUCCESS", purpose="Right nephrolithiasis",
                               timestamp=end))

    # Upcoming visits with the specialists, moved forward when they have passed
    now = datetime.now(timezone.utc)
    for apt_id, pid, days_ahead, hhmm, mode, agenda in RAMESH_UPCOMING:
        doc = docs.get(pid)
        if not doc:
            continue
        apt = await session.get(Appointment, apt_id)
        if apt and apt.scheduled_at and (apt.scheduled_at if apt.scheduled_at.tzinfo else
                                         apt.scheduled_at.replace(tzinfo=timezone.utc)) > now:
            continue  # still upcoming (or cancelled by the patient for a future date): leave it
        settings = await session.get(PractitionerSettings, pid)
        hours = (settings.availability_json if settings else None) or _week("mon tue wed thu fri")
        start = _next_working_day(hours, now + timedelta(days=days_ahead), hhmm)
        date_label, time_label = _labels(start)
        if not apt:
            apt = Appointment(appointment_id=apt_id, patient_id=RAMESH, practitioner_id=pid, instructions_json=[],
                              booked_by="patient")
            session.add(apt)
        apt.doctor_name, apt.specialty, apt.facility, apt.department = (
            doc.display_name, doc.specialty, doc.facility, doc.department)
        apt.date_label, apt.time_label = date_label, time_label
        apt.relative_label = f"Booked for {date_label}"
        apt.mode, apt.agenda, apt.status = mode, agenda, "Confirmed by Patient"
        apt.scheduled_at, apt.duration_minutes, apt.visit_status = start, 20, "scheduled"
        apt.is_rescheduled = False
    await session.flush()


async def ensure_care_network() -> None:
    async with AsyncSessionLocal() as session:
        await _ensure_doctors(session)
        await _ensure_ramesh(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(ensure_care_network())
