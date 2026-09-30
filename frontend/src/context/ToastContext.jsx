import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import GlassModal from '../components/GlassModal';
import { AlertCircle, HelpCircle } from '../components/icons';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 5200;
const CONFIRM_TITLE_ID = 'confirm-dialog-title';

/**
 * Glass toast notifications.
 * Errors persist longer than successes because they usually need reading.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { kind = 'info', title, duration } = {}) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const ttl = duration ?? (kind === 'error' ? DEFAULT_DURATION + 3000 : DEFAULT_DURATION);
      setToasts((current) => [...current.slice(-3), { id, message, kind, title }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl),
      );
      return id;
    },
    [dismiss],
  );

  /**
   * Promise-based confirmation.
   *
   * `await confirm({ title, text })` resolves to true/false, which reads far
   * better at the call site than threading dialog state through every page.
   */
  const [confirmation, setConfirmation] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    setConfirmation({
      title: options.title || 'Are you sure?',
      text: options.text || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'primary',
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result) => {
    setConfirmation(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      confirm,
      notify: push,
      success: (message, options) => push(message, { ...options, kind: 'success' }),
      error: (message, options) => push(message, { ...options, kind: 'error' }),
      info: (message, options) => push(message, { ...options, kind: 'info' }),
    }),
    [toasts, push, dismiss, confirm],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {confirmation && (
        <GlassModal open onClose={() => settle(false)} labelledBy={CONFIRM_TITLE_ID}>
          <div
            className="modal-icon"
            aria-hidden="true"
            style={confirmation.tone === 'danger' ? { color: 'var(--red)' } : { color: 'var(--blue)' }}
          >
            {confirmation.tone === 'danger' ? <AlertCircle /> : <HelpCircle />}
          </div>
          <h2 className="modal-title" id={CONFIRM_TITLE_ID}>
            {confirmation.title}
          </h2>
          {confirmation.text && <p className="modal-text">{confirmation.text}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className={
                confirmation.tone === 'danger'
                  ? 'glass-button glass-button--danger glass-button--block'
                  : 'glass-button glass-button--block'
              }
              onClick={() => settle(true)}
            >
              {confirmation.confirmLabel}
            </button>
            <button
              type="button"
              className="glass-button glass-button--ghost glass-button--block"
              onClick={() => settle(false)}
            >
              {confirmation.cancelLabel}
            </button>
          </div>
        </GlassModal>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
