import { MONTHS, WEEKDAYS, type SupportedLanguage } from '../utils/translations';
import { parseDateLabel, parseTimeLabel, relativeDay, type CalendarDate, type ParsedTime } from '../utils/dates';

/**
 * Helpers that turn app data into words that sound natural when spoken.
 * Used by the speech scripts (scripts/*.ts); components never build spoken sentences themselves.
 */

type L = SupportedLanguage;

// ------------------------------------------------------------------------------------------- time

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

const periodOf = (hours: number): DayPeriod =>
  hours >= 4 && hours < 12 ? 'morning' : hours >= 12 && hours < 17 ? 'afternoon' : hours >= 17 && hours < 20 ? 'evening' : 'night';

const PERIOD: Record<L, Record<DayPeriod, string>> = {
  en: { morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening', night: 'at night' },
  hi: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' },
  kn: { morning: 'ಬೆಳಿಗ್ಗೆ', afternoon: 'ಮಧ್ಯಾಹ್ನ', evening: 'ಸಂಜೆ', night: 'ರಾತ್ರಿ' },
};

/**
 * "11:20 AM" → en "11:20 in the morning" · hi "सुबह 11 बजकर 20 मिनट" · kn "ಬೆಳಿಗ್ಗೆ 11 ಗಂಟೆ 20 ನಿಮಿಷ".
 * Whole hours: "4 o'clock in the afternoon" · "दोपहर 4 बजे" · "ಮಧ್ಯಾಹ್ನ 4 ಗಂಟೆ". Unparsable → as sent.
 */
export const spokenTime = (time: string | ParsedTime | null | undefined, lang: L): string => {
  const t = typeof time === 'string' || time == null ? parseTimeLabel(time ?? undefined) : time;
  if (!t) return typeof time === 'string' ? time : '';
  const h12 = t.hours % 12 === 0 ? 12 : t.hours % 12;
  const period = periodOf(t.hours);
  const mm = String(t.minutes).padStart(2, '0');
  if (lang === 'hi') return t.minutes === 0 ? `${PERIOD.hi[period]} ${h12} बजे` : `${PERIOD.hi[period]} ${h12} बजकर ${t.minutes} मिनट`;
  if (lang === 'kn') return t.minutes === 0 ? `${PERIOD.kn[period]} ${h12} ಗಂಟೆ` : `${PERIOD.kn[period]} ${h12} ಗಂಟೆ ${t.minutes} ನಿಮಿಷ`;
  if (t.hours === 12 && t.minutes === 0) return '12 noon';
  return t.minutes === 0 ? `${h12} o'clock ${PERIOD.en[period]}` : `${h12}:${mm} ${PERIOD.en[period]}`;
};

// ------------------------------------------------------------------------------------------- dates

const weekdayOf = (d: CalendarDate) => new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay();

/** "Wednesday 28 October" (year only when it is not this year). */
const plainDate = (d: CalendarDate, lang: L, now: Date) =>
  `${WEEKDAYS[lang][weekdayOf(d)]} ${d.day} ${MONTHS[lang][d.month]}${d.year !== now.getFullYear() ? ` ${d.year}` : ''}`;

export interface SpokenDate {
  /** "tomorrow, Wednesday 28 October" — a phrase that fits after "is" / "है" / "ಇದೆ". */
  phrase: string;
  /** today / tomorrow / soon (within a week) / later / past. */
  when: 'today' | 'tomorrow' | 'soon' | 'later' | 'past';
  /** Just the relative word: "tomorrow", "this Thursday", "on Monday 9 November". */
  relative: string;
}

/**
 * A date the way a person would say it:
 *   en "today, Tuesday 27 October" · "tomorrow, Wednesday 28 October" · "this Thursday, 29 October" · "Monday 9 November"
 *   hi "आज, मंगलवार 27 अक्टूबर" · "कल, बुधवार 28 अक्टूबर" · "इस गुरुवार, 29 अक्टूबर"
 *   kn "ಇಂದು, ಮಂಗಳವಾರ 27 ಅಕ್ಟೋಬರ್" · "ನಾಳೆ, ಬುಧವಾರ 28 ಅಕ್ಟೋಬರ್" · "ಈ ಗುರುವಾರ, 29 ಅಕ್ಟೋಬರ್"
 */
export const spokenDate = (date: string | CalendarDate | null | undefined, lang: L, time?: string, now: Date = new Date()): SpokenDate => {
  const d = typeof date === 'string' || date == null ? parseDateLabel(date ?? undefined) : date;
  if (!d) {
    const raw = typeof date === 'string' ? date : '';
    return { phrase: raw, when: 'later', relative: raw };
  }
  const rel = relativeDay(d, parseTimeLabel(time), now);
  const full = plainDate(d, lang, now);
  const weekday = WEEKDAYS[lang][weekdayOf(d)];
  const short = `${d.day} ${MONTHS[lang][d.month]}`;
  const words = {
    en: { today: 'today', tomorrow: 'tomorrow', this: (w: string) => `this ${w}` },
    hi: { today: 'आज', tomorrow: 'कल', this: (w: string) => `इस ${w}` },
    kn: { today: 'ಇಂದು', tomorrow: 'ನಾಳೆ', this: (w: string) => `ಈ ${w}` },
  }[lang];
  switch (rel.kind) {
    case 'today':
      return { phrase: `${words.today}, ${full}`, when: 'today', relative: words.today };
    case 'tomorrow':
      return { phrase: `${words.tomorrow}, ${full}`, when: 'tomorrow', relative: words.tomorrow };
    case 'future':
      if (rel.days < 7) return { phrase: `${words.this(weekday)}, ${short}`, when: 'soon', relative: words.this(weekday) };
      return { phrase: full, when: 'later', relative: full };
    default:
      return { phrase: full, when: 'past', relative: full };
  }
};

/** Today's date for the greeting: "Tuesday, 27 October". */
export const spokenToday = (lang: L, now: Date = new Date()) =>
  `${WEEKDAYS[lang][now.getDay()]}, ${now.getDate()} ${MONTHS[lang][now.getMonth()]}`;

/** ISO timestamp → "Tuesday 27 October, 10:30 in the morning". */
export const spokenTimestamp = (iso: string | null | undefined, lang: L, now: Date = new Date()): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const cal = { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
  const time = spokenTime({ hours: date.getHours(), minutes: date.getMinutes(), clock: '', zone: '' }, lang);
  return `${plainDate(cal, lang, now)}, ${time}`;
};

// ----------------------------------------------------------------------------------------- doctors

const DOCTOR_WORD: Record<L, string> = { en: 'Doctor', hi: 'डॉक्टर', kn: 'ಡಾಕ್ಟರ್' };

/** "Dr. Farah Khan (MD Dermatology)" → "Doctor Farah Khan" (qualifications left out). */
export const spokenDoctor = (name: string | null | undefined, lang: L): string => {
  const base = (name ?? '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!base) return '';
  const stripped = base.replace(/^\s*dr\.?\s+/i, '');
  return `${DOCTOR_WORD[lang]} ${stripped}`;
};

/** Degrees spelt out letter by letter so the voice does not try to pronounce them as words. */
const DEGREES: [RegExp, string][] = [
  [/\bMBBS\b/g, 'M B B S'],
  [/\bMCh\b/gi, 'M C H'],
  [/\bDNB\b/g, 'D N B'],
  [/\bFRCS\b/g, 'F R C S'],
  [/\bMRCP\b/g, 'M R C P'],
  [/\bBDS\b/g, 'B D S'],
  [/\bMDS\b/g, 'M D S'],
  [/\bDGO\b/g, 'D G O'],
  [/\bDM\b/g, 'D M'],
  [/\bMD\b/g, 'M D'],
  [/\bMS\b/g, 'M S'],
];

export const spellDegrees = (text: string) => DEGREES.reduce((s, [re, out]) => s.replace(re, out), text);

/** "(MD Dermatology)" part of a doctor's name, spelt out for speech ("M D Dermatology"); '' if none. */
export const spokenQualification = (name: string | null | undefined): string => {
  const m = (name ?? '').match(/\(([^)]*)\)/);
  return m ? spellDegrees(m[1]).replace(/\s*,\s*/g, ', ').trim() : '';
};

export interface Qualification {
  /** Degrees spelt out: ["M S", "M C H"]. */
  degrees: string[];
  /** Subject words left over: "Urology". */
  subject: string;
}

const DEGREE_TOKENS = new Set(['MBBS', 'MD', 'MS', 'MCH', 'DM', 'DNB', 'FRCS', 'MRCP', 'BDS', 'MDS', 'DGO', 'DCH', 'DA', 'DO', 'DPM']);

/** "Dr. C. R. Patil (MS, MCh Urology)" → { degrees: ["M S", "M C H"], subject: "Urology" }; null when none. */
export const parseQualification = (name: string | null | undefined): Qualification | null => {
  const m = (name ?? '').match(/\(([^)]*)\)/);
  if (!m) return null;
  const tokens = m[1].split(/[\s,]+/).filter(Boolean);
  const degrees = tokens.filter((t) => DEGREE_TOKENS.has(t.replace(/\./g, '').toUpperCase())).map((t) => t.replace(/\./g, '').toUpperCase().split('').join(' '));
  const subject = tokens.filter((t) => !DEGREE_TOKENS.has(t.replace(/\./g, '').toUpperCase())).join(' ');
  if (degrees.length === 0 && !subject) return null;
  return { degrees, subject };
};

