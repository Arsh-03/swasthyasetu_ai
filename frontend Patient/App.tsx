import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './src/theme/tokens';
import { FONT_MAP } from './src/theme/fonts';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import {
  patientApi,
  WS_BASE_URL,
  PatientUser,
  ConsentRequestData,
  NextAppointment,
} from './src/services/api';
import { BlurTargetProvider, GlassTabBar, TAB_BAR_HEIGHT, TOOLBAR_HEIGHT, type GlassTab } from './src/components/glass';
import { ChromeInsetsProvider, Toast, type ToastMessage, type ToastTone } from './src/components/ui';
import { PatientHeader } from './src/components/PatientHeader';
import { HomeView } from './src/components/HomeView';
import { type PatientAppointmentInfo } from './src/components/HeroAppointmentCard';
import { ConsentGateModal } from './src/components/ConsentGateModal';
import { PatientTelehealthCall } from './src/components/PatientTelehealthCall';
import { CarePlanView } from './src/components/CarePlanView';
import { WhoSawMyRecordsView } from './src/components/WhoSawMyRecordsView';
import { RecordsLockerView } from './src/components/RecordsLockerView';
import { SymptomIntakeModal } from './src/components/SymptomIntakeModal';
import { EmergencySOSModal } from './src/components/EmergencySOSModal';
import { PatientLoginView } from './src/components/PatientLoginView';
import { IncomingCallModal } from './src/components/IncomingCallModal';

type TabType = 'home' | 'careplan' | 'records' | 'whosaw';
type ScreenType = 'home' | 'call' | 'careplan' | 'whosaw' | 'records';

export default function App() {
  // Fall back to system fonts if loading fails rather than blocking the app
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        {fontsLoaded || fontError ? <PatientApp /> : <View style={styles.root} />}
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function PatientApp() {
  const insets = useSafeAreaInsets();
  const { t, applyProfileLanguage } = useLanguage();
  // The WebSocket handler is created once per login, so read translations through a ref
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [user, setUser] = useState<PatientUser | null>(() => patientApi.getCurrentUser());
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  // Where the Privacy screen's back button should return to
  const [privacyBackTarget, setPrivacyBackTarget] = useState<'home' | 'records'>('home');
  const [isIntakeVisible, setIsIntakeVisible] = useState(false);
  const [isEmergencyVisible, setIsEmergencyVisible] = useState(false);
  const [incomingConsent, setIncomingConsent] = useState<ConsentRequestData | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    caller: string;
    patient_id: string;
    call_id: string;
  } | null>(null);
  // Socket lives in a ref: it's only used to send, never rendered
  const wsRef = useRef<WebSocket | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string, tone: ToastTone = 'info') => {
    setToastMessage({ text, tone });
    // Restart the timer so a newer toast is not hidden early by an older one
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  };
  const [appointmentInfo, setAppointmentInfo] = useState<PatientAppointmentInfo | undefined>(undefined);
  // Doctor on the current/last video call (from the call invitation)
  const [callDoctorName, setCallDoctorName] = useState<string | null>(null);

  const toAppointmentInfo = (apt: NextAppointment): PatientAppointmentInfo => ({
    date: apt.date,
    time: apt.time,
    relativeTime: apt.relativeTime,
    doctorName: apt.doctorName,
    clinic: [apt.facility, apt.specialty].filter(Boolean).join(' • '),
    agenda: apt.agenda,
    isRescheduled: apt.isRescheduled,
  });

  // Load the next appointment and any consent requests that arrived while offline
  useEffect(() => {
    if (!user) return;
    patientApi
      .getNextAppointment()
      .then((apt) => setAppointmentInfo(apt ? toAppointmentInfo(apt) : undefined))
      .catch(() => setAppointmentInfo(undefined));
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
      socket = new WebSocket(WS_BASE_URL);
      socket.onopen = () => {
        // Connected to telehealth WebSocket
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

          // When Doctor initiates call, show incoming call screen
          if (data.type === 'call_invitation' || data.event === 'incoming_call') {
            setIncomingCall({
              caller: data.doctor_name || '',
              patient_id: data.patient_id || user.user_id,
              call_id: data.call_id || 'call_' + Date.now(),
            });
            showToast(tr('toastIncomingCall', { name: data.doctor_name || tr('yourDoctor') }), 'call');
          }

          // When Doctor ends the call, auto-transition patient to Care Plan
          if (data.event === 'call_ended' || data.type === 'call_ended') {
            setCurrentScreen('careplan');
            showToast(tr('toastCallEnded'), 'success');
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
              clinic: data.facility || prev?.clinic,
              agenda: data.agenda || prev?.agenda,
              isRescheduled: true,
            }));
            showToast(tr('toastRescheduled', { date: data.date, time: data.time }), 'calendar');
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

  const handleAcceptCall = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(
          JSON.stringify({
            type: 'call_event',
            event: 'call_accepted',
            patient_id: user?.user_id,
            patient_name: user?.full_name,
          })
        );
      } catch (e) {
        console.warn('Error sending call acceptance:', e);
      }
    }
    setCallDoctorName(incomingCall?.caller || null);
    setIncomingCall(null);
    setCurrentScreen('call');
    showToast(t('toastCallConnected'), 'call');
  };

  const handleDeclineCall = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(
          JSON.stringify({
            type: 'call_event',
            event: 'call_declined',
            patient_id: user?.user_id,
            patient_name: user?.full_name,
          })
        );
      } catch (e) {
        console.warn('Error sending call decline:', e);
      }
    }
    setIncomingCall(null);
    showToast(t('toastCallDeclined'));
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

  // Not logged in: ABHA sign-in screen
  if (!user) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <PatientLoginView
          onLoginSuccess={(loggedInUser) => {
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
          onEndCall={() => setCurrentScreen('careplan')}
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
    { key: 'records', label: t('tabRecords'), icon: 'folder-open' },
    { key: 'whosaw', label: t('tabPrivacy'), icon: 'verified-user' },
  ];

  const chromeInsets = {
    top: insets.top + TOOLBAR_HEIGHT,
    bottom: Math.max(insets.bottom, 6) + TAB_BAR_HEIGHT,
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
          {currentScreen === 'home' && (
            <HomeView
              user={user}
              appointment={appointmentInfo}
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
    backgroundColor: colors.bg,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.black,
  },
});
