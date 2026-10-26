// Settings: Profile (name, department, facility) · Preferences (language, date & time, time zone) ·
// Availability (weekly hours and leave days; bookings outside them ask for confirmation).
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import type { DoctorSettings, Leave, TimeSlot, Weekday } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { hrefFor } from '../router';
import { LANGUAGES } from '../i18n';
import { makeFormatters } from '../time';
import { Button, Card, CardHeader, Field, IconButton, Loading, PageHeader, SelectInput, TextInput } from '../ui';

type Section = 'profile' | 'preferences' | 'availability';
const SECTIONS: { id: Section; icon: IconName; label: 'settingsProfile' | 'settingsPreferences' | 'settingsAvailability' }[] = [
  { id: 'profile', icon: 'person', label: 'settingsProfile' },
  { id: 'preferences', icon: 'settings', label: 'settingsPreferences' },
  { id: 'availability', icon: 'calendar', label: 'settingsAvailability' },
];
const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];

export function SettingsScreen({ section }: { section?: string }) {
  const { t, settings } = usePortal();
  const current: Section = SECTIONS.some((s) => s.id === section) ? (section as Section) : 'profile';
  return (
    <>
      <PageHeader title={t('navSettings')} subtitle={t('settingsSubtitle')} />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={t('navSettings')} className="flex lg:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <a key={s.id} href={hrefFor({ page: 'settings', section: s.id })} aria-current={current === s.id ? 'page' : undefined}
              className={cx('flex items-center gap-2.5 h-10 px-3 rounded-control text-sm font-semibold whitespace-nowrap',
                current === s.id ? 'bg-primary-tint text-primary' : 'text-ink-muted hover:bg-ink-tint hover:text-ink')}>
              <Icon name={s.icon} size={18} /> {t(s.label)}
            </a>
          ))}
        </nav>
        {!settings ? <Loading label={t('loading')} /> : (
          <>
            {current === 'profile' && <ProfileSection settings={settings} />}
            {current === 'preferences' && <PreferencesSection settings={settings} />}
            {current === 'availability' && <AvailabilitySection settings={settings} />}
          </>
        )}
      </div>
    </>
  );
}

