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

export default function SignIn() {
  const location = useLocation();
  const form = useAuthForm('signin');

  useEffect(() => {
    document.title = 'Sign In — NorthStar';
  }, []);

  const registeredEmail = location.state?.registeredEmail;
  const passwordReset = location.state?.passwordReset;
  const requiredFor = location.state?.requiredFor;

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
              <span>NORTHSTAR VAULT &bull; SECURE WORKSPACE</span>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="auth-hero-title">
              <span className="line-1">ACCESS YOUR</span>
              <span className="line-cyan">WORKFLOW.</span>
              <span className="line-sub">FAST. PRIVATE. REIMAGINED.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="auth-hero-desc">
              Sign in to unlock in-memory PDF merging, high-fidelity image compression,
              and private document workflows with zero permanent server retention.
            </p>
          </Reveal>

          {/* Floating 3D Holographic Processing Sphere / Card */}
          <Reveal delay={180}>
            <div className="auth-holo-card" aria-hidden="true">
              <div className="holo-card-inner">
                <div className="holo-header">
                  <div className="holo-live-pill">
                    <span className="live-dot" />
                    <span>SYSTEM ONLINE &bull; 100% PRIVATE</span>
                  </div>
                  <span className="holo-sub-tag">AES-256</span>
                </div>

                {/* Animated Data Stream Simulation */}
                <div className="holo-stream-wrap">
                  <div className="holo-stream-nodes">
                    <div className="holo-node holo-node--active">
                      <Layers style={{ width: 18, height: 18 }} />
                      <span>PDF Merger</span>
                    </div>
                    <div className="holo-node-arrow">&rarr;</div>
                    <div className="holo-node holo-node--active">
                      <FileImage style={{ width: 18, height: 18 }} />
                      <span>Compressor</span>
                    </div>
                  </div>
                  <div className="holo-stream-bar">
                    <div className="holo-stream-progress" />
                  </div>
                </div>

                <div className="holo-feature-grid">
                  <div className="holo-chip">
                    <Zap style={{ width: 15, height: 15, color: '#19D9FF' }} />
                    <span>0.8s In-Memory Processing</span>
                  </div>
                  <div className="holo-chip">
                    <ShieldCheck style={{ width: 15, height: 15, color: '#20E3A2' }} />
                    <span>Zero Storage Footprint</span>
                  </div>
                  <div className="holo-chip">
                    <Lock style={{ width: 15, height: 15, color: '#8057FF' }} />
                    <span>Bcrypt 12 Salt Rounds</span>
                  </div>
                  <div className="holo-chip">
                    <Sparkle style={{ width: 15, height: 15, color: '#19D9FF' }} />
                    <span>HttpOnly Cookie Isolation</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="auth-trust-list">
              <li>
                <Check style={{ width: 16, height: 16, color: '#19D9FF' }} />
                <span>Up to 20 files &amp; 1000 pages per merge</span>
              </li>
              <li>
                <Check style={{ width: 16, height: 16, color: '#20E3A2' }} />
                <span>Modern WebP, PNG &amp; JPG batch optimization</span>
              </li>
              <li>
                <Check style={{ width: 16, height: 16, color: '#8057FF' }} />
                <span>Sessions end automatically when page reloads</span>
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
                  <span className="auth-mode-tab active" role="tab" aria-selected="true">
                    Sign In
                  </span>
                  <Link
                    to="/signup"
                    state={location.state}
                    className="auth-mode-tab"
                    role="tab"
                    aria-selected="false"
                  >
                    Create Account
                  </Link>
                </div>

                <div className="auth-head">
                  <h2 className="auth-title">Welcome Back</h2>
                  <p className="auth-sub">Enter your credentials to access your workspace.</p>
                </div>

                {registeredEmail && (
                  <div className="form-alert form-alert--success mb-20" role="status">
                    <CheckCircle2 />
                    <span>
                      Account created successfully. You can sign in now as <strong>{registeredEmail}</strong>.
                    </span>
                  </div>
                )}

                {passwordReset && (
                  <div className="form-alert form-alert--success mb-20" role="status">
                    <CheckCircle2 />
                    <span>Your password has been reset. Sign in with your new password.</span>
                  </div>
                )}

                {requiredFor && (
                  <div className="form-alert mb-20" role="status">
                    <Lock />
                    <span>
                      You need an account to use {requiredFor}. Sign in below, or{' '}
                      <Link className="link-cyan" to="/signup" state={location.state}>
                        create a free account
                      </Link>
                      .
                    </span>
                  </div>
                )}

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
                    mode="signin"
                  />

                  <div className="auth-forgot-row">
                    <Link className="link-cyan" to="/forgot-password" state={{ email: form.fields.email }}>
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    className="galaxy-btn-primary auth-submit-btn"
                    disabled={form.busy || form.authLoading}
                  >
                    {form.busy ? <Loader text="Signing in…" /> : 'Sign In to Workspace →'}
                  </button>

                  <p className="form-foot center">
                    Don&apos;t have an account?{' '}
                    <Link className="link-cyan" to="/signup" state={location.state}>
                      Sign Up Free
                    </Link>
                  </p>
                </form>

                <div className="auth-security-foot">
                  <ShieldCheck style={{ width: 15, height: 15, color: '#19D9FF', flexShrink: 0 }} />
                  <span>
                    Sessions use secure HttpOnly cookies. Passwords hashed with bcrypt.
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
