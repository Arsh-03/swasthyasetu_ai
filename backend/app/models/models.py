import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, ForeignKey, DateTime, JSON, Boolean, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.database import Base

# JSONB on Postgres (indexable), plain JSON on the SQLite fallback.
JSONType = JSON().with_variant(JSONB(), "postgresql")

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _meeting_code() -> str:
    from app.services.meetings import new_code
    return new_code()

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    role = Column(String(30), nullable=False)  # 'patient', 'practitioner', 'representative', 'admin'
    login_identifier = Column(String(100), unique=True, nullable=False)
    phone_number = Column(String(20), nullable=True, index=True)
    password_hash = Column(String(255), default="mock_hashed_pass")
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False)
    practitioner_profile = relationship("Practitioner", back_populates="user", uselist=False)


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    patient_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    preferred_language = Column(String(10), default="kn")  # 'kn', 'hi', 'en'
    full_name = Column(String(150), nullable=False)
    abha_address = Column(String(100), unique=True, nullable=False)
    demographics_json = Column(JSON, default=dict)  # {"age": 54, "sex": "male", "district": "Hassan, Karnataka"}
    avatar_url = Column(Text, nullable=True)
    # Full clinical chart: conditions, surgeries, allergies, family/social history,
    # immunizations, last visit note and prescriptions (doctor portal chart view).
    chart_json = Column(JSONType, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="patient_profile")
    encounters = relationship("Encounter", back_populates="patient")
    records = relationship("RecordMetadata", back_populates="patient")
    consents = relationship("Consent", back_populates="patient")


class Practitioner(Base):
    __tablename__ = "practitioners"

    practitioner_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    display_name = Column(String(150), nullable=False)
    registration_number = Column(String(50), nullable=False)  # NMC Medical Registration Number
    specialty = Column(String(100), nullable=False)
    facility = Column(String(200), nullable=True)
    credential_status = Column(String(20), default="verified")
    created_at = Column(DateTime(timezone=True), default=utc_now)
    # OPD department id from app/care_catalog.py ('cardiology', 'dermatology', ...)
    department = Column(String(40), nullable=True, index=True)
    experience_years = Column(Integer, nullable=True)
    languages_json = Column(JSONType, nullable=True)  # ["en", "kn", "hi"]

    user = relationship("User", back_populates="practitioner_profile")
    encounters = relationship("Encounter", back_populates="practitioner")
    consents = relationship("Consent", back_populates="practitioner")
    settings = relationship("PractitionerSettings", back_populates="practitioner", uselist=False)


class Representative(Base):
    __tablename__ = "representatives"

    representative_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False)
    representative_user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    relationship_type = Column(String(50), nullable=False)  # 'daughter-in-law', 'spouse', 'guardian'
    full_name = Column(String(150), nullable=False)
    authority_status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Encounter(Base):
    __tablename__ = "encounters"

    encounter_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=True)
    start_time = Column(DateTime(timezone=True), default=utc_now)
    end_time = Column(DateTime(timezone=True), nullable=True)
    mode = Column(String(20), default="video")  # 'video', 'audio', 'text_async'
    status = Column(String(20), default="queued")  # 'queued', 'in_progress', 'completed'
    symptoms_text = Column(Text, nullable=True)
    vitals_summary = Column(String(200), nullable=True)  # "BP 130/85 • 101.4°F • SpO2 98%"
    urgency = Column(String(20), default="routine")  # 'high', 'follow_up', 'routine'
    allergies_json = Column(JSON, default=list)
    current_meds_json = Column(JSON, default=list)

    patient = relationship("PatientProfile", back_populates="encounters")
    practitioner = relationship("Practitioner", back_populates="encounters")
    consents = relationship("Consent", back_populates="encounter")
    clinical_note = relationship("ClinicalNote", back_populates="encounter", uselist=False)


