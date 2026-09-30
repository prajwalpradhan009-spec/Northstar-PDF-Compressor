/**
 * Browser check for the account gate and the per-page-load session.
 *
 * The tools are account-only and a refresh must force a fresh sign-in, but both
 * of those live in the React tree rather than in a single handler, so they are
 * easy to break with an unrelated edit. This drives the real pages in headless
 * Chrome over the DevTools protocol and asserts the whole journey: a signed-out
 * visitor is redirected, signing in returns them to the tool they wanted, a
 * client-side hop stays signed in, and a reload signs them out.
 *
 *   node scripts/gate-check.js [url]
 *
 * Needs the dev server running and Chrome installed. Uses Node's built-in
 * WebSocket, so there is nothing to install. Creates a throwaway account and
 * deletes it afterwards.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5173';
const PORT = Number(process.env.CDP_PORT || 9334);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      const entry = this.pending.get(m.id);
      if (!entry) return;
      this.pending.delete(m.id);
      if (m.error) entry.reject(new Error(`${m.error.message} (${entry.method})`));
      else entry.resolve(m.result);
    });
  }
  send(method, params = {}) {
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  }
  /** Poll until `expression` is truthy, so we never race React. */
  async waitFor(expression, label, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.eval(`!!(${expression})`)) return true;
      await sleep(150);
    }
    throw new Error(`timed out waiting for: ${label}`);
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new Cdp(ws)));
    ws.addEventListener('error', () => reject(new Error('ws failed')));
  });
}

const failures = [];
const check = (name, pass, detail) => {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures.push(name);
};

const FILL = (email, password) => `  (() => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      const proto = el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('auth-email', ${JSON.stringify(email)});
    set('auth-password', ${JSON.stringify(password)});
    return true;
  })()`;

/**
 * Remove the throwaway account so repeated runs do not litter the database.
 * Best effort — a failed cleanup must never fail the run.
 */
async function cleanup(email) {
  let mongoose = null;
  try {
    mongoose = require('mongoose');
    const config = require('../config/env');
    if (!config.mongo.uri) return;
    await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email }, { projection: { _id: 1 } });
    if (!user) return;
    await db.collection('activities').deleteMany({ user: user._id });
    await db.collection('users').deleteOne({ _id: user._id });
    console.log(`  Throwaway account ${email} removed.`);
  } catch {
    /* ignore */
  } finally {
    if (mongoose) await mongoose.disconnect().catch(() => {});
  }
}

