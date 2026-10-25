// One past meeting: when, why, what was found, what was prescribed, the doctor's notes, and its activity.
import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { doctorApi, type VisitDetail } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { hrefFor } from '../router';
import { actionLabel } from './AuditScreen';
import { Avatar, Card, CardHeader, ErrorNote, Facts, Loading, Pill, shortName } from '../ui';

export function VisitScreen({ patientId, encounterId }: { patientId: string; encounterId: string }) {
  const { t, fmt } = usePortal();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    doctorApi.visit(encounterId).then((v) => alive && setVisit(v)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [encounterId]);

  const back = hrefFor({ page: 'patient', patientId, tab: 'visits' });
  if (error) return <ErrorNote message={t('loadError')} />;
  if (!visit) return <Loading label={t('loading')} />;

  const minutes = visit.ended_at ? Math.max(1, Math.round((new Date(visit.ended_at).getTime() - new Date(visit.started_at).getTime()) / 60000)) : null;
  const plan = visit.note?.plan ?? {};
  const name = shortName(visit.patient?.full_name);

  return (
    <>
      <nav aria-label={t('breadcrumb')} className="flex flex-wrap items-center gap-1 text-xs font-semibold mb-3">
        <a href="#/patients" className="text-primary hover:underline">{t('navPatients')}</a>
        <Icon name="chevronRight" size={12} tone="muted" />
        <a href={back} className="text-primary hover:underline">{name}</a>
        <Icon name="chevronRight" size={12} tone="muted" />
        <span className="text-ink-muted">{fmt.date(visit.started_at)}</span>
      </nav>

      <Card className="p-5 sm:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={visit.patient?.full_name ?? ''} src={visit.patient?.avatar_url} size={56} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('visitSummary')}</p>
            <h1 className="text-2xl font-semibold text-ink">{visit.note?.assessment || visit.complaint || t('generalConsultation')}</h1>
            <p className="text-sm text-ink-muted mt-1">{name} · {fmt.dateTime(visit.started_at)}{minutes ? ` · ${t('minutesShort', { n: minutes })}` : ''}</p>
          </div>
          {visit.note?.status === 'clinician_approved'
            ? <Pill tone="success" icon="verified" label={t('signed')} />
            : <Pill tone="warning" label={visit.status === 'completed' ? t('unsigned') : t('inProgress')} />}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader icon="clinicalNotes" title={t('clinicalNote')} />
            <div className="px-5 pb-5 flex flex-col gap-4">
              {visit.note ? (
                <>
                  <NoteBlock label={t('fieldComplaint')} text={visit.note.subjective || visit.complaint} />
                  <NoteBlock label={t('examination')} text={visit.note.objective} />
                  <NoteBlock label={t('fieldDiagnosis')} text={visit.note.assessment} />
                </>
              ) : (
                <>
                  <NoteBlock label={t('fieldComplaint')} text={visit.complaint} />
                  <p className="text-sm text-ink-muted">{t('noSignedNote')}</p>
                </>
              )}
            </div>
          </Card>
          {visit.note && (
            <Card>
              <CardHeader icon="medication" title={t('treatmentPlan')} />
              <div className="px-5 pb-5 flex flex-col gap-4">
                <NoteBlock label={t('fieldMedicine')} text={plan.medicine} />
                <NoteBlock label={t('fieldAdvice')} text={plan.advice} />
                <NoteBlock label={t('fieldFollowUp')} text={plan.follow_up} />
              </div>
            </Card>
          )}
          {visit.notepad && (
            <Card>
              <CardHeader icon="notepad" title={t('doctorNotes')} subtitle={t('doctorNotesHint')} />
              <pre className="px-5 pb-5 text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed">{visit.notepad}</pre>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader icon="info" title={t('visitDetails')} />
            <div className="px-5 pb-5">
              <Facts columns={2} items={[
                { label: t('date'), value: fmt.date(visit.started_at) },
                { label: t('time'), value: fmt.time(visit.started_at) },
                { label: t('visitType'), value: visit.mode === 'audio' ? t('audioCall') : visit.mode === 'video' ? t('modeVideo') : visit.mode },
                { label: t('doctor'), value: visit.doctor_name },
                { label: t('vitals'), value: visit.vitals },
                { label: t('signedAt'), value: visit.note?.signed_at ? fmt.dateTime(visit.note.signed_at) : '' },
              ]} />
            </div>
          </Card>
          {(visit.allergies.length > 0 || visit.medications_at_visit.length > 0) && (
            <Card>
              <CardHeader icon="drugAlert" title={t('atTheTimeOfVisit')} />
              <div className="px-5 pb-5 flex flex-col gap-3">
                {visit.allergies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{visit.allergies.map((a) => <Pill key={a} tone="danger" label={a} />)}</div>
                )}
                {visit.medications_at_visit.length > 0 && (
                  <ul className="text-sm list-disc pl-5">{visit.medications_at_visit.map((m) => <li key={m}>{m}</li>)}</ul>
                )}
              </div>
            </Card>
          )}
          {visit.timeline.length > 0 && (
            <Card>
              <CardHeader icon="history" title={t('activity')} />
              <ol className="px-5 pb-5 flex flex-col gap-3">
                {visit.timeline.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span>
                      <span className="block text-sm text-ink">{actionLabel(e.action, t)}</span>
                      <span className="block text-2xs text-ink-muted">{fmt.dateTime(e.at)}{e.detail ? ` · ${e.detail}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function NoteBlock({ label, text }: { label: string; text?: string | null }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{text || '—'}</p>
    </div>
  );
}
