const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Locate and load the backend .env file.
 * Render / Docker inject real environment variables, so a missing file is not
 * fatal there — dotenv simply becomes a no-op.
 */
function loadEnvFile() {
  const candidates = [
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, '..', '.env'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const dotenv = require('dotenv');
const envFile = loadEnvFile();
dotenv.config(envFile ? { path: envFile } : undefined);

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

const nodeEnv = readString('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const port = readNumber('PORT', 5000);
const mongoUri = readString('MONGODB_URI');
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

const problems = [];
const warnings = [];

if (!mongoUri) {
  problems.push('Missing required environment variable: MONGODB_URI');
} else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  problems.push('MONGODB_URI does not look like a valid MongoDB connection string.');
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
  cors: { frontendUrl, allowedOrigins, origins: corsOrigins },

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
module.exports.problems = problems;
module.exports.warnings = warnings;
