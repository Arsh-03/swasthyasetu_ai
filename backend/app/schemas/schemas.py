from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class UserOut(BaseModel):
    user_id: str
    role: str
    login_identifier: str
    phone_number: Optional[str] = None
    status: str

class LoginRequest(BaseModel):
    role: str  # 'patient' or 'doctor'
    identifier: str  # ABHA ID (for patient) or Doctor ID (for doctor) or Mobile Number
    password: str

class PatientRegisterRequest(BaseModel):
    full_name: str
    abha_address: str  # e.g., 91-4820-1928-1120@abdm or ramesh.gowda@abdm
    mobile_number: str
    password: str
    preferred_language: str = "kn"
    age: int = 54
    gender: str = "male"
    district: str = "Hassan, Karnataka"

class CreateAbhaRequest(BaseModel):
    full_name: str
    abha_number: str  # 14-digit e.g. 91-8420-1928-1120
    abha_address: str  # e.g. arun.kumar@abdm
    mobile_number: str
    password: str = "password123"
    preferred_language: str = "en"
    age: int = 42
    gender: str = "male"
    district: str = "Bengaluru, Karnataka"
    auth_method: str = "aadhaar_otp"
    aadhaar_last4: Optional[str] = "9821"
    medical_history: Optional[Dict[str, Any]] = None
    initial_record: Optional[Dict[str, Any]] = None

class RecordCreateRequest(BaseModel):
    patient_id: Optional[str] = None
    record_type: str  # 'ultrasound', 'blood_panel', 'ecg', 'prescription', 'discharge_summary', 'other'
    title: str
    date_str: Optional[str] = None
    summary_findings: Optional[str] = None
    raw_preview_text: Optional[str] = None
    file_mime_type: Optional[str] = "application/pdf"
    file_size_bytes: Optional[int] = 1850000

class MedicalHistoryUpdateRequest(BaseModel):
    chronic_conditions: List[str] = []
    current_medications: List[str] = []
    allergies: List[str] = []
    surgeries: List[str] = []
    blood_group: Optional[str] = None
    lifestyle_notes: Optional[str] = None

class DoctorRegisterRequest(BaseModel):
    full_name: str
    registration_number: str  # Unique Doc ID / NMC Registration Number e.g., NMC-KA-581920
    mobile_number: str
    password: str
    specialty: str = "General Medicine"
    qualification: str = "MBBS, MD"

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: str
    user: Dict[str, Any]

class PatientProfileOut(BaseModel):
    patient_id: str
    full_name: str
    preferred_language: str
    abha_address: str
    demographics_json: Dict[str, Any]

class PractitionerOut(BaseModel):
    practitioner_id: str
    display_name: str
    registration_number: str
    specialty: str
    credential_status: str

class RecordMetadataOut(BaseModel):
    record_id: str
    patient_id: str
    record_type: str
    title: str
    date_str: str
    file_mime_type: str
    file_size_bytes: int
    summary_findings: Optional[str] = None
    consent_status: Optional[str] = "protected"  # "protected", "approved", "expired"

class ConsentRequestIn(BaseModel):
    encounter_id: str
    record_id: str
    purpose: str
    duration_minutes: int = 60

class ConsentDecisionIn(BaseModel):
    approved: bool
    decided_by_role: str = "patient"  # "patient" or "representative"
    representative_notes: Optional[str] = None

class LinkPatientRequestIn(BaseModel):
    abha_identifier: str  # e.g. 91-4820-1928-1120@abdm, kavita.rao@abdm, or 14-digit number
    purpose: str = "Evaluating clinical symptoms, past medical history & diagnostic records"
    duration_minutes: int = 60
    scopes: List[str] = ["demographics", "medical_history", "diagnostic_records"]

class ConsentOtpVerifyIn(BaseModel):
    otp_code: str
    decided_by_role: str = "patient"
    representative_notes: Optional[str] = None

class DoctorUpdateHistoryIn(BaseModel):
    new_conditions: List[str] = []
    prescribed_medications: List[str] = []
    updated_allergies: List[str] = []
    clinical_notes: Optional[str] = None

class ConsentOut(BaseModel):
    consent_id: str
    encounter_id: str
    patient_id: str
    practitioner_id: str
    record_id: str
    purpose: str
    scope: str
    status: str
    expires_at: Optional[datetime] = None
    created_at: datetime
    grant_token: Optional[str] = None

class ScribeGenerateIn(BaseModel):
    transcript_text: str
    patient_id: str
    encounter_id: str

class MedicationItem(BaseModel):
    drug: str
    dosage: str
    frequency: str
    duration: str
    timing_icon: Optional[str] = "☀️"  # ☀️, 🌤️, 🌙

class PlanStructure(BaseModel):
    medications: List[MedicationItem] = []
    dietary_advice: Optional[str] = None
    red_flags: Optional[str] = None

class ClinicalNoteOut(BaseModel):
    note_id: str
    encounter_id: str
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan_json: Dict[str, Any] = {}
    status: str
    clinician_signature: Optional[str] = None
    signed_at: Optional[datetime] = None

class ClinicalNoteSignIn(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: Dict[str, Any]
    doctor_signature_name: str
    ddi_acknowledged: bool = False

class DDIValidationIn(BaseModel):
    proposed_drugs: List[str]
    patient_active_meds: List[str] = []
    allergies: List[str] = []

class DDIAlertOut(BaseModel):
    has_contraindication: bool
    severity: Optional[str] = None  # "CRITICAL", "HIGH", "MODERATE"
    conflicting_pair: Optional[str] = None
    clinical_mechanism: Optional[str] = None
    formulary_citation: Optional[str] = None
    recommended_action: Optional[str] = None

class AuditEventOut(BaseModel):
    event_id: str
    actor_id: str
    action: str
    resource_id: str
    outcome: str
    timestamp: datetime
