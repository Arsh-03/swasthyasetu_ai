// The doctor's schedule as a list (grouped by day) or a month calendar. Clicking a scheduled
// appointment opens its meeting room; a completed one opens the visit summary.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { cx } from '../components/ui/cx';
import { doctorApi, type Appointment } from '../services/doctorApi';
import { usePortal } from './PortalContext';
import { navigate, type Route } from './router';
import { addDays, weekdayIndex } from './time';
import { Avatar, Empty, IconButton, Loading, Pill, Segmented, shortName } from './ui';

export function routeForAppointment(apt: Appointment): Route {
  if (apt.status === 'completed' && apt.encounter_id) {
    return { page: 'visit', patientId: apt.patient_id, encounterId: apt.encounter_id };
  }
  if (apt.status === 'scheduled') return { page: 'meeting', appointmentId: apt.appointment_id };
  return { page: 'patient', patientId: apt.patient_id, tab: 'visits' };
}

export function StatusPill({ apt }: { apt: Appointment }) {
  const { t } = usePortal();
  if (apt.status === 'completed') return <Pill tone="success" icon="check" label={t('statusCompleted')} />;
  if (apt.status === 'cancelled') return <Pill tone="neutral" label={t('statusCancelled')} />;
  if (apt.status === 'no_show') return <Pill tone="warning" label={t('statusNoShow')} />;
  const start = new Date(apt.scheduled_at).getTime();
  const now = Date.now();
  if (now >= start - 5 * 60000 && now < start + apt.duration_minutes * 60000) return <Pill tone="primary" dot label={t('statusNow')} />;
  if (now >= start + apt.duration_minutes * 60000) return <Pill tone="warning" label={t('statusOverdue')} />;
  return apt.patient_confirmed ? <Pill tone="neutral" label={t('statusConfirmed')} /> : <Pill tone="neutral" label={t('statusPending')} />;
}

export function AppointmentRow({ apt, showDate = false, hidePatient = false }: { apt: Appointment; showDate?: boolean; hidePatient?: boolean }) {
  const { fmt, t } = usePortal();
  const video = apt.mode.toLowerCase().includes('video');
  return (
    <button
      type="button"
      onClick={() => navigate(routeForAppointment(apt))}
      className={cx(
        'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-control hover:bg-base cursor-pointer transition-colors',
        apt.status === 'cancelled' && 'opacity-60',
      )}
    >
      <span className="w-16 sm:w-20 shrink-0 text-right whitespace-nowrap">
        <span className="block text-sm font-semibold text-ink tabular-nums">{fmt.time(apt.scheduled_at)}</span>
        <span className="block text-2xs text-ink-muted">{showDate ? fmt.date(apt.scheduled_at) : t('minutesShort', { n: apt.duration_minutes })}</span>
      </span>
      <span className="w-px self-stretch bg-hairline" aria-hidden />
      {!hidePatient && <Avatar name={apt.patient_name ?? ''} src={apt.patient_avatar} size={36} />}
      <span className="flex-1 min-w-0">
        {hidePatient ? (
          <span className="block text-sm font-semibold text-ink truncate">{apt.agenda || apt.complaint || t('generalConsultation')}</span>
        ) : (
          <>
            <span className="block text-sm font-semibold text-ink truncate">{shortName(apt.patient_name)}</span>
            <span className="block text-xs text-ink-muted truncate">{apt.agenda || apt.complaint || t('generalConsultation')}</span>
          </>
        )}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 text-2xs text-ink-muted shrink-0" title={apt.mode}>
        <Icon name={video ? 'video' : 'building'} size={16} />
        {video ? t('modeVideo') : t('modeClinic')}
      </span>
      <span className="hidden sm:inline-flex"><StatusPill apt={apt} /></span>
      <Icon name="chevronRight" size={16} tone="muted" />
    </button>
  );
}

/** Appointments from `startDay` for `days` days, refetched when portal data changes. */
function useAppointments(startDay: string, days: number) {
  const { fmt, version } = usePortal();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setError(false);
    const start = fmt.fromLocal(startDay, '00:00').toISOString();
    const end = fmt.fromLocal(addDays(startDay, days), '00:00').toISOString();
    doctorApi.appointments(start, end)
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [startDay, days, fmt, version]);
  return { items, error };
}

export function Schedule() {
  const { t, fmt } = usePortal();
  const [view, setView] = useState<'list' | 'calendar'>(() => (localStorage.getItem('schedule_view') as 'list' | 'calendar') || 'list');
  useEffect(() => { try { localStorage.setItem('schedule_view', view); } catch { /* private mode */ } }, [view]);
  const today = fmt.today();

  return (
    <section className="bg-card rounded-panel border border-hairline shadow-xs min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Icon name="calendar" size={20} tone="primary" weight="duotone" />
          <h3 className="text-subhead font-semibold text-ink">{t('scheduleTitle')}</h3>
        </div>
        <Segmented
          label={t('scheduleView')}
          value={view}
          onChange={setView}
          options={[{ id: 'list', label: t('viewList'), icon: 'menu' }, { id: 'calendar', label: t('viewCalendar'), icon: 'calendar' }]}
        />
      </div>
      {view === 'list' ? <ScheduleList today={today} /> : <ScheduleCalendar today={today} />}
    </section>
  );
}

