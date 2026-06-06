#!/usr/bin/env node
/**
 * Layout-kontroll. Startar Chrome (headless) och styr den via DevTools-protokollet
 * för att sätta EN ÄKTA mobil-viewport (headless --screenshot golvar annars bredden
 * till ~480px och döljer överflödesbuggar). På varje bredd mäts:
 *   - horisontellt överflöd (scrollWidth > klientbredd)
 *   - enskilda element som sticker ut utanför sidan (vanlig orsak: flex utan min-width:0)
 * och en skärmbild sparas i /tmp.
 *
 * Användning:  node scripts/check-layout.mjs [url]
 * Kräver Google Chrome installerat. Avslutar med kod 1 om något överflöd hittas.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ARG = process.argv[2] || 'http://localhost:8770/index.html';
const WIDTHS = [320, 360, 390, 414, 480];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdp(method, params = {}, sessionId) {
  return send({ id: ++cdp.id, method, params, sessionId });
}
cdp.id = 0;

let ws, pending = new Map();
function send(msg) {
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject });
    ws.send(JSON.stringify(msg));
  });
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'chrome-layout-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
  ], { stdio: 'ignore' });

  // Vänta tills debug-endpointen svarar
  let target;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' });
      target = await r.json(); break;
    } catch { await sleep(200); }
  }
  if (!target) { console.error('Kunde inte starta Chrome.'); chrome.kill(); process.exit(2); }

  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
  };
  await new Promise(r => (ws.onopen = r));
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  let problems = 0;
  console.log(`\n🔎 Layout-kontroll: ${URL_ARG}\n`);

  for (const w of WIDTHS) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: w, height: 850, deviceScaleFactor: 2, mobile: true,
    });
    await cdp('Page.navigate', { url: URL_ARG });
    await sleep(1800); // låt layout + typsnitt sätta sig

    const expr = `(() => {
      const de = document.documentElement;
      const over = de.scrollWidth - de.clientWidth;
      const vw = window.innerWidth;
      const bad = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
            (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
          bad.push(sel + ' (right=' + Math.round(r.right) + ')');
        }
      }
      return JSON.stringify({ over, vw, bad: [...new Set(bad)].slice(0, 8) });
    })()`;
    const { result } = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
    const { over, bad } = JSON.parse(result.value);

    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const path = `/tmp/layout-${w}.png`;
    await writeFile(path, Buffer.from(shot.data, 'base64'));

    if (over > 1 || bad.length) {
      problems++;
      console.log(`  ❌ ${w}px  – horisontellt överflöd ${over}px`);
      bad.forEach(b => console.log(`        ↳ sticker ut: ${b}`));
      console.log(`        skärmbild: ${path}`);
    } else {
      console.log(`  ✅ ${w}px  – inget överflöd   (${path})`);
    }
  }

  console.log(problems ? `\n⚠️  ${problems} bredd(er) med layoutproblem.\n` : `\n🎉 Alla bredder OK – inget överlapp eller överflöd.\n`);
  ws.close(); chrome.kill();
  process.exit(problems ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
