/**
 * ============================================================
 *  TASK SERVICE — Habit Hero (Supabase)
 * ============================================================
 *  Capa de datos pura (estilo "API interna"), ahora respaldada
 *  por la tabla `quests` de Supabase en vez de localStorage.
 *  - No manipula el DOM.
 *  - No conoce nada de la interfaz visual.
 *  - Misma API pública que la versión con localStorage, pero
 *    cada función ahora es async porque implica una petición
 *    de red. RLS garantiza que cada usuario solo vea/mute sus
 *    propias misiones — no hace falta filtrar user_id a mano
 *    en los SELECT.
 *
 *  Mapeo de columnas (DB → objeto Quest en memoria):
 *    id            -> id
 *    text          -> text
 *    completed     -> completed
 *    xp_value      -> xpValue
 *    created_at    -> createdAt
 *    completed_at  -> completedAt
 * ============================================================
 */

import { supabase } from './supabaseClient.js';

export const TaskService = (() => {

  /**
   * Convierte una fila de la tabla `quests` (snake_case) al objeto
   * Quest en memoria (camelCase) que ya usa el resto de la app.
   * @param {Object} row
   * @returns {Object}
   */
  function mapRowToQuest(row) {
    return {
      id: row.id,
      text: row.text,
      completed: row.completed,
      xpValue: row.xp_value,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }

  /**
   * Devuelve el id del usuario actualmente autenticado.
   * @returns {Promise<string|null>}
   */
  async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      console.error('[TaskService] No hay usuario autenticado.');
      return null;
    }
    return data.user.id;
  }

  /**
   * Obtiene todas las misiones del usuario actual, ordenadas por
   * fecha de creación (más antigua primero, igual que el array de
   * localStorage crecía con .push()).
   * @returns {Promise<Array<Object>>}
   */
  async function getAll() {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[TaskService] Error al leer misiones:', error.message);
      return [];
    }

    return data.map(mapRowToQuest);
  }

  /**
   * Obtiene una misión por su id.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async function getById(id) {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('[TaskService] Error al buscar misión:', error.message);
      return undefined;
    }

    return mapRowToQuest(data);
  }

  /**
   * Añade una nueva misión para el usuario actual.
   * @param {string} text
   * @param {number} [xpValue=10]
   * @returns {Promise<Object|null>} la misión recién creada, o null si falló
   */
  async function add(text, xpValue = 10) {
    const trimmedText = String(text).trim();

    if (!trimmedText) {
      throw new Error('[TaskService] El texto de la misión no puede estar vacío.');
    }

    const parsedXp = Number(xpValue);
    const safeXp = Number.isFinite(parsedXp) && parsedXp > 0 ? Math.round(parsedXp) : 10;

    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('quests')
      .insert({
        user_id: userId,
        text: trimmedText,
        xp_value: safeXp
      })
      .select()
      .single();

    if (error) {
      console.error('[TaskService] Error al añadir misión:', error.message);
      return null;
    }

    return mapRowToQuest(data);
  }

  /**
   * Alterna el estado completado/pendiente de una misión.
   * Actualiza completed_at en consecuencia.
   * @param {string} id
   * @param {boolean} [knownTargetState] - Si el llamador ya sabe a qué
   *   estado debe quedar la misión (p. ej. app.js ya conoce el valor del
   *   checkbox tras el clic), se lo puede pasar aquí y así se evita una
   *   lectura de red previa solo para "adivinar" el estado actual.
   * @returns {Promise<Object|null>} la misión actualizada, o null si no existe
   */
  async function toggleComplete(id, knownTargetState) {
    let newCompleted = knownTargetState;

    if (typeof newCompleted !== 'boolean') {
      const current = await getById(id);
      if (!current) {
        console.warn(`[TaskService] No se encontró la misión con id: ${id}`);
        return null;
      }
      newCompleted = !current.completed;
    }

    const { data, error } = await supabase
      .from('quests')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[TaskService] Error al actualizar misión:', error.message);
      return null;
    }

    return mapRowToQuest(data);
  }

  /**
   * Edita el texto de una misión existente.
   * @param {string} id
   * @param {string} newText
   * @returns {Promise<Object|null>} la misión actualizada, o null si no existe
   */
  async function editText(id, newText) {
    const trimmedText = String(newText).trim();

    if (!trimmedText) {
      throw new Error('[TaskService] El nuevo texto de la misión no puede estar vacío.');
    }

    const { data, error } = await supabase
      .from('quests')
      .update({ text: trimmedText })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[TaskService] Error al editar misión:', error.message);
      return null;
    }

    return mapRowToQuest(data);
  }

  /**
   * Elimina una misión por su id.
   * @param {string} id
   * @returns {Promise<boolean>} true si se eliminó, false si falló
   */
  async function remove(id) {
    const { error } = await supabase
      .from('quests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[TaskService] Error al eliminar misión:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Elimina TODAS las misiones del usuario actual. Útil para reinicios/tests.
   * @returns {Promise<boolean>}
   */
  async function clearAll() {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('quests')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[TaskService] Error al limpiar misiones:', error.message);
      return false;
    }

    return true;
  }

  // API pública del servicio (misma forma que la versión localStorage)
  return {
    getAll,
    getById,
    add,
    toggleComplete,
    editText,
    remove,
    clearAll
  };

})();
