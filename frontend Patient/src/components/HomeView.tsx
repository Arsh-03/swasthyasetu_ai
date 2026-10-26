import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import type { NextAppointment, PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatLongDate, localCalendarDate } from '../utils/dates';
import { HeroAppointmentCard, type AppointmentStatus, type PatientAppointmentInfo } from './HeroAppointmentCard';
import { TactileGrid } from './TactileGrid';
import { AppointmentRow } from './doctors/DoctorParts';
import { AppText, Badge, Card, Groove, ScreenScroll, SectionHeader, TertiaryButton } from './ui';

interface HomeViewProps {
  user: PatientUser;
  appointment?: PatientAppointmentInfo;
  appointmentStatus: AppointmentStatus;
  onJoinCall: () => void;
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenPrivacy: () => void;
  onOpenHeartRate: () => void;
  onOpenChat: () => void;
  onTriggerEmergency: () => void;
  /** Upcoming appointments with the patient's other doctors (after the one on the card). */
  otherUpcoming: NextAppointment[];
  onOpenSchedule: () => void;
}

/** "Today" tab: greeting, next appointment, quick actions, SOS and trust badges. */
export const HomeView: React.FC<HomeViewProps> = ({ user, appointment, appointmentStatus, onJoinCall, otherUpcoming, onOpenSchedule, ...gridActions }) => {
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

      {otherUpcoming.length > 0 && (
        <View style={styles.others}>
          <SectionHeader
            title={t('otherUpcoming')}
            icon="calendar"
            count={otherUpcoming.length}
            action={<TertiaryButton label={t('seeAll')} size="sm" onPress={onOpenSchedule} />}
          />
          <Card padded={false}>
            {otherUpcoming.slice(0, 3).map((apt, i) => (
              <React.Fragment key={apt.appointmentId}>
                {i > 0 && <Groove inset={spacing.md} />}
                <AppointmentRow apt={apt} />
              </React.Fragment>
            ))}
          </Card>
        </View>
      )}

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
  others: {
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