/** Kannada: add the "at" ending to a spoken time ("… ಗಂಟೆ" → "… ಗಂಟೆಗೆ", "… ನಿಮಿಷ" → "… ನಿಮಿಷಕ್ಕೆ"). */
export const knAt = (time: string) => (time.endsWith('ನಿಮಿಷ') ? `${time}ಕ್ಕೆ` : time.endsWith('ಗಂಟೆ') ? `${time}ಗೆ` : time);

/** English article for a spelt-out word: "an M D", "a B D S". */
export const enArticle = (word: string) => (/^([AEFHILMNORSX]\b|[aeiou])/.test(word.trim()) ? 'an' : 'a');

// ------------------------------------------------------------------------------------- departments

interface DeptSpoken {
  /** "a skin specialist" — fits "The doctor is …". */
  specialist: string;
  /** "skin, hair and nails" — fits "an appointment for …". */
  topic: string;
}

/** Plain-language meaning of each OPD department (ids match utils/departments.ts). */
const DEPT: Record<string, Record<L, DeptSpoken>> = {
  general_medicine: {
    en: { specialist: 'a general doctor', topic: 'general health problems' },
    hi: { specialist: 'सामान्य बीमारियों के डॉक्टर', topic: 'सामान्य बीमारियों' },
    kn: { specialist: 'ಸಾಮಾನ್ಯ ಕಾಯಿಲೆಗಳ ವೈದ್ಯರು', topic: 'ಸಾಮಾನ್ಯ ಆರೋಗ್ಯದ' },
  },
  cardiology: {
    en: { specialist: 'a heart specialist', topic: 'the heart and blood pressure' },
    hi: { specialist: 'दिल के डॉक्टर', topic: 'दिल और ब्लड प्रेशर' },
    kn: { specialist: 'ಹೃದಯ ತಜ್ಞರು', topic: 'ಹೃದಯ ಮತ್ತು ರಕ್ತದೊತ್ತಡದ' },
  },
  dermatology: {
    en: { specialist: 'a skin specialist', topic: 'skin, hair and nails' },
    hi: { specialist: 'त्वचा के डॉक्टर', topic: 'त्वचा, बाल और नाखून' },
    kn: { specialist: 'ಚರ್ಮ ತಜ್ಞರು', topic: 'ಚರ್ಮ, ಕೂದಲು ಮತ್ತು ಉಗುರುಗಳ' },
  },
  orthopaedics: {
    en: { specialist: 'a bone and joint specialist', topic: 'bones and joints' },
    hi: { specialist: 'हड्डी और जोड़ों के डॉक्टर', topic: 'हड्डी और जोड़ों' },
    kn: { specialist: 'ಮೂಳೆ ಮತ್ತು ಕೀಲು ತಜ್ಞರು', topic: 'ಮೂಳೆ ಮತ್ತು ಕೀಲುಗಳ' },
  },
  ent: {
    en: { specialist: 'an ear, nose and throat specialist', topic: 'ear, nose and throat' },
    hi: { specialist: 'नाक, कान और गले के डॉक्टर', topic: 'नाक, कान और गले' },
    kn: { specialist: 'ಕಿವಿ, ಮೂಗು ಮತ್ತು ಗಂಟಲು ತಜ್ಞರು', topic: 'ಕಿವಿ, ಮೂಗು ಮತ್ತು ಗಂಟಲಿನ' },
  },
  ophthalmology: {
    en: { specialist: 'an eye specialist', topic: 'the eyes' },
    hi: { specialist: 'आँखों के डॉक्टर', topic: 'आँखों' },
    kn: { specialist: 'ಕಣ್ಣಿನ ತಜ್ಞರು', topic: 'ಕಣ್ಣಿನ' },
  },
  obgyn: {
    en: { specialist: "a women's health and pregnancy specialist", topic: "women's health and pregnancy" },
    hi: { specialist: 'महिलाओं और गर्भावस्था के डॉक्टर', topic: 'महिलाओं के स्वास्थ्य और गर्भावस्था' },
    kn: { specialist: 'ಮಹಿಳೆಯರ ಆರೋಗ್ಯ ಮತ್ತು ಗರ್ಭಧಾರಣೆಯ ತಜ್ಞರು', topic: 'ಮಹಿಳೆಯರ ಆರೋಗ್ಯ ಮತ್ತು ಗರ್ಭಧಾರಣೆಯ' },
  },
  paediatrics: {
    en: { specialist: "a children's doctor", topic: "children's health" },
    hi: { specialist: 'बच्चों के डॉक्टर', topic: 'बच्चों के स्वास्थ्य' },
    kn: { specialist: 'ಮಕ್ಕಳ ವೈದ್ಯರು', topic: 'ಮಕ್ಕಳ ಆರೋಗ್ಯದ' },
  },
  endocrinology: {
    en: { specialist: 'a diabetes and thyroid specialist', topic: 'diabetes and thyroid' },
    hi: { specialist: 'शुगर और थायराइड के डॉक्टर', topic: 'शुगर और थायराइड' },
    kn: { specialist: 'ಸಕ್ಕರೆ ಕಾಯಿಲೆ ಮತ್ತು ಥೈರಾಯ್ಡ್ ತಜ್ಞರು', topic: 'ಸಕ್ಕರೆ ಕಾಯಿಲೆ ಮತ್ತು ಥೈರಾಯ್ಡ್‌ನ' },
  },
  pulmonology: {
    en: { specialist: 'a chest and lung specialist', topic: 'breathing and the lungs' },
    hi: { specialist: 'छाती और फेफड़ों के डॉक्टर', topic: 'सांस और फेफड़ों' },
    kn: { specialist: 'ಎದೆ ಮತ್ತು ಶ್ವಾಸಕೋಶ ತಜ್ಞರು', topic: 'ಉಸಿರಾಟ ಮತ್ತು ಶ್ವಾಸಕೋಶದ' },
  },
  gastroenterology: {
    en: { specialist: 'a stomach specialist', topic: 'the stomach and digestion' },
    hi: { specialist: 'पेट के डॉक्टर', topic: 'पेट और पाचन' },
    kn: { specialist: 'ಹೊಟ್ಟೆ ತಜ್ಞರು', topic: 'ಹೊಟ್ಟೆ ಮತ್ತು ಜೀರ್ಣಕ್ರಿಯೆಯ' },
  },
  neurology: {
    en: { specialist: 'a brain and nerve specialist', topic: 'the brain and nerves' },
    hi: { specialist: 'दिमाग और नसों के डॉक्टर', topic: 'दिमाग और नसों' },
    kn: { specialist: 'ಮೆದುಳು ಮತ್ತು ನರಗಳ ತಜ್ಞರು', topic: 'ಮೆದುಳು ಮತ್ತು ನರಗಳ' },
  },
  psychiatry: {
    en: { specialist: 'a mental health specialist', topic: 'mental health' },
    hi: { specialist: 'मानसिक स्वास्थ्य के डॉक्टर', topic: 'मानसिक स्वास्थ्य' },
    kn: { specialist: 'ಮಾನಸಿಕ ಆರೋಗ್ಯ ತಜ್ಞರು', topic: 'ಮಾನಸಿಕ ಆರೋಗ್ಯದ' },
  },
  urology: {
    en: { specialist: 'a urologist, who treats urine and kidney problems', topic: 'urine and kidney problems' },
    hi: { specialist: 'मूत्र रोग के डॉक्टर', topic: 'पेशाब और किडनी की समस्याओं' },
    kn: { specialist: 'ಮೂತ್ರರೋಗ ತಜ್ಞರು', topic: 'ಮೂತ್ರ ಮತ್ತು ಮೂತ್ರಪಿಂಡದ' },
  },
  dental: {
    en: { specialist: 'a dentist', topic: 'teeth' },
    hi: { specialist: 'दांतों के डॉक्टर', topic: 'दांतों' },
    kn: { specialist: 'ದಂತ ವೈದ್ಯರು', topic: 'ಹಲ್ಲುಗಳ' },
  },
};

