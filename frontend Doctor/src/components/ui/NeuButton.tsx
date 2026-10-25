import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** `md` = 44px (default), `sm` = 36px (clinician density minimum). */
  size?: 'sm' | 'md';
  /** `default` = ink label, `primary` = primary label (the main action of a group). */
  tone?: 'default' | 'primary';
  icon?: IconName;
  /** Latched state (filters, toggles): shown as inset + duotone primary icon. */
  pressed?: boolean;
};

/** An icon-only button must carry an aria-label (enforced by the type). */
export type NeuButtonProps =
  | (Base & { children: ReactNode })
  | (Base & { children?: undefined; icon: IconName; 'aria-label': string });

const SIZE = {
  sm: { box: 'min-h-9 px-3 gap-1.5 text-footnote', square: 'size-9', icon: 16 },
  md: { box: 'min-h-11 px-4 gap-2 text-sm', square: 'size-11', icon: 18 },
} as const;

/**
 * STRONG raised control. Hover lifts 1px, active and `pressed` go inset (utilities.css `.neu-press`).
 * Affordance never relies on shadow alone: pressed also turns the icon duotone + primary.
 */
export function NeuButton({ size = 'md', tone = 'default', icon, pressed, className, children, type = 'button', ...rest }: NeuButtonProps) {
  const s = SIZE[size];
  const iconOnly = children === undefined;
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        'neu-raised-sm neu-press inline-flex items-center justify-center rounded-control font-semibold select-none',
        iconOnly ? s.square : s.box,
        tone === 'primary' || pressed ? 'text-primary' : 'text-ink',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={s.icon} weight={pressed || tone === 'primary' ? 'duotone' : 'regular'} />}
      {children}
    </button>
  );
}
