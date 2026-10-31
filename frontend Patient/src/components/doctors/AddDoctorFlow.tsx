import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tones } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  patientApi,
  type DepartmentSummary,
  type DirectoryDoctor,
  type DoctorCard,
  type FreeSlot,
  type HealthIssue,
  type NextAppointment,
} from '../../services/api';
import { departmentInfo, departmentName, doctorQualifications, doctorShortName, ISSUE_ICONS } from '../../utils/departments';
import { parseDateLabel } from '../../utils/dates';
import { LANGUAGE_NAMES, WEEKDAYS, MONTHS, type SupportedLanguage } from '../../utils/translations';
import {
  AppText,
  Badge,
  Card,
  Chip,
  Icon,
  NavBar,
  NeuPressable,
  PrimaryButton,
  ScreenScroll,
  SecondaryButton,
  SegmentedControl,
  TextField,
} from '../ui';
import { appointmentWhen, DepartmentBadge, DoctorAvatar, isVideo, slotDayLabel } from './DoctorParts';
import { useScripts } from '../../speech';
import { spokenDoctor } from '../../speech/format';

type Step = 'issue' | 'doctor' | 'slot' | 'done';
type Mode = 'video' | 'in_person';

interface AddDoctorFlowProps {
  /** Book with this doctor straight away (follow-up from My Doctors): skips the first two steps. */
  initialDoctorId?: string | null;
  /** Existing appointments of the patient to ensure only mutually free slots are displayed. */
  existingAppointments?: NextAppointment[];
  onExit: () => void;
  /** Booked: the app reloads appointments; `openDoctor` shows the doctor's page. */
  onBooked: (apt: NextAppointment, newDoctor: boolean) => void;
  onOpenDoctor: (practitionerId: string) => void;
}

/**
 * Add a doctor / book a visit, in three steps:
 *   1. What do you need help with? (health issue -> suggested OPD department)
 *   2. Choose a doctor in that department (soonest free slot first)
 *   3. Pick a day, a time and video or in-person; confirmed straight away.
 */
