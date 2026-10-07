export type Language = 'en' | 'kn' | 'hi';
export type UserRole = 'patient' | 'doctor';
export type NetworkTier = 'good' | 'weak' | 'bad';

export interface PatientInfo {
  patient_id: string;
  full_name: string;
  abha_address: string;
  preferred_language: Language;
  demographics: {
    age: number;
    gender: string;
    district: string;
    occupation?: string;
    phone_masked?: string;
  };
}

export interface DoctorInfo {
  practitioner_id: string;
  display_name: string;
  registration_number: string;
  specialty: string;
  credential_status: string;
}

export interface RepresentativeInfo {
  representative_id: string;
  full_name: string;
  relationship_type: string;
  authority_status: string;
}

export interface HealthRecord {
  record_id: string;
  patient_id: string;
  record_type: string;
  title: string;
  date_str: string;
  file_mime_type: string;
  file_size_bytes: number;
  summary_findings?: string;
  consent_status: 'protected' | 'approved' | 'expired';
}

export interface ConsentRequest {
  consent_id: string;
  encounter_id: string;
  patient_id: string;
  practitioner_id: string;
  practitioner_name?: string;
  practitioner_reg?: string;
  record_id: string;
  purpose: string;
  scope: string;
  status: 'requested' | 'approved' | 'declined' | 'revoked' | 'expired';
  expires_at?: string;
  grant_token?: string;
  is_abha_link?: boolean;
}

export interface PatientMedicalHistory {
  chronic_conditions?: string[];
  active_medications?: string[];
  current_medications?: string[];
  allergies?: string[];
  past_surgeries?: string[];
  blood_group?: string;
  consultations?: Array<{
    consultation_id: string;
    timestamp: string;
    doctor_id?: string;
    doctor_name?: string;
    clinical_notes?: string;
    new_diagnoses?: string[];
    prescriptions?: string[];
  }>;
  last_updated_by?: string;
  last_updated_at?: string;
}

export interface LinkedPatient {
  patient_id: string;
  full_name: string;
  abha_address: string;
  phone_number?: string;
  preferred_language?: string;
  demographics: {
    age?: number;
    gender?: string;
    district?: string;
    abha_number?: string;
    blood_group?: string;
    medical_history?: PatientMedicalHistory;
    [key: string]: any;
  };
  records?: HealthRecord[];
}

export interface DDIAlert {
  has_contraindication: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  conflicting_pair: string;
  clinical_mechanism: string;
  formulary_citation: string;
  recommended_action: string;
}

export interface ClinicalNote {
  note_id: string;
  encounter_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: {
    medications: Array<{
      drug: string;
      dosage: string;
      frequency: string;
      duration: string;
      timing_icon?: string;
    }>;
    dietary_advice?: string;
    red_flags?: string;
  };
  status: 'draft' | 'clinician_approved';
  clinician_signature?: string;
  signed_at?: string;
}

export interface AuditEvent {
  event_id: string;
  actor_id: string;
  action: string;
  resource_id: string;
  outcome: string;
  timestamp: string;
}

export interface AuthSession {
  token: string;
  role: UserRole;
  user_id: string;
  name: string;
  identifier: string;
  phone_number?: string;
  specialty?: string;
  preferred_language?: Language;
}
