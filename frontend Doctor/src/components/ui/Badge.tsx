import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { TONE_CLASS, type Tone } from './tones';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  /** Small status dot instead of an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Status pill (informational → soft inset edge): icon + status colour + one short word.
 * Gold is reserved for "verified".
 */
export function Badge({ label, tone = 'primary', icon, dot, size = 'sm', className }: BadgeProps) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        'border border-(--neu-inset-dark-soft) border-r-(--neu-light-inset-soft) border-b-(--neu-light-inset-soft)',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-footnote',
        t.pill,
        className,
      )}
    >
      {dot && <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', t.dot)} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} tone={t.icon} weight="duotone" />}
      <span className="truncate">{label}</span>
    </span>
  );
}

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon?: IconName;
  /** Selected filter = inset + primary label + duotone icon. */
  selected: boolean;
  count?: number;
}

/** Filter chip: STRONG raised (compact), latches to inset when selected. 36px target. */
export function Chip({ label, icon, selected, count, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'neu-raised-sm neu-press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-footnote',
        selected ? 'font-bold text-primary' : 'font-medium text-ink',
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
