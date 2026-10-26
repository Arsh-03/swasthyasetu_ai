import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** `md` = 44px (default), `sm` = 36px (clinician density minimum). */
  size?: 'sm' | 'md';
  /** variant: `primary` = solid, `secondary` = tonal (ice fill), `tertiary` = text */
  variant?: 'primary' | 'secondary' | 'tertiary';
  /** backwards compatibility for tone */
  tone?: 'default' | 'primary' | 'secondary' | 'tertiary';
  icon?: IconName;
  /** Latched state (filters, toggles): shown as active + duotone primary icon. */
  pressed?: boolean;
};

export type NeuButtonProps =
  | (Base & { children: ReactNode })
  | (Base & { children?: undefined; icon: IconName; 'aria-label': string });

const SIZE = {
  sm: { box: 'min-h-9 px-3 gap-1.5 text-footnote', square: 'size-9', icon: 16 },
  md: { box: 'min-h-11 px-4 gap-2 text-sm', square: 'size-11', icon: 18 },
} as const;

/**
 * Clean Button:
 * primary = solid primary with white text (≥ 5.89:1)
 * secondary = tonal ice fill with primary text (≥ 4.78:1)
 * tertiary = text-only button
 * pressed = scale 0.98 + darker
 */
export function NeuButton({
  size = 'md',
  variant,
  tone = 'default',
  icon,
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: NeuButtonProps) {
  const s = SIZE[size];
  const iconOnly = children === undefined;
  const isPrimary = variant === 'primary' || (tone === 'primary' && !variant);
  const isSecondary = variant === 'secondary' || (tone === 'default' && !variant && !pressed);
  const isTertiary = variant === 'tertiary';

  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        'surface-press inline-flex items-center justify-center rounded-control font-semibold select-none cursor-pointer border transition-colors',
        iconOnly ? s.square : s.box,
        isPrimary
          ? 'bg-primary border-primary text-white hover:bg-primary-deep shadow-sm'
          : isSecondary
          ? pressed
            ? 'bg-ice border-primary text-primary font-bold shadow-xs'
            : 'bg-card border-card-border text-ink hover:bg-ice hover:text-primary shadow-xs'
          : isTertiary
          ? 'bg-transparent border-transparent text-primary hover:bg-ice/50'
          : 'bg-card border-card-border text-ink hover:bg-base shadow-xs',
        className,
      )}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size={s.icon}
          tone={isPrimary ? 'onPrimary' : pressed || isPrimary ? 'primary' : 'inherit'}
          weight={pressed || isPrimary ? 'duotone' : 'regular'}
        />
      )}
      {children}
    </button>
  );
}

/** Neutral alias for Button */
export const Button = NeuButton;
