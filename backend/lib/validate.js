/** Shared request-validation and response helpers. */

/** An error that carries an HTTP status and a client-safe message. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details) this.details = details;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const NAME_MIN = 2;
const NAME_MAX = 80;

function validateSignup({ name, email, password, confirmPassword }) {
  const errors = {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) errors.name = 'Full name is required.';
  else if (trimmedName.length < NAME_MIN) errors.name = `Full name must be at least ${NAME_MIN} characters.`;
  else if (trimmedName.length > NAME_MAX) errors.name = `Full name must be ${NAME_MAX} characters or fewer.`;

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) errors.email = 'Email is required.';
  else if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) errors.email = 'Please enter a valid email address.';

  if (typeof password !== 'string' || !password) errors.password = 'Password is required.';
  else if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX) errors.password = 'Password must be 200 characters or fewer.';

  if (confirmPassword !== undefined) {
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  }

  return { errors, value: { name: trimmedName, email: normalizedEmail, password } };
}

function validateSignin({ email, password }) {
  const errors = {};

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) errors.email = 'Email is required.';
  else if (!EMAIL_REGEX.test(normalizedEmail)) errors.email = 'Please enter a valid email address.';

  if (typeof password !== 'string' || !password) errors.password = 'Password is required.';

  return { errors, value: { email: normalizedEmail, password } };
}

function validateOtpVerification({ email, otp }) {
  const errors = {};

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) errors.email = 'Email is required.';
  else if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) errors.email = 'Please enter a valid email address.';

  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) errors.otp = 'Enter the 6-digit code from your email.';

  return { errors, value: { email: normalizedEmail, otp } };
}

function validatePasswordReset({ email, resetToken, newPassword, confirmPassword }) {
  const errors = {};

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) errors.email = 'Email is required.';
  else if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) errors.email = 'Please enter a valid email address.';

  if (typeof resetToken !== 'string' || resetToken.length < 32 || resetToken.length > 128) {
    errors.resetToken = 'Please verify your email code again.';
  }

  if (typeof newPassword !== 'string' || !newPassword) errors.newPassword = 'Password is required.';
  else if (newPassword.length < PASSWORD_MIN) errors.newPassword = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (newPassword.length > PASSWORD_MAX) errors.newPassword = `Password must be ${PASSWORD_MAX} characters or fewer.`;

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match.';

  return { errors, value: { email: normalizedEmail, resetToken, newPassword } };
}

/** Throw a 400 with per-field messages if anything failed. */
function assertNoErrors(errors) {
  if (Object.keys(errors).length) {
    throw new HttpError(400, Object.values(errors)[0], errors);
  }
}

/**
 * Strip directory components, control characters and punctuation that could
 * confuse a filesystem or a browser download header. Never trust a
 * client-supplied name for anything other than display.
 */
function sanitizeFilename(name, fallback = 'file') {
  if (typeof name !== 'string') return fallback;
  const base = name.split(/[\\/]/).pop() || '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || fallback;
}

/** Strip the extension so a new one can be appended safely. */
function stripExtension(name) {
  return name.replace(/\.[^.]*$/, '');
}

/**
 * RFC 5987 Content-Disposition so non-ASCII filenames survive the round trip,
 * with a plain ASCII fallback for older clients.
 */
function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

module.exports = {
  HttpError,
  EMAIL_REGEX,
  validateSignup,
  validateSignin,
  validateOtpVerification,
  validatePasswordReset,
  assertNoErrors,
  sanitizeFilename,
  stripExtension,
  contentDisposition,
  formatBytes,
};
