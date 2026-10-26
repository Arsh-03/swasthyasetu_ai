import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './src/theme/tokens';
import { FontsProvider } from './src/theme/FontsProvider';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { SpeechProvider } from './src/i18n/SpeechContext';
import {
  patientApi,
  telehealthSocketUrl,
  PatientUser,
  ConsentRequestData,
  NextAppointment,
} from './src/services/api';
import { BlurTargetProvider, GlassTabBar, tabBarChromeHeight, TOOLBAR_HEIGHT, type GlassTab } from './src/components/glass';
import { ChromeInsetsProvider, Toast, type ToastMessage, type ToastTone } from './src/components/ui';
import { AmbientBackground } from './src/components/illustrations';
import { PatientHeader } from './src/components/PatientHeader';
import { HomeView } from './src/components/HomeView';
import { type AppointmentStatus, type PatientAppointmentInfo } from './src/components/HeroAppointmentCard';
import { formatDateLabel } from './src/utils/dates';
import { ConsentGateModal } from './src/components/ConsentGateModal';
import { PatientTelehealthCall } from './src/components/PatientTelehealthCall';
import { CarePlanView } from './src/components/CarePlanView';
import { ChatView } from './src/components/ChatView';
import { HeartRateView } from './src/components/HeartRateView';
import { SummaryOfferSheet } from './src/components/VisitSummary';
import { AshaApp } from './src/components/AshaApp';
import { MeetingJoinView } from './src/components/MeetingJoinView';
import { ChibiButton, type ChibiSkill } from './src/components/chibi/Chibi';
import { WhoSawMyRecordsView } from './src/components/WhoSawMyRecordsView';
import { RecordsLockerView } from './src/components/RecordsLockerView';
import { SymptomIntakeModal } from './src/components/SymptomIntakeModal';
import { EmergencySOSModal } from './src/components/EmergencySOSModal';
import { PatientLoginView } from './src/components/PatientLoginView';
import { IncomingCallModal } from './src/components/IncomingCallModal';
import { RecordingConsentSheet } from './src/components/RecordingConsentSheet';
import { RemoteAudio } from './src/components/RemoteAudio';
import { MyDoctorsView, type MyDoctorsTab } from './src/components/doctors/MyDoctorsView';
import { DoctorDetailView } from './src/components/doctors/DoctorDetailView';
import { AddDoctorFlow } from './src/components/doctors/AddDoctorFlow';
import { doctorShortName } from './src/utils/departments';
import { useConsultationCall } from './src/services/call/useConsultationCall';
import { enableWebRTC } from './src/services/webrtcPlatform';

/** Real calls: the browser's WebRTC on the web; react-native-webrtc in a development build on phones.
 *  (Expo Go doesn't include react-native-webrtc, so there the app explains where calls work.) */
const CALLS_SUPPORTED = enableWebRTC();

type TabType = 'home' | 'careplan' | 'chat' | 'records' | 'doctors';
// doctors = My Doctors tab · doctor = one doctor's page · addDoctor = add a doctor / book a visit
type ScreenType = 'home' | 'call' | 'careplan' | 'chat' | 'heartrate' | 'whosaw' | 'records' | 'doctors' | 'doctor' | 'addDoctor' | 'join';

