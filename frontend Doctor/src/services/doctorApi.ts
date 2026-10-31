// Doctor portal API (backend/app/routers/doctor.py and /audit/events). Uses the same session token as api.ts.
import { API_BASE_URL, api, type PatientSummary } from './api';
import type { PatientFullRecord, MedicationItem } from '../data/patientRecords';

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  patient_name: string | null;
  patient_avatar: string | null;
  scheduled_at: string;
  duration_minutes: number;
  mode: string;
  agenda: string;
  status: VisitStatus;
  patient_confirmed: boolean;
  encounter_id: string | null;
  urgency: 'high' | 'follow_up' | 'routine' | null;
  complaint: string | null;
  /** Google Meet style code ("rgw-pqtk-zma"); the patient's link is <patient app>/?join=<code>. */
  meeting_code: string | null;
  meeting: { opens_at: string | null; closes_at: string | null; ends_at: string | null; state: 'early' | 'open' | 'closed' | 'cancelled' | 'completed' } | null;
}

export interface NotificationItem {
  notification_id: string;
  kind: 'appointment' | 'alert' | 'consent' | 'call' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  link: PortalLink;
  created_at: string;
  read: boolean;
}

/** Where a notification or audit row leads in the portal. */
export interface PortalLink {
  page?: 'patient' | 'visit' | 'meeting' | 'home' | 'audit' | 'messages';
  patient_id?: string;
  encounter_id?: string;
  appointment_id?: string;
  tab?: string;
}

export interface Dashboard {
  next_appointment: Appointment | null;
  today: Appointment[];
  stats: {
    today_total: number;
    today_completed: number;
    week_completed: number;
    upcoming_7_days: number;
    patients_under_care: number;
  };
  consultations_by_day: { date: string; count: number }[];
  scheduled_by_day: { date: string; count: number }[];
  alerts: NotificationItem[];
}

export interface PatientBrief {
  patient_id: string;
  full_name: string;
  abha_address: string;
  avatar_url: string | null;
  preferred_language: string;
  phone_number: string;
  age: number | null;
  gender: string | null;
  district: string | null;
  occupation: string | null;
  blood_group: string | null;
  allergies: string[];
  conditions: string[];
}

export interface PatientListItem extends PatientBrief {
  next_appointment: Appointment | null;
  last_visit_at: string | null;
  visit_count: number;
  open_encounter_id: string | null;
  urgency: string | null;
}

export interface VisitRow {
  encounter_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  mode: string;
  complaint: string;
  diagnosis: string;
  signed: boolean;
  appointment_id: string | null;
}

export type ReadingKind = 'heart_rate' | 'blood_pressure' | 'blood_sugar' | 'temperature' | 'weight';

export interface VitalReading {
  reading_id: string;
  kind: ReadingKind;
  value: number;
  value2: number | null;
  value_f: number | null;
  display: string;
  unit: string;
  method: 'camera_ppg' | 'manual' | 'asha_device';
  confidence: 'good' | 'fair' | null;
  details: { quality?: number; irregularity?: number | null; seconds?: number; torch?: boolean; timing?: string; readings_averaged?: number; pulse?: number };
  level: 'normal' | 'high' | 'low' | 'urgent';
  reason: string;
  out_of_range: boolean;
  recorded_by_role: 'patient' | 'asha';
  recorded_by_name: string | null;
  created_at: string;
}

/** A doctor's request for home-visit readings by an ASHA worker. */
export interface ReadingRequest {
  task_id: string;
  kinds: ReadingKind[];
  note: string;
  due_at: string | null;
  status: string;
  worker_name: string | null;
  created_at: string;
}

export interface PatientDetail {
  patient: PatientBrief;
  chart: Partial<PatientFullRecord> | null;
  upcoming: Appointment[];
  past_visits: VisitRow[];
  open_consultation: PatientSummary | null;
  cancelled: Appointment[];
  readings: VitalReading[];
  requests: ReadingRequest[];
  /** The patient's other doctors (a patient can see several, one per health issue). No clinical details. */
  care_team?: CareTeamDoctor[];
}

export interface CareTeamDoctor {
  practitioner_id: string;
  name: string;
  department: string;
  department_name: string;
  facility: string;
  reason: string;
  next_appointment_at: string | null;
}

