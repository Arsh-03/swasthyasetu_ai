import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints } from '../../theme/tokens';
import type { CarePlanMedication, DoseSlot } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { resolveMedicationInfo, getMedicationSpeechText } from '../../utils/medicationInfo';
import { Speakable, speakFor, stopSpeech, useSpeechSelector } from '../../speech';
import { haptic } from '../../utils/haptics';
import { doctorShortName } from '../../utils/departments';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { NeuPressable } from '../ui/Neu';
import { DoseButton } from './DoseButton';
import { DepartmentBadge } from '../doctors/DoctorParts';
import { MedicationFormTile } from './MedicationFormVisual';

interface MedicationCardProps {
  med: CarePlanMedication;
  slot: DoseSlot;
  taken: boolean;
  onToggleDose: () => void;
  onPress: () => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  med,
  slot,
  taken,
  onToggleDose,
  onPress,
}) => {
  const { lang, t } = useLanguage();
  // Listen button shares the double-tap engine (one reading at a time)
  const listenId = useId();
  const isPlaying = useSpeechSelector((st) => st.speakingId === listenId);

  const info = resolveMedicationInfo(med, lang);

  const handleSpeakerPress = () => {
    haptic.tap();
    if (isPlaying) {
      stopSpeech();
      return;
    }
    speakFor(listenId, getMedicationSpeechText(med, slot, lang));
  };

  const prescriberName = doctorShortName(med.prescriber?.name || med.prescribedBy || '');
  const department = med.prescriber?.department || '';

  return (
    <Speakable
      onPress={onPress}
      speech={() => getMedicationSpeechText(med, slot, lang)}
      radius={radii.lg}
      accessibilityLabel={`${info.purposePatient}, ${info.shortName}. ${t('tapForDetails')}`}
      style={({ pressed }) => [
        styles.cardContainer,
        taken && styles.cardTaken,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.topRow}>
        {/* Visual Form Tile in coloured scheme */}
        <MedicationFormTile form={info.form} size={54} active={!taken} />

        {/* Center column: Lead with Purpose */}
        <View style={styles.contentCol}>
          {/* 1. Leading Purpose */}
          <AppText variant="headline" weight={700} color={taken ? 'inkMuted' : 'ink'} numberOfLines={2}>
            {info.purposePatient}
          </AppText>

          {/* 2. Everyday Short Name & Strength */}
          <View style={styles.nameRow}>
            <AppText variant="callout" weight={600} color="tealDeep">
              {info.shortName}
            </AppText>
            <AppText variant="callout" color="inkMuted">
              • {info.doseAmount}
            </AppText>
          </View>

          {/* 3. Clinical Chemical Name (smaller, lighter text so nothing is lost) */}
          <AppText variant="caption" color="inkMuted" numberOfLines={2} style={styles.clinicalName}>
            {t('clinicalName')}: {med.name}
          </AppText>
        </View>

        {/* Right column: Raised Take / Taken Button */}
        <View style={styles.actionCol}>
          <DoseButton
            taken={taken}
            label={taken ? t('taken') : t('take')}
            accessibilityLabel={t('markDoseTaken', { name: info.shortName })}
            speechName={info.shortName}
            onPress={onToggleDose}
            lang={lang}
          />
        </View>
      </View>

      {/* Visual Instruction Badges (Meal, Water, Bedtime) */}
      <View style={styles.badgeRow}>
        {info.mealRelation === 'after_food' && (
          <Badge icon="bowlFood" label={t('badgeAfterMeals')} tone="teal" />
        )}
        {info.mealRelation === 'with_food' && (
          <Badge icon="bowlFood" label={t('badgeWithMeals')} tone="teal" />
        )}
        {info.mealRelation === 'bedtime' && (
          <Badge icon="bed" label={t('badgeBedtime')} tone="primary" />
        )}
        {info.mealRelation === 'before_food' && (
          <Badge icon="bowlFood" label={t('badgeBeforeMeals')} tone="warning" />
        )}

        {info.intakeMethod === 'with_water' && (
          <Badge icon="drop" label={t('badgeWithWater')} tone="navy" />
        )}

        {slot === 'morning' && <Badge icon="clock" label="8:00 AM" tone="neutral" />}
        {slot === 'afternoon' && <Badge icon="clock" label="1:30 PM" tone="neutral" />}
        {slot === 'night' && <Badge icon="clock" label="8:30 PM" tone="neutral" />}
      </View>

      {/* Doctor Name & Specialty Chip (stays on card as required) */}
      <View style={styles.footerRow}>
        <View style={styles.doctorInfo}>
          {prescriberName ? (
            <AppText variant="caption" color="inkMuted" numberOfLines={1}>
              {t('prescribedBy', { name: prescriberName })}
            </AppText>
          ) : null}
          {department ? <DepartmentBadge department={department} /> : null}
        </View>

        {/* Small Speaker Read-Aloud Button */}
        <NeuPressable
          onPress={handleSpeakerPress}
          atomic
          haptics="none"
          selected={isPlaying}
          fill={isPlaying ? colors.primary : colors.audioBg}
          radius={radii.pill}
          accessibilityLabel={isPlaying ? t('stop') : t('listenMedicationCard')}
          style={styles.speakerBtn}
        >
          <Icon
            name={isPlaying ? 'stop' : 'listen'}
            size={16}
            color={isPlaying ? colors.onPrimary : colors.audioText}
            active
          />
          <AppText
            variant="caption"
            weight={700}
            color={isPlaying ? 'onPrimary' : 'audioText'}
          >
            {isPlaying ? t('stop') : t('listen')}
          </AppText>
        </NeuPressable>
      </View>
    </Speakable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTaken: {
    backgroundColor: '#FAFCFC',
    borderColor: '#D4E4E6',
    opacity: 0.88,
  },
  cardPressed: {
    transform: [{ scale: 0.992 }],
    borderColor: colors.teal,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  contentCol: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 1,
  },
  clinicalName: {
    marginTop: 2,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  actionCol: {
    marginLeft: spacing.xs,
    alignSelf: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  speakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-end',
  },
});
