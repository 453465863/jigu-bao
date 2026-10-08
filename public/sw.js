// 基估宝 PWA：缓存应用外壳，网络短暂不可用时仍可打开已访问过的页面。
const CACHE_NAME = 'jigubao-v2';

const scopeUrl = () => new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled([
        cache.add(scopeUrl()),
        cache.add(new URL('trade-entry/', self.registration.scope).href),
        cache.add(new URL('analysis-history/', self.registration.scope).href),
        cache.add(new URL('manifest.webmanifest', self.registration.scope).href),
        cache.add(new URL('Icon-60@3x.png', self.registration.scope).href)
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim()
    ])
  );
});

const cacheSuccessfulResponse = async (request, response) => {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheSuccessfulResponse(request, response))
        .catch(async () => (await caches.match(request)) || (await caches.match(scopeUrl())) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkRequest = fetch(request)
        .then((response) => cacheSuccessfulResponse(request, response))
        .catch(() => cached || Response.error());

      if (cached) {
        event.waitUntil(networkRequest);
        return cached;
      }
      return networkRequest;
    })
  );
});
