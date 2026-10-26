import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { TONE_CLASS, type Tone } from './tones';

interface BadgeProps {
  label?: string;
  children?: ReactNode;
  tone?: Tone;
  icon?: IconName;
  /** Small status dot instead of an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Status pill: tinted pill with deep text (≥ 4.5:1).
 */
export function Badge({ label, children, tone = 'primary', icon, dot, size = 'sm', className }: BadgeProps) {
  const t = TONE_CLASS[tone];
  const content = label ?? children;
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full font-semibold whitespace-nowrap border border-transparent',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-footnote',
        t.pill,
        className,
      )}
    >
      {dot && <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', t.dot)} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} tone={t.icon} weight="duotone" />}
      <span className="truncate">{content}</span>
    </span>
  );
}

export const StatusChip = Badge;

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon?: IconName;
  selected: boolean;
  count?: number;
}

/** Filter chip: white surface with 1px border; selected = tonal ice fill + primary text. */
export function Chip({ label, icon, selected, count, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-footnote border transition-colors',
        selected
          ? 'bg-ice border-primary text-primary font-bold'
          : 'bg-card border-card-border text-ink hover:bg-base font-medium',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} weight={selected ? 'duotone' : 'regular'} />}
      <span>{label}</span>
      {count !== undefined && <span className="font-mono text-2xs text-ink-muted">{count}</span>}
    </button>
  );
}
