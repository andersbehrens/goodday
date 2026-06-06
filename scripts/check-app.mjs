#!/usr/bin/env node
/**
 * Funktionell röktest av appen i en riktig (headless) webbläsare.
 * Verifierar att varje sektion faktiskt får data – inte bara att sidan laddar.
 *
 * Pass 1 (normalt):  alla delar ska visa data.
 * Pass 2 (SMHI + kommun-API blockerade): väder och badtemp ska ÄNDÅ visa data
 *         via same-origin-fallbacken (data/weather.json, data/badtemp.json) –
 *         exakt det scenario som drabbar webbläsare med blockerande tillägg.
 *
 * Användning:  node scripts/check-app.mjs [url]
 * Avslutar med kod 1 om någon kontroll misslyckas.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.argv[2] || 'http://localhost:8770/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPass(name, blocked) {
  const dir = mkdtempSync(join(tmpdir(), 'chk-'));
  const port = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 50; i++) {
    try { target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break; }
    catch { await sleep(200); }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).res(m.result); pending.delete(m.id); } };
  await new Promise(r => (ws.onopen = r));
  const cdp = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, { res }); ws.send(JSON.stringify({ id: i, method, params })); });

  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  if (blocked?.length) await cdp('Network.setBlockedURLs', { urls: blocked });

  await cdp('Page.navigate', { url: URL });
  await sleep(9000); // låt all data hämtas (väder, badtemp, radar, lunch)

  const ev = async expr => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const text = id => ev(`(document.getElementById(${JSON.stringify(id)})||{}).textContent || ''`);

  const checks = [];
  const add = (label, ok, got) => checks.push({ label, ok, got });

  const bath = await text('bathBig');
  add('Badtemp (Coldinubadet)', /\d+,\d/.test(bath), bath.trim());

  const slots = await ev(`document.querySelectorAll('#wxSlots .wx-deg').length`);
  const wxDesc = await text('wxDesc');
  add('Väder: 3 prognos-slots', slots === 3, slots + ' slots');
  add('Väder: ingen feltext', !/kunde inte/i.test(wxDesc), wxDesc.trim().slice(0, 40));

  const sun = await text('sunUp');
  add('Soluppgång', /\d\d:\d\d/.test(sun), sun.trim());

  const lunch = await text('lunchBody');
  add('Lunch', lunch.trim().length > 0 && !/hämtar/i.test(lunch), lunch.trim().slice(0, 40).replace(/\s+/g, ' '));

  if (!blocked?.length) { // radar kräver bild-domänen, testas bara i normalt pass
    const radar = await text('radarNote');
    add('Radar (nederbörd)', /nederbörd/i.test(radar), radar.trim().slice(0, 40));
  }

  ws.close(); chrome.kill();
  return checks;
}

const SMHI_BLOCK = ['*opendata-download-metfcst.smhi.se*', '*opendata-download-radar.smhi.se*', '*service.karlskrona.se*', '*allorigins.win*', '*corsproxy.io*'];

console.log(`\n🔬 Funktionstest: ${URL}`);
let fails = 0;
for (const [name, blocked] of [['Pass 1 – normalt', null], ['Pass 2 – SMHI/kommun blockerade (fallback-test)', SMHI_BLOCK]]) {
  console.log(`\n${name}`);
  const checks = await runPass(name, blocked);
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.label}: ${c.got}`);
    if (!c.ok) fails++;
  }
}
console.log(fails ? `\n❌ ${fails} kontroll(er) misslyckades.\n` : `\n🎉 Allt fungerar – alla kontroller gröna (även med SMHI blockerat).\n`);
process.exit(fails ? 1 : 0);
