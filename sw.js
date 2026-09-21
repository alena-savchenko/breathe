const CACHE_NAME = 'breath-static-v1.01.03';

const CORE_ASSETS = [
  './',
  './index.html',
  './assets/css/styles.css?v=modes-ui-1',
  './assets/js/breath.js?v=modes-ui-1',
  './assets/js/script.js?v=modes-ui-1',
  './i18n/en/messages.txt?v=modes-ui-1',
  './i18n/en/ui.txt?v=modes-ui-1',
  './i18n/ru/messages.txt?v=modes-ui-1',
  './i18n/ru/ui.txt?v=modes-ui-1',
  './i18n/uk/messages.txt?v=modes-ui-1',
  './i18n/uk/ui.txt?v=modes-ui-1',
  './i18n/de/messages.txt?v=modes-ui-1',
  './i18n/de/ui.txt?v=modes-ui-1'
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
    .then(async (response) => {
      if (response && response.status === 200) {
        await cache.put(request, response.clone());
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

// Optional assets are fetched once, only when requested by the interface.
async function optionalAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(request.url);
  if (!response) {
    // Cache the full audio file, even when the media element requests a range.
    response = await fetch(request.url);
    if (response.status === 200) await cache.put(request.url, response.clone());
  }
  const range = request.headers.get('range');
  if (!range || response.status !== 200) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return response;
  const blob = await response.blob();
  const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (start > end || start >= blob.size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${blob.size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(blob.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/assets/audio/music/') || url.pathname.endsWith('/Fast_Sans.ttf')) {
    event.respondWith(optionalAsset(request));
    return;
  }

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
