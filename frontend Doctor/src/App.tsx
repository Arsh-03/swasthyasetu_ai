import { useState, useEffect, useCallback } from 'react';
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
import type { UpcomingAppointment } from './data/patientRecords';
import { Icon } from './components/ui/Icon';
import { useConsultationCall } from './services/call/useConsultationCall';
import { useDoctorLobby } from './services/call/useDoctorLobby';
import { ClinicalNotepad } from './components/ClinicalNotepad';
import { CallPanel } from './components/call/CallPanel';
import { CallWindow } from './components/call/CallWindow';
import { IncomingCallCard } from './components/call/CallOverlays';
import { RemoteAudio } from './components/call/RemoteAudio';


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

  // ---- Consultation call (real WebRTC call; state here so it keeps running on every tab) ----
  const [notepadText, setNotepadText] = useState('');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [lobbyAnswer, setLobbyAnswer] = useState<{ video: boolean } | null>(null);
  const [pendingStart, setPendingStart] = useState<{ encounterId: string; video: boolean } | null>(null);
  const clearLobbyAnswer = useCallback(() => setLobbyAnswer(null), []);
  const call = useConsultationCall({
    role: 'doctor',
    encounterId: isAuthenticated ? selectedPatient?.encounter_id ?? null : null,
    peerName: selectedPatient?.full_name || 'Patient',
    noteText: notepadText,
    autoAnswer: lobbyAnswer,
    onAutoAnswered: clearLobbyAnswer,
  });
  const lobby = useDoctorLobby(isAuthenticated);
  // A patient calling on a consultation that isn't the one open here (the open one rings by itself)
  const lobbyCall = lobby.ringing && lobby.ringing.encounterId !== selectedPatient?.encounter_id ? lobby.ringing : null;
  const inCall = call.callState === 'calling' || call.callState === 'in_call';
  const callState: 'idle' | 'calling' | 'connected' | 'declined' =
    call.callState === 'in_call' ? 'connected'
      : call.callState === 'calling' ? 'calling'
      : call.endReason === 'declined' || call.endReason === 'unavailable' || call.endReason === 'no_answer' ? 'declined'
      : 'idle';

  // Start a call once this patient's call room is connected (selecting a patient switches rooms).
  useEffect(() => {
    if (pendingStart && call.roomEncounterId === pendingStart.encounterId && call.callState === 'idle') {
      void call.startCall(pendingStart.video);
      setPendingStart(null);
    }
  }, [pendingStart, call]);

  // A call that connects (answered here or from another page) opens the consultation.
  const [wasInCall, setWasInCall] = useState(false);
  if (inCall !== wasInCall) {
    setWasInCall(inCall);
    if (call.callState === 'in_call') setActiveTab('active-consultation');
  }

  // WebSocket signaling & consent listener
  useEffect(() => {
    if (!isAuthenticated) return;

    const wsUrl = `${WS_BASE_URL}?role=doctor&session_id=doc_sess_${Date.now()}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // The server only delivers events to signed-in users, so identify first.
      ws.send(JSON.stringify({ type: 'AUTH', token: api.getToken() }));
      console.log('Doctor WebSocket signaling connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Doctor received WS message:', msg);

        if (msg.type === 'consent_granted' || msg.type === 'ABHA_LINK_APPROVED') {
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

  // Open the consultation and ring the patient's app (video, or audio only).
  const handleStartConsultation = (patient: PatientSummary, video = true) => {
    if (!patient.encounter_id) {
      setNotification(`${patient.full_name} has no open consultation to call into.`);
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setSelectedPatient(patient);
    setActiveTab('active-consultation');
    setPendingStart({ encounterId: patient.encounter_id, video });
  };

  // Hang up but stay on the consultation: the AI minutes (if on) are finished and added to the notes.
  const handleEndConsultation = () => {
    call.endCall();
    setNotification('Call ended. Camera & microphone disconnected.');
    setTimeout(() => setNotification(null), 3500);
  };

  // A patient calling from another consultation: open it and answer.
  const answerLobbyCall = async (video: boolean) => {
    if (!lobbyCall) return;
    const ringing = lobbyCall;
    lobby.clear();
    let patient = patients.find((p) => p.encounter_id === ringing.encounterId || p.patient_id === ringing.patientId);
    if (!patient) {
      try {
        const queue = await api.getQueue();
        setPatients(queue);
        patient = queue.find((p) => p.encounter_id === ringing.encounterId || p.patient_id === ringing.patientId);
      } catch { /* handled below */ }
    }
    if (!patient) {
      setNotification(`Could not open ${ringing.callerName}'s consultation.`);
      return;
    }
    setSelectedPatient({ ...patient, encounter_id: ringing.encounterId });
    setLobbyAnswer({ video });            // answered automatically once that consultation's room connects
    setActiveTab('active-consultation');
  };

  const notepad = selectedPatient?.encounter_id ? (
    <ClinicalNotepad
      key={selectedPatient.encounter_id}
      encounterId={selectedPatient.encounter_id}
      patientName={selectedPatient.full_name}
      callMinutes={call.minutes}
      autoApplyCall={call.aiState === 'recording' || call.aiState === 'finishing'}
      onTextChange={setNotepadText}
    />
  ) : null;

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
        isCallActive={inCall}
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
            callEndMessage={call.notice}
            onStartCall={handleStartConsultation}
            onEndCall={handleEndConsultation}
            onConsultationSigned={loadQueue}
            onRequestRecordAccess={() => setIsConsentModalOpen(true)}
            onGoToQueue={() => setActiveTab('patient-chart')}
            call={call}
            notepad={notepad}
            speakerOn={speakerOn}
            onToggleSpeaker={() => setSpeakerOn((v) => !v)}
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

      {/* The other person's voice: one audio element for the whole portal */}
      {inCall && <RemoteAudio stream={call.remoteStream} muted={!speakerOn} />}

      {/* In a call but looking at another tab: a small floating call window */}
      {inCall && activeTab !== 'active-consultation' && (
        <CallWindow call={call} title={`Consultation · ${selectedPatient?.full_name ?? ''}`} panel={<CallPanel call={call} compact hideStart />}>
          <button
            type="button"
            onClick={() => setActiveTab('active-consultation')}
            className="w-full py-2 rounded-xl bg-primary hover:bg-primary-deep text-white text-xs font-semibold cursor-pointer"
          >
            Back to the consultation (notes &amp; AI minutes)
          </button>
        </CallWindow>
      )}

      {/* Ringing: the open consultation's patient, or a patient from another consultation */}
      {call.callState === 'incoming' && call.incoming && (
        <IncomingCallCard
          callerName={call.incoming.callerName}
          video={call.incoming.video}
          onAccept={(video) => { setActiveTab('active-consultation'); void call.acceptCall(video); }}
          onDecline={call.declineCall}
        />
      )}
      {lobbyCall && call.callState !== 'incoming' && !inCall && (
        <IncomingCallCard
          callerName={lobbyCall.callerName}
          video={lobbyCall.video}
          onAccept={(video) => void answerLobbyCall(video)}
          onDecline={lobby.decline}
        />
      )}

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