async function main() {
  const profile = path.join(process.env.TEMP, 'northstar-gate-profile');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--window-size=1280,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  const email = `gate_${Date.now()}@example.com`;
  const password = 'Passw0rd!2345';

  try {
    for (let i = 0; i < 40; i += 1) {
      try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); }
    }
    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    cdp = await connect(targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl).webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const consoleErrors = [];
    cdp.ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      if (m.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      }
    });

    /* ---- 1. the gate blocks a signed-out visitor ------------------- */
    console.log('\n1. signed-out visitor hits /pdf-merger');
    await cdp.send('Page.navigate', { url: `${BASE}/pdf-merger` });
    // Wait for the rendered reason, not just the URL: the router updates the
    // location a tick before React commits the new page into the DOM.
    await cdp.waitFor(
      `location.pathname === '/signin' && document.querySelector('.form-alert')`,
      'signin page explaining the stop',
    );
    const gate = await cdp.eval(`(() => ({
      path: location.pathname,
      alert: document.querySelector('.form-alert')?.textContent.trim().replace(/\\s+/g, ' ') || null,
    }))()`);
    check('redirected to /signin', gate.path === '/signin', gate.path);
    check('explains the stop', /need an account to use the PDF Merger/i.test(gate.alert || ''), gate.alert);

    await cdp.send('Page.navigate', { url: `${BASE}/image-compressor` });
    await cdp.waitFor(`location.pathname === '/signin'`, 'redirect from compressor');
    const gate2 = await cdp.eval(`location.pathname`);
    check('image compressor gated too', gate2 === '/signin', gate2);

    /* ---- 2. branding assets --------------------------------------- */
    console.log('\n2. logo assets');
    const brand = await cdp.eval(`(async () => {
      const imgs = [...document.querySelectorAll('.brand-logo')].map((i) => ({
        src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight,
      }));
      const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href');
      const status = await fetch(favicon).then((r) => r.status);
      const logoStatus = await fetch('/logo-128.png').then((r) => r.status);
      return { imgs, favicon, faviconStatus: status, logoStatus, count: imgs.length };
    })()`);
    check('logo in navbar and footer', brand.count >= 2, `${brand.count} found`);
    check('logo actually decoded', brand.imgs.every((i) => i.w > 0 && i.h > 0), JSON.stringify(brand.imgs));
    check('favicon points at the new png', brand.favicon === '/favicon-64.png', brand.favicon);
    check('favicon + logo served', brand.faviconStatus === 200 && brand.logoStatus === 200,
      `favicon ${brand.faviconStatus}, logo ${brand.logoStatus}`);

    /* ---- 3. sign in through the real form ------------------------- */
    console.log('\n3. sign in through the form');
    
    const created = await cdp.eval(`(async () => {
      const r = await fetch('/api/auth/signup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gate Test', email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)} }),
      });
      return r.status;
    })()`);
    check('test account created', created === 201, `HTTP ${created}`);

    await cdp.send('Page.navigate', { url: `${BASE}/pdf-merger` });
    await cdp.waitFor(
      `location.pathname === '/signin' && document.getElementById('auth-password')`,
      'signin form',
    );
    await cdp.eval(FILL(email, password));
    await cdp.eval(`document.querySelector('form button[type=submit]').click()`);
    await cdp.waitFor(`location.pathname === '/pdf-merger'`, 'return to the tool after sign-in');
    await cdp.waitFor(`document.querySelector('.dropzone') || document.querySelector('.file-list') || document.querySelector('[class*=drop]')`, 'the merger UI');

    const afterSignin = await cdp.eval(`(() => ({
      path: location.pathname,
      signedIn: !!document.querySelector('.user-trigger'),
      hasHeadings: document.querySelectorAll('h1').length,
    }))()`);
    check('landed back on /pdf-merger', afterSignin.path === '/pdf-merger', afterSignin.path);
    check('navbar shows the user', afterSignin.signedIn);

    /* ---- 4. client-side navigation keeps the session --------------- */
    console.log('\n4. client-side navigation stays signed in');
    await cdp.eval(`(() => {
      const link = [...document.querySelectorAll('.nav-link')].find((a) => a.getAttribute('href') === '/image-compressor');
      link.click();
      return true;
    })()`);
    await cdp.waitFor(`location.pathname === '/image-compressor'`, 'client-side nav to compressor');
    const clientNav = await cdp.eval(`(() => ({
      path: location.pathname,
      signedIn: !!document.querySelector('.user-trigger'),
    }))()`);
    check('compressor opened without re-auth', clientNav.path === '/image-compressor' && clientNav.signedIn,
      JSON.stringify(clientNav));

    /* ---- 5. a refresh must force a fresh sign-in -------------------- */
    console.log('\n5. refresh forces re-login');
    await cdp.send('Page.reload', { ignoreCache: true });
    await cdp.waitFor(`location.pathname === '/signin'`, 'redirect to /signin after reload');
    await sleep(600);
    const afterReload = await cdp.eval(`(async () => {
      const me = await fetch('/api/auth/me', { credentials: 'include' });
      return {
        path: location.pathname,
        meStatus: me.status,
        signedIn: !!document.querySelector('.user-trigger'),
        signinVisible: !!document.querySelector('#auth-password'),
      };
    })()`);
    check('reload bounced to /signin', afterReload.path === '/signin', afterReload.path);
    check('server session invalidated', afterReload.meStatus === 401, `/api/auth/me -> ${afterReload.meStatus}`);
    check('navbar shows signed out', !afterReload.signedIn);
    check('sign-in form offered', afterReload.signinVisible);

    /* ---- 6. re-authenticate, then confirm it holds ------------------ */
    console.log('\n6. re-authenticating works again');

    await cdp.waitFor(
      `location.pathname === '/signin' && document.getElementById('auth-password')`,
      'signin form again',
    );
    await cdp.eval(FILL(email, password));
    await cdp.eval(`document.querySelector('form button[type=submit]').click()`);
    await cdp.waitFor(`location.pathname === '/image-compressor'`, 'back to the compressor');
    const second = await cdp.eval(`(() => ({ path: location.pathname, signedIn: !!document.querySelector('.user-trigger') }))()`);
    check('signed in again and returned to the tool', second.path === '/image-compressor' && second.signedIn,
      JSON.stringify(second));

    check('no uncaught page exceptions', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    console.log(`\n${failures.length ? `FAILED: ${failures.length} check(s): ${failures.join(', ')}` : 'ALL CHECKS PASSED'}`);
    process.exitCode = failures.length ? 1 : 0;
  } finally {
    try { cdp?.ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await cleanup(email);
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
