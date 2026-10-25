import { alpha, palette } from './palette';
import { colors, critical, neu, tints, tones, type Tone } from './tokens';
import type { ContrastPair } from './contrast';

// Must match AMBIENT_PEAK in components/illustrations/AmbientBackground.tsx
const AMBIENT_BLOBS = {
  ice: alpha(palette.ice, 0.7),
  primarySoft: alpha(palette.primarySoft, 0.16),
  sand: alpha(palette.sand, 0.7),
} as const;

// Darkest / lightest points of each depth surface
const RAISED_STRONG_LO = neu.raised.strong.fill[1];
const RAISED_SOFT_LO = neu.raised.soft.fill[1];
const INSET_STRONG_HI = neu.inset.strong.fill[0];
const INSET_SOFT_HI = neu.inset.soft.fill[0];
// Glyphs and labels sit ≥ 12px from an inset's edges, where the inner-shadow strips (depth ≤ 10px,
// fading to 0) have faded to at most ~25% of their peak. Model that residual over the darkest fill.
const INSET_GLYPH_SHADE = palette.neuInsetResidual;

const DEPTH_SURFACES = {
  'raised strong (darkest)': { bg: RAISED_STRONG_LO },
  'raised soft panel (darkest)': { bg: RAISED_SOFT_LO },
  'inset strong (darkest)': { bg: INSET_STRONG_HI },
  'inset soft well (darkest)': { bg: INSET_SOFT_HI },
} as const;

