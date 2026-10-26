import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { CriticalButton, MetricCard, SectionHeader } from './ui';

interface TactileGridProps {
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenFollowUp: () => void;
  onOpenHeartRate: () => void;
  onOpenChat: () => void;
  onTriggerEmergency: () => void;
}

/** 2×2 quick actions (raised metric cards) plus the SOS critical action. */
export const TactileGrid: React.FC<TactileGridProps> = ({
  onOpenDoctors,
  onOpenRecords,
  onOpenMedicines,
  onOpenFollowUp,
  onOpenHeartRate,
  onOpenChat,
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
          equalHeight
          label={t('myDoctorsCaption')}
          value={t('myDoctors')}
          icon="doctor"
          tone="primary"
          onPress={onOpenDoctors}
          style={styles.tile}
        />
        <MetricCard
          layout="stacked"
          compact
          equalHeight
          label={t('myRecordsCaption')}
          value={t('myRecords')}
          icon="records"
          tone="primary"
          onPress={onOpenRecords}
          style={styles.tile}
        />
      </View>
      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          compact
          equalHeight
          label={t('medicinesCaption')}
          value={t('medicines')}
          icon="medication"
          tone="success"
          onPress={onOpenMedicines}
          style={styles.tile}
        />
        <MetricCard
          layout="stacked"
          compact
          equalHeight
          label={t('followUpCaption')}
          value={t('followUp')}
          icon="calendar"
          tone="warning"
          onPress={onOpenFollowUp}
          style={styles.tile}
        />
      </View>

      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          compact
          equalHeight
          label={t('heartRateCaption')}
          value={t('heartRate')}
          icon="heartbeat"
          tone="danger"
          onPress={onOpenHeartRate}
          style={styles.tile}
        />
        <MetricCard
          layout="stacked"
          compact
          equalHeight
          label={t('messageDoctorCaption')}
          value={t('messageDoctor')}
          icon="chat"
          tone="primary"
          onPress={onOpenChat}
          style={styles.tile}
        />
      </View>

      {/* Emergency SOS: critical action */}
      <CriticalButton
        tone="danger"
        icon="emergency"
        label={t('emergencySos')}
        sublabel={t('emergencySosCaption')}
        onPress={onTriggerEmergency}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
  },
});
