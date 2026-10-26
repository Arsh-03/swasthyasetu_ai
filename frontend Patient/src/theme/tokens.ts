import type { ViewStyle } from 'react-native';
import { alpha, palette } from './palette';

/**
 * Design tokens: Harbor Calm clean surface system.
 * Pure #FFFFFF cards with 1px #DCE5EA border, light #F2F5F8 canvas,
 * elevation tokens (e1/e2/e3), domain colours for orientation,
 * no neumorphism.
 */

export const colors = {
  // Text
  ink: palette.ink, // primary text, ≥ 11:1 on card/base
  inkMuted: palette.inkMuted, // secondary text, ≥ 4.5:1 on base, card and domain tints
  inkInset: palette.inkMuted, // placeholder / leading icon
  onPrimary: palette.white, // text / icons on solid primary, success, danger fills
  onNight: palette.white,
  onNightMuted: palette.ice,

  // Brand / primary action
  primary: palette.primary,
  primaryPressed: palette.primaryPressed,
  primaryDeep: palette.primaryDeep,
  primarySoft: palette.primarySoft,
  fog: palette.fog,
  ice: palette.ice,

  // Domain orientation colours
  teal: palette.teal,
  tealDeep: palette.tealDeep,
  navy: palette.navy,
  navyDeep: palette.navyDeep,
  sand: palette.sand,
  gold: palette.gold,
  goldDeep: palette.goldDeep,
  warning: palette.warning,
  warningDeep: palette.warningDeep,
  danger: palette.danger,
  dangerDeep: palette.dangerDeep,
  dangerPressed: palette.dangerPressed,
  success: palette.success,
  successDeep: palette.successDeep,
  successPressed: palette.successPressed,

  // Clean surfaces
  base: palette.base,         // light page background (#F2F5F8)
  card: palette.card,         // pure white card (#FFFFFF)
  cardBorder: palette.cardBorder, // 1px border (#DCE5EA)
  inputBorder: palette.inputBorder, // 1px border (≥ 3:1 vs card & canvas)
  border: palette.cardBorder,
  hairline: alpha(palette.ink, 0.08),
  separator: alpha(palette.ink, 0.10),
  night: palette.night,
  white: palette.white,

  // Subtle glass (top bar, docked tab bar, sheets: light blur, fill ~0.8, hairline border)
  glass: alpha(palette.white, 0.82),
  glassToolbar: alpha(palette.white, 0.85),
  glassTabBar: alpha(palette.white, 0.88),
  glassSheet: alpha(palette.white, 0.92),
  glassNight: alpha(palette.night, 0.75),
  glassNightBorder: alpha(palette.white, 0.14),
  scrim: alpha(palette.night, 0.4),
  scrimStrong: alpha(palette.night, 0.68),

  // Accessibility: high-contrast audio badge
  audioBg: palette.audioBg,
  audioText: palette.audioText,

  transparent: 'transparent',
} as const;

export type ColorRole = keyof typeof colors;

/** Translucent ~12% tints of the roles (fills behind status text / icons). */
export const tints = {
  primary: alpha(palette.primary, 0.12),
  primaryStrong: alpha(palette.primary, 0.2),
  primaryRing: alpha(palette.primary, 0.28),
  teal: alpha(palette.teal, 0.12),
  tealRing: alpha(palette.teal, 0.28),
  navy: alpha(palette.navy, 0.12),
  navyRing: alpha(palette.navy, 0.28),
  success: alpha(palette.success, 0.12),
  successRing: alpha(palette.success, 0.32),
  warning: alpha(palette.warning, 0.12),
  warningRing: alpha(palette.warning, 0.36),
  danger: alpha(palette.danger, 0.12),
  dangerRing: alpha(palette.danger, 0.3),
  gold: alpha(palette.gold, 0.12),
  goldRing: alpha(palette.gold, 0.36),
  ink: alpha(palette.ink, 0.05),
  ice: alpha(palette.ice, 0.4),
  white: alpha(palette.white, 0.14),
  whiteStrong: alpha(palette.white, 0.24),
  dangerOnNight: alpha(palette.danger, 0.32),
  audioRing: alpha(palette.audioText, 0.15),
  audioWave: alpha(palette.audioText, 0.25),
} as const;

/** Domain orientation categories (spec: appointments, medications, records, privacy, followup, emergency). */
export type Domain = 'appointments' | 'medications' | 'records' | 'privacy' | 'followup' | 'emergency';

export const domains: Record<Domain, { base: string; deep: string; tint: string; ring: string; labelKey: string }> = {
  appointments: { base: palette.primary, deep: palette.primaryDeep, tint: tints.primary, ring: tints.primaryRing, labelKey: 'appointments' },
  medications: { base: palette.teal, deep: palette.tealDeep, tint: tints.teal, ring: tints.tealRing, labelKey: 'medications' },
  records: { base: palette.gold, deep: palette.goldDeep, tint: tints.gold, ring: tints.goldRing, labelKey: 'records' },
  privacy: { base: palette.navy, deep: palette.navyDeep, tint: tints.navy, ring: tints.navyRing, labelKey: 'privacy' },
  followup: { base: palette.warning, deep: palette.warningDeep, tint: tints.warning, ring: tints.warningRing, labelKey: 'followup' },
  emergency: { base: palette.danger, deep: palette.dangerDeep, tint: tints.danger, ring: tints.dangerRing, labelKey: 'emergency' },
};

