// ICR2 Modern service worker (Phase 8.5): keeps the game code available
// offline. Network first, so a new upload to GitHub Pages is used as soon as
// the phone is online; the cache answers when it is not. The game data pack is
// not handled here (boot.js keeps it in IndexedDB).
// 8.5.5: every request asks the server whether the file changed (cache 'no-cache',
// a quick "304 not modified" when it has not), instead of trusting the browser's
// copy for GitHub Pages' 10 minutes; version.json is never answered from here.
const CACHE = 'icr2-site-104684889fad';
const CORE = ["./", "index.html", "app3d.js", "perf_trims.js", "boot.js", "fflate.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('icr2-site-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  if (u.pathname.endsWith('.icr2') || u.pathname.endsWith('/version.json')) return;   // the locked data pack and the update check go straight to the network
  let fresh = r;
  if (r.cache !== 'no-store' && r.cache !== 'reload') { try { fresh = new Request(r, { cache: 'no-cache' }); } catch (_) { fresh = r; } }
  e.respondWith(fetch(fresh).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
