// Audit trail with filters (time range, category, problems only, search). Rows are grouped by day and
// open the page they are about (patient, visit, records).
import { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { doctorApi, type AuditCategory, type AuditItem, type AuditPage } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { navigate, routeForLink } from '../router';
import { addDays } from '../time';
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHeader, Pill, SelectInput, TextInput, shortName } from '../ui';
import type { StringKey } from '../i18n';

const PAGE = 50;

const CATEGORIES: { id: AuditCategory; icon: IconName; label: StringKey }[] = [
  { id: 'appointments', icon: 'calendar', label: 'catAppointments' },
  { id: 'consultations', icon: 'clinicalNotes', label: 'catConsultations' },
  { id: 'consent_records', icon: 'shieldCheck', label: 'catConsentRecords' },
  { id: 'alerts', icon: 'emergency', label: 'catAlerts' },
  { id: 'account', icon: 'person', label: 'catAccount' },
];

const DEFAULT_CATEGORIES: AuditCategory[] = ['appointments', 'consultations', 'consent_records', 'alerts'];

const ACTION_KEYS: Record<string, StringKey> = {
  APPOINTMENT_BOOKED: 'actAppointmentBooked',
  APPOINTMENT_RESCHEDULED: 'actAppointmentRescheduled',
  APPOINTMENT_CANCELLED: 'actAppointmentCancelled',
  APPOINTMENT_UPDATED: 'actAppointmentUpdated',
  CONSULTATION_OPENED: 'actConsultationOpened',
  SYMPTOM_INTAKE_SUBMITTED: 'actIntake',
  CARE_PLAN_SIGNED_AND_ISSUED: 'actNoteSigned',
  NOTEPAD_DRAFT_SAVED: 'actNotesSaved',
  RECOVERY_CHECKIN: 'actCheckin',
  CONSENT_REQUEST: 'actConsentRequested',
  CONSENT_APPROVED_BY_PATIENT: 'actConsentApproved',
  ABHA_CONSENT_APPROVED_OTP_VERIFIED: 'actConsentApproved',
  DPDP_OTP_VERIFIED_APPROVAL: 'actConsentApproved',
  CONSENT_DECLINED: 'actConsentDeclined',
  CONSENT_EXPIRED_REVOKED: 'actConsentRevoked',
  CONSENT_TOKEN_MINTED: 'actConsentToken',
  RECORD_STREAM_ACCESSED: 'actRecordViewed',
  MEDICAL_RECORD_UPLOADED_VAULT: 'actRecordUploaded',
  UNAUTHORIZED_RECORD_ACCESS_ATTEMPT: 'actUnauthorized',
  DOCTOR_REQUESTED_ABHA_LINKAGE: 'actAbhaLink',
  DOCTOR_UPDATED_PATIENT_MEDICAL_HISTORY: 'actHistoryUpdated',
  PATIENT_MEDICAL_HISTORY_UPDATED: 'actHistoryUpdated',
  DOCTOR_LOGIN_AUTHENTICATED: 'actDoctorSignIn',
  PATIENT_LOGIN_AUTHENTICATED: 'actPatientSignIn',
  DOCTOR_SETTINGS_UPDATED: 'actSettingsChanged',
  PATIENT_ACCOUNT_CREATED: 'actPatientRegistered',
  ABHA_ACCOUNT_PROVISIONED_EKYC: 'actPatientRegistered',
  DOCTOR_ACCOUNT_REGISTERED_NMC: 'actDoctorRegistered',
};

