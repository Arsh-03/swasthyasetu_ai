import type { SupportedLanguage } from './translations';

/**
 * Backend display text: a plain string today, or one entry per language once the backend
 * sends translations (see docs/API_ROUTES.md, "Localised display fields").
 * Clinical text is never translated on the device.
 */
export type LocalizedText = string | Partial<Record<SupportedLanguage, string | null>>;

const FALLBACK_ORDER: SupportedLanguage[] = ['en', 'kn', 'hi'];

const usable = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Text in the active language, else English, else any language that has a value, else ''.
 * A plain string is returned unchanged.
 */
export const localized = (value: LocalizedText | null | undefined, lang: SupportedLanguage): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (usable(value[lang])) return value[lang] as string;
  for (const l of FALLBACK_ORDER) {
    if (usable(value[l])) return value[l] as string;
  }
  return '';
};

/** True when `value` has its own text for `lang` (no fallback). Lets the UI mark English fallbacks if needed. */
export const hasLanguage = (value: LocalizedText | null | undefined, lang: SupportedLanguage): boolean =>
  value != null && typeof value !== 'string' && usable(value[lang]);
