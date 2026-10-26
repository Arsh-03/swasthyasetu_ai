// Doctor portal root: sign-in, then the portal (Home · My patients · Audit trail · Settings, plus the meeting room).
// Holds what must survive page changes: the signed-in doctor, settings and language, notifications,
// live events, and the consultation call (its room stays connected while the doctor moves around).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DoctorLoginView } from './components/DoctorLoginView';
import { ConsentRequestModal } from './components/ConsentRequestModal';
import { ClinicalNotepad } from './components/ClinicalNotepad';
import { CallPanel } from './components/call/CallPanel';
import { CallWindow } from './components/call/CallWindow';
import { IncomingCallCard } from './components/call/CallOverlays';
import { RemoteAudio } from './components/call/RemoteAudio';
import { Icon } from './components/ui/Icon';
import { cx } from './components/ui/cx';
import { api, WS_BASE_URL, type DoctorProfile, type PatientSummary } from './services/api';
import { chatApi, doctorApi, type DoctorSettings, type NotificationItem } from './services/doctorApi';
import { useConsultationCall } from './services/call/useConsultationCall';
import { useDoctorLobby } from './services/call/useDoctorLobby';
import { PortalContext, type PortalState, type ToastTone } from './portal/PortalContext';
import { Shell } from './portal/Shell';
import { hrefFor, navigate, useRoute } from './portal/router';
import { translate, type Lang, type StringKey } from './portal/i18n';
import { DEFAULT_PREFS, makeFormatters, addDays } from './portal/time';
import { HomeScreen } from './portal/screens/HomeScreen';
import { PatientsScreen } from './portal/screens/PatientsScreen';
import { PatientScreen } from './portal/screens/PatientScreen';
import { VisitScreen } from './portal/screens/VisitScreen';
import { MeetingScreen } from './portal/screens/MeetingScreen';
import { AuditScreen } from './portal/screens/AuditScreen';
import { SettingsScreen } from './portal/screens/SettingsScreen';
import { MessagesScreen } from './portal/screens/MessagesScreen';

const LANG_KEY = 'doctor_lang';
const storedLang = (): Lang => {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'kn' || v === 'hi' || v === 'en' ? v : 'en';
  } catch {
    return 'en';
  }
};