class RecordMetadata(Base):
    __tablename__ = "record_metadata"

    record_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False)
    record_type = Column(String(50), nullable=False)  # 'ultrasound', 'blood_panel', 'ecg'
    title = Column(String(200), nullable=False)
    date_str = Column(String(50), default="2026-05-24")
    file_mime_type = Column(String(50), default="application/pdf")
    file_size_bytes = Column(Integer, default=2450000)
    secure_storage_reference = Column(String(500), nullable=False)
    encryption_key_id = Column(String(100), default="kms-carebridge-aes256-gcm")
    summary_findings = Column(Text, nullable=True)
    raw_preview_text = Column(Text, nullable=True)
    facility = Column(String(200), nullable=True)
    category = Column(String(30), default="diagnostic")  # 'diagnostic', 'lab'
    type_label = Column(String(100), nullable=True)  # "Diagnostic Ultrasound Imaging"
    imaging_json = Column(JSONType, nullable=True)
    lab_results_json = Column(JSONType, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    patient = relationship("PatientProfile", back_populates="records")
    consents = relationship("Consent", back_populates="record")


class Consent(Base):
    __tablename__ = "consents"

    consent_id = Column(String(36), primary_key=True, default=generate_uuid)
    encounter_id = Column(String(36), ForeignKey("encounters.encounter_id"), nullable=False)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=False)
    record_id = Column(String(36), ForeignKey("record_metadata.record_id"), nullable=False)
    purpose = Column(String(255), nullable=False)
    scope = Column(String(50), default="read_only")  # 'read_only', 'download'
    status = Column(String(20), default="requested")  # 'requested', 'approved', 'declined', 'revoked', 'expired'
    expires_at = Column(DateTime(timezone=True), nullable=True)
    grant_token_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    encounter = relationship("Encounter", back_populates="consents")
    patient = relationship("PatientProfile", back_populates="consents")
    practitioner = relationship("Practitioner", back_populates="consents")
    record = relationship("RecordMetadata", back_populates="consents")


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    note_id = Column(String(36), primary_key=True, default=generate_uuid)
    encounter_id = Column(String(36), ForeignKey("encounters.encounter_id"), nullable=False, unique=True)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=False)
    subjective = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    assessment = Column(Text, nullable=True)
    plan_json = Column(JSON, default=dict)  # {"medications": [...], "dietary_advice": "...", "red_flags": "..."}
    status = Column(String(30), default="draft")  # 'draft', 'clinician_approved'
    clinician_signature = Column(String(255), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)

    encounter = relationship("Encounter", back_populates="clinical_note")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id = Column(String(36), primary_key=True, default=generate_uuid)
    actor_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)  # 'CONSENT_REQUEST', 'CONSENT_DECISION', 'STREAM_ACCESS', 'REVOKE'
    resource_id = Column(String(100), nullable=False)
    outcome = Column(String(20), nullable=False)  # 'SUCCESS', 'DENIED', 'EXPIRED', 'REVOKED'
    purpose = Column(String(255), nullable=True)
    ip_hash = Column(String(64), default="sha256:192.168.1.104")
    timestamp = Column(DateTime(timezone=True), default=utc_now)


class ConsultationNotepad(Base):
    """Doctor's live IntelliSense notepad draft for an encounter (saved explicitly, never per keystroke)."""
    __tablename__ = "consultation_notepads"

    encounter_id = Column(String(36), ForeignKey("encounters.encounter_id"), primary_key=True)
    practitioner_id = Column(String(36), nullable=False)
    content = Column(Text, default="")
    coded_terms_json = Column(JSONType, default=list)  # [{start, end, original, name, codes, category, severity, confidence}]
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class PartnerClient(Base):
    """An outside organisation using CareBridge services through the partner API (consent layer, SETU-Shield...)."""
    __tablename__ = "partner_clients"

    client_id = Column(String(36), primary_key=True, default=lambda: f"pcl_{uuid.uuid4().hex[:12]}")
    name = Column(String(150), nullable=False)
    org_type = Column(String(50), default="clinic")       # clinic, hospital, lab, pharmacy, insurer, research
    contact_email = Column(String(150), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(64), nullable=True)
    status = Column(String(20), default="active")         # active, suspended
    created_at = Column(DateTime(timezone=True), default=utc_now)


class PartnerKey(Base):
    """An API key: only its SHA-256 is stored. Scopes limit what it can do; rate_per_min limits how often."""
    __tablename__ = "partner_keys"

    key_id = Column(String(36), primary_key=True, default=lambda: f"pk_{uuid.uuid4().hex[:12]}")
    client_id = Column(String(36), ForeignKey("partner_clients.client_id"), nullable=False, index=True)
    prefix = Column(String(16), nullable=False, index=True)
    key_hash = Column(String(64), nullable=False)
    scopes_json = Column(JSONType, default=list)
    rate_per_min = Column(Integer, default=60)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class PartnerUsage(Base):
    """One row per partner API call (no request or response bodies)."""
    __tablename__ = "partner_usage"

    usage_id = Column(String(36), primary_key=True, default=generate_uuid)
    client_id = Column(String(36), nullable=False, index=True)
    key_id = Column(String(36), nullable=False)
    route = Column(String(120), nullable=False)
    status_code = Column(Integer, default=200)
    duration_ms = Column(Integer, default=0)
    at = Column(DateTime(timezone=True), default=utc_now, index=True)


