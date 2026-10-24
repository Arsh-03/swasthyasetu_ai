import { Platform } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansKannada_400Regular,
  NotoSansKannada_500Medium,
  NotoSansKannada_600SemiBold,
  NotoSansKannada_700Bold,
} from '@expo-google-fonts/noto-sans-kannada';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import type { SupportedLanguage } from '../utils/translations';

/** Passed to expo-font's useFonts in App.tsx. Each weight is its own family (most reliable on Android). */
export const FONT_MAP = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  NotoSansKannada_400Regular,
  NotoSansKannada_500Medium,
  NotoSansKannada_600SemiBold,
  NotoSansKannada_700Bold,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
};

export type FontWeight = 400 | 500 | 600 | 700;

const WEIGHT_SUFFIX: Record<FontWeight, string> = {
  400: '400Regular',
  500: '500Medium',
  600: '600SemiBold',
  700: '700Bold',
};

const FAMILY_PREFIX: Record<SupportedLanguage, string> = {
  en: 'Inter',
  kn: 'NotoSansKannada',
  hi: 'NotoSansDevanagari',
};

export const fontFamilyFor = (lang: SupportedLanguage, weight: FontWeight) =>
  `${FAMILY_PREFIX[lang]}_${WEIGHT_SUFFIX[weight]}`;

export const MONO_FAMILY = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' });

/**
 * Script metrics (accessibility rules): Kannada and Devanagari have tall vowel
 * signs and conjuncts that clip at Latin line-heights.
 */
export const SCRIPT_METRICS: Record<SupportedLanguage, { sizeScale: number; lineHeight: number; compactLineHeight: number }> = {
  en: { sizeScale: 1, lineHeight: 1.45, compactLineHeight: 1.25 },
  kn: { sizeScale: 1.1, lineHeight: 1.75, compactLineHeight: 1.75 },
  hi: { sizeScale: 1.05, lineHeight: 1.7, compactLineHeight: 1.7 },
};
