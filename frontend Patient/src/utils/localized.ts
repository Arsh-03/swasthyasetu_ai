import type { SupportedLanguage } from './translations';

/**
 * Backend display text: a plain string today, or one entry per language once the backend
 * sends translations (see docs/API_ROUTES.md, "Localised display fields").
 * Clinical text is never translated on the device.
 */
export type LocalizedText = string | Partial<Record<SupportedLanguage, string | null>>;

const FALLBACK_ORDER: SupportedLanguage[] = ['en', 'kn', 'hi'];

const usable = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

const isIndic = (s: string) => /[\u0C80-\u0CFF\u0900-\u097F]/.test(s);
const isKannada = (s: string) => /[\u0C80-\u0CFF]/.test(s);
const isHindi = (s: string) => /[\u0900-\u097F]/.test(s);

/**
 * In English mode, shows only the English part of bilingual strings like "Fever (ಜ್ವರ / बुखार)".
 * In Indic modes, extracts the relevant localized script option if present in brackets.
 */
export const cleanBilingualString = (text: string, lang: SupportedLanguage): string => {
  const match = text.match(/^([^()]+)\s*\(([^()]+)\)$/);
  if (!match) return text;

  const englishPart = match[1].trim();
  const bracketPart = match[2].trim();

  if (lang === 'en') {
    if (isIndic(bracketPart)) return englishPart;
    return text;
  }

  const options = bracketPart.split('/').map((s) => s.trim());
  if (lang === 'kn') {
    const kn = options.find(isKannada);
    if (kn) return kn;
    if (isKannada(englishPart)) return englishPart;
  } else if (lang === 'hi') {
    const hi = options.find(isHindi);
    if (hi) return hi;
    if (isHindi(englishPart)) return englishPart;
  }

  return englishPart;
};

/**
 * Text in the active language, else English, else any language that has a value, else ''.
 * Bilingual annotations (e.g. "Fever (ಜ್ವರ / बुखार)") are cleaned per active language.
 */
export const localized = (value: LocalizedText | null | undefined, lang: SupportedLanguage): string => {
  if (value == null) return '';
  if (typeof value === 'string') return cleanBilingualString(value, lang);
  if (usable(value[lang])) return cleanBilingualString(value[lang] as string, lang);
  for (const l of FALLBACK_ORDER) {
    if (usable(value[l])) return cleanBilingualString(value[l] as string, lang);
  }
  return '';
};

/** True when `value` has its own text for `lang` (no fallback). Lets the UI mark English fallbacks if needed. */
export const hasLanguage = (value: LocalizedText | null | undefined, lang: SupportedLanguage): boolean =>
  value != null && typeof value !== 'string' && usable(value[lang]);