/** Every text / icon on background combination the app uses. Checked by scripts/contrast-check.ts. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  // Canvas
  { name: 'ink on base canvas', fg: colors.ink, bg: colors.base, kind: 'text' },
  { name: 'inkMuted on base canvas', fg: colors.inkMuted, bg: colors.base, kind: 'text' },
  ...Object.entries(AMBIENT_BLOBS).map(([n, blob]) => ({
    name: `inkMuted on canvas over ${n} blob`,
    fg: colors.inkMuted,
    bg: blob,
    over: colors.base,
    kind: 'text' as const,
  })),

  // Text and glyphs on every depth surface (worst point of each gradient)
  ...Object.entries(DEPTH_SURFACES).flatMap(([n, s]) => [
    { name: `ink on ${n}`, fg: colors.ink, bg: s.bg, kind: 'text' as const },
    { name: `inkMuted on ${n}`, fg: colors.inkMuted, bg: s.bg, kind: 'text' as const },
    { name: `primary label on ${n}`, fg: colors.primary, bg: s.bg, kind: 'text' as const },
    { name: `dangerDeep label on ${n}`, fg: colors.dangerDeep, bg: s.bg, kind: 'text' as const },
    { name: `successDeep label on ${n}`, fg: colors.successDeep, bg: s.bg, kind: 'text' as const },
    { name: `warningDeep label on ${n}`, fg: colors.warningDeep, bg: s.bg, kind: 'text' as const },
  ]),
  // IconDisc glyphs (tone icon colour) on raised and inset discs
  ...(Object.keys(tones) as Tone[])
    .filter((t) => t !== 'audio')
    .flatMap((tone) => [
      { name: `${tone} glyph on raised disc`, fg: tones[tone].icon, bg: RAISED_STRONG_LO, kind: 'icon' as const },
      { name: `${tone} glyph on inset disc`, fg: tones[tone].icon, bg: INSET_SOFT_HI, kind: 'icon' as const },
    ]),
  { name: 'inkInset placeholder / idle icon in inset', fg: colors.inkInset, bg: INSET_GLYPH_SHADE, over: INSET_STRONG_HI, kind: 'text' },
  { name: 'primary focus icon in inset', fg: colors.primary, bg: INSET_GLYPH_SHADE, over: INSET_STRONG_HI, kind: 'icon' },
  { name: 'ink input text in inset', fg: colors.ink, bg: INSET_GLYPH_SHADE, over: INSET_STRONG_HI, kind: 'text' },
  // Latched-inset controls on the care plan ("Taken" tick, selected check-in): coloured glyph, ink label
  ...(['success', 'primary', 'danger'] as Tone[]).map((tone) => ({
    name: `${tone} glyph on latched inset control`,
    fg: tones[tone].icon,
    bg: INSET_GLYPH_SHADE,
    over: INSET_STRONG_HI,
    kind: 'icon' as const,
  })),
  { name: 'EmbossedIcon primary on base', fg: colors.primary, bg: colors.base, kind: 'icon' },
  { name: 'EmbossedIcon dangerDeep on sheet', fg: colors.dangerDeep, bg: colors.glassSheet, over: [colors.base, colors.scrimStrong], kind: 'icon' },

  // Tone badges: deep text and icon on their tint, over the panel and canvas
  ...(Object.keys(tones) as Tone[]).flatMap((tone) =>
    ([['panel', RAISED_SOFT_LO], ['canvas', colors.base]] as const).flatMap(([n, surface]) => [
      { name: `${tone} badge text on ${n}`, fg: colors[tones[tone].text], bg: tones[tone].bg, over: surface, kind: 'text' as const },
      { name: `${tone} badge icon on ${n}`, fg: tones[tone].icon, bg: tones[tone].bg, over: surface, kind: 'icon' as const },
    ])
  ),

  // Badges placed directly on the ambient canvas use <Badge solid>: an opaque base under the
  // tint, so they are covered by the "badge text on canvas" pairs above whatever blob is behind.

  // Critical buttons: white label on the solid fill, worst case = full sheen (top-left)
  ...(['primary', 'success', 'danger'] as const).flatMap((tone) => [
    { name: `white on critical ${tone} under sheen`, fg: colors.onPrimary, bg: critical.sheen[0], over: critical[tone].fill, kind: 'text' as const },
    { name: `white on critical ${tone} pressed (inset corner)`, fg: colors.onPrimary, bg: critical.insetDark[0], over: [critical[tone].pressed, critical.insetDark[0]], kind: 'text' as const },
  ]),
  { name: 'ink on critical disabled', fg: colors.ink, bg: critical.disabledFill, kind: 'text' },

  // Glass: ink text only, worst case over each ambient blob
  ...Object.entries(AMBIENT_BLOBS).flatMap(([n, blob]) => [
    { name: `ink on toolbar glass over ${n}`, fg: colors.ink, bg: colors.glassToolbar, over: [colors.base, blob], kind: 'text' as const },
    { name: `ink on tab bar glass over ${n}`, fg: colors.ink, bg: colors.glassTabBar, over: [colors.base, blob], kind: 'text' as const },
    { name: `ink on glass card over ${n}`, fg: colors.ink, bg: colors.glass, over: [colors.base, blob], kind: 'text' as const },
    { name: `ink on sheet over ${n} + strong scrim`, fg: colors.ink, bg: colors.glassSheet, over: [colors.base, blob, colors.scrimStrong], kind: 'text' as const },
    { name: `inkMuted tab icon on tab bar over ${n}`, fg: colors.inkMuted, bg: colors.glassTabBar, over: [colors.base, blob], kind: 'icon' as const },
  ]),

  // Dark surfaces (call screen, toast, incoming call)
  { name: 'white on night', fg: colors.onNight, bg: colors.night, kind: 'text' },
  { name: 'ice on night', fg: colors.onNightMuted, bg: colors.night, kind: 'text' },
  { name: 'white on night glass over ink', fg: colors.onNight, bg: colors.glassNight, over: palette.ink, kind: 'text' },
  { name: 'white on night control', fg: colors.onNight, bg: tints.white, over: colors.night, kind: 'text' },
  { name: 'success icon on night', fg: colors.success, bg: colors.night, kind: 'icon' },
  { name: 'warning icon on night', fg: colors.warning, bg: colors.night, kind: 'icon' },
  { name: 'danger icon on night', fg: colors.danger, bg: colors.night, kind: 'icon' },

  // Accessibility audio badge (V1 rule, unchanged), raised and pressed-inset
  { name: 'audio badge text', fg: colors.audioText, bg: colors.audioBg, kind: 'text' },
  { name: 'audio badge text pressed (inset)', fg: colors.audioText, bg: INSET_GLYPH_SHADE, over: colors.audioBg, kind: 'text' },
];
