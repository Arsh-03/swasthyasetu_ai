import { palette } from './palette';
import { colors, critical, domains, tints, tones, type Domain, type Tone } from './tokens';
import type { ContrastPair } from './contrast';

/**
 * Every text / icon on background combination the patient app uses.
 * Grounded in the Harbor Calm clean surface system.
 * Checked by scripts/contrast-check.ts.
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
  // ---- Clean Surfaces: Canvas (base #F2F5F8) & Card (#FFFFFF) ----
  ...(['base', 'card'] as const).flatMap((surface) => [
    { name: `ink on ${surface}`, fg: colors.ink, bg: colors[surface], kind: 'text' as const },
    { name: `inkMuted on ${surface}`, fg: colors.inkMuted, bg: colors[surface], kind: 'text' as const },
    { name: `primary label on ${surface}`, fg: colors.primary, bg: colors[surface], kind: 'text' as const },
    { name: `primaryDeep label on ${surface}`, fg: colors.primaryDeep, bg: colors[surface], kind: 'text' as const },
    { name: `tealDeep label on ${surface}`, fg: colors.tealDeep, bg: colors[surface], kind: 'text' as const },
    { name: `navyDeep label on ${surface}`, fg: colors.navyDeep, bg: colors[surface], kind: 'text' as const },
    { name: `successDeep label on ${surface}`, fg: colors.successDeep, bg: colors[surface], kind: 'text' as const },
    { name: `warningDeep label on ${surface}`, fg: colors.warningDeep, bg: colors[surface], kind: 'text' as const },
    { name: `dangerDeep label on ${surface}`, fg: colors.dangerDeep, bg: colors[surface], kind: 'text' as const },
    { name: `goldDeep label on ${surface}`, fg: colors.goldDeep, bg: colors[surface], kind: 'text' as const },
  ]),

  // Tonal secondary button (ice fill)
  { name: 'primary on ice (tonal button)', fg: colors.primary, bg: colors.ice, kind: 'text' },
  { name: 'primaryDeep on ice (tonal active)', fg: colors.primaryDeep, bg: colors.ice, kind: 'text' },

  // Input & card borders against surroundings (>= 3:1 for input border)
  { name: 'inputBorder on card (surroundings)', fg: colors.inputBorder, bg: colors.card, kind: 'icon' },
  { name: 'inputBorder on base (surroundings)', fg: colors.inputBorder, bg: colors.base, kind: 'icon' },

  // ---- Domain Orientation Colours: Tint Fills + Deep Text & Icons ----
  // Domain rules:
  // Status chips = tinted pills with deep text (>= 4.5:1)
  // Icon tiles = tint fill + glyph in domain's deep colour (>= 3:1)
  ...(Object.keys(domains) as Domain[]).flatMap((domain) => [
    { name: `${domain} chip text on card`, fg: domains[domain].deep, bg: domains[domain].tint, over: colors.card, kind: 'text' as const },
    { name: `${domain} chip text on base`, fg: domains[domain].deep, bg: domains[domain].tint, over: colors.base, kind: 'text' as const },
    { name: `${domain} tile icon on card`, fg: domains[domain].deep, bg: domains[domain].tint, over: colors.card, kind: 'icon' as const },
    { name: `${domain} tile icon on base`, fg: domains[domain].deep, bg: domains[domain].tint, over: colors.base, kind: 'icon' as const },
  ]),

  // Tone badges
  ...(Object.keys(tones) as Tone[]).flatMap((tone) => [
    { name: `${tone} badge text on card`, fg: colors[tones[tone].text], bg: tones[tone].bg, over: colors.card, kind: 'text' as const },
    { name: `${tone} badge icon on card`, fg: tones[tone].icon, bg: tones[tone].bg, over: colors.card, kind: 'icon' as const },
  ]),

  // Audio badge
  { name: 'audio badge text', fg: colors.audioText, bg: colors.audioBg, kind: 'text' },

  // ---- Solid Fills & Critical Actions (flat solid deep colour with white label >= 4.5:1) ----
  ...(['primary', 'success', 'danger'] as const).flatMap((tone) => [
    { name: `white on critical ${tone}`, fg: colors.onPrimary, bg: critical[tone].fill, kind: 'text' as const },
    { name: `white on critical ${tone} pressed`, fg: colors.onPrimary, bg: critical[tone].pressed, kind: 'text' as const },
  ]),
  { name: 'ink on critical disabled', fg: colors.ink, bg: critical.disabledFill, kind: 'text' },

  // ---- Subtle Glass Surfaces (fill ~0.8, light blur, hairline border) ----
  { name: 'ink on toolbar glass over base', fg: colors.ink, bg: colors.glassToolbar, over: colors.base, kind: 'text' },
  { name: 'ink on tab bar glass over base', fg: colors.ink, bg: colors.glassTabBar, over: colors.base, kind: 'text' },
  { name: 'ink on glass card over base', fg: colors.ink, bg: colors.glass, over: colors.base, kind: 'text' },
  { name: 'ink on sheet over base + scrim', fg: colors.ink, bg: colors.glassSheet, over: [colors.base, colors.scrimStrong], kind: 'text' },
  { name: 'primary icon on tab bar', fg: colors.primary, bg: colors.glassTabBar, over: colors.base, kind: 'icon' },
  { name: 'inkMuted icon on tab bar', fg: colors.inkMuted, bg: colors.glassTabBar, over: colors.base, kind: 'icon' },

  // ---- Dark Surfaces (Call Screen, Toast, Incoming Call) ----
  { name: 'white on night', fg: colors.onNight, bg: colors.night, kind: 'text' },
  { name: 'ice on night', fg: colors.onNightMuted, bg: colors.night, kind: 'text' },
  { name: 'white on night glass over ink', fg: colors.onNight, bg: colors.glassNight, over: palette.ink, kind: 'text' },
  { name: 'white on night control', fg: colors.onNight, bg: tints.white, over: colors.night, kind: 'text' },
  { name: 'success icon on night', fg: colors.success, bg: colors.night, kind: 'icon' },
  { name: 'warning icon on night', fg: colors.warning, bg: colors.night, kind: 'icon' },
  { name: 'danger icon on night', fg: colors.danger, bg: colors.night, kind: 'icon' },
];
