// My patients: everyone with an appointment or consultation with this doctor. Search + simple filters.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { doctorApi, type PatientListItem } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { navigate } from '../router';
import { Avatar, Card, Empty, ErrorNote, Loading, PageHeader, Pill, Segmented, shortName } from '../ui';

type Filter = 'all' | 'today' | 'upcoming' | 'attention';

export function PatientsScreen() {
  const { t, fmt, version, notifications } = usePortal();
  const [items, setItems] = useState<PatientListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    doctorApi.patients().then((rows) => { if (alive) { setItems(rows); setError(false); } }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [version, reload]);

  const today = fmt.today();
  const alerted = useMemo(() => new Set(notifications.filter((n) => n.severity === 'critical' && !n.read).map((n) => n.link.patient_id)), [notifications]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((p) => {
      if (q && ![p.full_name, p.abha_address, p.phone_number, p.district ?? '', ...p.conditions].join(' ').toLowerCase().includes(q)) return false;
      if (filter === 'today') return p.next_appointment && fmt.dayKey(p.next_appointment.scheduled_at) === today;
      if (filter === 'upcoming') return !!p.next_appointment;
      if (filter === 'attention') return p.urgency === 'high' || alerted.has(p.patient_id);
      return true;
    });
  }, [items, query, filter, fmt, today, alerted]);

  return (
    <>
      <PageHeader title={t('navPatients')} subtitle={items ? t('patientsCount', { n: items.length }) : undefined} />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <label className="relative flex-1 max-w-md">
          <span className="sr-only">{t('searchPatients')}</span>
          <Icon name="search" size={18} tone="muted" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPatients')}
            className="w-full h-10 rounded-control border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <Segmented label={t('filter')} value={filter} onChange={setFilter} options={[
          { id: 'all', label: t('filterAll') },
          { id: 'today', label: t('today') },
          { id: 'upcoming', label: t('filterUpcoming') },
          { id: 'attention', label: t('filterAttention') },
        ]} />
      </div>

      {error && <ErrorNote message={t('loadError')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} />}
      {!items && !error && <Loading label={t('loading')} />}
      {items && (
        <Card>
          {shown.length === 0 ? (
            <Empty icon="people" title={t('noPatientsMatch')} />
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_24px] gap-4 px-5 py-3 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                <span>{t('patient')}</span><span>{t('conditions')}</span><span>{t('lastVisit')}</span><span>{t('nextAppointment')}</span><span />
              </div>
              <ul className="divide-y divide-hairline">
                {shown.map((p) => (
                  <li key={p.patient_id}>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'patient', patientId: p.patient_id })}
                      className="w-full text-left grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_24px] gap-x-4 gap-y-2 items-center px-5 py-3.5 hover:bg-base cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Avatar name={p.full_name} src={p.avatar_url} size={40} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink truncate">{shortName(p.full_name)}</span>
                            {p.urgency === 'high' && <Pill tone="danger" label={t('urgent')} />}
                          </span>
                          <span className="block text-xs text-ink-muted truncate">
                            {[p.age && t('yearsOld', { n: p.age }), p.gender, p.district].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-1 min-w-0">
                        {p.conditions.slice(0, 2).map((c) => <Pill key={c} label={c} />)}
                        {p.conditions.length > 2 && <Pill label={`+${p.conditions.length - 2}`} />}
                        {p.allergies.length > 0 && <Pill tone="danger" icon="drugAlert" label={t('allergyCount', { n: p.allergies.length })} />}
                      </span>
                      <span className="text-xs text-ink-muted">
                        <span className="md:hidden font-semibold">{t('lastVisit')}: </span>
                        {p.last_visit_at ? fmt.date(p.last_visit_at) : t('never')}
                      </span>
                      <span className="text-xs text-ink">
                        <span className="md:hidden font-semibold text-ink-muted">{t('nextAppointment')}: </span>
                        {p.next_appointment ? fmt.dateTime(p.next_appointment.scheduled_at) : <span className="text-ink-muted">{t('notBooked')}</span>}
                      </span>
                      <Icon name="chevronRight" size={16} tone="muted" className="hidden md:block" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </>
  );
}
