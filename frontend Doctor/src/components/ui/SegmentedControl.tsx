import { useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Segmented control: tonal track, white selected thumb with a subtle border and e1 elevation.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (e: KeyboardEvent, i: number) => {
    const last = options.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? i === 0
          ? last
          : i - 1
        : e.key === 'Home'
        ? 0
        : e.key === 'End'
        ? last
        : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('relative flex rounded-[16px] p-1 bg-[#E5ECF0] border border-border', className)}
    >
      {/* White selected thumb with e1 shadow */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-chip bg-card border border-card-border shadow-e1 transition-transform duration-250 ease-calm"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((opt, i) => {
        const selected = i === index;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => !selected && onChange(opt.value)}
            onKeyDown={(e) => move(e, i)}
            className={cx(
              'relative z-10 flex flex-1 basis-0 items-center justify-center gap-1.5 rounded-chip px-2 text-center leading-tight transition-colors cursor-pointer',
              size === 'sm' ? 'min-h-8 text-footnote' : 'min-h-10 text-sm',
              selected ? 'font-bold text-ink' : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {opt.icon && (
              <Icon
                name={opt.icon}
                size={16}
                tone={selected ? 'primary' : 'inherit'}
                weight={selected ? 'duotone' : 'regular'}
              />
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
