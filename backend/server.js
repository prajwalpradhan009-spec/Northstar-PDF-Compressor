const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const config = require('./config/env');
const db = require('./config/db');

const authRouter = require('./routes/auth');
const pdfRouter = require('./routes/pdf');
const imageRouter = require('./routes/image');
const dashboardRouter = require('./routes/dashboard');
const { uploadErrorHandler } = require('./middleware/upload');
const { HttpError } = require('./lib/validate');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ------------------------------------------------------------------ *
 * CORS — driven by ALLOWED_ORIGINS / FRONTEND_URL, never a blanket "*"
 * `credentials: true` is required for the auth cookie to travel.
 * ------------------------------------------------------------------ */

// Same-origin requests must always be allowed, whatever ALLOWED_ORIGINS says.
// When the API also serves the built frontend they share an origin, and a
// stale or unset FRONTEND_URL must not lock the live site out of its own API.
function isSelfOrigin(req, origin) {
  const host = req.headers.host;
  if (!host) return false;
  return (
    origin === `http://${host}` ||
    origin === `https://${host}` ||
    origin === `${req.protocol}://${host}`
  );
}

app.use(cors((req, callback) => {
  callback(null, {
    origin(origin, done) {
      // Same-origin requests, curl and health checks send no Origin header.
      if (!origin) return done(null, true);
      if (config.cors.origins.has(origin)) return done(null, true);
      if (isSelfOrigin(req, origin)) return done(null, true);
      return done(new Error(`Origin ${origin} is not allowed by ALLOWED_ORIGINS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['Content-Disposition', 'X-Page-Count', 'X-Source-Count', 'Content-Length'],
    maxAge: 86400,
  });
}));

if (config.env !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(require('cookie-parser')());

/* ------------------------------------------------------------------ *
 * Security headers
 * ------------------------------------------------------------------ */

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // API responses are JSON or opaque downloads, so they lock everything down.
  // The static frontend needs its own origin (plus inline styles and blob:
  // images, which the previews rely on) — otherwise `default-src 'none'`
  // would block the app's own script and stylesheets.
  res.setHeader(
    'Content-Security-Policy',
    req.path.startsWith('/api')
      ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
      : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
  );
  next();
});

/* ------------------------------------------------------------------ *
 * MongoDB
 * ------------------------------------------------------------------ */

db.connect();

/* ------------------------------------------------------------------ *
 * API routes
 * ------------------------------------------------------------------ */

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/image', imageRouter);

// Multer/magic-byte failures become clean 4xx JSON, never a stack trace.
app.use('/api', uploadErrorHandler);

app.get('/api/ping', (req, res) => res.json({ ok: true, time: Date.now() }));

app.get('/api/health', (req, res) => {
  const database = db.status();
  res.status(database === 'connected' ? 200 : 503).json({
    ok: database === 'connected',
    env: config.env,
    database,
    auth: config.auth.jwtSecret ? 'cookie-session' : 'unconfigured',
    limits: {
      pdf: {
        maxFiles: config.pdf.maxFiles,
        maxUploadMb: config.pdf.maxUploadMb,
        maxPages: config.pdf.maxPages,
      },
      image: {
        maxFiles: config.image.maxFiles,
        maxUploadMb: config.image.maxUploadMb,
        maxDimension: config.image.maxDimension,
      },
    },
    time: Date.now(),
  });
});

app.use('/api', (req) => {
  throw new HttpError(404, `Unknown API endpoint: ${req.method} ${req.path}`);
});

/* ------------------------------------------------------------------ *
 * Static frontend (frontend/dist in production, Vite in development)
 * ------------------------------------------------------------------ */

const frontendDistPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const backendPublicPath = config.publicDir;

let staticPath = null;
if (fs.existsSync(frontendDistPath)) {
  staticPath = frontendDistPath;
} else if (fs.existsSync(backendPublicPath)) {
  staticPath = backendPublicPath;
}

if (staticPath) {
  console.log(`[server] Serving static files from: ${staticPath}`);
  app.use(express.static(staticPath));
}

// SPA fallback for client-side routing (/signin, /image-compressor, /dashboard…)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = staticPath ? path.join(staticPath, 'index.html') : null;
  if (indexPath && fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(200).send('NorthStar API is running. Start the frontend on http://localhost:5173 for the app.');
});

/* ------------------------------------------------------------------ *
 * Last-resort error handler — never leaks a stack trace
 * ------------------------------------------------------------------ */

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && /not allowed by ALLOWED_ORIGINS/.test(String(err.message))) {
    return res.status(403).json({ error: 'This origin is not allowed to use the NorthStar API.' });
  }

  const status = err instanceof HttpError ? err.status : err?.status || err?.statusCode || 500;
  const body = { error: err?.message || 'Something went wrong on the server. Please try again.' };
  if (err?.details) body.details = err.details;

  if (status >= 500) {
    console.error('[server] unhandled error:', err && (err.stack || err.message));
    // Do not echo internal messages for unexpected failures.
    body.error = 'Something went wrong on the server. Please try again.';
    delete body.details;
  } else if (!config.isTest) {
    console.warn(`[server] ${status}: ${err?.message}`);
  }

  return res.status(status).json(body);
});

const server = app.listen(config.port, () => {
  console.log(`\n  NorthStar API listening on http://localhost:${config.port} (${config.env})`);
  console.log(`  Allowed origins: ${[...config.cors.origins].join(', ') || 'none configured'}`);
  console.log(`  MongoDB: ${config.mongo.uri ? config.mongo.uri.replace(/\/\/([^@]*)@/, '//***@') : 'not configured'}\n`);
});

const shutdown = () => {
  server.close(() => {
    db.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
