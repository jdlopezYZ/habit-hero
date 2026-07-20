/**
 * ============================================================
 *  PWA INSTALL PROMPT — Habit Hero
 * ============================================================
 *  Chrome en Android SOLO dispara el evento 'beforeinstallprompt'
 *  cuando ya evaluó que la app cumple los criterios de instalación
 *  (manifest válido + Service Worker con fetch + HTTPS, etc.) y
 *  cuando el usuario tuvo cierta interacción mínima con el sitio
 *  ("engagement heuristics"). El banner automático de Chrome
 *  (mini-infobar) depende de esas heurísticas y no siempre aparece
 *  en la primera visita.
 *
 *  Esta capa NO fuerza nada que Chrome no permita: simplemente,
 *  en cuanto Chrome nos avisa que la app es instalable, mostramos
 *  nuestro propio banner en vez de esperar a que aparezca (o no)
 *  el banner nativo. El usuario decide con nuestro botón, y ahí
 *  disparamos el prompt() nativo real.
 * ============================================================ */

(() => {
  const STORAGE_KEY = 'habit-hero-install-dismissed';

  let deferredPrompt = null;

  const banner = document.getElementById('install-banner');
  const acceptBtn = document.getElementById('install-banner-accept');
  const dismissBtn = document.getElementById('install-banner-dismiss');

  if (!banner || !acceptBtn || !dismissBtn) return;

  function showBanner() {
    // Si el usuario ya cerró el aviso en esta sesión/dispositivo, no insistimos.
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    banner.hidden = false;
    // Pequeño delay para permitir la transición CSS de entrada
    requestAnimationFrame(() => banner.classList.add('install-banner--visible'));
  }

  function hideBanner() {
    banner.classList.remove('install-banner--visible');
    // Espera a que termine la transición antes de ocultar del todo
    setTimeout(() => { banner.hidden = true; }, 250);
  }

  // Chrome dispara este evento cuando decide que la app CUMPLE los
  // criterios de instalación. Por defecto Chrome mostraría su propio
  // mini-infobar; con preventDefault() lo evitamos y mostramos el
  // nuestro en su lugar, guardando el evento para usarlo después.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
  });

  acceptBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      hideBanner();
      return;
    }
    hideBanner();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Resultado del prompt de instalación:', outcome);
    deferredPrompt = null;
  });

  dismissBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    hideBanner();
  });

  // Si la app ya se instaló (desde este banner o desde el menú del
  // navegador), no tiene sentido seguir mostrando el aviso.
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    hideBanner();
    console.log('[PWA] Habit Hero instalada correctamente.');
  });
})();
