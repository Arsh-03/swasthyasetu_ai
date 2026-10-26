// Building blocks for the portal screens: flat cards on the Harbor Calm canvas, one primary action per area.
import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { cx } from '../components/ui/cx';
import { Icon, type IconName } from '../components/ui/Icon';
import type { Tone } from '../components/ui/tones';
import { TONE_CLASS } from '../components/ui/tones';

// ---------------------------------------------------------------------------- Buttons

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-deep',
  secondary: 'bg-card text-ink border border-border hover:bg-base',
  ghost: 'text-ink hover:bg-ink-tint',
  danger: 'bg-danger-deep text-on-primary hover:bg-danger-pressed',
  success: 'bg-success-deep text-on-primary hover:bg-success-pressed',
};

export function Button({
  variant = 'secondary', size = 'md', icon, iconRight, children, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName;
}) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap cursor-pointer',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-subhead',
        BUTTON[variant],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function IconButton({ icon, label, className, active, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center w-10 h-10 rounded-control cursor-pointer transition-colors',
        active ? 'bg-primary-tint text-primary' : 'text-ink-muted hover:bg-ink-tint hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

// ---------------------------------------------------------------------------- Surfaces

export function Card({ children, className, as: Tag = 'section', ...rest }:
  { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <Tag className={cx('bg-card rounded-panel border border-hairline shadow-card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <Icon name={icon} size={20} tone="primary" weight="duotone" />}
        <div className="min-w-0">
          <h3 className="text-subhead font-semibold text-ink leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-1 mb-5">
      {back && (
        <a href={back.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline w-fit">
          <Icon name="chevronLeft" size={14} /> {back.label}
        </a>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Pill({ label, tone = 'neutral', icon, dot }: { label: string; tone?: Tone; icon?: IconName; dot?: boolean }) {
  const t = TONE_CLASS[tone];
  return (
    <span title={label} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap max-w-full min-w-0', t.pill)}>
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', t.dot)} />}
      {icon && <Icon name={icon} size={12} />}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} style={style} className="rounded-full object-cover shrink-0 bg-fog" />;
  }
  return (
    <span aria-hidden style={style} className="rounded-full shrink-0 bg-ice text-primary-deep font-semibold flex items-center justify-center">
      {initials || '?'}
    </span>
  );
}

/** Patient names are stored as "Name (ನಾಮ)"; lists show the Latin name, the full one appears on the patient page. */
export const shortName = (name: string | null | undefined) => (name ?? '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/,.*$/, '').trim();

export function Empty({ icon = 'inbox', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6">
      <Icon name={icon} size={32} tone="muted" weight="duotone" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="text-xs text-ink-muted max-w-sm">{children}</div>}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <span className="w-4 h-4 rounded-full border-2 border-fog border-t-primary animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-danger-tint text-danger-deep px-4 py-3 text-sm">
      <Icon name="warning" size={18} />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>{retryLabel ?? 'Retry'}</Button>}
    </div>
  );
}

// ---------------------------------------------------------------------------- Tabs

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { id: T; label: string; count?: number; icon?: IconName }[]; value: T; onChange: (id: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-hairline overflow-x-auto">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cx(
              'relative inline-flex items-center gap-1.5 px-3.5 h-11 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors',
              selected ? 'text-primary' : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.icon && <Icon name={tab.icon} size={18} weight={selected ? 'duotone' : 'regular'} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cx('text-2xs rounded-full px-1.5', selected ? 'bg-primary-tint' : 'bg-ink-tint')}>{tab.count}</span>
            )}
            {selected && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/** Two to four mutually exclusive options (e.g. List / Calendar). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 rounded-control bg-ink-tint">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-chip text-xs font-semibold cursor-pointer transition-colors',
            value === o.id ? 'bg-card text-ink shadow-card' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------- Form fields

const FIELD = 'w-full h-10 rounded-control border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary disabled:bg-base disabled:text-ink-muted';

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold text-ink">{label}</label>
      {children(id)}
      {hint && <p className="text-2xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, className)} {...rest} />;
}

export function SelectInput({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(FIELD, 'appearance-none pr-9 cursor-pointer', className)} {...rest}>{children}</select>
      <Icon name="chevronDown" size={16} tone="muted" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD, 'h-auto min-h-20 py-2 leading-relaxed resize-y', className)} {...rest} />;
}

// ---------------------------------------------------------------------------- Dialog

export function Dialog({ open, onClose, title, description, children, footer, width = 'max-w-lg', tone }: {
  open: boolean; onClose?: () => void; title: string; description?: ReactNode; children?: ReactNode;
  footer?: ReactNode; width?: string; tone?: 'danger';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogA11y(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('relative w-full bg-card rounded-t-hero sm:rounded-hero shadow-sheet max-h-[92vh] flex flex-col outline-none', width)}
      >
        <div className={cx('flex items-start gap-3 px-6 pt-5 pb-3', tone === 'danger' && 'text-danger-deep')}>
          {tone === 'danger' && <Icon name="emergency" size={24} weight="duotone" />}
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold font-sans text-ink">{title}</h2>
            {description && <div className="text-sm text-ink-muted mt-1">{description}</div>}
          </div>
          {onClose && <IconButton icon="close" label="Close" onClick={onClose} className="-mr-2 -mt-1" />}
        </div>
        {children && <div className="px-6 pb-4 overflow-y-auto">{children}</div>}
        {footer && <div className="px-6 py-4 border-t border-hairline flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Label / value list used on patient and visit pages. */
export function Facts({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4')}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{it.label}</dt>
          <dd className="text-sm text-ink mt-0.5 break-words">{it.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
