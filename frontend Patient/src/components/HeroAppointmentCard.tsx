import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { EmptyAppointments } from './illustrations';
import { parseDateLabel, parseTimeLabel, relativeDay, formatLongDate, daysAgoKey, inDaysKey } from '../utils/dates';
import { localized, type LocalizedText } from '../utils/localized';
import { departmentName } from '../utils/departments';
import { DepartmentBadge, DoctorAvatar } from './doctors/DoctorParts';
import { AppText, AudioListenButton, Badge, CriticalButton, ExpandableText, Groove, Icon, IconDisc, type IconName, NeuInset, NeuPanel } from './ui';

export interface PatientAppointmentInfo {
  date: string;
  time: string;
  /** Backend text: a string or { en, kn, hi } (resolved with `localized`). */
  relativeTime?: LocalizedText;
  doctorName?: string;
  facility?: LocalizedText;
  specialty?: LocalizedText;
  agenda?: LocalizedText;
  isRescheduled?: boolean;
  meetingCode?: string | null;
  /** Which of the patient's doctors, their OPD department and video / in-person. */
  practitionerId?: string | null;
  department?: string;
  mode?: string;
}

export type AppointmentStatus = 'loading' | 'ready' | 'error';

interface HeroAppointmentCardProps {
  onJoinCall: () => void;
  appointment?: PatientAppointmentInfo;
  /** Load state of the next-appointment request (an appointment, if present, always wins). */
  status: AppointmentStatus;
}

// Same portrait used on the video call screen
const DOCTOR_PHOTO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCNL4BMuLtJ2i8g6NTnwHeQCHuAOBoVH2a0-_LYQNHlpps-NYI7Zm0kJOS83_2mfT6iW0VmrLR_Ws1XWJQkqFvMdbLIdoytlvHdKWy4oymsMvJiix6ZCfnabbIW2pz4OVbBjAvjRwZlJrf3ptnODgtdPMIvvwU5TOI47tgVHvDdfaHFPeZZKaZ1uf0iQ6sHQIuhtUA6yt256idRVh9J47qEBF8ZhGzRWVzPeff2xX0xQ_aOPSGolBYQfw';

/**
 * Next appointment, visual-first: big serif time, doctor portrait in an inset frame, one
 * status badge, date and agenda as icon rows, a Listen button for the whole card, and the
 * Join call critical action. Loading / none / error use the EmptyAppointments illustration.
 */
