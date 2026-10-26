import { useId } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  stateLabels?: [on: string, off: string];
  disabled?: boolean;
  className?: string;
}

/**
 * Clean standard toggle switch:
 * Track: transitions between subtle tonal fill and primary fill.
 * Knob: pure white disc with subtle border and e1 shadow.
 */
export function Toggle({ checked, onChange, label, stateLabels, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <div className={cx('inline-flex min-h-9 items-center gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full p-0.5 border transition-colors duration-250 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          checked ? 'bg-primary border-primary' : 'bg-fog/50 border-card-border',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'absolute top-0.5 left-0.5 flex size-6 items-center justify-center rounded-full bg-card border border-card-border shadow-e1 transition-transform duration-250 ease-calm',
            checked ? 'translate-x-5 text-primary' : 'translate-x-0 text-ink-muted',
          )}
        >
          {checked && <Icon name="check" size={13} tone="primary" weight="duotone" />}
        </span>
      </button>
      <label htmlFor={id} className="text-sm font-medium text-ink cursor-pointer">
        {label}
        {stateLabels && (
          <span className="ml-2 text-footnote text-ink-muted">
            {checked ? stateLabels[0] : stateLabels[1]}
          </span>
        )}
      </label>
    </div>
  );
}
