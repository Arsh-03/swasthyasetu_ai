/**
 * Script-aware typography helpers (import-free, so Node can unit-test them).
 *
 * Mixed-script rule (design_system_tokens.md § 3): every run of text is set in the font of
 * its own script. Latin letters and digits use DM Sans (Fraunces for display variants) even
 * on a Kannada or Hindi screen; Kannada runs use Noto Sans / Serif Kannada; Devanagari runs
 * use Noto Sans / Serif Devanagari. Each run keeps its script's size and line-height rules.
 */
import type { SupportedLanguage } from '../utils/translations';

export type FontWeightValue = 400 | 500 | 600 | 700;

export const SCRIPT_METRICS: Record<SupportedLanguage, { sizeScale: number; lineHeight: number; compactLineHeight: number }> = {
  en: { sizeScale: 1, lineHeight: 1.45, compactLineHeight: 1.25 },
  kn: { sizeScale: 1.1, lineHeight: 1.75, compactLineHeight: 1.75 },
  hi: { sizeScale: 1.05, lineHeight: 1.7, compactLineHeight: 1.7 },
};

/**
 * Indic caption floor (accessibility): Kannada / Devanagari glyphs look smaller and lighter
 * than Latin at the same px, so these small variants get a 14px floor BEFORE the per-script
 * multiplier, and at least weight 500. Never uppercase or letter-spaced.
 */
const INDIC_FLOOR_VARIANTS = new Set(['caption', 'eyebrow']);
export const INDIC_MIN_SIZE = 14;
export const INDIC_MIN_WEIGHT: FontWeightValue = 500;

export const scriptFontSize = (baseSize: number, script: SupportedLanguage, variant: string) => {
  if (script === 'en') return baseSize;
  const floored = INDIC_FLOOR_VARIANTS.has(variant) ? Math.max(baseSize, INDIC_MIN_SIZE) : baseSize;
  return Math.round(floored * SCRIPT_METRICS[script].sizeScale * 10) / 10;
};

export const scriptWeight = (weight: FontWeightValue, script: SupportedLanguage, variant: string): FontWeightValue =>
  script !== 'en' && INDIC_FLOOR_VARIANTS.has(variant) && weight < INDIC_MIN_WEIGHT ? INDIC_MIN_WEIGHT : weight;

export const scriptLineHeight = (fontSize: number, script: SupportedLanguage, compact: boolean) =>
  Math.ceil(fontSize * (compact ? SCRIPT_METRICS[script].compactLineHeight : SCRIPT_METRICS[script].lineHeight));

const KANNADA = /[ಀ-೿]/;
const DEVANAGARI = /[ऀ-ॿ꣠-ꣿ᳐-᳿]/;
const LATIN = /[A-Za-z0-9À-ɏ]/;

/** Script of one character, or null for neutral characters (spaces, punctuation, symbols, joiners). */
export const charScript = (ch: string): SupportedLanguage | null =>
  KANNADA.test(ch) ? 'kn' : DEVANAGARI.test(ch) ? 'hi' : LATIN.test(ch) ? 'en' : null;

export interface ScriptRun {
  script: SupportedLanguage;
  text: string;
}

/**
 * Split text into same-script runs. Neutral characters stay with the run they follow
 * (leading neutrals join the first run); text with no script letters takes `fallback`.
 */
export const splitScriptRuns = (text: string, fallback: SupportedLanguage): ScriptRun[] => {
  const runs: ScriptRun[] = [];
  let leading = '';
  for (const ch of text) {
    const s = charScript(ch);
    const last = runs[runs.length - 1];
    if (s === null) {
      if (last) last.text += ch;
      else leading += ch;
    } else if (last && last.script === s) {
      last.text += ch;
    } else {
      runs.push({ script: s, text: runs.length ? ch : leading + ch });
    }
  }
  return runs.length ? runs : [{ script: fallback, text: leading }];
};
