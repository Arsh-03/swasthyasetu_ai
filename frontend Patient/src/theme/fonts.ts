import { Platform } from 'react-native';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  NotoSansKannada_400Regular,
  NotoSansKannada_500Medium,
  NotoSansKannada_600SemiBold,
  NotoSansKannada_700Bold,
} from '@expo-google-fonts/noto-sans-kannada';
import { NotoSerifKannada_600SemiBold, NotoSerifKannada_700Bold } from '@expo-google-fonts/noto-serif-kannada';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { NotoSerifDevanagari_600SemiBold, NotoSerifDevanagari_700Bold } from '@expo-google-fonts/noto-serif-devanagari';
import type { SupportedLanguage } from '../utils/translations';

/**
 * Typography "Option B, warm editorial":
 *   display (largeTitle, title, title2, metric) → Fraunces / Noto Serif Kannada / Noto Serif Devanagari, 600 + 700
 *   everything else                             → DM Sans / Noto Sans Kannada / Noto Sans Devanagari, 400–700
 * Each weight is registered as its own family (most reliable on Android).
 */
export const FONT_SETS: Record<SupportedLanguage, Record<string, number>> = {
  en: {
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  },
  kn: {
    NotoSansKannada_400Regular,
    NotoSansKannada_500Medium,
    NotoSansKannada_600SemiBold,
    NotoSansKannada_700Bold,
    NotoSerifKannada_600SemiBold,
    NotoSerifKannada_700Bold,
  },
  hi: {
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
    NotoSerifDevanagari_600SemiBold,
    NotoSerifDevanagari_700Bold,
  },
};

export type FontWeight = 400 | 500 | 600 | 700;

const WEIGHT_SUFFIX: Record<FontWeight, string> = {
  400: '400Regular',
  500: '500Medium',
  600: '600SemiBold',
  700: '700Bold',
};

const FAMILY: Record<SupportedLanguage, { sans: string; serif: string }> = {
  en: { sans: 'DMSans', serif: 'Fraunces' },
  kn: { sans: 'NotoSansKannada', serif: 'NotoSerifKannada' },
  hi: { sans: 'NotoSansDevanagari', serif: 'NotoSerifDevanagari' },
};

/** Serif families are only loaded at 600 / 700. */
export const fontFamilyFor = (lang: SupportedLanguage, weight: FontWeight, serif = false) => {
  const w: FontWeight = serif ? (weight >= 700 ? 700 : 600) : weight;
  return `${FAMILY[lang][serif ? 'serif' : 'sans']}_${WEIGHT_SUFFIX[w]}`;
};

export const MONO_FAMILY = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' });

/** Per-script size / line-height metrics live in scripts.ts (import-free, unit-testable). */
export { SCRIPT_METRICS } from './scripts';
