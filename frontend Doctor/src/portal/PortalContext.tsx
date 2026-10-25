// Portal-wide state shared by every screen: who is signed in, their settings and language,
// notifications, toasts, and the consultation call (which keeps running on every page).
import { createContext, useContext, type ReactNode } from 'react';
import type { DoctorProfile, PatientSummary } from '../services/api';
import type { DoctorSettings, NotificationItem } from '../services/doctorApi';
import type { ConsultationCallApi } from '../services/call/useConsultationCall';
import type { Formatters } from './time';
import type { Lang, StringKey } from './i18n';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface PortalState {
  doctor: DoctorProfile | null;
  settings: DoctorSettings | null;
  saveSettings: (patch: Parameters<typeof import('../services/doctorApi').doctorApi.saveSettings>[0]) => Promise<DoctorSettings>;
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  fmt: Formatters;
  notifications: NotificationItem[];
  unread: number;
  markRead: (ids: string[] | 'all') => void;
  toast: (message: string, tone?: ToastTone) => void;
  /** Bumped when live events change data (appointments, consents...); screens refetch on change. */
  version: number;
  refresh: () => void;
  /** The consultation open in the meeting room (its call room stays connected on every page). */
  consultation: { patient: PatientSummary; appointmentId: string | null } | null;
  openConsultation: (patient: PatientSummary, appointmentId: string | null) => void;
  closeConsultation: () => void;
  call: ConsultationCallApi;
  /** Speaker / output device and on-off, used by the portal's one audio element. */
  speakerOn: boolean;
  setSpeakerOn: (on: boolean) => void;
  speakerId: string;
  setSpeakerId: (id: string) => void;
  /** Unread patient messages (sidebar badge). */
  chatUnread: number;
  refreshChatUnread: () => void;
  /** Bumped on every live chat event (new message, read receipt); open conversations reload. */
  chatEvent: number;
  /** Put text into the open consultation's note (the live assistant's "Add to note"). */
  addToNote: (item: { id: string; text: string; section: string }) => void;
  /** The AI notepad for the open consultation (null when none is open). */
  notepad: ReactNode;
  requestRecords: (patient: PatientSummary) => void;
  logout: () => void;
}

export const PortalContext = createContext<PortalState | null>(null);

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside the portal');
  return ctx;
}
