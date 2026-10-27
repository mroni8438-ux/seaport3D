// Service worker SeaPort 3D: cache aset tampilan, fallback offline.html saat koneksi putus
const VERSI = 'seaport-3d-v1';
const CACHE = 'aset-' + VERSI;
const ASET_AWAL = ['/offline.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASET_AWAL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const tersimpan = await cache.match(req);
      const segar = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => tersimpan);
      return tersimpan || segar;
    })
  );
});
