import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import type { Domain } from './tones';

export interface IconTileProps {
  /** Domain orientation category */
  domain?: Domain;
  icon: IconName;
  /** px, default 40 */
  size?: number;
  shape?: 'circle' | 'square';
  active?: boolean;
  label?: string;
  className?: string;
}

const DOMAIN_STYLES: Record<Domain, { bg: string; iconTone: 'primary' | 'teal' | 'navy' | 'gold' | 'warning' | 'danger' }> = {
  appointments: { bg: 'bg-primary-tint border-primary-tint', iconTone: 'primary' },
  medications: { bg: 'bg-teal-tint border-teal-tint', iconTone: 'teal' },
  records: { bg: 'bg-gold-tint border-gold-tint', iconTone: 'gold' },
  privacy: { bg: 'bg-navy-tint border-navy-tint', iconTone: 'navy' },
  followup: { bg: 'bg-warning-tint border-warning-tint', iconTone: 'warning' },
  emergency: { bg: 'bg-danger-tint border-danger-tint', iconTone: 'danger' },
};

/**
 * Domain-coloured icon tile: ~12% tint fill + duotone glyph in domain's deep colour (≥ 3:1).
 * Standard across doctor and patient apps.
 */
export function IconTile({
  domain = 'appointments',
  icon,
  size = 40,
  shape = 'square',
  active = true,
  label,
  className,
}: IconTileProps) {
  const d = DOMAIN_STYLES[domain];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center border',
        shape === 'circle' ? 'rounded-full' : 'rounded-tight',
        d.bg,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.52)}
        tone={d.iconTone}
        weight={active ? 'duotone' : 'regular'}
        label={label}
      />
    </span>
  );
}
