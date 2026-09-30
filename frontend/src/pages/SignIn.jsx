import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { AuthFields, useAuthForm } from './useAuthForm';
import { AlertCircle, CheckCircle2, Lock, ShieldCheck, Star } from '../components/icons';

export default function SignIn() {
  const location = useLocation();
  const form = useAuthForm('signin');

  useEffect(() => {
    document.title = 'Sign In — NorthStar';
  }, []);

  // No "already signed in, go home" redirect here. Sessions are never restored
  // on boot, so the only way to become authenticated on this page is to sign in
  // on it — and `useAuthForm` already navigates to the right destination. A
  // redirect keyed on `isAuthenticated` would race that and win, dumping people
  // on the home page instead of the tool they asked for.

  // Pre-fill the email after a successful signup, and explain why they are here.
  const registeredEmail = location.state?.registeredEmail;
  // Set by the route guard when a tool refused to open for a signed-out visitor.
  const requiredFor = location.state?.requiredFor;

  return (
    <div className="page page--top page--narrow">
      <Reveal className="auth-card">
        <div className="glass-panel">
          <div className="auth-head">
            <span className="modal-icon" aria-hidden="true">
              <Star />
            </span>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-sub">Sign in to pick up where you left off.</p>
          </div>

          {registeredEmail && (
            <div className="form-alert form-alert--success mb-20" role="status">
              <CheckCircle2 />
              <span>
                Account created successfully. You can sign in now as <strong>{registeredEmail}</strong>.
              </span>
            </div>
          )}

          {requiredFor && (
            <div className="form-alert mb-20" role="status">
              <Lock />
              <span>
                You need an account to use {requiredFor}. Sign in below, or{' '}
                <Link className="link" to="/signup" state={location.state}>
                  create a free account
                </Link>
                .
              </span>
            </div>
          )}

          {form.notice && (
            <div className="form-alert form-alert--success mb-20" role="status">
              <CheckCircle2 />
              <span>{form.notice}</span>
            </div>
          )}

          {form.formError && (
            <div className="form-alert mb-20" role="alert">
              <AlertCircle />
              <span>{form.formError}</span>
            </div>
          )}

          <form className="form" onSubmit={form.submit} noValidate>
            <AuthFields
              fields={form.fields}
              errors={form.errors}
              onChange={form.onChange}
              showPassword={form.showPassword}
              onTogglePassword={form.togglePassword}
              busy={form.busy}
              mode="signin"
            />

            <button type="submit" className="glass-button glass-button--block glass-button--lg" disabled={form.busy}>
              {form.busy ? <Loader text="Signing in…" /> : 'Sign In'}
            </button>

            <p className="form-foot center">
              Don&apos;t have an account?{' '}
              <Link className="link" to="/signup" state={location.state}>
                Sign Up
              </Link>
            </p>
          </form>

          <p className="text-dim text-sm center mt-20 row" style={{ gap: 7, justifyContent: 'center' }}>
            <ShieldCheck style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
            Your session is stored in a secure HttpOnly cookie and ends when you reload the page.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
