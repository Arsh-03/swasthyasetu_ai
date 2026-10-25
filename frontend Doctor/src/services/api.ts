import type { PatientFullRecord, UpcomingAppointment } from '../data/patientRecords';

// Backend address; override with VITE_API_ORIGIN (e.g. for a second test backend). Default: localhost:8000.
const API_ORIGIN: string = import.meta.env.VITE_API_ORIGIN || 'http://localhost:8000';
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const WS_BASE_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/ws/telehealth`;

export interface DoctorProfile {
  practitioner_id: string;
  display_name: string;
  registration_number: string;
  phone_number: string;
  specialty: string;
  credential_status: string;
  facility?: string | null;
}

export interface PatientSummary {
  patient_id: string;
  encounter_id?: string;
  full_name: string;
  abha_address: string;
  phone_number: string;
  preferred_language: 'kn' | 'hi' | 'en';
  demographics: {
    age?: number;
    gender?: string;
    district?: string;
    occupation?: string;
    phone_masked?: string;
  };
  complaint?: string;
  vitals?: string;
  allergies?: string[];
  active_rx?: string[];
  wait_time?: string;
  urgency?: 'high' | 'follow_up' | 'routine';
  avatar_url?: string;
}

export interface RecordSummary {
  record_id: string;
  patient_id: string;
  record_type: string;
  title: string;
  date_str: string;
  file_mime_type: string;
  file_size_bytes: number;
  summary_findings: string | null;
  consent_status: 'approved' | 'expired' | 'protected';
  facility: string | null;
  category: string | null;
  type_label: string | null;
  imaging: {
    modality: string;
    organ: string;
    findingsSummary: string;
    caliperMeasurement: string;
    operator: string;
  } | null;
  lab_results: { test: string; value: string; unit: string; range: string; flag: 'normal' | 'elevated' | 'low' }[] | null;
  shared_with: string | null;
  consent_expires_at: string | null;
}

export interface AuditLogEntry {
  event_id: string;
  actor_id: string;
  action: string;
  resource_id: string;
  outcome: string;
  timestamp: string;
  actor_name: string | null;
  resource_label: string | null;
  purpose: string | null;
  hmac_signature: string | null;
}

export interface SignedNoteInput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: Record<string, unknown>;
  doctor_signature_name: string;
  ddi_acknowledged?: boolean;
}

export interface EncounterDetails {
  encounter_id: string;
  status: string;
  mode: string;
  symptoms: string;
  allergies: string[];
  current_meds: string[];
  patient: {
    patient_id: string;
    full_name: string;
    abha_address: string;
    preferred_language: string;
    demographics: Record<string, any>;
  };
  practitioner: {
    practitioner_id: string;
    display_name: string;
    registration_number: string;
    specialty: string;
  };
}

export interface ScribeSoapNote {
  complaint: string;
  diagnosis: string;
  medicine: string;
  advice: string;
  follow_up: string;
  is_approved?: boolean;
}

export interface DdiAlert {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  interaction_type: string;
  description: string;
  formulary_citation: string;
}

class ApiService {
  private token: string | null = localStorage.getItem('doctor_token');

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('doctor_token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('doctor_token');
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async getDemoProfiles() {
    const res = await fetch(`${API_BASE_URL}/auth/profiles`);
    if (!res.ok) throw new Error('Failed to load demo profiles');
    return res.json();
  }

  async loginDoctor(identifier = 'NMC-KA-581920', password = 'password123') {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role: 'doctor' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || 'Doctor login failed');
    }
    this.setToken(data.token);
    return data;
  }

  async getEncounter(encounterId = 'enc_9481'): Promise<EncounterDetails> {
    const res = await fetch(`${API_BASE_URL}/encounters/${encounterId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch encounter');
    return res.json();
  }

  async setEncounterMode(encounterId: string, mode: string) {
    const res = await fetch(`${API_BASE_URL}/encounters/${encounterId}/mode?mode=${mode}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  /** Throws with the backend's error message on a non-2xx response. */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: this.getHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.detail) || `Request failed (${res.status})`);
    }
    return data as T;
  }

  async getMe(): Promise<DoctorProfile> {
    return this.request<DoctorProfile>('/auth/me');
  }

  async getQueue(): Promise<PatientSummary[]> {
    return this.request<PatientSummary[]>('/patients/queue');
  }

  async getPatientChart(
    patientId: string
  ): Promise<{ chart: PatientFullRecord | null; next_appointment: UpcomingAppointment | null }> {
    return this.request(`/patients/${patientId}/chart`);
  }

  async updateAppointment(apt: UpcomingAppointment): Promise<UpcomingAppointment> {
    return this.request<UpcomingAppointment>(`/appointments/${apt.appointmentId}`, {
      method: 'PUT',
      body: JSON.stringify(apt),
    });
  }

  async requestConsent(params: {
    patient_id: string;
    record_id: string;
    purpose: string;
    duration_minutes: number;
    encounter_id?: string;
  }) {
    return this.request('/consents/request', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getPatientRecords(patientId: string): Promise<RecordSummary[]> {
    return this.request<RecordSummary[]>(`/records/patient/${patientId}`);
  }

  async checkDdi(proposedDrugs: string[], activeDrugs: string[], allergies: string[] = []) {
    return this.request('/cdss/validate', {
      method: 'POST',
      body: JSON.stringify({
        proposed_drugs: proposedDrugs,
        patient_active_meds: activeDrugs,
        allergies,
      }),
    });
  }

  async generateSoapDraft(encounterId: string, patientId: string, transcript: string) {
    return this.request('/scribe/generate', {
      method: 'POST',
      body: JSON.stringify({ encounter_id: encounterId, patient_id: patientId, transcript_text: transcript }),
    });
  }

  async signSoapNote(encounterId: string, note: SignedNoteInput) {
    return this.request(`/scribe/sign/${encounterId}`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>('/audit/logs');
  }
}

export const api = new ApiService();
