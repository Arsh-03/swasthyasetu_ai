/**
 * WCAG 2.x contrast helpers and the list of colour pairs the app actually uses.
 * Shared by scripts/contrast-check.ts (CI-style check) and the dev Style Guide.
 * Import-free on purpose so Node can run it with type stripping.
 */

type Rgba = [number, number, number, number];

const parse = (c: string): Rgba => {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unsupported colour: ${c}`);
  const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
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

export type PairKind = 'text' | 'large' | 'icon';

export interface ContrastPair {
  name: string;
  fg: string;
  /** Background. Translucent backgrounds are flattened onto `over`. */
  bg: string;
  /** What sits underneath `bg`: one opaque colour, or a stack (bottom first) such as base → ambient blob → scrim. */
  over?: string | string[];
  kind: PairKind;
}

/** Text needs 4.5:1; large text (≥ 24px, or ≥ 18.5px bold) and icons need 3:1. */
export const requiredRatio = (kind: PairKind) => (kind === 'text' ? 4.5 : 3);

export const evaluate = (p: ContrastPair) => {
  const under = p.over === undefined ? [] : Array.isArray(p.over) ? p.over : [p.over];
  const bg = under.length ? flatten([...under, p.bg]) : p.bg;
  const ratio = contrastRatio(p.fg, bg);
  return { ...p, ratio, pass: ratio >= requiredRatio(p.kind) };
};
