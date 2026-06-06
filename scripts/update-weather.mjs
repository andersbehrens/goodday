#!/usr/bin/env node
/**
 * Hämtar SMHI-prognos för Karlskrona och skriver data/weather.json med tre
 * färdiga "slots": Nu + två tidpunkter längre fram på dagen.
 *
 * Same-origin-reserv: vissa webbläsare/tillägg blockerar fetch direkt mot
 * opendata-download-*.smhi.se. Appen läser då denna fil istället (aldrig CORS).
 *
 * Körs server-side i GitHub Action. Lokalt: node scripts/update-weather.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/15.5869/lat/56.1612/data.json';
const tz = 'Europe/Stockholm';
const WSYMB = {
  1: ['Klart', '☀️'], 2: ['Mest klart', '🌤️'], 3: ['Växlande molnighet', '⛅'], 4: ['Halvklart', '⛅'],
  5: ['Molnigt', '☁️'], 6: ['Mulet', '☁️'], 7: ['Dimma', '🌫️'], 8: ['Lätta regnskurar', '🌦️'],
  9: ['Regnskurar', '🌦️'], 10: ['Kraftiga regnskurar', '🌧️'], 11: ['Åskväder', '⛈️'],
  12: ['Snöblandat regn', '🌨️'], 13: ['Snöblandat regn', '🌨️'], 14: ['Snöblandat regn', '🌨️'],
  15: ['Snöbyar', '🌨️'], 16: ['Snöbyar', '🌨️'], 17: ['Snöbyar', '❄️'], 18: ['Lätt regn', '🌧️'],
  19: ['Regn', '🌧️'], 20: ['Kraftigt regn', '🌧️'], 21: ['Åska', '⛈️'], 22: ['Snöblandat regn', '🌨️'],
  23: ['Snöblandat regn', '🌨️'], 24: ['Snöblandat regn', '🌨️'], 25: ['Lätt snöfall', '🌨️'],
  26: ['Snöfall', '❄️'], 27: ['Kraftigt snöfall', '❄️'],
};
const COMPASS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
const windDir = deg => COMPASS[Math.round(deg / 22.5) % 16];

export function buildSlots(ts, nowMs = Date.now()) {
  const pick = h => {
    const target = nowMs + h * 3600e3;
    return ts.reduce((b, t) => Math.abs(new Date(t.time) - target) < Math.abs(new Date(b.time) - target) ? t : b, ts[0]);
  };
  const clock = t => new Date(t.time).toLocaleTimeString('sv-SE', { hour: '2-digit', timeZone: tz }).replace(/^0/, '');
  const slot = (t, label) => {
    const d = t.data, [desc, emoji] = WSYMB[d.symbol_code] || ['', '🌡️'];
    return {
      label, time: t.time, temp: Math.round(d.air_temperature), desc, emoji,
      wind: Math.round(d.wind_speed), wdir: d.wind_from_direction, wdirText: windDir(d.wind_from_direction),
      rain: +(d.precipitation_amount_mean ?? d.precipitation_amount_mean_deterministic ?? 0).toFixed(1),
    };
  };
  const t3 = pick(3), t6 = pick(6);
  return [slot(pick(0), 'Nu'), slot(t3, 'kl ' + clock(t3)), slot(t6, 'kl ' + clock(t6))];
}

// Kör som skript (inte vid import)
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await fetch(URL);
  if (!r.ok) throw new Error('SMHI svarade ' + r.status);
  const j = await r.json();
  const out = { updated: new Date().toISOString(), slots: buildSlots(j.timeSeries) };
  await mkdir('data', { recursive: true });
  await writeFile('data/weather.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Skrev data/weather.json:', out.slots.map(s => `${s.label} ${s.temp}° ${s.desc}`).join(' · '));
}