class PartnerConsent(Base):
    """A partner's purpose-bound request to use a patient's data. The patient decides in the CareBridge app."""
    __tablename__ = "partner_consents"

    consent_id = Column(String(36), primary_key=True, default=lambda: f"pc_{uuid.uuid4().hex[:12]}")
    client_id = Column(String(36), ForeignKey("partner_clients.client_id"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    purpose = Column(String(255), nullable=False)
    data_types_json = Column(JSONType, default=list)      # e.g. ["prescriptions", "lab_reports", "vitals"]
    valid_hours = Column(Integer, default=24)
    status = Column(String(20), default="requested")      # requested, approved, declined, revoked, expired
    external_ref = Column(String(100), nullable=True)     # the partner's own reference
    grant_token_hash = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ConsultationRecord(Base):
    """The consultation note as structured data (note_format.py), saved when the doctor signs.
    Visit summaries, the patient's medicine plan and records screens all read from this; nothing is typed twice."""
    __tablename__ = "consultation_records"

    encounter_id = Column(String(36), ForeignKey("encounters.encounter_id"), primary_key=True)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    practitioner_id = Column(String(36), nullable=True)
    format = Column(String(40), default="carebridge-note-v1")
    structured_json = Column(JSONType, default=dict)
    note_text = Column(Text, default="")
    signed_at = Column(DateTime(timezone=True), default=utc_now, index=True)


class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=True, index=True)
    date_label = Column(String(100), nullable=False)  # "Tomorrow, 23 Oct 2026"
    time_label = Column(String(50), nullable=False)  # "10:30 AM IST"
    relative_label = Column(String(150), nullable=True)
    mode = Column(String(50), default="Telehealth Video")
    doctor_name = Column(String(150), nullable=True)
    specialty = Column(String(150), nullable=True)
    facility = Column(String(200), nullable=True)
    agenda = Column(Text, nullable=True)
    status = Column(String(50), default="Confirmed by Patient")
    instructions_json = Column(JSONType, default=list)
    is_rescheduled = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    # Real start time for calendars and "next appointment" (the *_label columns are display text).
    scheduled_at = Column(DateTime(timezone=True), nullable=True, index=True)
    duration_minutes = Column(Integer, default=20)
    # The consultation (call room, notes) this appointment opens; set when the doctor opens it.
    encounter_id = Column(String(36), nullable=True)
    visit_status = Column(String(20), default="scheduled")  # 'scheduled', 'completed', 'cancelled', 'no_show'
    # Google Meet style meeting code ("rgw-pqtk-zma"): the join link is <patient app>/?join=<code>
    meeting_code = Column(String(20), nullable=True, index=True, default=lambda: _meeting_code())
    department = Column(String(40), nullable=True)  # the doctor's OPD department at booking time
    booked_by = Column(String(20), nullable=True)  # 'patient' | 'doctor'


class CareTeamMember(Base):
    """A doctor the patient sees for one of their health issues (their "My Doctors" list).
    Added when the patient books with a new doctor; a patient can have several doctors at once."""
    __tablename__ = "care_team_members"
    __table_args__ = (UniqueConstraint("patient_id", "practitioner_id"),)

    member_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=False, index=True)
    department = Column(String(40), nullable=True)
    issue_id = Column(String(40), nullable=True)  # health issue id from app/care_catalog.py
    reason = Column(String(200), nullable=True)  # what this doctor looks after, e.g. "Kidney stone"
    status = Column(String(20), default="active")  # 'active', 'removed'
    added_by = Column(String(20), default="patient")  # 'patient', 'doctor', 'system'
    created_at = Column(DateTime(timezone=True), default=utc_now)


