import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, touch, type Tone } from '../theme/tokens';
import { patientApi, type CarePlan, type CarePlanMedication, type DoseSlot } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { SupportedLanguage, TranslationKey } from '../utils/translations';
import { haptic } from '../utils/haptics';
import { localized } from '../utils/localized';
import { playBirthdayPopperSound, playMedicationAlertSound } from '../utils/soundEffects';
import { triggerBirthdayPopper } from '../utils/confetti';
import { EmptyMedications } from './illustrations';
import { SavedSummaries } from './VisitSummary';
import { DepartmentBadge } from './doctors/DoctorParts';
import { doctorShortName } from '../utils/departments';
import {
  AppText,
  AudioListenButton,
  Badge,
  Card,
  ChoiceTiles,
  Groove,
  Icon,
  type IconName,
  LIST_ROW_TEXT_INSET,
  ListRow,
  NavBar,
  NeuPressable,
  PopBurstEffect,
  FullScreenBirthdayPopper,
  PrimaryButton,
  ScreenScroll,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
} from './ui';

interface CarePlanViewProps {
  onBack: () => void;
  /** Bumped when a new visit summary was saved. */
  summariesKey?: number;
}

type CheckinStatus = 'better' | 'same' | 'worse';

// How each dose slot looks in the list
const SLOT_STYLE: Record<DoseSlot, { icon: IconName; time: TranslationKey; tone: Tone }> = {
  morning: { icon: 'morning', time: 'slotMorning', tone: 'success' },
  afternoon: { icon: 'afternoon', time: 'slotAfternoon', tone: 'warning' },
  night: { icon: 'night', time: 'slotNight', tone: 'primary' },
  prn: { icon: 'medication', time: 'slotPrn', tone: 'success' },
};
const SLOT_ORDER: DoseSlot[] = ['morning', 'afternoon', 'night', 'prn'];

const CHECKIN_OPTIONS: { value: CheckinStatus; label: TranslationKey; icon: IconName; tone: Tone }[] = [
  { value: 'better', label: 'feelingBetter', icon: 'feelingBetter', tone: 'success' },
  { value: 'same', label: 'feelingSame', icon: 'feelingSame', tone: 'primary' },
  { value: 'worse', label: 'feelingWorse', icon: 'help', tone: 'danger' },
];

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

const getCurrentTimeSlot = (): DoseSlot => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
};

