const CACHE_NAME = 'breath-static-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/breath.js',
  './assets/js/script.js',
  './assets/audio/music/ambient-loop-120s-fade_64k.opus',
  './assets/audio/music/ambient-loop-120s-fade_128k.mp3',
  './assets/fonts/fast-font/Fast_Sans.ttf',
  './i18n/en/messages.txt',
  './i18n/en/ui.txt',
  './i18n/ru/messages.txt',
  './i18n/ru/ui.txt',
  './i18n/uk/messages.txt',
  './i18n/uk/ui.txt',
  './i18n/de/messages.txt',
  './i18n/de/ui.txt'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => null);
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  const destination = request.destination;
  const isStaticAsset = ['script', 'style', 'image', 'font', 'audio'].includes(destination);
  const isI18n = url.pathname.includes('/i18n/');

  if (isStaticAsset || isI18n) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
