import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type CriticalTone = 'primary' | 'success' | 'danger';

export interface CriticalButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** primary = Join / Start call · success = Send / Approve consent · danger = End call / Decline. */
  tone: CriticalTone;
  icon: IconName;
  label: string;
  sublabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

/**
 * Flat solid deep action: always the highest-contrast element on screen (white label ≥ 4.5:1).
 * Replaces neumorphism: flat solid deep fill, min height 48-56, icon + label, e1 elevation.
 */
export function CriticalButton({
  tone,
  icon,
  label,
  sublabel,
  loading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: CriticalButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cx(
        'critical inline-flex min-h-12 items-center justify-center gap-2.5 px-6 py-2.5 font-bold select-none cursor-pointer',
        tone === 'primary' && 'critical-primary',
        tone === 'success' && 'critical-success',
        tone === 'danger' && 'critical-danger',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        <Icon name={icon} size={20} tone="onPrimary" weight="duotone" />
      )}
      <span className="flex flex-col items-start text-left leading-tight">
        <span className="text-sm text-white">{loading ? (loadingLabel ?? label) : label}</span>
        {sublabel && <span className="text-2xs font-medium text-white/90">{sublabel}</span>}
      </span>
    </button>
  );
}
