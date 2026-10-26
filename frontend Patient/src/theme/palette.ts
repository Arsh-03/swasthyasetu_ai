/**
 * "Harbor Calm" palette: the single source of truth for raw colour values.
 * Clean surface system: crisp white cards, light canvas (#F2F5F8), domain colours,
 * no neumorphism, high-contrast WCAG AA throughout.
 * Keep this file import-free: scripts/contrast-check.ts loads it directly with Node.
 */
export const palette = {
  // Base canvas & neutral surfaces
  ink: '#1F3A4C',
  inkMuted: '#576771', // secondary text, ≥ 4.5:1 on base, card and domain tints
  base: '#F2F5F8',     // light, clean page canvas
  card: '#FFFFFF',     // pure white card surface
  cardBorder: '#DCE5EA', // 1px subtle separation border
  inputBorder: '#728A97', // 1px input border (3.62:1 vs white, 3.31:1 vs base)
  white: '#FFFFFF',
  night: '#13242F',    // immersive dark surface (calls)

  // Primary brand / action
  primary: '#3E6985',
  primaryPressed: '#335870',
  primaryDeep: '#335870', // solid primary hover/pressed, deep text
  primarySoft: '#8FA8B5', // fill/border only, disabled fill
  fog: '#C7D6DB',         // fill/border only
  ice: '#D6EBF3',         // tonal button fill, selected row background

  // Domain orientation colours (and semantic roles)
  // 1. Appointments & calls: primary
  // 2. Medications: teal (#407E8C)
  teal: '#407E8C',
  tealDeep: '#215661',    // text & icon on teal tint (7.07:1 on tint)
  // 3. Privacy & DPDP consent: navy (#083A4F)
  navy: '#083A4F',
  navyDeep: '#083A4F',    // text & icon on navy tint (9.73:1 on tint)
  // 4. Records locker: gold / sand tint
  sand: '#EDEBE4',
  gold: '#A58D66',
  goldDeep: '#756245',    // text & icon on gold tint (5.20:1 on tint)
  // 5. Follow-up: warning amber
  warning: '#E0953A',
  warningDeep: '#8E5816', // text & icon on warning tint (5.33:1 on tint)
  // 6. Emergency & SOS: danger
  danger: '#D64545',
  dangerDeep: '#C02A2A',  // text & icon on danger tint (4.96:1 on tint)
  dangerPressed: '#A32424',

  // Status success (approvals, verified)
  success: '#2F9E6E',
  successDeep: '#22714F', // solid success fill, text on success tint
  successPressed: '#1B5C40',

  // Accessibility rule (kept from V1): high-contrast audio badge
  audioBg: '#ECFDF5',
  audioText: '#047857',
} as const;

export type PaletteKey = keyof typeof palette;

/** `rgba()` of a palette hex at the given alpha, for tints and translucent fills. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
