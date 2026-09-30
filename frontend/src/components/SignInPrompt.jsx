import { Link } from 'react-router-dom';
import { User } from './icons';

/**
 * Account upsell for visitors who can still see the marketing surface.
 *
 * The tools themselves are behind `RequireAuth`, so this belongs on the pages
 * a signed-out visitor can still reach — the dashboard is the only one left,
 * where it explains what signing in would add.
 */
export default function SignInPrompt({ title = 'Create a free account', text }) {
  return (
    <div className="glass-panel center" style={{ padding: '28px 24px' }}>
      <div className="modal-icon" aria-hidden="true">
        <User />
      </div>
      <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>{title}</h2>
      <p className="text-soft text-sm" style={{ maxWidth: '44ch', margin: '0 auto 20px' }}>
        {text || 'Sign in to track your merges and compressions in one place.'}
      </p>
      <div className="action-row">
        <Link className="glass-button" to="/signin" state={{ from: '/dashboard' }}>
          Sign In
        </Link>
        <Link className="glass-button glass-button--ghost" to="/signup" state={{ from: '/dashboard' }}>
          Create Account
        </Link>
      </div>
    </div>
  );
}