/** Specialty words found in qualifications / specialty text → department id. */
const SPECIALTY_WORDS: [RegExp, string][] = [
  [/dermat/i, 'dermatology'],
  [/cardi/i, 'cardiology'],
  [/ortho/i, 'orthopaedics'],
  [/\bENT\b|otorhino/i, 'ent'],
  [/ophthal|\beye\b/i, 'ophthalmology'],
  [/gyn|obstet/i, 'obgyn'],
  [/paed|pediat/i, 'paediatrics'],
  [/endocr|diabet|thyroid/i, 'endocrinology'],
  [/pulmo|chest/i, 'pulmonology'],
  [/gastro|stomach/i, 'gastroenterology'],
  [/neuro/i, 'neurology'],
  [/psych|mental/i, 'psychiatry'],
  [/urol/i, 'urology'],
  [/dent/i, 'dental'],
  [/general medicine|physician/i, 'general_medicine'],
];

/** Department id from an id, a department / specialty name, or a qualification ("MD Dermatology"). */
export const departmentIdFrom = (...hints: (string | null | undefined)[]): string | null => {
  for (const h of hints) {
    if (!h) continue;
    if (DEPT[h]) return h;
    const hit = SPECIALTY_WORDS.find(([re]) => re.test(h));
    if (hit) return hit[1];
  }
  return null;
};