/** Readable name of an audit action ("CONSENT_REQUEST" -> "Record access requested"). */
export function actionLabel(action: string, t: (k: StringKey) => string): string {
  const key = ACTION_KEYS[action];
  if (key) return t(key);
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Range = '1' | '7' | '30' | '90' | 'all' | 'custom';

export function AuditScreen() {
  const { t, fmt, version } = usePortal();
  const [range, setRange] = useState<Range>('7');
  const [from, setFrom] = useState(() => addDays(fmt.today(), -30));
  const [to, setTo] = useState(() => fmt.today());
  // Sign-ins are routine, so they start hidden; one click on the chip shows them.
  const [categories, setCategories] = useState<AuditCategory[]>(DEFAULT_CATEGORIES);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<AuditPage | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Search waits for a pause in typing.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo(() => {
    const today = fmt.today();
    let start: string | undefined;
    let end: string | undefined;
    if (range === 'custom') {
      start = fmt.fromLocal(from, '00:00').toISOString();
      end = fmt.fromLocal(addDays(to, 1), '00:00').toISOString();
    } else if (range !== 'all') {
      start = fmt.fromLocal(addDays(today, 1 - Number(range)), '00:00').toISOString();
    }
    return { start, end, category: categories.join(','), outcome: problemsOnly ? 'problem' : undefined, q: query };
  }, [range, from, to, categories, problemsOnly, query, fmt]);

  useEffect(() => {
    let alive = true;
    setError(false);
    setPage(null);
    doctorApi.audit({ ...filters, limit: PAGE, offset: 0 })
      .then((p) => { if (alive) { setPage(p); setItems(p.items); } })
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [filters, version]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const p = await doctorApi.audit({ ...filters, limit: PAGE, offset: items.length });
      setItems((prev) => [...prev, ...p.items]);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleCategory = (c: AuditCategory) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const clear = () => { setRange('7'); setCategories(DEFAULT_CATEGORIES); setProblemsOnly(false); setSearch(''); };
  const filtered = categories.join() !== DEFAULT_CATEGORIES.join() || problemsOnly || search.trim() !== '' || range !== '7';

  const groups = useMemo(() => {
    const out = new Map<string, AuditItem[]>();
    for (const it of items) {
      const key = fmt.dayKey(it.timestamp);
      out.set(key, [...(out.get(key) ?? []), it]);
    }
    return [...out.entries()];
  }, [items, fmt]);

  return (
    <>
      <PageHeader title={t('navAudit')} subtitle={t('auditSubtitle')} />
      <Card className="p-4 mb-4 flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
          <label className="relative">
            <span className="sr-only">{t('searchAudit')}</span>
            <Icon name="search" size={18} tone="muted" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchAudit')}
              className="w-full h-10 rounded-control border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary" />
          </label>
          <label>
            <span className="sr-only">{t('timeRange')}</span>
            <SelectInput value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label={t('timeRange')}>
              <option value="1">{t('rangeToday')}</option>
              <option value="7">{t('rangeDays', { n: 7 })}</option>
              <option value="30">{t('rangeDays', { n: 30 })}</option>
              <option value="90">{t('rangeDays', { n: 90 })}</option>
              <option value="all">{t('rangeAll')}</option>
              <option value="custom">{t('rangeCustom')}</option>
            </SelectInput>
          </label>
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <Field label={t('from')}>{(id) => <TextInput id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label={t('to')}>{(id) => <TextInput id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted mr-1 flex items-center gap-1"><Icon name="filter" size={14} />{t('category')}</span>
          {CATEGORIES.map((c) => {
            const on = categories.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCategory(c.id)}
                className={cx('inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border cursor-pointer transition-colors',
                  on ? 'bg-primary text-on-primary border-primary' : 'bg-card text-ink border-border hover:bg-base')}>
                <Icon name={c.icon} size={14} />
                {t(c.label)}
                {page && <span className={cx('rounded-full px-1.5 text-3xs', on ? 'bg-white/25' : 'bg-ink-tint')}>{page.category_counts[c.id] ?? 0}</span>}
              </button>
            );
          })}
          <span className="w-px h-6 bg-hairline mx-1" aria-hidden />
          <button type="button" aria-pressed={problemsOnly} onClick={() => setProblemsOnly(!problemsOnly)}
            className={cx('inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border cursor-pointer',
              problemsOnly ? 'bg-danger-deep text-on-primary border-danger-deep' : 'bg-card text-ink border-border hover:bg-base')}>
            <Icon name="warning" size={14} /> {t('problemsOnly')}
          </button>
          {filtered && <button type="button" onClick={clear} className="text-xs font-semibold text-primary hover:underline ml-auto cursor-pointer">{t('clearFilters')}</button>}
        </div>
      </Card>

      {error && <ErrorNote message={t('loadError')} />}
      {!page && !error && <Loading label={t('loading')} />}
      {page && (
        <>
          <p className="text-xs text-ink-muted mb-2" aria-live="polite">{t('eventsShown', { shown: items.length, total: page.total })}</p>
          {items.length === 0 ? <Card><Empty icon="history" title={t('noEvents')}>{t('noEventsHint')}</Empty></Card> : (
            <div className="flex flex-col gap-4">
              {groups.map(([day, rows]) => (
                <Card key={day}>
                  <h3 className="px-5 py-3 text-xs font-semibold text-ink-muted border-b border-hairline">
                    {day === fmt.today() ? t('today') : fmt.weekdayLong(day)}
                  </h3>
                  <ul className="divide-y divide-hairline">{rows.map((it) => <AuditRow key={it.event_id} item={it} />)}</ul>
                </Card>
              ))}
              {items.length < page.total && (
                <div className="flex justify-center">
                  <Button onClick={loadMore} disabled={loadingMore}>{loadingMore ? t('loading') : t('loadMore')}</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function AuditRow({ item }: { item: AuditItem }) {
  const { t, fmt } = usePortal();
  const cat = CATEGORIES.find((c) => c.id === item.category) ?? CATEGORIES[4];
  const route = routeForLink(item.link);
  const body = (
    <>
      <span className={cx('w-9 h-9 rounded-full flex items-center justify-center shrink-0',
        item.problem ? 'bg-danger-tint text-danger-deep' : 'bg-ice text-primary-deep')}>
        <Icon name={cat.icon} size={18} weight="duotone" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{actionLabel(item.action, t)}</span>
          {item.problem && <Pill tone="danger" label={item.outcome.toLowerCase()} />}
        </span>
        <span className="block text-xs text-ink-muted truncate">
          {[shortName(item.actor_name), item.patient_name && item.patient_name !== item.actor_name ? `${t('patient')}: ${shortName(item.patient_name)}` : null, item.detail]
            .filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="text-xs text-ink-muted tabular-nums shrink-0">{fmt.time(item.timestamp)}</span>
      {route ? <Icon name="chevronRight" size={16} tone="muted" /> : <span className="w-4" />}
    </>
  );
  return (
    <li>
      {route ? (
        <button type="button" onClick={() => navigate(route)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-base cursor-pointer">{body}</button>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3">{body}</div>
      )}
    </li>
  );
}