export const AddDoctorFlow: React.FC<AddDoctorFlowProps> = ({ initialDoctorId, existingAppointments, onExit, onBooked, onOpenDoctor }) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [step, setStep] = useState<Step>(initialDoctorId ? 'slot' : 'issue');
  const [catalog, setCatalog] = useState<{ departments: DepartmentSummary[]; issues: HealthIssue[] } | null>(null);
  const [issue, setIssue] = useState<HealthIssue | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DirectoryDoctor[] | null>(null);
  const [doctor, setDoctor] = useState<DoctorCard | null>(null);
  const [days, setDays] = useState<{ date: string; slots: FreeSlot[] }[] | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<NextAppointment[]>(existingAppointments || []);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [mode, setMode] = useState<Mode>('video');
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ apt: NextAppointment; newDoctor: boolean } | null>(null);
  const [showAllDepartments, setShowAllDepartments] = useState(false);

  const label = (map: Record<string, string> | undefined) => (map ? map[lang] || map.en || '' : '');

  useEffect(() => {
    patientApi.getCareCatalog().then(setCatalog).catch(() => setError(t('myDoctorsError')));
  }, [t]);

  // Ensure we have the patient's existing appointments to prevent double-booking
  useEffect(() => {
    if (existingAppointments && existingAppointments.length > 0) {
      setPatientAppointments(existingAppointments);
    } else {
      patientApi
        .getMyAppointments()
        .then((res) => {
          setPatientAppointments([...(res.upcoming || []), ...(res.past || [])]);
        })
        .catch(() => undefined);
    }
  }, [existingAppointments]);

  // Doctors of the chosen department
  useEffect(() => {
    if (!department) return;
    patientApi.getDoctors(department).then(setDoctors).catch(() => setError(t('myDoctorsError')));
  }, [department, t]);

  // Free slots of the chosen doctor (also loads the doctor for a direct follow-up booking)
  const doctorId = doctor?.practitioner_id ?? (step === 'slot' ? initialDoctorId : null);
  useEffect(() => {
    if (!doctorId) return;
    patientApi
      .getDoctorSlots(doctorId, 7)
      .then((res) => {
        setDoctor(res.doctor);
        setDays(res.days);
      })
      .catch(() => setError(t('myDoctorsError')));
  }, [doctorId, t]);

  // Mutual availability: filter out any slots where the patient already has an appointment
  const filteredDays = React.useMemo(() => {
    if (!days) return null;
    return days.map((d) => {
      const mutualSlots = d.slots.filter((s) => {
        const slotStart = new Date(s.start).getTime();
        const slotEnd = slotStart + 20 * 60 * 1000;
        return !patientAppointments.some((apt) => {
          if (!apt.scheduledAt) return false;
          const vStatus = apt.visitStatus || 'scheduled';
          if (vStatus === 'cancelled' || apt.status?.toLowerCase().includes('cancelled')) return false;
          const aptStart = new Date(apt.scheduledAt).getTime();
          const aptEnd = aptStart + (apt.durationMinutes || 20) * 60 * 1000;
          return aptStart < slotEnd && aptEnd > slotStart;
        });
      });
      return { ...d, slots: mutualSlots };
    });
  }, [days, patientAppointments]);

  useEffect(() => {
    if (!filteredDays) return;
    setDay((cur) => (cur && filteredDays.some((d) => d.date === cur && d.slots.length) ? cur : filteredDays.find((d) => d.slots.length)?.date ?? null));
  }, [filteredDays]);

  const chooseIssue = (it: HealthIssue) => {
    setIssue(it);
    setReason(label(it.label));
    if (it.department !== department) setDoctors(null);
    setDepartment(it.department);
    setError(null);
    setStep('doctor');
  };

  const chooseDepartment = (id: string) => {
    setIssue(null);
    setReason('');
    if (id !== department) setDoctors(null);
    setDepartment(id);
    setError(null);
    setStep('doctor');
  };

  const chooseDoctor = (d: DirectoryDoctor) => {
    if (d.practitioner_id !== doctor?.practitioner_id) {
      setDays(null);
      setSlot(null);
    }
    setDoctor(d);
    setDay(null);
    setError(null);
    setStep('slot');
  };

  const confirm = async () => {
    if (!doctor || !slot) return;
    setBooking(true);
    setError(null);
    try {
      const res = await patientApi.bookAppointment({
        practitioner_id: doctor.practitioner_id,
        scheduled_at: slot.start,
        mode,
        issue_id: issue?.id ?? null,
        reason: reason.trim() || undefined,
      });
      setBooked({ apt: res.appointment, newDoctor: res.new_doctor });
      setStep('done');
      onBooked(res.appointment, res.new_doctor);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('networkError'));
      // The slot may have just been taken: reload the times
      if (doctor) {
        patientApi.getDoctorSlots(doctor.practitioner_id, 7).then((res) => setDays(res.days)).catch(() => undefined);
        patientApi.getMyAppointments().then((res) => setPatientAppointments([...(res.upcoming || []), ...(res.past || [])])).catch(() => undefined);
        setSlot(null);
      }
    } finally {
      setBooking(false);
    }
  };

  const back = () => {
    setError(null);
    if (step === 'doctor') setStep('issue');
    else if (step === 'slot' && !initialDoctorId) {
      setDoctor(null);
      setStep('doctor');
    } else onExit();
  };

  const stepNumber = step === 'issue' ? 1 : step === 'doctor' ? 2 : 3;
  const daySlots = filteredDays?.find((d) => d.date === day)?.slots ?? [];

  return (
    <ScreenScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <NavBar backLabel={step === 'issue' || step === 'done' || (step === 'slot' && initialDoctorId) ? t('myDoctors') : t('back')} onBack={step === 'done' ? onExit : back} />

      {step !== 'done' && (
        <View style={styles.header}>
          <AppText variant="eyebrow" color="inkMuted" compact>
            {initialDoctorId ? t('bookVisit') : t('stepOf', { n: stepNumber, total: 3 })}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {step === 'issue' ? t('addDoctorIssueTitle') : step === 'doctor' ? t('addDoctorChooseTitle') : t('addDoctorSlotTitle')}
          </AppText>
        </View>
      )}

      {error && (
        <View style={styles.error} accessibilityRole="alert">
          <Icon name="error" size={18} color={colors.dangerDeep} />
          <AppText variant="footnote" weight={600} color="dangerDeep" style={styles.flex}>
            {error}
          </AppText>
        </View>
      )}

      {/* Step 1: health issue */}
      {step === 'issue' &&
        (!catalog ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : (
          <>
            <AppText variant="subhead" color="inkMuted">
              {t('addDoctorIssueHint')}
            </AppText>
            <View style={styles.grid}>
              {catalog.issues.map((it) => {
                const tone = tones[departmentInfo(it.department).tone];
                return (
                  <NeuPressable
                    key={it.id}
                    onPress={() => chooseIssue(it)}
                    radius={radii.lg}
                    containerStyle={styles.gridCell}
                    style={styles.issueTile}
                    speech={scripts.doctors.issue(label(it.label), departmentName(it.department, lang))}
                    fillHeight
                  >
                    <View style={[styles.issueIcon, { backgroundColor: tone.bg }]}>
                      <Icon name={ISSUE_ICONS[it.id] ?? departmentInfo(it.department).icon} size={24} color={tone.icon} active />
                    </View>
                    <AppText variant="subhead" weight={700}>
                      {label(it.label)}
                    </AppText>
                    <AppText variant="caption" color="inkMuted">
                      {departmentName(it.department, lang)}
                    </AppText>
                  </NeuPressable>
                );
              })}
            </View>
            <Card style={styles.notSure}>
              <Icon name="info" size={20} color={colors.primary} active />
              <AppText variant="footnote" style={styles.flex}>
                {t('addDoctorNotSure')}
              </AppText>
            </Card>
            <SecondaryButton
              label={showAllDepartments ? t('hideDepartments') : t('browseDepartments')}
              icon="hospital"
              tone="neutral"
              size="sm"
              onPress={() => setShowAllDepartments((v) => !v)}
            />
            {showAllDepartments && (
              <Card padded={false}>
                {catalog.departments.map((d) => (
                  <NeuPressable
                    key={d.id}
                    onPress={() => chooseDepartment(d.id)}
                    flatAtRest
                    radius={0}
                    style={styles.deptRow}
                    speech={`${departmentName(d.id, lang) || label(d.name)}. ${label(d.about)}. ${t('doctorCount', { n: d.doctor_count })}.`}
                  >
                    <Icon name={departmentInfo(d.id).icon} size={22} color={tones[departmentInfo(d.id).tone].icon} active />
                    <View style={styles.flex}>
                      <AppText variant="subhead" weight={700}>
                        {departmentName(d.id, lang) || label(d.name)}
                      </AppText>
                      <AppText variant="caption" color="inkMuted">
                        {label(d.about)}
                      </AppText>
                    </View>
                    <Badge label={t('doctorCount', { n: d.doctor_count })} tone="neutral" />
                  </NeuPressable>
                ))}
              </Card>
            )}
          </>
        ))}

      {/* Step 2: doctor */}
      {step === 'doctor' && department && (
        <>
          <Card style={styles.deptCard}>
            <DepartmentBadge department={department} size="md" />
            <AppText variant="footnote" color="inkMuted">
              {label(catalog?.departments.find((d) => d.id === department)?.about)}
            </AppText>
            {issue ? (
              <AppText variant="footnote">
                {t('suggestedFor', { issue: label(issue.label) })}
              </AppText>
            ) : null}
          </Card>
          {!doctors ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : doctors.length === 0 ? (
            <Card style={styles.center}>
              <AppText variant="subhead" align="center">
                {t('noDoctorsInDepartment')}
              </AppText>
            </Card>
          ) : (
            doctors.map((d) => <DirectoryRow key={d.practitioner_id} doctor={d} onPress={() => chooseDoctor(d)} />)
          )}
        </>
      )}

      {/* Step 3: day, time, visit type */}
      {step === 'slot' && (
        <>
          {doctor ? (
            <Card style={styles.doctorSummary}>
              <DoctorAvatar name={doctor.name} department={doctor.department} size={44} />
              <View style={styles.flex}>
                <AppText variant="headline" numberOfLines={1}>
                  {doctorShortName(doctor.name)}
                </AppText>
                <AppText variant="caption" color="inkMuted" numberOfLines={1}>
                  {doctor.facility}
                </AppText>
                <View style={styles.badgeRow}>
                  <DepartmentBadge department={doctor.department} fallback={doctor.specialty} />
                </View>
              </View>
            </Card>
          ) : null}

          {!days ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <>
              <AppText variant="headline">{t('chooseDay')}</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {(filteredDays || days).map((d) => (
                  <DayChip key={d.date} date={d.date} count={d.slots.length} selected={d.date === day} lang={lang} onPress={() => { setDay(d.date); setSlot(null); }} />
                ))}
              </ScrollView>

              <AppText variant="headline">{t('chooseTime')}</AppText>
              {daySlots.length === 0 ? (
                <AppText variant="subhead" color="inkMuted">
                  {(filteredDays || days).some((d) => d.slots.length) ? t('noSlotsThisDay') : t('noSlotsThisWeek')}
                </AppText>
              ) : (
                <View style={styles.times}>
                  {daySlots.map((s) => (
                    <Chip
                      key={s.start}
                      label={s.time}
                      selected={slot?.start === s.start}
                      speech={scripts.doctors.slot(slotDayLabel(day ?? '', lang, t), s.time, mode)}
                      onPress={() => setSlot(s)}
                    />
                  ))}
                </View>
              )}

              <AppText variant="headline">{t('visitType')}</AppText>
              <SegmentedControl<Mode>
                options={[
                  { value: 'video', label: t('visitVideo'), icon: 'video' },
                  { value: 'in_person', label: t('visitInPerson'), icon: 'hospital' },
                ]}
                value={mode}
                onChange={setMode}
                accessibilityLabel={t('visitType')}
              />
              {mode === 'in_person' && doctor?.facility ? (
                <View style={styles.inline}>
                  <Icon name="mapPin" size={16} color={colors.inkMuted} />
                  <AppText variant="footnote" color="inkMuted" style={styles.flex}>
                    {t('inPersonAt', { place: doctor.facility })}
                  </AppText>
                </View>
              ) : null}

              <TextField
                label={t('visitReason')}
                icon="clipboard"
                value={reason}
                onChangeText={setReason}
                placeholder={t('visitReasonPlaceholder')}
                maxLength={200}
              />

              <PrimaryButton
                label={slot ? t('confirmBooking', { day: slotDayLabel(day ?? '', lang, t), time: slot.time }) : t('pickATime')}
                icon="calendarCheck"
                speech={
                  slot && doctor
                    ? scripts.doctors.confirmBooking(spokenDoctor(doctor.name, lang), `${slotDayLabel(day ?? '', lang, t)} at ${slot.time}`)
                    : undefined
                }
                disabled={!slot}
                loading={booking}
                onPress={confirm}
              />
              <AppText variant="caption" color="inkMuted" align="center">
                {t('bookingInstantNote')}
              </AppText>
            </>
          )}
        </>
      )}

      {/* Done */}
      {step === 'done' && booked && (
        <Card style={styles.done}>
          <View style={styles.doneIcon}>
            <Icon name="calendarCheck" size={40} color={colors.successDeep} active />
          </View>
          <AppText variant="title2" weight={700} align="center" accessibilityRole="header">
            {t('bookingConfirmed')}
          </AppText>
          <AppText variant="body" align="center">
            {t('bookingConfirmedBody', {
              doctor: doctorShortName(booked.apt.doctorName),
              date: appointmentWhen(booked.apt, lang).date,
              time: booked.apt.time,
            })}
          </AppText>
          <View style={styles.badgeRowCenter}>
            <DepartmentBadge department={booked.apt.department} size="md" />
            <Badge label={isVideo(booked.apt.mode) ? t('visitVideo') : t('visitInPerson')} tone="primary" icon={isVideo(booked.apt.mode) ? 'video' : 'hospital'} size="md" />
          </View>
          {booked.newDoctor ? (
            <AppText variant="footnote" color="inkMuted" align="center">
              {t('addedToMyDoctors')}
            </AppText>
          ) : null}
          <PrimaryButton label={t('done')} icon="check" onPress={onExit} style={styles.fullWidth} />
          {booked.apt.practitionerId ? (
            <SecondaryButton label={t('openDoctor')} tone="neutral" onPress={() => onOpenDoctor(booked.apt.practitionerId as string)} style={styles.fullWidth} />
          ) : null}
        </Card>
      )}
    </ScreenScroll>
  );
};

