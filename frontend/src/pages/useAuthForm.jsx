import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Loader } from '../components/Loader';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from '../components/icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Shared email + password fields, so signin and signup stay in sync. */
export function AuthFields({ fields, errors, onChange, showPassword, onTogglePassword, busy, mode }) {
  return (
    <>
      {mode === 'signup' && (
        <div className="field">
          <label className="label" htmlFor="auth-name">
            Full Name<span className="req" aria-hidden="true">*</span>
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              <Lock style={{ width: 17, height: 17 }} />
            </span>
            <input
              id="auth-name"
              name="name"
              type="text"
              className="glass-input"
              placeholder="Ada Lovelace"
              autoComplete="name"
              value={fields.name}
              onChange={onChange}
              disabled={busy}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'err-name' : undefined}
              required
            />
          </div>
          {errors.name && (
            <p className="field-error" id="err-name">
              <AlertCircle /> {errors.name}
            </p>
          )}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="auth-email">
          Email<span className="req" aria-hidden="true">*</span>
        </label>
        <div className="input-wrap">
          <span className="input-icon" aria-hidden="true">
            <Mail />
          </span>
          <input
            id="auth-email"
            name="email"
            type="email"
            className="glass-input"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            value={fields.email}
            onChange={onChange}
            disabled={busy}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'err-email' : undefined}
            required
          />
        </div>
        {errors.email && (
          <p className="field-error" id="err-email">
            <AlertCircle /> {errors.email}
          </p>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="auth-password">
          Password<span className="req" aria-hidden="true">*</span>
        </label>
        <div className="input-wrap">
          <span className="input-icon" aria-hidden="true">
            <Lock />
          </span>
          <input
            id="auth-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            className="glass-input"
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={fields.password}
            onChange={onChange}
            disabled={busy}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'err-password' : undefined}
            required
          />
          <button
            type="button"
            className="reveal-btn"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {errors.password && (
          <p className="field-error" id="err-password">
            <AlertCircle /> {errors.password}
          </p>
        )}
      </div>
    </>
  );
}

export function useAuthForm(mode) {
  const { signin, signup } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [fields, setFields] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Where to land after a successful auth — set by the page that redirected.
  const destination = location.state?.from || (mode === 'signup' ? '/signin' : '/dashboard');

  const onChange = (event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    // Clear a field error as soon as the user starts fixing it.
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
    if (formError) setFormError('');
  };

  const validate = () => {
    const next = {};

    if (mode === 'signup') {
      const name = fields.name.trim();
      if (!name) next.name = 'Full name is required.';
      else if (name.length < 2) next.name = 'Full name must be at least 2 characters.';
    }

    const email = fields.email.trim();
    if (!email) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email)) next.email = 'Please enter a valid email address.';

    if (!fields.password) next.password = 'Password is required.';
    else if (mode === 'signup' && fields.password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }

    if (mode === 'signup') {
      if (!fields.confirmPassword) next.confirmPassword = 'Please confirm your password.';
      else if (fields.confirmPassword !== fields.password) next.confirmPassword = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!validate()) return;

    setBusy(true);
    setFormError('');
    setNotice('');

    try {
      if (mode === 'signup') {
        const data = await signup({
          name: fields.name.trim(),
          email: fields.email.trim(),
          password: fields.password,
          confirmPassword: fields.confirmPassword,
        });
        // Per the spec, signup does not sign you in — land on /signin.
        navigate('/signin', {
          state: { registeredEmail: fields.email.trim(), from: location.state?.from },
          replace: true,
        });
        setNotice(data?.message || 'Account created successfully.');
        success(data?.message || 'Account created successfully.');
      } else {
        const data = await signin({ email: fields.email.trim(), password: fields.password });
        success(data?.message || 'Welcome back!');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      // Field-level messages from the server highlight the right input.
      if (err?.details && typeof err.details === 'object') {
        setErrors((current) => ({ ...current, ...err.details }));
      }
      setFormError(err?.message || 'Something went wrong. Please try again.');
      error(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const togglePassword = () => setShowPassword((value) => !value);

  return { fields, errors, formError, notice, busy, showPassword, onChange, submit, togglePassword, setNotice };
}
