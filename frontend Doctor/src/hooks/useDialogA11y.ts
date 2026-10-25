import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Keyboard behaviour for modal dialogs (presentation only, no app logic):
 * - moves focus into the dialog when it opens (first focusable element, or the dialog itself),
 * - keeps Tab / Shift+Tab inside it (focus trap),
 * - Esc calls `onClose` (pass `undefined` for a dialog that must not be dismissed),
 * - returns focus to the element that opened it when it closes.
 */
export function useDialogA11y(open: boolean, dialogRef: RefObject<HTMLElement | null>, onClose?: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Focus after paint so the dialog's own autofocus / transitions don't fight it
    const frame = requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return;
      const first = focusables()[0];
      if (first) first.focus();
      else {
        if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
        dialog.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      // Return focus to the opener if it is still on the page
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, dialogRef]);
}
