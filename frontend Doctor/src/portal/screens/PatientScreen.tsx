// One patient: header (photo, name, key details, actions) and four tabs:
// Overview · Visits (upcoming + past, each past visit opens its summary) · Records (consent-gated) · Medical history.
import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { api, type PatientSummary, type RecordSummary } from '../../services/api';
import { doctorApi, type Appointment, type PatientDetail } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { hrefFor, navigate } from '../router';
import { BookAppointment } from '../BookAppointment';
import { AppointmentRow } from '../Schedule';
import { Conversation } from '../Conversation';
import { ReadingsCard } from '../Readings';
import { Avatar, Button, Card, CardHeader, Dialog, Empty, ErrorNote, Facts, Field, Loading, Pill, SelectInput, Tabs, TextInput } from '../ui';
import type { MedicationItem } from '../../data/patientRecords';

type Tab = 'overview' | 'visits' | 'messages' | 'records' | 'history';
const TABS: Tab[] = ['overview', 'visits', 'messages', 'records', 'history'];

/** What the consent dialog needs (the open consultation, or the patient without one). */
function summaryFor(detail: PatientDetail): PatientSummary {
  if (detail.open_consultation) return detail.open_consultation;
  const p = detail.patient;
  return {
    patient_id: p.patient_id, full_name: p.full_name, abha_address: p.abha_address, phone_number: p.phone_number,
    preferred_language: (p.preferred_language as PatientSummary['preferred_language']) || 'kn',
    demographics: { age: p.age ?? undefined, gender: p.gender ?? undefined, district: p.district ?? undefined },
    allergies: p.allergies, avatar_url: p.avatar_url ?? undefined,
  };
}

