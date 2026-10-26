import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  icon: IconName;
  hint?: string;
  error?: string;
  size?: 'sm' | 'md';
}

/**
 * Clean text field: white fill, 1px input-border (≥ 3:1 vs card & canvas),
 * 2px primary focus ring, leading icon, visible label.
 */
export function TextField({
  label,
  icon,
  hint,
  error,
  size = 'md',
  id,
  className,
  ...rest
}: TextFieldProps) {
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
          'group flex items-center gap-2.5 rounded-control px-3.5 bg-card border border-input-border text-ink-muted transition-colors',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:text-primary',
          error && 'border-danger-deep focus-within:ring-danger-deep',
          size === 'sm' ? 'min-h-9' : 'min-h-11',
        )}
      >
        <Icon name={icon} size={18} tone="inherit" className="group-focus-within:hidden" />
        <Icon name={icon} size={18} tone="inherit" weight="duotone" className="hidden group-focus-within:block" />
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'min-w-0 flex-1 bg-transparent font-medium text-ink outline-none focus-visible:outline-none placeholder:text-ink-muted',
            size === 'sm' ? 'text-footnote' : 'text-sm',
          )}
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
          <Icon name="error" size={14} tone="danger" weight="duotone" />
          {error}
        </p>
      )}
    </div>
  );
}

export const Field = TextField;