export const HeroAppointmentCard: React.FC<HeroAppointmentCardProps> = ({ onJoinCall, appointment, status }) => {
  const { lang, t } = useLanguage();
  const join = <CriticalButton tone="primary" label={t('joinConsultationCall')} icon="video" onPress={onJoinCall} />;
  const inPersonVisit = !!appointment?.mode && !appointment.mode.toLowerCase().includes('video');

  if (!appointment) {
    return (
      <NeuPanel radius={radii.xl} style={styles.card}>
        <AppText variant="eyebrow" color="inkMuted" compact>
          {t('nextAppointment')}
        </AppText>
        <View style={styles.emptyBody} accessibilityLiveRegion="polite">
          <EmptyAppointments width={150} />
          {status === 'loading' ? (
            <View style={styles.inline}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="subhead" weight={600}>
                {t('loading')}
              </AppText>
            </View>
          ) : status === 'error' ? (
            <View style={styles.inline} accessibilityRole="alert">
              <Icon name="network" size={20} color={colors.warningDeep} active />
              <AppText variant="subhead" weight={600} color="warningDeep" style={styles.shrink}>
                {t('appointmentError')}
              </AppText>
            </View>
          ) : (
            <AppText variant="headline" align="center">
              {t('noAppointment')}
            </AppText>
          )}
          <AppText variant="footnote" color="inkMuted" align="center">
            {t('joinQueueHint')}
          </AppText>
        </View>
        {join}
      </NeuPanel>
    );
  }

  const doctor = appointment.doctorName || t('noDoctorAssigned');
  // Parsed calendar date → full localised date; unparsable labels are shown as sent
  const calendar = parseDateLabel(appointment.date);
  const dateText = calendar ? formatLongDate(calendar, lang) : appointment.date || '—';
  const dept = departmentName(appointment.department, lang);
  const inPerson = !!appointment.mode && !appointment.mode.toLowerCase().includes('video');
  const clinic = localized(appointment.facility, lang) || localized(appointment.specialty, lang);
  const agenda = localized(appointment.agenda, lang);
  const spoken = () =>
    [t('appointmentSpoken', { time: appointment.time, date: dateText, doctor }), dept, clinic, agenda]
      .filter(Boolean)
      .join('. ');

  return (
    <NeuPanel radius={radii.xl} style={styles.card}>
      <View style={styles.topRow}>
        <AppText variant="eyebrow" color="inkMuted" compact style={styles.shrink}>
          {t('nextAppointment')}
        </AppText>
        <AudioListenButton text={spoken} />
      </View>

      {/* Time + doctor */}
      <View style={styles.header}>
        {/* The demo portrait belongs to Dr. Ananya; every other doctor gets their initials */}
        {/ananya/i.test(doctor) ? <DoctorPortrait /> : <DoctorAvatar name={doctor} department={appointment.department} size={72} />}
        <View style={styles.headerText}>
          <AppointmentTime label={appointment.time} />
          <AppText variant="callout" numberOfLines={2}>
            {doctor}
          </AppText>
          {clinic ? (
            <AppText variant="footnote" color="inkMuted" numberOfLines={2}>
              {clinic}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Status at a glance: when (computed on device), plus reschedule if flagged */}
      <View style={styles.badges}>
        <RelativeBadge date={appointment.date} time={appointment.time} fallback={localized(appointment.relativeTime, lang)} />
        {appointment.department ? <DepartmentBadge department={appointment.department} size="md" /> : null}
        {inPerson ? <Badge label={t('visitInPerson')} tone="teal" icon="hospital" size="md" /> : null}
        {appointment.isRescheduled ? (
          <>
            <Badge label={t('rescheduledByClinician')} tone="primary" icon="rescheduled" size="md" />
            <Badge label={t('newTime')} tone="success" icon="clock" size="md" />
          </>
        ) : null}
      </View>

      {/* Date and agenda as icon rows on the panel (labels go to screen readers) */}
      <View>
        <DetailRow icon="calendar" label={t('appointmentDate')} value={dateText} />
        {agenda ? (
          <>
            <Groove inset={48} />
            <DetailRow icon="clipboard" label={t('agenda')} value={agenda} expandable />
          </>
        ) : null}
      </View>

      {inPersonVisit ? (
        <View style={styles.inline}>
          <Icon name="mapPin" size={18} color={colors.inkMuted} />
          <AppText variant="footnote" color="inkMuted" style={styles.shrink}>
            {t('inPersonAt', { place: localized(appointment.facility, lang) || t('theClinic') })}
          </AppText>
        </View>
      ) : (
        join
      )}
    </NeuPanel>
  );
};

/** Doctor photo in an inset frame (falls back to a stethoscope glyph). */
const DoctorPortrait: React.FC = () => {
  const [failed, setFailed] = useState(false);
  return (
    <NeuInset radius={36} strength="soft" style={styles.portrait}>
      {failed ? (
        <Icon name="doctor" size={30} color={colors.primary} active />
      ) : (
        <Image source={{ uri: DOCTOR_PHOTO_URL }} style={styles.portraitImage} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      )}
    </NeuInset>
  );
};

const DetailRow: React.FC<{ icon: IconName; label: string; value: string; expandable?: boolean }> = ({ icon, label, value, expandable }) => (
  <View style={styles.detailRow} accessible={!expandable} accessibilityLabel={expandable ? undefined : `${label}: ${value}`}>
    <IconDisc icon={icon} size={36} variant="inset" />
    {expandable ? (
      // No silent truncation: 3 lines + Read more / Show less (Listen reads the full text)
      <ExpandableText variant="subhead" weight={600} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </ExpandableText>
    ) : (
      <AppText variant="subhead" weight={600} style={styles.shrink}>
        {value}
      </AppText>
    )}
  </View>
);

/**
 * "10:30 AM" on one line in the display serif (Fraunces in every language: it is a Latin run)
 * with the zone as a smaller suffix; shrinks to fit rather than wrapping.
 */
export const AppointmentTime: React.FC<{ label: string }> = ({ label }) => {
  const { t } = useLanguage();
  const parsed = parseTimeLabel(label);
  return (
    <View style={styles.timeRow} accessible accessibilityLabel={`${t('nextAppointment')}: ${label}`}>
      <AppText variant="metric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.shrink}>
        {parsed ? parsed.clock : label || '—'}
      </AppText>
      {parsed?.zone ? (
        <AppText variant="subhead" weight={600} color="inkMuted" numberOfLines={1}>
          {parsed.zone}
        </AppText>
      ) : null}
    </View>
  );
};

/**
 * Relative day computed on the device in the app language (today / tomorrow / in N days),
 * or a neutral "Past appointment · N days ago". Falls back to the backend text only when
 * the date label cannot be parsed.
 */
export const RelativeBadge: React.FC<{ date: string; time?: string; fallback?: string; now?: Date }> = ({ date, time, fallback, now }) => {
  const { t } = useLanguage();
  const calendar = parseDateLabel(date);
  if (!calendar) return fallback ? <Badge label={fallback} tone="primary" icon="clock" size="md" /> : null;
  const rel = relativeDay(calendar, parseTimeLabel(time), now);
  switch (rel.kind) {
    case 'past':
      return (
        <Badge
          label={rel.daysAgo > 0 ? `${t('pastAppointment')} · ${t(daysAgoKey(rel.daysAgo), { n: rel.daysAgo })}` : t('pastAppointment')}
          tone="neutral"
          icon="rescheduled"
          size="md"
        />
      );
    case 'today':
      return <Badge label={t('relToday')} tone="success" icon="clock" size="md" />;
    case 'tomorrow':
      return <Badge label={t('relTomorrow')} tone="primary" icon="clock" size="md" />;
    default:
      return <Badge label={t(inDaysKey(rel.days), { n: rel.days })} tone="primary" icon="calendar" size="md" />;
  }
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  shrink: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  portrait: {
    width: 72,
    height: 72,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  headerText: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyBody: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
