import { MONTHS, WEEKDAYS, type SupportedLanguage, type TranslationKey } from './translations';

/**
 * Appointment date / time helpers (display only).
 * The backend sends labels such as date "Tomorrow, 23 Oct 2026" and time "10:30 AM IST";
 * the baked-in word ("Tomorrow") goes stale, so the calendar date and time are parsed out
 * and the relative label is computed on the device in the app language.
 */

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** IST is UTC+05:30 (no daylight saving); appointments are booked in IST. */
const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;

export interface CalendarDate {
  year: number;
  month: number; // 0-11
  day: number;
}

/** "Tomorrow, 23 Oct 2026" / "Monday, 26 October 2026" → { 2026, 9, 23 }; null if not parsable. */
export const parseDateLabel = (label: string | undefined): CalendarDate | null => {
  const m = label?.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTH_INDEX[m[2].slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3).toLowerCase()];
  if (month === undefined) return null;
  return { year: Number(m[3]), month, day: Number(m[1]) };
};

export interface ParsedTime {
  hours: number; // 0-23
  minutes: number;
  /** Clock text without the zone, e.g. "10:30 AM". */
  clock: string;
  /** Zone suffix as sent, e.g. "IST" (empty if none). */
  zone: string;
}

/** "10:30 AM IST" → { 10, 30, "10:30 AM", "IST" }; null if not parsable. */
export const parseTimeLabel = (label: string | undefined): ParsedTime | null => {
  const m = label?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(.*)$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  const clock = `${m[1]}:${m[2]}${meridiem ? ` ${meridiem}` : ''}`;
  return { hours, minutes: Number(m[2]), clock, zone: m[4].trim() };
};

/** Today's calendar date in IST. */
const todayInIst = (now: Date): CalendarDate => {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), day: ist.getUTCDate() };
};

const dayNumber = (d: CalendarDate) => Date.UTC(d.year, d.month, d.day) / DAY_MS;

export type RelativeDay =
  | { kind: 'past'; daysAgo: number }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'future'; days: number };

/**
 * Relative state of an appointment against `now`, in IST calendar days. Past = an earlier
 * date, or today with a start time that has already passed (when the time is known).
 */
export const relativeDay = (date: CalendarDate, time: ParsedTime | null, now: Date = new Date()): RelativeDay => {
  const diff = dayNumber(date) - dayNumber(todayInIst(now));
  if (diff < 0) return { kind: 'past', daysAgo: -diff };
  if (diff === 0) {
    if (time) {
      const startUtc = Date.UTC(date.year, date.month, date.day, time.hours, time.minutes) - IST_OFFSET_MIN * 60_000;
      if (startUtc < now.getTime()) return { kind: 'past', daysAgo: 0 };
    }
    return { kind: 'today' };
  }
  return diff === 1 ? { kind: 'tomorrow' } : { kind: 'future', days: diff };
};

/**
 * Translation key for "N days ago" / "in N days", picking the singular form for 1
 * (en "1 day ago", kn "1 ದಿನದ ಹಿಂದೆ", hi "1 दिन में"). Hindi "ago" is the same for 1 and N.
 */
export const daysAgoKey = (n: number): TranslationKey => (n === 1 ? 'relDayAgo' : 'relDaysAgo');
export const inDaysKey = (n: number): TranslationKey => (n === 1 ? 'relInDay' : 'relInDays');

const weekdayOf = (d: CalendarDate) => new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay();

/**
 * The one localised date formatter for every screen (Home header, appointments, records,
 * audit logs, toasts). Month and weekday names come from translations, never device Intl.
 *   weekday: "Friday, 23 October 2026" / "ಶುಕ್ರವಾರ, 23 ಅಕ್ಟೋಬರ್ 2026" / "शुक्रवार, 23 अक्टूबर 2026"
 *   no weekday: "14 September 2026" / "14 ಸೆಪ್ಟೆಂಬರ್ 2026" / "14 सितंबर 2026"
 */
export const formatDate = (
  d: CalendarDate,
  lang: SupportedLanguage,
  { weekday = false, year = true }: { weekday?: boolean; year?: boolean } = {}
) => `${weekday ? `${WEEKDAYS[lang][weekdayOf(d)]}, ` : ''}${d.day} ${MONTHS[lang][d.month]}${year ? ` ${d.year}` : ''}`;

/** Weekday + full date (Home header, appointment card). */
export const formatLongDate = (d: CalendarDate, lang: SupportedLanguage, withYear = true) =>
  formatDate(d, lang, { weekday: true, year: withYear });

/** Backend date label ("14 Sep 2026", "Tomorrow, 23 Oct 2026") → localised date; unparsable labels are returned as sent. */
export const formatDateLabel = (label: string | undefined, lang: SupportedLanguage, opts?: { weekday?: boolean; year?: boolean }) => {
  const d = parseDateLabel(label);
  return d ? formatDate(d, lang, opts) : label ?? '';
};

/** "10:32 AM" in device-local time (digits and AM/PM, same as appointment times). */
const formatClock = (date: Date) => {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

/** ISO timestamp → "14 ಸೆಪ್ಟೆಂಬರ್ 2026, 10:32 AM" in device-local time; unparsable values are returned as sent. */
export const formatTimestamp = (iso: string | null | undefined, lang: SupportedLanguage) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return `${formatDate(localCalendarDate(date), lang)}, ${formatClock(date)}`;
};

/** Device-local calendar date (for the greeting line). */
export const localCalendarDate = (now: Date = new Date()): CalendarDate => ({
  year: now.getFullYear(),
  month: now.getMonth(),
  day: now.getDate(),
});
