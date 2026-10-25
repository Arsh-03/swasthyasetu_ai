import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Always visible above the field (placeholders are not labels). */
  label: string;
  /** Leading icon: idle = regular ink-inset, focused = duotone primary. */
  icon: IconName;
  hint?: string;
  error?: string;
  size?: 'sm' | 'md';
}

/**
 * STRONG inset field: leading icon + visible label + placeholder; focus = 2px primary ring.
 * Errors are text + icon (never colour alone) and linked with aria-describedby.
 */
export function TextField({ label, icon, hint, error, size = 'md', id, className, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-footnote font-semibold text-ink">
        {label}
      </label>
      <div
        className={cx(
          'neu-inset group flex items-center gap-2.5 rounded-control px-3.5 text-ink-inset',
          'focus-within:text-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
          error && 'outline-2 outline-offset-2 outline-danger-deep',
          size === 'sm' ? 'min-h-9' : 'min-h-11',
        )}
      >
        <Icon name={icon} size={18} className="group-focus-within:hidden" />
        <Icon name={icon} size={18} weight="duotone" className="hidden group-focus-within:block" />
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx('min-w-0 flex-1 bg-transparent font-medium text-ink outline-none focus-visible:outline-none', size === 'sm' ? 'text-footnote' : 'text-sm')}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-2xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-2xs font-semibold text-danger-deep">
          <Icon name="error" size={14} weight="duotone" />
          {error}
        </p>
      )}
    </div>
  );
}
