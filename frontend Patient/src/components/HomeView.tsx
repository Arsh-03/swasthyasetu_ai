import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import type { PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatLongDate, localCalendarDate } from '../utils/dates';
import { HeroAppointmentCard, type AppointmentStatus, type PatientAppointmentInfo } from './HeroAppointmentCard';
import { TactileGrid } from './TactileGrid';
import { AppText, Badge, ScreenScroll } from './ui';

interface HomeViewProps {
  user: PatientUser;
  appointment?: PatientAppointmentInfo;
  appointmentStatus: AppointmentStatus;
  onJoinCall: () => void;
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenFollowUp: () => void;
  onOpenHeartRate: () => void;
  onOpenChat: () => void;
  onTriggerEmergency: () => void;
}

/** "Today" tab: greeting, next appointment, quick actions, SOS and trust badges. */
export const HomeView: React.FC<HomeViewProps> = ({ user, appointment, appointmentStatus, onJoinCall, ...gridActions }) => {
  const { lang, t } = useLanguage();
  const firstName = user.full_name?.split(' ')[0] || '';
  // Full localised weekday + month (tables, not device Intl: Hermes ICU data varies on Android)
  const today = formatLongDate(localCalendarDate(), lang, false);

  return (
    <ScreenScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.greeting}>
        <AppText variant="eyebrow" color="inkMuted" compact>
          {today}
        </AppText>
        <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
          {t('greeting', { name: firstName })}
        </AppText>
      </View>

      <HeroAppointmentCard onJoinCall={onJoinCall} appointment={appointment} status={appointmentStatus} />

      <TactileGrid {...gridActions} />

      {/* ABDM & DPDP reassurance as badges; the full sentence goes to screen readers */}
      <View style={styles.footer} accessible accessibilityLabel={t('complianceFooter')}>
        <Badge label={t('badgeAbdm')} tone="gold" icon="verified" solid />
        <Badge label={t('badgeDpdp')} tone="primary" icon="shieldCheck" solid />
      </View>
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  greeting: {
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
