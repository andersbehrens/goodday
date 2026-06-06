# Det goda i livet

En liten progressiv webapp (PWA) som ger en positiv morgonstart för Karlskrona.
Öppna den på morgonen och få dagens "goda i livet" på ett ställe.

## Funktioner

- 🏊 **Badtemperatur** – Coldinubadet (närmast) överst, plus Dragsö, Stumholmen och Saltö. Kommunens realtidsbojar.
- 🌤️ **Väderprognos** – nu och två tider längre fram på dagen (SMHI), med vind och vindriktning.
- 🌧️ **Regnradar** – animerad senaste timmen, inzoomad på Karlskrona med kustlinje och avståndsringar (SMHI).
- 🌅 **Sol** – soluppgång, solnedgång och dagslängd (beräknas lokalt).
- 🍽️ **Dagens lunch** – Sjukhusrestaurangen och Villa Oscar.
- 🏛️ **Stoiskt citat** – ett nytt varje gång appen öppnas.

## Teknik

Ren statisk PWA (HTML/CSS/JS), installerbar och offline-kapabel via service worker.
Ingen byggprocess – allt serveras som det är.

### Datakällor (öppna API:er, gratis)

| Data | Källa |
|------|-------|
| Väder & regnradar | [SMHI öppna data](https://opendata.smhi.se) |
| Badtemperatur | Karlskrona kommuns badtemperatur-bojar |
| Lunch | regionblekinge.se (sjukhusrestaurangen) |

Vissa webbläsartillägg blockerar direkta `fetch`-anrop till SMHI/kommunen. Därför
hämtar [GitHub Actions](.github/workflows) väder, badtemp och lunch server-side och
sparar `data/*.json` i repot – appen läser dem same-origin som reserv (aldrig CORS).

### Verifiering

- `node scripts/check-app.mjs` – funktionell röktest i riktig webbläsare (även med SMHI blockerat).
- `node scripts/check-layout.mjs` – kontrollerar layout på mobilbredder 320–480 px.

## Lokalt

```sh
python3 -m http.server 8770
# öppna http://localhost:8770
```
