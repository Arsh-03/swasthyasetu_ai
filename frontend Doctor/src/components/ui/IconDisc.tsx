import { cx } from './cx';
import { Icon, type IconName, type IconTone } from './Icon';

export type DiscTone = Extract<IconTone, 'primary' | 'teal' | 'navy' | 'success' | 'warning' | 'danger' | 'gold' | 'muted'>;

interface IconDiscProps {
  icon: IconName;
  tone?: DiscTone;
  size?: number;
  variant?: 'raised' | 'inset';
  shape?: 'circle' | 'square';
  active?: boolean;
  label?: string;
  className?: string;
}

const TONE_BG: Record<DiscTone, string> = {
  primary: 'bg-primary-tint border-primary-tint',
  teal: 'bg-teal-tint border-teal-tint',
  navy: 'bg-navy-tint border-navy-tint',
  success: 'bg-success-tint border-success-tint',
  warning: 'bg-warning-tint border-warning-tint',
  danger: 'bg-danger-tint border-danger-tint',
  gold: 'bg-gold-tint border-gold-tint',
  muted: 'bg-ink-tint border-hairline',
};

/**
 * Clean icon disc: subtle tint background, 1px border and duotone glyph (≥ 3:1).
 */
export function IconDisc({
  icon,
  tone = 'primary',
  size = 40,
  shape = 'circle',
  active = true,
  label,
  className,
}: IconDiscProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center border',
        shape === 'circle' ? 'rounded-full' : 'rounded-tight',
        TONE_BG[tone],
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.52)}
        tone={tone}
        weight={active ? 'duotone' : 'regular'}
        label={label}
      />
    </span>
  );
}

interface EmbossedIconProps {
  icon: IconName;
  size?: number;
  tone?: Extract<IconTone, 'primary' | 'ink' | 'success' | 'warning' | 'danger'>;
  className?: string;
}

/**
 * EmbossedIcon compatibility: rendered as clean crisp glyph without drop shadows.
 */
export function EmbossedIcon({ icon, size = 48, tone = 'primary', className }: EmbossedIconProps) {
  const s = Math.max(32, size);
  return (
    <span aria-hidden className={cx('inline-block shrink-0', className)}>
      <Icon name={icon} size={s} tone={tone} weight="duotone" />
    </span>
  );
}
