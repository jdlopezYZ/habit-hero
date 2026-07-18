/**
 * ============================================================
 *  TASK SERVICE — Habit Hero
 * ============================================================
 *  Capa de datos pura (estilo "API interna").
 *  - No manipula el DOM.
 *  - No conoce nada de la interfaz visual.
 *  - Su única responsabilidad es leer/escribir el array de
 *    misiones en localStorage y exponer un CRUD sencillo.
 *
 *  Estructura de una misión (Quest):
 *  {
 *    id: string,          // identificador único
 *    text: string,        // nombre de la misión
 *    completed: boolean,  // estado actual
 *    xpValue: number,     // XP que otorga esta misión concreta al completarse
 *    createdAt: string,   // ISO date de creación
 *    completedAt: string | null // ISO date del último "completado"
 *  }
 *
 *  NOTA: completedAt se deja preparado aquí porque la Sesión 2
 *  (mecánica de XP y decay por inactividad) lo necesitará para
 *  calcular el tiempo transcurrido desde la última acción.
 * ============================================================
 */

const TaskService = (() => {

  const STORAGE_KEY = 'habit-hero:quests';

  /**
   * Genera un id único simple (sin dependencias externas).
   * Combina timestamp + número aleatorio.
   */
  function generateId() {
    return `quest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Lee el array completo de misiones desde localStorage.
   * Si no existe nada guardado, o el JSON está corrupto,
   * devuelve un array vacío de forma segura.
   * @returns {Array<Object>}
   */
  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[TaskService] Error al leer localStorage:', error);
      return [];
    }
  }

  /**
   * Persiste el array completo de misiones en localStorage.
   * @param {Array<Object>} quests
   * @returns {boolean} éxito de la operación
   */
  function saveAll(quests) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
      return true;
    } catch (error) {
      console.error('[TaskService] Error al guardar en localStorage:', error);
      return false;
    }
  }

  /**
   * Obtiene una misión por su id.
   * @param {string} id
   * @returns {Object|undefined}
   */
  function getById(id) {
    return getAll().find(quest => quest.id === id);
  }

  /**
   * Añade una nueva misión.
   * @param {string} text - Nombre/descripción de la misión
   * @param {number} [xpValue=10] - XP que otorgará esta misión concreta al completarse
   * @returns {Object} la misión recién creada
   */
  function add(text, xpValue = 10) {
    const trimmedText = String(text).trim();

    if (!trimmedText) {
      throw new Error('[TaskService] El texto de la misión no puede estar vacío.');
    }

    const parsedXp = Number(xpValue);
    const safeXp = Number.isFinite(parsedXp) && parsedXp > 0 ? Math.round(parsedXp) : 10;

    const newQuest = {
      id: generateId(),
      text: trimmedText,
      completed: false,
      xpValue: safeXp,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    const quests = getAll();
    quests.push(newQuest);
    saveAll(quests);

    return newQuest;
  }

  /**
   * Alterna el estado completado/pendiente de una misión.
   * Actualiza completedAt en consecuencia.
   * @param {string} id
   * @returns {Object|null} la misión actualizada, o null si no existe
   */
  function toggleComplete(id) {
    const quests = getAll();
    const index = quests.findIndex(quest => quest.id === id);

    if (index === -1) {
      console.warn(`[TaskService] No se encontró la misión con id: ${id}`);
      return null;
    }

    quests[index].completed = !quests[index].completed;
    quests[index].completedAt = quests[index].completed
      ? new Date().toISOString()
      : null;

    saveAll(quests);
    return quests[index];
  }

  /**
   * Edita el texto de una misión existente.
   * @param {string} id
   * @param {string} newText
   * @returns {Object|null} la misión actualizada, o null si no existe
   */
  function editText(id, newText) {
    const trimmedText = String(newText).trim();

    if (!trimmedText) {
      throw new Error('[TaskService] El nuevo texto de la misión no puede estar vacío.');
    }

    const quests = getAll();
    const index = quests.findIndex(quest => quest.id === id);

    if (index === -1) {
      console.warn(`[TaskService] No se encontró la misión con id: ${id}`);
      return null;
    }

    quests[index].text = trimmedText;
    saveAll(quests);
    return quests[index];
  }

  /**
   * Elimina una misión por su id.
   * @param {string} id
   * @returns {boolean} true si se eliminó, false si no existía
   */
  function remove(id) {
    const quests = getAll();
    const filtered = quests.filter(quest => quest.id !== id);

    if (filtered.length === quests.length) {
      console.warn(`[TaskService] No se encontró la misión con id: ${id}`);
      return false;
    }

    saveAll(filtered);
    return true;
  }

  /**
   * Elimina TODAS las misiones. Útil para reinicios/tests.
   * @returns {boolean}
   */
  function clearAll() {
    return saveAll([]);
  }

  // API pública del servicio
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
