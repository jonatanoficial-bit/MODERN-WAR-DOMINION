const CACHE_NAME = 'modern-war-dominion-f2-v0-2-0';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './data/countries.json',
  './data/world_regions.json',
  './assets/img/world-map-free.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
