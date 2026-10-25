import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing, touch, type Tone } from '../theme/tokens';
import { patientApi, type CarePlan, type CarePlanMedication, type DoseSlot } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { SupportedLanguage, TranslationKey } from '../utils/translations';
import { haptic } from '../utils/haptics';
import { localized } from '../utils/localized';
import { EmptyMedications } from './illustrations';
import { SavedSummaries } from './VisitSummary';
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

export const CarePlanView: React.FC<CarePlanViewProps> = ({ onBack, summariesKey = 0 }) => {
  const { lang, t } = useLanguage();
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [followUpStatus, setFollowUpStatus] = useState<CheckinStatus | null>(null);
  const [loggedDoses, setLoggedDoses] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const buildAudioText = () => {
    const meds = plan?.medications || [];
    if (meds.length === 0) return `${t('audioIntro')} ${t('audioNoMeds')}`;
    const lines = meds.map(
      (m) => `${[m.name, localized(m.dosage, lang), localized(m.frequency, lang), localized(m.timing, lang)].filter(Boolean).join(', ')}.`
    );
    const adviceText = localized(plan?.latest_note?.plan?.advice, lang);
    const advice = adviceText ? ` ${adviceText}.` : '';
    return `${t('audioIntro')} ${lines.join(' ')}${advice}`;
  };

  // Optimistic toggle; rolled back if the save fails
  const toggleDose = async (row: DoseRow) => {
    const taken = !loggedDoses[row.key];
    if (taken) haptic.success();
    else haptic.tap();
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

  const doseRows = buildDoseRows(plan?.medications || []);
  const subtitle = [plan?.doctor_name, localized(plan?.facility, lang)].filter(Boolean).join(' • ');

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={t('home')} onBack={onBack} />

      <ScreenHeader
        icon="medication"
        title={t('carePlan')}
        subtitle={subtitle || (status === 'loading' ? t('loading') : t('noCarePlan'))}
      />

      <SavedSummaries refreshKey={summariesKey} />

      {/* Voice instructions */}
      <AudioListenButton
        variant="card"
        text={buildAudioText}
        title={t('listenInstructions')}
        playingTitle={t('playingAudio')}
        subtitle={t('audioMeta', { count: plan?.medications.length || 0 })}
      />

      {/* Doses: one row per medicine per time slot (the Listen card counts medicines) */}
      <View style={styles.section}>
        <SectionHeader title={t('dosesSection')} count={doseRows.length} />
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
                  <Badge label={t(look.time)} tone={look.tone} icon="clock" style={styles.slotBadge} />
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
  );
};

/** Raised "Take" control; once taken it stays pressed in with a tick. Compact: never stretched to the row. */
export const DoseButton: React.FC<{
  taken: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  lang?: SupportedLanguage;
}> = ({ taken, label, accessibilityLabel, onPress, lang }) => (
  <NeuPressable
    onPress={onPress}
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
);

const styles = StyleSheet.create({
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
  slotBadge: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
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
