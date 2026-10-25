import { REGISTRY, type IconName } from './iconRegistry';

export type { IconName };

/** Semantic colour of the glyph. Status tones use their *Deep variant (≥ 3:1 on every surface). */
export type IconTone = 'inherit' | 'ink' | 'muted' | 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'onPrimary' | 'ice';

const ICON_TONE_CLASS: Record<IconTone, string> = {
  inherit: '',
  ink: 'text-ink',
  muted: 'text-ink-muted',
  primary: 'text-primary',
  success: 'text-success-deep',
  warning: 'text-warning-deep',
  danger: 'text-danger-deep',
  gold: 'text-gold-deep',
  onPrimary: 'text-on-primary',
  ice: 'text-ice',
};

export interface IconProps {
  name: IconName;
  /** px; default 20 */
  size?: number;
  /** Default `inherit` (currentColor), so icons inside buttons follow the label colour. */
  tone?: IconTone;
  /** regular = inactive, duotone = active / emphasis. */
  weight?: 'regular' | 'duotone';
  className?: string;
  /** Only for meaningful standalone icons. Decorative icons (the default) are hidden from assistive tech. */
  label?: string;
}

export function Icon({ name, size = 20, tone = 'inherit', weight = 'regular', className = '', label }: IconProps) {
  const Glyph = REGISTRY[name];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const, focusable: 'false' as const };
  return (
    <Glyph
      size={size}
      weight={weight}
      color="currentColor"
      className={`shrink-0 ${ICON_TONE_CLASS[tone]} ${className}`.trim()}
      {...a11y}
    />
  );
}
