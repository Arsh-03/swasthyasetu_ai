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
import { Avatar, Button, Card, CardHeader, Empty, ErrorNote, Facts, Loading, Pill, Tabs } from '../ui';

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

// ------------------------------------------------------------------------------------------ Overview

function OverviewTab({ detail, onOpenVisits, onChanged }: { detail: PatientDetail; onOpenVisits: () => void; onChanged: () => void }) {
  const { t, fmt } = usePortal();
  const p = detail.patient;
  const chart = detail.chart ?? {};
  const meds = (chart.prescriptions ?? []).filter((m) => m.status !== 'Discontinued');
  const last = detail.past_visits[0];
  const vitals = chart.lastAppointment?.vitals;
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
          <CardHeader icon="medication" title={t('currentMedicines')} />
          <ul className="px-5 pb-5 flex flex-col gap-2">
            {meds.length === 0 && <li className="text-sm text-ink-muted">{t('noneRecorded')}</li>}
            {meds.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-semibold text-ink">{m.name} {m.dosage}</span>
                <span className="block text-xs text-ink-muted">{[m.frequency, m.timing, m.duration].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
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