const DirectoryRow: React.FC<{ doctor: DirectoryDoctor; onPress: () => void }> = ({ doctor, onPress }) => {
  const { lang, t } = useLanguage();
  const langs = doctor.languages
    .map((l) => LANGUAGE_NAMES[l as SupportedLanguage])
    .filter(Boolean)
    .join(', ');
  const meta = [doctor.experience_years ? t('yearsExperience', { n: doctor.experience_years }) : '', langs].filter(Boolean).join(' • ');
  const speechText = `${spokenDoctor(doctor.name, lang)}.${doctor.specialty ? ` ${doctor.specialty}.` : ''}${doctor.facility ? ` ${doctor.facility}.` : ''}${doctor.next_free ? ` ${t('nextFreeShort', { date: slotDayLabel(doctor.next_free.date, lang, t), time: doctor.next_free.time })}.` : ''}`;
  return (
    <NeuPressable onPress={onPress} radius={radii.lg} style={styles.dirCard} accessibilityLabel={doctor.name} speech={speechText}>
      <View style={styles.dirTop}>
        <DoctorAvatar name={doctor.name} department={doctor.department} size={48} />
        <View style={styles.flex}>
          <AppText variant="headline" numberOfLines={1}>
            {doctorShortName(doctor.name)}
          </AppText>
          <AppText variant="caption" color="inkMuted" numberOfLines={1}>
            {doctorQualifications(doctor.name) || doctor.specialty}
          </AppText>
          <AppText variant="caption" color="inkMuted" numberOfLines={2}>
            {doctor.facility}
          </AppText>
        </View>
        <Icon name="chevronRight" size={20} color={colors.inkMuted} />
      </View>
      {meta ? (
        <AppText variant="footnote" color="inkMuted">
          {meta}
        </AppText>
      ) : null}
      <View style={styles.badgeWrap}>
        {doctor.next_free ? (
          <Badge
            label={t('nextFreeShort', { date: slotDayLabel(doctor.next_free.date, lang, t), time: doctor.next_free.time })}
            tone="success"
            icon="clock"
            size="md"
          />
        ) : (
          <Badge label={t('fullyBooked')} tone="neutral" icon="calendarX" size="md" />
        )}
        {doctor.in_my_doctors ? <Badge label={t('alreadyYourDoctor')} tone="primary" icon="checkCircle" size="md" /> : null}
      </View>
    </NeuPressable>
  );
};

