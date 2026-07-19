const VERSION = 'bonsai-react-v2-wire-judge';
const CACHE = `${VERSION}-shell`;
const CORE = [
  '/bonsai-app/',
  '/bonsai-app/index.html',
  '/bonsai-app/manifest.webmanifest',
  '/bonsai-app/icon.svg',
  '/bonsai-app/photo-assets.js',
  '/bonsai-app/IMAGE_LICENSES.md',
  '/bonsai-app/assets/kuromatsu/manifest.json',
  '/bonsai-app/assets/kuromatsu/base/black.webp',
  '/bonsai-app/assets/kuromatsu/base/starter.webp',
  '/bonsai-app/assets/kuromatsu/base/blue.webp',
  '/bonsai-app/assets/kuromatsu/base/moon.webp',
  '/bonsai-app/assets/kuromatsu/base/old.webp'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/bonsai-app/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