export const spokenDepartment = (id: string | null | undefined, lang: L): DeptSpoken | null => (id && DEPT[id] ? DEPT[id][lang] : null);

// ------------------------------------------------------------------------------- fallback cleaning

const ABBREVIATIONS: Record<L, [RegExp, string][]> = {
  en: [
    [/\bDr\.?\s+/g, 'Doctor '],
    [/\bOPD\s+Block\b/gi, 'outpatient block'],
    [/\bOPD\b/g, 'outpatient department'],
    [/\bABDM\b/g, 'A B D M'],
    [/\bDPDP\b/g, 'D P D P'],
    [/\bABHA\b/g, 'Abha'],
    [/\bSOS\b/g, 'S O S'],
    [/\bBP\b/g, 'blood pressure'],
    [/\bOD\b/g, 'once a day'],
    [/\bBD\b/g, 'twice a day'],
    [/\bTDS\b/g, 'three times a day'],
    [/\bPRN\b/g, 'only when needed'],
    [/\b(\d+(?:\.\d+)?)\s*mg\b/gi, '$1 milligram'],
    [/\b(\d+(?:\.\d+)?)\s*ml\b/gi, '$1 millilitre'],
    [/\bbpm\b/gi, 'beats per minute'],
    [/\bmin\b/g, 'minutes'],
    [/\bvs\.?\b/gi, 'versus'],
    [/\be\.g\.\s*/gi, 'for example, '],
  ],
  hi: [
    [/\bDr\.?\s+/g, 'डॉक्टर '],
    [/\bOPD\s+Block\b/gi, 'ओपीडी ब्लॉक'],
    [/\bOPD\b/g, 'ओपीडी'],
    [/\bSOS\b/g, 'एस ओ एस'],
    [/\bBP\b/g, 'ब्लड प्रेशर'],
    [/\bOD\b/g, 'दिन में एक बार'],
    [/\bBD\b/g, 'दिन में दो बार'],
    [/\bTDS\b/g, 'दिन में तीन बार'],
    [/\bPRN\b/g, 'ज़रूरत पड़ने पर'],
    [/\b(\d+(?:\.\d+)?)\s*mg\b/gi, '$1 मिलीग्राम'],
    [/\b(\d+(?:\.\d+)?)\s*ml\b/gi, '$1 मिलीलीटर'],
    [/\bbpm\b/gi, 'धड़कन प्रति मिनट'],
  ],
  kn: [
    [/\bDr\.?\s+/g, 'ಡಾಕ್ಟರ್ '],
    [/\bOPD\s+Block\b/gi, 'ಹೊರರೋಗಿ ವಿಭಾಗದ ಬ್ಲಾಕ್'],
    [/\bOPD\b/g, 'ಹೊರರೋಗಿ ವಿಭಾಗ'],
    [/\bSOS\b/g, 'ಎಸ್ ಒ ಎಸ್'],
    [/\bBP\b/g, 'ರಕ್ತದೊತ್ತಡ'],
    [/\bOD\b/g, 'ದಿನಕ್ಕೆ ಒಂದು ಬಾರಿ'],
    [/\bBD\b/g, 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ'],
    [/\bTDS\b/g, 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ'],
    [/\bPRN\b/g, 'ಅಗತ್ಯವಿದ್ದಾಗ ಮಾತ್ರ'],
    [/\b(\d+(?:\.\d+)?)\s*mg\b/gi, '$1 ಮಿಲಿಗ್ರಾಂ'],
    [/\b(\d+(?:\.\d+)?)\s*ml\b/gi, '$1 ಮಿಲಿಲೀಟರ್'],
    [/\bbpm\b/gi, 'ಬಡಿತ ಪ್ರತಿ ನಿಮಿಷ'],
  ],
};

/**
 * Fallback for elements without their own script: visible text made speakable. Symbols,
 * separators and icon names are dropped, abbreviations and degrees expanded, clock times
 * spoken naturally.
 */
export const cleanForSpeech = (raw: string, lang: L): string => {
  if (!raw) return '';
  let text = raw
    // Separators and decorative symbols
    .replace(/\s*[·•|]\s*/g, ', ')
    .replace(/[→←↑↓›‹»«✓✔︎★☆_~#*]/g, ' ')
    .replace(/\s+—\s+/g, ', ')
    // Ellipsis on truncated labels and "9+" style counts
    .replace(/…/g, '')
    .replace(/(\d)\+/g, '$1 or more');

  text = spellDegrees(text);
  for (const [re, out] of ABBREVIATIONS[lang]) text = text.replace(re, out);

  // Clock times ("9:30 AM", "8 PM")
  text = text
    .replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)(\s*IST)?\b/gi, (m) => spokenTime(m.replace(/\s*IST/i, ''), lang))
    .replace(/\b(\d{1,2})\s*(AM|PM)\b/gi, (_m, h, mer) => spokenTime(`${h}:00 ${mer}`, lang));

  return text
    .replace(/\(\s*\)/g, '')
    .replace(/\s*,\s*(,\s*)+/g, ', ')
    .replace(/\s+([,.?!])/g, '$1')
    .replace(/^[,.\s]+|[,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const NORMALIZATIONS_EN: [RegExp, string][] = [
  // ABHA as a single word
  [/\bABHA\b/gi, 'Abha'],
  [/@abdm\b/gi, ' at A.B.D.M.'],
  // Medical & degree terms letter-by-letter with dots
  [/\bM\.?\s*B\.?\s*B\.?\s*S\.?\b/gi, 'M.B.B.S.'],
  [/\bM\.?\s*D\.?\s*S\.?\b/gi, 'M.D.S.'],
  [/\bM\.?\s*Ch\.?\b/gi, 'M.Ch.'],
  [/\bM\.?\s*R\.?\s*C\.?\s*P\.?\b/gi, 'M.R.C.P.'],
  [/\bF\.?\s*R\.?\s*C\.?\s*S\.?\b/gi, 'F.R.C.S.'],
  [/\bD\.?\s*N\.?\s*B\.?\b/gi, 'D.N.B.'],
  [/\bD\.?\s*G\.?\s*O\.?\b/gi, 'D.G.O.'],
  [/\bD\.?\s*C\.?\s*H\.?\b/gi, 'D.C.H.'],
  [/\bD\.?\s*P\.?\s*M\.?\b/gi, 'D.P.M.'],
  [/\bB\.?\s*D\.?\s*S\.?\b/gi, 'B.D.S.'],
  [/\bN\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'N.I.C.U.'],
  [/\bP\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'P.I.C.U.'],
  [/\bI\.?\s*C\.?\s*U\.?\b/gi, 'I.C.U.'],
  [/\bE\.?\s*C\.?\s*G\.?\b/gi, 'E.C.G.'],
  [/\bE\.?\s*E\.?\s*G\.?\b/gi, 'E.E.G.'],
  [/\bE\.?\s*N\.?\s*T\.?\b/gi, 'E.N.T.'],
  [/\bB\.?\s*P\.?\b/gi, 'B.P.'],
  [/\bO\.?\s*P\.?\s*D\.?\b/gi, 'O.P.D.'],
  [/\bI\.?\s*P\.?\s*D\.?\b/gi, 'I.P.D.'],
  [/\bM\.?\s*R\.?\s*I\.?\b/gi, 'M.R.I.'],
  [/\bU\.?\s*S\.?\s*G\.?\b/gi, 'U.S.G.'],
  [/\bC\.?\s*B\.?\s*C\.?\b/gi, 'C.B.C.'],
  [/\bS\.?\s*O\.?\s*S\.?\b/gi, 'S.O.S.'],
  [/\bA\.?\s*B\.?\s*D\.?\s*M\.?\b/gi, 'A.B.D.M.'],
  [/\bD\.?\s*P\.?\s*D\.?\s*P\.?\b/gi, 'D.P.D.P.'],
  [/\bM\.?\s*D\.?\b/g, 'M.D.'],
  [/\bM\.?\s*S\.?\b/g, 'M.S.'],
  [/\bD\.?\s*M\.?\b/g, 'D.M.'],
  [/\bDA\b|\bD\s+A\b|\bD\.A\.\b/g, 'D.A.'],
  [/\bDO\b|\bD\s+O\b|\bD\.O\.\b/g, 'D.O.'],
  [/\bCT\b|\bC\s+T\b|\bC\.T\.\b/g, 'C.T.'],
  [/\bIV\b|\bI\s+V\b|\bI\.V\.\b/g, 'I.V.'],
  [/\bOT\b|\bO\s+T\b|\bO\.T\.\b/g, 'O.T.'],
];

const NORMALIZATIONS_HI: [RegExp, string][] = [
  // ABHA as a single word in Hindi
  [/\b(?:ABHA|Abha|abha)\b/g, 'आभा'],
  [/@abdm\b/gi, ' ऐट ए.बी.डी.एम.'],
  // Medical & degree terms in Hindi phonetics with dots
  [/\bM\.?\s*B\.?\s*B\.?\s*S\.?\b/gi, 'एम.बी.बी.एस.'],
  [/\bM\.?\s*D\.?\s*S\.?\b/gi, 'एम.डी.एस.'],
  [/\bM\.?\s*Ch\.?\b/gi, 'एम.सी.एच.'],
  [/\bM\.?\s*R\.?\s*C\.?\s*P\.?\b/gi, 'एम.आर.सी.पी.'],
  [/\bF\.?\s*R\.?\s*C\.?\s*S\.?\b/gi, 'एफ.आर.सी.एस.'],
  [/\bD\.?\s*N\.?\s*B\.?\b/gi, 'डी.एन.बी.'],
  [/\bD\.?\s*G\.?\s*O\.?\b/gi, 'डी.जी.ओ.'],
  [/\bD\.?\s*C\.?\s*H\.?\b/gi, 'डी.सी.एच.'],
  [/\bD\.?\s*P\.?\s*M\.?\b/gi, 'डी.पी.एम.'],
  [/\bB\.?\s*D\.?\s*S\.?\b/gi, 'बी.डी.एस.'],
  [/\bN\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'एन.आई.सी.यू.'],
  [/\bP\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'पी.आई.सी.यू.'],
  [/\bI\.?\s*C\.?\s*U\.?\b/gi, 'आई.सी.यू.'],
  [/\bE\.?\s*C\.?\s*G\.?\b/gi, 'ई.सी.जी.'],
  [/\bE\.?\s*E\.?\s*G\.?\b/gi, 'ई.ई.जी.'],
  [/\bE\.?\s*N\.?\s*T\.?\b/gi, 'ई.एन.टी.'],
  [/\bB\.?\s*P\.?\b/gi, 'बी.पी.'],
  [/\bO\.?\s*P\.?\s*D\.?\b/gi, 'ओ.पी.डी.'],
  [/\bI\.?\s*P\.?\s*D\.?\b/gi, 'आई.पी.डी.'],
  [/\bM\.?\s*R\.?\s*I\.?\b/gi, 'एम.आर.आई.'],
  [/\bU\.?\s*S\.?\s*G\.?\b/gi, 'यू.एस.जी.'],
  [/\bC\.?\s*B\.?\s*C\.?\b/gi, 'सी.बी.सी.'],
  [/\bS\.?\s*O\.?\s*S\.?\b/gi, 'एस.ओ.एस.'],
  [/\bA\.?\s*B\.?\s*D\.?\s*M\.?\b/gi, 'ए.बी.डी.एम.'],
  [/\bD\.?\s*P\.?\s*D\.?\s*P\.?\b/gi, 'डी.पी.डी.पी.'],
  [/\bM\.?\s*D\.?\b/g, 'एम.डी.'],
  [/\bM\.?\s*S\.?\b/g, 'एम.एस.'],
  [/\bD\.?\s*M\.?\b/g, 'डी.एम.'],
  [/\bDA\b|\bD\s+A\b|\bD\.A\.\b/g, 'डी.ए.'],
  [/\bDO\b|\bD\s+O\b|\bD\.O\.\b/g, 'डी.ओ.'],
  [/\bCT\b|\bC\s+T\b|\bC\.T\.\b/g, 'सी.टी.'],
  [/\bIV\b|\bI\s+V\b|\bI\.V\.\b/g, 'आई.वी.'],
  [/\bOT\b|\bO\s+T\b|\bO\.T\.\b/g, 'ओ.टी.'],
];

const NORMALIZATIONS_KN: [RegExp, string][] = [
  // ABHA as a single word in Kannada
  [/\b(?:ABHA|Abha|abha)\b/g, 'ಆಭಾ'],
  [/@abdm\b/gi, ' ಅಟ್ ಎ.ಬಿ.ಡಿ.ಎಂ.'],
  // Medical & degree terms in Kannada phonetics with dots
  [/\bM\.?\s*B\.?\s*B\.?\s*S\.?\b/gi, 'ಎಂ.ಬಿ.ಬಿ.ಎಸ್.'],
  [/\bM\.?\s*D\.?\s*S\.?\b/gi, 'ಎಂ.ಡಿ.ಎಸ್.'],
  [/\bM\.?\s*Ch\.?\b/gi, 'ಎಂ.ಸಿ.ಎಚ್.'],
  [/\bM\.?\s*R\.?\s*C\.?\s*P\.?\b/gi, 'ಎಂ.ಆರ್.ಸಿ.ಪಿ.'],
  [/\bF\.?\s*R\.?\s*C\.?\s*S\.?\b/gi, 'ಎಫ್.ಆರ್.ಸಿ.ಎಸ್.'],
  [/\bD\.?\s*N\.?\s*B\.?\b/gi, 'ಡಿ.ಎನ್.ಬಿ.'],
  [/\bD\.?\s*G\.?\s*O\.?\b/gi, 'ಡಿ.ಜಿ.ಒ.'],
  [/\bD\.?\s*C\.?\s*H\.?\b/gi, 'ಡಿ.ಸಿ.ಎಚ್.'],
  [/\bD\.?\s*P\.?\s*M\.?\b/gi, 'ಡಿ.ಪಿ.ಎಂ.'],
  [/\bB\.?\s*D\.?\s*S\.?\b/gi, 'ಬಿ.ಡಿ.ಎಸ್.'],
  [/\bN\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'ಎನ್.ಐ.ಸಿ.ಯು.'],
  [/\bP\.?\s*I\.?\s*C\.?\s*U\.?\b/gi, 'ಪಿ.ಐ.ಸಿ.ಯು.'],
  [/\bI\.?\s*C\.?\s*U\.?\b/gi, 'ಐ.ಸಿ.ಯು.'],
  [/\bE\.?\s*C\.?\s*G\.?\b/gi, 'ಇ.ಸಿ.ಜಿ.'],
  [/\bE\.?\s*E\.?\s*G\.?\b/gi, 'ಇ.ಈ.ಜಿ.'],
  [/\bE\.?\s*N\.?\s*T\.?\b/gi, 'ಇ.ಎನ್.ಟಿ.'],
  [/\bB\.?\s*P\.?\b/gi, 'ಬಿ.ಪಿ.'],
  [/\bO\.?\s*P\.?\s*D\.?\b/gi, 'ಒ.ಪಿ.ಡಿ.'],
  [/\bI\.?\s*P\.?\s*D\.?\b/gi, 'ಐ.ಪಿ.ಡಿ.'],
  [/\bM\.?\s*R\.?\s*I\.?\b/gi, 'ಎಂ.ಆರ್.ಐ.'],
  [/\bU\.?\s*S\.?\s*G\.?\b/gi, 'ಯು.ಎಸ್.ಜಿ.'],
  [/\bC\.?\s*B\.?\s*C\.?\b/gi, 'ಸಿ.ಬಿ.ಸಿ.'],
  [/\bS\.?\s*O\.?\s*S\.?\b/gi, 'ಎಸ್.ಒ.ಎಸ್.'],
  [/\bA\.?\s*B\.?\s*D\.?\s*M\.?\b/gi, 'ಎ.ಬಿ.ಡಿ.ಎಂ.'],
  [/\bD\.?\s*P\.?\s*D\.?\s*P\.?\b/gi, 'ಡಿ.ಪಿ.ಡಿ.ಪಿ.'],
  [/\bM\.?\s*D\.?\b/g, 'ಎಂ.ಡಿ.'],
  [/\bM\.?\s*S\.?\b/g, 'ಎಂ.ಎಸ್.'],
  [/\bD\.?\s*M\.?\b/g, 'ಡಿ.ಎಂ.'],
  [/\bDA\b|\bD\s+A\b|\bD\.A\.\b/g, 'ಡಿ.ಎ.'],
  [/\bDO\b|\bD\s+O\b|\bD\.O\.\b/g, 'ಡಿ.ಒ.'],
  [/\bCT\b|\bC\s+T\b|\bC\.T\.\b/g, 'ಸಿ.ಟಿ.'],
  [/\bIV\b|\bI\s+V\b|\bI\.V\.\b/g, 'ಐ.ವಿ.'],
  [/\bOT\b|\bO\s+T\b|\bO\.T\.\b/g, 'ಒ.ಟಿ.'],
];

const NORMALIZATIONS: Record<L, [RegExp, string][]> = {
  en: NORMALIZATIONS_EN,
  hi: NORMALIZATIONS_HI,
  kn: NORMALIZATIONS_KN,
};

/**
 * Final normalization pass before speech:
 *  - ABHA is always kept as a natural single word ("Abha", "आभा", "ಆಭಾ").
 *  - Medical terms & degrees (MD, ICU, ECG, ENT, BP, MBBS) are read letter-by-letter.
 *  - Uses per-language phonetic/dotted mapping so TTS engines don't slur individual letters.
 */
export const normalizeForSpeech = (raw: string, lang: L): string => {
  if (!raw) return '';
  let text = raw;
  const list = NORMALIZATIONS[lang];
  if (list) {
    for (const [re, out] of list) {
      text = text.replace(re, out);
    }
  }
  return text.replace(/\s+/g, ' ').trim();
};

/** Plain text of React children (strings and numbers, recursively). */
export const textOfChildren = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOfChildren).filter(Boolean).join(' ');
  const props = (node as { props?: { children?: unknown; label?: unknown; title?: unknown } }).props;
  if (!props) return '';
  const own = [props.title, props.label].filter((v) => typeof v === 'string').join('. ');
  const inner = typeof props.children === 'function' ? '' : textOfChildren(props.children);
  return [own, inner].filter(Boolean).join('. ');
};
