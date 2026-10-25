import { useId, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { cx } from './cx';
import { Icon } from './Icon';

/**
 * Liquid glass (design_system_tokens.md § 7 / § 11): blur ~30px + saturate, translucent fill
 * (toolbar / sidebar base @ 54%, sheet card @ 66%), 1px specular edge brighter at the top-left,
 * ink text only. Solid fallbacks for no backdrop-filter and prefers-reduced-transparency live in utilities.css.
 */

export function GlassToolbar({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <header className={cx('glass-toolbar sticky top-0 z-40', className)} {...rest}>
      {children}
    </header>
  );
}

export function GlassSidebar({ className, children, label, ...rest }: HTMLAttributes<HTMLElement> & { label: string }) {
  return (
    <nav aria-label={label} className={cx('glass-sidebar flex flex-col', className)} {...rest}>
      {children}
    </nav>
  );
}

interface GlassSheetProps {
  open: boolean;
  /** Esc, the close button and the scrim call this. Omit for a sheet that must not be dismissed. */
  onClose?: () => void;
  title: string;
  /** Hidden-label text for the close button (translated). */
  closeLabel?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Modal glass sheet: scrim, role="dialog" + aria-modal, labelled by its title, focus moves in on
 * open, Tab is trapped, Esc closes, focus returns to the opener on close.
 */
export function GlassSheet({ open, onClose, title, closeLabel = 'Close', description, children, footer, className }: GlassSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogA11y(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cx('glass-sheet relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-hero', className)}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-footnote text-ink">
                {description}
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="neu-raised-sm neu-press flex size-9 shrink-0 items-center justify-center rounded-full text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
