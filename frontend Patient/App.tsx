import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppleTheme } from './src/theme/tokens';
import {
  patientApi,
  WS_BASE_URL,
  PatientUser,
  ConsentRequestData,
  NextAppointment,
} from './src/services/api';
import { PatientHeader } from './src/components/PatientHeader';
import { HeroAppointmentCard, type PatientAppointmentInfo } from './src/components/HeroAppointmentCard';
import { TactileGrid } from './src/components/TactileGrid';
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

const TABS: {
  key: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'home', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  { key: 'careplan', label: 'Medications', icon: 'medkit-outline', activeIcon: 'medkit' },
  { key: 'records', label: 'Records', icon: 'folder-open-outline', activeIcon: 'folder-open' },
  { key: 'whosaw', label: 'Privacy', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <PatientApp />
    </SafeAreaProvider>
  );
}

function PatientApp() {
  const insets = useSafeAreaInsets();
  const [selectedLanguage, setSelectedLanguage] = useState<'kn' | 'hi' | 'en'>('kn');
  // The WebSocket handler is created once per login, so read the language through a ref
  const languageRef = useRef(selectedLanguage);
  languageRef.current = selectedLanguage;
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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
          // Events are broadcast to every client; only handle the ones for this patient
          if (data.patient_id && data.patient_id !== user.user_id) return;
          // When Doctor requests consent, open modal immediately
          if (data.type === 'consent_request' || data.event === 'consent_request') {
            if (!data.consent_id) return;
            setIncomingConsent({
              consent_id: data.consent_id,
              patient_id: data.patient_id,
              practitioner_name: data.practitioner_name || 'Your doctor',
              practitioner_reg: data.practitioner_reg || '',
              record_title: data.record_title || 'Health record',
              clinical_purpose: data.clinical_purpose || '',
              duration_minutes: data.duration_minutes || 60,
              status: 'PENDING',
            });
            showToast(`⚠️ Consent Request from ${data.practitioner_name || 'your doctor'}`);
          }

          // When Doctor initiates call, show incoming call screen
          if (data.type === 'call_invitation' || data.event === 'incoming_call') {
            setIncomingCall({
              caller: data.doctor_name || 'Your doctor',
              patient_id: data.patient_id || user.user_id,
              call_id: data.call_id || 'call_' + Date.now(),
            });
            showToast(`Incoming Video Call from ${data.doctor_name || 'your doctor'}`);
          }

          // When Doctor ends the call, auto-transition patient to Care Plan
          if (data.event === 'call_ended' || data.type === 'call_ended') {
            setCurrentScreen('careplan');
            showToast('Doctor concluded the consultation. Care Plan ready.');
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

            const lang = languageRef.current;
            const toastText =
              lang === 'kn'
                ? `📅 ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಮರುಹೊಂದಿಸಲಾಗಿದೆ: ${data.date} (${data.time})`
                : lang === 'hi'
                ? `📅 अपॉइंटमेंट पुनर्निर्धारित: ${data.date} (${data.time})`
                : `📅 Appointment Rescheduled: ${data.date} at ${data.time}`;
            showToast(toastText);
          }
        } catch {
          // ignore non-json
        }
      };
      setWs(socket);
    } catch {
      // WS fallback
    }

    return () => {
      if (socket) socket.close();
    };
  }, [user]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    // Restart the timer so a newer toast is not hidden early by an older one
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleLanguage = () => {
    const nextLang = selectedLanguage === 'kn' ? 'hi' : selectedLanguage === 'hi' ? 'en' : 'kn';
    setSelectedLanguage(nextLang);
  };

  const handleAcceptCall = () => {
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
    showToast('Call connected with Doctor.');
  };

  const handleDeclineCall = () => {
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
    showToast('Call declined.');
  };

  // The backend saves the grant and notifies the doctor portal over WebSocket
  const handleApproveConsent = async (otp: string) => {
    if (!incomingConsent) return;
    try {
      await patientApi.approveConsent(incomingConsent.consent_id, otp);
      setIncomingConsent(null);
      showToast(`✅ Consent Approved (${incomingConsent.duration_minutes}-min access granted)`);
    } catch (err) {
      showToast(`Could not approve: ${err instanceof Error ? err.message : 'network error'}`);
    }
  };

  const handleDeclineConsent = async () => {
    if (!incomingConsent) return;
    try {
      await patientApi.declineConsent(incomingConsent.consent_id);
      setIncomingConsent(null);
      showToast('Consent Request Declined');
    } catch (err) {
      showToast(`Could not decline: ${err instanceof Error ? err.message : 'network error'}`);
    }
  };

  // If not logged in, render Apple Sign-In Patient Login Screen
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <PatientLoginView
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            if (loggedInUser.preferred_language) {
              setSelectedLanguage(loggedInUser.preferred_language);
            }
          }}
          selectedLanguage={selectedLanguage}
          onToggleLanguage={handleToggleLanguage}
        />
      </SafeAreaView>
    );
  }

  // If in live video call (Immersive FaceTime View)
  if (currentScreen === 'call') {
    return (
      <SafeAreaView style={styles.fullscreen}>
        <StatusBar barStyle="light-content" />
        <PatientTelehealthCall
          doctorName={callDoctorName || appointmentInfo?.doctorName || 'Your doctor'}
          onEndCall={() => setCurrentScreen('careplan')}
          selectedLanguage={selectedLanguage}
        />
        <ConsentGateModal
          visible={incomingConsent !== null}
          request={incomingConsent}
          onApprove={handleApproveConsent}
          onDecline={handleDeclineConsent}
          selectedLanguage={selectedLanguage}
        />
      </SafeAreaView>
    );
  }

  // Active Tab determination
  const activeTab: TabType =
    currentScreen === 'home'
      ? 'home'
      : currentScreen === 'careplan'
      ? 'careplan'
      : currentScreen === 'records'
      ? 'records'
      : 'whosaw';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* Dynamic Island Style Toast Capsule */}
      {toastMessage && (
        <View style={styles.dynamicToastContainer}>
          <View style={styles.dynamicToastPill}>
            <Text style={styles.dynamicToastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* Main Body View based on navigation */}
      <View style={styles.mainContainer}>
        {currentScreen === 'home' && (
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Header */}
            <PatientHeader
              user={user}
              selectedLanguage={selectedLanguage}
              onToggleLanguage={handleToggleLanguage}
              onOpenProfile={() => setIsIntakeVisible(true)}
              onLogout={() => {
                patientApi.clearToken();
                setUser(null);
                setCurrentScreen('home');
              }}
            />

            {/* Hero Scheduled Appointment Card */}
            <HeroAppointmentCard
              onJoinCall={() => setIsIntakeVisible(true)}
              selectedLanguage={selectedLanguage}
              appointment={appointmentInfo}
            />

            {/* 2x2 Inset Grouped Action Grid & Emergency Bar */}
            <TactileGrid
              onOpenDoctors={() => setIsIntakeVisible(true)}
              onOpenRecords={() => setCurrentScreen('records')}
              onOpenMedicines={() => setCurrentScreen('careplan')}
              onOpenFollowUp={() => setCurrentScreen('careplan')}
              onTriggerEmergency={() => setIsEmergencyVisible(true)}
              selectedLanguage={selectedLanguage}
            />

            {/* ABDM & DPDP Act 2023 Footer Reassurance */}
            <View style={styles.footerBadge}>
              <Text style={styles.footerIcon}>🛡️</Text>
              <Text style={styles.footerText}>
                Ayushman Bharat Digital Mission (ABDM) • DPDP Act 2023 Enforced
              </Text>
            </View>
          </ScrollView>
        )}

        {currentScreen === 'careplan' && (
          <CarePlanView
            onBack={() => setCurrentScreen('home')}
            selectedLanguage={selectedLanguage}
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
            selectedLanguage={selectedLanguage}
          />
        )}

        {currentScreen === 'whosaw' && (
          <WhoSawMyRecordsView
            onBack={() => setCurrentScreen(privacyBackTarget)}
            backLabel={privacyBackTarget === 'records' ? 'Records' : 'Home'}
            selectedLanguage={selectedLanguage}
          />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => {
                if (tab.key === 'whosaw') setPrivacyBackTarget('home');
                setCurrentScreen(tab.key);
              }}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={24}
                color={isActive ? AppleTheme.colors.systemBlue : AppleTheme.colors.tertiaryLabel}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pre-Consultation Symptom Intake Modal */}
      <SymptomIntakeModal
        visible={isIntakeVisible}
        onClose={() => setIsIntakeVisible(false)}
        onSubmit={async (symptoms, isRep, notes) => {
          try {
            await patientApi.submitIntake(symptoms, notes || '', isRep);
          } catch (err) {
            showToast(`Could not send symptoms: ${err instanceof Error ? err.message : 'network error'}`);
            return;
          }
          setIsIntakeVisible(false);
          showToast('Triage complete. Connecting to call...');
          setTimeout(() => {
            setCurrentScreen('call');
          }, 400);
        }}
        selectedLanguage={selectedLanguage}
      />

      {/* DPDP Consent Gate Modal (Incoming Doctor Request) */}
      <ConsentGateModal
        visible={incomingConsent !== null}
        request={incomingConsent}
        onApprove={handleApproveConsent}
        onDecline={handleDeclineConsent}
        selectedLanguage={selectedLanguage}
      />

      {/* Emergency Medical SOS Modal */}
      <EmergencySOSModal
        visible={isEmergencyVisible}
        onClose={() => setIsEmergencyVisible(false)}
      />

      {/* iOS 18 Incoming FaceTime Call Modal */}
      <IncomingCallModal
        visible={incomingCall !== null}
        callerName={incomingCall?.caller || 'Your doctor'}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        selectedLanguage={selectedLanguage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  dynamicToastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 16,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dynamicToastPill: {
    backgroundColor: 'rgba(28, 28, 30, 0.94)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  dynamicToastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  footerIcon: {
    fontSize: 13,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    color: AppleTheme.colors.tertiaryLabel,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppleTheme.colors.separator,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: AppleTheme.colors.tertiaryLabel,
  },
  tabLabelActive: {
    color: AppleTheme.colors.systemBlue,
    fontWeight: '600',
  },
});
