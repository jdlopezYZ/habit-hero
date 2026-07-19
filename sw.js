/**
 * ============================================================
 *  SERVICE WORKER — Habit Hero (PWA)
 * ============================================================
 *  Estrategia: Cache-first para el "app shell" (HTML, CSS, JS,
 *  íconos). No toca la lógica del juego: solo intercepta las
 *  peticiones de red para servir estos archivos desde caché y
 *  lograr carga instantánea / soporte offline básico.
 *
 *  IMPORTANTE: sube CACHE_VERSION cada vez que cambies alguno de
 *  los archivos cacheados (css/js), para forzar a los usuarios ya
 *  instalados a descargar la versión nueva en su próxima visita.
 * ============================================================ */

const CACHE_VERSION = 'habit-hero-v1';

// "App shell": todo lo necesario para que la interfaz cargue al
// instante, incluso con conexión lenta o sin conexión.
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/taskService.js',
  '/js/heroService.js',
  '/js/app.js',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

// ---- INSTALL: precachea el app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: limpia cachés de versiones anteriores ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH: cache-first, con fallback a red y actualización silenciosa ----
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET del mismo origen (evita romper
  // llamadas a APIs externas o de otro dominio).
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Guarda en caché una copia de cualquier archivo nuevo del
          // mismo origen para futuras cargas offline.
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Sin caché y sin red: si pedían el HTML principal, devuelve
          // el index cacheado como último recurso.
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
