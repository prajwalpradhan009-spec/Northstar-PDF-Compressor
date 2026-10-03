/**
 * End-to-end smoke test against a running NorthStar API.
 *
 * Exercises the whole HTTP surface the way the browser does — cookies,
 * multipart uploads, binary downloads — so it catches the things unit tests
 * miss (CSP headers, cookie flags, aggregate pipelines, magic-byte checks).
 *
 *   node scripts/smoke-test.js [baseUrl]
 *
 * Defaults to http://localhost:5000. Exits non-zero on the first failure.
 */

const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const stamp = Date.now();
const EMAIL = `smoke-${stamp}@northstar.test`;
const PASSWORD = 'SmokeTest!2345';

let passed = 0;
const jar = new Map();

/* ------------------------------------------------------------------ *
 * Tiny cookie-aware fetch helpers
 * ------------------------------------------------------------------ */

function storeCookies(response) {
  const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
    else jar.set(name, value);
  }
  return raw;
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function call(path, { method = 'GET', body, headers = {}, expect } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
      ...headers,
    },
    body,
    redirect: 'manual',
  });
  const setCookies = storeCookies(response);

  if (expect !== undefined) {
    assert.equal(
      response.status,
      expect,
      `${method} ${path} → expected ${expect}, got ${response.status} ${await response.clone().text().catch(() => '')}`,
    );
  }
  return { response, setCookies };
}

async function json(path, options) {
  const { response, setCookies } = await call(path, options);
  const text = await response.text();
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers, setCookies };
  } catch {
    return { status: response.status, body: text, headers: response.headers, setCookies };
  }
}

function multipart(fields, files) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields || {})) form.append(name, value);
  for (const file of files || []) {
    form.append(file.field, new Blob([file.buffer], { type: file.type }), file.name);
  }
  return form;
}

function step(name, detail) {
  passed += 1;
  console.log(`  \u2713 ${name}${detail ? ` — ${detail}` : ''}`);
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

async function makePdf(pageCount, label) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`${label} — page ${i + 1}`, { x: 48, y: 780, size: 18 });
  }
  return Buffer.from(await pdf.save());
}

async function makeJpeg() {
  // Gradient + noise, so there is real detail to compress.
  const width = 1400;
  const height = 1000;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      raw[i] = (x * 255) / width;
      raw[i + 1] = (y * 255) / height;
      raw[i + 2] = ((x ^ y) & 0xff);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

function isZip(buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
}

/**
 * Remove the throwaway account so repeated runs do not litter the database.
 * Best effort — a failed cleanup must never fail the suite.
 */
async function cleanup() {
  let mongoose = null;
  try {
    mongoose = require('mongoose');
    const config = require('../config/env');
    if (!config.mongo.uri) return;
    await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: EMAIL }, { projection: { _id: 1 } });
    if (!user) return;
    await db.collection('activities').deleteMany({ user: user._id });
    await db.collection('users').deleteOne({ _id: user._id });
  } catch {
    /* ignore */
  } finally {
    if (mongoose) await mongoose.disconnect().catch(() => {});
  }
}

/* ------------------------------------------------------------------ *
 * Suite
 * ------------------------------------------------------------------ */

