import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Reveal from '../components/Reveal';
import TiltCard from '../components/TiltCard';
import { Loader } from '../components/Loader';
import { AuthFields, useAuthForm } from './useAuthForm';
import {
  AlertCircle, Check, CheckCircle2, FileImage, Layers, Lock,
  ShieldCheck, Sparkle, Star, Zap,
} from '../components/icons';

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
  { label: 'Too short', color: '#FF1744' },
  { label: 'Weak', color: '#FF6B4A' },
  { label: 'Fair', color: '#FBBF24' },
  { label: 'Good', color: '#19D9FF' },
  { label: 'Strong', color: '#20E3A2' },
];

export default function SignUp() {
  const location = useLocation();
  const form = useAuthForm('signup');

  useEffect(() => {
    document.title = 'Sign Up — NorthStar';
  }, []);

  const password = form.fields.password || '';
  const confirmPassword = form.fields.confirmPassword || '';
  const score = scorePassword(password);
  const strength = STRENGTH[score];

  // Live requirement checks
  const reqMinLen = password.length >= 8;
  const reqCases = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const reqNumOrSym = /\d/.test(password) || /[^A-Za-z0-9]/.test(password);
  const reqMatch = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="auth-cinematic-scene">
      <div className="auth-cinematic-grid">
        {/* ================================================================= *
         * LEFT COLUMN — 3D HOLOGRAPHIC FEATURE SHOWCASE
         * ================================================================= */}
        <div className="auth-showcase">
          <Reveal>
            <div className="eyebrow-galaxy">
              <span>&#9699;</span>
              <span>INSTANT REGISTRATION &bull; FREE WORKSPACE</span>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="auth-hero-title">
              <span className="line-1">CREATE YOUR</span>
              <span className="line-cyan">ACCOUNT.</span>
              <span className="line-sub">ZERO INSTALL. MAXIMUM VELOCITY.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="auth-hero-desc">
              Join NorthStar in 15 seconds. Merge documents, compress images with Sharp precision,
              and manage high-throughput file operations without tracking or subscription hurdles.
            </p>
          </Reveal>

          {/* Floating 3D Holographic Card */}
          <Reveal delay={180}>
            <div className="auth-holo-card" aria-hidden="true">
              <div className="holo-card-inner">
                <div className="holo-header">
                  <div className="holo-live-pill">
                    <span className="live-dot" />
                    <span>FREE LIFETIME TIER &bull; NO ADS</span>
                  </div>
                  <span className="holo-sub-tag">100% PRIVATE</span>
                </div>

                <div className="holo-stream-wrap">
                  <div className="holo-stream-nodes">
                    <div className="holo-node holo-node--active">
                      <Sparkle style={{ width: 18, height: 18 }} />
                      <span>Instant Setup</span>
                    </div>
                    <div className="holo-node-arrow">&rarr;</div>
                    <div className="holo-node holo-node--active">
                      <Zap style={{ width: 18, height: 18 }} />
                      <span>Full Access</span>
                    </div>
                  </div>
                  <div className="holo-stream-bar">
                    <div className="holo-stream-progress" style={{ animationDuration: '2.4s' }} />
                  </div>
                </div>

                <div className="holo-feature-grid">
                  <div className="holo-chip">
                    <Layers style={{ width: 15, height: 15, color: '#19D9FF' }} />
                    <span>20 PDFs &bull; 1000 Pages / Merge</span>
                  </div>
                  <div className="holo-chip">
                    <FileImage style={{ width: 15, height: 15, color: '#20E3A2' }} />
                    <span>Up to 90% Image Compression</span>
                  </div>
                  <div className="holo-chip">
                    <ShieldCheck style={{ width: 15, height: 15, color: '#8057FF' }} />
                    <span>Zero Data Retention Policy</span>
                  </div>
                  <div className="holo-chip">
                    <Lock style={{ width: 15, height: 15, color: '#19D9FF' }} />
                    <span>Zero Password Plaintext</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="auth-trust-list">
              <li>
                <Check style={{ width: 16, height: 16, color: '#19D9FF' }} />
                <span>No credit card required &mdash; truly free forever</span>
              </li>
              <li>
                <Check style={{ width: 16, height: 16, color: '#20E3A2' }} />
                <span>Files never written to disk &mdash; processed entirely in memory</span>
              </li>
              <li>
                <Check style={{ width: 16, height: 16, color: '#8057FF' }} />
                <span>Browser-isolated HttpOnly session authentication</span>
              </li>
            </ul>
          </Reveal>
        </div>

        {/* ================================================================= *
         * RIGHT COLUMN — 3D INTERACTIVE TILT GLASS CARD
         * ================================================================= */}
        <div className="auth-card-column">
          <Reveal delay={80}>
            <TiltCard maxTilt={8} className="auth-tilt-wrapper">
              <div className="auth-3d-card glass-panel">
                {/* 3D Floating Icon with rotating cyber-ring */}
                <div className="auth-3d-icon-badge" aria-hidden="true">
                  <div className="auth-3d-ring" />
                  <Star className="auth-3d-star" />
                </div>

                {/* Segmented Mode Switcher */}
                <div className="auth-mode-pill" role="tablist" aria-label="Authentication mode">
                  <Link
                    to="/signin"
                    state={location.state}
                    className="auth-mode-tab"
                    role="tab"
                    aria-selected="false"
                  >
                    Sign In
                  </Link>
                  <span className="auth-mode-tab active" role="tab" aria-selected="true">
                    Create Account
                  </span>
                </div>

                <div className="auth-head">
                  <h2 className="auth-title">Create Account</h2>
                  <p className="auth-sub">Free, secure, and takes fifteen seconds.</p>
                </div>

                {form.formError && (
                  <div className="form-alert form-alert--error mb-20" role="alert">
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

                  {/* 4-Stage Neon Password Strength Bar */}
                  {password && (
                    <div className="auth-strength-box" aria-live="polite">
                      <div className="auth-strength-row">
                        <span className="auth-strength-label">Security strength:</span>
                        <span
                          className="auth-strength-value"
                          style={{ color: strength.color }}
                        >
                          {strength.label}
                        </span>
                      </div>
                      <div className="auth-strength-meter">
                        {[0, 1, 2, 3].map((stepIdx) => {
                          const active = score >= stepIdx + 1;
                          return (
                            <div
                              key={stepIdx}
                              className={`auth-strength-step ${active ? 'active' : ''}`}
                              style={{
                                backgroundColor: active ? strength.color : undefined,
                                boxShadow: active ? `0 0 10px ${strength.color}` : undefined,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Live Password Requirements Checklist */}
                  <div className="auth-req-box">
                    <div className={`auth-req-item ${reqMinLen ? 'met' : ''}`}>
                      <span className="auth-req-icon">{reqMinLen ? <Check /> : '•'}</span>
                      <span>8+ characters</span>
                    </div>
                    <div className={`auth-req-item ${reqCases ? 'met' : ''}`}>
                      <span className="auth-req-icon">{reqCases ? <Check /> : '•'}</span>
                      <span>Uppercase &amp; lowercase</span>
                    </div>
                    <div className={`auth-req-item ${reqNumOrSym ? 'met' : ''}`}>
                      <span className="auth-req-icon">{reqNumOrSym ? <Check /> : '•'}</span>
                      <span>Number or symbol</span>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
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
                      {confirmPassword && (
                        <span
                          className="input-match-badge"
                          style={{ color: reqMatch ? '#20E3A2' : '#FF1744' }}
                          title={reqMatch ? 'Passwords match' : 'Passwords do not match'}
                        >
                          {reqMatch ? <CheckCircle2 /> : <AlertCircle />}
                        </span>
                      )}
                    </div>
                    {form.errors.confirmPassword && (
                      <p className="field-error" id="err-confirm">
                        <AlertCircle /> {form.errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="galaxy-btn-primary auth-submit-btn"
                    disabled={form.busy || form.authLoading}
                  >
                    {form.busy ? <Loader text="Creating account…" /> : 'Create Free Account →'}
                  </button>

                  <p className="form-foot center">
                    Already have an account?{' '}
                    <Link className="link-cyan" to="/signin" state={location.state}>
                      Sign In
                    </Link>
                  </p>
                </form>

                <div className="auth-security-foot">
                  <ShieldCheck style={{ width: 15, height: 15, color: '#19D9FF', flexShrink: 0 }} />
                  <span>
                    Passwords are encrypted with bcrypt. We never store plain text.
                  </span>
                </div>
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
