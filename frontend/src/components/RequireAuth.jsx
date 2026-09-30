import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './Loader';

/**
 * Route guard for the tools that need an account.
 *
 * Redirects to the sign-in page and remembers where the visitor was heading, so
 * `useAuthForm` sends them straight back after they authenticate. The reason
 * travels with the navigation so the sign-in page can explain the stop instead
 * of leaving them to wonder.
 */
export default function RequireAuth({ children, tool }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Hold still until the boot handshake settles, otherwise a signed-in visitor
  // would be bounced on every refresh before their session is known.
  if (loading) {
    return (
      <div className="page page--top">
        <div className="glass-panel center" style={{ padding: '48px 24px' }}>
          <Loader size="lg" text="Checking your session…" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}`, requiredFor: tool }}
      />
    );
  }

  return children;
}