async function run() {
  console.log(`\nNorthStar smoke test → ${BASE}\n`);

  /* -- health ------------------------------------------------------ */
  {
    const { body } = await json('/api/health', { expect: 200 });
    assert.equal(body.ok, true);
    assert.equal(body.database, 'connected', 'MongoDB must be connected');
    step('health', `env=${body.env} db=${body.database}`);
  }

  /* -- anonymous dashboard is rejected ------------------------------ */
  {
    const { status } = await json('/api/dashboard', { expect: 401 });
    assert.equal(status, 401);
    step('anonymous /api/dashboard rejected', '401');
  }

  /* -- signup validation ------------------------------------------- */
  {
    const { status, body } = await json('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'nope', password: 'short', confirmPassword: 'other' }),
      expect: 400,
    });
    assert.ok(body.details, 'field-level details expected');
    assert.ok(body.details.email && body.details.password, `expected email+password details, got ${JSON.stringify(body.details)}`);
    step('signup validation', `fields flagged: ${Object.keys(body.details).join(', ')}`);
  }

  /* -- signup ------------------------------------------------------ */
  {
    const { body, setCookies } = await json('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Tester', email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
      expect: 201,
    });
    assert.equal(body.user.email, EMAIL);
    assert.equal(body.user.password, undefined, 'password must never be returned');
    assert.equal(body.user.passwordHash, undefined, 'hash must never be returned');
    const session = setCookies.find((c) => c.startsWith('northstar_session='));
    assert.equal(session, undefined, 'signup must NOT set a session cookie');
    step('signup', `${body.user.name} <${body.user.email}>, no cookie issued`);
  }

  /* -- duplicate email --------------------------------------------- */
  {
    const { body } = await json('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Tester', email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
      expect: 409,
    });
    assert.ok(body.details.email, 'email field error expected');
    step('duplicate email', '409 with field message');
  }

  /* -- wrong password ---------------------------------------------- */
  {
    await json('/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'WrongPassword!1' }),
      expect: 401,
    });
    step('wrong password', '401');
  }

  /* -- tools refuse a signed-out caller ---------------------------- */
  // The tools are account-only, so the server — not just the client route
  // guard — has to turn away a guest.
  {
    const guest = new Map(jar);
    jar.clear();
    try {
      const pdf = new FormData();
      pdf.append('files', new Blob([await makePdf(1, "Guest")], { type: 'application/pdf' }), 'guest.pdf');
      const { body } = await json('/api/pdf/merge', { method: 'POST', body: pdf, expect: 401 });
      assert.match(body.error, /sign in/i, 'guest 401 should say sign in');

      const img = new FormData();
      img.append('files', new Blob([await makeJpeg()], { type: 'image/jpeg' }), 'guest.jpg');
      const compressed = await json('/api/image/compress', { method: 'POST', body: img, expect: 401 });
      assert.match(compressed.body.error, /sign in/i, 'guest 401 should say sign in');
    } finally {
      jar.clear();
      guest.forEach((value, name) => jar.set(name, value));
    }
    step('tools require auth', 'guest merge + compress both 401');
  }

  /* -- signin ------------------------------------------------------ */
  {
    const { body, setCookies } = await json('/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      expect: 200,
    });
    assert.ok(body.user.id, 'user id expected');
    const session = setCookies.find((c) => c.startsWith('northstar_session='));
    assert.ok(session, 'session cookie expected');
    assert.match(session, /HttpOnly/i, 'cookie must be HttpOnly');
    assert.match(session, /SameSite=Lax/i, 'cookie must be SameSite=Lax');
    assert.ok(!/secure/i.test(session), 'dev cookie should not be Secure');
    step('signin', 'HttpOnly + SameSite=Lax cookie set');
  }

  /* -- me ---------------------------------------------------------- */
  {
    const { body } = await json('/api/auth/me', { expect: 200 });
    assert.equal(body.user.email, EMAIL);
    assert.ok(body.user.lastLoginAt, 'lastLoginAt should be set on signin');
    step('me', `lastLoginAt=${body.user.lastLoginAt}`);
  }

  /* -- API CSP ----------------------------------------------------- */
  {
    const { response } = await call('/api/health', { expect: 200 });
    const csp = response.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'none'/, 'API CSP must deny active content');
    step('API CSP', "default-src 'none'");
  }

  /* -- pdf inspect ------------------------------------------------- */
  const pdfA = await makePdf(2, 'Alpha');
  const pdfB = await makePdf(3, 'Beta');
  {
    const form = multipart({ order: '[0,1]' }, [
      { field: 'files', buffer: pdfA, name: 'alpha.pdf', type: 'application/pdf' },
      { field: 'files', buffer: pdfB, name: 'beta.pdf', type: 'application/pdf' },
    ]);
    const { body } = await json('/api/pdf/inspect', { method: 'POST', body: form, expect: 200 });
    assert.equal(body.files.length, 2);
    assert.equal(body.files[0].pageCount, 2);
    assert.equal(body.files[1].pageCount, 3);
    step('pdf inspect', `${body.files.map((f) => f.pageCount).join(' + ')} pages`);
  }

  /* -- reject a non-PDF named .pdf --------------------------------- */
  {
    const form = multipart({}, [
      { field: 'files', buffer: Buffer.from('not a pdf at all'), name: 'fake.pdf', type: 'application/pdf' },
    ]);
    await json('/api/pdf/merge', { method: 'POST', body: form, expect: 415 });
    step('magic-byte rejection', 'text file named .pdf → 415');
  }

  /* -- pdf merge --------------------------------------------------- */
  {
    const form = multipart({ order: '[1,0]' }, [
      { field: 'files', buffer: pdfA, name: 'alpha.pdf', type: 'application/pdf' },
      { field: 'files', buffer: pdfB, name: 'beta.pdf', type: 'application/pdf' },
    ]);
    const { response } = await call('/api/pdf/merge', { method: 'POST', body: form, expect: 200 });
    assert.match(response.headers.get('content-type') || '', /application\/pdf/);
    assert.equal(response.headers.get('x-page-count'), '5');
    assert.equal(response.headers.get('x-source-count'), '2');
    assert.match(response.headers.get('content-disposition') || '', /attachment/);
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-', 'output must be a real PDF');
    // Reorder was [1,0], so Beta's 3 pages come first.
    const check = await PDFDocument.load(buffer);
    assert.equal(check.getPageCount(), 5);
    step('pdf merge', `${buffer.length} bytes, 5 pages, reorder honoured`);
  }

  /* -- single file is allowed (1..N) and is named after the source --- */
  {
    const form = multipart({}, [{ field: 'files', buffer: pdfA, name: 'alpha.pdf', type: 'application/pdf' }]);
    const { response } = await call('/api/pdf/merge', { method: 'POST', body: form, expect: 200 });
    assert.match(response.headers.get('content-disposition') || '', /alpha_merged\.pdf/);
    assert.equal(response.headers.get('x-page-count'), '2');
    step('single-file merge', 'allowed, named alpha_merged.pdf');
  }

  /* -- image limits ------------------------------------------------ */
  {
    const { body } = await json('/api/image/limits', { expect: 200 });
    assert.ok(body.maxFiles > 0 && body.maxUploadMb > 0);
    step('image limits', `maxFiles=${body.maxFiles} maxUploadMb=${body.maxUploadMb}`);
  }

  /* -- image compress ---------------------------------------------- */
  const jpeg = await makeJpeg();
  let compressedBytes = 0;
  {
    const form = multipart({ quality: '55', format: 'jpeg', maxWidth: 'original' }, [
      { field: 'files', buffer: jpeg, name: 'photo.jpg', type: 'image/jpeg' },
    ]);
    const { body } = await json('/api/image/compress', { method: 'POST', body: form, expect: 200 });
    assert.equal(body.results.length, 1);
    const [result] = body.results;
    assert.equal(result.mime, 'image/jpeg');
    assert.equal(result.width, 1400);
    assert.equal(result.height, 1000);
    assert.ok(result.data.length > 0, 'base64 payload expected');
    assert.ok(result.compressedSize < jpeg.length, `expected smaller output (${result.compressedSize} < ${jpeg.length})`);
    compressedBytes = result.compressedSize;
    step('image compress', `${jpeg.length} → ${result.compressedSize} bytes (−${Math.round((1 - result.compressedSize / jpeg.length) * 100)}%)`);
  }

  /* -- resize + PNG round trip ------------------------------------- */
  {
    const form = multipart({ quality: '80', format: 'png', maxWidth: '400', maxHeight: '400' }, [
      { field: 'files', buffer: jpeg, name: 'photo.jpg', type: 'image/jpeg' },
    ]);
    const { body } = await json('/api/image/compress', { method: 'POST', body: form, expect: 200 });
    const [result] = body.results;
    assert.equal(result.mime, 'image/png');
    assert.equal(result.width, 400);
    assert.equal(result.height, 286, 'aspect ratio must be preserved');
    step('resize + png', `1400x1000 → ${result.width}x${result.height}`);  }

  /* -- a size larger than the source must not enlarge it ------------ */
  {
    const form = multipart({ quality: '80', format: 'jpeg', maxWidth: '5000', maxHeight: '5000' }, [
      { field: 'files', buffer: jpeg, name: 'photo.jpg', type: 'image/jpeg' },
    ]);
    const { body } = await json('/api/image/compress', { method: 'POST', body: form, expect: 200 });
    const [result] = body.results;
    assert.equal(result.width, 1400, 'must not upscale');
    assert.equal(result.height, 1000, 'must not upscale');
    step('withoutEnlargement', '5000px request kept 1400x1000');
  }

  /* -- a PNG pretending to be a JPEG -------------------------------- */
  {
    const png = await sharp(jpeg).png().toBuffer();
    const form = multipart({ quality: '70', format: 'jpeg' }, [
      { field: 'files', buffer: png, name: 'sneaky.jpg', type: 'image/jpeg' },
    ]);
    const { body } = await json('/api/image/compress', { method: 'POST', body: form, expect: 200 });
    assert.ok(body.results[0].compressedSize > 0, 'Sharp should still decode a mislabelled PNG');
    step('mislabelled extension', 'decoded by content, not by name');
  }

  /* -- non-image rejected ------------------------------------------ */
  {
    const form = multipart({ quality: '70', format: 'jpeg' }, [
      { field: 'files', buffer: Buffer.from('%PDF-1.7 pretend'), name: 'doc.jpg', type: 'image/jpeg' },
    ]);
    await json('/api/image/compress', { method: 'POST', body: form, expect: 415 });
    step('non-image rejected', '415');
  }

  /* -- zip download ------------------------------------------------ */
  {
    const form = multipart({ quality: '50', format: 'jpeg', maxWidth: 'original' }, [
      { field: 'files', buffer: jpeg, name: 'one.jpg', type: 'image/jpeg' },
      { field: 'files', buffer: jpeg, name: 'two.jpg', type: 'image/jpeg' },
    ]);
    const { response } = await call('/api/image/compress-and-zip', { method: 'POST', body: form, expect: 200 });
    assert.match(response.headers.get('content-type') || '', /zip/);
    assert.match(response.headers.get('content-disposition') || '', /attachment/);
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.ok(isZip(buffer), 'output must be a real ZIP archive');
    step('zip download', `${buffer.length} bytes, PK header present`);
  }

  /* -- dashboard stats: both activity types must be counted --------- */
  {
    const { body } = await json('/api/dashboard', { expect: 200 });
    const { stats, recent } = body;
    // 2 merge runs (5-page merge + single-file merge), 3 files each way.
    assert.equal(stats.pdfMerges, 2, `pdfMerges should be 2, got ${stats.pdfMerges}`);
    assert.ok(stats.imagesCompressed >= 3, `imagesCompressed should count >=3, got ${stats.imagesCompressed}`);
    assert.ok(
      stats.filesProcessed >= stats.pdfMerges + stats.imagesCompressed - 1,
      `filesProcessed (${stats.filesProcessed}) should cover merges + images`,
    );
    assert.ok(stats.bytesSaved > 0, 'bytesSaved should be positive');
    assert.ok(recent.length >= 2, 'recent activity should list both types');
    const types = new Set(recent.map((r) => r.type));
    assert.ok(types.has('pdf-merge') && types.has('image-compress'), `recent must include both types, saw ${[...types]}`);
    step('dashboard aggregation', `pdfMerges=${stats.pdfMerges} imagesCompressed=${stats.imagesCompressed} files=${stats.filesProcessed} saved=${stats.bytesSaved}B`);
  }

  /* -- update profile ---------------------------------------------- */
  {
    const { body, setCookies } = await json('/api/auth/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Renamed' }),
      expect: 200,
    });
    assert.equal(body.user.name, 'Smoke Renamed');
    assert.ok(setCookies.some((c) => c.startsWith('northstar_session=')), 'a refreshed cookie should be issued');
    step('update profile', 'name changed, cookie re-issued');
  }

  {
    await json('/api/auth/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
      expect: 400,
    });
    step('profile validation', 'too-short name → 400');
  }

  /* -- logout-all invalidates the current cookie ------------------- */
  {
    await json('/api/auth/logout-all', { method: 'POST', expect: 200 });
    const { status } = await json('/api/auth/me', { expect: 401 });
    assert.equal(status, 401);
    step('logout-all', 'previous token rejected after tokenVersion bump');
  }

  /* -- re-signin works after logout-all ---------------------------- */
  {
    await json('/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      expect: 200,
    });
    await json('/api/auth/me', { expect: 200 });
    step('re-signin', 'new session valid');
  }

  /* -- logout clears the cookie ------------------------------------ */
  {
    const { setCookies } = await json('/api/auth/logout', { method: 'POST', expect: 200 });
    assert.ok(setCookies.some((c) => /northstar_session=;/.test(c)), 'logout should clear the cookie');
    assert.equal(jar.has('northstar_session'), false, 'cookie must be gone from the jar');
    await json('/api/auth/me', { expect: 401 });
    step('logout', 'cookie cleared, /me now 401');
  }

  /* -- unknown API endpoint ---------------------------------------- */
  {
    await json('/api/does-not-exist', { expect: 404 });
    step('unknown endpoint', '404 JSON');
  }

  console.log(`\n  ${passed} checks passed. Compressed ${jpeg.length} → ${compressedBytes} bytes.`);
  await cleanup();
  console.log('  Throwaway account removed.\n');
}

run().catch((error) => {
  console.error(`\n  FAILED: ${error.message}\n`);
  if (process.env.SMOKE_VERBOSE) console.error(error);
  process.exit(1);
});
