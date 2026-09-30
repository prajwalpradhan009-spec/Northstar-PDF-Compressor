import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { auth as authApi } from '../lib/api';
import { formatDate, initials, relativeTime } from '../lib/format';
import {
  AlertCircle, ArrowRight, CheckCircle2, LayoutDashboard, Lock, LogOut,
  Mail, Settings as SettingsIcon, ShieldCheck, Trash, User,
} from '../components/icons';

export default function Account() {
  const { user, loading: authLoading, isAuthenticated, updateProfile, logout } = useAuth();
  const { success, error, confirm } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = 'Account — NorthStar';
  }, []);

  // Keep the field in sync with the server copy after the session probe lands.
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/signin', { replace: true, state: { from: '/account' } });
  }, [authLoading, isAuthenticated, navigate]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Full name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 80) {
      setNameError('Full name must be 80 characters or fewer.');
      return;
    }
    if (trimmed === user.name) {
      setSaved(true);
      return;
    }

    setSaving(true);
    setNameError('');
    setSaved(false);
    try {
      const data = await updateProfile({ name: trimmed });
      success(data?.message || 'Profile updated.');
      setSaved(true);
    } catch (err) {
      const message = err?.details?.name || err?.message || 'Could not update your profile.';
      setNameError(message);
      error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (busyAction) return;
    setBusyAction('logout');
    try {
      await logout();
      success('You have been signed out.');
      navigate('/');
    } catch {
      error('Could not sign out. Please try again.');
    } finally {
      setBusyAction('');
    }
  };

  const handleLogoutAll = async () => {
    if (busyAction) return;
    const ok = await confirm({
      title: 'Sign out everywhere?',
      text: 'This ends your session on every device, including this one. You will need to sign in again.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (!ok) return;

    setBusyAction('all');
    try {
      await authApi.logoutAll();
      success('Signed out of all devices.');
      // The local cookie is dead, so mirror that in the client immediately.
      await logout().catch(() => {});
      navigate('/signin');
    } catch (err) {
      error(err?.message || 'Could not sign out everywhere.');
    } finally {
      setBusyAction('');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="page page--top center" style={{ paddingTop: '22vh' }}>
        <Loader text="Loading your account…" size="lg" />
      </div>
    );
  }

  return (
    <div className="page page--top page--narrow">
      <Reveal className="page-head">
        <p className="eyebrow">Account</p>
        <h1 className="page-title">Your profile &amp; session</h1>
        <p className="page-sub">Update the name shown across NorthStar, or end your sessions.</p>
      </Reveal>

      {/* ---------------- Identity card ---------------- */}
      <Reveal className="glass-panel mb-14" delay={40}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 3 }}>{user.name}</h2>
            <p className="row text-soft text-sm" style={{ gap: 6 }}>
              <Mail style={{ width: 14, height: 14 }} />
              {user.email}
            </p>
          </div>
          <Link className="glass-button glass-button--ghost glass-button--sm" to="/dashboard" style={{ marginLeft: 'auto' }}>
            <LayoutDashboard style={{ width: 15, height: 15 }} />
            Dashboard
          </Link>
        </div>

        <hr className="divider" />

        <dl className="meta-list">
          <div className="meta-row">
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div className="meta-row">
            <dt>Last sign in</dt>
            <dd>{user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'This session'}</dd>
          </div>
          <div className="meta-row">
            <dt>Email verified</dt>
            <dd>{user.emailVerified ? 'Yes' : 'Not required'}</dd>
          </div>
          <div className="meta-row">
            <dt>Account type</dt>
            <dd>Free</dd>
          </div>
        </dl>
      </Reveal>

      {/* ---------------- Profile form ---------------- */}
      <Reveal className="glass-panel mb-14" delay={80}>
        <h2 className="row mb-20" style={{ fontSize: '1.1rem', gap: 8 }}>
          <SettingsIcon style={{ width: 17, height: 17, color: 'var(--blue)' }} />
          Display name
        </h2>

        {nameError && (
          <div className="form-alert mb-20" role="alert">
            <AlertCircle />
            <span>{nameError}</span>
          </div>
        )}
        {saved && !nameError && (
          <div className="form-alert form-alert--success mb-20" role="status">
            <CheckCircle2 />
            <span>Your profile is up to date.</span>
          </div>
        )}

        <form className="form" onSubmit={handleSave} noValidate>
          <div className="field">
            <label className="label" htmlFor="acct-name">
              Full Name<span className="req" aria-hidden="true">*</span>
            </label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <User />
              </span>
              <input
                id="acct-name"
                name="name"
                type="text"
                className="glass-input"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError('');
                  if (saved) setSaved(false);
                }}
                disabled={saving}
                maxLength={80}
                autoComplete="name"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'acct-name-err' : 'acct-name-hint'}
                required
              />
            </div>
            {nameError ? (
              <p className="field-error" id="acct-name-err">
                <AlertCircle /> {nameError}
              </p>
            ) : (
              <p className="text-dim text-sm" id="acct-name-hint" style={{ marginTop: 6 }}>
                Shown on your dashboard and in recent activity.
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="acct-email">
              Email
            </label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <Mail />
              </span>
              <input
                id="acct-email"
                type="email"
                className="glass-input"
                value={user.email}
                disabled
                aria-describedby="acct-email-hint"
              />
            </div>
            <p className="text-dim text-sm" id="acct-email-hint" style={{ marginTop: 6 }}>
              Your email identifies the account and cannot be changed here.
            </p>
          </div>

          <button type="submit" className="glass-button glass-button--block" disabled={saving}>
            {saving ? <Loader text="Saving…" /> : 'Save Changes'}
          </button>
        </form>
      </Reveal>

      {/* ---------------- Session ---------------- */}
      <Reveal className="glass-panel mb-14" delay={120}>
        <h2 className="row mb-20" style={{ fontSize: '1.1rem', gap: 8 }}>
          <Lock style={{ width: 17, height: 17, color: 'var(--purple)' }} />
          Sessions
        </h2>

        <div className="note mb-20">
          <ShieldCheck style={{ width: 16, height: 16, color: 'var(--cyan)', flexShrink: 0 }} />
          <span>
            Your session lives in an HttpOnly, SameSite cookie, so no script on this page can read it.
            Signing out everywhere invalidates every issued token.
          </span>
        </div>

        <div className="action-row">
          <button type="button" className="glass-button glass-button--ghost" onClick={handleLogout} disabled={Boolean(busyAction)}>
            <LogOut style={{ width: 16, height: 16 }} />
            {busyAction === 'logout' ? 'Signing out…' : 'Sign out'}
          </button>
          <button type="button" className="glass-button glass-button--danger" onClick={handleLogoutAll} disabled={Boolean(busyAction)}>
            <Trash style={{ width: 16, height: 16 }} />
            {busyAction === 'all' ? 'Working…' : 'Sign out everywhere'}
          </button>
        </div>
      </Reveal>

      <Reveal className="center" delay={160}>
        <Link className="link row" to="/dashboard" style={{ gap: 6, justifyContent: 'center' }}>
          Back to dashboard <ArrowRight style={{ width: 14, height: 14 }} />
        </Link>
      </Reveal>
    </div>
  );
}
