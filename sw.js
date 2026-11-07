const CACHE = 'uzma-birthday-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './og-image.png'
];
const EXTERNAL = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Outfit:wght@500;700;900&display=swap'
];

async function cacheExternal(cache, url) {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return;
    const copy = res.clone();
    await cache.put(url, res);
    // CSS ke andar jo font files hain unhe bhi cache karo (offline ke liye)
    if (/\.css|fonts\.googleapis\.com/.test(url)) {
      const text = await copy.text();
      const base = new URL(url);
      const urls = [...text.matchAll(/url\(([^)]+)\)/g)]
        .map(m => m[1].trim().replace(/^['"]|['"]$/g, ''))
        .filter(u => !u.startsWith('data:'))
        .map(u => new URL(u, base).href);
      await Promise.all(urls.map(async u => {
        try {
          const r = await fetch(u, { mode: 'cors', credentials: 'omit' });
          if (r.ok) await cache.put(u, r);
        } catch (e) {}
      }));
    }
  } catch (e) {}
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(u => cache.add(u).catch(() => {})));
    await Promise.all(EXTERNAL.map(u => cacheExternal(cache, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // sirf is app ke purane cache hatao, doosri apps ke nahi
    await Promise.all(keys
      .filter(k => k.startsWith('uzma-birthday-') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });

    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);

    if (cached) { event.waitUntil(network); return cached; }

    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
