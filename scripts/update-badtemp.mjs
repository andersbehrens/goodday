#!/usr/bin/env node
/**
 * Hämtar Karlskrona kommuns badtemperatur-feed (UTF-16, ingen CORS),
 * konverterar till ren UTF-8-JSON och skriver data/badtemp.json.
 *
 * Körs av GitHub Action var 30:e minut så appen kan läsa den från samma
 * domän (inga CORS-problem). Kan även köras lokalt: `node scripts/update-badtemp.mjs`
 */
import { writeFile, mkdir } from 'node:fs/promises';

const FEED = 'https://service.karlskrona.se/FileStorageArea/Documents/bad/swimAreas.json';

const res = await fetch(FEED);
if (!res.ok) throw new Error('Feed svarade ' + res.status);

const buf = Buffer.from(await res.arrayBuffer());
// Feeden är UTF-16 (BOM 0xFF 0xFE). Avkoda, annars fallback till UTF-8.
let text;
if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le');
else text = buf.toString('utf8');
const data = JSON.parse(text.replace(/^﻿/, ''));

const areas = (data.Payload?.swimAreas || []).map(a => ({
  name: a.nameArea,
  temp: a.temperatureWater,
  time: a.timeStamp,
}));

const out = {
  fetched: new Date().toISOString(),
  source: FEED,
  areas,
};

await mkdir('data', { recursive: true });
await writeFile('data/badtemp.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Skrev data/badtemp.json med ${areas.length} badplatser.`);
