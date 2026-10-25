import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { LocalizedText } from '../utils/localized';

// Backend host, in priority order:
// 1. EXPO_PUBLIC_API_HOST env var (manual override)
// 2. The LAN IP of the computer running Expo (works for Expo Go on a real phone)
// 3. Emulator / simulator defaults
const expoHost = (Constants.expoConfig?.hostUri ?? '').split(':')[0];
export const API_HOST =
  process.env.EXPO_PUBLIC_API_HOST ||
  (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1' ? expoHost : '') ||
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
export const API_BASE_URL = `http://${API_HOST}:8000/api/v1`;
export const WS_BASE_URL = `ws://${API_HOST}:8000/ws/telehealth`;

/** The socket URL carries the login token so the backend can route call signaling to this patient. */
export const telehealthSocketUrl = (token: string | null) =>
  token ? `${WS_BASE_URL}?token=${encodeURIComponent(token)}` : WS_BASE_URL;

/** Optional TURN relay for calls across different networks (e.g. mobile data ↔ clinic Wi-Fi). */
export const TURN_CONFIG = {
  url: process.env.EXPO_PUBLIC_TURN_URL,
  username: process.env.EXPO_PUBLIC_TURN_USERNAME,
  credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
};

export interface PatientUser {
  user_id: string;
  role: string;
  full_name: string;
  abha_address: string;
  phone_number: string;
  preferred_language: 'kn' | 'hi' | 'en';
  demographics: {
    age?: number;
    gender?: string;
    district?: string;
    occupation?: string;
  };
}

export interface ConsentRequestData {
  consent_id: string;
  patient_id: string;
  practitioner_name: string;
  practitioner_reg: string;
  record_title: string;
  clinical_purpose: string;
  duration_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'REVOKED' | 'EXPIRED';
  created_at?: string;
  expires_at?: string;
}

export interface HealthRecord {
  record_id: string;
  patient_id: string;
  record_type: string;
  /** Display fields may be a string or { en, kn, hi } (resolve with `localized`). */
  title: LocalizedText;
  date_str: string;
  file_mime_type: string;
  file_size_bytes: number;
  summary_findings: string | null;
  consent_status: 'approved' | 'expired' | 'protected';
  facility: LocalizedText | null;
  /** Stable code ('lab', 'imaging', …); the app shows its own translated label. */
  category: string | null;
  type_label: LocalizedText | null;
  shared_with: string | null;
  consent_expires_at: string | null;
  created_at: string | null;
}

export interface NextAppointment {
  appointmentId: string;
  patientId: string;
  date: string;
  time: string;
  relativeTime: LocalizedText;
  mode: string;
  doctorName: string;
  specialty: LocalizedText;
  facility: LocalizedText;
  agenda: LocalizedText;
  status: string;
  instructionsForPatient: LocalizedText[];
  isRescheduled: boolean;
}

export type DoseSlot = 'morning' | 'afternoon' | 'night' | 'prn';

export interface CarePlanMedication {
  id: string;
  /** Drug name: always Latin script, never translated. */
  name: string;
  /** Optional name in the patient's script, shown as a secondary line. */
  nameLocal?: LocalizedText | null;
  dosage: LocalizedText;
  frequency: LocalizedText;
  timing: LocalizedText;
  duration: LocalizedText;
  purpose: LocalizedText;
  schedule: { morning?: boolean; afternoon?: boolean; night?: boolean };
  prescribedBy?: string;
}

export interface CarePlan {
  doctor_name: string | null;
  facility: LocalizedText | null;
  medications: CarePlanMedication[];
  /** Keyed by "medicationId:slot" */
  doses_today: Record<string, boolean>;
  checkin_today: 'better' | 'same' | 'worse' | null;
  latest_note: { assessment: string; plan: Record<string, LocalizedText>; signed_at: string } | null;
}

export interface ConsentHistoryItem {
  consent_id: string;
  doctor: string;
  reg: string;
  facility: LocalizedText;
  record: LocalizedText;
  purpose: LocalizedText;
  status: 'approved' | 'requested' | 'expired' | 'revoked' | 'declined';
  active: boolean;
  remaining: LocalizedText | null;
  created_at: string;
  expires_at: string | null;
}

export interface PatientRegisterRequest {
  full_name: string;
  abha_address: string;
  mobile_number: string;
  password: string;
  preferred_language: 'kn' | 'hi' | 'en';
  age: number;
  gender: string;
  district: string;
}

/** An error response from the backend, keeping the HTTP status so screens can pick a message. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class PatientApiService {
  private token: string | null = null;
  private currentUser: PatientUser | null = null;

  setToken(token: string) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setCurrentUser(user: PatientUser | null) {
    this.currentUser = user;
  }

  clearToken() {
    this.token = null;
    this.currentUser = null;
  }

  getCurrentUser(): PatientUser | null {
    return this.currentUser;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async loginPatient(identifier = '9845012345', password = 'password123') {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        password,
        role: 'patient',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || 'Patient login failed');
    }
    this.setToken(data.token);
    this.setCurrentUser(data.user);
    return data;
  }

  /** Creates a patient account and signs it in. Throws ApiError (with the HTTP status) on refusal. */
  async registerPatient(req: PatientRegisterRequest) {
    const res = await fetch(`${API_BASE_URL}/auth/register/patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new ApiError((data && data.detail) || 'Patient registration failed', res.status);
    }
    this.setToken(data.token);
    this.setCurrentUser(data.user);
    return data as { token: string; user: PatientUser };
  }

  async getDemoProfiles() {
    const res = await fetch(`${API_BASE_URL}/auth/profiles`);
    if (!res.ok) throw new Error('Failed to load profiles');
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

  async approveConsent(consentId: string, otpCode: string) {
    return this.request(`/consents/${consentId}/verify-otp-and-grant`, {
      method: 'POST',
      body: JSON.stringify({ otp_code: otpCode }),
    });
  }

  async declineConsent(consentId: string) {
    return this.request(`/consents/${consentId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ approved: false }),
    });
  }

  async revokeConsent(consentId: string) {
    return this.request(`/consents/${consentId}/revoke`, { method: 'POST' });
  }

  async getPendingConsents(): Promise<ConsentRequestData[]> {
    return this.request<ConsentRequestData[]>('/consents/pending-for-patient');
  }

  async getConsentHistory(): Promise<ConsentHistoryItem[]> {
    return this.request<ConsentHistoryItem[]>('/consents/history');
  }

  async getPatientRecords(patientId: string): Promise<HealthRecord[]> {
    return this.request<HealthRecord[]>(`/records/patient/${patientId}`);
  }

  async getNextAppointment(): Promise<NextAppointment | null> {
    return this.request<NextAppointment | null>('/appointments/next');
  }

  async getCarePlan(): Promise<CarePlan> {
    return this.request<CarePlan>('/careplan');
  }

  async logDose(medicationId: string, slot: DoseSlot, taken: boolean) {
    return this.request('/careplan/doses', {
      method: 'POST',
      body: JSON.stringify({ medication_id: medicationId, slot, taken }),
    });
  }

  async submitCheckin(status: 'better' | 'same' | 'worse') {
    return this.request('/careplan/checkin', {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async submitIntake(symptoms: string[], notes: string, isRepresentative = false) {
    return this.request('/encounters/intake', {
      method: 'POST',
      body: JSON.stringify({ symptoms, notes, is_representative: isRepresentative }),
    });
  }

  async getEncounter(encounterId = 'enc_9481') {
    const res = await fetch(`${API_BASE_URL}/encounters/${encounterId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async translateText(text: string, targetLang: 'kn' | 'hi' | 'en') {
    try {
      const res = await fetch(`${API_BASE_URL}/translate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ text, target_language: targetLang }),
      });
      if (!res.ok) return text;
      const data = await res.json();
      return data.translated_text || text;
    } catch {
      return text;
    }
  }
}

export const patientApi = new PatientApiService();