function ScheduleList({ today }: { today: string }) {
  const { t, fmt } = usePortal();
  const { items, error } = useAppointments(today, 14);
  const groups = useMemo(() => {
    const out = new Map<string, Appointment[]>();
    for (const a of items ?? []) {
      if (a.status === 'cancelled') continue;
      const key = fmt.dayKey(a.scheduled_at);
      out.set(key, [...(out.get(key) ?? []), a]);
    }
    return [...out.entries()];
  }, [items, fmt]);

  if (error) return <Empty icon="offline" title={t('loadError')} />;
  if (!items) return <Loading label={t('loading')} />;
  if (groups.length === 0) return <Empty icon="calendar" title={t('noUpcoming')}>{t('noUpcomingHint')}</Empty>;
  return (
    <div className="px-2 pb-3 max-h-[560px] overflow-y-auto">
      {groups.map(([day, apts]) => (
        <div key={day} className="mb-2">
          <div className="sticky top-0 bg-card z-10 flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-semibold text-ink">
              {day === today ? t('today') : day === addDays(today, 1) ? t('tomorrow') : fmt.weekdayLong(day)}
            </span>
            <span className="text-2xs text-ink-muted">{t('appointmentsCount', { n: apts.length })}</span>
          </div>
          {apts.map((a) => <AppointmentRow key={a.appointment_id} apt={a} />)}
        </div>
      ))}
    </div>
  );
}

function ScheduleCalendar({ today }: { today: string }) {
  const { t, fmt } = usePortal();
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
  const [selected, setSelected] = useState(today);
  const gridStart = addDays(month, -weekdayIndex(month));
  const { items, error } = useAppointments(gridStart, 42);
  const byDay = useMemo(() => {
    const out = new Map<string, Appointment[]>();
    for (const a of items ?? []) {
      if (a.status === 'cancelled') continue;
      const key = fmt.dayKey(a.scheduled_at);
      out.set(key, [...(out.get(key) ?? []), a]);
    }
    return out;
  }, [items, fmt]);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shiftMonth = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 10));
  };
  const selectedItems = byDay.get(selected) ?? [];
  const weekdays = days.slice(0, 7).map((d) => fmt.weekdayShort(d));

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4 px-5 pb-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink">{fmt.monthTitle(month)}</span>
          <div className="flex items-center gap-1">
            <IconButton icon="chevronLeft" label={t('previousMonth')} onClick={() => shiftMonth(-1)} />
            <button type="button" onClick={() => { setMonth(today.slice(0, 7) + '-01'); setSelected(today); }}
              className="h-8 px-3 rounded-control text-xs font-semibold text-primary hover:bg-primary-tint cursor-pointer">{t('today')}</button>
            <IconButton icon="chevronRight" label={t('nextMonth')} onClick={() => shiftMonth(1)} />
          </div>
        </div>
        {error && <Empty icon="offline" title={t('loadError')} />}
        <div role="grid" aria-label={fmt.monthTitle(month)} className="grid grid-cols-7 gap-1">
          {weekdays.map((w) => <div key={w} role="columnheader" className="text-center text-2xs font-semibold text-ink-muted py-1">{w}</div>)}
          {days.map((d) => {
            const count = byDay.get(d)?.length ?? 0;
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const isSel = d === selected;
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${fmt.dateKey(d)}: ${t('appointmentsCount', { n: count })}`}
                onClick={() => setSelected(d)}
                className={cx(
                  'h-14 sm:h-16 rounded-control flex flex-col items-center justify-start pt-1.5 gap-1 cursor-pointer transition-colors border',
                  isSel ? 'bg-primary text-on-primary border-primary' : 'border-transparent hover:bg-base',
                  !inMonth && !isSel && 'text-ink-muted/60',
                  d === today && !isSel && 'border-primary',
                )}
              >
                <span className="text-xs font-semibold tabular-nums">{fmt.dayOfMonth(d)}</span>
                {count > 0 && (
                  <span className={cx('text-3xs font-bold rounded-full px-1.5 min-w-5', isSel ? 'bg-white/25' : 'bg-primary-tint text-primary')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="lg:border-l lg:border-hairline lg:pl-4">
        <p className="text-sm font-semibold text-ink mb-2">{fmt.weekdayLong(selected)}</p>
        {!items ? <Loading label={t('loading')} /> : selectedItems.length === 0 ? (
          <p className="text-xs text-ink-muted py-4">{t('noAppointmentsDay')}</p>
        ) : (
          <div className="-mx-3 flex flex-col">
            {selectedItems.map((a) => <CompactAppointment key={a.appointment_id} apt={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactAppointment({ apt }: { apt: Appointment }) {
  const { fmt, t } = usePortal();
  return (
    <button type="button" onClick={() => navigate(routeForAppointment(apt))}
      className="text-left flex items-start gap-2.5 px-3 py-2 rounded-control hover:bg-base cursor-pointer">
      <span className="text-xs font-semibold text-ink tabular-nums w-20 shrink-0 pt-0.5 whitespace-nowrap">{fmt.time(apt.scheduled_at)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink truncate">{shortName(apt.patient_name)}</span>
        <span className="block text-2xs text-ink-muted truncate">{apt.agenda || t('generalConsultation')}</span>
      </span>
      <StatusPill apt={apt} />
    </button>
  );
}
