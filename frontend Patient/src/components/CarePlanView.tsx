import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints, tones, touch, type Tone } from '../theme/tokens';
import { patientApi, type CarePlan, type CarePlanMedication, type DoseSlot } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { haptic } from '../utils/haptics';
import {
  AppText,
  AudioListenButton,
  Badge,
  Card,
  Divider,
  Icon,
  type IconName,
  LIST_ROW_TEXT_INSET,
  ListRow,
  NavBar,
  ScreenScroll,
  ScreenHeader,
  SectionHeader,
} from './ui';

interface CarePlanViewProps {
  onBack: () => void;
}

type CheckinStatus = 'better' | 'same' | 'worse';

// How each dose slot looks in the list
const SLOT_STYLE: Record<DoseSlot, { icon: IconName; time: TranslationKey; tone: Tone }> = {
  morning: { icon: 'wb-sunny', time: 'slotMorning', tone: 'green' },
  afternoon: { icon: 'wb-twilight', time: 'slotAfternoon', tone: 'orange' },
  night: { icon: 'nightlight', time: 'slotNight', tone: 'indigo' },
  prn: { icon: 'medication', time: 'slotPrn', tone: 'green' },
};
const SLOT_ORDER: DoseSlot[] = ['morning', 'afternoon', 'night', 'prn'];

const CHECKIN_OPTIONS: { value: CheckinStatus; label: TranslationKey; icon: IconName; tone: Tone }[] = [
  { value: 'better', label: 'feelingBetter', icon: 'sentiment-satisfied', tone: 'green' },
  { value: 'same', label: 'feelingSame', icon: 'sentiment-neutral', tone: 'blue' },
  { value: 'worse', label: 'feelingWorse', icon: 'sos', tone: 'red' },
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

export const CarePlanView: React.FC<CarePlanViewProps> = ({ onBack }) => {
  const { t } = useLanguage();
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

  const buildAudioText = () => {
    const meds = plan?.medications || [];
    if (meds.length === 0) return `${t('audioIntro')} ${t('audioNoMeds')}`;
    const lines = meds.map((m) => `${m.name}, ${m.dosage}, ${m.frequency}, ${m.timing}.`);
    const advice = plan?.latest_note?.plan?.advice ? ` ${plan.latest_note.plan.advice}.` : '';
    return `${t('audioIntro')} ${lines.join(' ')}${advice}`;
  };

  // Optimistic toggle; rolled back if the save fails
  const toggleDose = async (row: DoseRow) => {
    const taken = !loggedDoses[row.key];
    if (taken) haptic.success();
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
    haptic.tap();
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

  const doseRows = buildDoseRows(plan?.medications || []);
  const subtitle = [plan?.doctor_name, plan?.facility].filter(Boolean).join(' • ');

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={t('home')} onBack={onBack} />

      <ScreenHeader
        icon="medication"
        title={t('carePlan')}
        subtitle={subtitle || (status === 'loading' ? t('loading') : t('noCarePlan'))}
      />

      {/* Voice instructions */}
      <AudioListenButton
        variant="card"
        text={buildAudioText}
        title={t('listenInstructions')}
        playingTitle={t('playingAudio')}
        subtitle={t('audioMeta', { count: plan?.medications.length || 0 })}
      />

      {/* Medications */}
      <View style={styles.section}>
        <SectionHeader title={t('medicationsSection')} count={doseRows.length} />
        <Card padded={false} style={styles.group}>
          {doseRows.length === 0 && (
            <AppText variant="footnote" color="tertiary" style={styles.emptyRow}>
              {status === 'loading' ? t('loadingMedications') : status === 'error' ? t('carePlanError') : t('noMedications')}
            </AppText>
          )}
          {doseRows.map((row, index) => {
            const look = SLOT_STYLE[row.slot];
            const taken = !!loggedDoses[row.key];
            return (
              <React.Fragment key={row.key}>
                {index > 0 && <Divider inset={LIST_ROW_TEXT_INSET} />}
                <ListRow
                  icon={look.icon}
                  iconTone={look.tone}
                  title={row.med.name}
                  subtitle={[row.med.dosage, row.med.timing].filter(Boolean).join(' • ')}
                  trailing={
                    <Pressable
                      onPress={() => toggleDose(row)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: taken }}
                      accessibilityLabel={t('markDoseTaken', { name: row.med.name })}
                      hitSlop={4}
                      style={({ pressed }) => [styles.doseBtn, taken && styles.doseBtnTaken, pressed && styles.pressed]}
                    >
                      {taken && <Icon name="check" size={16} color={colors.onTint} />}
                      <AppText variant="footnote" weight={600} color={taken ? 'onTint' : 'blue'} compact>
                        {taken ? t('taken') : t('take')}
                      </AppText>
                    </Pressable>
                  }
                >
                  <Badge label={t(look.time)} tone={look.tone} icon="schedule" style={styles.slotBadge} />
                </ListRow>
              </React.Fragment>
            );
          })}
        </Card>
        {saveError && (
          <AppText variant="footnote" color="red" accessibilityRole="alert">
            {saveError}
          </AppText>
        )}
      </View>

      {/* 48-hour recovery check-in */}
      <View style={styles.section}>
        <SectionHeader title={t('recoveryCheckin')} />
        <Card style={styles.checkinCard}>
          <AppText variant="headline">{t('howAreYouFeeling')}</AppText>
          <AppText variant="footnote" color="secondary">
            {t('checkinSub')}
          </AppText>

          <View style={styles.checkinRow} accessibilityRole="radiogroup">
            {CHECKIN_OPTIONS.map((opt) => {
              const selected = followUpStatus === opt.value;
              const c = tones[opt.tone];
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => submitCheckin(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={t(opt.label)}
                  style={({ pressed }) => [
                    styles.checkinBtn,
                    selected && { backgroundColor: c.bg, borderColor: c.fg },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name={opt.icon} size={26} color={selected ? c.fg : colors.secondary} />
                  <AppText
                    variant="footnote"
                    weight={selected ? 700 : 600}
                    color={selected ? c.text : 'secondary'}
                    align="center"
                    compact
                  >
                    {t(opt.label)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {followUpStatus && (
            <View style={styles.recorded}>
              <Icon name="check-circle" size={18} color={colors.greenDeep} />
              <AppText variant="footnote" weight={600} color="greenDeep" style={styles.flex}>
                {t('checkinLogged')}
              </AppText>
            </View>
          )}
        </Card>
      </View>
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
  group: {
    overflow: 'hidden',
  },
  emptyRow: {
    padding: spacing.lg,
  },
  slotBadge: {
    marginTop: spacing.xs,
  },
  doseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.compact - 4,
    minWidth: 72,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: tints.blue,
  },
  doseBtnTaken: {
    backgroundColor: colors.green,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  checkinCard: {
    gap: spacing.sm,
    padding: spacing.xl,
  },
  checkinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  checkinBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 76,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.gray6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  recorded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: tints.green,
  },
});