export interface StructuredMedicine {
  name: string; form: string | null; strength: string | null; frequency: string | null; duration: string | null;
  timing: string | null; route: string | null; text: string;
}
export interface StructuredNote {
  complaints: string[]; history: string[]; allergies: string[]; diagnosis: string[]; investigations: string[];
  examination: string[]; advice: string[]; prescription: StructuredMedicine[];
  vitals: Record<string, { value: string; unit: string }>;
  follow_up: { text: string | null; in_days: number | null };
}

export interface VisitDetail {
  encounter_id: string;
  patient: PatientBrief | null;
  doctor_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  mode: string;
  complaint: string;
  vitals: string;
  allergies: string[];
  medications_at_visit: string[];
  note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: Record<string, string>;
    signed_by: string | null;
    signed_at: string | null;
    status: string;
  } | null;
  notepad: string;
  /** The note parsed into the CareBridge note format (backend/app/services/note_format.py). */
  structured: StructuredNote | null;
  coded_terms: { name: string; category?: string; codes?: { system: string; code: string }[] }[];
  appointment: Appointment | null;
  timeline: { action: string; at: string; detail: string }[];
  messages: { sender: 'patient' | 'doctor'; body: string; translation: string | null; urgent: boolean; created_at: string }[];
}

export type AuditCategory = 'appointments' | 'consultations' | 'messages' | 'consent_records' | 'alerts' | 'account';

export interface AuditItem {
  event_id: string;
  action: string;
  category: AuditCategory;
  outcome: string;
  problem: boolean;
  timestamp: string;
  actor_name: string;
  patient_id: string | null;
  patient_name: string | null;
  detail: string;
  resource_id: string;
  link: PortalLink | null;
}

export interface AuditPage {
  items: AuditItem[];
  total: number;
  category_counts: Record<AuditCategory, number>;
}

export interface TimeSlot { start: string; end: string }
export interface Leave { id?: string; start: string; end: string; reason: string }
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DoctorSettings {
  profile: { display_name: string; specialty: string; facility: string; registration_number: string };
  prefs: {
    language: 'en' | 'kn' | 'hi'; date_format: string; time_format: '12h' | '24h'; timezone: string;
    chat_window_days: number; utc_offset_minutes: number;
  };
  availability: { weekly: Record<Weekday, TimeSlot[]>; leaves: Leave[] };
}

export interface BookingInput {
  patient_id?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  mode?: string;
  agenda?: string;
  status?: VisitStatus;
  utc_offset_minutes: number;
  force?: boolean;
}

