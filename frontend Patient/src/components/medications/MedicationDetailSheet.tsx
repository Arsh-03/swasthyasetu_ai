import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints } from '../../theme/tokens';
import type { CarePlanMedication, DoseSlot } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { localized } from '../../utils/localized';
import { resolveMedicationInfo, getMedicationSpeechText } from '../../utils/medicationInfo';
import { speak, stopSpeaking } from '../../utils/speech';
import { haptic } from '../../utils/haptics';
import { GlassSheet } from '../glass/GlassSheet';
import { SheetHeader } from '../ui/SheetHeader';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { NeuPressable } from '../ui/Neu';
import { SecondaryButton } from '../ui/Buttons';
import { DepartmentBadge } from '../doctors/DoctorParts';
import { doctorShortName } from '../../utils/departments';
import { MedicationFormHero } from './MedicationFormVisual';

interface MedicationDetailSheetProps {
  visible: boolean;
  med: CarePlanMedication | null;
  slot: DoseSlot | null;
  onClose: () => void;
}

export const MedicationDetailSheet: React.FC<MedicationDetailSheetProps> = ({
  visible,
  med,
  slot,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!med) return null;

  const info = resolveMedicationInfo(med, lang);
  const effectiveSlot = slot || 'morning';

  const formKeyMap: Record<string, any> = {
    tablet: 'formTablet',
    syrup: 'formSyrup',
    capsule: 'formCapsule',
    drops: 'formDrops',
    injection: 'formInjection',
  };
  const formKey = formKeyMap[info.form] || 'formTablet';

  const prescriberName = doctorShortName(med.prescriber?.name || med.prescribedBy || '');
  const department = med.prescriber?.department || '';

  const handleCopyName = () => {
    haptic.tap();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(med.name);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const toggleSpeech = () => {
    haptic.tap();
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    const text = getMedicationSpeechText(med, effectiveSlot, lang);
    const started = speak(text, lang, () => setIsPlaying(false));
    setIsPlaying(started);
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} closeOnBackdrop placement="bottom">
      <SheetHeader
        title={info.purposePatient}
        subtitle={`${info.shortName} • ${t(formKey)}`}
        icon="medication"
        onClose={onClose}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollContainer}
      >
        {/* Large visual illustration of medicine form */}
        <MedicationFormHero form={info.form} width={180} height={120} />

        {/* Audio read-aloud button for elderly / low literacy patients */}
        <NeuPressable
          onPress={toggleSpeech}
          haptics="tap"
          selected={isPlaying}
          fill={colors.audioBg}
          radius={radii.md}
          accessibilityLabel={t('listenMedicationCard')}
          style={styles.audioBar}
        >
          <Icon name={isPlaying ? 'stop' : 'listen'} size={22} color={colors.audioText} active />
          <View style={styles.audioBarText}>
            <AppText variant="subhead" weight={700} color="audioText">
              {isPlaying ? t('stop') : t('listenMedicationCard')}
            </AppText>
            <AppText variant="caption" color="audioText">
              {isPlaying ? t('playingAudio') : `${info.shortName} • ${info.purposePatient}`}
            </AppText>
          </View>
        </NeuPressable>

        {/* Section 1: What this medicine is for */}
        <Card style={styles.infoCard}>
          <View style={styles.sectionTitleRow}>
            <Icon name="sparkle" size={18} color={colors.teal} active />
            <AppText variant="headline" weight={700} color="ink">
              {t('whatIsThisFor')}
            </AppText>
          </View>

          <AppText variant="body" color="ink" style={styles.bodyText}>
            {info.purposeDetail}
          </AppText>

          {prescriberName ? (
            <View style={styles.prescriberRow}>
              <Icon name="doctor" size={16} color={colors.inkMuted} />
              <AppText variant="footnote" color="inkMuted">
                {t('prescribedByDoctor', { name: prescriberName })}
              </AppText>
              {department ? <DepartmentBadge department={department} /> : null}
            </View>
          ) : null}
        </Card>

        {/* Section 2: How and when to take */}
        <Card style={styles.infoCard}>
          <View style={styles.sectionTitleRow}>
            <Icon name="clock" size={18} color={colors.primary} active />
            <AppText variant="headline" weight={700} color="ink">
              {t('howToTake')}
            </AppText>
          </View>

          {/* Structured icons checklist */}
          <View style={styles.checklist}>
            <View style={styles.checkItem}>
              <View style={[styles.checkDisc, { backgroundColor: tints.primary }]}>
                <Icon
                  name={effectiveSlot === 'night' ? 'bed' : 'bowlFood'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.checkText}>
                <AppText variant="subhead" weight={700} color="ink">
                  {effectiveSlot === 'morning'
                    ? t('slotMealMorning')
                    : effectiveSlot === 'afternoon'
                    ? t('slotMealAfternoon')
                    : effectiveSlot === 'night'
                    ? t('slotMealNight')
                    : t('routinePrnTime')}
                </AppText>
                <AppText variant="caption" color="inkMuted">
                  {info.timingLabel}
                </AppText>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={[styles.checkDisc, { backgroundColor: tints.teal }]}>
                <Icon name="drop" size={18} color={colors.teal} />
              </View>
              <View style={styles.checkText}>
                <AppText variant="subhead" weight={700} color="ink">
                  {info.doseAmount}
                </AppText>
                <AppText variant="caption" color="inkMuted">
                  {info.intakeMethod === 'with_water' ? t('badgeWithWater') : t('howToTake')}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.guidanceBox}>
            <AppText variant="footnote" color="ink">
              💡 {info.howToTake}
            </AppText>
          </View>
        </Card>

        {/* Section 3: Show to Pharmacist (Chemist view) */}
        <View style={styles.pharmacistCard}>
          <View style={styles.pharmacistHeader}>
            <View style={styles.rxBadge}>
              <Icon name="medication" size={18} color={colors.onPrimary} active />
              <AppText variant="caption" weight={700} color="onPrimary">
                Rx
              </AppText>
            </View>
            <View style={styles.pharmacistHeaderText}>
              <AppText variant="subhead" weight={700} color="tealDeep">
                {t('showToPharmacist')}
              </AppText>
              <AppText variant="caption" color="inkMuted">
                {t('showToPharmacistSub')}
              </AppText>
            </View>
          </View>

          <View style={styles.pharmacistBody}>
            <View style={styles.fieldRow}>
              <AppText variant="caption" weight={600} color="inkMuted">
                {t('exactClinicalFormula')}:
              </AppText>
              <AppText variant="headline" weight={700} color="ink" selectable>
                {med.name}
              </AppText>
            </View>

            <View style={styles.fieldRow}>
              <AppText variant="caption" weight={600} color="inkMuted">
                Strength / Dosage:
              </AppText>
              <AppText variant="subhead" weight={700} color="tealDeep">
                {[localized(med.dosage, lang), localized(med.frequency, lang)].filter(Boolean).join(' • ')}
              </AppText>
            </View>

            {prescriberName ? (
              <View style={styles.fieldRow}>
                <AppText variant="caption" weight={600} color="inkMuted">
                  Prescriber:
                </AppText>
                <AppText variant="subhead" color="ink">
                  {med.prescriber?.name || med.prescribedBy} {department ? `(${department})` : ''}
                </AppText>
              </View>
            ) : null}

            {med.duration ? (
              <View style={styles.fieldRow}>
                <AppText variant="caption" weight={600} color="inkMuted">
                  Course Duration:
                </AppText>
                <AppText variant="subhead" color="ink">
                  {localized(med.duration, lang)}
                </AppText>
              </View>
            ) : null}
          </View>

          <SecondaryButton
            label={copied ? t('copiedClinicalName') : '📋 Copy Clinical Name'}
            tone={copied ? 'success' : 'primary'}
            size="sm"
            onPress={handleCopyName}
            style={styles.copyBtn}
          />
        </View>
      </ScrollView>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    maxHeight: 560,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.audioBg,
  },
  audioBarText: {
    flex: 1,
  },
  infoCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bodyText: {
    lineHeight: 22,
  },
  prescriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checklist: {
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
  },
  guidanceBox: {
    backgroundColor: '#F3F7F8',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  pharmacistCard: {
    backgroundColor: '#F7FBFA',
    borderWidth: 2,
    borderColor: '#73A5B0',
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pharmacistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rxBadge: {
    backgroundColor: colors.teal,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pharmacistHeaderText: {
    flex: 1,
  },
  pharmacistBody: {
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  fieldRow: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  copyBtn: {
    alignSelf: 'stretch',
  },
});
