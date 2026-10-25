import type { ViewStyle } from 'react-native';
import { alpha, palette } from './palette';

/**
 * Design tokens V2, "Harbor Calm" (docs/05_ui_ux/design_system_tokens.md).
 * Components use these semantic roles, never raw values.
 */

export const colors = {
  // Text
  ink: palette.ink, // primary text, 11:1 on card
  inkMuted: palette.inkMuted, // secondary text on canvas, panels and soft wells
  inkInset: palette.inkInset, // placeholder / idle icon inside strong insets
  onPrimary: palette.white, // text / icons on solid primary, success, danger fills
  onNight: palette.white,
  onNightMuted: palette.ice,

  // Brand / action
  primary: palette.primary,
  primaryPressed: palette.primaryPressed,
  primarySoft: palette.primarySoft, // fills / borders only
  fog: palette.fog, // fills / borders only

  // Status: base hex for tints, fills and icons; Deep for text and white-on-fill buttons
  success: palette.success,
  successDeep: palette.successDeep,
  warning: palette.warning,
  warningDeep: palette.warningDeep,
  danger: palette.danger,
  dangerDeep: palette.dangerDeep,
  dangerPressed: palette.dangerPressed,
  gold: palette.gold, // verified badges only
  goldDeep: palette.goldDeep,

  // Surfaces
  base: palette.base, // app background and neumorphic surface
  card: palette.card,
  sand: palette.sand, // muted / locked surface
  ice: palette.ice, // highlighted surface
  night: palette.night, // immersive call screen

  // Lines
  hairline: alpha(palette.ink, 0.08),
  border: alpha(palette.ink, 0.14),
  separator: alpha(palette.ink, 0.12),

  // Liquid glass (fills chosen so ink text stays ≥ 4.5:1 over the ambient blobs, see contrastPairs)
  glass: alpha(palette.card, 0.55),
  glassToolbar: alpha(palette.base, 0.54),
  glassTabBar: alpha(palette.base, 0.54),
  glassSheet: alpha(palette.card, 0.66),
  glassNight: alpha(palette.night, 0.7),
  glassNightBorder: alpha(palette.white, 0.14),
  specularHi: palette.specularHi,
  specularLo: palette.specularLo,
  scrim: alpha(palette.night, 0.4),
  scrimStrong: alpha(palette.night, 0.68),

  // Accessibility: high-contrast audio badge (unchanged from V1)
  audioBg: palette.audioBg,
  audioText: palette.audioText,

  transparent: 'transparent',
} as const;

export type ColorRole = keyof typeof colors;

/** Translucent tints of the roles (fills behind status text / icons). */
export const tints = {
  primary: alpha(palette.primary, 0.06),
  primaryStrong: alpha(palette.primary, 0.2),
  primaryRing: alpha(palette.primary, 0.28),
  success: alpha(palette.success, 0.1),
  successRing: alpha(palette.success, 0.32),
  warning: alpha(palette.warning, 0.12),
  warningRing: alpha(palette.warning, 0.36),
  danger: alpha(palette.danger, 0.06),
  dangerRing: alpha(palette.danger, 0.3),
  gold: alpha(palette.gold, 0.09),
  goldRing: alpha(palette.gold, 0.36),
  ink: alpha(palette.ink, 0.045),
  white: alpha(palette.white, 0.14),
  whiteStrong: alpha(palette.white, 0.24),
  dangerOnNight: alpha(palette.danger, 0.32),
  iceGlow: alpha(palette.ice, 0.14),
  audioRing: alpha(palette.audioText, 0.15),
  audioWave: alpha(palette.audioText, 0.25),
} as const;

/** Semantic tones shared by badges, icon tiles and metric cards. */
export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'neutral' | 'audio';

export const tones: Record<Tone, { icon: string; text: ColorRole; bg: string; ring: string }> = {
  primary: { icon: colors.primary, text: 'primary', bg: tints.primary, ring: tints.primaryRing },
  success: { icon: colors.successDeep, text: 'successDeep', bg: tints.success, ring: tints.successRing },
  // Base warning / gold fail 3:1 as icons, so their icons use the deep variant too
  warning: { icon: colors.warningDeep, text: 'warningDeep', bg: tints.warning, ring: tints.warningRing },
  danger: { icon: colors.dangerDeep, text: 'dangerDeep', bg: tints.danger, ring: tints.dangerRing },
  gold: { icon: colors.goldDeep, text: 'goldDeep', bg: tints.gold, ring: tints.goldRing },
  neutral: { icon: colors.inkMuted, text: 'inkMuted', bg: tints.ink, ring: colors.hairline },
  audio: { icon: colors.audioText, text: 'audioText', bg: colors.audioBg, ring: alpha(palette.audioText, 0.15) }, // tints.audioRing
};

