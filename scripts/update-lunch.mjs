#!/usr/bin/env node
/**
 * Hämtar dagens lunch och skriver data/lunch.json.
 *
 *  - Blekingesjukhusets restaurang i Karlskrona: skrapas från regionblekinge.se
 *    (hittar innevarande veckas matsedel, parsar dagens rätt + grön lunch).
 *  - Villa Oscar (Blue Science Park): publicerar ingen dagsmeny, serverar
 *    lunchbuffé – visas som fast kort.
 *
 * Körs server-side i GitHub Action (direkt hämtning, inga CORS/proxy-problem).
 * Lokalt: `node scripts/update-lunch.mjs`
 */
import { writeFile, mkdir } from 'node:fs/promises';

const HOSP_MAIN = 'https://regionblekinge.se/halsa-och-vard/sa-fungerar-varden-i-blekinge/blekingesjukhuset/matsedlar-for-sjukhusrestauranger/restaurangen-i-karlskrona.html';
const HOSP_BASE = 'https://regionblekinge.se';
const DAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];

const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'morgonapp/1.0' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}

async function hospitalLunch(now) {
  const dagIdx = now.getDay() - 1; // 0=mån … 4=fre
  if (dagIdx < 0 || dagIdx > 4) return null; // helg
  const dagNamn = DAGAR[dagIdx];

  const main = await get(HOSP_MAIN);
  const week = isoWeek(now);
  // Länkar till veckomatsedlar; matcha "vecka-<N>-" i href, annars senaste.
  const links = [...main.matchAll(/href="([^"]*matsedel[^"]*\.html)"/gi)].map(m => m[1]);
  if (!links.length) return null;
  let href = links.find(h => new RegExp('vecka-' + week + '\\D').test(h)) || links[links.length - 1];
  if (!href.startsWith('http')) href = HOSP_BASE + href;

  const page = await get(href);
  const cells = [...page.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => strip(m[1]));

  const start = cells.findIndex(c => c.toLowerCase().startsWith(dagNamn.toLowerCase()));
  if (start < 0) return null;
  // Klipp ut dagens segment fram till nästa veckodag.
  let end = cells.length;
  for (let i = start + 1; i < cells.length; i++) {
    if (DAGAR.some(d => cells[i].toLowerCase().startsWith(d.toLowerCase()))) { end = i; break; }
  }
  const seg = cells.slice(start, end);
  const after = label => {
    const i = seg.findIndex(c => c.toLowerCase().startsWith(label));
    return i >= 0 && seg[i + 1] ? seg[i + 1] : '';
  };
  const dish = after('lunch');
  const veg = after('grön');
  if (!dish && !veg) return null;

  return {
    name: 'Sjukhusrestaurangen',
    dish: dish || veg,
    extra: veg && dish ? '🌿 ' + veg : '',
    price: '',
    hours: '11:15–13:30',
  };
}

function villaOscar(now) {
  const dagIdx = now.getDay() - 1;
  if (dagIdx < 0 || dagIdx > 4) return null; // helg – stängt
  return {
    name: 'Villa Oscar',
    dish: 'Lunchbuffé',
    extra: 'Blue Science Park',
    price: '120 kr',
    hours: '11:20–13:30',
  };
}

const now = new Date();
const restaurants = [];
try {
  const h = await hospitalLunch(now);
  if (h) restaurants.push(h);
} catch (e) { console.error('Sjukhus-scrape misslyckades:', e.message); }
const v = villaOscar(now);
if (v) restaurants.push(v);

const out = {
  updated: now.toISOString(),
  weekday: now.getDay() >= 1 && now.getDay() <= 5,
  restaurants,
};

await mkdir('data', { recursive: true });
await writeFile('data/lunch.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Skrev data/lunch.json med ${restaurants.length} restaurang(er):`,
  restaurants.map(r => r.name + ' – ' + r.dish).join(' | ') || '(inga – helg?)');
