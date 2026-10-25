/**
 * WCAG 2.x contrast helpers (same maths as frontend Patient/src/theme/contrast.ts).
 * Import-free so Node can run it directly (type stripping) from scripts/check-contrast.ts.
 */

type Rgba = [number, number, number, number];

const parse = (c: string): Rgba => {
  const s = c.trim();
  if (s.startsWith('#')) {
    const n = parseInt(s.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unsupported colour: ${c}`);
  const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
};

/** Translucent version of a colour, the same as a Tailwind opacity modifier (`bg-success/15`). */
export const withAlpha = (c: string, a: number) => {
  const [r, g, b] = parse(c);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Flatten a translucent colour onto an opaque background. */
export const composite = (fg: string, bg: string): string => {
  const [r, g, b, a] = parse(fg);
  const [br, bgG, bb] = parse(bg);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r, br)}, ${mix(g, bgG)}, ${mix(b, bb)})`;
};

/** Flatten a stack of layers, bottom (opaque) first. */
export const flatten = (layers: string[]) => layers.slice(1).reduce((acc, layer) => composite(layer, acc), layers[0]);

const luminance = (c: string) => {
  const [r, g, b] = parse(c).map((v, i) => {
    if (i === 3) return v;
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (fg: string, bg: string) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** text = 4.5:1; large text (≥ 24px, or ≥ 18.5px bold) and icons / focus rings / UI parts = 3:1. */
export type PairKind = 'text' | 'large' | 'icon';

export interface ContrastPair {
  group: string;
  name: string;
  fg: string;
  /** Background. Translucent layers are flattened onto `over` (bottom first). */
  bg: string;
  over?: string | string[];
  kind: PairKind;
}

export const requiredRatio = (kind: PairKind) => (kind === 'text' ? 4.5 : 3);

export const evaluate = (p: ContrastPair) => {
  const under = p.over === undefined ? [] : Array.isArray(p.over) ? p.over : [p.over];
  const bg = under.length ? flatten([...under, p.bg]) : p.bg;
  // A translucent foreground (e.g. text-white/70) is flattened onto its own background
  const fg = p.fg.startsWith('rgba') ? composite(p.fg, bg) : p.fg;
  const ratio = contrastRatio(fg, bg);
  return { ...p, ratio, pass: ratio >= requiredRatio(p.kind) };
};

/**
 * Read `--name: value;` declarations (hex / rgb / rgba only) from tokens.css.
 * Keys drop the leading dashes: `--color-ink` → `color-ink`, `--neu-raised-lo` → `neu-raised-lo`.
 */
export const parseTokens = (css: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6}|rgba?\([^)]*\))\s*;/g)) out[m[1]] = m[2];
  return out;
};