const DayChip: React.FC<{ date: string; count: number; selected: boolean; lang: SupportedLanguage; onPress: () => void }> = ({
  date,
  count,
  selected,
  lang,
  onPress,
}) => {
  const { t } = useLanguage();
  const d = parseDateLabel(date);
  const weekday = d ? WEEKDAYS[lang][new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()] : '';
  const disabled = count === 0;
  const chipSpeech = `${slotDayLabel(date, lang, t)}: ${disabled ? t('dayFull') : t('slotsFree', { n: count })}.`;
  return (
    <NeuPressable
      onPress={onPress}
      selected={selected}
      disabled={disabled}
      radius={radii.md}
      haptics="selection"
      style={styles.dayChip}
      speech={chipSpeech}
      accessibilityLabel={`${slotDayLabel(date, lang, t)}: ${t('slotsFree', { n: count })}`}
    >
      <AppText variant="caption" weight={600} color={selected ? 'primary' : 'inkMuted'} compact numberOfLines={1}>
        {weekday.slice(0, lang === 'en' ? 3 : 4)}
      </AppText>
      <AppText variant="headline" weight={700} color={disabled ? 'inkMuted' : selected ? 'primary' : 'ink'} lang="en" compact>
        {d ? d.day : '—'}
      </AppText>
      <AppText variant="caption" color="inkMuted" compact numberOfLines={1}>
        {d ? MONTHS[lang][d.month].slice(0, lang === 'en' ? 3 : 4) : ''}
      </AppText>
      <AppText variant="caption" weight={600} color={disabled ? 'inkMuted' : 'successDeep'} compact numberOfLines={1}>
        {disabled ? t('dayFull') : t('slotsFreeShort', { n: count })}
      </AppText>
    </NeuPressable>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: tones.danger.bg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridCell: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  issueTile: {
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 132,
  },
  issueIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  notSure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deptCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  center: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  dirCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dirTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  doctorSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  days: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  dayChip: {
    width: 76,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  times: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  done: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tones.success.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRowCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
