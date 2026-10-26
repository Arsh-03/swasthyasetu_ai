// Portal frame: left navigation (Home, Patients, Audit trail), top bar with language, notifications and profile.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../components/ui/Icon';
import { cx } from '../components/ui/cx';
import { usePortal } from './PortalContext';
import { hrefFor, navigate, routeForLink, type Route } from './router';
import { LANGUAGES, type Lang } from './i18n';
import { Avatar, IconButton } from './ui';
import type { NotificationItem } from '../services/doctorApi';
import { useCallTimer } from '../services/call/useCallTimer';

const NAV: { page: 'home' | 'patients' | 'messages' | 'audit' | 'lab'; icon: IconName; label: 'navHome' | 'navPatients' | 'navMessages' | 'navAudit' | 'navLab' }[] = [
  { page: 'home', icon: 'home', label: 'navHome' },
  { page: 'patients', icon: 'patients', label: 'navPatients' },
  { page: 'messages', icon: 'chat', label: 'navMessages' },
  { page: 'audit', icon: 'history', label: 'navAudit' },
  { page: 'lab', icon: 'aiAssist', label: 'navLab' },
];

function activeSection(route: Route): string {
  if (route.page === 'patient' || route.page === 'visit') return 'patients';
  if (route.page === 'meeting') return 'home';
  return route.page;
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { t, doctor, chatUnread } = usePortal();
  const [menuOpen, setMenuOpen] = useState(false);
  const section = activeSection(route);
  useEffect(() => setMenuOpen(false), [route]);

  const nav = (
    <nav aria-label={t('mainNavigation')} className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = section === item.page;
        return (
          <a
            key={item.page}
            href={hrefFor({ page: item.page } as Route)}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 h-11 px-3 rounded-control text-sm font-semibold transition-colors',
              active ? 'bg-primary-tint text-primary' : 'text-ink-muted hover:bg-ink-tint hover:text-ink',
            )}
          >
            <Icon name={item.icon} size={20} weight={active ? 'duotone' : 'regular'} />
            <span className="flex-1">{t(item.label)}</span>
            {item.page === 'messages' && chatUnread > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-3xs font-bold flex items-center justify-center"
                aria-label={t('unreadMessages', { n: chatUnread })}>{chatUnread > 99 ? '99+' : chatUnread}</span>
            )}
          </a>
        );
      })}
    </nav>
  );

  const brand = (
    <a href="#/home" className="flex items-center gap-2.5 px-6 h-16 shrink-0">
      <span className="w-9 h-9 rounded-control bg-primary text-on-primary flex items-center justify-center">
        <Icon name="brand" size={20} weight="duotone" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-ink">CareBridge</span>
        <span className="text-2xs text-ink-muted">{t('doctorPortal')}</span>
      </span>
    </a>
  );

  const settingsLink = (
    <a
      href="#/settings"
      aria-current={section === 'settings' ? 'page' : undefined}
      className={cx(
        'mx-3 flex items-center gap-3 h-11 px-3 rounded-control text-sm font-semibold transition-colors',
        section === 'settings' ? 'bg-primary-tint text-primary' : 'text-ink-muted hover:bg-ink-tint hover:text-ink',
      )}
    >
      <Icon name="settings" size={20} />
      {t('navSettings')}
    </a>
  );

  return (
    <div className="min-h-screen bg-base text-ink flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] bg-card px-3 py-2 rounded-control">
        {t('skipToContent')}
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-hairline bg-card sticky top-0 h-screen">
        {brand}
        <div className="flex-1 pt-2">{nav}</div>
        <div className="pb-4 flex flex-col gap-3">
          {settingsLink}
          {doctor && (
            <div className="mx-3 px-3 py-3 rounded-control bg-base flex items-center gap-3">
              <Avatar name={doctor.display_name} size={36} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate">{doctor.display_name}</p>
                <p className="text-2xs text-ink-muted truncate">{doctor.specialty}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-scrim" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card flex flex-col shadow-lg">
            {brand}
            <div className="flex-1 pt-2">{nav}</div>
            <div className="pb-4">{settingsLink}</div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} route={route} />
        <main id="main" className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function TopBar({ onMenu, route }: { onMenu: () => void; route: Route }) {
  const { t, lang, setLang, consultation, call } = usePortal();
  const inCall = call.callState === 'in_call' || call.callState === 'calling';
  const timer = useCallTimer(call.callStartedAt);
  return (
    <header className="sticky top-0 z-40 h-16 bg-base/90 backdrop-blur border-b border-hairline flex items-center gap-2 px-4 sm:px-6 lg:px-8">
      <IconButton icon="hamburger" label={t('openMenu')} onClick={onMenu} className="lg:hidden" />
      <div className="flex-1" />
      {inCall && consultation && route.page !== 'meeting' && (
        <a
          href={consultation.appointmentId ? hrefFor({ page: 'meeting', appointmentId: consultation.appointmentId }) : '#/home'}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-success-deep text-on-primary text-xs font-semibold"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {t('returnToCall')} {timer && <span className="font-mono">{timer}</span>}
        </a>
      )}
      <label className="relative flex items-center">
        <span className="sr-only">{t('language')}</span>
        <Icon name="translate" size={18} tone="muted" className="absolute left-3 pointer-events-none" />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="appearance-none h-10 pl-9 pr-8 rounded-control border border-border bg-card text-sm font-semibold text-ink cursor-pointer outline-none focus:border-primary"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={14} tone="muted" className="absolute right-3 pointer-events-none" />
      </label>
      <NotificationBell />
      <ProfileMenu />
    </header>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const KIND_ICON: Record<NotificationItem['kind'], IconName> = {
  appointment: 'calendar', alert: 'emergency', consent: 'shieldCheck', call: 'call', system: 'info',
};

export function relativeTime(iso: string, t: ReturnType<typeof usePortal>['t']): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('justNow');
  if (mins < 60) return t('minutesAgo', { n: mins });
  if (mins < 60 * 24) return t('hoursAgo', { n: Math.floor(mins / 60) });
  return t('daysAgo', { n: Math.floor(mins / 1440) });
}

function NotificationBell() {
  const { t, notifications, unread, markRead } = usePortal();
  const { open, setOpen, ref } = usePopover();

  const openItem = (n: NotificationItem) => {
    if (!n.read) markRead([n.notification_id]);
    setOpen(false);
    const route = routeForLink(n.link);
    if (route) navigate(route);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={unread ? t('notificationsUnread', { n: unread }) : t('notifications')}
        className="relative w-10 h-10 rounded-control flex items-center justify-center text-ink-muted hover:bg-ink-tint hover:text-ink cursor-pointer"
      >
        <Icon name="notification" size={22} weight={unread ? 'duotone' : 'regular'} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-deep text-on-primary text-3xs font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[min(380px,calc(100vw-2rem))] bg-card rounded-panel border border-hairline shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 h-12 border-b border-hairline">
            <span className="text-sm font-semibold">{t('notifications')}</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead('all')} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
                {t('markAllRead')}
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-hairline">
            {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-muted">{t('noNotifications')}</li>}
            {notifications.map((n) => (
              <li key={n.notification_id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cx('w-full text-left flex gap-3 px-4 py-3 hover:bg-base cursor-pointer', !n.read && 'bg-primary-tint')}
                >
                  <span className={cx(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                    n.severity === 'critical' ? 'bg-danger-tint text-danger-deep' : n.severity === 'warning' ? 'bg-warning-tint text-warning-deep' : 'bg-ice text-primary-deep',
                  )}>
                    <Icon name={KIND_ICON[n.kind] ?? 'info'} size={18} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className={cx('text-sm text-ink flex-1', !n.read && 'font-semibold')}>{n.title}</span>
                      {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-label={t('unread')} />}
                    </span>
                    {n.body && <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-2xs text-ink-muted mt-1">{relativeTime(n.created_at, t)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <a href="#/audit" onClick={() => setOpen(false)} className="block text-center text-xs font-semibold text-primary py-3 border-t border-hairline hover:bg-base">
            {t('viewAuditTrail')}
          </a>
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { t, doctor, logout } = usePortal();
  const { open, setOpen, ref } = usePopover();
  if (!doctor) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('profileMenu')}
        className="flex items-center gap-2 h-10 pl-1 pr-2 rounded-full hover:bg-ink-tint cursor-pointer"
      >
        <Avatar name={doctor.display_name} size={32} />
        <Icon name="chevronDown" size={14} tone="muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-64 bg-card rounded-panel border border-hairline shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-hairline mb-1">
            <p className="text-sm font-semibold text-ink truncate">{doctor.display_name}</p>
            <p className="text-2xs text-ink-muted truncate">{doctor.registration_number} · {doctor.specialty}</p>
          </div>
          {([
            ['profile', 'person', 'settingsProfile'],
            ['availability', 'calendar', 'settingsAvailability'],
            ['preferences', 'translate', 'settingsPreferences'],
          ] as const).map(([section, icon, label]) => (
            <a key={section} href={`#/settings?section=${section}`} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 h-10 text-sm text-ink hover:bg-base">
              <Icon name={icon} size={18} tone="muted" /> {t(label)}
            </a>
          ))}
          <button type="button" onClick={logout} className="w-full flex items-center gap-3 px-4 h-10 text-sm text-danger-deep hover:bg-danger-tint cursor-pointer border-t border-hairline mt-1">
            <Icon name="signOut" size={18} /> {t('signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
