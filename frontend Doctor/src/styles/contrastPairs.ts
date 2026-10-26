/**
 * Every text / icon / focus-ring on background combination used by the clean tokens,
 * the UI kit, the Style Guide and the screens.
 * Built from the parsed tokens.css (single source of truth).
 * Checked by `npm run check:contrast` and shown in the dev Style Guide.
 */
import { withAlpha, type ContrastPair } from './contrast.ts';

export const buildContrastPairs = (t: Record<string, string>): ContrastPair[] => {
  const c = (name: string) => {
    const v = t[`color-${name}`] ?? t[name];
    if (!v) throw new Error(`Unknown token: ${name}`);
    return v;
  };
  const pairs: ContrastPair[] = [];
  const add = (group: string, name: string, fg: string, bg: string, kind: ContrastPair['kind'], over?: string | string[]) =>
    pairs.push({ group, name, fg, bg, kind, over });

  const TEXT_ROLES = [
    'ink',
    'ink-muted',
    'primary',
    'primary-deep',
    'teal-deep',
    'navy-deep',
    'success-deep',
    'warning-deep',
    'danger-deep',
    'gold-deep',
  ];

  // ---- Clean Surfaces: Canvas (base #F2F5F8) & Card (#FFFFFF) ----
  const SURFACES = { base: c('base'), card: c('card') };
  for (const [s, bg] of Object.entries(SURFACES)) {
    for (const role of TEXT_ROLES) {
      add('Surfaces', `${role} on ${s}`, c(role), bg, 'text');
    }
  }

  // Tonal secondary button (ice fill)
  add('Surfaces', 'primary on ice (tonal button)', c('primary'), c('ice'), 'text');
  add('Surfaces', 'primary-deep on ice (tonal active)', c('primary-deep'), c('ice'), 'text');

  // Input & card borders against surroundings (>= 3:1 for input border)
  add('Surfaces', 'input-border on card (surroundings)', c('input-border'), c('card'), 'icon');
  add('Surfaces', 'input-border on base (surroundings)', c('input-border'), c('base'), 'icon');

  // ---- Domain Orientation Colours: Tint Fills + Deep Text & Icons ----
  // Domain rules:
  // Status chips = tinted pills with deep text (>= 4.5:1)
  // Icon tiles = tint fill + glyph in domain's deep colour (>= 3:1)
  const DOMAINS = [
    { domain: 'appointments', textRole: 'primary-deep', iconRole: 'primary-deep', tint: c('primary-tint') },
    { domain: 'medications', textRole: 'teal-deep', iconRole: 'teal-deep', tint: c('teal-tint') },
    { domain: 'records', textRole: 'gold-deep', iconRole: 'gold-deep', tint: c('gold-tint') },
    { domain: 'privacy', textRole: 'navy-deep', iconRole: 'navy-deep', tint: c('navy-tint') },
    { domain: 'followup', textRole: 'warning-deep', iconRole: 'warning-deep', tint: c('warning-tint') },
    { domain: 'emergency', textRole: 'danger-deep', iconRole: 'danger-deep', tint: c('danger-tint') },
    { domain: 'success', textRole: 'success-deep', iconRole: 'success-deep', tint: c('success-tint') },
    { domain: 'neutral', textRole: 'ink-muted', iconRole: 'ink-muted', tint: c('ink-tint') },
  ];

  for (const d of DOMAINS) {
    // Over card (most common surface)
    add('Domain Chips', `${d.domain} chip text on card`, c(d.textRole), d.tint, 'text', c('card'));
    add('Domain Chips', `${d.domain} chip text on base`, c(d.textRole), d.tint, 'text', c('base'));
    add('Domain Tiles', `${d.domain} tile icon on card`, c(d.iconRole), d.tint, 'icon', c('card'));
    add('Domain Tiles', `${d.domain} tile icon on base`, c(d.iconRole), d.tint, 'icon', c('base'));
  }

  // Accessibility audio badge
  add('Domain Chips', 'audio badge text', c('audio-text'), c('audio-bg'), 'text');

  // ---- Solid Fills & Critical Actions (flat solid deep colour with white label >= 4.5:1) ----
  const SOLID_FILLS = [
    'primary',
    'primary-deep',
    'teal-deep',
    'navy-deep',
    'success-deep',
    'success-pressed',
    'warning-deep',
    'danger-deep',
    'danger-pressed',
    'night',
    'ink',
  ];
  for (const s of SOLID_FILLS) {
    add('Solid Buttons', `white on ${s}`, c('on-primary'), c(s), 'text');
  }

  // Critical button flat actions
  add('Critical Actions', 'white on critical primary (join call)', c('on-primary'), c('primary'), 'text');
  add('Critical Actions', 'white on critical success (approve consent)', c('on-primary'), c('success-deep'), 'text');
  add('Critical Actions', 'white on critical danger (SOS / decline / end call)', c('on-primary'), c('danger-deep'), 'text');
  add('Critical Actions', 'white on critical danger pressed', c('on-primary'), c('danger-pressed'), 'text');
  add('Critical Actions', 'ink on critical disabled (primary-soft)', c('ink'), c('primary-soft'), 'text');

  // ---- Glass Surfaces: Subtle blur + fill ~0.8, ink text >= 4.5:1 ----
  add('Glass', 'ink on glass over base', c('ink'), c('glass'), 'text', c('base'));
  add('Glass', 'ink on toolbar glass over base', c('ink'), c('glass-toolbar'), 'text', c('base'));
  add('Glass', 'ink on sheet over base + scrim', c('ink'), c('glass-sheet'), 'text', [c('base'), c('scrim-strong')]);
  add('Glass', 'primary icon on toolbar glass', c('primary'), c('glass-toolbar'), 'icon', c('base'));

  // ---- Dark Surfaces (Call Screen / Video Tile) ----
  add('Night', 'white on night', c('white'), c('night'), 'text');
  add('Night', 'ice on night', c('ice'), c('night'), 'text');
  add('Night', 'white/70 on night', withAlpha(c('white'), 0.7), c('night'), 'text');
  add('Night', 'white on glass-night over ink', c('white'), c('glass-night'), 'text', c('ink'));
  add('Night', 'success text / icon on night', c('success'), c('night'), 'text');
  add('Night', 'warning icon on night', c('warning'), c('night'), 'icon');
  add('Night', 'danger icon on night', c('danger'), c('night'), 'icon');

  // ---- Focus Ring (≥ 3:1 against surrounding card & base) ----
  add('Focus', 'primary ring on card', c('primary'), c('card'), 'icon');
  add('Focus', 'primary ring on base', c('primary'), c('base'), 'icon');
  add('Focus', 'ice ring on night', c('ice'), c('night'), 'icon');

  return pairs;
};
