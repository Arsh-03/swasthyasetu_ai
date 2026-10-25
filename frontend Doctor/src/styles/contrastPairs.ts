/**
 * Every text / icon / focus-ring on background combination used by the tokens, the UI kit, the
 * Style Guide and the migrated screens. Built from the parsed tokens.css, so the CSS stays the
 * single source of truth. Checked by `npm run check:contrast` and shown in the dev Style Guide.
 * Import-free apart from contrast.ts (Node runs it directly).
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

  const TEXT_ROLES = ['ink', 'ink-muted', 'primary', 'success-deep', 'warning-deep', 'danger-deep', 'gold-deep'];
  const blobs = { ice: t['ambient-ice'], primarySoft: t['ambient-primary-soft'], sand: t['ambient-sand'] };

  // ---- Flat surfaces (canvas, cards, chips) ----
  const FLAT = { base: c('base'), card: c('card'), sand: c('sand') };
  for (const [s, bg] of Object.entries(FLAT))
    for (const role of TEXT_ROLES) add('Surfaces', `${role} on ${s}`, c(role), bg, 'text');
  for (const [n, blob] of Object.entries(blobs)) {
    add('Surfaces', `ink-muted on canvas over ${n} blob`, c('ink-muted'), blob, 'text', c('base'));
    add('Surfaces', `primary on canvas over ${n} blob`, c('primary'), blob, 'text', c('base'));
  }
  add('Surfaces', 'ink-muted on base/70 over card', c('ink-muted'), withAlpha(c('base'), 0.7), 'text', c('card'));
  add('Surfaces', 'ink on fog (control fill)', c('ink'), c('fog'), 'text');
  add('Surfaces', 'ink on fog/70 over card', c('ink'), withAlpha(c('fog'), 0.7), 'text', c('card'));
  add('Surfaces', 'ink-muted tab on fog/40 track over card', c('ink-muted'), withAlpha(c('fog'), 0.4), 'text', c('card'));
  add('Surfaces', 'ink-muted tab on fog/40 track over toolbar', c('ink-muted'), withAlpha(c('fog'), 0.4), 'text', [c('base'), c('glass-toolbar')]);
  add('Surfaces', 'ink on warning/10 over card (banner)', c('ink'), withAlpha(c('warning'), 0.1), 'text', c('card'));
  add('Surfaces', 'ink-muted on ink/5 over card (chip)', c('ink-muted'), withAlpha(c('ink'), 0.05), 'text', c('card'));

  // ---- Depth surfaces, worst (darkest) point of each gradient ----
  const DEPTH = {
    'raised strong': t['neu-raised-lo'],
    'raised soft panel': t['neu-raised-soft-lo'],
    'inset strong': t['neu-inset-hi'],
    'inset soft well': t['neu-inset-soft-hi'],
  };
  for (const [s, bg] of Object.entries(DEPTH))
    for (const role of TEXT_ROLES.slice(0, 6)) add('Depth', `${role} on ${s}`, c(role), bg, 'text');
  // Glyphs sit ≥ 12px inside an inset, where the inner shadow leaves a ~25% residual
  const insetGlyph = { bg: t['neu-inset-residual'], over: t['neu-inset-hi'] };
  add('Depth', 'ink-inset placeholder / idle icon in inset', c('ink-inset'), insetGlyph.bg, 'text', insetGlyph.over);
  add('Depth', 'ink input text in inset', c('ink'), insetGlyph.bg, 'text', insetGlyph.over);
  add('Depth', 'primary focus icon in inset', c('primary'), insetGlyph.bg, 'icon', insetGlyph.over);
  add('Depth', 'ink-muted on disabled control (base)', c('ink-muted'), c('base'), 'text');

  // ---- Icon tones (IconDisc raised / inset, plain icons on panels) ----
  const TONE_GLYPH = { primary: 'primary', success: 'success-deep', warning: 'warning-deep', danger: 'danger-deep', gold: 'gold-deep', neutral: 'ink-muted' };
  for (const [tone, role] of Object.entries(TONE_GLYPH)) {
    add('Icons', `${tone} glyph on raised disc`, c(role), t['neu-raised-lo'], 'icon');
    add('Icons', `${tone} glyph on inset disc`, c(role), t['neu-inset-soft-hi'], 'icon');
    add('Icons', `${tone} glyph on card`, c(role), c('card'), 'icon');
  }
  add('Icons', 'EmbossedIcon primary on base', c('primary'), c('base'), 'icon');
  add('Icons', 'EmbossedIcon danger-deep on panel', c('danger-deep'), t['neu-raised-soft-lo'], 'icon');

  // ---- Status tints (bg-*-tint, Patient V2.1 values) behind deep text, plus the hover step used on cards ----
  const TINT = { primary: 'primary', success: 'success-deep', warning: 'warning-deep', danger: 'danger-deep', gold: 'gold-deep', ink: 'ink-muted' };
  for (const [tone, text] of Object.entries(TINT)) {
    const tint = c(`${tone}-tint`);
    add('Tints', `${text} on ${tone}-tint over panel`, c(text), tint, 'text', t['neu-raised-soft-lo']);
    add('Tints', `${text} on ${tone}-tint over canvas`, c(text), tint, 'text', c('base'));
    add('Tints', `${text} on ${tone}-tint over card`, c(text), tint, 'text', c('card'));
  }
  for (const [fill, text, pct] of [['primary', 'primary', 10], ['danger', 'danger-deep', 10], ['success', 'success-deep', 15]] as const)
    add('Tints', `${text} on hover ${fill}/${pct} over card`, c(text), withAlpha(c(fill), pct / 100), 'text', c('card'));
  add('Tints', 'audio badge text', c('audio-text'), c('audio-bg'), 'text');

  // ---- Solid fills with white labels (buttons, critical actions) ----
  const SOLID = ['primary', 'primary-deep', 'success-deep', 'success-pressed', 'warning-deep', 'danger-deep', 'danger-pressed', 'night', 'ink'];
  for (const s of SOLID) add('Solid fills', `white on ${s}`, c('on-primary'), c(s), 'text');
  for (const [tone, fill] of [['primary', 'primary'], ['success', 'success-deep'], ['danger', 'danger-deep']]) {
    add('Critical', `white on critical ${tone} under sheen`, c('on-primary'), t['critical-sheen'], 'text', c(fill));
  }
  for (const [tone, pressed] of [['primary', 'primary-deep'], ['success', 'success-pressed'], ['danger', 'danger-pressed']]) {
    add('Critical', `white on critical ${tone} pressed (inset corner)`, c('on-primary'), t['critical-inset-dark'], 'text', c(pressed));
  }
  add('Critical', 'ink on critical disabled (primary-soft)', c('ink'), c('primary-soft'), 'text');
  add('Solid fills', 'white on warning-deep/90 over card (hover)', c('on-primary'), withAlpha(c('warning-deep'), 0.9), 'text', c('card'));

  // ---- Glass: ink only, worst case over each ambient blob ----
  for (const [n, blob] of Object.entries(blobs)) {
    add('Glass', `ink on glass card over ${n}`, c('ink'), c('glass'), 'text', [c('base'), blob]);
    add('Glass', `ink on toolbar / sidebar glass over ${n}`, c('ink'), c('glass-toolbar'), 'text', [c('base'), blob]);
    add('Glass', `ink on sheet over ${n} + strong scrim`, c('ink'), c('glass-sheet'), 'text', [c('base'), blob, c('scrim-strong')]);
    add('Glass', `primary icon on toolbar glass over ${n}`, c('primary'), c('glass-toolbar'), 'icon', [c('base'), blob]);
  }

  // ---- Dark surfaces (call screen, video tiles, login panel) ----
  add('Night', 'white on night', c('white'), c('night'), 'text');
  add('Night', 'ice on night', c('ice'), c('night'), 'text');
  add('Night', 'white/70 on night', withAlpha(c('white'), 0.7), c('night'), 'text');
  add('Night', 'white/60 on night', withAlpha(c('white'), 0.6), c('night'), 'text');
  add('Night', 'white on night/70 over card (video overlay, worst case)', c('white'), withAlpha(c('night'), 0.7), 'text', c('card'));
  add('Night', 'white on white/15 over night (dark control)', c('white'), withAlpha(c('white'), 0.15), 'text', c('night'));
  add('Night', 'white on glass-night over ink', c('white'), c('glass-night'), 'text', c('ink'));
  add('Night', 'success text / icon on night', c('success'), c('night'), 'text');
  add('Night', 'warning icon on night', c('warning'), c('night'), 'icon');
  add('Night', 'danger icon on night', c('danger'), c('night'), 'icon');

  // ---- Focus ring (non-text, 3:1 against what is next to it) ----
  for (const [s, bg] of Object.entries({ base: c('base'), card: c('card'), 'raised strong': t['neu-raised-lo'], 'inset strong': t['neu-inset-hi'] }))
    add('Focus', `primary ring on ${s}`, c('primary'), bg, 'icon');
  add('Focus', 'ice ring on night', c('ice'), c('night'), 'icon');

  return pairs;
};
