// Home: next appointment, four key numbers, the schedule (list or calendar) and two small charts.
// Unread urgent alerts open as a pop-up here.
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../../components/ui/Icon';
import { doctorApi, type Appointment, type Dashboard, type NotificationItem } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { BarChart } from '../BarChart';
import { BookAppointment } from '../BookAppointment';
import { Schedule, StatusPill } from '../Schedule';
import { navigate, routeForLink } from '../router';
import { Avatar, Button, Card, CardHeader, Dialog, ErrorNote, Loading, PageHeader, shortName } from '../ui';

function useCountdown(iso: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return iso ? Math.round((new Date(iso).getTime() - now) / 60000) : null;
}

export function HomeScreen() {
  const { t, fmt, doctor, version, markRead } = usePortal();
  const [data, setData] = useState<Dashboard | null>(() => {
    try {
      const v = localStorage.getItem('cached_dashboard');
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    const today = fmt.today();
    doctorApi.dashboard(fmt.fromLocal(today, '00:00').toISOString(), fmt.offset())
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
          try { localStorage.setItem('cached_dashboard', JSON.stringify(d)); } catch { /* */ }
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('loadError')));
    return () => { alive = false; };
  }, [fmt, version, reload, t]);

  const hour = Number(fmt.clock(new Date()).slice(0, 2));
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');
  const firstName = doctor?.display_name.replace(/\(.*?\)/g, '').trim() ?? '';
  // Unread urgent alerts pop up; a dismissed one stays dismissed, a new one pops up again.
  const alerts = (data?.alerts ?? []).filter((a) => !dismissed.has(a.notification_id));

  const dismissAlerts = () => {
    markRead(alerts.map((a) => a.notification_id));
    setDismissed((prev) => new Set([...prev, ...alerts.map((a) => a.notification_id)]));
  };
  const openAlert = (a: NotificationItem) => {
    markRead([a.notification_id]);
    setDismissed((prev) => new Set([...prev, a.notification_id]));
    const route = routeForLink(a.link);
    if (route) navigate(route);
  };

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={fmt.weekdayLong(fmt.today())}
        actions={<Button variant="primary" icon="add" onClick={() => setBooking(true)}>{t('bookAppointment')}</Button>}
      />

      {error && <div className="mb-4"><ErrorNote message={t('loadError')} onRetry={() => setReload((n) => n + 1)} retryLabel={t('retry')} /></div>}
      {!data && !error && <Loading label={t('loading')} />}

      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <NextAppointment apt={data.next_appointment} />
            <div className="grid grid-cols-2 gap-3">
              <Stat icon="calendar" label={t('statToday')} value={`${data.stats.today_completed}/${data.stats.today_total}`} hint={t('statTodayHint')} />
              <Stat icon="checkCircle" label={t('statWeek')} value={String(data.stats.week_completed)} hint={t('statWeekHint')} />
              <Stat icon="upcoming" label={t('statUpcoming')} value={String(data.stats.upcoming_7_days)} hint={t('statUpcomingHint')} />
              <Stat icon="patients" label={t('statPatients')} value={String(data.stats.patients_under_care)} hint={t('statPatientsHint')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Schedule />
            <div className="flex flex-col gap-5 min-w-0">
              <Card>
                <CardHeader icon="barChart" title={t('chartCompletedTitle')} subtitle={t('chartCompletedSub')} />
                <div className="px-4 pb-4">
                  <BarChart
                    title={t('chartCompletedTitle')}
                    valueLabel={(n) => t('consultationsCount', { n })}
                    data={data.consultations_by_day.map((d) => ({
                      key: d.date, label: String(fmt.dayOfMonth(d.date)), tooltip: fmt.weekdayLong(d.date), value: d.count,
                    }))}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader icon="upcoming" title={t('chartBookedTitle')} subtitle={t('chartBookedSub')} />
                <div className="px-4 pb-4">
                  <BarChart
                    title={t('chartBookedTitle')}
                    valueLabel={(n) => t('appointmentsCount', { n })}
                    data={data.scheduled_by_day.map((d) => ({
                      key: d.date, label: fmt.weekdayShort(d.date), tooltip: fmt.weekdayLong(d.date), value: d.count,
                    }))}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      <BookAppointment open={booking} onClose={() => setBooking(false)} />

      <Dialog
        open={alerts.length > 0}
        onClose={dismissAlerts}
        tone="danger"
        title={alerts.length > 1 ? t('urgentAlertsTitle', { n: alerts.length }) : t('urgentAlertTitle')}
        footer={<Button onClick={dismissAlerts}>{t('dismiss')}</Button>}
      >
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.notification_id} className="rounded-control border border-danger/30 bg-danger-tint p-3">
              <p className="text-sm font-semibold text-ink">{a.title}</p>
              {a.body && <p className="text-xs text-ink-muted mt-1">{a.body}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xs text-ink-muted">{fmt.dateTime(a.created_at)}</span>
                {routeForLink(a.link) && (
                  <Button size="sm" variant="danger" iconRight="chevronRight" onClick={() => openAlert(a)}>{t('openPatient')}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint: string }) {
  return (
    <div className="bg-card rounded-panel border border-hairline shadow-card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon name={icon} size={18} tone="primary" weight="duotone" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <span className="text-3xl font-semibold text-ink tabular-nums leading-none">{value}</span>
      <span className="text-2xs text-ink-muted">{hint}</span>
    </div>
  );
}

function NextAppointment({ apt }: { apt: Appointment | null }) {
  const { t, fmt } = usePortal();
  const minutes = useCountdown(apt?.scheduled_at);
  if (!apt) {
    return (
      <Card className="p-6 flex items-center gap-4">
        <Icon name="calendar" size={32} tone="muted" weight="duotone" />
        <div>
          <p className="text-subhead font-semibold text-ink">{t('noNextAppointment')}</p>
          <p className="text-xs text-ink-muted mt-1">{t('noUpcomingHint')}</p>
        </div>
      </Card>
    );
  }
  const when = minutes === null ? '' : minutes <= 0
    ? (minutes > -apt.duration_minutes ? t('startedMinutesAgo', { n: -minutes }) : t('runningLate', { n: -minutes }))
    : minutes < 60 ? t('startsInMinutes', { n: minutes })
    : fmt.dayKey(apt.scheduled_at) === fmt.today() ? t('todayAt', { time: fmt.time(apt.scheduled_at) })
    : fmt.dateTime(apt.scheduled_at);
  const video = apt.mode.toLowerCase().includes('video');
  return (
    <Card className="p-5 sm:p-6 flex flex-col gap-4 bg-gradient-to-br from-card to-ice/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t('nextAppointment')}</span>
        <StatusPill apt={apt} />
      </div>
      <div className="flex items-center gap-4">
        <Avatar name={apt.patient_name ?? ''} src={apt.patient_avatar} size={56} />
        <div className="min-w-0">
          <p className="text-xl font-semibold text-ink truncate">{shortName(apt.patient_name)}</p>
          <p className="text-sm text-ink-muted truncate">{apt.agenda || apt.complaint || t('generalConsultation')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink">
        <span className="inline-flex items-center gap-1.5 font-semibold"><Icon name="clock" size={18} tone="primary" />{when}</span>
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <Icon name={video ? 'video' : 'building'} size={18} />{video ? t('modeVideo') : t('modeClinic')} · {t('minutesShort', { n: apt.duration_minutes })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" icon="video" onClick={() => navigate({ page: 'meeting', appointmentId: apt.appointment_id })}>
          {t('openMeetingRoom')}
        </Button>
        <Button size="lg" onClick={() => navigate({ page: 'patient', patientId: apt.patient_id })}>{t('viewPatient')}</Button>
      </div>
    </Card>
  );
}
