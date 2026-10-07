const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Locate and load backend environment files. `.env.local` is loaded first so
 * developer-specific settings can override `.env` without replacing its
 * unrelated secrets or shared configuration.
 * Render / Docker inject real environment variables, so a missing file is not
 * fatal there — dotenv simply becomes a no-op.
 */
function loadEnvFiles() {
  const candidates = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, '..', '.env.local'),
    path.join(ROOT_DIR, '..', '.env'),
  ];
  let firstLoaded = null;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    dotenv.config({ path: candidate });
    if (!firstLoaded) firstLoaded = candidate;
  }
  return firstLoaded;
}

const dotenv = require('dotenv');
const envFile = loadEnvFiles();

/** Values that must never reach production — caught at boot, not at first request. */
const PLACEHOLDERS = new Set([
  'replace_with_a_long_random_secret',
  'replace-with-a-long-random-secret',
  'your_jwt_secret_here',
  'your_strong_secret',
  'changeme',
  'secret',
  'northstar-secret-key',
]);

const MIN_SECRET_LENGTH = 32;

function readString(key, fallback = '') {
  const raw = process.env[key];
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : fallback;
}

function readNumber(key, fallback) {
  const raw = readString(key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readList(key) {
  return readString(key)
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const DEFAULT_MONGO_DB = 'northstar';

const nodeEnv = readString('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const port = readNumber('PORT', 5000);
const rawMongoUri = readString('MONGODB_URI');
const mongoUri = withDefaultMongoDatabase(rawMongoUri);
const jwtSecret = readString('JWT_SECRET');
const frontendUrl = readString('FRONTEND_URL').replace(/\/+$/, '');
const allowedOrigins = readList('ALLOWED_ORIGINS');

/**
 * Allow the configured FRONTEND_URL as an origin too, so a single value is
 * enough. Requests with no Origin header (curl, health checks) pass through.
 */
const corsOrigins = new Set(allowedOrigins);
if (frontendUrl) corsOrigins.add(frontendUrl);

const pdfMaxFiles = readNumber('PDF_MAX_FILES', 20);
const pdfMaxUploadMb = readNumber('PDF_MAX_UPLOAD_MB', 50);
const pdfMaxPages = readNumber('PDF_MAX_PAGES', 1000);
const imageMaxFiles = readNumber('IMAGE_MAX_FILES', 20);
const imageMaxUploadMb = readNumber('IMAGE_MAX_UPLOAD_MB', 15);
const imageMaxDimension = readNumber('IMAGE_MAX_DIMENSION_PX', 8000);
const sessionMaxAgeDays = readNumber('SESSION_MAX_AGE_DAYS', 7);
const smtpHost = readString('SMTP_HOST', 'smtp.gmail.com');
const smtpUser = readString('EMAIL_USER') || readString('SMTP_USER');
const smtpPass = (readString('EMAIL_APP_PASSWORD') || readString('SMTP_PASS')).replace(/\s+/g, '');
const smtpFrom = readString('SMTP_FROM', smtpUser);
const smtpPort = readNumber('SMTP_PORT', 587);
const smtpSecure = readString('SMTP_SECURE').toLowerCase() === 'true';
const otpExpiresMinutes = Math.min(60, readNumber('OTP_EXPIRES_MINUTES', 10));

/**
 * Extract the database name from a connection string.
 *
 * Returns null when the path segment is missing or empty, which is the case
 * that silently resolves to the "test" database at runtime.
 */
function mongoDatabaseName(uri) {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const afterCredentials = withoutScheme.slice(withoutScheme.indexOf('@') + 1);
  const slash = afterCredentials.indexOf('/');
  if (slash === -1) return null;
  const name = afterCredentials.slice(slash + 1).split('?')[0].trim();
  return name.length ? name : null;
}

/**
 * Insert the default database name when the configured URI omits it.
 *
 * Atlas URIs copied from the dashboard frequently end at the host with only a
 * query string, which makes the driver fall back to a database named "test".
 * Repairing it here means a forgotten path segment costs accounts in a hidden
 * database instead of taking the whole service down.
 */
function withDefaultMongoDatabase(uri) {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) return uri;
  if (mongoDatabaseName(uri)) return uri;

  const scheme = uri.match(/^mongodb(\+srv)?:\/\//)[0];
  const withoutScheme = uri.slice(scheme.length);
  const at = withoutScheme.indexOf('@');

  // A local URI may carry no credentials at all, in which case there is no "@"
  // to split on and everything after the scheme is the host.
  const credentials = at === -1 ? '' : withoutScheme.slice(0, at);
  const rest = at === -1 ? withoutScheme : withoutScheme.slice(at + 1);
  const prefix = at === -1 ? scheme : `${scheme}${credentials}@`;

  // Split a trailing query string (e.g. "?appName=Cluster3") off the host.
  const queryAt = rest.indexOf('?');
  const host = queryAt === -1 ? rest : rest.slice(0, queryAt);
  const query = queryAt === -1 ? '' : rest.slice(queryAt);

  // The path may already be present but empty ("host/?appName=X"), so trim any
  // trailing slashes to avoid producing "host//northstar".
  return `${prefix}${host.replace(/\/+$/, '')}/${DEFAULT_MONGO_DB}${query}`;
}

const problems = [];
const warnings = [];

if (!mongoUri) {
  problems.push('Missing required environment variable: MONGODB_URI');
} else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  problems.push('MONGODB_URI does not look like a valid MongoDB connection string.');
} else if (!mongoDatabaseName(rawMongoUri)) {
  // The URI omitted its database name, so it has been repaired above. Warn so
  // the env var gets corrected, but keep serving — refusing to boot would take
  // the entire site offline for a configuration detail that is already handled.
  warnings.push(
    `MONGODB_URI had no database name and was normalised to "${mongoUri.replace(
      /\/\/[^@]*@/,
      '//***@',
    )}". Set MONGODB_URI to include /${DEFAULT_MONGO_DB} so the value in your `
      + 'dashboard matches what the app uses.',
  );
}

if (!jwtSecret) {
  problems.push('Missing required environment variable: JWT_SECRET');
} else if (PLACEHOLDERS.has(jwtSecret.toLowerCase())) {
  problems.push(
    isProduction
      ? 'JWT_SECRET still uses the placeholder value. Generate a long random secret before deploying.'
      : 'JWT_SECRET is still the placeholder value. Sessions are insecure until you replace it.',
  );
} else if (jwtSecret.length < MIN_SECRET_LENGTH) {
  problems.push(`JWT_SECRET is too short. Use at least ${MIN_SECRET_LENGTH} characters.`);
}

if (!corsOrigins.size) {
  problems.push(
    'Missing required environment variable: ALLOWED_ORIGINS (or FRONTEND_URL) — browser requests will be blocked by CORS.',
  );
}

if (!readString('PORT') && isProduction) {
  warnings.push('PORT is not set. Most hosts inject PORT automatically.');
}

if (problems.length && !isTest) {
  const details = problems.map((line) => `  - ${line}`).join('\n');
  console.error(`\n[env] Invalid server configuration:\n${details}\n`);
  console.error(`[env] Expected a .env file at: ${envFile || path.join(ROOT_DIR, '.env')}`);
  console.error('[env] See backend/.env.example for the full list of supported variables.\n');
  if (isProduction) {
    throw new Error('Invalid server configuration. See the logs above for details.');
  }
}

if (warnings.length && !isTest) {
  const details = warnings.map((line) => `  - ${line}`).join('\n');
  console.warn(`\n[env] Configuration warnings:\n${details}\n`);
}

const config = Object.freeze({
  env: nodeEnv,
  isProduction,
  isTest,
  port,
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  envFile,

  mongo: { uri: mongoUri },
  auth: {
    jwtSecret,
    sessionMaxAgeDays,
    cookieName: 'northstar_session',
    maxAgeMs: sessionMaxAgeDays * 24 * 60 * 60 * 1000,
  },
  email: {
    configured: Boolean(smtpHost && smtpUser && smtpPass && smtpFrom),
    otpExpiresMinutes,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    },
    from: smtpFrom,
  },
  cors: { frontendUrl, allowedOrigins, origins: corsOrigins },

  // Declared inside the frozen object on purpose: assigning to a frozen
  // `module.exports` afterwards silently drops the values, which made these
  // validation results unreadable to anything inspecting the config.
  problems: [...problems],
  warnings: [...warnings],

  pdf: {
    maxFiles: pdfMaxFiles,
    maxUploadMb: pdfMaxUploadMb,
    maxUploadBytes: Math.round(pdfMaxUploadMb * 1024 * 1024),
    maxPages: pdfMaxPages,
    // Total across all files in one request, kept 1.5x the per-file cap.
    maxTotalBytes: Math.round(pdfMaxUploadMb * 1024 * 1024 * pdfMaxFiles),
  },
  image: {
    maxFiles: imageMaxFiles,
    maxUploadMb: imageMaxUploadMb,
    maxUploadBytes: Math.round(imageMaxUploadMb * 1024 * 1024),
    maxTotalBytes: Math.round(imageMaxUploadMb * 1024 * 1024 * imageMaxFiles),
    maxDimension: imageMaxDimension,
    allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
  },
});

module.exports = config;