export function PatientScreen({ patientId, tab }: { patientId: string; tab?: string }) {
  const { t, version } = usePortal();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [booking, setBooking] = useState(false);
  const current: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'overview';

  useEffect(() => {
    let alive = true;
    setError(false);
    doctorApi.patient(patientId).then((d) => alive && setDetail(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [patientId, version, reload]);

  if (error) return <ErrorNote message={t('loadError')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />;
  if (!detail || detail.patient.patient_id !== patientId) return <Loading label={t('loading')} />;

  const setTab = (next: Tab) => {
    window.history.replaceState(null, '', hrefFor({ page: 'patient', patientId, tab: next === 'overview' ? undefined : next }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <>
      <a href="#/patients" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mb-3">
        <Icon name="chevronLeft" size={14} /> {t('navPatients')}
      </a>
      <PatientHeader detail={detail} onBook={() => setBooking(true)} />
      <div className="mt-5">
        <Tabs<Tab>
          label={t('patientSections')}
          value={current}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: t('tabOverview'), icon: 'person' },
            { id: 'visits', label: t('tabVisits'), icon: 'calendar', count: detail.past_visits.length + detail.upcoming.length },
            { id: 'messages', label: t('tabMessages'), icon: 'chat' },
            { id: 'records', label: t('tabRecords'), icon: 'records' },
            { id: 'history', label: t('tabHistory'), icon: 'history' },
          ]}
        />
      </div>
      <div className="pt-5">
        {current === 'overview' && <OverviewTab detail={detail} onOpenVisits={() => setTab('visits')} onChanged={() => setReload((n) => n + 1)} />}
        {current === 'visits' && <VisitsTab detail={detail} onBook={() => setBooking(true)} />}
        {current === 'messages' && (
          <Card className="h-[600px] max-h-[75vh] overflow-hidden"><Conversation patientId={patientId} showHeader={false} /></Card>
        )}
        {current === 'records' && <RecordsTab detail={detail} />}
        {current === 'history' && <HistoryTab detail={detail} />}
      </div>
      <BookAppointment open={booking} onClose={() => setBooking(false)} patientId={patientId} />
    </>
  );
}

function PatientHeader({ detail, onBook }: { detail: PatientDetail; onBook: () => void }) {
  const { t, fmt } = usePortal();
  const p = detail.patient;
  const next = detail.upcoming[0];
  const nextIsSoon = next && fmt.dayKey(next.scheduled_at) === fmt.today();
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <Avatar name={p.full_name} src={p.avatar_url} size={80} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{p.full_name}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {[p.age && t('yearsOld', { n: p.age }), p.gender, p.blood_group, p.district].filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <Pill tone="gold" icon="verified" label={`ABHA ${p.abha_address}`} />
            {p.allergies.map((a) => <Pill key={a} tone="danger" icon="drugAlert" label={a} />)}
            {detail.open_consultation?.urgency === 'high' && <Pill tone="danger" label={t('urgent')} />}
          </div>
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-stretch shrink-0">
          {next && (
            <Button variant="primary" icon="video" onClick={() => navigate({ page: 'meeting', appointmentId: next.appointment_id })}>
              {nextIsSoon ? t('openMeetingRoom') : t('nextAt', { when: fmt.dateTime(next.scheduled_at) })}
            </Button>
          )}
          <Button icon="add" variant={next ? 'secondary' : 'primary'} onClick={onBook}>{t('bookAppointment')}</Button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------ Prescription Edit & Prescribe Modal

function PrescriptionModal({
  open,
  onClose,
  patientId,
  prescription,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  prescription: MedicationItem | null;
  onSaved: () => void;
}) {
  const { toast } = usePortal();
  const [name, setName] = useState(prescription?.name ?? '');
  const [dosage, setDosage] = useState(prescription?.dosage ?? '650 mg');
  const [frequency, setFrequency] = useState(prescription?.frequency ?? 'Twice a day');
  const [timing, setTiming] = useState(prescription?.timing ?? 'After food');
  const [duration, setDuration] = useState(prescription?.duration ?? '5 days');
  const [status, setStatus] = useState<string>(prescription?.status ?? 'Active');
  const [schedule, setSchedule] = useState({
    morning: prescription?.schedule?.morning ?? true,
    afternoon: prescription?.schedule?.afternoon ?? false,
    night: prescription?.schedule?.night ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prescription) {
      setName(prescription.name);
      setDosage(prescription.dosage || '650 mg');
      setFrequency(prescription.frequency || 'Twice a day');
      setTiming(prescription.timing || 'After food');
      setDuration(prescription.duration || '5 days');
      setStatus(prescription.status || 'Active');
      setSchedule({
        morning: prescription.schedule?.morning ?? true,
        afternoon: prescription.schedule?.afternoon ?? false,
        night: prescription.schedule?.night ?? true,
      });
    } else {
      setName('');
      setDosage('650 mg');
      setFrequency('Twice a day');
      setTiming('After food');
      setDuration('5 days');
      setStatus('Active');
      setSchedule({ morning: true, afternoon: false, night: true });
    }
    setError(null);
  }, [prescription, open]);

  const save = async () => {
    if (!name.trim()) {
      setError('Medication name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        timing: timing.trim(),
        duration: duration.trim(),
        meal_relation: timing.toLowerCase().includes('before')
          ? 'before_food'
          : timing.toLowerCase().includes('bedtime')
          ? 'bedtime'
          : 'after_food',
        dose_amount: dosage.trim() || '1 tablet',
        schedule,
        status: status as 'Active' | 'Discontinued',
      };

      if (prescription?.id) {
        await doctorApi.updatePrescription(patientId, prescription.id, payload);
        toast('Prescription updated. Changes reflect on patient app immediately.', 'success');
      } else {
        await doctorApi.addPrescription(patientId, payload);
        toast('Prescription added. Patient care plan refreshed.', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  const discontinue = async () => {
    if (!prescription?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      await doctorApi.deletePrescription(patientId, prescription.id);
      toast('Medication marked as Discontinued.', 'warning');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to discontinue prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={prescription ? 'Edit Prescription' : 'Prescribe Medication'}
      description="Updates will immediately sync with the patient's daily medication schedule in their app."
      footer={
        <div className="flex items-center justify-between w-full">
          {prescription ? (
            <Button size="sm" variant="danger" onClick={discontinue} disabled={submitting}>
              Discontinue
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={submitting}>
              {submitting ? 'Saving…' : prescription ? 'Save Changes' : 'Prescribe'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger font-semibold">
            {error}
          </div>
        )}

        <Field label="Medicine / Tablet Name *">
          {(id) => (
            <TextInput
              id={id}
              placeholder="e.g. Tab Paracetamol, Pantocid, Dolo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dose / Strength">
            {(id) => (
              <div className="flex flex-col gap-1.5">
                <TextInput
                  id={id}
                  placeholder="e.g. 650 mg, 500 mg, 1 tablet"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {['650 mg', '500 mg', '40 mg', '10 mg', '1 tab'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDosage(d)}
                      className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-base text-ink-muted hover:text-ink border border-hairline cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <Field label="When to Take (Timing)">
            {(id) => (
              <div className="flex flex-col gap-1.5">
                <SelectInput
                  id={id}
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                >
                  <option value="After food">After food</option>
                  <option value="Before food">Before food (Empty stomach)</option>
                  <option value="With food">With food</option>
                  <option value="At bedtime">At bedtime (Night)</option>
                  <option value="As directed">As directed</option>
                </SelectInput>
                <div className="flex flex-wrap gap-1">
                  {['After food', 'Before food', 'At bedtime'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTiming(t)}
                      className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-base text-ink-muted hover:text-ink border border-hairline cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="How Often (Frequency)">
            {(id) => (
              <SelectInput
                id={id}
                value={frequency}
                onChange={(e) => {
                  const val = e.target.value;
                  setFrequency(val);
                  if (val.includes('Three') || val.includes('TDS')) {
                    setSchedule({ morning: true, afternoon: true, night: true });
                  } else if (val.includes('Twice') || val.includes('BD')) {
                    setSchedule({ morning: true, afternoon: false, night: true });
                  } else if (val.includes('Once') || val.includes('OD')) {
                    setSchedule({ morning: true, afternoon: false, night: false });
                  } else if (val.includes('bedtime') || val.includes('HS')) {
                    setSchedule({ morning: false, afternoon: false, night: true });
                  }
                }}
              >
                <option value="Three times a day">Three times a day (TDS - Morning, Afternoon, Night)</option>
                <option value="Twice a day">Twice a day (BD - Morning & Night)</option>
                <option value="Once a day">Once a day (OD - Morning)</option>
                <option value="At bedtime">At bedtime (HS - Night)</option>
                <option value="Only when needed">Only when needed (SOS / PRN)</option>
              </SelectInput>
            )}
          </Field>

          <Field label="Duration">
            {(id) => (
              <div className="flex flex-col gap-1.5">
                <TextInput
                  id={id}
                  placeholder="e.g. 5 days, 10 days, 1 month"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {['3 days', '5 days', '7 days', '14 days', '1 month'].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDuration(dur)}
                      className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-base text-ink-muted hover:text-ink border border-hairline cursor-pointer"
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
        </div>

        <div>
          <label className="text-2xs font-semibold uppercase tracking-wider text-ink-muted block mb-1.5">
            Daily Routine Slots (Patient App Alarms)
          </label>
          <div className="flex items-center gap-3">
            {[
              { id: 'morning', label: 'Morning (8:00 AM)', checked: schedule.morning },
              { id: 'afternoon', label: 'Afternoon (1:30 PM)', checked: schedule.afternoon },
              { id: 'night', label: 'Night (8:30 PM)', checked: schedule.night },
            ].map((slot) => (
              <label
                key={slot.id}
                className={cx(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors',
                  slot.checked
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-card text-ink-muted border-hairline hover:border-[#728A97]'
                )}
              >
                <input
                  type="checkbox"
                  checked={slot.checked}
                  onChange={(e) =>
                    setSchedule((prev) => ({ ...prev, [slot.id]: e.target.checked }))
                  }
                  className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                />
                {slot.label}
              </label>
            ))}
          </div>
        </div>

        <Field label="Status">
          {(id) => (
            <SelectInput
              id={id}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Active">Active (Appears in patient daily plan)</option>
              <option value="Discontinued">Discontinued (Stopped / Completed)</option>
            </SelectInput>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------ Overview

function OverviewTab({ detail, onOpenVisits, onChanged }: { detail: PatientDetail; onOpenVisits: () => void; onChanged: () => void }) {
  const { t, fmt } = usePortal();
  const p = detail.patient;
  const chart = detail.chart ?? {};
  const meds = (chart.prescriptions ?? []).filter((m) => m.status !== 'Discontinued');
  const last = detail.past_visits[0];
  const vitals = chart.lastAppointment?.vitals;
  const [editingRx, setEditingRx] = useState<MedicationItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader icon="idCard" title={t('generalDetails')} />
          <div className="px-5 pb-5">
            <Facts columns={3} items={[
              { label: t('phone'), value: p.phone_number },
              { label: t('language'), value: p.preferred_language?.toUpperCase() },
              { label: t('occupation'), value: p.occupation },
              { label: t('dateOfBirth'), value: chart.dateOfBirth },
              { label: t('emergencyContact'), value: chart.emergencyContact ? `${chart.emergencyContact.name} (${chart.emergencyContact.relation}) · ${chart.emergencyContact.phone}` : '' },
              { label: t('insurance'), value: chart.insurancePolicy ? `${chart.insurancePolicy.scheme} · ${chart.insurancePolicy.status}` : '' },
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader icon="clinicalNotes" title={t('lastVisit')}
            action={detail.past_visits.length > 0 && <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={onOpenVisits}>{t('allVisits')}</Button>} />
          <div className="px-5 pb-5">
            {last ? (
              <button type="button" onClick={() => navigate({ page: 'visit', patientId: p.patient_id, encounterId: last.encounter_id })}
                className="w-full text-left rounded-control border border-hairline p-4 hover:bg-base cursor-pointer">
                <p className="text-xs text-ink-muted">{fmt.dateTime(last.started_at)}</p>
                <p className="text-sm font-semibold text-ink mt-1">{last.diagnosis || last.complaint}</p>
                {last.diagnosis && <p className="text-xs text-ink-muted mt-0.5">{last.complaint}</p>}
              </button>
            ) : <p className="text-sm text-ink-muted">{t('noVisitsYet')}</p>}
          </div>
        </Card>
        {vitals && (
          <Card>
            <CardHeader icon="vitals" title={t('latestVitals')} subtitle={chart.lastAppointment?.date} />
            <div className="px-5 pb-5">
              <Facts columns={3} items={[
                { label: t('bloodPressure'), value: vitals.bp },
                { label: t('heartRate'), value: vitals.heartRate },
                { label: t('temperature'), value: vitals.temperature },
                { label: 'SpO₂', value: vitals.spo2 },
                { label: t('respiratoryRate'), value: vitals.respiratoryRate },
                { label: 'BMI', value: vitals.bmi },
              ]} />
            </div>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader icon="calendar" title={t('nextAppointment')} />
          <div className="px-2 pb-3">
            {detail.upcoming[0] ? <AppointmentRow apt={detail.upcoming[0]} showDate hidePatient /> : <p className="px-3 pb-2 text-sm text-ink-muted">{t('notBooked')}</p>}
          </div>
        </Card>
        {detail.care_team && detail.care_team.length > 0 && (
          <Card>
            <CardHeader icon="people" title={t('otherDoctors')} subtitle={t('otherDoctorsHint')} />
            <ul className="px-5 pb-5 flex flex-col gap-3">
              {detail.care_team.map((d) => (
                <li key={d.practitioner_id} className="flex items-start gap-3">
                  <Icon name="doctor" size={18} className="mt-0.5 text-ink-muted" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{d.name}</p>
                    <p className="text-xs text-ink-muted">
                      {[d.department_name, d.reason].filter(Boolean).join(' · ')}
                    </p>
                    {d.next_appointment_at && (
                      <p className="text-2xs text-ink-muted">{t('otherDoctorNext', { date: fmt.date(d.next_appointment_at) })}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <ReadingsCard patientId={p.patient_id} readings={detail.readings} requests={detail.requests} onChanged={onChanged} />
        <Card>
          <CardHeader icon="symptom" title={t('activeConditions')} />
          <div className="px-5 pb-5 flex flex-wrap gap-1.5">
            {p.conditions.length ? p.conditions.map((c) => <Pill key={c} label={c} />) : <span className="text-sm text-ink-muted">{t('noneRecorded')}</span>}
          </div>
        </Card>
        <Card>
          <CardHeader
            icon="medication"
            title={t('currentMedicines')}
            subtitle="Synced live with patient app care plan"
            action={
              <Button
                size="sm"
                icon="add"
                onClick={() => {
                  setEditingRx(null);
                  setModalOpen(true);
                }}
              >
                Prescribe
              </Button>
            }
          />
          <ul className="px-5 pb-5 flex flex-col gap-3">
            {meds.length === 0 && <li className="text-sm text-ink-muted">{t('noneRecorded')}</li>}
            {meds.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-hairline bg-card hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink text-sm">{m.name}</span>
                    {m.dosage && (
                      <span className="px-2 py-0.5 rounded-md text-2xs font-bold bg-primary/10 text-primary">
                        {m.dosage}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-3xs font-semibold ${
                        m.status === 'Active'
                          ? 'bg-success/10 text-success-deep'
                          : 'bg-ink-tint text-ink-muted'
                      }`}
                    >
                      {m.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {[m.frequency, m.timing, m.duration].filter(Boolean).join(' · ')}
                  </p>
                  {m.schedule && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-3xs font-semibold ${
                          m.schedule.morning
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-ink-tint/50 text-ink-muted line-through'
                        }`}
                      >
                        Morning
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-3xs font-semibold ${
                          m.schedule.afternoon
                            ? 'bg-orange-100 text-orange-900 border border-orange-300'
                            : 'bg-ink-tint/50 text-ink-muted line-through'
                        }`}
                      >
                        Afternoon
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-3xs font-semibold ${
                          m.schedule.night
                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                            : 'bg-ink-tint/50 text-ink-muted line-through'
                        }`}
                      >
                        Night
                      </span>
                    </div>
                  )}
                  {m.prescribedBy && (
                    <p className="text-3xs text-ink-muted mt-1">
                      Prescribed by: {m.prescribedBy}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="edit"
                    onClick={() => {
                      setEditingRx(m);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <PrescriptionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        patientId={p.patient_id}
        prescription={editingRx}
        onSaved={onChanged}
      />
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Visits

function VisitsTab({ detail, onBook }: { detail: PatientDetail; onBook: () => void }) {
  const { t, fmt } = usePortal();
  const [editing, setEditing] = useState<Appointment | null>(null);
  const p = detail.patient;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader icon="upcoming" title={t('upcomingAppointments')} action={<Button size="sm" icon="add" onClick={onBook}>{t('book')}</Button>} />
        <div className="px-2 pb-3">
          {detail.upcoming.length === 0 && <p className="px-3 pb-2 text-sm text-ink-muted">{t('notBooked')}</p>}
          {detail.upcoming.map((a) => (
            <div key={a.appointment_id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0"><AppointmentRow apt={a} showDate hidePatient /></div>
              <Button size="sm" variant="ghost" icon="reschedule" onClick={() => setEditing(a)} aria-label={t('reschedule')}>
                <span className="hidden sm:inline">{t('reschedule')}</span>
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader icon="history" title={t('pastVisits')} subtitle={t('visitsCount', { n: detail.past_visits.length })} />
        {detail.past_visits.length === 0 ? <Empty icon="clinicalNotes" title={t('noVisitsYet')} /> : (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {detail.past_visits.map((v) => (
              <li key={v.encounter_id}>
                <button type="button" onClick={() => navigate({ page: 'visit', patientId: p.patient_id, encounterId: v.encounter_id })}
                  className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-base cursor-pointer">
                  <span className="w-24 shrink-0">
                    <span className="block text-sm font-semibold text-ink">{fmt.date(v.started_at)}</span>
                    <span className="block text-2xs text-ink-muted">{fmt.time(v.started_at)}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate">{v.diagnosis || v.complaint || t('generalConsultation')}</span>
                    {v.diagnosis && <span className="block text-xs text-ink-muted truncate">{v.complaint}</span>}
                  </span>
                  <span className="hidden sm:flex items-center gap-1 text-2xs text-ink-muted"><Icon name={v.mode === 'audio' ? 'call' : 'video'} size={14} /></span>
                  {v.signed ? <Pill tone="success" icon="check" label={t('signed')} /> : <Pill tone="warning" label={t('unsigned')} />}
                  <Icon name="chevronRight" size={16} tone="muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {detail.cancelled.length > 0 && (
        <details className="bg-card rounded-panel border border-hairline">
          <summary className="px-5 py-3.5 text-sm font-semibold text-ink-muted cursor-pointer">{t('cancelledAppointments', { n: detail.cancelled.length })}</summary>
          <div className="px-2 pb-3">{detail.cancelled.map((a) => <AppointmentRow key={a.appointment_id} apt={a} showDate hidePatient />)}</div>
        </details>
      )}
      <BookAppointment open={editing !== null} onClose={() => setEditing(null)} appointment={editing} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Records

function RecordsTab({ detail }: { detail: PatientDetail }) {
  const { t, version, requestRecords } = usePortal();
  const [records, setRecords] = useState<RecordSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const pid = detail.patient.patient_id;

  useEffect(() => {
    let alive = true;
    setError(false);
    api.getPatientRecords(pid).then((r) => alive && setRecords(r)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [pid, version]);

  if (error) return <ErrorNote message={t('loadError')} />;
  if (!records) return <Loading label={t('loading')} />;
  const locked = records.filter((r) => r.consent_status !== 'approved').length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('recordsSummary', { total: records.length, locked })}</p>
        <Button variant="primary" icon="lock" onClick={() => requestRecords(summaryFor(detail))}>{t('requestRecords')}</Button>
      </div>
      {records.length === 0 ? <Card><Empty icon="records" title={t('noRecords')} /></Card> : (
        <Card>
          <ul className="divide-y divide-hairline">
            {records.map((r) => {
              const unlocked = r.consent_status === 'approved';
              const expanded = open === r.record_id;
              return (
                <li key={r.record_id}>
                  <button type="button" onClick={() => setOpen(expanded ? null : r.record_id)} aria-expanded={expanded}
                    className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-base cursor-pointer">
                    <span className={cx('w-10 h-10 rounded-control flex items-center justify-center shrink-0', unlocked ? 'bg-success-tint text-success-deep' : 'bg-ink-tint text-ink-muted')}>
                      <Icon name={r.category === 'lab' ? 'vitals' : r.imaging ? 'imaging' : 'records'} size={20} weight="duotone" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate">{r.title}</span>
                      <span className="block text-xs text-ink-muted truncate">{[r.date_str, r.facility, r.type_label].filter(Boolean).join(' · ')}</span>
                    </span>
                    {unlocked ? <Pill tone="success" icon="unlock" label={t('accessGranted')} />
                      : r.consent_status === 'expired' ? <Pill tone="warning" label={t('accessExpired')} />
                      : <Pill icon="lock" label={t('consentNeeded')} />}
                    <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} tone="muted" />
                  </button>
                  {expanded && (
                    <div className="px-5 pb-4 pl-[76px] text-sm text-ink flex flex-col gap-3">
                      {unlocked ? (
                        <>
                          {r.summary_findings && <p>{r.summary_findings}</p>}
                          {r.imaging && <Facts columns={2} items={[
                            { label: t('modality'), value: r.imaging.modality }, { label: t('organ'), value: r.imaging.organ },
                            { label: t('findings'), value: r.imaging.findingsSummary }, { label: t('measurement'), value: r.imaging.caliperMeasurement },
                          ]} />}
                          {r.lab_results && (
                            <table className="w-full text-xs">
                              <thead><tr className="text-left text-ink-muted"><th className="py-1 font-semibold">{t('test')}</th><th className="font-semibold">{t('result')}</th><th className="font-semibold">{t('range')}</th></tr></thead>
                              <tbody>
                                {r.lab_results.map((l) => (
                                  <tr key={l.test} className="border-t border-hairline">
                                    <td className="py-1.5">{l.test}</td>
                                    <td className={cx('font-semibold', l.flag !== 'normal' && 'text-danger-deep')}>{l.value} {l.unit}{l.flag !== 'normal' && ` (${l.flag === 'elevated' ? '↑' : '↓'})`}</td>
                                    <td className="text-ink-muted">{l.range}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </>
                      ) : (
                        <p className="text-ink-muted">{t('recordLockedHint')}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Medical history

function HistoryTab({ detail }: { detail: PatientDetail }) {
  const { t } = usePortal();
  const c = detail.chart ?? {};
  const section = (title: string, icon: Parameters<typeof CardHeader>[0]['icon'], body: React.ReactNode, empty: boolean) => (
    <Card>
      <CardHeader icon={icon} title={title} />
      <div className="px-5 pb-5">{empty ? <p className="text-sm text-ink-muted">{t('noneRecorded')}</p> : body}</div>
    </Card>
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {section(t('conditionsHistory'), 'symptom', (
        <ul className="flex flex-col gap-3">
          {(c.chronicConditions ?? []).map((x) => (
            <li key={x.id}>
              <p className="text-sm font-semibold text-ink">{x.name} {x.icd10 && <span className="font-mono text-2xs text-ink-muted">{x.icd10}</span>}</p>
              <p className="text-xs text-ink-muted">{[x.status, x.severity, x.diagnosedYear && t('since', { year: x.diagnosedYear })].filter(Boolean).join(' · ')}</p>
              {x.notes && <p className="text-xs text-ink mt-0.5">{x.notes}</p>}
            </li>
          ))}
        </ul>
      ), !(c.chronicConditions ?? []).length)}
      {section(t('allergies'), 'drugAlert', (
        <ul className="flex flex-col gap-3">
          {(c.allergies ?? []).map((a) => (
            <li key={a.id}>
              <p className="text-sm font-semibold text-danger-deep">{a.allergen}</p>
              <p className="text-xs text-ink-muted">{[a.severity, a.reaction].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ), !(c.allergies ?? []).length)}
      {section(t('surgeries'), 'medicalId', (
        <ul className="flex flex-col gap-3">
          {(c.surgicalHistory ?? []).map((s) => (
            <li key={s.id}>
              <p className="text-sm font-semibold text-ink">{s.procedure} · {s.year}</p>
              <p className="text-xs text-ink-muted">{[s.facility, s.surgeon].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ), !(c.surgicalHistory ?? []).length)}
      {section(t('familyHistory'), 'people', (
        <ul className="flex flex-col gap-2">
          {(c.familyHistory ?? []).map((f) => <li key={f.relation} className="text-sm"><span className="font-semibold">{f.relation}:</span> {f.conditions.join(', ')}</li>)}
        </ul>
      ), !(c.familyHistory ?? []).length)}
      {section(t('lifestyle'), 'person', c.socialHabits && (
        <Facts columns={2} items={[
          { label: t('smoking'), value: c.socialHabits.smoking }, { label: t('alcohol'), value: c.socialHabits.alcohol },
          { label: t('activity'), value: c.socialHabits.physicalActivity }, { label: t('diet'), value: c.socialHabits.diet },
        ]} />
      ), !c.socialHabits)}
      {section(t('immunizations'), 'shieldCheck', (
        <ul className="flex flex-col gap-2">
          {(c.immunizations ?? []).map((i) => (
            <li key={i.vaccine} className="flex items-center justify-between gap-3 text-sm">
              <span>{i.vaccine} <span className="text-xs text-ink-muted">· {i.date}</span></span>
              <Pill tone={i.status === 'Verified' ? 'success' : 'warning'} label={i.status === 'Verified' ? t('verified') : t('due')} />
            </li>
          ))}
        </ul>
      ), !(c.immunizations ?? []).length)}
    </div>
  );
}
