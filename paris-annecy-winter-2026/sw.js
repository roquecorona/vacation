// Offline cache for the trip planner. Network-first for the page and trip.json
// (so updates arrive when online), cache-first for everything else.
const CACHE = 'trip-planner-d57e61b97f';
const LOCAL = ["./", "./index.html", "./support.js", "./trip.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./menus/boulangerie-effel.html", "./menus/cafe-du-commerce.html", "./menus/hippopotamus-wagram.html", "./menus/mac-and-tea.html", "./tickets/jardin-acclimatation-tickets-20dec-e46dd279ee32.pdf"];
const CDN = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
];
const RUNTIME_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(LOCAL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await Promise.all(CDN.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(k => k.startsWith('trip-planner-') && k !== CACHE);
    const c = await caches.open(CACHE);
    // carry runtime-cached fonts over from older versions
    for (const k of old) { const oc = await caches.open(k); for (const req of await oc.keys()) { if (!(await c.match(req))) { const r = await oc.match(req); if (r) await c.put(req, r); } } await caches.delete(k); }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !RUNTIME_HOSTS.includes(url.hostname)) return;
  const networkFirst = same && (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname) || url.pathname.endsWith('/trip.json'));
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (networkFirst) {
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(url.pathname.endsWith('/trip.json') ? './trip.json' : (req.mode === 'navigate' ? './' : req), r.clone());
        return r;
      } catch (err) {
        const hit = await c.match(req, { ignoreSearch: true }) || (url.pathname.endsWith('/trip.json') ? await c.match('./trip.json') : await c.match('./'));
        if (hit) return hit;
        throw err;
      }
    }
    const hit = await c.match(req, { ignoreSearch: same });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    if (r) return r;
    return new Response('Offline', { status: 503 });
  })());
});
