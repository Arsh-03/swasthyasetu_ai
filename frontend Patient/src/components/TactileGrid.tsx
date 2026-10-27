import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { CriticalButton, MetricCard, SectionHeader } from './ui';
import { useScripts } from '../speech';

interface TactileGridProps {
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenPrivacy: () => void;
  onOpenHeartRate: () => void;
  onOpenChat: () => void;
  onTriggerEmergency: () => void;
}

/** 2×2 quick actions (raised metric cards) plus the SOS critical action. */
export const TactileGrid: React.FC<TactileGridProps> = ({
  onOpenDoctors,
  onOpenRecords,
  onOpenMedicines,
  onOpenPrivacy,
  onOpenHeartRate,
  onOpenChat,
  onTriggerEmergency,
}) => {
  const { t } = useLanguage();

  const scripts = useScripts();

  return (
    <View style={styles.container}>
      <SectionHeader title={t('quickActions')} speech={scripts.home.quickActions} />

      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.myDoctors}
          compact
          equalHeight
          label={t('myDoctorsCaption')}
          value={t('myDoctors')}
          icon="doctor"
          tone="primary"
          onPress={onOpenDoctors}
        />
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.myRecords}
          compact
          equalHeight
          label={t('myRecordsCaption')}
          value={t('myRecords')}
          icon="records"
          tone="primary"
          onPress={onOpenRecords}
        />
      </View>
      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.medicines}
          compact
          equalHeight
          label={t('medicinesCaption')}
          value={t('medicines')}
          icon="medication"
          tone="success"
          onPress={onOpenMedicines}
        />
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.privacy}
          compact
          equalHeight
          label={t('privacyCaption')}
          value={t('tabPrivacy')}
          icon="shieldCheck"
          tone="navy"
          onPress={onOpenPrivacy}
        />
      </View>

      <View style={styles.gridRow}>
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.heartRate}
          compact
          equalHeight
          label={t('heartRateCaption')}
          value={t('heartRate')}
          icon="heartbeat"
          tone="danger"
          onPress={onOpenHeartRate}
        />
        <MetricCard
          layout="stacked"
          style={styles.tile}
          speech={scripts.home.messageDoctor}
          compact
          equalHeight
          label={t('messageDoctorCaption')}
          value={t('messageDoctor')}
          icon="chat"
          tone="primary"
          onPress={onOpenChat}
        />
      </View>

      {/* Emergency SOS: critical action */}
      <CriticalButton
        tone="danger"
        icon="emergency"
        label={t('emergencySos')}
        sublabel={t('emergencySosCaption')}
        onPress={onTriggerEmergency}
        speech={scripts.home.sos}
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
