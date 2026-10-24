import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, shadows, spacing, tints, touch } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { AppText, Icon, IconTile, MetricCard, SectionHeader } from './ui';

interface TactileGridProps {
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenFollowUp: () => void;
  onTriggerEmergency: () => void;
}

/** 2×2 quick actions in the Doctor queue's metric-card style, plus the SOS bar. */
export const TactileGrid: React.FC<TactileGridProps> = ({
  onOpenDoctors,
  onOpenRecords,
  onOpenMedicines,
  onOpenFollowUp,
  onTriggerEmergency,
}) => {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <SectionHeader title={t('quickActions')} />

      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          compact
          label={t('myDoctorsCaption')}
          value={t('myDoctors')}
          icon="medical-services"
          tone="blue"
          onPress={onOpenDoctors}
          style={styles.tile}
        />
        <MetricCard
          layout="stacked"
          compact
          label={t('myRecordsCaption')}
          value={t('myRecords')}
          icon="folder-open"
          tone="indigo"
          onPress={onOpenRecords}
          style={styles.tile}
        />
      </View>
      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          compact
          label={t('medicinesCaption')}
          value={t('medicines')}
          icon="medication"
          tone="green"
          onPress={onOpenMedicines}
          style={styles.tile}
        />
        <MetricCard
          layout="stacked"
          compact
          label={t('followUpCaption')}
          value={t('followUp')}
          icon="event"
          tone="orange"
          onPress={onOpenFollowUp}
          style={styles.tile}
        />
      </View>

      {/* Emergency SOS bar */}
      <Pressable
        onPress={() => {
          haptic.warning();
          onTriggerEmergency();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('emergencySos')}, ${t('emergencySosCaption')}`}
        style={({ pressed }) => [styles.sos, pressed && styles.sosPressed]}
      >
        <IconTile icon="emergency" tone="red" />
        <View style={styles.sosText}>
          <AppText variant="callout" weight={700} color="red">
            {t('emergencySos')}
          </AppText>
          <AppText variant="footnote" color="secondary">
            {t('emergencySosCaption')}
          </AppText>
        </View>
        <View style={styles.callCircle}>
          <Icon name="call" size={22} color={colors.onTint} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
  },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: tints.redRing,
    ...shadows.sm,
  },
  sosPressed: {
    backgroundColor: tints.red,
    transform: [{ scale: 0.98 }],
  },
  sosText: {
    flex: 1,
  },
  callCircle: {
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