class DoseLog(Base):
    """One row per medication dose slot a patient ticks off on a given day."""
    __tablename__ = "dose_logs"
    __table_args__ = (UniqueConstraint("patient_id", "medication_id", "slot", "log_date"),)

    log_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    medication_id = Column(String(50), nullable=False)
    slot = Column(String(20), nullable=False)  # 'morning', 'afternoon', 'night', 'prn'
    log_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    taken = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class RecoveryCheckin(Base):
    __tablename__ = "recovery_checkins"

    checkin_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # 'better', 'same', 'worse'
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Notification(Base):
    """Bell notifications for a doctor; `link` says which page a click opens."""
    __tablename__ = "notifications"

    notification_id = Column(String(36), primary_key=True, default=generate_uuid)
    practitioner_id = Column(String(36), nullable=False, index=True)
    kind = Column(String(20), nullable=False)  # 'appointment', 'alert', 'consent', 'call', 'system'
    severity = Column(String(20), default="info")  # 'info', 'warning', 'critical'
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    link_json = Column(JSONType, default=dict)  # {"page": "patient", "patient_id": ..., "tab": ...}
    audit_event_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)


class PractitionerSettings(Base):
    """Doctor preferences and working hours (profile fields live on Practitioner)."""
    __tablename__ = "practitioner_settings"

    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), primary_key=True)
    prefs_json = Column(JSONType, default=dict)  # {"language", "date_format", "time_format", "timezone"}
    # {"weekly": {"mon": [{"start": "09:00", "end": "13:00"}], ...}, "leaves": [{"id", "start", "end", "reason"}]}
    availability_json = Column(JSONType, default=dict)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    practitioner = relationship("Practitioner", back_populates="settings")


class ChatMessage(Base):
    """One chat message between a patient and their doctor. Part of the clinical record (never edited or deleted)."""
    __tablename__ = "chat_messages"

    message_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioners.practitioner_id"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)  # 'patient', 'doctor'
    body = Column(Text, nullable=False)
    lang = Column(String(10), default="en")  # language the sender wrote in
    translation = Column(Text, nullable=True)  # into the reader's language, when the translator changed it
    translation_lang = Column(String(10), nullable=True)
    encounter_id = Column(String(36), nullable=True)  # the visit this message belongs to
    urgent = Column(Boolean, default=False)  # emergency words detected (patient messages)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)  # read by the recipient


class VitalReading(Base):
    """A reading the patient took at home (e.g. heart rate from the phone camera). Estimates are labelled as such."""
    __tablename__ = "vital_readings"

    reading_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)  # 'heart_rate'
    value = Column(Integer, nullable=False)
    unit = Column(String(20), default="bpm")
    method = Column(String(30), default="camera_ppg")  # 'camera_ppg' (fingertip on camera), 'manual'
    confidence = Column(String(10), nullable=True)  # 'good', 'fair'
    details_json = Column(JSONType, default=dict)  # {"quality", "irregularity", "seconds", "beats", "torch"}
    encounter_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    # Readings with two numbers (blood pressure: systolic in `value`, diastolic here) or decimals (temperature, weight).
    value2 = Column(Integer, nullable=True)
    value_f = Column(Float, nullable=True)
    # Who measured it: the patient themselves, or an ASHA worker on a home visit.
    recorded_by = Column(String(36), nullable=True)
    recorded_by_role = Column(String(20), default="patient")  # 'patient', 'asha'
    recorded_by_name = Column(String(150), nullable=True)
    task_id = Column(String(36), nullable=True)
    client_id = Column(String(64), nullable=True, index=True)  # set by the ASHA app; makes offline re-sends safe


class HealthWorker(Base):
    """An ASHA (Accredited Social Health Activist) or other community health worker."""
    __tablename__ = "health_workers"

    worker_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    display_name = Column(String(150), nullable=False)
    worker_code = Column(String(50), nullable=False)  # e.g. ASHA-HSN-0142
    area = Column(String(150), nullable=True)  # village / taluk / district she covers
    facility = Column(String(200), nullable=True)  # her Ayushman Arogya Mandir / PHC
    created_at = Column(DateTime(timezone=True), default=utc_now)


