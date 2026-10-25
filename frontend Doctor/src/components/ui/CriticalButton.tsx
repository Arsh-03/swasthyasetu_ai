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
  /** `loading` replaces the label with this text (e.g. "Sending…"); defaults to the label. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

/**
 * Principle 3, "Consent is sacred": the highest-contrast element on screen. Strong raised shape,
 * SOLID deep fill, white icon + label (≥ 4.5:1 incl. under the sheen), coloured glow.
 * Hover lifts 1px; pressed = inset + darker fill; disabled = flat primarySoft fill, ink label.
 * Min height 44px (critical target). Never icon-only.
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
        'critical inline-flex min-h-11 items-center justify-center gap-2.5 px-5 py-2 font-bold select-none',
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
        <Icon name={icon} size={20} weight="duotone" />
      )}
      <span className="flex flex-col items-start text-left leading-tight">
        <span className="text-sm">{loading ? (loadingLabel ?? label) : label}</span>
        {sublabel && <span className="text-2xs font-medium">{sublabel}</span>}
      </span>
    </button>
  );
}
