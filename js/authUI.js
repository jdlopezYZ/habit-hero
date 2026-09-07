/**
 * ============================================================
 *  AUTH UI — Habit Hero
 * ============================================================
 *  Controla qué pantalla se muestra: login/registro o el juego.
 *  No toca la lógica de HeroService/TaskService (todavía siguen
 *  usando localStorage en esta fase) — solo decide visibilidad
 *  según haya o no sesión activa en Supabase.
 * ============================================================
 */

import { signUp, signIn, signOut, getSession, onAuthStateChange } from './authService.js';

const authScreenEl   = document.getElementById('auth-screen');
const gameScreenEl   = document.getElementById('game-screen');

const authFormEl     = document.getElementById('auth-form');
const authEmailEl    = document.getElementById('auth-email');
const authPasswordEl = document.getElementById('auth-password');
const authErrorEl    = document.getElementById('auth-error');
const authSubmitBtn  = document.getElementById('auth-submit-btn');
const authTitleEl    = document.getElementById('auth-form-title');
const authToggleBtn  = document.getElementById('auth-toggle-mode');

const logoutBtn      = document.getElementById('btn-logout');

// 'login' o 'register' — controla qué acción dispara el submit del form
let mode = 'login';

function showGame() {
  authScreenEl.hidden = true;
  gameScreenEl.hidden = false;

  // Avisa a app.js que ya hay un usuario confirmado, para que recargue
  // el estado del héroe y las misiones de ESE usuario (login, registro,
  // o sesión ya existente al abrir la app son los 3 casos que llegan aquí).
  document.dispatchEvent(new CustomEvent('hh:session-started'));
}

function showAuth() {
  gameScreenEl.hidden = true;
  authScreenEl.hidden = false;
}

function showError(message) {
  authErrorEl.textContent = message;
  authErrorEl.hidden = false;
}

function clearError() {
  authErrorEl.hidden = true;
  authErrorEl.textContent = '';
}

function toggleMode() {
  mode = mode === 'login' ? 'register' : 'login';
  clearError();

  if (mode === 'register') {
    authTitleEl.textContent = 'CREAR CUENTA';
    authSubmitBtn.textContent = 'REGISTRARSE';
    authToggleBtn.textContent = '¿YA TIENES CUENTA? INICIA SESIÓN';
  } else {
    authTitleEl.textContent = 'INICIAR SESIÓN';
    authSubmitBtn.textContent = 'INICIAR SESIÓN';
    authToggleBtn.textContent = '¿NO TIENES CUENTA? REGÍSTRATE';
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearError();

  const email = authEmailEl.value.trim();
  const password = authPasswordEl.value;

  authSubmitBtn.disabled = true;

  const result = mode === 'login'
    ? await signIn(email, password)
    : await signUp(email, password);

  authSubmitBtn.disabled = false;

  if (result.error) {
    showError(traducirError(result.error));
    return;
  }

  // signUp puede devolver user sin sesión activa si el proyecto todavía
  // pidiera confirmación por correo. Si no hay sesión, avisamos en vez
  // de intentar mostrar el juego con un usuario a medias.
  const session = await getSession();
  if (!session) {
    showError('Cuenta creada. Verifica tu correo antes de iniciar sesión.');
    return;
  }

  showGame();
}

/**
 * Traduce los mensajes de error más comunes de Supabase Auth a español,
 * dejando pasar cualquier otro mensaje tal cual venga.
 */
function traducirError(message) {
  const traducciones = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'User already registered': 'Ese correo ya tiene una cuenta registrada.',
    'email rate limit exceeded': 'Se alcanzó el límite de correos. Intenta de nuevo en unos minutos.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada (o spam).'
  };

  return traducciones[message] || message;
}

async function handleLogout() {
  await signOut();
  authFormEl.reset();
  showAuth();
}

function init() {
  authFormEl.addEventListener('submit', handleAuthSubmit);
  authToggleBtn.addEventListener('click', toggleMode);
  logoutBtn.addEventListener('click', handleLogout);

  // Gatekeeper inicial: decide qué pantalla mostrar al cargar la página.
  getSession().then((session) => {
    session ? showGame() : showAuth();
  });

  // Mantiene la UI sincronizada si la sesión cambia en otra pestaña,
  // expira, o se cierra desde otro lugar.
  onAuthStateChange((session) => {
    session ? showGame() : showAuth();
  });
}

document.addEventListener('DOMContentLoaded', init);
