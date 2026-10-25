/**
 * "Harbor Calm" palette: the only place raw colour values live.
 * Base hex values are the approved design decision; `*Deep` values are derived
 * (same hue, darker) so text and white-on-fill buttons reach WCAG AA.
 * Keep this file import-free: scripts/contrast-check.ts loads it directly with Node.
 */
export const palette = {
  // Approved base palette
  ink: '#1F3A4C',
  primary: '#3E6985',
  primarySoft: '#8FA8B5', // fill / border only, never text
  fog: '#C7D6DB', // fill / border only, never text
  ice: '#D6EBF3',
  base: '#EAF0F4',
  card: '#F7F9FA',
  sand: '#EDEBE4',
  gold: '#A58D66', // verified badges only
  success: '#2F9E6E',
  warning: '#E0953A',
  danger: '#D64545',

  // Derived for contrast (see docs/05_ui_ux/design_system_tokens.md)
  inkMuted: '#576771', // secondary text
  inkInset: '#525F68', // placeholder / leading icon inside strong insets (4.76:1 at the darkest point)
  primaryPressed: '#335870', // pressed solid primary
  successDeep: '#22714F', // success text, solid success fill
  warningDeep: '#8E5816', // warning text and icons
  dangerDeep: '#C02A2A', // danger text, solid danger fill (SOS, decline)
  dangerPressed: '#A32424',
  goldDeep: '#756245', // verified badge text / icon
  night: '#13242F', // immersive call screen, dark glass
  white: '#FFFFFF',

  // Accessibility rule (kept from V1): high-contrast audio badge
  audioBg: '#ECFDF5',
  audioText: '#047857',

  // Critical (solid) pressed fills
  successPressed: '#1B5C40',

  // Neumorphism: light source top-left. STRONG = controls, SOFT (~58%) = panels, wells, rows.
  neuRaisedHi: '#F4F8FA', // raised fill, top-left
  neuRaisedLo: '#E3EAEF', // raised fill, bottom-right
  neuRaisedSoftHi: '#F2F6F8',
  neuRaisedSoftLo: '#E6EDF1',
  neuInsetHi: '#DFE7EC', // inset fill, top-left (darker)
  neuInsetLo: '#F2F6F8', // inset fill, bottom-right (lighter)
  neuInsetSoftHi: '#E3EAEF',
  neuInsetSoftLo: '#EFF4F6',
  neuDark: 'rgba(86, 116, 136, 0.42)', // raised outer shadow, strong
  neuDarkSoft: 'rgba(86, 116, 136, 0.24)', // raised outer shadow, soft
  neuInsetDark: 'rgba(86, 116, 136, 0.35)', // inset inner shadow, strong
  neuInsetDarkSoft: 'rgba(86, 116, 136, 0.2)',
  neuInsetClear: 'rgba(86, 116, 136, 0)',
  neuInsetResidual: 'rgba(86, 116, 136, 0.09)', // ~25% of the inner shadow where glyphs sit (≥ 12px in)
  neuLight: '#FFFFFF',
  neuLightSoft: 'rgba(255, 255, 255, 0.6)',
  neuLightInset: 'rgba(255, 255, 255, 0.9)',
  neuLightInsetSoft: 'rgba(255, 255, 255, 0.55)',
  neuLightClear: 'rgba(255, 255, 255, 0)',
  neuGrooveDark: 'rgba(86, 116, 136, 0.25)',
  neuGrooveLight: 'rgba(255, 255, 255, 0.9)',

  // Highlight sheen on solid critical buttons (kept low so white labels stay ≥ 4.5:1)
  criticalSheen: 'rgba(255, 255, 255, 0.08)',
  criticalSheenClear: 'rgba(255, 255, 255, 0)',
  criticalInsetDark: 'rgba(19, 36, 47, 0.32)', // pressed inner shadow on solid fills
  criticalInsetClear: 'rgba(19, 36, 47, 0)',
  criticalEdgeLight: 'rgba(255, 255, 255, 0.45)',

  // Glass specular edge and inner top highlight
  specularHi: 'rgba(255, 255, 255, 0.9)',
  specularLo: 'rgba(255, 255, 255, 0.2)',
  glassHighlight: 'rgba(255, 255, 255, 0.35)',
  glassHighlightClear: 'rgba(255, 255, 255, 0)',
} as const;

export type PaletteKey = keyof typeof palette;

/** `rgba()` of a palette hex at the given alpha, for tints and translucent fills. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