/** Semantic tones shared by badges, icon tiles and metric cards. */
export type Tone = 'primary' | 'teal' | 'navy' | 'success' | 'warning' | 'danger' | 'gold' | 'neutral' | 'audio';

export const tones: Record<Tone, { icon: string; text: ColorRole; bg: string; ring: string }> = {
  primary: { icon: colors.primaryDeep, text: 'primaryDeep', bg: tints.primary, ring: tints.primaryRing },
  teal: { icon: colors.tealDeep, text: 'tealDeep', bg: tints.teal, ring: tints.tealRing },
  navy: { icon: colors.navyDeep, text: 'navyDeep', bg: tints.navy, ring: tints.navyRing },
  success: { icon: colors.successDeep, text: 'successDeep', bg: tints.success, ring: tints.successRing },
  warning: { icon: colors.warningDeep, text: 'warningDeep', bg: tints.warning, ring: tints.warningRing },
  danger: { icon: colors.dangerDeep, text: 'dangerDeep', bg: tints.danger, ring: tints.dangerRing },
  gold: { icon: colors.goldDeep, text: 'goldDeep', bg: tints.gold, ring: tints.goldRing },
  neutral: { icon: colors.inkMuted, text: 'inkMuted', bg: tints.ink, ring: colors.hairline },
  audio: { icon: colors.audioText, text: 'audioText', bg: colors.audioBg, ring: tints.audioRing },
};

/** Brand mark gradient: primary → ink. */
export const brandGradient = [colors.primary, colors.ink] as const;

/** Solid hero gradient (next appointment, patient banner): solid primary → ink with white text (≥ 4.5:1). */
export const heroGradient = [palette.primary, palette.ink] as const;

export const radii = {
  xs: 6,
  sm: 10,  // segmented thumb, chips
  md: 12,  // inputs, buttons
  lg: 16,  // cards
  xl: 20,  // hero panels, sheets, modals
  sheet: 24,
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
  gutter: 16,
} as const;

/** Minimum touch target (accessibility rule). */
export const touch = { min: 48, compact: 44 } as const;

export type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

/** Elevation tokens: e1, e2, e3 (replaces neumorphism). One shadow layer each; no inset shadows. */
export const elevation: Record<'e1' | 'e2' | 'e3', Shadow> = {
  // e1 = 0 1px 2px rgba(31,58,76,0.06): Card base
  e1: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  // e2 = 0 4px 12px rgba(31,58,76,0.08): Interactive card hover/press
  e2: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  // e3 = 0 12px 32px rgba(31,58,76,0.14): Modal / sheet
  e3: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 4 },
};

export const shadows = {
  sm: elevation.e1,
  md: elevation.e2,
  lg: elevation.e3,
  card: elevation.e1,
  cardInteractive: elevation.e2,
  modal: elevation.e3,
  glass: elevation.e1,
} as const;

/** Flat solid critical-action fills: base, pressed. White label ≥ 4.5:1 on all. */
export const critical = {
  primary: { fill: palette.primary, pressed: palette.primaryPressed },
  success: { fill: palette.successDeep, pressed: palette.successPressed },
  danger: { fill: palette.dangerDeep, pressed: palette.dangerPressed },
  disabledFill: palette.primarySoft,
} as const;

/**
 * Type scale (Latin sizes; AppText scales them for Kannada / Hindi).
 * `serif` variants use Fraunces / Noto Serif; everything else is sans.
 */
export type TypeVariant =
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'metric'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'eyebrow'
  | 'mono';

export const typography: Record<
  TypeVariant,
  { fontSize: number; weight: 400 | 500 | 600 | 700; letterSpacing?: number; uppercase?: boolean; mono?: boolean; serif?: boolean }
> = {
  largeTitle: { fontSize: 26, weight: 700, letterSpacing: -0.3, serif: true },
  title: { fontSize: 22, weight: 600, letterSpacing: -0.2, serif: true },
  title2: { fontSize: 18, weight: 600, letterSpacing: -0.1, serif: true },
  metric: { fontSize: 28, weight: 700, letterSpacing: -0.4, serif: true },
  headline: { fontSize: 16, weight: 600 },
  body: { fontSize: 15, weight: 400 },
  callout: { fontSize: 15, weight: 600 },
  subhead: { fontSize: 14, weight: 500 },
  footnote: { fontSize: 13, weight: 400 },
  caption: { fontSize: 12, weight: 500 },
  eyebrow: { fontSize: 11, weight: 600, letterSpacing: 0.5, uppercase: true },
  mono: { fontSize: 12, weight: 500, mono: true },
};