class CareTask(Base):
    """A doctor's request for readings, done by an ASHA worker on a home visit (e.g. BP before the next consultation)."""
    __tablename__ = "care_tasks"

    task_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    practitioner_id = Column(String(36), nullable=True)
    worker_id = Column(String(36), nullable=True, index=True)  # assigned ASHA (null = any ASHA)
    kinds_json = Column(JSONType, default=list)  # ["blood_pressure", "blood_sugar", "temperature", "weight"]
    note = Column(Text, nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="open")  # 'open', 'done', 'cancelled'
    created_at = Column(DateTime(timezone=True), default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class WorkerConsent(Base):
    """The patient agreed that this ASHA worker may add readings to their record (asked once, valid for 90 days)."""
    __tablename__ = "worker_consents"

    consent_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    worker_id = Column(String(36), nullable=False, index=True)
    method = Column(String(20), default="tap")  # 'tap' (patient tapped Agree), 'thumb' (thumb impression), 'verbal'
    granted_at = Column(DateTime(timezone=True), default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class VisitSummary(Base):
    """A plain-language summary of a consultation, kept only because the patient asked for it.
    Built from de-identified text: it never names the patient or the doctor."""
    __tablename__ = "visit_summaries"

    summary_id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=False, index=True)
    encounter_id = Column(String(36), nullable=True)
    language = Column(String(10), default="en")
    sections_json = Column(JSONType, default=dict)  # {"told": [...], "advice": [...], "next": [...], "urgent": [...]}
    engine = Column(String(20), default="rules")    # 'live' (your model) or 'rules'
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)


class HiecmConsentRequest(Base):
    """ABDM HIE-CM v3 Consent Request initiated by HIU and approved/denied by Patient."""
    __tablename__ = "hiecm_consent_requests"

    request_id = Column(String(64), primary_key=True)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=True, index=True)
    patient_abha = Column(String(100), nullable=True, index=True)
    status = Column(String(20), default="REQUESTED", index=True)  # REQUESTED, GRANTED, DENIED, EXPIRED, REVOKED
    hiu_id = Column(String(50), default="cowin_hiu_01")
    hip_id = Column(String(50), nullable=True)
    purpose_code = Column(String(50), default="CAREMGT")
    purpose_text = Column(String(255), default="Care Management")
    purpose_ref_uri = Column(String(255), nullable=True)
    requester_name = Column(String(150), nullable=True)
    requester_type = Column(String(50), nullable=True)
    requester_system = Column(String(255), nullable=True)
    hi_types_json = Column(JSONType, default=list)
    care_contexts_json = Column(JSONType, default=list)
    access_mode = Column(String(20), default="VIEW")
    date_range_from = Column(DateTime(timezone=True), nullable=True)
    date_range_to = Column(DateTime(timezone=True), nullable=True)
    data_erase_at = Column(DateTime(timezone=True), nullable=True)
    frequency_json = Column(JSONType, default=dict)
    denial_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    last_updated = Column(DateTime(timezone=True), default=utc_now)


class HiecmConsentArtefact(Base):
    """ABDM HIE-CM v3 Cryptographic Consent Artefact granted by the patient."""
    __tablename__ = "hiecm_consent_artefacts"

    artefact_id = Column(String(64), primary_key=True)
    consent_request_id = Column(String(64), ForeignKey("hiecm_consent_requests.request_id"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patient_profiles.patient_id"), nullable=True, index=True)
    patient_abha = Column(String(100), nullable=False, index=True)
    status = Column(String(20), default="GRANTED", index=True)  # GRANTED, REVOKED, EXPIRED
    hiu_id = Column(String(50), nullable=False)
    hip_id = Column(String(50), nullable=False)
    hip_name = Column(String(150), nullable=True)
    care_contexts_json = Column(JSONType, default=list)
    hi_types_json = Column(JSONType, default=list)
    permission_json = Column(JSONType, default=dict)
    signature = Column(Text, nullable=True)
    signed_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class HiecmDataFlowTransaction(Base):
    """ABDM HIE-CM v3 Data Flow transaction tracking transfer of health information between HIP and HIU."""
    __tablename__ = "hiecm_data_flow_transactions"

    transaction_id = Column(String(64), primary_key=True)
    consent_id = Column(String(64), ForeignKey("hiecm_consent_artefacts.artefact_id"), nullable=False, index=True)
    status = Column(String(20), default="INITIATED", index=True)  # INITIATED, TRANSFERRED, RECEIVED, FAILED
    hiu_id = Column(String(50), nullable=True)
    hip_id = Column(String(50), nullable=True)
    data_push_url = Column(String(500), nullable=True)
    key_material_json = Column(JSONType, nullable=True)
    date_range_json = Column(JSONType, nullable=True)
    status_notification_json = Column(JSONType, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now)

