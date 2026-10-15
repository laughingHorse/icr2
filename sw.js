// ICR2 Modern service worker (Phase 8.5): keeps the game code available
// offline. Network first, so a new upload to GitHub Pages is used as soon as
// the phone is online; the cache answers when it is not. The game data pack is
// not handled here (boot.js keeps it in IndexedDB).
const CACHE = 'icr2-site-1c626bfc2506';
const CORE = ["./", "index.html", "app3d.js", "perf_trims.js", "boot.js", "fflate.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('icr2-site-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