function useSave() {
  const { t, saveSettings, toast } = usePortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Parameters<typeof saveSettings>[0]) => {
    setBusy(true);
    setError(null);
    try {
      await saveSettings(patch);
      toast(t('settingsSaved'), 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

function ProfileSection({ settings }: { settings: DoctorSettings }) {
  const { t } = usePortal();
  const [name, setName] = useState(settings.profile.display_name);
  const [dept, setDept] = useState(settings.profile.specialty);
  const [facility, setFacility] = useState(settings.profile.facility);
  const { busy, error, save } = useSave();
  const dirty = name !== settings.profile.display_name || dept !== settings.profile.specialty || facility !== settings.profile.facility;
  return (
    <Card>
      <CardHeader title={t('settingsProfile')} subtitle={t('profileHint')} />
      <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
        <Field label={t('displayName')} className="sm:col-span-2">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label={t('department')}>{(id) => <TextInput id={id} value={dept} onChange={(e) => setDept(e.target.value)} />}</Field>
        <Field label={t('facility')}>{(id) => <TextInput id={id} value={facility} onChange={(e) => setFacility(e.target.value)} />}</Field>
        <Field label={t('registrationNumber')} hint={t('registrationHint')}>{(id) => <TextInput id={id} value={settings.profile.registration_number} disabled />}</Field>
      </div>
      <SaveBar busy={busy} error={error} disabled={!dirty || name.trim().length < 2}
        onSave={() => save({ display_name: name.trim(), specialty: dept.trim(), facility: facility.trim() })} />
    </Card>
  );
}

function PreferencesSection({ settings }: { settings: DoctorSettings }) {
  const { t } = usePortal();
  const [prefs, setPrefs] = useState(settings.prefs);
  const { busy, error, save } = useSave();
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([...TIME_ZONES, browserTz, prefs.timezone])];
  const preview = makeFormatters(prefs);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(settings.prefs);
  return (
    <Card>
      <CardHeader title={t('settingsPreferences')} subtitle={t('preferencesHint')} />
      <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
        <Field label={t('language')}>
          {(id) => (
            <SelectInput id={id} value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value as typeof prefs.language })}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={t('timeZone')}>
          {(id) => (
            <SelectInput id={id} value={prefs.timezone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={t('dateFormat')}>
          {(id) => (
            <SelectInput id={id} value={prefs.date_format} onChange={(e) => setPrefs({ ...prefs, date_format: e.target.value })}>
              <option value="DD MMM YYYY">25 Oct 2026</option>
              <option value="DD/MM/YYYY">25/10/2026</option>
              <option value="YYYY-MM-DD">2026-10-25</option>
            </SelectInput>
          )}
        </Field>
        <Field label={t('timeFormat')}>
          {(id) => (
            <SelectInput id={id} value={prefs.time_format} onChange={(e) => setPrefs({ ...prefs, time_format: e.target.value as '12h' | '24h' })}>
              <option value="12h">{t('time12h')}</option>
              <option value="24h">{t('time24h')}</option>
            </SelectInput>
          )}
        </Field>
        <Field label={t('chatWindow')} hint={t('chatWindowHint')}>
          {(id) => (
            <SelectInput id={id} value={prefs.chat_window_days} onChange={(e) => setPrefs({ ...prefs, chat_window_days: Number(e.target.value) })}>
              {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{t('daysAfterVisit', { n: d })}</option>)}
            </SelectInput>
          )}
        </Field>
        <p className="sm:col-span-2 text-xs text-ink-muted">{t('preview')}: <span className="font-semibold text-ink">{preview.dateTime(new Date())}</span></p>
      </div>
      <SaveBar busy={busy} error={error} disabled={!dirty} onSave={() => save({ prefs })} />
    </Card>
  );
}

function AvailabilitySection({ settings }: { settings: DoctorSettings }) {
  const { t, fmt } = usePortal();
  const [weekly, setWeekly] = useState(settings.availability.weekly);
  const [leaves, setLeaves] = useState<Leave[]>(settings.availability.leaves);
  const [newLeave, setNewLeave] = useState<Leave>({ start: fmt.today(), end: fmt.today(), reason: '' });
  const { busy, error, save } = useSave();
  useEffect(() => { setWeekly(settings.availability.weekly); setLeaves(settings.availability.leaves); }, [settings]);

  const setDay = (day: Weekday, slots: TimeSlot[]) => setWeekly({ ...weekly, [day]: slots });
  // 26 Oct 2026 is a Monday.
  const dayLabel = (i: number) => new Intl.DateTimeFormat(fmt.locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 26 + i)));
  const hours = WEEKDAYS.reduce((sum, d) => sum + (weekly[d] ?? []).reduce((s, sl) => {
    const [a, b] = [sl.start, sl.end].map((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)));
    return s + Math.max(0, b - a);
  }, 0), 0) / 60;
  const copyMonday = () => setWeekly({ ...weekly, tue: weekly.mon, wed: weekly.mon, thu: weekly.mon, fri: weekly.mon });
  const dirty = JSON.stringify({ weekly, leaves }) !== JSON.stringify(settings.availability);
  const invalid = WEEKDAYS.some((d) => (weekly[d] ?? []).some((s) => !s.start || !s.end || s.start >= s.end));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title={t('weeklyHours')} subtitle={t('weeklyHoursHint', { n: Math.round(hours * 10) / 10 })}
          action={<Button size="sm" variant="ghost" onClick={copyMonday}>{t('copyMonday')}</Button>} />
        <ul className="divide-y divide-hairline border-t border-hairline">
          {WEEKDAYS.map((day, i) => {
            const slots = weekly[day] ?? [];
            const on = slots.length > 0;
            return (
              <li key={day} className="flex flex-col sm:flex-row sm:items-start gap-3 px-5 py-3.5">
                <label className="flex items-center gap-3 w-40 shrink-0 pt-2 cursor-pointer">
                  <input type="checkbox" checked={on} className="w-4 h-4 accent-(--color-primary)"
                    onChange={(e) => setDay(day, e.target.checked ? [{ start: '09:00', end: '17:00' }] : [])} />
                  <span className="text-sm font-semibold text-ink">{dayLabel(i)}</span>
                </label>
                <div className="flex-1 flex flex-col gap-2">
                  {!on && <span className="text-sm text-ink-muted pt-2">{t('notAvailable')}</span>}
                  {slots.map((s, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <TextInput type="time" step={900} value={s.start} aria-label={t('from')} className="w-32"
                        onChange={(e) => setDay(day, slots.map((x, k) => (k === j ? { ...x, start: e.target.value } : x)))} />
                      <span className="text-ink-muted">–</span>
                      <TextInput type="time" step={900} value={s.end} aria-label={t('to')} className="w-32"
                        onChange={(e) => setDay(day, slots.map((x, k) => (k === j ? { ...x, end: e.target.value } : x)))} />
                      <IconButton icon="trash" label={t('removeSlot')} onClick={() => setDay(day, slots.filter((_, k) => k !== j))} />
                      {s.start >= s.end && <span className="text-2xs text-danger-deep">{t('endAfterStart')}</span>}
                    </div>
                  ))}
                  {on && (
                    <button type="button" onClick={() => setDay(day, [...slots, { start: slots.at(-1)?.end ?? '14:00', end: '18:00' }])}
                      className="self-start text-xs font-semibold text-primary hover:underline cursor-pointer">+ {t('addSlot')}</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title={t('leaveDays')} subtitle={t('leaveDaysHint')} />
        <div className="px-5 pb-5 flex flex-col gap-4">
          {leaves.length === 0 ? <p className="text-sm text-ink-muted">{t('noLeave')}</p> : (
            <ul className="flex flex-col gap-2">
              {leaves.map((l, i) => (
                <li key={l.id ?? i} className="flex items-center gap-3 rounded-control bg-base px-3 py-2">
                  <Icon name="calendar" size={18} tone="primary" />
                  <span className="flex-1 text-sm">
                    <span className="font-semibold">{l.start === l.end ? fmt.dateKey(l.start) : `${fmt.dateKey(l.start)} – ${fmt.dateKey(l.end)}`}</span>
                    {l.reason && <span className="text-ink-muted"> · {l.reason}</span>}
                  </span>
                  <IconButton icon="trash" label={t('removeLeave')} onClick={() => setLeaves(leaves.filter((_, k) => k !== i))} />
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] items-end">
            <Field label={t('from')}>{(id) => <TextInput id={id} type="date" value={newLeave.start} onChange={(e) => setNewLeave({ ...newLeave, start: e.target.value, end: newLeave.end < e.target.value ? e.target.value : newLeave.end })} />}</Field>
            <Field label={t('to')}>{(id) => <TextInput id={id} type="date" value={newLeave.end} min={newLeave.start} onChange={(e) => setNewLeave({ ...newLeave, end: e.target.value })} />}</Field>
            <Field label={t('reasonOptional')}>{(id) => <TextInput id={id} value={newLeave.reason} placeholder={t('leaveReasonPlaceholder')} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} />}</Field>
            <Button icon="add" onClick={() => { setLeaves([...leaves, newLeave].sort((a, b) => a.start.localeCompare(b.start))); setNewLeave({ start: fmt.today(), end: fmt.today(), reason: '' }); }}
              disabled={!newLeave.start || newLeave.end < newLeave.start}>{t('addLeave')}</Button>
          </div>
        </div>
      </Card>
      <Card><SaveBar busy={busy} error={error} disabled={!dirty || invalid} onSave={() => save({ availability: { weekly, leaves } })} /></Card>
    </div>
  );
}

function SaveBar({ busy, error, disabled, onSave }: { busy: boolean; error: string | null; disabled: boolean; onSave: () => void }) {
  const { t } = usePortal();
  return (
    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-hairline first:border-t-0">
      {error && <p role="alert" className="text-xs text-danger-deep mr-auto">{error}</p>}
      <Button variant="primary" onClick={onSave} disabled={disabled || busy}>{busy ? t('saving') : t('saveChanges')}</Button>
    </div>
  );
}
