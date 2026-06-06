# Det goda i livet – Projektsammanfattning

## Koncept
En morgonapp som ger användaren en positiv start på dagen med lokal och relevant information från Karlskrona.

Appen öppnas på morgonen och visar "det goda i livet" – praktisk, positiv och lokal info för dagen.

---

## Planerade funktioner

### 1. Dagens lunch
- Visa vad som serveras till lunch på utvalda restauranger i Karlskrona
- Uppdateras dagligen
- Möjliga datakällor: restaurangernas egna hemsidor/Instagram (scraping eller manuell inmatning), eller ett enkelt admin-gränssnitt

### 2. Badtemperatur
- Visa aktuell vattentemperatur på utvalda badplatser runt Karlskrona
- Möjliga datakällor: SMHI:s öppna API (har mätdata för svenska kustvatten)

### 3. Väder och vind
- Dagens väderprognos för Karlskrona
- Temperatur, vind, nederbörd
- Datakälla: SMHI öppet API (gratis, ingen nyckel krävs)

---

## Förslag på ytterligare innehåll att utforska
- Dagens soluppgång/solnedgång
- Lokala evenemang i Karlskrona
- Ett positivt citat för dagen
- Tidvatten/havsnivå (relevant för Karlskrona)
- Lokala nyheter (positiva)

---

## Tekniska överväganden

### Vald tech stack: Progressive Web App (PWA)
- **Next.js** – ramverk (stöder PWA via `next-pwa`)
- **Tailwind CSS** – styling
- **next-pwa** – gör appen installerbar och offline-kapabel
- Fungerar i webbläsaren men kan installeras på hemskärmen (iOS/Android/Desktop)

### Datakällor (öppna API:er)
| Data | Källa | Kostnad |
|------|-------|---------|
| Väder | [SMHI Öppet API](https://opendata.smhi.se) | Gratis |
| Badtemperatur | [SMHI Observationer](https://opendata.smhi.se/apidocs/metobs/) | Gratis |
| Lunch | Scraping / manuellt admin | – |

---

## Nästa steg
1. Skapa projektmapp och initiera projekt
2. Välj tech stack (webb eller mobil?)
3. Testa SMHI API för väder och badtemperatur
4. Bestäm hur lunchdata ska hanteras
5. Bygg första version av UI

---

*Sammanställt: 2026-06-06 | Ursprunglig idé: 2026-05-25*
