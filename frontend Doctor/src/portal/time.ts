// Dates and times in the doctor's chosen time zone and formats (Settings → Preferences).
import type { DoctorSettings } from '../services/doctorApi';

export type Prefs = DoctorSettings['prefs'];

export const DEFAULT_PREFS: Prefs = { language: 'en', date_format: 'DD MMM YYYY', time_format: '12h', timezone: 'Asia/Kolkata' };

const LOCALE: Record<Prefs['language'], string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };

/** Wall-clock parts of an instant in a time zone. */
function parts(tz: string, date: Date) {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Minutes the zone is ahead of UTC at that instant (IST = 330). */
export function utcOffsetMinutes(tz: string, date = new Date()): number {
  const p = parts(tz, date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** 'YYYY-MM-DD' of the instant in the zone. */
export function dayKey(tz: string, date: Date | string): string {
  const p = parts(tz, typeof date === 'string' ? new Date(date) : date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** 'HH:MM' (24h) of the instant in the zone. */
export function clockKey(tz: string, date: Date | string): string {
  const p = parts(tz, typeof date === 'string' ? new Date(date) : date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** The instant for a wall-clock date + time in the zone. */
export function fromLocal(tz: string, day: string, clock = '00:00'): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle a DST change between the guess and the answer.
  let t = guess - utcOffsetMinutes(tz, new Date(guess)) * 60000;
  t = guess - utcOffsetMinutes(tz, new Date(t)) * 60000;
  return new Date(t);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Monday-first weekday index (0 = Monday) of a 'YYYY-MM-DD'. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function makeFormatters(prefs: Prefs) {
  const locale = LOCALE[prefs.language] ?? 'en-IN';
  const tz = prefs.timezone || DEFAULT_PREFS.timezone;
  const hour12 = prefs.time_format !== '24h';
  const asDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v);
  // Day keys ('YYYY-MM-DD') are formatted at noon UTC so no zone can shift them to another day.
  const fromKey = (key: string) => new Date(`${key}T12:00:00Z`);

  const date = (v: Date | string, opts: { key?: boolean } = {}) => {
    const d = opts.key && typeof v === 'string' ? fromKey(v) : asDate(v);
    const zone = opts.key ? 'UTC' : tz;
    if (prefs.date_format === 'YYYY-MM-DD') return opts.key && typeof v === 'string' ? v : dayKey(tz, d);
    if (prefs.date_format === 'DD/MM/YYYY') {
      return new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    }
    return new Intl.DateTimeFormat(locale, { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  return {
    tz,
    locale,
    date,
    /** Date of a 'YYYY-MM-DD' key (no time zone shift). */
    dateKey: (key: string) => date(key, { key: true }),
    time: (v: Date | string) =>
      new Intl.DateTimeFormat(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12 }).format(asDate(v)),
    dateTime: (v: Date | string) =>
      `${date(v)} · ${new Intl.DateTimeFormat(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12 }).format(asDate(v))}`,
    /** "Mon 26" style, for compact lists and chart axes. */
    weekdayShort: (key: string) =>
      new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(fromKey(key)),
    dayOfMonth: (key: string) => Number(key.slice(8, 10)),
    weekdayLong: (key: string) =>
      new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(key)),
    monthTitle: (key: string) =>
      new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(fromKey(key)),
    today: () => dayKey(tz, new Date()),
    dayKey: (v: Date | string) => dayKey(tz, v),
    clock: (v: Date | string) => clockKey(tz, v),
    fromLocal: (day: string, clock: string) => fromLocal(tz, day, clock),
    offset: (at = new Date()) => utcOffsetMinutes(tz, at),
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;
