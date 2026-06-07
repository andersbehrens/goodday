# CLAUDE.md — GoodDay (Det goda i livet)

Kontext för Claude Code och för att bygga vidare på morgonappen.

## Vad det är
En morgon-PWA för Karlskrona som visar "det goda i livet": badtemperatur, väder­prognos,
regnradar, sol, lunch och ett stoiskt citat. **Ren statisk HTML/CSS/JS, ingen byggprocess.**

- **Live:** https://andersbehrens.github.io/goodday/
- **Repo:** `andersbehrens/goodday` (publikt, GitHub Pages från `main` / root)
- **Design:** "Editorial" — cream-bg (`#faf9f6`), Fraunces-serif för värden, hårfina linjer
  mellan block, tegelröd accent (`#c0532b`). Designval valdes från `moodboard.html`.

## Filstruktur
```
index.html         Hela appen (HTML + CSS + JS inline, en fil)
manifest.json      PWA-manifest (relativa sökvägar → funkar i subpath /goodday/)
sw.js              Service worker. Bumpa CACHE_NAME vid ändring (nu morgon-app-vN)
.nojekyll          Så GitHub Pages inte kör Jekyll
data/              Data appen läser same-origin (uppdateras av Actions)
  coast.json       Kustlinje för radarn (byggd, statisk)
  weather.json     Väder-fallback (Action var 30:e min)
  badtemp.json     Badtemp-fallback (Action var 30:e min)
  lunch.json       Lunch (Action vardagar 07/11)
icons/             icon-192.png, icon-512.png
scripts/           Node/Python – körs av Actions och för verifiering (se nedan)
.github/workflows/ weather.yml, badtemp.yml, lunch.yml
```

## Kör lokalt
```sh
python3 -m http.server 8770    # öppna http://localhost:8770
```

## ⚠️ Verifiera ALLTID innan du säger "klart" (uttryckligt önskemål från användaren)
```sh
node scripts/check-app.mjs http://localhost:8770/index.html   # funktionell röktest
node scripts/check-layout.mjs http://localhost:8770/index.html # layout 320–480px
```
- `check-app.mjs` laddar appen i riktig Chrome (CDP) och kontrollerar att badtemp/väder/
  sol/lunch/radar faktiskt får data. **Pass 2 blockerar SMHI+kommun-API** (Network.setBlockedURLs)
  för att bevisa att same-origin-fallbacken funkar.
- `check-layout.mjs` sätter äkta mobil-viewport (headless --screenshot golvar annars bredden
  till ~480px och döljer overflow-buggar). Vanlig orsak till overflow: flex utan `min-width:0`.
- Kräver Google Chrome. Båda avslutar med kod 1 vid fel.

## Datakällor och den centrala arkitektur-principen
**Vissa webbläsartillägg blockerar `fetch` mot `opendata-download-*.smhi.se` och kommunens API.**
Därför: appen försöker live direkt, men har alltid en **same-origin-fallback** (`data/*.json`)
som en GitHub Action håller färsk server-side (ingen CORS, kan inte blockeras).

| Data | Källa | Hur |
|------|-------|-----|
| Väder | SMHI `snow1g` (gamla `pmp3g` pensionerades 2026-03-31) | direkt fetch → fallback `data/weather.json`. 3 slots: Nu/+3h/+6h |
| Badtemp | Karlskrona kommuns bojar (`service.karlskrona.se/.../swimAreas.json`, **UTF-16**) | `data/badtemp.json` (Action) + live-proxy, visar NYASTE av båda. **Coldinubadet = "HÄSTÖ"** i feeden. Bojen mäter ~1 ggr/h → tidstämpel alltid upp till ~1h gammal (inte en bugg) |
| Regnradar | SMHI öppna data, `area/sweden/product/comp` PNG (471×887, var 5:e min) | appen **bygger bild-URL:er direkt** ur klockslag (`/ÅÅÅÅ/MM/DD/radar_ÅÅMMDDHHMM.png`, UTC) och laddar bara `<img>` — INGA fetch (blockeras). Inget crossOrigin (läser aldrig canvas-pixlar) |
| Kustlinje | Natural Earth, projicerad offline | `scripts/build-coastline.py` → `data/coast.json` |
| Lunch | regionblekinge.se (sjukhusrestaurangen, veckotabell) + Villa Oscar (fast "Lunchbuffé") | server-side i Action → `data/lunch.json`. Ingen live-väg; helg → tomt |
| Sol | Beräknas i JS (NOAA) | ingen nätverk. OBS: `n` måste avrundas (Math.round) annars blir transiten ½ dygn fel |

### Radar-georeferens (om du rör radarn)
Komposit­bilden är **UTM33N/GRS80**. Övre vänstra hörnet X=126648,404 Y=7771252,876,
pixel=2014,958 m. **Karlskrona = pixel (203,4, 767,8)** i 471×887-bilden (validerat mot flera
städer). Appen beskär ±72 px runt den punkten. `radar.valid` är UTC → konvertera till
Europe/Stockholm.

## Deploy / git
- Pushas med den klassiska PAT:en (har `repo` + `workflow`) som ligger i `ekgapp/.git/config`.
  Läs den: `git -C ../ekgapp config --get remote.origin.url` (formen `https://<TOKEN>@github.com/...`).
- **Spara ALDRIG token i `.git/config`** — pusha med engångs-URL och maskera i utskrift:
  ```sh
  TOKEN=$(git -C ../ekgapp config --get remote.origin.url | sed -E 's#https://([^@]+)@.*#\1#')
  git push "https://${TOKEN}@github.com/andersbehrens/goodday.git" main 2>&1 | sed -E "s#ghp_[A-Za-z0-9_]+#TOKEN#g"
  ```
  (Överväg att byta till en fine-grained token vid tillfälle.)
- `origin` ska peka på den RENA URL:en (utan token). Använd inte `git push -u` med token-URL
  (skriver token till config).
- Data-committen från Actions ligger på remote → **`git pull --rebase` innan du committar/pushar**
  egna ändringar, annars regrederar du datafilerna.
- Ändrar du `index.html`/`sw.js`: bumpa `CACHE_NAME` i `sw.js`. Navigering är "nätverk först"
  så ny HTML når användaren vid omladdning (men Pages-CDN kan cacha ~10 min).

## Fallgropar vi redan löst (gör inte om)
- **Actions krockar vid push** om de triggas samtidigt (alla på `*/30`). Lösning: varje commit-
  steg gör `git pull --rebase --autostash origin main` + retry-loop före `git push`.
- **CORS-proxyer är opålitliga** (corsproxy.io kräver betalning, allorigins flakig) OCH cachar
  ofta gammalt → använd dem bara som komplement, aldrig som enda källa.
- **Service worker cachade gammal version** → "bara svart" radar m.m. Därför nätverk-först för
  navigering, och SW rör inte tvärdomäns-bilder (`destination==='image'` && cross-origin → passthrough).

## Idéer att bygga vidare på (från ursprungsplanen)
Lokala evenemang, tidvatten/havsnivå, fler badplatser, positiva lokalnyheter.
Minnesanteckningar finns även i Claude Codes projektminne.
