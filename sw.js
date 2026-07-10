/* Service worker — Control de Flotilla
   Reglas de seguridad de caché:
   - El HTML SIEMPRE se sirve red-primero (nadie queda atrapado en versión vieja).
   - skipWaiting + clients.claim + purga de cachés viejos por nombre versionado.
   - Nunca se cachean recursos cross-origin (CDN de jsPDF, OneSignal).
   Al publicar una versión nueva: sube VERSION aquí y APP_VERSION en index.html. */
'use strict';

const VERSION = 'v1.0.0';
const CACHE = 'flotilla-' + VERSION;
const PRECACHE = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(() => {})            // el precache no debe bloquear la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith('flotilla-') && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // los POST a Apps Script pasan directo
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // jamás tocar cross-origin

  const esHTML = req.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (esHTML) {
    // Red primero; caché solo como respaldo offline
    e.respondWith(
      fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Estáticos propios (íconos, manifest): caché primero, actualiza en segundo plano
  e.respondWith(
    caches.match(req).then(hit => {
      const red = fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return r;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