// Dev-only design reference. A conditional require (folded away when __DEV__ is false)
// keeps it out of production bundles, which a static import would not.
const StyleGuideScreen: React.FC<{ onClose: () => void }> | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./src/dev/StyleGuideScreen').StyleGuideScreen
  : null;

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SpeechProvider>
          {/* Active language's fonts load first; on failure the app falls back to system fonts */}
          <FontsProvider fallback={<View style={styles.root} />}>
            <PatientApp />
          </FontsProvider>
        </SpeechProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function PatientApp() {
  const insets = useSafeAreaInsets();
  const { lang, t, applyProfileLanguage } = useLanguage();
  // The WebSocket handler is created once per login, so read translations through refs
  const tRef = useRef(t);
  const langRef = useRef(lang);
  useEffect(() => {
    tRef.current = t;
    langRef.current = lang;
  }, [t, lang]);
  const [user, setUser] = useState<PatientUser | null>(() => patientApi.getCurrentUser());
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const screenRef = useRef<ScreenType>('home');
  screenRef.current = currentScreen;
  // Chat with the doctor: unread badge, and a counter bumped on every live chat event
  const [chatUnread, setChatUnread] = useState(0);
  // A visit summary offered after a call with AI minutes (kept only if the patient says yes)
  const [summaryOffer, setSummaryOffer] = useState<string | null>(null);
  const [summariesKey, setSummariesKey] = useState(0);
  const [chatEvent, setChatEvent] = useState(0);
  const refreshChatUnread = useCallback(() => {
    patientApi.getChatUnread().then((r) => setChatUnread(r.count)).catch(() => undefined);
  }, []);
  // Where the Privacy screen's back button should return to
  const [privacyBackTarget, setPrivacyBackTarget] = useState<'home' | 'records'>('home');
  // ---- My Doctors: several doctors, one per health issue ----
  const [doctorsTab, setDoctorsTab] = useState<MyDoctorsTab>('doctors');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [bookDoctorId, setBookDoctorId] = useState<string | null>(null);
  // Chat opened from a doctor's card goes straight to that conversation and back to where it came from
  const [chatDoctorId, setChatDoctorId] = useState<string | null>(null);
  const [chatBack, setChatBack] = useState<ScreenType>('home');
  // Bumped whenever appointments change, so the My Doctors screens reload
  const [careKey, setCareKey] = useState(0);
  // Which doctor a "video visit now" request goes to (null = the general triage queue)
  const [intakeDoctor, setIntakeDoctor] = useState<{ id: string | null; name: string } | null>(null);
  const [otherUpcoming, setOtherUpcoming] = useState<NextAppointment[]>([]);
  const [isIntakeVisible, setIsIntakeVisible] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [incomingConsent, setIncomingConsent] = useState<ConsentRequestData | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string, tone: ToastTone = 'info') => {
    setToastMessage({ text, tone });
    // Restart the timer so a newer toast is not hidden early by an older one
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  };
  const [appointmentInfo, setAppointmentInfo] = useState<PatientAppointmentInfo | undefined>(undefined);
  // Display-only: lets the Today card tell loading / none / failed apart
  const [appointmentStatus, setAppointmentStatus] = useState<AppointmentStatus>('loading');
  // ---- Consultation call (real WebRTC call with the doctor) ----
  const [callRoom, setCallRoom] = useState<{ encounter_id: string; doctor_name?: string } | null>(null);
  // Meeting link (web: ?join=<code>) or the next appointment's meeting
  const [joinCode, setJoinCode] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' && window.location?.search ? new URLSearchParams(window.location.search).get('join') : null;
    } catch {
      return null;
    }
  });
  const [pendingCallStart, setPendingCallStart] = useState(false);
  const call = useConsultationCall({
    role: 'patient',
    encounterId: user && user.role !== 'asha' && CALLS_SUPPORTED ? callRoom?.encounter_id ?? null : null,
    peerName: callRoom?.doctor_name || appointmentInfo?.doctorName || t('yourDoctor'),
  });
  const inCall = call.callState === 'calling' || call.callState === 'in_call';
  const callDoctorName = callRoom?.doctor_name || appointmentInfo?.doctorName || t('yourDoctor');

  const refreshCallRoom = async (doctorId?: string | null) => {
    try {
      const room = await patientApi.getActiveEncounter(doctorId);
      setCallRoom(room.encounter_id ? { encounter_id: room.encounter_id, doctor_name: room.doctor_name } : null);
      return room.encounter_id ? room : null;
    } catch {
      return null;
    }
  };

  // Start the patient's call once their consultation's call room is connected.
  useEffect(() => {
    if (pendingCallStart && callRoom && call.roomEncounterId === callRoom.encounter_id && call.callState === 'idle') {
      void call.startCall(true);
      setPendingCallStart(false);
    }
  }, [pendingCallStart, callRoom, call]);

  // When a call ends, say why; after a consultation, go to the care plan (as before).
  useEffect(() => {
    const name = callDoctorName;
    const reason = call.endReason;
    if (!reason || inCall) return;
    if (reason === 'ended') {
      setCurrentScreen('careplan');
      showToast(t('toastCallEnded'), 'success');
    } else if (reason === 'declined') showToast(t('toastDoctorDeclined', { name }), 'warning');
    else if (reason === 'unavailable') showToast(t('toastDoctorOffline', { name }), 'warning');
    else if (reason === 'no_answer') showToast(t('toastNoAnswer', { name }), 'warning');
    else if (reason === 'missed') showToast(t('toastMissedCall', { name }), 'call');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.endReason, inCall]);
  // Dev on web: open with /#styleguide (used for headless visual checks)
  const [showStyleGuide, setShowStyleGuide] = useState(
    () => __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash === '#styleguide'
  );
  // Long-press on the brand mark opens the style guide in development builds only
  const openStyleGuide = StyleGuideScreen ? () => setShowStyleGuide(true) : undefined;

  useEffect(() => {
    if (user && user.role !== 'asha' && joinCode && currentScreen === 'home') setCurrentScreen('join');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toAppointmentInfo = (apt: NextAppointment): PatientAppointmentInfo => ({
    date: apt.date,
    time: apt.time,
    relativeTime: apt.relativeTime,
    doctorName: apt.doctorName,
    facility: apt.facility,
    specialty: apt.specialty,
    agenda: apt.agenda,
    isRescheduled: apt.isRescheduled,
    meetingCode: apt.meetingCode,
    practitionerId: apt.practitionerId,
    department: apt.department,
    mode: apt.mode,
  });

  // Soonest appointment with any doctor for the Today card; the rest go under "Other upcoming"
  const loadAppointments = useCallback(() => {
    patientApi
      .getNextAppointment()
      .then((apt) => {
        setAppointmentInfo(apt ? toAppointmentInfo(apt) : undefined);
        setAppointmentStatus('ready');
        return patientApi
          .getMyAppointments()
          .then((all) => setOtherUpcoming(all.upcoming.filter((a) => a.appointmentId !== apt?.appointmentId)));
      })
      .catch(() => {
        setAppointmentInfo(undefined);
        setAppointmentStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const appointmentsChanged = useCallback(() => {
    loadAppointments();
    setCareKey((k) => k + 1);
  }, [loadAppointments]);

  const openIntake = (doctor: { id: string | null; name: string } | null) => {
    setIntakeDoctor(doctor);
    setIsIntakeVisible(true);
  };
  const openChat = (doctorId: string | null, back: ScreenType) => {
    setChatDoctorId(doctorId);
    setChatBack(back);
    setCurrentScreen('chat');
  };

  // Load the next appointment and any consent requests that arrived while offline
  useEffect(() => {
    if (!user || user.role === 'asha') return;   // ASHA workers have their own home
    loadAppointments();
    patientApi
      .getPendingConsents()
      .then((pending) => {
        if (pending.length > 0) setIncomingConsent({ ...pending[0], status: 'PENDING' });
      })
      .catch(() => {});
    void refreshCallRoom();
    refreshChatUnread();
    patientApi.getPendingSummaries().then((p) => { if (p.length) setSummaryOffer(p[0].summary_id); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // WebSocket connection for real-time consent push alerts and telehealth events
  useEffect(() => {
    if (!user || user.role === 'asha') return;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(telehealthSocketUrl(patientApi.getToken()));
      socket.onopen = () => {
        // The server only delivers events to signed-in users, so identify first.
        socket?.send(JSON.stringify({ type: 'AUTH', token: patientApi.getToken() }));
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const tr = tRef.current;
          // Events are broadcast to every client; only handle the ones for this patient
          if (data.patient_id && data.patient_id !== user.user_id) return;
          // When Doctor requests consent, open modal immediately
          if (data.type === 'consent_request' || data.event === 'consent_request') {
            if (!data.consent_id) return;
            setIncomingConsent({
              consent_id: data.consent_id,
              patient_id: data.patient_id,
              practitioner_name: data.practitioner_name || '',
              practitioner_reg: data.practitioner_reg || '',
              record_title: data.record_title || '',
              clinical_purpose: data.clinical_purpose || '',
              duration_minutes: data.duration_minutes || 60,
              status: 'PENDING',
            });
            showToast(tr('toastConsentRequest', { name: data.practitioner_name || tr('yourDoctor') }), 'warning');
          }

          // After a call with AI minutes: offer a summary of the visit.
          if (data.type === 'SUMMARY_OFFER' && data.summary_id) setSummaryOffer(String(data.summary_id));

          // Chat: a new message or a read receipt.
          if (data.type === 'chat_message' || data.type === 'chat_read') {
            setChatEvent((v) => v + 1);
            if (data.type === 'chat_message' && data.sender === 'doctor') {
              if (screenRef.current === 'chat') refreshChatUnread();
              else {
                setChatUnread((u) => u + 1);
                showToast(tr('toastDoctorMessage'), 'info');
              }
            }
          }

          // The doctor opened a meeting room for a new consultation: join its call room.
          if (data.type === 'call_room_ready') {
            if (data.encounter_id) setCallRoom({ encounter_id: String(data.encounter_id), doctor_name: data.doctor_name });
            else void refreshCallRoom();
          }

          // Any appointment change with any of the patient's doctors (booked, moved, cancelled): reload them all
          if (data.type === 'appointment_event' || data.event === 'appointment_rescheduled') {
            appointmentsChanged();
            const name = data.doctor_name ? doctorShortName(String(data.doctor_name)) : tr('yourDoctor');
            if (data.event === 'appointment_rescheduled' && data.visit_status === 'cancelled') {
              showToast(tr('toastDoctorCancelled', { name }), 'warning');
            } else if (data.event === 'appointment_rescheduled' && data.date) {
              showToast(tr('toastRescheduledBy', { name, date: formatDateLabel(data.date, langRef.current), time: data.time }), 'calendar');
            }
          }
        } catch {
          // ignore non-json
        }
      };
    } catch {
      // WS fallback
    }

    return () => {
      if (socket) socket.close();
    };
  }, [user]);

  const errorText = (err: unknown) => (err instanceof Error ? err.message : t('networkError'));

  // The backend saves the grant and notifies the doctor portal over WebSocket
  const handleApproveConsent = async () => {
    if (!incomingConsent) return;
    try {
      await patientApi.approveConsent(incomingConsent.consent_id);
      setIncomingConsent(null);
      showToast(t('toastConsentApproved', { minutes: incomingConsent.duration_minutes }), 'success');
    } catch (err) {
      showToast(t('toastCouldNotApprove', { error: errorText(err) }), 'error');
    }
  };

  const handleDeclineConsent = async () => {
    if (!incomingConsent) return;
    try {
      await patientApi.declineConsent(incomingConsent.consent_id);
      setIncomingConsent(null);
      showToast(t('toastConsentDeclined'));
    } catch (err) {
      showToast(t('toastCouldNotDecline', { error: errorText(err) }), 'error');
    }
  };

  const consentGate = (
    <ConsentGateModal
      key={incomingConsent?.consent_id ?? 'none'}
      visible={incomingConsent !== null}
      request={incomingConsent}
      onApprove={handleApproveConsent}
      onDecline={handleDeclineConsent}
    />
  );

  const callOverlays = (
    <>
      {/* The doctor's voice (one player for the whole app) */}
      {inCall && <RemoteAudio stream={call.remoteStream} />}
      {/* "Quick AI minutes": the doctor asks to record the audio; the patient decides */}
      <RecordingConsentSheet
        key={call.consentRequest?.session_id ?? 'none'}
        visible={call.consentRequest !== null}
        doctorName={call.consentRequest?.doctor_name || callDoctorName}
        language={lang}
        onRespond={call.respondConsent}
      />
    </>
  );

  if (showStyleGuide && StyleGuideScreen) {
    return <StyleGuideScreen onClose={() => setShowStyleGuide(false)} />;
  }

  // Not logged in: ABHA sign-in screen
  if (!user) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <AmbientBackground />
        <PatientLoginView
          onBrandLongPress={openStyleGuide}
          onLoginSuccess={(loggedInUser) => {
            setAppointmentStatus('loading');
            setUser(loggedInUser);
            if (loggedInUser.preferred_language) {
              applyProfileLanguage(loggedInUser.preferred_language);
            }
          }}
        />
      </View>
    );
  }

  // ASHA (community health worker) signed in: her own screens
  if (user.role === 'asha') {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <AshaApp
          user={user}
          onLogout={() => {
            patientApi.clearToken();
            setUser(null);
          }}
        />
        <Toast message={toastMessage} />
      </View>
    );
  }

  // Live call (immersive) while calling or connected
  if (inCall) {
    return (
      <View style={styles.fullscreen}>
        <StatusBar style="light" />
        <PatientTelehealthCall call={call} doctorName={callDoctorName} onEndCall={() => undefined} />
        {callOverlays}
        {consentGate}
        <Toast message={toastMessage} />
      </View>
    );
  }

  const activeTab: TabType =
    currentScreen === 'careplan'
      ? 'careplan'
      : currentScreen === 'records' || (currentScreen === 'whosaw' && privacyBackTarget === 'records')
      ? 'records'
      : currentScreen === 'chat'
      ? 'chat'
      : currentScreen === 'doctors' || currentScreen === 'doctor' || currentScreen === 'addDoctor'
      ? 'doctors'
      : 'home';

  const tabs: GlassTab<TabType>[] = [
    { key: 'home', label: t('tabToday'), icon: 'home' },
    { key: 'careplan', label: t('tabMedications'), icon: 'medication' },
    { key: 'chat', label: t('tabChat'), icon: 'chat', badge: chatUnread },
    { key: 'records', label: t('tabRecords'), icon: 'records' },
    { key: 'doctors', label: t('tabDoctors'), icon: 'doctor' },
  ];

  const chromeInsets = {
    top: insets.top + TOOLBAR_HEIGHT,
    bottom: tabBarChromeHeight(insets.bottom),
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ChromeInsetsProvider value={chromeInsets}>
        <BlurTargetProvider
          style={styles.root}
          overlay={
            <>
              <PatientHeader
                user={user}
                onBrandLongPress={openStyleGuide}
                onOpenProfile={() => openIntake(null)}
                onLogout={() => {
                  patientApi.clearToken();
                  setUser(null);
                  setCurrentScreen('home');
                }}
              />
              <GlassTabBar
                tabs={tabs}
                activeKey={activeTab}
                onChange={(key) => {
                  if (key === 'chat') {
                    setChatDoctorId(null);
                    setChatBack('home');
                  }
                  if (key === 'doctors') setDoctorsTab('doctors');
                  setCurrentScreen(key);
                }}
              />
            </>
          }
        >
          {/* Inside the blur target so the Android glass bars blur it too */}
          <AmbientBackground />
          {currentScreen === 'home' && (
            <HomeView
              user={user}
              appointment={appointmentInfo}
              appointmentStatus={appointmentStatus}
              onJoinCall={() => {
                // A scheduled meeting: join like Google Meet (waiting room). Otherwise: symptom intake + call.
                if (appointmentInfo?.meetingCode) {
                  setJoinCode(appointmentInfo.meetingCode);
                  setCurrentScreen('join');
                } else {
                  openIntake(
                    appointmentInfo?.practitionerId
                      ? { id: appointmentInfo.practitionerId, name: appointmentInfo.doctorName || t('yourDoctor') }
                      : null
                  );
                }
              }}
              onOpenDoctors={() => {
                setDoctorsTab('doctors');
                setCurrentScreen('doctors');
              }}
              onOpenRecords={() => setCurrentScreen('records')}
              onOpenMedicines={() => setCurrentScreen('careplan')}
              onOpenPrivacy={() => {
                setPrivacyBackTarget('home');
                setCurrentScreen('whosaw');
              }}
              onOpenHeartRate={() => setCurrentScreen('heartrate')}
              onOpenChat={() => openChat(null, 'home')}
              onTriggerEmergency={() => setIsEmergencyVisible(true)}
              otherUpcoming={otherUpcoming}
              onOpenSchedule={() => {
                setDoctorsTab('schedule');
                setCurrentScreen('doctors');
              }}
            />
          )}

          {currentScreen === 'doctors' && (
            <MyDoctorsView
              key={doctorsTab}
              initialTab={doctorsTab}
              refreshKey={careKey}
              onOpenDoctor={(id) => {
                setSelectedDoctorId(id);
                setCurrentScreen('doctor');
              }}
              onAddDoctor={() => {
                setBookDoctorId(null);
                setCurrentScreen('addDoctor');
              }}
              onBook={(id) => {
                setBookDoctorId(id);
                setCurrentScreen('addDoctor');
              }}
              onChat={(id) => openChat(id, 'doctors')}
              onChanged={appointmentsChanged}
              onNotice={showToast}
            />
          )}

          {currentScreen === 'doctor' && selectedDoctorId && (
            <DoctorDetailView
              practitionerId={selectedDoctorId}
              refreshKey={careKey}
              onBack={() => setCurrentScreen('doctors')}
              onBook={() => {
                setBookDoctorId(selectedDoctorId);
                setCurrentScreen('addDoctor');
              }}
              onChat={() => openChat(selectedDoctorId, 'doctor')}
              onRequestVisit={(name) => openIntake({ id: selectedDoctorId, name })}
              onChanged={appointmentsChanged}
              onRemoved={() => {
                appointmentsChanged();
                setCurrentScreen('doctors');
              }}
              onNotice={showToast}
            />
          )}

          {currentScreen === 'addDoctor' && (
            <AddDoctorFlow
              key={bookDoctorId ?? 'new'}
              initialDoctorId={bookDoctorId}
              onExit={() => setCurrentScreen(bookDoctorId && selectedDoctorId === bookDoctorId ? 'doctor' : 'doctors')}
              onBooked={appointmentsChanged}
              onOpenDoctor={(id) => {
                setSelectedDoctorId(id);
                setCurrentScreen('doctor');
              }}
            />
          )}

          {currentScreen === 'careplan' && <CarePlanView onBack={() => setCurrentScreen('home')} summariesKey={summariesKey} />}

          {currentScreen === 'join' && (
            <MeetingJoinView
              code={joinCode}
              call={call}
              callRoomEncounterId={callRoom?.encounter_id ?? null}
              onRoom={setCallRoom}
              onBack={() => setCurrentScreen('home')}
              onRequestCall={() => { setCurrentScreen('home'); setIsIntakeVisible(true); }}
            />
          )}

          {currentScreen === 'heartrate' && (
            <HeartRateView onBack={() => setCurrentScreen('home')} onMessageDoctor={() => setCurrentScreen('chat')} />
          )}

          {currentScreen === 'chat' && (
            <ChatView
              key={chatDoctorId ?? 'all'}
              initialDoctorId={chatDoctorId}
              backLabel={chatBack === 'doctors' || chatBack === 'doctor' ? t('myDoctors') : t('home')}
              onBack={() => setCurrentScreen(chatBack)}
              chatEvent={chatEvent}
              onEmergency={() => setIsEmergencyVisible(true)}
              onRequestVisit={() => {
                setDoctorsTab('doctors');
                setCurrentScreen('doctors');
              }}
              onUnreadChanged={refreshChatUnread}
            />
          )}

          {currentScreen === 'records' && (
            <RecordsLockerView
              patientId={user.user_id}
              onBack={() => setCurrentScreen('home')}
              onOpenAudit={() => {
                setPrivacyBackTarget('records');
                setCurrentScreen('whosaw');
              }}
            />
          )}

          {currentScreen === 'whosaw' && (
            <WhoSawMyRecordsView
              onBack={() => setCurrentScreen(privacyBackTarget)}
              backLabel={privacyBackTarget === 'records' ? t('tabRecords') : t('home')}
              onRevoked={(doctor) => showToast(t('accessRevoked', { name: doctor }), 'success')}
            />
          )}
        </BlurTargetProvider>
      </ChromeInsetsProvider>

      {/* CHIBI: the assistant in the corner, with what it can do right now */}
      {!isIntakeVisible && (
        <ChibiButton
          bottom={tabBarChromeHeight(insets.bottom) + 12}
          skills={[
            ...(appointmentInfo?.meetingCode ? [{ id: 'join', label: t('chibiJoin'), icon: 'video', run: () => { setJoinCode(appointmentInfo.meetingCode ?? null); setCurrentScreen('join'); } } as ChibiSkill] : []),
            { id: 'heart', label: t('chibiHeart'), icon: 'heartbeat', run: () => setCurrentScreen('heartrate') },
            { id: 'meds', label: t('chibiMeds'), icon: 'medication', run: () => setCurrentScreen('careplan') },
            { id: 'chat', label: t('chibiChat'), icon: 'chat', run: () => setCurrentScreen('chat') },
            { id: 'privacy', label: t('chibiPrivacy'), icon: 'shieldCheck', run: () => { setPrivacyBackTarget('home'); setCurrentScreen('whosaw'); } },
          ]}
        />
      )}

      {/* Pre-consultation symptom intake */}
      <SymptomIntakeModal
        visible={isIntakeVisible}
        doctorName={intakeDoctor ? doctorShortName(intakeDoctor.name) : null}
        onClose={() => setIsIntakeVisible(false)}
        onSubmit={async (symptoms, isRep, notes) => {
          const doctorId = intakeDoctor?.id ?? null;
          try {
            await patientApi.submitIntake(symptoms, notes || '', isRep, doctorId);
          } catch (err) {
            showToast(t('toastCouldNotSendSymptoms', { error: errorText(err) }), 'error');
            return;
          }
          setIsIntakeVisible(false);
          if (!CALLS_SUPPORTED) {
            showToast(t('callWebOnly'), 'info');
            return;
          }
          showToast(t('toastTriageComplete'), 'call');
          if (await refreshCallRoom(doctorId)) setPendingCallStart(true);
        }}
      />

      {/* Visit summary offer after a consultation */}
      <SummaryOfferSheet
        summaryId={summaryOffer}
        onDone={(saved) => {
          setSummaryOffer(null);
          if (saved) setSummariesKey((k) => k + 1);
        }}
      />

      {/* DPDP consent gate (incoming doctor request) */}
      {consentGate}

      {/* Emergency medical SOS */}
      <EmergencySOSModal visible={isEmergencyVisible} onClose={() => setIsEmergencyVisible(false)} />

      {/* Incoming call from the doctor */}
      <IncomingCallModal
        visible={call.callState === 'incoming'}
        callerName={call.incoming?.callerName || callDoctorName}
        video={call.incoming?.video ?? true}
        onAccept={() => void call.acceptCall(true)}
        onAcceptAudio={() => void call.acceptCall(false)}
        onDecline={call.declineCall}
      />
      {callOverlays}

      <Toast message={toastMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.base,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.night,
  },
});
