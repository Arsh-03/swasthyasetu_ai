import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';
import { patientApi, type CarePlan, type CarePlanMedication, type DoseSlot } from '../services/api';

interface CarePlanViewProps {
  onBack: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

type CheckinStatus = 'better' | 'same' | 'worse';

// How each dose slot looks in the list
const SLOT_STYLE: Record<DoseSlot, { icon: string; time: string; bg?: string; color?: string }> = {
  morning: { icon: '☀️', time: '8:00 AM' },
  afternoon: { icon: '🌤️', time: '1:30 PM', bg: 'rgba(255, 149, 0, 0.12)', color: AppleTheme.colors.systemOrange },
  night: { icon: '🌙', time: '8:30 PM', bg: 'rgba(88, 86, 214, 0.12)', color: AppleTheme.colors.systemIndigo },
  prn: { icon: '💊', time: 'As needed' },
};
const SLOT_ORDER: DoseSlot[] = ['morning', 'afternoon', 'night', 'prn'];

interface DoseRow {
  key: string; // "medicationId:slot", same as the backend's doses_today keys
  med: CarePlanMedication;
  slot: DoseSlot;
}

const buildDoseRows = (meds: CarePlanMedication[]): DoseRow[] => {
  const rows: DoseRow[] = [];
  for (const slot of SLOT_ORDER) {
    for (const med of meds) {
      const s = med.schedule || {};
      const scheduled = slot === 'prn' ? !s.morning && !s.afternoon && !s.night : !!s[slot];
      if (scheduled) rows.push({ key: `${med.id}:${slot}`, med, slot });
    }
  }
  return rows;
};

const buildAudioText = (plan: CarePlan | null, lang: 'kn' | 'hi' | 'en') => {
  const meds = plan?.medications || [];
  const intro =
    lang === 'kn' ? 'ವೈದ್ಯರ ಆರೈಕೆ ಯೋಜನೆ.' : lang === 'hi' ? 'डॉक्टर केयर प्लान।' : 'Doctor Care Plan.';
  if (meds.length === 0) {
    return `${intro} ${
      lang === 'kn'
        ? 'ಈಗ ಯಾವುದೇ ಔಷಧಿಗಳಿಲ್ಲ.'
        : lang === 'hi'
        ? 'अभी कोई दवा नहीं है।'
        : 'You have no active medications.'
    }`;
  }
  const lines = meds.map((m) => `${m.name}, ${m.dosage}, ${m.frequency}, ${m.timing}.`);
  const advice = plan?.latest_note?.plan?.advice ? ` ${plan.latest_note.plan.advice}.` : '';
  return `${intro} ${lines.join(' ')}${advice}`;
};

export const CarePlanView: React.FC<CarePlanViewProps> = ({
  onBack,
  selectedLanguage,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [followUpStatus, setFollowUpStatus] = useState<CheckinStatus | null>(null);
  const [loggedDoses, setLoggedDoses] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    patientApi
      .getCarePlan()
      .then((data) => {
        if (cancelled) return;
        setPlan(data);
        setLoggedDoses(data.doses_today || {});
        setFollowUpStatus(data.checkin_today);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleAudio = () => {
    setIsPlayingAudio(!isPlayingAudio);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (!isPlayingAudio) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(buildAudioText(plan, selectedLanguage));
        utterance.rate = 0.85;
        utterance.onend = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        window.speechSynthesis.cancel();
      }
    }
  };

  // Optimistic toggle; rolled back if the save fails
  const toggleDose = async (row: DoseRow) => {
    const taken = !loggedDoses[row.key];
    setLoggedDoses((prev) => ({ ...prev, [row.key]: taken }));
    setSaveError(null);
    try {
      await patientApi.logDose(row.med.id, row.slot, taken);
    } catch {
      setLoggedDoses((prev) => ({ ...prev, [row.key]: !taken }));
      setSaveError('Could not save the dose. Check your connection.');
    }
  };

  const submitCheckin = async (value: CheckinStatus) => {
    const previous = followUpStatus;
    setFollowUpStatus(value);
    setSaveError(null);
    try {
      await patientApi.submitCheckin(value);
    } catch {
      setFollowUpStatus(previous);
      setSaveError('Could not send your check-in. Check your connection.');
    }
  };

  const doseRows = buildDoseRows(plan?.medications || []);
  const subtitle = [plan?.doctor_name, plan?.facility].filter(Boolean).join(' • ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* iOS Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* Apple Health Large Title */}
      <View style={styles.headerBlock}>
        <Text style={styles.largeTitle}>Care Plan</Text>
        <Text style={styles.headerSubtitle}>
          {subtitle || (status === 'loading' ? 'Loading…' : 'No care plan from a doctor yet')}
        </Text>
      </View>

      {/* Apple Health Audio Player Widget */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleToggleAudio}
        style={styles.audioCard}
      >
        <View style={styles.audioPlayBtn}>
          <Text style={{ fontSize: 18 }}>{isPlayingAudio ? '⏸' : '▶'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.audioTitle}>
            {isPlayingAudio
              ? 'Playing Doctor Audio Notes...'
              : selectedLanguage === 'kn'
              ? 'ಕನ್ನಡದಲ್ಲಿ ಆಲಿಸಿ (Audio Advice)'
              : selectedLanguage === 'hi'
              ? 'हिंदी में सुनें (Audio Advice)'
              : 'Listen to Voice Instructions'}
          </Text>
          <Text style={styles.audioMeta}>
            Bhashini TTS • {plan?.medications.length || 0} medications
          </Text>
        </View>
        <View style={styles.audioSoundwave}>
          <View style={[styles.soundBar, isPlayingAudio && styles.soundBarActive, { height: 12 }]} />
          <View style={[styles.soundBar, isPlayingAudio && styles.soundBarActive, { height: 20 }]} />
          <View style={[styles.soundBar, isPlayingAudio && styles.soundBarActive, { height: 16 }]} />
          <View style={[styles.soundBar, isPlayingAudio && styles.soundBarActive, { height: 24 }]} />
        </View>
      </TouchableOpacity>

      {/* Apple Health Medications Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>MEDICATIONS (ಔಷಧಿಗಳು)</Text>

        <View style={styles.insetGroup}>
          {doseRows.length === 0 && (
            <View style={styles.medicationRow}>
              <Text style={styles.medInstruction}>
                {status === 'loading'
                  ? 'Loading your medications…'
                  : status === 'error'
                  ? 'Could not load your care plan. Check your connection.'
                  : 'No active medications.'}
              </Text>
            </View>
          )}
          {doseRows.map((row, index) => {
            const look = SLOT_STYLE[row.slot];
            const taken = !!loggedDoses[row.key];
            return (
              <React.Fragment key={row.key}>
                {index > 0 && <View style={styles.rowDivider} />}
                <View style={styles.medicationRow}>
                  <View style={styles.timeIconWrap}>
                    <Text style={{ fontSize: 20 }}>{look.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.medTitleRow}>
                      <Text style={styles.medName}>{row.med.name}</Text>
                      <View style={[styles.scheduleTag, look.bg ? { backgroundColor: look.bg } : null]}>
                        <Text style={[styles.scheduleText, look.color ? { color: look.color } : null]}>
                          {look.time}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.medInstruction}>
                      {[row.med.dosage, row.med.timing].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleDose(row)}
                    style={[styles.doseCheckBtn, taken && styles.doseCheckBtnTaken]}
                  >
                    <Text style={[styles.doseCheckText, taken && styles.doseCheckTextTaken]}>
                      {taken ? '✓' : 'Take'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        {saveError && <Text style={styles.medInstruction}>{saveError}</Text>}
      </View>

      {/* 48-Hour Recovery Status Check (Apple Health Widget) */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>48-HOUR RECOVERY CHECK-IN</Text>

        <View style={styles.followUpCard}>
          <Text style={styles.followUpTitle}>How are you feeling today?</Text>
          <Text style={styles.followUpSub}>
            Your response is instantly synced with your doctor's triage dashboard.
          </Text>

          {/* iOS Segmented Pill Options */}
          <View style={styles.statusButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => submitCheckin('better')}
              style={[
                styles.statusBtn,
                followUpStatus === 'better' && styles.statusBtnActiveBetter,
              ]}
            >
              <Text style={{ fontSize: 20 }}>😊</Text>
              <Text
                style={[
                  styles.statusBtnText,
                  followUpStatus === 'better' && styles.statusBtnTextActive,
                ]}
              >
                Better
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => submitCheckin('same')}
              style={[
                styles.statusBtn,
                followUpStatus === 'same' && styles.statusBtnActiveSame,
              ]}
            >
              <Text style={{ fontSize: 20 }}>😐</Text>
              <Text
                style={[
                  styles.statusBtnText,
                  followUpStatus === 'same' && styles.statusBtnTextActive,
                ]}
              >
                Same
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => submitCheckin('worse')}
              style={[
                styles.statusBtn,
                followUpStatus === 'worse' && styles.statusBtnActiveWorse,
              ]}
            >
              <Text style={{ fontSize: 20 }}>🚨</Text>
              <Text
                style={[
                  styles.statusBtnText,
                  followUpStatus === 'worse' && { color: AppleTheme.colors.systemRed, fontWeight: '700' },
                ]}
              >
                Need Help
              </Text>
            </TouchableOpacity>
          </View>

          {followUpStatus && (
            <View style={styles.recordedBanner}>
              <Text style={styles.recordedCheck}>✓</Text>
              <Text style={styles.recordedStatus}>
                Logged to Doctor's clinical ledger. Auto follow-up scheduled.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backChevron: {
    fontSize: 28,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '300',
    marginTop: -2,
  },
  backLabel: {
    fontSize: 17,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  headerBlock: {
    gap: 4,
  },
  largeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: AppleTheme.colors.label,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  },
  headerSubtitle: {
    fontSize: 14,
    color: AppleTheme.colors.secondaryLabel,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppleTheme.colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  audioPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppleTheme.colors.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppleTheme.colors.systemBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  audioMeta: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 2,
  },
  audioSoundwave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 4,
  },
  soundBar: {
    width: 3,
    backgroundColor: AppleTheme.colors.separator,
    borderRadius: 1.5,
  },
  soundBarActive: {
    backgroundColor: AppleTheme.colors.systemBlue,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
    letterSpacing: 0.6,
    paddingLeft: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  insetGroup: {
    backgroundColor: AppleTheme.colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  timeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  scheduleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scheduleText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppleTheme.colors.systemGreenDark,
  },
  medInstruction: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 3,
  },
  doseCheckBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    borderWidth: 1,
    borderColor: AppleTheme.colors.separator,
  },
  doseCheckBtnTaken: {
    backgroundColor: AppleTheme.colors.systemGreen,
    borderColor: AppleTheme.colors.systemGreen,
  },
  doseCheckText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
  },
  doseCheckTextTaken: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: AppleTheme.colors.separator,
    marginLeft: 66,
  },
  followUpCard: {
    backgroundColor: AppleTheme.colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  followUpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  followUpSub: {
    fontSize: 13,
    color: AppleTheme.colors.secondaryLabel,
    lineHeight: 18,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppleTheme.colors.separator,
    gap: 6,
  },
  statusBtnActiveBetter: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: AppleTheme.colors.systemGreen,
  },
  statusBtnActiveSame: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderColor: AppleTheme.colors.systemBlue,
  },
  statusBtnActiveWorse: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderColor: AppleTheme.colors.systemRed,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
  },
  statusBtnTextActive: {
    color: AppleTheme.colors.label,
    fontWeight: '700',
  },
  recordedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  recordedCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: AppleTheme.colors.systemGreenDark,
  },
  recordedStatus: {
    fontSize: 12,
    color: AppleTheme.colors.systemGreenDark,
    fontWeight: '600',
    flex: 1,
  },
});
