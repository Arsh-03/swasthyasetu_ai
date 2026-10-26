// Readings taken outside the clinic: by the patient (phone camera heart rate) or an ASHA worker on a home visit
// (BP, sugar, temperature, weight). Shows who measured each one, danger levels, and the doctor's open requests.
import { useState } from 'react';
import { Icon, type IconName } from '../components/ui/Icon';
import { cx } from '../components/ui/cx';
import { doctorApi, type ReadingKind, type ReadingRequest, type VitalReading } from '../services/doctorApi';
import { usePortal } from './PortalContext';
import type { StringKey } from './i18n';
import { addDays } from './time';
import { Button, Dialog, Field, Pill, TextArea, TextInput } from './ui';

export const KIND: Record<ReadingKind, { label: StringKey; icon: IconName }> = {
  blood_pressure: { label: 'kindBp', icon: 'vitals' },
  heart_rate: { label: 'kindHeartRate', icon: 'vitals' },
  blood_sugar: { label: 'kindSugar', icon: 'vitals' },
  temperature: { label: 'kindTemperature', icon: 'symptom' },
  weight: { label: 'kindWeight', icon: 'person' },
};
const ORDER: ReadingKind[] = ['blood_pressure', 'heart_rate', 'blood_sugar', 'temperature', 'weight'];

function levelTone(level: VitalReading['level']) {
  return level === 'urgent' ? 'danger' : level === 'normal' ? 'success' : 'warning';
}

/** One reading: value, unit, when, who measured it, and its level. */
export function ReadingLine({ reading, compact = false }: { reading: VitalReading; compact?: boolean }) {
  const { t, fmt } = usePortal();
  const k = KIND[reading.kind] ?? KIND.blood_pressure;
  const by = reading.recorded_by_role === 'asha'
    ? t('measuredByAsha', { name: reading.recorded_by_name ?? '' })
    : reading.method === 'camera_ppg' ? t('cameraEstimate') : t('enteredByPatient');
  const uneven = (reading.details.irregularity ?? 0) > 0.15;
  return (
    <div className={cx('flex items-start gap-3', !compact && 'rounded-control border border-hairline p-3')}>
      <Icon name={k.icon} size={compact ? 18 : 22} tone={reading.level === 'urgent' ? 'danger' : 'primary'} weight="duotone" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted mr-2">{t(k.label)}</span>
          <span className={cx('text-lg font-semibold tabular-nums', reading.level === 'urgent' && 'text-danger-deep')}>{reading.display}</span>{' '}
          <span className="text-ink-muted">{reading.unit}</span>
        </p>
        <p className="text-2xs text-ink-muted">{fmt.dateTime(reading.created_at)} · {by}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {reading.level !== 'normal' && <Pill tone={levelTone(reading.level)} label={reading.reason || reading.level} />}
          {reading.confidence && <Pill tone={reading.confidence === 'good' ? 'success' : 'warning'} label={reading.confidence === 'good' ? t('clearReading') : t('fairReading')} />}
          {uneven && <Pill tone="warning" label={t('unevenBeats')} />}
          {Number(reading.details.readings_averaged) > 1 && <Pill label={t('averagedTwo')} />}
        </div>
      </div>
    </div>
  );
}

/** Patient page card: latest of each kind, the BP trend, open requests, and "Request from ASHA". */
export function ReadingsCard({ patientId, readings, requests, onChanged }: {
  patientId: string; readings: VitalReading[]; requests: ReadingRequest[]; onChanged: () => void;
}) {
  const { t, fmt } = usePortal();
  const [asking, setAsking] = useState(false);
  const latest = ORDER.map((k) => readings.find((r) => r.kind === k)).filter(Boolean) as VitalReading[];
  const bp = readings.filter((r) => r.kind === 'blood_pressure').slice(0, 6).reverse();
  const cancel = async (id: string) => { await doctorApi.cancelRequest(id).catch(() => undefined); onChanged(); };

  return (
    <section className="bg-card rounded-panel border border-hairline shadow-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon name="vitals" size={20} tone="primary" weight="duotone" />
          <div className="min-w-0">
            <h3 className="text-subhead font-semibold text-ink leading-tight">{t('homeReadings')}</h3>
            <p className="text-xs text-ink-muted mt-0.5">{t('homeReadingsHint2')}</p>
          </div>
        </div>
        <Button size="sm" icon="people" onClick={() => setAsking(true)}>{t('requestFromAsha')}</Button>
      </div>
      <div className="px-5 pb-5 flex flex-col gap-2">
        {requests.map((r) => (
          <div key={r.task_id} className="flex items-center gap-2 rounded-control bg-primary-tint px-3 py-2 text-xs">
            <Icon name="hourglass" size={16} tone="primary" />
            <span className="flex-1 min-w-0">
              <span className="font-semibold text-ink">{t('requested')}: {r.kinds.map((k) => t(KIND[k]?.label ?? 'kindBp')).join(', ')}</span>
              <span className="block text-ink-muted">{r.worker_name ? t('askedAsha', { name: r.worker_name }) : t('anyAsha')} · {t('dueBy', { when: r.due_at ? fmt.date(r.due_at) : '—' })}</span>
            </span>
            <button type="button" onClick={() => void cancel(r.task_id)} className="text-2xs font-semibold text-ink-muted hover:text-danger-deep cursor-pointer">{t('cancelRequest')}</button>
          </div>
        ))}
        {latest.length === 0 && requests.length === 0 && <p className="text-sm text-ink-muted">{t('noReadings2')}</p>}
        {latest.map((r) => <ReadingLine key={r.reading_id} reading={r} />)}
        {bp.length > 1 && <BpTrend readings={bp} />}
      </div>
      <RequestDialog open={asking} onClose={() => setAsking(false)} patientId={patientId} onSent={onChanged} />
    </section>
  );
}

