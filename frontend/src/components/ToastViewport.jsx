import { useToast } from '../context/ToastContext';
import { AlertCircle, CheckCircle2, Info, X } from './icons';

const TITLES = {
  success: 'Success',
  error: 'Something went wrong',
  info: 'Heads up',
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

/**
 * The toast viewport. Rendered once, at the app root.
 * `aria-live="polite"` announces messages without stealing focus.
 */
export default function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind] || Info;
        return (
          <div key={toast.id} className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="toast-body">
              <p className="toast-title">{toast.title || TITLES[toast.kind] || TITLES.info}</p>
              <p className="toast-msg">{toast.message}</p>
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}
