// Book a new appointment, or reschedule / cancel an existing one. Warns (and asks to confirm) when the
// slot is outside the doctor's available hours or on a leave day (Settings → Availability).
import { useEffect, useMemo, useState } from 'react';
import { ApiError, doctorApi, type Appointment, type PatientListItem, type Weekday } from '../services/doctorApi';
import { usePortal } from './PortalContext';
import { weekdayIndex } from './time';
import { Button, Dialog, Field, SelectInput, TextArea, TextInput, shortName } from './ui';
import { Icon } from '../components/ui/Icon';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DURATIONS = [10, 15, 20, 30, 45, 60];

function addMinutes(clock: string, minutes: number): string {
  const [h, m] = clock.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function BookAppointment({ open, onClose, patientId, appointment, onSaved }: {
  open: boolean;
  onClose: () => void;
  /** Book for this patient (no patient picker). */
  patientId?: string;
  /** Reschedule / cancel this appointment. */
  appointment?: Appointment | null;
  onSaved?: (apt: Appointment) => void;
}) {
  const { t, fmt, settings, toast, refresh } = usePortal();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [pid, setPid] = useState(patientId ?? '');
  const [day, setDay] = useState('');
  const [clock, setClock] = useState('10:00');
  const [duration, setDuration] = useState(20);
  const [mode, setMode] = useState('Telehealth Video');
  const [agenda, setAgenda] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflict(null);
    if (appointment) {
      setPid(appointment.patient_id);
      setDay(fmt.dayKey(appointment.scheduled_at));
      setClock(fmt.clock(appointment.scheduled_at));
      setDuration(appointment.duration_minutes);
      setMode(appointment.mode);
      setAgenda(appointment.agenda);
    } else {
      setPid(patientId ?? '');
      setDay(fmt.today());
      setClock('10:00');
      setDuration(20);
      setMode('Telehealth Video');
      setAgenda('');
    }
    if (!patientId && !appointment) doctorApi.patients().then(setPatients).catch(() => setPatients([]));
  }, [open, appointment, patientId, fmt]);

  // Same rule as the server, shown before saving.
  const warning = useMemo(() => {
    if (!settings || !day || !clock) return null;
    const leave = settings.availability.leaves.find((l) => l.start <= day && day <= l.end);
    if (leave) return t('warnOnLeave', { reason: leave.reason || t('leave') });
    const slots = settings.availability.weekly[WEEKDAYS[weekdayIndex(day)]] ?? [];
    const end = addMinutes(clock, duration);
    if (!slots.some((s) => s.start <= clock && end <= s.end)) return t('warnOutsideHours');
    return null;
  }, [settings, day, clock, duration, t]);

  const save = async (force = false) => {
    if (!pid || !day || !clock) { setError(t('fillRequired')); return; }
    const when = fmt.fromLocal(day, clock);
    setBusy(true);
    setError(null);
    try {
      const input = {
        patient_id: pid, scheduled_at: when.toISOString(), duration_minutes: duration, mode, agenda,
        utc_offset_minutes: fmt.offset(when), force,
      };
      const saved = appointment
        ? await doctorApi.changeAppointment(appointment.appointment_id, input)
        : await doctorApi.book(input);
      toast(appointment ? t('toastRescheduled') : t('toastBooked'), 'success');
      refresh();
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(err.message);
      else setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  const cancelAppointment = async () => {
    if (!appointment) return;
    setBusy(true);
    try {
      await doctorApi.changeAppointment(appointment.appointment_id, { status: 'cancelled', mode: appointment.mode, utc_offset_minutes: fmt.offset() });
      toast(t('toastCancelled'), 'info');
      refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={appointment ? t('rescheduleTitle') : t('bookTitle')}
      description={appointment ? shortName(appointment.patient_name) : undefined}
      footer={
        conflict ? (
          <>
            <Button onClick={() => setConflict(null)}>{t('changeTime')}</Button>
            <Button variant="primary" onClick={() => save(true)} disabled={busy}>{t('bookAnyway')}</Button>
          </>
        ) : (
          <>
            {appointment && appointment.status === 'scheduled' && (
              <Button variant="ghost" className="mr-auto text-danger-deep" onClick={cancelAppointment} disabled={busy}>
                {t('cancelAppointment')}
              </Button>
            )}
            <Button onClick={onClose}>{t('close')}</Button>
            <Button variant="primary" onClick={() => save(false)} disabled={busy}>
              {busy ? t('saving') : appointment ? t('saveChanges') : t('book')}
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!patientId && !appointment && (
          <Field label={t('patient')} className="sm:col-span-2">
            {(id) => (
              <SelectInput id={id} value={pid} onChange={(e) => setPid(e.target.value)}>
                <option value="">{t('choosePatient')}</option>
                {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{shortName(p.full_name)}</option>)}
              </SelectInput>
            )}
          </Field>
        )}
        <Field label={t('date')}>{(id) => <TextInput id={id} type="date" value={day} min={appointment ? undefined : fmt.today()} onChange={(e) => setDay(e.target.value)} />}</Field>
        <Field label={t('time')}>{(id) => <TextInput id={id} type="time" step={300} value={clock} onChange={(e) => setClock(e.target.value)} />}</Field>
        <Field label={t('duration')}>
          {(id) => (
            <SelectInput id={id} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{t('minutesShort', { n: d })}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={t('visitType')}>
          {(id) => (
            <SelectInput id={id} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="Telehealth Video">{t('modeVideo')}</option>
              <option value="In-Person Warm Clinic">{t('modeClinic')}</option>
            </SelectInput>
          )}
        </Field>
        <Field label={t('reasonForVisit')} className="sm:col-span-2">
          {(id) => <TextArea id={id} rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={t('reasonPlaceholder')} />}
        </Field>
      </div>
      {(conflict || warning) && (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-warning-tint text-warning-deep px-3 py-2 text-xs">
          <Icon name="warning" size={16} className="mt-0.5" />
          <span>{conflict ?? warning} {conflict && t('bookAnywayHint')}</span>
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-danger-deep">{error}</p>}
    </Dialog>
  );
}
