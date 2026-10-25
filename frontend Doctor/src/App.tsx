import { useState, useEffect, useRef } from 'react';
import { DoctorHeader } from './components/DoctorHeader';
import { PatientQueueView } from './components/PatientQueueView';
import { PatientMedicalChartView } from './components/PatientMedicalChartView';
import { ConsultationWorkspace } from './components/ConsultationWorkspace';
import { ConsentRequestModal } from './components/ConsentRequestModal';
import { ClinicalRecordsView } from './components/ClinicalRecordsView';
import { AuditLedgerView } from './components/AuditLedgerView';
import { DoctorLoginView } from './components/DoctorLoginView';
import type { PatientSummary, DoctorProfile } from './services/api';
import { api, WS_BASE_URL } from './services/api';
import { type SupportedLanguage, t } from './utils/translations';
import type { SignalMessage } from './services/callSession';
import type { CallSignaling } from './components/ConsultationWorkspace';
import type { UpcomingAppointment } from './data/patientRecords';
import { Icon } from './components/ui/Icon';


export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(api.getToken()));
  const [activeTab, setActiveTab] = useState<
    'patient-queue' | 'patient-chart' | 'active-consultation' | 'clinical-records' | 'audit-trail'
  >('patient-queue');
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [queueStatus, setQueueStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  // Bumped whenever consent/record state changes so record views refetch
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'kn' | 'hi'>('kn');
  // <html lang> drives per-script typography (base.css) and screen-reader pronunciation
  useEffect(() => {
    document.documentElement.lang = selectedLanguage;
  }, [selectedLanguage]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const logout = () => {
    api.clearToken();
    setIsAuthenticated(false);
    setDoctor(null);
    setPatients([]);
    setSelectedPatient(null);
  };

  // Load the logged-in doctor's profile from the backend
  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getMe()
      .then((me) => setDoctor(me))
      .catch(() => logout()); // expired or invalid session
  }, [isAuthenticated]);

  const loadQueue = async () => {
    try {
      const queue = await api.getQueue();
      setPatients(queue);
      setQueueStatus('ready');
      // Keep the current selection fresh; default to the first patient in the queue
      setSelectedPatient((current) => {
        if (current) return queue.find((p) => p.patient_id === current.patient_id) || current;
        return queue[0] || null;
      });
    } catch {
      setQueueStatus('error');
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadQueue();
  }, [isAuthenticated]);

  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'declined'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  // The call being placed / in progress, so stale events from older calls are ignored
  const [activeCall, setActiveCall] = useState<{ callId: string; patientId: string } | null>(null);
  const activeCallRef = useRef(activeCall);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  // WebRTC frames go to whichever consultation screen is listening
  const signalListeners = useRef(new Set<(msg: SignalMessage) => void>());
  const [signaling] = useState<CallSignaling>(() => ({
    send: (msg) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    subscribe: (handler) => {
      signalListeners.current.add(handler);
      return () => {
        signalListeners.current.delete(handler);
      };
    },
  }));

  // WebSocket signaling & consent listener
  useEffect(() => {
    if (!isAuthenticated) return;

    // The login token tells the backend who this socket belongs to, so call frames reach only us
    const token = api.getToken();
    const wsUrl = token ? `${WS_BASE_URL}?token=${encodeURIComponent(token)}` : WS_BASE_URL;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Doctor WebSocket signaling connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Doctor received WS message:', msg);

        if (msg.type === 'webrtc') {
          signalListeners.current.forEach((handler) => handler(msg));
          return;
        }

        if (msg.type === 'call_event') {
          const current = activeCallRef.current;
          // Only react to the call we placed
          if (!current || (msg.call_id && msg.call_id !== current.callId)) return;
          if (msg.event === 'call_accepted') {
            setCallState('connected');
            setNotification('Patient accepted tele-consultation! Live video connected.');
            setTimeout(() => setNotification(null), 4000);
          } else if (msg.event === 'call_declined') {
            setCallState('declined');
            setNotification('Patient declined the call invitation.');
            setActiveCall(null);
            setTimeout(() => {
              setCallState('idle');
              setActiveTab('patient-chart');
              setNotification(null);
            }, 3000);
          } else if (msg.event === 'call_ended') {
            setActiveCall(null);
            setCallState('idle');
            setActiveTab('patient-chart');
            setNotification('Call terminated by patient.');
            setTimeout(() => setNotification(null), 3000);
          }
        } else if (msg.type === 'consent_granted' || msg.type === 'ABHA_LINK_APPROVED') {
          setNotification(`Consent Token GRANTED by ${msg.patient_name || 'Patient'} under DPDP Act!`);
          setTimeout(() => setNotification(null), 4000);
          setRecordsVersion((v) => v + 1);
        } else if (msg.type === 'ABHA_LINK_REJECTED') {
          setNotification('Patient declined the consent request.');
          setTimeout(() => setNotification(null), 4000);
        } else if (msg.type === 'queue_updated') {
          loadQueue();
        } else if (msg.type === 'recovery_checkin' && msg.status === 'worse') {
          setNotification(`⚠️ ${msg.patient_name || 'A patient'} reported feeling worse and needs help.`);
          setTimeout(() => setNotification(null), 6000);
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('Doctor WebSocket connection notice:', err);
    };

    return () => {
      ws.close();
    };
  }, [isAuthenticated]);

  const handleStartConsultation = (patient: PatientSummary) => {
    setSelectedPatient(patient);
    setCallState('calling');
    setActiveTab('active-consultation');
    setNotification(`Calling ${patient.full_name}... Ringing.`);

    const callId = `call_${Date.now()}`;
    setActiveCall({ callId, patientId: patient.patient_id });
    try {
      signaling.send({
        type: 'call_invitation',
        event: 'incoming_call',
        to: patient.patient_id,
        patient_id: patient.patient_id,
        patient_name: patient.full_name,
        doctor_name: doctor?.display_name || 'Your doctor',
        call_id: callId,
      });
    } catch (e) {
      console.warn('Error sending call invitation:', e);
    }
  };

  const handleEndConsultation = () => {
    setCallState('idle');
    setActiveTab('patient-chart');
    setNotification('Call ended. Camera & microphone disconnected.');
    setTimeout(() => setNotification(null), 3500);

    const current = activeCallRef.current;
    setActiveCall(null);
    if (current) {
      try {
        signaling.send({ type: 'call_event', event: 'call_ended', by: 'doctor', to: current.patientId, call_id: current.callId });
      } catch (e) {
        console.warn('Error sending call end:', e);
      }
    }
  };

  const handleRescheduleAppointment = async (apt: UpcomingAppointment): Promise<UpcomingAppointment> => {
    // Saved to the database; the backend notifies the patient app over WebSocket
    const saved = await api.updateAppointment(apt);
    const msg = `${t(selectedLanguage, 'rescheduleSuccessNotice')} (${saved.date} • ${saved.time})`;
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
    return saved;
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    const msg = t(lang, 'languageNotification');
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  if (!isAuthenticated) {
    return (
      <DoctorLoginView
        onLoginSuccess={(doc) => {
          setDoctor(doc);
          setIsAuthenticated(true);
        }}
        selectedLanguage={selectedLanguage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-base flex flex-col font-sans antialiased text-ink">
      {/* Top Clinical Header without Live Call in Navigation */}
      <DoctorHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        doctor={doctor}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={handleLanguageChange}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedPatientName={selectedPatient?.full_name}
        isCallActive={callState === 'calling' || callState === 'connected'}
        onReturnToCall={() => setActiveTab('active-consultation')}
        onLogout={logout}
      />

      {/* Real-time Dynamic Toast Banner (macOS Notification Style) */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 glass text-ink border border-ink/10 p-3 px-4 rounded-2xl shadow-lg flex items-center gap-2.5 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
          <Icon name="notification" size={18} tone="primary" weight="duotone" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Main Content Surfaces */}
      <main className="w-full pt-[84px] flex-1 flex flex-col pb-16">
        {activeTab !== 'audit-trail' && !selectedPatient && (
          <div className="w-full max-w-7xl mx-auto px-5 lg:px-8 py-16 flex flex-col items-center gap-3 text-center">
            <Icon
              name={queueStatus === 'error' ? 'offline' : queueStatus === 'loading' ? 'hourglass' : 'inbox'}
              size={40}
              tone="muted"
              weight="duotone"
            />
            <p className="text-sm font-semibold text-ink">
              {queueStatus === 'error'
                ? 'Could not load the patient queue. Is the backend running?'
                : queueStatus === 'loading'
                ? 'Loading patient queue…'
                : 'No patients are waiting right now.'}
            </p>
            {queueStatus === 'error' && (
              <button
                onClick={loadQueue}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {activeTab === 'patient-queue' && selectedPatient && (
          <PatientQueueView
            patients={patients}
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            onOpenPatientChart={(p) => {
              setSelectedPatient(p);
              setActiveTab('patient-chart');
            }}
            onStartConsultation={handleStartConsultation}
            searchQuery={searchQuery}
            selectedLanguage={selectedLanguage}
          />
        )}

        {/* Bigger Dedicated Page: Full Patient Medical Chart & Detailed History */}
        {activeTab === 'patient-chart' && selectedPatient && (
          <PatientMedicalChartView
            patient={selectedPatient}
            onBackToQueue={() => setActiveTab('patient-queue')}
            onStartConsultation={handleStartConsultation}
            onRequestConsent={() => setIsConsentModalOpen(true)}
            onViewClinicalRecords={() => setActiveTab('clinical-records')}
            selectedLanguage={selectedLanguage}
            onRescheduleAppointment={handleRescheduleAppointment}
          />
        )}

        {activeTab === 'active-consultation' && selectedPatient && (
          <ConsultationWorkspace
            patient={selectedPatient}
            doctorName={doctor?.display_name || ''}
            callState={callState}
            callId={activeCall?.callId ?? null}
            signaling={signaling}
            onStartCall={handleStartConsultation}
            onEndCall={handleEndConsultation}
            onConsultationSigned={loadQueue}
            onRequestRecordAccess={() => setIsConsentModalOpen(true)}
            onGoToQueue={() => setActiveTab('patient-chart')}
          />
        )}

        {activeTab === 'clinical-records' && selectedPatient && (
          <ClinicalRecordsView
            patient={selectedPatient}
            refreshKey={recordsVersion}
            onRequestConsent={() => setIsConsentModalOpen(true)}
            selectedLanguage={selectedLanguage}
          />
        )}

        {activeTab === 'audit-trail' && <AuditLedgerView />}
      </main>

      {/* Purpose-Bound Consent Modal */}
      <ConsentRequestModal
        patient={selectedPatient}
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onSuccess={() => {
          setNotification('Consent request dispatched to Patient mobile app via WebSocket!');
          setTimeout(() => setNotification(null), 5000);
        }}
      />

      {/* macOS Minimal Footer Strip */}
      <footer className="w-full bg-base py-3.5 border-t border-ink/5">
        <div className="w-full max-w-7xl mx-auto px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <span>Ayushman Bharat Digital Mission (ABDM) Level-3 Tele-Triage Node</span>
          </div>
          <div className="flex items-center gap-3">
            <span>DPDP Act 2023 Compliant</span>
            <span>•</span>
            <span>FHIR R4 Encrypted</span>
            <span>•</span>
            <span className="font-mono text-2xs">v2.4-AppleHIG</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
