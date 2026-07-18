/**
 * ============================================================
 *  HERO SERVICE — Habit Hero
 * ============================================================
 *  Capa de datos pura para la mecánica de RPG.
 *  - No manipula el DOM (eso ocurre en app.js, Sesión 3).
 *  - Responsable de: estado del héroe (nivel, XP, última
 *    actividad), fórmula de progreso, subida de nivel y
 *    penalización por inactividad ("decay").
 *
 *  Estructura del estado del héroe (HeroState):
 *  {
 *    level: number,          // nivel actual, mínimo 1
 *    xp: number,              // XP acumulada dentro del nivel actual
 *    lastActivityAt: string | null // ISO date de la última vez que se ganó XP
 *  }
 * ============================================================
 */

const HeroService = (() => {

  const STORAGE_KEY = 'habit-hero:hero';

  // ---- Configuración de la mecánica de RPG ----

  // XP que otorga completar una misión.
  const QUEST_XP_REWARD = 10;

  // Cuántas horas de inactividad deben pasar para que empiece el decay.
  const DECAY_THRESHOLD_HOURS = 24;

  // Cuánta XP se pierde por cada bloque de 24h de inactividad transcurrido.
  const DECAY_XP_PENALTY = 15;

  // A partir de cuántas horas sin actividad mostramos el aviso de advertencia
  // (antes de que el decay se aplique realmente). Se usa en la Sesión 3 para
  // pintar #decay-warning.
  const DECAY_WARNING_HOURS = 20;

  const DEFAULT_STATE = {
    level: 1,
    xp: 0,
    lastActivityAt: null
  };

  /**
   * XP total necesaria para subir del nivel `level` al siguiente.
   * Curva simple y creciente: cada nivel exige 100 XP más que el anterior.
   * Nivel 1 -> 2: 100 XP
   * Nivel 2 -> 3: 200 XP
   * Nivel 3 -> 4: 300 XP ...
   * @param {number} level
   * @returns {number}
   */
  function xpToNextLevel(level) {
    return level * 100;
  }

  /**
   * Lee el estado del héroe desde localStorage.
   * Si no existe o está corrupto, devuelve el estado por defecto.
   * @returns {Object} HeroState
   */
  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };

      const parsed = JSON.parse(raw);
      return {
        level: typeof parsed.level === 'number' && parsed.level >= 1 ? parsed.level : 1,
        xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : 0,
        lastActivityAt: parsed.lastActivityAt ?? null
      };
    } catch (error) {
      console.error('[HeroService] Error al leer el estado del héroe:', error);
      return { ...DEFAULT_STATE };
    }
  }

  /**
   * Persiste el estado del héroe en localStorage.
   * @param {Object} state - HeroState
   * @returns {boolean} éxito de la operación
   */
  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('[HeroService] Error al guardar el estado del héroe:', error);
      return false;
    }
  }

  /**
   * Reinicia el estado del héroe a los valores por defecto.
   * @returns {Object} HeroState
   */
  function reset() {
    const fresh = { ...DEFAULT_STATE };
    saveState(fresh);
    return fresh;
  }

  /**
   * Horas transcurridas desde la última actividad registrada.
   * Si nunca hubo actividad, devuelve Infinity (para no disparar decay
   * sobre un héroe que aún no ha hecho nada).
   * @param {Object} [state] - HeroState opcional, si no se pasa se lee del storage
   * @returns {number}
   */
  function getHoursSinceLastActivity(state = getState()) {
    if (!state.lastActivityAt) return Infinity;

    const last = new Date(state.lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();

    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Indica si se debe mostrar el aviso de advertencia por inactividad
   * (zona previa al decay real). Pensado para alimentar #decay-warning
   * en la Sesión 3.
   * @returns {boolean}
   */
  function isDecayWarning() {
    const hours = getHoursSinceLastActivity();
    return hours >= DECAY_WARNING_HOURS && hours < DECAY_THRESHOLD_HOURS;
  }

  /**
   * Resta una cantidad de XP al héroe, bajando de nivel en cascada
   * ("de-leveling") si la resta deja la XP negativa dentro del nivel
   * actual. Es la operación inversa de addXp().
   *
   * No permite que el nivel baje de 1: si la resta agota toda la XP
   * disponible incluso en nivel 1, la XP simplemente se bloquea en 0
   * (no hay "nivel 0" ni XP negativa).
   *
   * No modifica lastActivityAt: restar XP por eliminar una misión no
   * cuenta como "actividad" nueva del héroe.
   *
   * @param {number} amount - XP a restar (debe ser positiva)
   * @returns {{state: Object, leveledDown: boolean, levelsLost: number}}
   */
  function subtractXp(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('[HeroService] La cantidad de XP a restar debe ser un número positivo.');
    }

    const state = getState();
    let remaining = amount;
    let levelsLost = 0;

    while (remaining > 0) {
      if (state.xp >= remaining) {
        state.xp -= remaining;
        remaining = 0;
      } else if (state.level > 1) {
        // No alcanza la XP del nivel actual: se agota este nivel entero
        // y se retrocede uno, arrastrando el sobrante de la resta.
        remaining -= state.xp;
        state.level -= 1;
        levelsLost += 1;
        state.xp = xpToNextLevel(state.level) - 1; // casi al borde del nivel anterior
      } else {
        // Ya en nivel 1 sin XP suficiente: se bloquea en 0, sin bajar más.
        state.xp = 0;
        remaining = 0;
      }
    }

    saveState(state);

    return {
      state,
      leveledDown: levelsLost > 0,
      levelsLost
    };
  }

  /**
   * Aplica una cantidad de XP al héroe y resuelve subidas de nivel en
   * cascada (por si la XP otorgada alcanza para subir más de un nivel).
   * También actualiza lastActivityAt a "ahora", ya que ganar XP cuenta
   * como actividad.
   * @param {number} amount - XP a añadir (debe ser positiva)
   * @returns {{state: Object, leveledUp: boolean, levelsGained: number}}
   */
  function addXp(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('[HeroService] La cantidad de XP debe ser un número positivo.');
    }

    const state = getState();
    let levelsGained = 0;

    state.xp += amount;

    // Cascada de subidas de nivel: si la XP sobra, sube de nivel las veces
    // que haga falta, arrastrando el sobrante al nivel siguiente.
    let threshold = xpToNextLevel(state.level);
    while (state.xp >= threshold) {
      state.xp -= threshold;
      state.level += 1;
      levelsGained += 1;
      threshold = xpToNextLevel(state.level);
    }

    state.lastActivityAt = new Date().toISOString();

    saveState(state);

    return {
      state,
      leveledUp: levelsGained > 0,
      levelsGained
    };
  }

  /**
   * Otorga la XP estándar por completar una misión.
   * Atajo semántico sobre addXp() para usar desde app.js en la Sesión 3.
   * @returns {{state: Object, leveledUp: boolean, levelsGained: number}}
   */
  function rewardQuestCompletion() {
    return addXp(QUEST_XP_REWARD);
  }

  /**
   * Revisa si el héroe ha estado inactivo más allá del umbral de decay y,
   * si es así, aplica la penalización correspondiente (pudiendo bajar de
   * nivel en cascada si la XP resultante es negativa).
   *
   * Es "idempotente para el mismo bloque de tiempo": tras aplicar la
   * penalización, lastActivityAt avanza exactamente los bloques de 24h
   * ya penalizados, para no volver a penalizar el mismo periodo dos veces
   * en la siguiente llamada.
   *
   * @returns {{state: Object, decayed: boolean, periodsPenalized: number}}
   */
  function applyDecayIfNeeded() {
    const state = getState();
    const hours = getHoursSinceLastActivity(state);

    if (hours === Infinity || hours < DECAY_THRESHOLD_HOURS) {
      return { state, decayed: false, periodsPenalized: 0 };
    }

    const periodsPenalized = Math.floor(hours / DECAY_THRESHOLD_HOURS);
    let totalPenalty = periodsPenalized * DECAY_XP_PENALTY;

    // Aplica la penalización, bajando de nivel en cascada si la XP
    // se queda negativa, sin permitir que el nivel baje de 1.
    while (totalPenalty > 0) {
      if (state.xp >= totalPenalty) {
        state.xp -= totalPenalty;
        totalPenalty = 0;
      } else if (state.level > 1) {
        totalPenalty -= state.xp;
        state.level -= 1;
        state.xp = xpToNextLevel(state.level) - 1; // casi al borde del nivel anterior
      } else {
        // Ya está en nivel 1 y sin XP suficiente: no puede bajar más.
        state.xp = 0;
        totalPenalty = 0;
      }
    }

    // Avanza lastActivityAt los bloques de 24h ya penalizados, para que
    // el resto de horas "sueltas" sigan contando de cara al próximo check.
    const last = new Date(state.lastActivityAt);
    last.setHours(last.getHours() + periodsPenalized * DECAY_THRESHOLD_HOURS);
    state.lastActivityAt = last.toISOString();

    saveState(state);

    return { state, decayed: true, periodsPenalized };
  }

  // API pública del servicio
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
