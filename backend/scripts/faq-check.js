/**
 * Headless check for the Home FAQ accordion.
 *
 * The report was "the last FAQ answer does not show". Rather than guess, this
 * drives the real page in headless Chrome over the DevTools protocol and
 * reports the measured height of every panel, plus what happens on click.
 *
 *   node scripts/faq-check.js [url]
 *
 * Uses Node's built-in WebSocket, so there is nothing to install.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = process.argv[2] || 'http://localhost:5173/';
const PORT = Number(process.env.CDP_PORT || 9222);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/** Tiny CDP session: send commands, await matching ids. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${message.error.message} (${entry.method})`));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluate an async expression and return its value. */
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'page threw');
    }
    return result.result.value;
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new Cdp(ws)));
    ws.addEventListener('error', () => reject(new Error('websocket failed')));
  });
}

async function main() {
  const targetIndex = Number(process.env.FAQ_INDEX ?? 4);
  const profile = path.join(process.env.TEMP, 'northstar-cdp-profile');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  try {
    for (let i = 0; i < 40; i += 1) {
      try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; }
      catch { await sleep(250); }
    }

    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) throw new Error('no page target');

    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Collect console errors and page exceptions — often the real culprit.
    const problems = [];
    cdp.ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data);
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
        problems.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        problems.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
      }
    });

    await cdp.send('Page.navigate', { url: TARGET_URL });
    // Wait for React to mount and the FAQ section to exist.
    for (let i = 0; i < 60; i += 1) {
      const ready = await cdp.eval(`!!document.querySelector('.faq-item')`);
      if (ready) break;
      await sleep(250);
    }
    await sleep(700);

    // Scroll the FAQ into view the way a visitor would, then let the reveal
    // observer settle. This is the state that actually matters.
    await cdp.eval(`(() => {
      document.querySelector('.faq-item').scrollIntoView({ block: 'center' });
      return true;
    })()`);
    await sleep(1200);

    const report = await cdp.eval(`(() => {
      const items = [...document.querySelectorAll('.faq-item')];
      return {
        count: items.length,
        items: items.map((el, i) => {
          const btn = el.querySelector('.faq-q');
          const panel = el.querySelector('.faq-a');
          const inner = panel && panel.firstElementChild;
          return {
            i,
            q: btn ? btn.textContent.trim().slice(0, 60) : null,
            open: el.classList.contains('open'),
            ariaExpanded: btn ? btn.getAttribute('aria-expanded') : null,
            panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : null,
            innerHeight: inner ? Math.round(inner.getBoundingClientRect().height) : null,
            scrollHeight: inner ? inner.scrollHeight : null,
            panelGridRows: panel ? getComputedStyle(panel).gridTemplateRows : null,
            answerText: panel ? panel.textContent.trim().slice(0, 40) : null,
            opacity: getComputedStyle(el).opacity,
            isIn: el.classList.contains('is-in'),
          };
        }),
      };
    })()`);

    console.log(`\nFAQ items found: ${report.count}\n`);
    console.table(report.items.map((r) => ({
      '#': r.i,
      question: r.q,
      open: r.open,
      aria: r.ariaExpanded,
      panelH: r.panelHeight,
      innerH: r.innerHeight,
      scrollH: r.scrollHeight,
      gridRows: r.panelGridRows,
      opacity: r.opacity,
      revealed: r.isIn,
    })));

    // Now click a question and re-measure. Default to the one from the report.
    const targetIndex = Number(process.env.FAQ_INDEX ?? 4);
    const clicked = await cdp.eval(`(() => {
      const items = [...document.querySelectorAll('.faq-item')];
      const el = items[${targetIndex}];
      if (!el) return { ok: false, reason: 'no item at index' };
      const btn = el.querySelector('.faq-q');
      const wasOpen = el.classList.contains('open');
      btn.click();
      return { ok: true, index: ${targetIndex}, question: btn.textContent.trim().slice(0, 60), wasOpen };
    })()`);
    await sleep(1000);

    // Exercise every question in turn: each must open, show its own text, and
    // leave the previously open one collapsed.
    console.log('\nClicking every question in turn:');
    const perItem = await cdp.eval(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const items = [...document.querySelectorAll('.faq-item')];
      const rows = [];
      for (let i = 0; i < items.length; i += 1) {
        const el = items[i];
        // Bring each item fully into view first, otherwise the reveal
        // transition may still be mid-flight and skew the measurement.
        el.scrollIntoView({ block: 'center' });
        await sleep(250);
        el.querySelector('.faq-q').click();
        await sleep(1100);
        const panel = el.querySelector('.faq-a');
        const open = el.classList.contains('open');
        const h = Math.round(panel.getBoundingClientRect().height);
        const opacity = getComputedStyle(el).opacity;
        const text = panel.querySelector('p')?.textContent.trim() || '';
        const othersOpen = items.filter((o, j) => j !== i && o.classList.contains('open')).length;
        rows.push({
          '#': i,
          open,
          panelH: h,
          opacity,
          visible: h > 4 && Number(opacity) > 0.9,
          textLen: text.length,
          textStart: text.slice(0, 34),
          othersOpen,
        });
      }
      return rows;
    })()`);

    console.table(perItem);
    const broken = perItem.filter((r) => !r.visible || r.othersOpen !== 0);
    if (broken.length) {
      const ids = broken.map((b) => '#' + b['#']).join(', ');
      console.log('\n  ' + broken.length + ' FAQ item(s) FAILED: ' + ids);
    } else {
      console.log('\n  all ' + perItem.length + ' questions open, show text, and stay mutually exclusive');
    }

    // Leave the reported question open for a final screenshot-style read.
    // Needs a full transition length: the panel animates grid-template-rows,
    // so measuring early reports a 0px height even though it is opening.
    await cdp.eval(`(() => {
      const items = [...document.querySelectorAll('.faq-item')];
      const el = items[${targetIndex}];
      el.scrollIntoView({ block: 'center' });
      el.querySelector('.faq-q').click();
      return true;
    })()`);
    await sleep(1200);

    const after = await cdp.eval(`(() => {
      const items = [...document.querySelectorAll('.faq-item')];
      const el = items[${targetIndex}];
      const panel = el.querySelector('.faq-a');
      const inner = panel.firstElementChild;
      const p = panel.querySelector('p');
      const style = getComputedStyle(panel);
      return {
        lastOpen: el.classList.contains('open'),
        ariaExpanded: el.querySelector('.faq-q').getAttribute('aria-expanded'),
        panelHeight: Math.round(panel.getBoundingClientRect().height),
        innerScroll: inner.scrollHeight,
        gridRows: style.gridTemplateRows,
        display: style.display,
        visibility: style.visibility,
        itemClass: el.className,
        hasIsIn: el.classList.contains('is-in'),
        opacity: getComputedStyle(el).opacity,
        itemOpacity: getComputedStyle(el.querySelector('.faq-q')).opacity,
        pText: p ? p.textContent.trim().slice(0, 70) : null,
        answersVisible: items.map((it) => Math.round(it.querySelector('.faq-a').getBoundingClientRect().height) > 4),
      };
    })()`);

    console.log('\nAfter clicking the question:', JSON.stringify(clicked, null, 2));
    console.log('\nFinal state of the reported question:', JSON.stringify(after, null, 2));

    const collapsed = report.items.filter((r) => !r.open && r.panelHeight <= 1).length;
    console.log(`\nsummary: ${collapsed} panel(s) collapsed at load, answers present in DOM: ${
      report.items.every((r) => r.answerText && r.answerText.length > 10)}`);

    if (problems.length) {
      console.log('\nconsole output:');
      problems.slice(0, 12).forEach((p) => console.log('  ', p));
    } else {
      console.log('\nno console errors or warnings');
    }

    // Hard assertions, so this fails loudly instead of printing a red table.
    const failures = [];
    if (report.count < 6) failures.push(`expected 6 FAQ items, found ${report.count}`);
    if (!report.items.every((r) => r.answerText && r.answerText.length > 10)) {
      failures.push('at least one FAQ answer is missing from the DOM');
    }
    if (broken.length) {
      failures.push(`questions that did not open visibly: ${broken.map((b) => '#' + b['#']).join(', ')}`);
    }
    if (!after.hasIsIn) {
      failures.push('reveal class `is-in` was lost after re-render (card would be invisible)');
    }
    if (Number(after.opacity) < 0.9) {
      failures.push(`revealed card opacity is ${after.opacity}, expected ~1`);
    }
    if (after.panelHeight < 20) {
      failures.push(`reported question panel height is ${after.panelHeight}px, expected the answer to be visible`);
    }
    if (!after.lastOpen || after.ariaExpanded !== 'true') {
      failures.push('reported question did not report itself as expanded');
    }
    if (problems.some((p) => p.startsWith('exception'))) {
      failures.push('page threw an exception');
    }

    if (failures.length) {
      failures.forEach((f) => console.log('\n  ASSERTION FAILED: ' + f));
      process.exitCode = 1;
    } else {
      console.log('\n  PASS: every FAQ answer opens, is visible, and stays expanded.');
    }
  } finally {
    try { cdp?.ws.close(); } catch { /* ignore */ }
    chrome.kill();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
