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

const CACHE_VERSION = 'habit-hero-v5';

// "App shell": todo lo necesario para que la interfaz cargue al
// instante, incluso con conexión lenta o sin conexión.
const APP_SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/taskService.js',
  './js/heroService.js',
  './js/app.js',
  './js/pwaInstall.js',
  './img/icon-192.png',
  './img/icon-512.png'
];

// ---- INSTALL: precachea el app shell ----
// Si CUALQUIER archivo de APP_SHELL_FILES falla (ruta rota, 404, etc.),
// cache.addAll() rechaza TODA la promesa y el navegador descarta la
// instalación sin avisar al usuario. Por eso capturamos el error aquí:
// así queda visible en la consola en vez de fallar en silencio.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Falló el precacheo del app shell:', error);
      })
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

  // Ignora esquemas que no sean http/https (chrome-extension://, data:,
  // blob:, etc.). Sin este filtro, algunas extensiones del navegador o
  // peticiones internas del propio Chrome generan errores al intentar
  // cachearlas o reenviarlas con fetch().
  if (!event.request.url.startsWith('http')) return;

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
              cache.put(event.request, responseClone).catch((error) => {
                // No es crítico (ej. cuota de almacenamiento excedida):
                // la petición ya se sirvió igual, solo no quedó cacheada.
                console.warn('[SW] No se pudo cachear:', event.request.url, error);
              });
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Sin caché y sin red: si pedían el HTML principal (navegación),
          // devuelve el index cacheado como último recurso.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }

          // Para cualquier otro recurso (imagen, fuente, etc.) que no
          // esté cacheado y sin red disponible, hay que devolver SIEMPRE
          // una Response válida: dejar el catch sin "return" aquí rompe
          // la petición con un error de respondWith() en el navegador.
          return new Response('', {
            status: 408,
            statusText: 'Sin conexión y recurso no disponible en caché'
          });
        });
    })
  );
});
