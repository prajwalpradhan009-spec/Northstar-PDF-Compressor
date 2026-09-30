import { useEffect, useRef } from 'react';
import { X } from './icons';

/**
 * Accessible glass modal.
 *
 * Handles the things a hand-rolled dialog usually forgets: Escape to close,
 * focus moved into the panel on open, focus trapped while open, focus restored
 * on close, and the page behind locked against scroll on mobile.
 */
export default function GlassModal({
  open,
  onClose,
  labelledBy,
  children,
  showClose = true,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusTo.current = document.activeElement;

    // Focus the panel itself rather than the first input, so screen readers
    // announce the dialog title before any field content.
    const focusTimer = setTimeout(() => panelRef.current?.focus(), 30);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
      // Return focus to whatever opened the dialog.
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="glass-panel modal"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {showClose && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
