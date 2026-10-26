import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ReactNode;
  className?: string;
}

/**
 * Doctor PageHeader: title, subtitle, one primary action, and breadcrumbs on deep pages.
 */
export function PageHeader({ title, subtitle, breadcrumbs, action, className }: PageHeaderProps) {
  return (
    <div className={cx('flex flex-col gap-2 pb-4 border-b border-border mb-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-footnote text-ink-muted">
          {breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevronRight" size={12} tone="muted" />}
                {b.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={b.onClick}
                    className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {b.label}
                  </button>
                ) : (
                  <span className={cx(isLast ? 'text-ink font-semibold' : '')}>{b.label}</span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="text-footnote text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
