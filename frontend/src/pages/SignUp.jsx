import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { AuthFields, useAuthForm } from './useAuthForm';
import { AlertCircle, Eye, Lock, ShieldCheck, Star } from '../components/icons';

/** Simple 0–4 strength score used only for the meter. */
function scorePassword(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH = [
  { label: 'Too short', color: 'var(--red)' },
  { label: 'Weak', color: 'var(--red)' },
  { label: 'Fair', color: 'var(--amber)' },
  { label: 'Good', color: 'var(--cyan)' },
  { label: 'Strong', color: 'var(--green)' },
];

export default function SignUp() {
  const location = useLocation();
  const form = useAuthForm('signup');

  useEffect(() => {
    document.title = 'Sign Up — NorthStar';
  }, []);

  const score = scorePassword(form.fields.password);
  const strength = STRENGTH[score];

  return (
    <div className="page page--top page--narrow">
      <Reveal className="auth-card">
        <div className="glass-panel">
          <div className="auth-head">
            <span className="modal-icon" aria-hidden="true">
              <Star />
            </span>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-sub">Free, and takes about fifteen seconds.</p>
          </div>

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
              mode="signup"
            />

            {form.fields.password && (
              <div className="strength" aria-live="polite">
                <span className="sr-only">Password strength</span>
                <span className="strength-track" aria-hidden="true">
                  <span
                    className="strength-fill"
                    style={{ width: `${(score / 4) * 100}%`, background: strength.color }}
                  />
                </span>
                <span aria-hidden="true" style={{ color: strength.color, minWidth: 62 }}>
                  {strength.label}
                </span>
              </div>
            )}

            <div className="field">
              <label className="label" htmlFor="auth-confirm">
                Confirm Password<span className="req" aria-hidden="true">*</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">
                  <Lock />
                </span>
                <input
                  id="auth-confirm"
                  name="confirmPassword"
                  type={form.showPassword ? 'text' : 'password'}
                  className="glass-input"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  value={form.fields.confirmPassword}
                  onChange={form.onChange}
                  disabled={form.busy}
                  aria-invalid={Boolean(form.errors.confirmPassword)}
                  aria-describedby={form.errors.confirmPassword ? 'err-confirm' : undefined}
                  required
                />
              </div>
              {form.errors.confirmPassword && (
                <p className="field-error" id="err-confirm">
                  <AlertCircle /> {form.errors.confirmPassword}
                </p>
              )}
            </div>

            <button type="submit" className="glass-button glass-button--block glass-button--lg" disabled={form.busy}>
              {form.busy ? <Loader text="Creating account…" /> : 'Create Account'}
            </button>

            <p className="form-foot center">
              Already have an account?{' '}
              <Link className="link" to="/signin" state={location.state}>
                Sign In
              </Link>
            </p>
          </form>

          <p className="text-dim text-sm center mt-20 row" style={{ gap: 7, justifyContent: 'center' }}>
            <ShieldCheck style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
            Passwords are hashed with bcrypt. We never store the plain text.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
