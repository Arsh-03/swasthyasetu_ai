import React, { useState, useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './src/theme/tokens';
import { FontsProvider } from './src/theme/FontsProvider';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
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
import { PatientTelehealthCall, type CallSignaling } from './src/components/PatientTelehealthCall';
import type { SignalMessage } from './src/services/rtc/callSession';
import { CarePlanView } from './src/components/CarePlanView';
import { WhoSawMyRecordsView } from './src/components/WhoSawMyRecordsView';
import { RecordsLockerView } from './src/components/RecordsLockerView';
import { SymptomIntakeModal } from './src/components/SymptomIntakeModal';
import { EmergencySOSModal } from './src/components/EmergencySOSModal';
import { PatientLoginView } from './src/components/PatientLoginView';
import { IncomingCallModal } from './src/components/IncomingCallModal';

type TabType = 'home' | 'careplan' | 'records' | 'whosaw';
type ScreenType = 'home' | 'call' | 'careplan' | 'whosaw' | 'records';
type IncomingCall = { caller: string; call_id: string; doctor_id: string };

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
        {/* Active language's fonts load first; on failure the app falls back to system fonts */}
        <FontsProvider fallback={<View style={styles.root} />}>
          <PatientApp />
        </FontsProvider>
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
  // Where the Privacy screen's back button should return to
  const [privacyBackTarget, setPrivacyBackTarget] = useState<'home' | 'records'>('home');
  const [isIntakeVisible, setIsIntakeVisible] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [incomingConsent, setIncomingConsent] = useState<ConsentRequestData | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  // The accepted call (null in the waiting room or when no call is on)
  const [activeCall, setActiveCall] = useState<{ callId: string; doctorId: string } | null>(null);
  // The socket handler is created once per login, so it reads these through refs
  const activeCallRef = useRef(activeCall);
  const currentScreenRef = useRef<ScreenType>(currentScreen);
  useEffect(() => {
    activeCallRef.current = activeCall;
    currentScreenRef.current = currentScreen;
  }, [activeCall, currentScreen]);
  // Socket lives in a ref: it's only used to send, never rendered
  const wsRef = useRef<WebSocket | null>(null);
  // WebRTC frames go to whichever call screen is listening
  const signalListeners = useRef(new Set<(msg: SignalMessage) => void>());
  const [signaling] = useState<CallSignaling>(() => ({
    send: (msg) => sendSignal(msg),
    subscribe: (handler) => {
      signalListeners.current.add(handler);
      return () => {
        signalListeners.current.delete(handler);
      };
    },
  }));
  function sendSignal(msg: Record<string, unknown>) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch (e) {
        console.warn('Error sending call frame:', e);
      }
    }
  }
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
  // Doctor on the current/last video call (from the call invitation)
  const [callDoctorName, setCallDoctorName] = useState<string | null>(null);
  // Dev on web: open with /#styleguide (used for headless visual checks)
  const [showStyleGuide, setShowStyleGuide] = useState(
    () => __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash === '#styleguide'
  );
  // Long-press on the brand mark opens the style guide in development builds only
  const openStyleGuide = StyleGuideScreen ? () => setShowStyleGuide(true) : undefined;

  const toAppointmentInfo = (apt: NextAppointment): PatientAppointmentInfo => ({
    date: apt.date,
    time: apt.time,
    relativeTime: apt.relativeTime,
    doctorName: apt.doctorName,
    facility: apt.facility,
    specialty: apt.specialty,
    agenda: apt.agenda,
    isRescheduled: apt.isRescheduled,
  });

  // Load the next appointment and any consent requests that arrived while offline
  useEffect(() => {
    if (!user) return;
    patientApi
      .getNextAppointment()
      .then((apt) => {
        setAppointmentInfo(apt ? toAppointmentInfo(apt) : undefined);
        setAppointmentStatus('ready');
      })
      .catch(() => {
        setAppointmentInfo(undefined);
        setAppointmentStatus('error');
      });
    patientApi
      .getPendingConsents()
      .then((pending) => {
        if (pending.length > 0) setIncomingConsent({ ...pending[0], status: 'PENDING' });
      })
      .catch(() => {});
  }, [user]);

  // WebSocket connection for real-time consent push alerts and telehealth events
  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(telehealthSocketUrl(patientApi.getToken()));
      socket.onopen = () => {
        // Connected to telehealth WebSocket
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const tr = tRef.current;
          // WebRTC signaling for the live call (routed to this patient by the backend)
          if (data.type === 'webrtc') {
            signalListeners.current.forEach((handler) => handler(data));
            return;
          }
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

          // When Doctor initiates call, show incoming call screen
          if (data.type === 'call_invitation' || data.event === 'incoming_call') {
            if (!data.from) return; // a call needs the doctor's id to send video back
            const invite: IncomingCall = {
              caller: data.doctor_name || '',
              call_id: data.call_id || 'call_' + Date.now(),
              doctor_id: data.from,
            };
            // Already waiting in the call room after sending symptoms: join straight away
            if (currentScreenRef.current === 'call' && !activeCallRef.current) {
              acceptCallRef.current(invite);
              return;
            }
            setIncomingCall(invite);
            showToast(tr('toastIncomingCall', { name: data.doctor_name || tr('yourDoctor') }), 'call');
          }

          // When Doctor ends the call, auto-transition patient to Care Plan
          if (data.event === 'call_ended' || data.type === 'call_ended') {
            const current = activeCallRef.current;
            if (data.call_id && current && data.call_id !== current.callId) return;
            setActiveCall(null);
            setIncomingCall(null);
            if (currentScreenRef.current === 'call') {
              setCurrentScreen('careplan');
              showToast(tr('toastCallEnded'), 'success');
            }
          }

          // When Doctor reschedules next appointment, update in real-time
          if (
            (data.type === 'appointment_event' &&
              (data.event === 'appointment_rescheduled' || data.type === 'appointment_rescheduled')) ||
            data.event === 'appointment_rescheduled'
          ) {
            setAppointmentInfo((prev) => ({
              ...prev,
              date: data.date,
              time: data.time,
              relativeTime: data.relativeTime || 'Rescheduled',
              doctorName: data.doctor_name || prev?.doctorName,
              facility: data.facility || prev?.facility,
              specialty: data.facility ? data.specialty : prev?.specialty,
              agenda: data.agenda || prev?.agenda,
              isRescheduled: true,
            }));
            showToast(tr('toastRescheduled', { date: formatDateLabel(data.date, langRef.current), time: data.time }), 'calendar');
          }
        } catch {
          // ignore non-json
        }
      };
      wsRef.current = socket;
    } catch {
      // WS fallback
    }

    return () => {
      if (socket) socket.close();
      wsRef.current = null;
    };
  }, [user]);

  const errorText = (err: unknown) => (err instanceof Error ? err.message : t('networkError'));

  const acceptCall = (invite: IncomingCall) => {
    sendSignal({
      type: 'call_event',
      event: 'call_accepted',
      to: invite.doctor_id,
      call_id: invite.call_id,
      patient_id: user?.user_id,
      patient_name: user?.full_name,
    });
    setCallDoctorName(invite.caller || null);
    setActiveCall({ callId: invite.call_id, doctorId: invite.doctor_id });
    setIncomingCall(null);
    setCurrentScreen('call');
    showToast(t('toastCallConnected'), 'call');
  };
  // The socket handler is created once per login, so it calls the latest version through a ref
  const acceptCallRef = useRef(acceptCall);
  useEffect(() => {
    acceptCallRef.current = acceptCall;
  });

  const handleAcceptCall = () => {
    if (incomingCall) acceptCall(incomingCall);
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      sendSignal({
        type: 'call_event',
        event: 'call_declined',
        to: incomingCall.doctor_id,
        call_id: incomingCall.call_id,
        patient_id: user?.user_id,
        patient_name: user?.full_name,
      });
    }
    setIncomingCall(null);
    showToast(t('toastCallDeclined'));
  };

  // Patient hangs up: tell the doctor, then show the care plan
  const handleEndCall = () => {
    const current = activeCallRef.current;
    if (current) {
      sendSignal({ type: 'call_event', event: 'call_ended', by: 'patient', to: current.doctorId, call_id: current.callId });
    }
    setActiveCall(null);
    setCurrentScreen('careplan');
  };

  // The backend saves the grant and notifies the doctor portal over WebSocket
  const handleApproveConsent = async (otp: string) => {
    if (!incomingConsent) return;
    try {
      await patientApi.approveConsent(incomingConsent.consent_id, otp);
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

  // Live video call (immersive)
  if (currentScreen === 'call') {
    return (
      <View style={styles.fullscreen}>
        <StatusBar style="light" />
        <PatientTelehealthCall
          doctorName={callDoctorName || appointmentInfo?.doctorName || t('yourDoctor')}
          call={activeCall}
          signaling={signaling}
          onEndCall={handleEndCall}
        />
        {consentGate}
        <Toast message={toastMessage} />
      </View>
    );
  }

  const activeTab: TabType =
    currentScreen === 'home'
      ? 'home'
      : currentScreen === 'careplan'
      ? 'careplan'
      : currentScreen === 'records'
      ? 'records'
      : 'whosaw';

  const tabs: GlassTab<TabType>[] = [
    { key: 'home', label: t('tabToday'), icon: 'home' },
    { key: 'careplan', label: t('tabMedications'), icon: 'medication' },
    { key: 'records', label: t('tabRecords'), icon: 'records' },
    { key: 'whosaw', label: t('tabPrivacy'), icon: 'shieldCheck' },
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
                onOpenProfile={() => setIsIntakeVisible(true)}
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
                  if (key === 'whosaw') setPrivacyBackTarget('home');
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
              onJoinCall={() => setIsIntakeVisible(true)}
              onOpenDoctors={() => setIsIntakeVisible(true)}
              onOpenRecords={() => setCurrentScreen('records')}
              onOpenMedicines={() => setCurrentScreen('careplan')}
              onOpenFollowUp={() => setCurrentScreen('careplan')}
              onTriggerEmergency={() => setIsEmergencyVisible(true)}
            />
          )}

          {currentScreen === 'careplan' && <CarePlanView onBack={() => setCurrentScreen('home')} />}

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

      {/* Pre-consultation symptom intake */}
      <SymptomIntakeModal
        visible={isIntakeVisible}
        onClose={() => setIsIntakeVisible(false)}
        onSubmit={async (symptoms, isRep, notes) => {
          try {
            await patientApi.submitIntake(symptoms, notes || '', isRep);
          } catch (err) {
            showToast(t('toastCouldNotSendSymptoms', { error: errorText(err) }), 'error');
            return;
          }
          setIsIntakeVisible(false);
          showToast(t('toastTriageComplete'), 'call');
          setTimeout(() => {
            setCurrentScreen('call');
          }, 400);
        }}
      />

      {/* DPDP consent gate (incoming doctor request) */}
      {consentGate}

      {/* Emergency medical SOS */}
      <EmergencySOSModal visible={isEmergencyVisible} onClose={() => setIsEmergencyVisible(false)} />

      {/* Incoming video call */}
      <IncomingCallModal
        visible={incomingCall !== null}
        callerName={incomingCall?.caller || t('yourDoctor')}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />

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
