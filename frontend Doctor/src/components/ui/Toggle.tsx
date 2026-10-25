import { useId } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Short state text next to the switch, e.g. "On" / "Off" (state is never colour alone). */
  stateLabels?: [on: string, off: string];
  disabled?: boolean;
  className?: string;
}

/**
 * Switch: STRONG inset track + raised knob (the only raised element inside an inset).
 * On = knob slides right (transform only), primary tint in the track and a check on the knob.
 * Keyboard: native button, so Space / Enter toggle.
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
          'neu-inset-sm relative h-7 w-12 shrink-0 rounded-full p-0.5 disabled:cursor-not-allowed disabled:opacity-60',
          checked && 'bg-primary-tint',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'neu-raised-sm absolute top-0.5 left-0.5 flex size-6 items-center justify-center rounded-full transition-transform duration-250 ease-calm',
            checked ? 'translate-x-5 text-primary' : 'translate-x-0 text-ink-inset',
          )}
        >
          {checked && <Icon name="check" size={14} weight="duotone" />}
        </span>
      </button>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {stateLabels && <span className="ml-2 text-footnote text-ink-muted">{checked ? stateLabels[0] : stateLabels[1]}</span>}
      </label>
    </div>
  );
}
