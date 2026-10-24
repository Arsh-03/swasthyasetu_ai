import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import type { PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { HeroAppointmentCard, type PatientAppointmentInfo } from './HeroAppointmentCard';
import { TactileGrid } from './TactileGrid';
import { AppText, Icon, ScreenScroll } from './ui';

const LOCALE = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' } as const;

interface HomeViewProps {
  user: PatientUser;
  appointment?: PatientAppointmentInfo;
  onJoinCall: () => void;
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenFollowUp: () => void;
  onTriggerEmergency: () => void;
}

/** "Today" tab: greeting, next-appointment inspector card, quick actions and SOS. */
export const HomeView: React.FC<HomeViewProps> = ({ user, appointment, onJoinCall, ...gridActions }) => {
  const { lang, t } = useLanguage();
  const firstName = user.full_name?.split(' ')[0] || '';
  const today = new Date().toLocaleDateString(LOCALE[lang], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <ScreenScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.greeting}>
        <AppText variant="eyebrow" color="tertiary" compact>
          {today}
        </AppText>
        <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
          {t('greeting', { name: firstName })}
        </AppText>
      </View>

      <HeroAppointmentCard onJoinCall={onJoinCall} appointment={appointment} />

      <TactileGrid {...gridActions} />

      {/* ABDM & DPDP Act 2023 reassurance */}
      <View style={styles.footer}>
        <Icon name="verified-user" size={14} color={colors.tertiary} />
        <AppText variant="caption" color="tertiary" align="center" style={styles.footerText}>
          {t('complianceFooter')}
        </AppText>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    flexShrink: 1,
  },
});
