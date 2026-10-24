import type { ViewStyle } from 'react-native';

/**
 * Design tokens for the Patient app.
 * Mirrors the Doctor portal's Tailwind config (frontend Doctor/index.html):
 * apple-* colours, apple-sm/md/lg/glass shadows and the liquid-glass fills.
 */

export const colors = {
  // Brand / system
  blue: '#007AFF',
  blueHover: '#0062CC',
  green: '#34C759',
  greenDeep: '#248A3D',
  indigo: '#5856D6',
  orange: '#FF9500',
  orangeDeep: '#C97700',
  red: '#FF3B30',
  teal: '#30B0C7',

  // Greys (apple-gray-1 … 6)
  gray1: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',

  // Text
  label: '#1C1C1E',
  secondary: '#636366',
  tertiary: '#8E8E93',
  onTint: '#FFFFFF',

  // Surfaces
  bg: '#F2F2F7',
  card: '#FFFFFF',
  cardMuted: '#F9F9FB',
  dark: '#1C1C1E',
  black: '#000000',

  // Lines (border-black/5, /10 and the toolbar hairline)
  hairline: 'rgba(0, 0, 0, 0.05)',
  border: 'rgba(0, 0, 0, 0.10)',
  separator: 'rgba(0, 0, 0, 0.12)',

  // Liquid glass fills and borders
  glass: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(255, 255, 255, 0.60)',
  glassToolbar: 'rgba(248, 248, 250, 0.82)',
  glassSheet: 'rgba(255, 255, 255, 0.88)',
  glassSheetBorder: 'rgba(255, 255, 255, 0.70)',
  glassDark: 'rgba(28, 28, 30, 0.75)',
  glassDarkBorder: 'rgba(255, 255, 255, 0.15)',
  scrim: 'rgba(0, 0, 0, 0.40)',
  scrimStrong: 'rgba(0, 0, 0, 0.65)',

  // Accessibility: high-contrast audio badge
  audioBg: '#ECFDF5',
  audioText: '#047857',
} as const;

/** Tailwind-style `/10`, `/15` tints of the system colours. */
export const tints = {
  blue: 'rgba(0, 122, 255, 0.10)',
  blueStrong: 'rgba(0, 122, 255, 0.15)',
  blueRing: 'rgba(0, 122, 255, 0.20)',
  blueSubtle: 'rgba(0, 122, 255, 0.05)',
  green: 'rgba(52, 199, 89, 0.10)',
  greenStrong: 'rgba(52, 199, 89, 0.15)',
  greenRing: 'rgba(52, 199, 89, 0.30)',
  orange: 'rgba(255, 149, 0, 0.10)',
  orangeStrong: 'rgba(255, 149, 0, 0.15)',
  orangeRing: 'rgba(255, 149, 0, 0.20)',
  red: 'rgba(255, 59, 48, 0.10)',
  redStrong: 'rgba(255, 59, 48, 0.15)',
  redRing: 'rgba(255, 59, 48, 0.20)',
  indigo: 'rgba(88, 86, 214, 0.10)',
  indigoRing: 'rgba(88, 86, 214, 0.20)',
  gray: 'rgba(229, 229, 234, 0.70)', // bg-[#E5E5EA]/70
} as const;

/** Semantic tones shared by badges, icon tiles and metric cards. */
export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'neutral' | 'audio';

export const tones: Record<Tone, { fg: string; text: keyof typeof colors; bg: string; ring: string }> = {
  blue: { fg: colors.blue, text: 'blue', bg: tints.blue, ring: tints.blueRing },
  green: { fg: colors.green, text: 'greenDeep', bg: tints.greenStrong, ring: tints.greenRing },
  orange: { fg: colors.orange, text: 'orangeDeep', bg: tints.orangeStrong, ring: tints.orangeRing },
  red: { fg: colors.red, text: 'red', bg: tints.red, ring: tints.redRing },
  indigo: { fg: colors.indigo, text: 'indigo', bg: tints.indigo, ring: tints.indigoRing },
  neutral: { fg: colors.secondary, text: 'secondary', bg: colors.gray6, ring: colors.hairline },
  audio: { fg: colors.audioText, text: 'audioText', bg: colors.audioBg, ring: 'rgba(4, 120, 87, 0.15)' },
};

/** Brand mark gradient (from-[#007AFF] to-[#5856D6]). */
export const brandGradient = [colors.blue, colors.indigo] as const;

export const radii = {
  xs: 6, // rounded-md
  sm: 9, // segmented item
  md: 12, // rounded-xl: inputs, buttons
  lg: 16, // rounded-2xl: cards
  xl: 24, // rounded-3xl: hero panels, modals
  sheet: 28,
  pill: 9999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 16, // horizontal screen padding
} as const;

/** Minimum touch target (accessibility rule). */
export const touch = { min: 48, compact: 44 } as const;

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

export const shadows: Record<'sm' | 'md' | 'lg' | 'glass', Shadow> = {
  // 0 1px 3px rgba(0,0,0,.05)
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  // 0 4px 14px rgba(0,0,0,.06)
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 },
  // 0 12px 32px rgba(0,0,0,.08)
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 8 },
  // 0 8px 32px rgba(0,0,0,.06)
  glass: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 4 },
};

/** Coloured glow used under primary buttons. */
export const glow = (color: string): Shadow => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 3,
});

/**
 * Type scale (Latin sizes; AppText scales them for Kannada / Hindi).
 * Matches the Doctor's text-[10px] … text-3xl usage.
 */
export type TypeVariant =
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'eyebrow'
  | 'metric'
  | 'mono';

export const typography: Record<TypeVariant, { fontSize: number; weight: 400 | 500 | 600 | 700; letterSpacing?: number; uppercase?: boolean; mono?: boolean }> = {
  largeTitle: { fontSize: 28, weight: 700, letterSpacing: -0.5 }, // text-2xl/3xl font-bold tracking-tight
  title: { fontSize: 22, weight: 700, letterSpacing: -0.4 },
  title2: { fontSize: 18, weight: 600, letterSpacing: -0.3 }, // text-lg font-semibold
  headline: { fontSize: 16, weight: 700, letterSpacing: -0.2 }, // card titles
  body: { fontSize: 15, weight: 400 },
  callout: { fontSize: 14, weight: 600 }, // buttons
  subhead: { fontSize: 13, weight: 500 },
  footnote: { fontSize: 12, weight: 400 }, // text-xs
  caption: { fontSize: 11, weight: 500 },
  eyebrow: { fontSize: 11, weight: 600, letterSpacing: 0.6, uppercase: true }, // uppercase tracking-wider
  metric: { fontSize: 30, weight: 700, letterSpacing: -0.6 }, // text-3xl font-bold
  mono: { fontSize: 11, weight: 500, mono: true },
};
