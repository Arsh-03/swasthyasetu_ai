import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { patientApi, type MyDoctor, type NextAppointment } from '../../services/api';
import { doctorQualifications, doctorShortName } from '../../utils/departments';
import { formatDate, localCalendarDate } from '../../utils/dates';
import { EmptyAppointments } from '../illustrations';
import {
  AppText,
  Badge,
  Card,
  Groove,
  Icon,
  NeuPressable,
  PrimaryButton,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
} from '../ui';
import { AppointmentRow, appointmentWhen, ConfirmSheet, DepartmentBadge, DoctorAvatar, isVideo } from './DoctorParts';
import { appointmentFacts, departmentIdFrom, parseQualification, spokenDepartment, spokenDoctor, useScripts } from '../../speech';

export type MyDoctorsTab = 'doctors' | 'schedule';
type Tab = MyDoctorsTab;

interface MyDoctorsViewProps {
  /** Which view opens first ("See all" on Today opens the schedule). */
  initialTab?: Tab;
  /** Bumped when appointments change (booking, cancel, live updates): reload. */
  refreshKey: number;
  onOpenDoctor: (practitionerId: string) => void;
  onAddDoctor: () => void;
  onBook: (practitionerId: string) => void;
  onChat: (practitionerId: string) => void;
  onChanged: () => void;
  onNotice: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

/**
 * "My Doctors" tab: every doctor the patient sees (one per health issue) and one schedule
 * across all of them. Adding a doctor starts from the health issue, not the department name.
 */
export const MyDoctorsView: React.FC<MyDoctorsViewProps> = ({ initialTab = 'doctors', refreshKey, onOpenDoctor, onAddDoctor, onBook, onChat, onChanged, onNotice }) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [doctors, setDoctors] = useState<MyDoctor[] | null>(null);
  const [schedule, setSchedule] = useState<{ upcoming: NextAppointment[]; past: NextAppointment[] } | null>(null);
  const [error, setError] = useState(false);
  const [toCancel, setToCancel] = useState<NextAppointment | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(() => {
    Promise.all([patientApi.getMyDoctors(), patientApi.getMyAppointments()])
      .then(([docs, apts]) => {
        setDoctors(docs);
        setSchedule(apts);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const cancel = async () => {
    if (!toCancel) return;
    try {
      await patientApi.cancelAppointment(toCancel.appointmentId);
      onNotice(t('appointmentCancelledToast'), 'success');
      setToCancel(null);
      load();
      onChanged();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : t('networkError'), 'error');
    }
  };

  const loading = !doctors && !error;

  return (
    <ScreenScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <AppText variant="largeTitle" accessibilityRole="header">
          {t('myDoctors')}
        </AppText>
        <AppText variant="subhead" color="inkMuted">
          {t('myDoctorsIntro')}
        </AppText>
      </View>

      <PrimaryButton label={t('addDoctor')} icon="personAdd" speech={scripts.doctors.add} onPress={onAddDoctor} />

      <SegmentedControl<Tab>
        options={[
          { value: 'doctors', label: t('doctorsTab', { n: doctors?.length ?? 0 }), icon: 'doctor' },
          { value: 'schedule', label: t('scheduleTab', { n: schedule?.upcoming.length ?? 0 }), icon: 'calendar' },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel={t('myDoctors')}
      />

      {loading && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      {error && (
        <Card style={styles.center}>
          <Icon name="network" size={24} color={colors.warningDeep} active />
          <AppText variant="subhead" weight={600} color="warningDeep" align="center">
            {t('myDoctorsError')}
          </AppText>
          <SecondaryButton label={t('retry')} tone="primary" size="sm" onPress={load} />
        </Card>
      )}

      {tab === 'doctors' && doctors && (
        <View style={styles.list}>
          {doctors.length === 0 ? (
            <Card style={styles.center}>
              <EmptyAppointments width={140} />
              <AppText variant="headline" align="center">
                {t('noDoctorsYet')}
              </AppText>
              <AppText variant="footnote" color="inkMuted" align="center">
                {t('noDoctorsHint')}
              </AppText>
            </Card>
          ) : (
            doctors.map((doc) => (
              <DoctorCard
                key={doc.practitioner_id}
                doctor={doc}
                onOpen={() => onOpenDoctor(doc.practitioner_id)}
                onBook={() => onBook(doc.practitioner_id)}
                onChat={() => onChat(doc.practitioner_id)}
              />
            ))
          )}
          {doctors.length > 0 && (
            <AppText variant="footnote" color="inkMuted" align="center" style={styles.hint}>
              {t('myDoctorsPrivacyHint')}
            </AppText>
          )}
        </View>
      )}

      {tab === 'schedule' && schedule && (
        <View style={styles.list}>
          <SectionHeader title={t('upcomingAppointments')} icon="calendar" count={schedule.upcoming.length} />
          <Card padded={false}>
            {schedule.upcoming.length === 0 ? (
              <View style={styles.center}>
                <AppText variant="subhead" align="center">
                  {t('noUpcoming')}
                </AppText>
              </View>
            ) : (
              schedule.upcoming.map((apt, i) => (
                <React.Fragment key={apt.appointmentId}>
                  {i > 0 && <Groove inset={spacing.md} />}
                  <AppointmentRow apt={apt} onCancel={() => setToCancel(apt)} />
                </React.Fragment>
              ))
            )}
          </Card>

          {schedule.past.length > 0 && (
            <>
              <SecondaryButton
                label={showPast ? t('hidePastAppointments') : t('showPastAppointments', { n: schedule.past.length })}
                icon="rescheduled"
                tone="neutral"
                size="sm"
                onPress={() => setShowPast((v) => !v)}
              />
              {showPast && (
                <Card padded={false}>
                  {schedule.past.map((apt, i) => (
                    <React.Fragment key={apt.appointmentId}>
                      {i > 0 && <Groove inset={spacing.md} />}
                      <AppointmentRow apt={apt} muted />
                    </React.Fragment>
                  ))}
                </Card>
              )}
            </>
          )}
        </View>
      )}

      <ConfirmSheet
        visible={toCancel !== null}
        title={t('cancelAppointmentTitle')}
        body={
          toCancel
            ? t('cancelAppointmentBody', {
                doctor: doctorShortName(toCancel.doctorName),
                date: appointmentWhen(toCancel, lang).date,
                time: toCancel.time,
              })
            : ''
        }
        confirmLabel={t('cancelAppointment')}
        onConfirm={cancel}
        onClose={() => setToCancel(null)}
      />
    </ScreenScroll>
  );
};

/** One doctor: who, which department, what for, next visit, and quick actions. */
const DoctorCard: React.FC<{ doctor: MyDoctor; onOpen: () => void; onBook: () => void; onChat: () => void }> = ({
  doctor,
  onOpen,
  onBook,
  onChat,
}) => {
  const { lang, t } = useLanguage();
  const next = doctor.next_appointment;
  const when = next ? appointmentWhen(next, lang) : null;
  const lastVisit = doctor.last_visit_at ? formatDate(localCalendarDate(new Date(doctor.last_visit_at)), lang) : null;
  const scripts = useScripts();
  // Card level: who, what kind of doctor, upcoming visits and unread messages (degrees are read on the degree line)
  const spokenName = () => spokenDoctor(doctor.name, lang);
  const specialist = () => spokenDepartment(departmentIdFrom(doctor.department, doctor.specialty), lang)?.specialist;
  const cardSpeech = () => {
    const base = scripts.doctors.card({ doctor: spokenName(), specialist: specialist(), upcoming: doctor.upcoming_count, unread: doctor.unread_messages });
    return next ? `${base} ${scripts.appointment.row(appointmentFacts({ ...next, doctorName: doctor.name }, lang))}` : base;
  };

  return (
    <NeuPressable onPress={onOpen} speech={cardSpeech} radius={radii.lg} style={styles.card} accessibilityLabel={`${doctor.name}. ${t('openDoctor')}`}>
        <View style={styles.cardTop}>
          <DoctorAvatar name={doctor.name} department={doctor.department} />
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1} speech={() => scripts.appointment.doctor(spokenName())}>
              {doctorShortName(doctor.name)}
            </AppText>
            <AppText
              variant="caption"
              color="inkMuted"
              numberOfLines={1}
              speech={
                doctorQualifications(doctor.name)
                  ? () => {
                      const q = parseQualification(doctor.name);
                      return scripts.appointment.qualification(spokenName(), q?.degrees ?? [], q?.subject ?? '', specialist());
                    }
                  : undefined
              }
            >
              {doctorQualifications(doctor.name) || doctor.specialty}
            </AppText>
            <View style={styles.badgeRow}>
              <DepartmentBadge department={doctor.department} fallback={doctor.specialty} />
            </View>
          </View>
          <Icon name="chevronRight" size={20} color={colors.inkMuted} />
        </View>

        {doctor.reason ? (
          <View style={styles.reason}>
            <AppText variant="caption" weight={600} color="inkMuted" compact>
              {t('lookingAfter')}
            </AppText>
            <AppText variant="subhead" weight={600} numberOfLines={2}>
              {doctor.reason}
            </AppText>
          </View>
        ) : null}

        <View style={styles.nextRow}>
          <Icon name={next ? 'calendarCheck' : 'calendar'} size={18} color={next ? colors.primary : colors.inkMuted} active={!!next} />
          <AppText variant="footnote" weight={next ? 600 : 400} color={next ? 'ink' : 'inkMuted'} style={styles.flex}>
            {next && when
              ? t('nextVisitOn', { date: when.date, time: when.time, type: isVideo(next.mode) ? t('visitVideo') : t('visitInPerson') })
              : lastVisit
              ? t('lastVisitOn', { date: lastVisit })
              : t('noUpcomingWithDoctor')}
          </AppText>
        </View>

        <View style={styles.actions}>
          <SecondaryButton
            label={next ? t('bookAnother') : t('bookVisit')}
            icon="calendarPlus"
            tone="primary"
            size="sm"
            onPress={onBook}
            style={styles.flex}
            speech={() => scripts.doctors.book(spokenName())}
          />
          <SecondaryButton
            label={t('tabChat')}
            icon="chat"
            tone="neutral"
            size="sm"
            onPress={onChat}
            style={styles.flex}
            speech={() => scripts.doctors.chat(spokenName())}
          />
        </View>
        {doctor.unread_messages > 0 && (
          <Badge label={t('unreadMessages', { n: doctor.unread_messages })} tone="danger" icon="chat" style={styles.unread} />
        )}
      </NeuPressable>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  center: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  hint: {
    paddingHorizontal: spacing.md,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  reason: {
    backgroundColor: colors.base,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unread: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xl + spacing.lg,
  },
});