/** Brand mark gradient, primary → ink (no indigo). */
export const brandGradient = [colors.primary, colors.ink] as const;

/** Slightly softer than V1. */
export const radii = {
  xs: 8,
  sm: 12, // segmented thumb, small chips
  md: 14, // inputs, buttons
  lg: 20, // cards
  xl: 28, // hero panels, dialogs
  sheet: 32,
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

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

/** Soft ink-tinted elevation for flat cards and glass. */
export const shadows: Record<'sm' | 'md' | 'lg' | 'glass', Shadow> = {
  sm: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  md: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 8 },
  glass: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
};

/**
 * Neumorphism, full depth language (design_system_tokens.md § 5).
 * RAISED = you can press it. INSET = it holds, shows or receives something.
 * STRONG tier = controls; SOFT tier (~58%) = panels, wells, trays, rows.
 * Light source top-left. RN shadowRadius ≈ CSS blur / 2.
 */
export type NeuStrength = 'soft' | 'strong';

export const neu = {
  surface: palette.base,
  raised: {
    strong: {
      fill: [palette.neuRaisedHi, palette.neuRaisedLo] as const,
      light: { color: palette.neuLight, offset: -8, radius: 8 }, // CSS −8/−8 blur 16
      dark: { color: palette.neuDark, offset: 8, radius: 9 }, // CSS +8/+8 blur 18
      edgeLight: palette.neuLight,
      edgeDark: palette.neuDarkSoft,
      elevation: 6,
    },
    soft: {
      fill: [palette.neuRaisedSoftHi, palette.neuRaisedSoftLo] as const,
      light: { color: palette.neuLightSoft, offset: -5, radius: 5 },
      dark: { color: palette.neuDarkSoft, offset: 5, radius: 5 },
      edgeLight: palette.neuLightSoft,
      edgeDark: palette.neuGrooveDark,
      elevation: 2,
    },
  },
  inset: {
    // Inner dark shadow toward the top-left (~4/4, blur ~10), inner light toward the bottom-right
    strong: {
      fill: [palette.neuInsetHi, palette.neuInsetLo] as const,
      dark: [palette.neuInsetDark, palette.neuInsetClear] as const,
      light: [palette.neuLightClear, palette.neuLightInset] as const,
      depth: 10,
      edgeDark: palette.neuInsetDark,
      edgeLight: palette.neuLightInset,
    },
    soft: {
      fill: [palette.neuInsetSoftHi, palette.neuInsetSoftLo] as const,
      dark: [palette.neuInsetDarkSoft, palette.neuInsetClear] as const,
      light: [palette.neuLightClear, palette.neuLightInsetSoft] as const,
      depth: 6,
      edgeDark: palette.neuInsetDarkSoft,
      edgeLight: palette.neuLightInsetSoft,
    },
  },
  /** Debossed list divider: 1px dark line with 1px white right below. */
  groove: { dark: palette.neuGrooveDark, light: palette.neuGrooveLight },
  /** Selected / pressed accent. */
  accent: palette.primary,
} as const;

/** Solid critical-action fills (CriticalButton): base, pressed, glow. White label ≥ 4.5:1 on all. */
export const critical = {
  primary: { fill: palette.primary, pressed: palette.primaryPressed },
  success: { fill: palette.successDeep, pressed: palette.successPressed },
  danger: { fill: palette.dangerDeep, pressed: palette.dangerPressed },
  sheen: [palette.criticalSheen, palette.criticalSheenClear] as const,
  insetDark: [palette.criticalInsetDark, palette.criticalInsetClear] as const,
  edgeLight: palette.criticalEdgeLight,
  /** Disabled: fill only, no shadow, ink label (4.7:1 on primarySoft). */
  disabledFill: palette.primarySoft,
} as const;

/** Glass inner top highlight. */
export const glassHighlight = [palette.glassHighlight, palette.glassHighlightClear] as const;

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
  largeTitle: { fontSize: 30, weight: 700, letterSpacing: -0.4, serif: true },
  title: { fontSize: 24, weight: 600, letterSpacing: -0.3, serif: true },
  title2: { fontSize: 20, weight: 600, letterSpacing: -0.2, serif: true },
  metric: { fontSize: 32, weight: 700, letterSpacing: -0.5, serif: true },
  headline: { fontSize: 17, weight: 600 },
  body: { fontSize: 16, weight: 400 },
  callout: { fontSize: 16, weight: 600 },
  subhead: { fontSize: 15, weight: 500 },
  footnote: { fontSize: 13, weight: 400 },
  caption: { fontSize: 12, weight: 500 },
  eyebrow: { fontSize: 12, weight: 600, letterSpacing: 0.6, uppercase: true },
  mono: { fontSize: 12, weight: 500, mono: true },
};
