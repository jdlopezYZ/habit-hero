/**
 * ============================================================
 *  AUTH SERVICE — Habit Hero
 * ============================================================
 *  Capa de autenticación. Envuelve las llamadas de Supabase Auth
 *  con el mismo estilo de "API interna" que ya usan HeroService
 *  y TaskService (funciones puras, sin tocar el DOM).
 * ============================================================
 */

import { supabase } from './supabaseClient.js';

/**
 * Registra un nuevo usuario con correo y contraseña.
 * El trigger `on_auth_user_created` en Supabase crea
 * automáticamente su fila en `profiles`.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('[AuthService] Error en signUp:', error.message);
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

/**
 * Inicia sesión con correo y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[AuthService] Error en signIn:', error.message);
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

/**
 * Cierra la sesión actual.
 * @returns {Promise<{error: string|null}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[AuthService] Error en signOut:', error.message);
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Devuelve la sesión activa (o null si no hay nadie logueado).
 * Útil para "guardas de ruta": decidir si mostrar login o dashboard.
 * @returns {Promise<Object|null>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[AuthService] Error en getSession:', error.message);
    return null;
  }

  return data.session;
}

/**
 * Se suscribe a cambios de sesión (login, logout, token refresh).
 * Devuelve la función para des-suscribirse.
 * @param {(session: Object|null) => void} callback
 * @returns {() => void}
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}
