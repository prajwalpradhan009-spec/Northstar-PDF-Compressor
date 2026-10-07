import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Star } from '../components/icons';
import { Loader } from '../components/Loader';
import Reveal from '../components/Reveal';
import { auth } from '../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [otpExpiresMinutes, setOtpExpiresMinutes] = useState(10);
  const [resendUntil, setResendUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    document.title = 'Reset Password — NorthStar';
  }, []);

  useEffect(() => {
    if (!resendUntil) return undefined;
    const timer = window.setInterval(() => {
      setCooldownSeconds(Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [resendUntil]);

  const startResendCooldown = () => {
    const until = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    setResendUntil(until);
    setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    setMessage('');

    try {
      if (step === 'email') {
        const normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
          throw new Error('Please enter a valid email address.');
        }
        const response = await auth.forgotPassword({ email: normalizedEmail });
        setEmail(normalizedEmail);
        setMessage(response.message);
        setOtpExpiresMinutes(response.expiresInMinutes || 10);
        startResendCooldown();
        setStep('otp');
      } else if (step === 'otp') {
        if (!/^\d{6}$/.test(otp)) throw new Error('Enter the 6-digit code from your email.');
        const response = await auth.verifyOtp({ email: email.trim(), otp });
        setResetToken(response.resetToken);
        setOtp('');
        setStep('password');
      } else if (step === 'password') {
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
        if (newPassword.length > 200) throw new Error('Password must be 200 characters or fewer.');
        if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');

        await auth.resetPassword({
          email: email.trim(),
          resetToken,
          newPassword,
          confirmPassword,
        });
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setStep('success');
      }
    } catch (error) {
      setFormError(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (busy || cooldownSeconds > 0) return;
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      const response = await auth.resendOtp({ email: email.trim() });
      setMessage(response.message);
      setOtpExpiresMinutes(response.expiresInMinutes || 10);
      setOtp('');
      startResendCooldown();
    } catch (error) {
      setFormError(error?.message || 'Could not send a new code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
    setFormError('');
    setCooldownSeconds(0);
    setResendUntil(0);
  };

  const title = {
    email: 'Forgot password?',
    otp: 'Verify your email',
    password: 'Choose a new password',
    success: 'Password reset successfully',
  }[step];

  const subtitle = {
    email: 'We’ll email you a code to securely reset your password.',
    otp: 'Enter the 6-digit verification code sent to your email.',
    password: 'Your email is verified. Create a strong new password.',
    success: 'Your password has been updated. You can now sign in with it.',
  }[step];

  return (
    <div className="page page--top page--narrow">
      <Reveal className="auth-card">
        <div className="glass-panel">
          <div className="auth-head">
            <span className="modal-icon" aria-hidden="true">
              {step === 'success' ? <CheckCircle2 /> : <Star />}
            </span>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-sub">{subtitle}</p>
          </div>

          {formError && (
            <div className="form-alert mb-20" role="alert">
              <AlertCircle />
              <span>{formError}</span>
            </div>
          )}

          {message && (
            <div className="form-alert form-alert--success mb-20" role="status">
              <CheckCircle2 />
              <span>{message}</span>
            </div>
          )}

          {step === 'success' ? (
            <div className="form">
              <button
                type="button"
                className="glass-button glass-button--block glass-button--lg"
                onClick={() => navigate('/signin', { replace: true, state: { passwordReset: true } })}
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={submit} noValidate>
              {step === 'email' && (
                <div className="field">
                  <label className="label" htmlFor="reset-email">
                    Email<span className="req" aria-hidden="true">*</span>
                  </label>
                  <div className="input-wrap">
                    <span className="input-icon" aria-hidden="true"><Mail /></span>
                    <input
                      id="reset-email"
                      className="glass-input"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setFormError('');
                      }}
                      disabled={busy}
                      required
                    />
                  </div>
                </div>
              )}

              {step === 'otp' && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="reset-otp">
                      6-digit verification code<span className="req" aria-hidden="true">*</span>
                    </label>
                    <div className="input-wrap">
                      <span className="input-icon" aria-hidden="true"><ShieldCheck /></span>
                      <input
                        id="reset-otp"
                        className="glass-input reset-code-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={otp}
                        onChange={(event) => {
                          setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                          setFormError('');
                        }}
                        disabled={busy}
                        required
                      />
                    </div>
                    <p className="text-dim text-sm">The code expires after {otpExpiresMinutes} minutes.</p>
                  </div>

                  <div className="auth-reset-actions">
                    <button
                      type="button"
                      className="link auth-forgot-resend"
                      onClick={resendOtp}
                      disabled={busy || cooldownSeconds > 0}
                    >
                      {cooldownSeconds > 0 ? `Resend code in ${cooldownSeconds}s` : 'Resend code'}
                    </button>
                    <button type="button" className="link auth-forgot-resend" onClick={changeEmail} disabled={busy}>
                      Change email
                    </button>
                  </div>
                </>
              )}

              {step === 'password' && (
                <>
                  <div className="field">
                    <label className="label" htmlFor="reset-password">
                      New password<span className="req" aria-hidden="true">*</span>
                    </label>
                    <div className="input-wrap">
                      <span className="input-icon" aria-hidden="true"><Lock /></span>
                      <input
                        id="reset-password"
                        className="glass-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={200}
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setFormError('');
                        }}
                        disabled={busy}
                        required
                      />
                      <button
                        type="button"
                        className="reveal-btn"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="reset-confirm-password">
                      Confirm new password<span className="req" aria-hidden="true">*</span>
                    </label>
                    <div className="input-wrap">
                      <span className="input-icon" aria-hidden="true"><Lock /></span>
                      <input
                        id="reset-confirm-password"
                        className="glass-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        maxLength={200}
                        placeholder="Enter your new password again"
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          setFormError('');
                        }}
                        disabled={busy}
                        required
                      />
                      <button
                        type="button"
                        className="reveal-btn"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        aria-label={showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'}
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="link auth-forgot-resend" onClick={changeEmail} disabled={busy}>
                    Start over and request a new code
                  </button>
                </>
              )}

              <button type="submit" className="glass-button glass-button--block glass-button--lg" disabled={busy}>
                {busy
                  ? <Loader text={step === 'email' ? 'Sending code…' : step === 'otp' ? 'Verifying code…' : 'Resetting password…'} />
                  : step === 'email' ? 'Send Verification Code' : step === 'otp' ? 'Verify Code' : 'Reset Password'}
              </button>

              <p className="form-foot center">
                Remembered your password? <Link className="link" to="/signin">Sign In</Link>
              </p>
            </form>
          )}
        </div>
      </Reveal>
    </div>
  );
}
