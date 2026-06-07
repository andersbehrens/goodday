const CACHE_NAME = 'morgon-app-v8';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/data/coast.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Tvärdomäns-bilder (t.ex. SMHI:s radarrutor): låt webbläsaren hämta dem
  // direkt utan att service workern lägger sig i. Robustast, och de behöver
  // inte cachas (de byts var 5:e minut).
  if (e.request.destination === 'image' && url.origin !== self.location.origin) return;

  // Sidnavigering + livedata: nät först (cache som reserv) – så nya versioner
  // syns direkt utan cache-strul, men appen funkar ändå offline.
  const isLiveData =
    url.hostname.includes('smhi.se') ||
    url.hostname.includes('karlskrona.se') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('corsproxy.io') ||
    /\/(lunch|weather|badtemp)\.json$/.test(url.pathname);

  if (e.request.mode === 'navigate' || isLiveData) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match(BASE + '/index.html')))
    );
    return;
  }

  // Statiska resurser (ikoner, kustlinje): cache först (snabbt + offline).
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
