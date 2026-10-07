import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, ForeignKey, DateTime, JSON, Boolean
)
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

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
    credential_status = Column(String(20), default="verified")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="practitioner_profile")
    encounters = relationship("Encounter", back_populates="practitioner")
    consents = relationship("Consent", back_populates="practitioner")


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
    ip_hash = Column(String(64), default="sha256:192.168.1.104")
    timestamp = Column(DateTime(timezone=True), default=utc_now)
