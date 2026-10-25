import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography, type ColorRole, type TypeVariant } from '../../theme/tokens';
import { fontFamilyFor, MONO_FAMILY, type FontWeight } from '../../theme/fonts';
import { scriptFontSize, scriptLineHeight, scriptWeight, splitScriptRuns, type ScriptRun } from '../../theme/scripts';
import { useFontsLoaded } from '../../theme/FontsProvider';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSurface } from './SurfaceContext';
import type { SupportedLanguage } from '../../utils/translations';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  weight?: FontWeight;
  color?: ColorRole;
  align?: TextStyle['textAlign'];
  /** Script for text that has no letters of its own (punctuation only); also used by StableLabel. */
  lang?: SupportedLanguage;
  /** Tighter Latin line-height for single-line UI labels. Kannada / Hindi keep their safe line-height. */
  compact?: boolean;
}

const RN_WEIGHT: Record<FontWeight, TextStyle['fontWeight']> = { 400: '400', 500: '500', 600: '600', 700: '700' };

/** Plain string content of children, or null when children contain elements. */
const textOf = (children: React.ReactNode): string | null => {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children) && children.every((c) => typeof c === 'string' || typeof c === 'number' || c == null || c === false)) {
    return children.filter((c) => c != null && c !== false).join('');
  }
  return null;
};

/**
 * Text with the multilingual rules built in:
 *  - Mixed-script: the string is split into script runs; Latin letters and digits use DM Sans
 *    (Fraunces for display variants) on every screen, Kannada runs Noto Sans / Serif Kannada,
 *    Devanagari runs Noto Sans / Serif Devanagari. So backend data (names, dates, times) looks
 *    the same in every language and digits never look heavier than the letters around them.
 *  - Per-script size and line-height (Kannada ×1.1 / 1.75, Hindi ×1.05 / 1.70); Indic captions
 *    and eyebrows get a 14px / weight-500 floor; uppercase and letter-spacing only for Latin.
 *  - System font until a script's fonts have loaded; inkMuted becomes ink on glass.
 */
export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  weight,
  color = 'ink',
  align,
  lang: langOverride,
  compact = false,
  style,
  children,
  ...rest
}) => {
  const { lang: appLang } = useLanguage();
  const fontsLoaded = useFontsLoaded();
  const surface = useSurface();
  const role: ColorRole = surface === 'glass' && color === 'inkMuted' ? 'ink' : color;
  const lang = langOverride ?? appLang;
  const spec = typography[variant];
  const w = weight ?? spec.weight;
  const base: TextStyle = { color: colors[role], textAlign: align };

  if (spec.mono) {
    return (
      <Text style={[{ fontFamily: MONO_FAMILY, fontSize: spec.fontSize, fontWeight: '500' }, base, style]} maxFontSizeMultiplier={1.6} {...rest}>
        {children}
      </Text>
    );
  }

  const runStyle = (script: SupportedLanguage): TextStyle => {
    const runWeight = scriptWeight(w, script, variant);
    return {
      ...(fontsLoaded[script] ? { fontFamily: fontFamilyFor(script, runWeight, spec.serif) } : { fontWeight: RN_WEIGHT[runWeight] }),
      fontSize: scriptFontSize(spec.fontSize, script, variant),
    };
  };

  const text = textOf(children);
  // Elements inside (rare): fall back to the app language's script for the whole block
  const runs: ScriptRun[] = text === null ? [{ script: lang, text: '' }] : splitScriptRuns(text, lang);
  const scripts = new Set(runs.map((r) => r.script));
  const latinOnly = scripts.size === 1 && scripts.has('en');
  const lineHeight = Math.max(...runs.map((r) => scriptLineHeight(scriptFontSize(spec.fontSize, r.script, variant), r.script, compact)));

  const outer: TextStyle = {
    ...runStyle(runs[0].script),
    lineHeight,
    // Uppercase and tracking are Latin-only; never applied when any Indic run is present
    letterSpacing: latinOnly ? spec.letterSpacing : undefined,
    textTransform: latinOnly && spec.uppercase ? 'uppercase' : undefined,
  };

  return (
    <Text style={[outer, base, style]} maxFontSizeMultiplier={1.6} {...rest}>
      {text === null || runs.length === 1
        ? children
        : runs.map((r, i) => (
            <Text key={i} style={runStyle(r.script)}>
              {r.text}
            </Text>
          ))}
    </Text>
  );
};
