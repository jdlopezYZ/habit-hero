/**
 * ============================================================
 *  HERO SERVICE — Habit Hero (Supabase)
 * ============================================================
 *  Capa de datos pura para la mecánica de RPG, ahora respaldada
 *  por la tabla `profiles` de Supabase en vez de localStorage.
 *
 *  IMPORTANTE: toda la lógica de cálculo (fórmula de XP, cascada
 *  de subida/bajada de nivel, decay por inactividad) es IDÉNTICA
 *  a la versión con localStorage. Lo único que cambia es de dónde
 *  se lee el estado inicial (getState) y a dónde se persiste al
 *  final (saveState) — ahora una fila en `profiles` en vez de una
 *  clave de localStorage.
 *
 *  Mapeo de columnas (DB → HeroState en memoria):
 *    level             -> level
 *    xp                -> xp
 *    last_activity_at  -> lastActivityAt
 * ============================================================
 */

import { supabase } from './supabaseClient.js';

export const HeroService = (() => {

  // ---- Configuración de la mecánica de RPG (sin cambios) ----

  const QUEST_XP_REWARD = 10;
  const DECAY_THRESHOLD_HOURS = 24;
  const DECAY_XP_PENALTY = 15;
  const DECAY_WARNING_HOURS = 20;

  const DEFAULT_STATE = {
    level: 1,
    xp: 0,
    lastActivityAt: null
  };

  /**
   * XP total necesaria para subir del nivel `level` al siguiente.
   * Sin cambios respecto a la versión con localStorage.
   * @param {number} level
   * @returns {number}
   */
  function xpToNextLevel(level) {
    return level * 100;
  }

  /**
   * Devuelve el id del usuario actualmente autenticado.
   * @returns {Promise<string|null>}
   */
  async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      console.error('[HeroService] No hay usuario autenticado.');
      return null;
    }
    return data.user.id;
  }

  /**
   * Lee el estado del héroe desde la fila `profiles` del usuario actual.
   * Si algo falla, devuelve el estado por defecto (mismo comportamiento
   * defensivo que la versión con localStorage cuando el storage estaba
   * vacío o corrupto).
   * @returns {Promise<Object>} HeroState
   */
  async function getState() {
    const userId = await getCurrentUserId();
    if (!userId) return { ...DEFAULT_STATE };

    const { data, error } = await supabase
      .from('profiles')
      .select('level, xp, last_activity_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('[HeroService] Error al leer el perfil:', error.message);
      return { ...DEFAULT_STATE };
    }

    return {
      level: typeof data.level === 'number' && data.level >= 1 ? data.level : 1,
      xp: typeof data.xp === 'number' && data.xp >= 0 ? data.xp : 0,
      lastActivityAt: data.last_activity_at ?? null
    };
  }

  /**
   * Persiste el estado del héroe en la fila `profiles` del usuario actual.
   * @param {Object} state - HeroState
   * @returns {Promise<boolean>} éxito de la operación
   */
  async function saveState(state) {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('profiles')
      .update({
        level: state.level,
        xp: state.xp,
        last_activity_at: state.lastActivityAt
      })
      .eq('id', userId);

    if (error) {
      console.error('[HeroService] Error al guardar el perfil:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Reinicia el estado del héroe a los valores por defecto.
   * @returns {Promise<Object>} HeroState
   */
  async function reset() {
    const fresh = { ...DEFAULT_STATE };
    await saveState(fresh);
    return fresh;
  }

  /**
   * Horas transcurridas desde la última actividad registrada.
   * Sigue siendo síncrona: solo hace aritmética sobre un HeroState
   * que ya se tiene en memoria (no toca la red).
   * @param {Object} state - HeroState
   * @returns {number}
   */
  function getHoursSinceLastActivity(state) {
    if (!state.lastActivityAt) return Infinity;

    const last = new Date(state.lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();

    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Indica si se debe mostrar el aviso de advertencia por inactividad.
   * @param {Object} [precomputedState] - HeroState ya conocido en memoria
   *   (por ejemplo, el que acaba de devolver addXp/subtractXp). Si se pasa,
   *   se evita una lectura de red redundante a `profiles`.
   * @returns {Promise<boolean>}
   */
  async function isDecayWarning(precomputedState) {
    const state = precomputedState || await getState();
    const hours = getHoursSinceLastActivity(state);
    return hours >= DECAY_WARNING_HOURS && hours < DECAY_THRESHOLD_HOURS;
  }

  /**
   * Resta una cantidad de XP al héroe, bajando de nivel en cascada
   * ("de-leveling") si la resta deja la XP negativa dentro del nivel
   * actual. Lógica de cálculo idéntica a la versión con localStorage.
   * @param {number} amount - XP a restar (debe ser positiva)
   * @returns {Promise<{state: Object, leveledDown: boolean, levelsLost: number}>}
   */
  async function subtractXp(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('[HeroService] La cantidad de XP a restar debe ser un número positivo.');
    }

    const state = await getState();
    let remaining = amount;
    let levelsLost = 0;

    while (remaining > 0) {
      if (state.xp >= remaining) {
        state.xp -= remaining;
        remaining = 0;
      } else if (state.level > 1) {
        remaining -= state.xp;
        state.level -= 1;
        levelsLost += 1;
        state.xp = xpToNextLevel(state.level) - 1;
      } else {
        state.xp = 0;
        remaining = 0;
      }
    }

    await saveState(state);

    return {
      state,
      leveledDown: levelsLost > 0,
      levelsLost
    };
  }

  /**
   * Aplica una cantidad de XP al héroe y resuelve subidas de nivel en
   * cascada. Lógica de cálculo idéntica a la versión con localStorage.
   * @param {number} amount - XP a añadir (debe ser positiva)
   * @returns {Promise<{state: Object, leveledUp: boolean, levelsGained: number}>}
   */
  async function addXp(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('[HeroService] La cantidad de XP debe ser un número positivo.');
    }

    const state = await getState();
    let levelsGained = 0;

    state.xp += amount;

    let threshold = xpToNextLevel(state.level);
    while (state.xp >= threshold) {
      state.xp -= threshold;
      state.level += 1;
      levelsGained += 1;
      threshold = xpToNextLevel(state.level);
    }

    state.lastActivityAt = new Date().toISOString();

    await saveState(state);

    return {
      state,
      leveledUp: levelsGained > 0,
      levelsGained
    };
  }

  /**
   * Otorga la XP estándar por completar una misión.
   * @returns {Promise<{state: Object, leveledUp: boolean, levelsGained: number}>}
   */
  async function rewardQuestCompletion() {
    return addXp(QUEST_XP_REWARD);
  }

  /**
   * Revisa si el héroe ha estado inactivo más allá del umbral de decay y,
   * si es así, aplica la penalización correspondiente. Lógica de cálculo
   * idéntica a la versión con localStorage.
   * @returns {Promise<{state: Object, decayed: boolean, periodsPenalized: number}>}
   */
  async function applyDecayIfNeeded() {
    const state = await getState();
    const hours = getHoursSinceLastActivity(state);

    if (hours === Infinity || hours < DECAY_THRESHOLD_HOURS) {
      return { state, decayed: false, periodsPenalized: 0 };
    }

    const periodsPenalized = Math.floor(hours / DECAY_THRESHOLD_HOURS);
    let totalPenalty = periodsPenalized * DECAY_XP_PENALTY;

    while (totalPenalty > 0) {
      if (state.xp >= totalPenalty) {
        state.xp -= totalPenalty;
        totalPenalty = 0;
      } else if (state.level > 1) {
        totalPenalty -= state.xp;
        state.level -= 1;
        state.xp = xpToNextLevel(state.level) - 1;
      } else {
        state.xp = 0;
        totalPenalty = 0;
      }
    }

    const last = new Date(state.lastActivityAt);
    last.setHours(last.getHours() + periodsPenalized * DECAY_THRESHOLD_HOURS);
    state.lastActivityAt = last.toISOString();

    await saveState(state);

    return { state, decayed: true, periodsPenalized };
  }

  // API pública del servicio (misma forma que la versión localStorage)
  return {
    getState,
    reset,
    xpToNextLevel,
    getHoursSinceLastActivity,
    isDecayWarning,
    addXp,
    subtractXp,
    rewardQuestCompletion,
    applyDecayIfNeeded,
    QUEST_XP_REWARD,
    DECAY_THRESHOLD_HOURS,
    DECAY_XP_PENALTY,
    DECAY_WARNING_HOURS
  };

})();
