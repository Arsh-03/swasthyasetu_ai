import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { AppText, Badge, Card, Icon, PrimaryButton, Well } from './ui';

export interface PatientAppointmentInfo {
  date: string;
  time: string;
  relativeTime?: string;
  doctorName?: string;
  clinic?: string;
  wait?: string;
  agenda?: string;
  isRescheduled?: boolean;
}

interface HeroAppointmentCardProps {
  onJoinCall: () => void;
  appointment?: PatientAppointmentInfo;
}

// Same portrait used on the video call screen
const DOCTOR_PHOTO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCNL4BMuLtJ2i8g6NTnwHeQCHuAOBoVH2a0-_LYQNHlpps-NYI7Zm0kJOS83_2mfT6iW0VmrLR_Ws1XWJQkqFvMdbLIdoytlvHdKWy4oymsMvJiix6ZCfnabbIW2pz4OVbBjAvjRwZlJrf3ptnODgtdPMIvvwU5TOI47tgVHvDdfaHFPeZZKaZ1uf0iQ6sHQIuhtUA6yt256idRVh9J47qEBF8ZhGzRWVzPeff2xX0xQ_aOPSGolBYQfw';

/** Mobile version of the Doctor queue's patient inspector card, for the next appointment. */
export const HeroAppointmentCard: React.FC<HeroAppointmentCardProps> = ({ onJoinCall, appointment }) => {
  const { t } = useLanguage();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isRescheduled = appointment?.isRescheduled;

  return (
    <Card style={[styles.card, isRescheduled && styles.cardRescheduled]}>
      {/* Header: doctor portrait, time, doctor and clinic */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {avatarFailed ? (
            <Icon name="person" size={32} color={colors.tertiary} />
          ) : (
            <Image
              source={{ uri: DOCTOR_PHOTO_URL }}
              style={styles.avatarImage}
              onError={() => setAvatarFailed(true)}
              accessibilityIgnoresInvertColors
            />
          )}
        </View>
        <View style={styles.headerText}>
          <AppText variant="eyebrow" color="tertiary" compact>
            {t('nextAppointment')}
          </AppText>
          <AppText variant="title">{appointment?.time || '—'}</AppText>
          <AppText variant="callout" numberOfLines={1}>
            {appointment?.doctorName || t('noDoctorAssigned')}
          </AppText>
          <AppText variant="footnote" color="secondary" numberOfLines={2}>
            {appointment?.clinic || t('joinQueueHint')}
          </AppText>
        </View>
      </View>

      {/* Status badges */}
      <View style={styles.badges}>
        {isRescheduled ? (
          <>
            <Badge label={t('rescheduledByClinician')} tone="blue" icon="event-repeat" size="md" />
            <Badge label={t('newTime')} tone="green" icon="schedule" size="md" />
          </>
        ) : (
          <Badge label={`${t('waitLabel')}: ${appointment?.wait || '—'}`} tone="orange" icon="hourglass-top" size="md" />
        )}
      </View>

      {/* Inset details panel */}
      <Well style={styles.well}>
        <View style={styles.wellCol}>
          <AppText variant="eyebrow" color="tertiary" compact>
            {t('appointmentDate')}
          </AppText>
          <AppText variant="subhead" weight={600}>
            {appointment?.date || t('noAppointment')}
          </AppText>
        </View>
        <View style={styles.wellDivider} />
        <View style={styles.wellCol}>
          <AppText variant="eyebrow" color="tertiary" compact>
            {t('agenda')}
          </AppText>
          <AppText variant="subhead" weight={600} numberOfLines={2}>
            {appointment?.agenda || '—'}
          </AppText>
        </View>
      </Well>

      <PrimaryButton label={t('joinConsultationCall')} icon="videocam" onPress={onJoinCall} />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardRescheduled: {
    borderColor: colors.blue,
    backgroundColor: tints.blueSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.gray6,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerText: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  well: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wellCol: {
    flex: 1,
    gap: 2,
  },
  wellDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});
