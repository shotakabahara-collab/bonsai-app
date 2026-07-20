// Photographed wire, jin and shari raster assets are part of the immutable offline artwork shell.
const VERSION = 'bonsai-photoreal-craft-v7';
const CACHE = `${VERSION}-shell`;
const INDEX = '/bonsai-app/index.html';
const CORE = [
  '/bonsai-app/', INDEX,
  '/bonsai-app/manifest.webmanifest', '/bonsai-app/icon.svg',
  '/bonsai-app/photo-assets.js', '/bonsai-app/IMAGE_LICENSES.md',
  '/bonsai-app/assets/kuromatsu/manifest.json',
  '/bonsai-app/assets/kuromatsu/base/black.webp',
  '/bonsai-app/assets/kuromatsu/base/starter.webp',
  '/bonsai-app/assets/kuromatsu/base/blue.webp',
  '/bonsai-app/assets/kuromatsu/base/moon.webp',
  '/bonsai-app/assets/kuromatsu/base/old.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/apex-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/apex-strong.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/firstLeft-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/firstLeft-strong.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/secondRight-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/secondRight-strong.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/thirdLeft-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/thirdLeft-strong.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/back-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/back-strong.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/front-light.webp',
  '/bonsai-app/assets/kuromatsu/wire-photo-v7/front-strong.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-left-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-left-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-left-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-right-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-right-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-right-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-apex-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-apex-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-apex-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-firstLeft-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-firstLeft-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-firstLeft-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-secondRight-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-secondRight-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-secondRight-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-thirdLeft-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-thirdLeft-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-thirdLeft-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-back-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-back-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-back-l3.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-front-l1.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-front-l2.webp',
  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-front-l3.webp'
];

async function fetchAndCache(cache, url, options = {}) {
  const response = await fetch(url, options);
  if (response.ok) await cache.put(url, response.clone());
  return response;
}

async function cacheBuiltAssets(cache, indexResponse) {
  if (!indexResponse?.ok) return;
  const html = await indexResponse.clone().text();
  const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => new URL(match[1], self.location.origin))
    .filter(url => url.origin === self.location.origin && url.pathname.startsWith('/bonsai-app/assets/'));
  const unique = [...new Set(urls.map(url => url.href))];
  await Promise.allSettled(unique.map(async url => {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response.clone());
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const indexResponse = await fetchAndCache(cache, INDEX, { cache: 'reload' });
    await cacheBuiltAssets(cache, indexResponse);
    await Promise.allSettled(CORE.filter(url => url !== INDEX).map(url => fetchAndCache(cache, url, { cache: 'reload' })));
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
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
          await cacheBuiltAssets(cache, response);
        }
        return response;
      } catch {
        return (await caches.match(event.request, { ignoreSearch: true })) || (await caches.match(INDEX)) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const hit = await caches.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
