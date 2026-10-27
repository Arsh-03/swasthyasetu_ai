import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { patientApi, type MyDoctorDetail, type NextAppointment } from '../../services/api';
import { doctorQualifications, doctorShortName } from '../../utils/departments';
import { formatDate, localCalendarDate } from '../../utils/dates';
import { LANGUAGE_NAMES, type SupportedLanguage } from '../../utils/translations';
import {
  AppText,
  Badge,
  Card,
  Groove,
  Icon,
  LIST_ROW_TEXT_INSET,
  ListRow,
  NavBar,
  PrimaryButton,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
  TertiaryButton,
} from '../ui';
import { AppointmentRow, appointmentWhen, ConfirmSheet, DepartmentBadge, DoctorAvatar, slotDayLabel } from './DoctorParts';
import { useScripts } from '../../speech';

interface DoctorDetailViewProps {
  practitionerId: string;
  refreshKey: number;
  onBack: () => void;
  onBook: () => void;
  onChat: () => void;
  /** Ask this doctor for a video consultation now (symptom form, then the call). */
  onRequestVisit: (doctorName: string) => void;
  onChanged: () => void;
  onRemoved: () => void;
  onNotice: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

/** One of the patient's doctors: profile, upcoming visits, their medicines and past visit notes. */
export const DoctorDetailView: React.FC<DoctorDetailViewProps> = ({
  practitionerId,
  refreshKey,
  onBack,
  onBook,
  onChat,
  onRequestVisit,
  onChanged,
  onRemoved,
  onNotice,
}) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [data, setData] = useState<MyDoctorDetail | null>(null);
  const [error, setError] = useState(false);
  const [toCancel, setToCancel] = useState<NextAppointment | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(() => {
    patientApi
      .getMyDoctor(practitionerId)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true));
  }, [practitionerId]);

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

  const remove = async () => {
    try {
      await patientApi.removeDoctor(practitionerId);
      setConfirmRemove(false);
      onNotice(t('doctorRemovedToast'), 'success');
      onRemoved();
    } catch (err) {
      setConfirmRemove(false);
      onNotice(err instanceof Error ? err.message : t('networkError'), 'error');
    }
  };

  const nav = <NavBar backLabel={t('myDoctors')} onBack={onBack} />;
  if (!data) {
    return (
      <ScreenScroll contentContainerStyle={styles.content}>
        {nav}
        {error ? (
          <Card style={styles.center}>
            <AppText variant="subhead" weight={600} color="warningDeep" align="center">
              {t('myDoctorsError')}
            </AppText>
            <SecondaryButton label={t('retry')} tone="primary" size="sm" onPress={load} />
          </Card>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        )}
      </ScreenScroll>
    );
  }

  const doc = data.doctor;
  const name = doctorShortName(doc.name);
  const langs = doc.languages
    .map((l) => LANGUAGE_NAMES[l as SupportedLanguage])
    .filter(Boolean)
    .join(', ');

  return (
    <ScreenScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {nav}

      {/* Profile */}
      <Card style={styles.profile}>
        <View style={styles.profileTop}>
          <DoctorAvatar name={doc.name} department={doc.department} size={64} />
          <View style={styles.flex}>
            <AppText variant="title2" weight={700} accessibilityRole="header" numberOfLines={2}>
              {name}
            </AppText>
            <AppText variant="footnote" color="inkMuted">
              {doctorQualifications(doc.name) || doc.specialty}
            </AppText>
            <View style={styles.badgeRow}>
              <DepartmentBadge department={doc.department} fallback={doc.specialty} size="md" />
            </View>
          </View>
        </View>
        <Groove />
        <InfoRow icon="hospital" text={doc.facility} />
        {doc.experience_years ? <InfoRow icon="verified" text={t('yearsExperience', { n: doc.experience_years })} /> : null}
        {langs ? <InfoRow icon="translate" text={t('speaksLanguages', { langs })} /> : null}
        <InfoRow icon="idCard" text={doc.registration_number} />
        {doc.reason ? (
          <View style={styles.reason}>
            <AppText variant="caption" weight={600} color="inkMuted" compact>
              {t('lookingAfter')}
            </AppText>
            <AppText variant="subhead" weight={600}>
              {doc.reason}
            </AppText>
          </View>
        ) : null}
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <PrimaryButton
          label={data.upcoming.length ? t('bookAnother') : t('bookVisit')}
          icon="calendarPlus"
          speech={scripts.doctors.book(name)}
          onPress={onBook}
        />
        <View style={styles.row}>
          <SecondaryButton
            label={t('tabChat')}
            icon="chat"
            tone="neutral"
            speech={scripts.doctors.chat(name)}
            onPress={onChat}
            style={styles.flex}
          />
          <SecondaryButton
            label={t('videoVisitNow')}
            icon="video"
            tone="primary"
            speech={scripts.doctors.requestVisit(name)}
            onPress={() => onRequestVisit(doc.name)}
            style={styles.flex}
          />
        </View>
        {!data.upcoming.length && data.next_free ? (
          <AppText variant="footnote" color="inkMuted" align="center">
            {t('nextFreeSlot', {
              date: slotDayLabel(data.next_free.date, lang, t),
              time: data.next_free.time,
            })}
          </AppText>
        ) : null}
      </View>

      {/* Upcoming */}
      <View style={styles.section}>
        <SectionHeader title={t('upcomingAppointments')} icon="calendar" count={data.upcoming.length} />
        <Card padded={false}>
          {data.upcoming.length === 0 ? (
            <View style={styles.center}>
              <AppText variant="subhead" color="inkMuted" align="center">
                {t('noUpcomingWithDoctor')}
              </AppText>
            </View>
          ) : (
            data.upcoming.map((apt, i) => (
              <React.Fragment key={apt.appointmentId}>
                {i > 0 && <Groove inset={spacing.md} />}
                <AppointmentRow apt={apt} showDoctor={false} onCancel={() => setToCancel(apt)} />
              </React.Fragment>
            ))
          )}
        </Card>
      </View>

      {/* Medicines from this doctor */}
      <View style={styles.section}>
        <SectionHeader title={t('medicinesFromDoctor')} icon="medication" domain="medications" count={data.medicines.length} />
        <Card padded={false}>
          {data.medicines.length === 0 ? (
            <View style={styles.center}>
              <AppText variant="subhead" color="inkMuted" align="center">
                {t('noMedicinesFromDoctor')}
              </AppText>
            </View>
          ) : (
            data.medicines.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 && <Groove inset={LIST_ROW_TEXT_INSET} />}
                <ListRow
                  icon="medication"
                  iconTone="teal"
                  title={m.name}
                  subtitle={[m.dosage, m.frequency, m.timing].filter(Boolean).join(' • ')}
                >
                  {m.purpose ? (
                    <AppText variant="caption" color="inkMuted" numberOfLines={2}>
                      {m.purpose}
                    </AppText>
                  ) : null}
                </ListRow>
              </React.Fragment>
            ))
          )}
        </Card>
      </View>

      {/* Past visits */}
      <View style={styles.section}>
        <SectionHeader title={t('pastVisits')} icon="clipboard" count={data.visits.length} />
        {data.visits.length === 0 ? (
          <Card style={styles.center}>
            <AppText variant="subhead" color="inkMuted" align="center">
              {t('noPastVisits')}
            </AppText>
          </Card>
        ) : (
          data.visits.map((v) => (
            <Card key={v.encounter_id} style={styles.visit}>
              <View style={styles.row}>
                <Icon name="calendarCheck" size={18} color={colors.primary} active />
                <AppText variant="subhead" weight={700} style={styles.flex}>
                  {formatDate(localCalendarDate(new Date(v.date)), lang, { weekday: true })}
                </AppText>
                <Badge
                  label={v.mode === 'video' ? t('visitVideo') : v.mode === 'audio' ? t('visitAudio') : t('visitInPerson')}
                  tone={v.mode === 'video' ? 'primary' : 'teal'}
                />
              </View>
              {v.complaint ? <VisitLine label={t('visitComplaint')} text={v.complaint} /> : null}
              {v.diagnosis ? <VisitLine label={t('visitDiagnosis')} text={v.diagnosis} /> : null}
              {v.medicine ? <VisitLine label={t('medicines')} text={v.medicine} /> : null}
              {v.advice ? <VisitLine label={t('visitAdvice')} text={v.advice} /> : null}
              {v.follow_up ? <VisitLine label={t('followUp')} text={v.follow_up} /> : null}
            </Card>
          ))
        )}
      </View>

      <TertiaryButton
        label={t('removeDoctor')}
        icon="personRemove"
        speech={scripts.doctors.remove(name)}
        onPress={() => setConfirmRemove(true)}
        style={styles.remove}
      />

      <ConfirmSheet
        visible={toCancel !== null}
        title={t('cancelAppointmentTitle')}
        body={toCancel ? t('cancelAppointmentBody', { doctor: name, date: appointmentWhen(toCancel, lang).date, time: toCancel.time }) : ''}
        confirmLabel={t('cancelAppointment')}
        onConfirm={cancel}
        onClose={() => setToCancel(null)}
      />
      <ConfirmSheet
        visible={confirmRemove}
        title={t('removeDoctorTitle', { name })}
        body={t('removeDoctorBody')}
        confirmLabel={t('removeDoctor')}
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
      />
    </ScreenScroll>
  );
};

const InfoRow: React.FC<{ icon: 'hospital' | 'verified' | 'translate' | 'idCard'; text: string }> = ({ icon, text }) =>
  text ? (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={colors.inkMuted} />
      <AppText variant="footnote" style={styles.flex}>
        {text}
      </AppText>
    </View>
  ) : null;

const VisitLine: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <View style={styles.visitLine}>
    <AppText variant="caption" weight={600} color="inkMuted" compact>
      {label}
    </AppText>
    <AppText variant="footnote">{text}</AppText>
  </View>
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  center: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  profile: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reason: {
    backgroundColor: colors.base,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  visit: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  visitLine: {
    gap: 2,
  },
  remove: {
    alignSelf: 'center',
  },
});