export const CarePlanView: React.FC<CarePlanViewProps> = ({ onBack, summariesKey = 0 }) => {
  const { lang, t } = useLanguage();
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [followUpStatus, setFollowUpStatus] = useState<CheckinStatus | null>(null);
  const [loggedDoses, setLoggedDoses] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [showCelebrationPopper, setShowCelebrationPopper] = useState(false);

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
  }, [reloadKey]);

  const doseRows = buildDoseRows(plan?.medications || []);
  const currentSlot = getCurrentTimeSlot();
  const dueSlotDoses = doseRows.filter((r) => r.slot === currentSlot && !loggedDoses[r.key]);

  // Trigger scheduled medication chime & browser notification when doses are due for current time slot
  useEffect(() => {
    if (status !== 'ready' || dueSlotDoses.length === 0 || isSnoozed) return;

    const sessionKey = `swasthya_med_alert_${currentSlot}_${new Date().toDateString()}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    }

    playMedicationAlertSound();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const slotName = t(SLOT_STYLE[currentSlot].time);
        const medNames = dueSlotDoses.map((d) => d.med.name).join(', ');
        new Notification(t('medicationReminderTitle', { slot: slotName }), {
          body: t('medicationReminderBody', {
            name: medNames,
            dosage: localized(dueSlotDoses[0]?.med.dosage, lang) || '',
          }),
        });
      }
    }
  }, [status, dueSlotDoses, currentSlot, isSnoozed, lang, t]);

  const requestNotificationPermissionAndTest = () => {
    playMedicationAlertSound();
    haptic.tap();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const slotName = t(SLOT_STYLE[currentSlot].time);
        const medNames = dueSlotDoses.length > 0
          ? dueSlotDoses.map((d) => d.med.name).join(', ')
          : (doseRows[0]?.med.name || 'Prescribed medicines');
        new Notification(t('medicationReminderTitle', { slot: slotName }), {
          body: t('medicationReminderBody', {
            name: medNames,
            dosage: localized(doseRows[0]?.med.dosage, lang) || 'Scheduled',
          }),
        });
        setNoticeText(t('remindersActive'));
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(t('medicationReminders'), {
              body: t('notificationPermissionGranted'),
            });
            setNoticeText(t('notificationPermissionGranted'));
          }
        });
      } else {
        setNoticeText(t('remindersActive'));
      }
    } else {
      setNoticeText(t('remindersActive'));
    }
  };

  const takeAllDueInSlot = async () => {
    setShowCelebrationPopper(false);
    setTimeout(() => setShowCelebrationPopper(true), 15);
    playBirthdayPopperSound();
    triggerBirthdayPopper();
    haptic.success();
    const updated = { ...loggedDoses };
    dueSlotDoses.forEach((d) => {
      updated[d.key] = true;
    });
    setLoggedDoses(updated);
    setNoticeText(t('doseTakenPop'));
    try {
      await Promise.all(dueSlotDoses.map((d) => patientApi.logDose(d.med.id, d.slot, true)));
    } catch {
      setSaveError(t('doseSaveError'));
    }
  };

  const handleSnooze = () => {
    setIsSnoozed(true);
    setTimeout(() => {
      setIsSnoozed(false);
    }, 15 * 60 * 1000);
  };

  const buildAudioText = () => {
    const meds = plan?.medications || [];
    if (meds.length === 0) return `${t('audioIntro')} ${t('audioNoMeds')}`;
    const lines = meds.map(
      (m) => `${[m.name, localized(m.dosage, lang), localized(m.frequency, lang), localized(m.timing, lang)].filter(Boolean).join(', ')}.`
    );
    const adviceText = plan?.latest_visit?.advice.join('. ') || localized(plan?.latest_note?.plan?.advice, lang);
    const advice = adviceText ? ` ${adviceText}.` : '';
    return `${t('audioIntro')} ${lines.join(' ')}${advice}`;
  };

  // Optimistic toggle; rolled back if the save fails
  const toggleDose = async (row: DoseRow) => {
    const taken = !loggedDoses[row.key];
    if (taken) {
      setShowCelebrationPopper(false);
      setTimeout(() => setShowCelebrationPopper(true), 15);
      playBirthdayPopperSound();
      triggerBirthdayPopper();
      haptic.success();
      setNoticeText(t('doseTakenPop'));
    } else {
      haptic.tap();
    }
    setLoggedDoses((prev) => ({ ...prev, [row.key]: taken }));
    setSaveError(null);
    try {
      await patientApi.logDose(row.med.id, row.slot, taken);
    } catch {
      setLoggedDoses((prev) => ({ ...prev, [row.key]: !taken }));
      setSaveError(t('doseSaveError'));
    }
  };

  const submitCheckin = async (value: CheckinStatus) => {
    haptic.selection();
    const previous = followUpStatus;
    setFollowUpStatus(value);
    setSaveError(null);
    try {
      await patientApi.submitCheckin(value);
    } catch {
      setFollowUpStatus(previous);
      setSaveError(t('checkinError'));
    }
  };

  // Medicines can come from several doctors (one per health issue)
  const prescribers = new Set((plan?.medications || []).map((m) => m.prescriber?.name || m.prescribedBy).filter(Boolean));
  const subtitle =
    prescribers.size > 1
      ? t('medsFromDoctors', { n: prescribers.size })
      : [plan?.doctor_name, localized(plan?.facility, lang)].filter(Boolean).join(' • ');

  return (
    <View style={styles.container}>
      <FullScreenBirthdayPopper
        active={showCelebrationPopper}
        onComplete={() => setShowCelebrationPopper(false)}
        message={t('doseTakenPop')}
        subMessage={t('checkinSub')}
      />

      <ScreenScroll contentContainerStyle={styles.content}>
        <NavBar backLabel={t('home')} onBack={onBack} />

      <ScreenHeader
        icon="medication"
        title={t('carePlan')}
        subtitle={subtitle || (status === 'loading' ? t('loading') : t('noCarePlan'))}
      />

      <SavedSummaries refreshKey={summariesKey} />

      {/* The last consultation, from the doctor's own note: nothing was typed twice. */}
      {plan?.latest_visit && (plan.latest_visit.diagnosis.length > 0 || plan.latest_visit.advice.length > 0 || plan.latest_visit.follow_up.text) && (
        <View style={styles.section}>
          <SectionHeader title={t('lastVisit')} />
          <Card style={styles.visitCard}>
            {plan.latest_visit.diagnosis.length > 0 && (
              <View style={styles.visitRow}>
                <AppText variant="footnote" color="inkMuted">{t('visitFound')}</AppText>
                <AppText variant="body" weight={600}>{plan.latest_visit.diagnosis.join('; ')}</AppText>
              </View>
            )}
            {plan.latest_visit.advice.length > 0 && (
              <View style={styles.visitRow}>
                <AppText variant="footnote" color="inkMuted">{t('visitAdvice')}</AppText>
                {plan.latest_visit.advice.map((a, i) => <AppText key={i} variant="body">• {a}</AppText>)}
              </View>
            )}
            {plan.latest_visit.investigations.length > 0 && (
              <View style={styles.visitRow}>
                <AppText variant="footnote" color="inkMuted">{t('visitTests')}</AppText>
                <AppText variant="body">{plan.latest_visit.investigations.join('; ')}</AppText>
              </View>
            )}
            {(plan.latest_visit.follow_up.in_days || plan.latest_visit.follow_up.text) && (
              <View style={styles.visitRow}>
                <AppText variant="footnote" color="inkMuted">{t('visitFollowUp')}</AppText>
                <AppText variant="body" weight={600}>
                  {plan.latest_visit.follow_up.in_days ? t('visitFollowUpIn', { n: plan.latest_visit.follow_up.in_days }) : plan.latest_visit.follow_up.text}
                </AppText>
              </View>
            )}
          </Card>
        </View>
      )}

      {/* Voice instructions */}
      <AudioListenButton
        variant="card"
        text={buildAudioText}
        title={t('listenInstructions')}
        playingTitle={t('playingAudio')}
        subtitle={t('audioMeta', { count: plan?.medications.length || 0 })}
      />

      {/* Active Scheduled Medication Reminder Card (Shown when medicines are due) */}
      {status === 'ready' && dueSlotDoses.length > 0 && !isSnoozed && (
        <Card style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <View style={styles.reminderBellDisc}>
              <Icon name="bell" size={24} color={colors.goldDeep} active />
            </View>
            <View style={styles.reminderHeaderText}>
              <AppText variant="headline" color="ink">
                {t('medicationReminderTitle', { slot: t(SLOT_STYLE[currentSlot].time) })}
              </AppText>
              <AppText variant="footnote" color="inkMuted">
                {dueSlotDoses
                  .map((d) => `${d.med.name} (${localized(d.med.dosage, lang) || localized(d.med.timing, lang) || ''})`)
                  .join(' • ')}
              </AppText>
            </View>
          </View>
          <View style={styles.reminderActions}>
            <PrimaryButton
              label={t('takeNow')}
              icon="check"
              size="sm"
              onPress={takeAllDueInSlot}
              style={styles.reminderBtn}
            />
            <SecondaryButton
              label={t('snooze')}
              tone="neutral"
              size="sm"
              onPress={handleSnooze}
              style={styles.reminderBtn}
            />
          </View>
        </Card>
      )}

      {/* Celebratory Birthday Popper / Reassurance banner */}
      {noticeText && (
        <View style={noticeText.includes('🎉') ? styles.celebrationBanner : styles.noticeBanner}>
          <Icon name="checkCircle" size={noticeText.includes('🎉') ? 22 : 16} color={colors.successDeep} active />
          <AppText
            variant={noticeText.includes('🎉') ? 'subhead' : 'footnote'}
            weight={700}
            color="successDeep"
            style={styles.shrink}
          >
            {noticeText}
          </AppText>
        </View>
      )}

      {/* Doses: one row per medicine per time slot */}
      <View style={styles.section}>
        <View style={styles.headerWithAction}>
          <SectionHeader title={t('dosesSection')} count={doseRows.length} />
          <NeuPressable
            onPress={requestNotificationPermissionAndTest}
            accessibilityRole="button"
            accessibilityLabel={t('testReminder')}
            containerStyle={styles.testBtnWrap}
            style={styles.testBtn}
          >
            <Icon name="bell" size={15} color={colors.primary} />
            <AppText variant="footnote" weight={600} color="primary" compact>
              {t('testReminder')}
            </AppText>
          </NeuPressable>
        </View>

        <Card padded={false}>
          {doseRows.length === 0 && (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <EmptyMedications width={150} />
              {status === 'loading' ? (
                <View style={styles.inline}>
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="subhead" weight={600}>
                    {t('loadingMedications')}
                  </AppText>
                </View>
              ) : status === 'error' ? (
                <>
                  <View style={styles.inline} accessibilityRole="alert">
                    <Icon name="network" size={20} color={colors.warningDeep} active />
                    <AppText variant="subhead" weight={600} color="warningDeep" style={styles.shrink}>
                      {t('carePlanError')}
                    </AppText>
                  </View>
                  <SecondaryButton label={t('retry')} tone="primary" size="sm" onPress={() => {
                      setStatus('loading');
                      setReloadKey((k) => k + 1);
                    }}
                  />
                </>
              ) : (
                <AppText variant="headline" align="center">
                  {t('noMedications')}
                </AppText>
              )}
            </View>
          )}
          {doseRows.map((row, index) => {
            const look = SLOT_STYLE[row.slot];
            const taken = !!loggedDoses[row.key];
            // Drug name stays in Latin script; a local-script name, if sent, is a secondary line
            const nameLocal = localized(row.med.nameLocal, lang);
            return (
              <React.Fragment key={row.key}>
                {index > 0 && <Groove inset={LIST_ROW_TEXT_INSET} />}
                <ListRow
                  icon={look.icon}
                  iconTone={look.tone}
                  title={row.med.name}
                  subtitle={[localized(row.med.dosage, lang), localized(row.med.timing, lang)].filter(Boolean).join(' • ')}
                  trailing={
                    <DoseButton
                      taken={taken}
                      label={taken ? t('taken') : t('take')}
                      accessibilityLabel={t('markDoseTaken', { name: row.med.name })}
                      onPress={() => toggleDose(row)}
                    />
                  }
                >
                  {nameLocal && nameLocal !== row.med.name ? (
                    <AppText variant="footnote" color="inkMuted">
                      {nameLocal}
                    </AppText>
                  ) : null}
                  <View style={styles.medBadges}>
                    <Badge label={t(look.time)} tone={look.tone} icon="clock" />
                    {row.med.prescriber?.department ? <DepartmentBadge department={row.med.prescriber.department} /> : null}
                  </View>
                  {row.med.prescriber?.name || row.med.prescribedBy ? (
                    <AppText variant="caption" color="inkMuted" numberOfLines={1}>
                      {t('prescribedBy', { name: doctorShortName(row.med.prescriber?.name || row.med.prescribedBy || '') })}
                    </AppText>
                  ) : null}
                </ListRow>
              </React.Fragment>
            );
          })}
        </Card>
        {saveError && (
          <AppText variant="footnote" color="dangerDeep" accessibilityRole="alert">
            {saveError}
          </AppText>
        )}
      </View>

      {/* 48-hour recovery check-in */}
      <View style={styles.section}>
        <SectionHeader title={t('recoveryCheckin')} />
        <Card style={styles.checkinCard}>
          <AppText variant="headline">{t('howAreYouFeeling')}</AppText>
          <AppText variant="footnote" color="inkMuted">
            {t('checkinSub')}
          </AppText>

          <ChoiceTiles
            options={CHECKIN_OPTIONS.map((opt) => ({ ...opt, label: t(opt.label) }))}
            value={followUpStatus}
            onChange={submitCheckin}
            accessibilityLabel={t('howAreYouFeeling')}
            style={styles.checkinRow}
          />

          {followUpStatus && (
            <View style={styles.recorded}>
              <Icon name="checkCircle" size={18} color={colors.successDeep} active />
              <AppText variant="footnote" weight={600} color="successDeep" style={styles.flex}>
                {t('checkinLogged')}
              </AppText>
            </View>
          )}
        </Card>
      </View>
    </ScreenScroll>
  </View>
);
};

/** Raised "Take" control with celebratory spring pop burst and audio feedback. */
export const DoseButton: React.FC<{
  taken: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  lang?: SupportedLanguage;
}> = ({ taken, label, accessibilityLabel, onPress, lang }) => {
  const [showBurst, setShowBurst] = useState(false);
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePress = () => {
    if (!taken) {
      setShowBurst(true);
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, friction: 3, tension: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };

  return (
    <View style={styles.doseBtnContainer}>
      <PopBurstEffect active={showBurst} onComplete={() => setShowBurst(false)} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <NeuPressable
          onPress={handlePress}
          selected={taken}
          haptics="none"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: taken }}
          accessibilityLabel={accessibilityLabel}
          containerStyle={styles.doseBtnWrap}
          style={styles.doseBtn}
        >
          {taken && <Icon name="check" size={18} color={colors.successDeep} />}
          <AppText variant="footnote" weight={700} color={taken ? 'ink' : 'primary'} lang={lang} compact>
            {label}
          </AppText>
        </NeuPressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  visitCard: { gap: spacing.md },
  visitRow: { gap: 2 },
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  headerWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testBtnWrap: {
    borderRadius: radii.sm,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  medBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  doseBtnContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Compact control: centred in the row at its own height (never stretched to the row)
  doseBtnWrap: {
    alignSelf: 'center',
  },
  doseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touch.min,
    minWidth: 84,
    paddingHorizontal: spacing.md,
  },
  reminderCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.card,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reminderBellDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderHeaderText: {
    flex: 1,
    gap: 2,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reminderBtn: {
    flex: 1,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: radii.sm,
  },
  celebrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#34D399',
    borderRadius: radii.md,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  checkinCard: {
    gap: spacing.sm,
    padding: spacing.xl,
  },
  checkinRow: {
    marginTop: spacing.sm,
  },
  recorded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

