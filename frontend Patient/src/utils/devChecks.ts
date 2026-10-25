import { contrastRatio } from '../theme/contrast';

const warned = new Set<string>();

/**
 * Development-only guard against invisible icons: warns (once per combination) when an
 * icon's colour equals its surface, is transparent / missing, or is below 3:1 against it.
 * No-op in production builds.
 */
export const checkIconContrast = (name: string, color: string | undefined, surface: string | undefined) => {
  if (!__DEV__ || !surface) return;
  const key = `${name}|${color}|${surface}`;
  if (warned.has(key)) return;

  let problem: string | null = null;
  if (!color || color === 'transparent') {
    problem = 'has no visible colour';
  } else if (color.toLowerCase() === surface.toLowerCase()) {
    problem = 'is the same colour as its surface';
  } else {
    try {
      const ratio = contrastRatio(color, surface);
      if (ratio < 3) problem = `has ${ratio.toFixed(2)}:1 contrast against its surface (needs ≥ 3:1)`;
    } catch {
      // Unparseable colour (e.g. a named colour): skip the ratio check
    }
  }
  if (problem) {
    warned.add(key);
    console.warn(`[Icon] "${name}" ${problem}. colour=${color} surface=${surface}`);
  }
};