/** An error the server explains (status 409 = outside available hours, can be overridden). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const apiCache = new Map<string, { time: number; data: any }>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 8000; // 8 seconds

export function clearDoctorApiCache() {
  apiCache.clear();
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isGet = !init.method || init.method.toUpperCase() === 'GET';

  if (isGet) {
    const cached = apiCache.get(path);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return cached.data as T;
    }
    const existing = inFlightRequests.get(path);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = api.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data && (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
      throw new ApiError(detail || `Request failed (${res.status})`, res.status);
    }
    return data as T;
  })();

  if (isGet) {
    inFlightRequests.set(path, fetchPromise);
    try {
      const result = await fetchPromise;
      apiCache.set(path, { time: Date.now(), data: result });
      return result;
    } finally {
      inFlightRequests.delete(path);
    }
  }

  // Any mutation clears cache
  apiCache.clear();
  return fetchPromise;
}

const qs = (params: Record<string, string | number | undefined | null>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

export const doctorApi = {
  dashboard: (dayStart: string, utcOffsetMinutes: number) =>
    call<Dashboard>(`/doctor/dashboard?${qs({ day_start: dayStart, utc_offset_minutes: utcOffsetMinutes })}`),
  appointments: (start: string, end: string) => call<Appointment[]>(`/doctor/appointments?${qs({ start, end })}`),
  appointment: (id: string) => call<Appointment>(`/doctor/appointments/${id}`),
  book: (input: BookingInput) => call<Appointment>('/doctor/appointments', { method: 'POST', body: JSON.stringify(input) }),
  changeAppointment: (id: string, input: BookingInput) =>
    call<Appointment>(`/doctor/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  openAppointment: (id: string) =>
    call<{ appointment: Appointment; patient: PatientSummary }>(`/doctor/appointments/${id}/open`, { method: 'POST' }),
  patients: () => call<PatientListItem[]>('/doctor/patients'),
  requestReadings: (patientId: string, body: { kinds: ReadingKind[]; due_at?: string; note?: string }) =>
    call<ReadingRequest>(`/doctor/patients/${encodeURIComponent(patientId)}/requests`, { method: 'POST', body: JSON.stringify(body) }),
  cancelRequest: (taskId: string) => call<{ ok: boolean }>(`/doctor/requests/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' }),
  patient: (id: string) => call<PatientDetail>(`/doctor/patients/${id}`),
  visit: (encounterId: string) => call<VisitDetail>(`/doctor/visits/${encounterId}`),
  notifications: () => call<{ items: NotificationItem[]; unread: number }>('/doctor/notifications'),
  markRead: (ids: string[] | 'all') =>
    call('/doctor/notifications/read', { method: 'POST', body: JSON.stringify(ids === 'all' ? { all: true } : { ids }) }),
  settings: () => call<DoctorSettings>('/doctor/settings'),
  saveSettings: (patch: Partial<{
    display_name: string; specialty: string; facility: string;
    prefs: Partial<DoctorSettings['prefs']>; availability: DoctorSettings['availability'];
  }>) => call<DoctorSettings>('/doctor/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  audit: (filters: {
    start?: string; end?: string; category?: string; outcome?: string; patient_id?: string; q?: string;
    limit?: number; offset?: number;
  }) => call<AuditPage>(`/audit/events?${qs(filters)}`),
  updatePrescription: (patientId: string, rxId: string, data: Partial<MedicationItem> & { meal_relation?: string; dose_amount?: string }) =>
    call<MedicationItem>(`/doctor/patients/${encodeURIComponent(patientId)}/prescriptions/${encodeURIComponent(rxId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addPrescription: (patientId: string, data: Partial<MedicationItem> & { meal_relation?: string; dose_amount?: string }) =>
    call<MedicationItem>(`/doctor/patients/${encodeURIComponent(patientId)}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deletePrescription: (patientId: string, rxId: string) =>
    call<{ status: string; id: string }>(`/doctor/patients/${encodeURIComponent(patientId)}/prescriptions/${encodeURIComponent(rxId)}`, {
      method: 'DELETE',
    }),
  signAndPushLabReport: (sessionId: string, data: {
    patient_id?: string;
    note?: string;
    doctor_signature_name?: string;
    prescription_overrides?: any[];
  }) =>
    call<{
      status: string;
      signature: string;
      signed_at: string;
      record_id: string;
      encounter_id: string;
      patient_id: string;
      patient_name: string;
      pushed_prescriptions_count: number;
      structured: StructuredNote;
      final: any;
    }>(`/lab/sessions/${encodeURIComponent(sessionId)}/sign_and_push`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ---------------------------------------------------------------------------------------------- Chat

export interface ChatMessage {
  message_id: string;
  sender: 'patient' | 'doctor';
  body: string;
  lang: string;
  translation: string | null;
  translation_lang: string | null;
  encounter_id: string | null;
  urgent: boolean;
  created_at: string;
  read: boolean;
  /** One emoji per side, e.g. { doctor: '👍', patient: '🙏' }. */
  reactions?: Partial<Record<'patient' | 'doctor', string>>;
}

export interface ChatStatus {
  open: boolean;
  reason: 'upcoming' | 'recent_visit' | 'consultation' | 'doctor_reply' | 'closed';
  open_until: string | null;
  window_days: number;
  doctor_available_now: boolean;
  doctor_next_available: string | null;
}

export interface ChatThreadSummary {
  other_id: string;
  name: string;
  avatar_url: string | null;
  subtitle: string | null;
  last_message: ChatMessage | null;
  unread: number;
  urgent: boolean;
  open: boolean;
}

export interface ChatThread {
  patient: { id: string; name: string; avatar_url: string | null; language: string };
  doctor: { id: string; name: string; specialty: string };
  status: ChatStatus;
  messages: ChatMessage[];
}

export const chatApi = {
  threads: () => call<ChatThreadSummary[]>('/chat/threads'),
  thread: (patientId: string) => call<ChatThread>(`/chat/threads/${encodeURIComponent(patientId)}`),
  send: (patientId: string, body: string) =>
    call<ChatMessage & { emergency: boolean }>(`/chat/threads/${encodeURIComponent(patientId)}/messages`, { method: 'POST', body: JSON.stringify({ body, lang: 'en' }) }),
  markRead: (patientId: string) => call<{ marked: number }>(`/chat/threads/${encodeURIComponent(patientId)}/read`, { method: 'POST' }),
  react: (patientId: string, messageId: string, emoji: string | null) =>
    call<ChatMessage>(`/chat/threads/${encodeURIComponent(patientId)}/messages/${encodeURIComponent(messageId)}/reaction`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  unread: () => call<{ count: number }>('/chat/unread'),
};