interface Toast { id: number; message: string; tone: ToastTone }

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(api.getToken()));
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [settings, setSettings] = useState<DoctorSettings | null>(null);
  const [lang, setLangState] = useState<Lang>(storedLang);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [version, setVersion] = useState(0);
  const [consultation, setConsultation] = useState<PortalState['consultation']>(null);
  const [consentPatient, setConsentPatient] = useState<PatientSummary | null>(null);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [speakerId, setSpeakerId] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatEvent, setChatEvent] = useState(0);
  const route = useRoute();

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...(settings?.prefs ?? {}), language: lang }), [settings, lang]);
  const fmt = useMemo(() => makeFormatters(prefs), [prefs]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const toastId = useRef(0);
  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), tone === 'danger' ? 8000 : 4500);
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setIsAuthenticated(false);
    setDoctor(null);
    setSettings(null);
    setConsultation(null);
    setNotifications([]);
    window.location.hash = '#/home';
  }, []);

  // ---- Signed-in doctor and settings ----
  useEffect(() => {
    if (!isAuthenticated) return;
    api.getMe().then(setDoctor).catch(() => logout());
    doctorApi.settings().then((s) => {
      setSettings(s);
      // The server has no time-zone database: keep the doctor's UTC offset current for chat ("available again at...").
      const offset = makeFormatters({ ...DEFAULT_PREFS, ...s.prefs }).offset();
      if (s.prefs.utc_offset_minutes !== offset) doctorApi.saveSettings({ prefs: { utc_offset_minutes: offset } }).then(setSettings).catch(() => undefined);
      setLangState(s.prefs.language);
      try { localStorage.setItem(LANG_KEY, s.prefs.language); } catch { /* */ }
    }).catch(() => { /* older server: defaults */ });
  }, [isAuthenticated, logout]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* */ }
    doctorApi.saveSettings({ prefs: { language: next } }).then(setSettings).catch(() => { /* kept locally */ });
  }, []);

  const saveSettings = useCallback(async (patch: Parameters<PortalState['saveSettings']>[0]) => {
    const saved = await doctorApi.saveSettings(patch);
    setSettings(saved);
    setLangState(saved.prefs.language);
    setDoctor((d) => (d ? { ...d, display_name: saved.profile.display_name, specialty: saved.profile.specialty, facility: saved.profile.facility } : d));
    return saved;
  }, []);

  // ---- Notifications ----
  const loadNotifications = useCallback(() => {
    doctorApi.notifications().then((n) => { setNotifications(n.items); setUnread(n.unread); }).catch(() => { /* bell stays as is */ });
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
    const id = setInterval(loadNotifications, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated, loadNotifications]);

  const refreshChatUnread = useCallback(() => {
    chatApi.unread().then((r) => setChatUnread(r.count)).catch(() => { /* badge stays */ });
  }, []);
  useEffect(() => { if (isAuthenticated) refreshChatUnread(); }, [isAuthenticated, refreshChatUnread]);

  const markRead = useCallback((ids: string[] | 'all') => {
    setNotifications((prev) => prev.map((n) => (ids === 'all' || ids.includes(n.notification_id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids === 'all' ? 0 : Math.max(0, u - ids.length)));
    doctorApi.markRead(ids).catch(() => loadNotifications());
  }, [loadNotifications]);

  // ---- Live events (consent decisions, appointments, alerts) ----
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!isAuthenticated) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;
    let timer: number | undefined;
    const connect = () => {
      ws = new WebSocket(`${WS_BASE_URL}?role=doctor`);
      ws.onopen = () => { retry = 1000; ws?.send(JSON.stringify({ type: 'AUTH', token: api.getToken() })); };
      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data); } catch { return; }
        switch (msg.type) {
          case 'notification': {
            const n = msg as unknown as NotificationItem;
            setNotifications((prev) => [n, ...prev.filter((x) => x.notification_id !== n.notification_id)].slice(0, 50));
            setUnread((u) => u + 1);
            toast(n.title, n.severity === 'critical' ? 'danger' : n.severity === 'warning' ? 'warning' : 'info');
            setVersion((v) => v + 1);
            break;
          }
          case 'chat_message': {
            setChatEvent((v) => v + 1);
            if (msg.sender === 'patient') {
              setChatUnread((u) => u + 1);
              // Urgent ones also come as a notification (red banner); others get a quiet toast unless that chat is open.
              const open = window.location.hash.startsWith(`#/messages/${encodeURIComponent(String(msg.patient_id))}`);
              if (!msg.urgent && !open) toast(tRef.current('newMessageFrom', { name: String(msg.sender_name || '').replace(/\s*\(.*?\)/g, '') || tRef.current('patient') }), 'info');
            }
            break;
          }
          case 'chat_read':
            setChatEvent((v) => v + 1);
            break;
          case 'ABHA_LINK_APPROVED':
          case 'consent_granted':
          case 'ABHA_LINK_REJECTED':
          case 'queue_updated':
          case 'appointment_event':
          case 'recovery_checkin':
          case 'vitals_recorded':
            setVersion((v) => v + 1);
            break;
        }
      };
      ws.onclose = () => {
        if (closed) return;
        timer = window.setTimeout(connect, retry);
        retry = Math.min(retry * 2, 15000);
      };
    };
    connect();
    return () => { closed = true; window.clearTimeout(timer); ws?.close(); };
  }, [isAuthenticated, toast]);

  // ---- Consultation call ----
  const [notepadText, setNotepadText] = useState('');
  const [insertRequest, setInsertRequest] = useState<{ id: string; text: string; section: string } | null>(null);
  const [lobbyAnswer, setLobbyAnswer] = useState<{ video: boolean } | null>(null);
  const clearLobbyAnswer = useCallback(() => setLobbyAnswer(null), []);
  const patient = consultation?.patient ?? null;
  const call = useConsultationCall({
    role: 'doctor',
    encounterId: isAuthenticated ? patient?.encounter_id ?? null : null,
    peerName: patient?.full_name || 'Patient',
    noteText: notepadText,
    autoAnswer: lobbyAnswer,
    onAutoAnswered: clearLobbyAnswer,
  });
  const lobby = useDoctorLobby(isAuthenticated);
  const lobbyCall = lobby.ringing && lobby.ringing.encounterId !== patient?.encounter_id ? lobby.ringing : null;
  const inCall = call.callState === 'calling' || call.callState === 'in_call';

  const openConsultation = useCallback((p: PatientSummary, appointmentId: string | null) => {
    setConsultation((cur) => (cur && cur.patient.encounter_id === p.encounter_id && cur.appointmentId === appointmentId ? cur : { patient: p, appointmentId }));
  }, []);
  const closeConsultation = useCallback(() => setConsultation(null), []);

  // A patient calling on another consultation: open it (and its meeting room when it has an appointment) and answer.
  const answerLobbyCall = async (video: boolean) => {
    if (!lobbyCall) return;
    const ringing = lobbyCall;
    lobby.clear();
    try {
      const [queue, apts] = await Promise.all([
        api.getQueue(),
        doctorApi.appointments(fmt.fromLocal(addDays(fmt.today(), -1), '00:00').toISOString(), fmt.fromLocal(addDays(fmt.today(), 14), '00:00').toISOString()),
      ]);
      const p = queue.find((q) => q.encounter_id === ringing.encounterId || q.patient_id === ringing.patientId);
      if (!p) throw new Error('not found');
      const apt = apts.find((a) => a.encounter_id === ringing.encounterId);
      setConsultation({ patient: { ...p, encounter_id: ringing.encounterId }, appointmentId: apt?.appointment_id ?? null });
      setLobbyAnswer({ video });
      if (apt) navigate({ page: 'meeting', appointmentId: apt.appointment_id });
    } catch {
      toast(t('loadError'), 'danger');
    }
  };

  const notepad = patient?.encounter_id ? (
    <ClinicalNotepad
      key={patient.encounter_id}
      encounterId={patient.encounter_id}
      patientName={patient.full_name}
      callMinutes={call.minutes}
      autoApplyCall={call.aiState === 'recording' || call.aiState === 'finishing'}
      onTextChange={setNotepadText}
      insertRequest={insertRequest}
    />
  ) : null;

  const portal: PortalState = {
    doctor, settings, saveSettings, lang, setLang, t, fmt, notifications, unread, markRead, toast, version, refresh,
    consultation, openConsultation, closeConsultation, call, speakerOn, setSpeakerOn, speakerId, setSpeakerId,
    chatUnread, refreshChatUnread, chatEvent, addToNote: setInsertRequest, notepad, requestRecords: setConsentPatient, logout,
  };

  if (!isAuthenticated) {
    return (
      <DoctorLoginView
        onLoginSuccess={(doc) => { setDoctor(doc); setIsAuthenticated(true); }}
        selectedLanguage={lang}
      />
    );
  }

  return (
    <PortalContext.Provider value={portal}>
      <Shell route={route}>
        {route.page === 'home' && <HomeScreen />}
        {route.page === 'patients' && <PatientsScreen />}
        {route.page === 'patient' && <PatientScreen patientId={route.patientId} tab={route.tab} />}
        {route.page === 'visit' && <VisitScreen patientId={route.patientId} encounterId={route.encounterId} />}
        {route.page === 'meeting' && <MeetingScreen appointmentId={route.appointmentId} />}
        {route.page === 'messages' && <MessagesScreen patientId={route.patientId} />}
        {route.page === 'audit' && <AuditScreen />}
        {route.page === 'settings' && <SettingsScreen section={route.section} />}
      </Shell>

      {/* The patient's voice: one audio element for the whole portal (videos are muted). */}
      {inCall && <RemoteAudio stream={call.remoteStream} muted={!speakerOn} sinkId={speakerId} />}

      {/* In a call but on another page: a small floating call window. */}
      {inCall && route.page !== 'meeting' && (
        <CallWindow call={call} title={patient?.full_name ?? ''} panel={<CallPanel call={call} compact hideStart />}>
          <a
            href={consultation?.appointmentId ? hrefFor({ page: 'meeting', appointmentId: consultation.appointmentId }) : '#/home'}
            className="block w-full py-2 rounded-xl bg-primary hover:bg-primary-deep text-white text-xs font-semibold text-center"
          >
            {t('backToMeeting')}
          </a>
        </CallWindow>
      )}

      {/* Ringing: the open consultation's patient, or a patient from another consultation. */}
      {call.callState === 'incoming' && call.incoming && (
        <IncomingCallCard
          callerName={call.incoming.callerName}
          video={call.incoming.video}
          onAccept={(video) => {
            if (consultation?.appointmentId) navigate({ page: 'meeting', appointmentId: consultation.appointmentId });
            void call.acceptCall(video);
          }}
          onDecline={call.declineCall}
        />
      )}
      {lobbyCall && call.callState !== 'incoming' && !inCall && (
        <IncomingCallCard callerName={lobbyCall.callerName} video={lobbyCall.video}
          onAccept={(video) => void answerLobbyCall(video)} onDecline={lobby.decline} />
      )}

      <ConsentRequestModal
        patient={consentPatient}
        isOpen={consentPatient !== null}
        onClose={() => setConsentPatient(null)}
        onSuccess={() => { toast(t('consentRequestSent'), 'success'); refresh(); }}
      />

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none w-[min(480px,calc(100vw-2rem))]" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} role={x.tone === 'danger' ? 'alert' : 'status'}
            className={cx('pointer-events-auto w-full flex items-center gap-2.5 rounded-control px-4 py-3 text-sm font-semibold shadow-lg',
              x.tone === 'danger' ? 'bg-danger-deep text-white' : x.tone === 'success' ? 'bg-success-deep text-white' : x.tone === 'warning' ? 'bg-warning-deep text-white' : 'bg-night text-white')}>
            <Icon name={x.tone === 'danger' ? 'emergency' : x.tone === 'success' ? 'checkCircle' : 'notification'} size={18} />
            <span className="flex-1">{x.message}</span>
          </div>
        ))}
      </div>
    </PortalContext.Provider>
  );
}
export default App;