/** Small systolic/diastolic trend, oldest to newest (single chart, one axis). */
function BpTrend({ readings }: { readings: VitalReading[] }) {
  const { t, fmt } = usePortal();
  const w = 300, h = 90, pad = 16;
  const values = readings.flatMap((r) => [r.value, r.value2 ?? r.value]);
  const lo = Math.min(60, ...values) - 5, hi = Math.max(160, ...values) + 5;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, readings.length - 1);
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  const line = (pick: (r: VitalReading) => number) => readings.map((r, i) => `${x(i)},${y(pick(r))}`).join(' ');
  return (
    <figure className="m-0 mt-1">
      <figcaption className="text-2xs font-semibold text-ink-muted mb-1">{t('bpTrend')}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img"
        aria-label={readings.map((r) => `${fmt.date(r.created_at)}: ${r.display}`).join('; ')}>
        <line x1={pad} x2={w - pad} y1={y(140)} y2={y(140)} stroke="var(--color-warning)" strokeDasharray="3 3" strokeWidth={1} />
        <text x={w - pad} y={y(140) - 3} textAnchor="end" fontSize="8" fill="var(--color-ink-muted)">140</text>
        <polyline points={line((r) => r.value)} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" />
        <polyline points={line((r) => r.value2 ?? r.value)} fill="none" stroke="var(--color-primary)" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" />
        {readings.map((r, i) => (
          <g key={r.reading_id}>
            <circle cx={x(i)} cy={y(r.value)} r={3.5} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={1.5}><title>{`${fmt.date(r.created_at)}: ${r.display}`}</title></circle>
            <circle cx={x(i)} cy={y(r.value2 ?? r.value)} r={3} fill="var(--color-primary-soft)" stroke="var(--color-card)" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      <p className="text-3xs text-ink-muted">{t('bpTrendHint')}</p>
    </figure>
  );
}

function RequestDialog({ open, onClose, patientId, onSent }: { open: boolean; onClose: () => void; patientId: string; onSent: () => void }) {
  const { t, fmt, toast } = usePortal();
  const [kinds, setKinds] = useState<ReadingKind[]>(['blood_pressure']);
  const [due, setDue] = useState(() => addDays(fmt.today(), 2));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: ReadingKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const send = async () => {
    if (!kinds.length) { setError(t('chooseReading')); return; }
    setBusy(true);
    try {
      const r = await doctorApi.requestReadings(patientId, { kinds, due_at: fmt.fromLocal(due, '18:00').toISOString(), note });
      toast(r.worker_name ? t('requestSentTo', { name: r.worker_name }) : t('requestSentAny'), 'success');
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={t('requestFromAsha')} description={t('requestFromAshaHint')}
      footer={<><Button onClick={onClose}>{t('close')}</Button><Button variant="primary" onClick={send} disabled={busy}>{busy ? t('saving') : t('sendRequest')}</Button></>}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="text-xs font-semibold text-ink mb-1.5">{t('readingsToTake')}</legend>
          {(['blood_pressure', 'blood_sugar', 'temperature', 'weight'] as ReadingKind[]).map((k) => (
            <label key={k} className={cx('inline-flex items-center gap-2 h-9 px-3 rounded-full border text-sm cursor-pointer',
              kinds.includes(k) ? 'bg-primary text-on-primary border-primary' : 'bg-card border-border text-ink')}>
              <input type="checkbox" className="sr-only" checked={kinds.includes(k)} onChange={() => toggle(k)} />
              {kinds.includes(k) && <Icon name="check" size={14} />} {t(KIND[k].label)}
            </label>
          ))}
        </fieldset>
        <Field label={t('dueDate')}>{(id) => <TextInput id={id} type="date" value={due} min={fmt.today()} onChange={(e) => setDue(e.target.value)} />}</Field>
        <Field label={t('noteForAsha')}>{(id) => <TextArea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('noteForAshaPlaceholder')} />}</Field>
        {error && <p role="alert" className="text-xs text-danger-deep">{error}</p>}
      </div>
    </Dialog>
  );
}
