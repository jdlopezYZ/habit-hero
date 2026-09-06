/**
 * ============================================================
 *  APP — Habit Hero (Controlador de Interfaz)
 * ============================================================
 *  Única capa que toca el DOM. Se apoya en:
 *    - TaskService: CRUD de misiones (localStorage)
 *    - HeroService: XP, nivel y decay por inactividad (localStorage)
 *
 *  Responsabilidades:
 *    - Pintar el estado del héroe (nivel, barra de XP, aviso de decay)
 *    - Pintar la lista de misiones
 *    - Manejar los eventos de usuario: añadir, completar, editar, eliminar
 *    - Mostrar pequeños efectos/toasts cuando ocurren eventos importantes
 *      (XP ganada, subida de nivel, decay aplicado)
 *
 *  Nota de clases CSS: las clases usadas aquí (quest-card, btn--edit, etc.)
 *  son el contrato visual que la Sesión 4 (CSS Pixel Art) usará para
 *  darles estilo. No se añade CSS en este archivo.
 * ============================================================
 */

import { TaskService } from './taskService.js';
import { HeroService } from './heroService.js';

(() => {

  // ---- Referencias a elementos del DOM (ya existentes en index.html) ----

  const levelValueEl   = document.getElementById('level-value');
  const xpBarEl         = document.getElementById('xp-bar');
  const xpBarFillEl     = document.getElementById('xp-bar-fill');
  const xpBarLabelEl    = document.getElementById('xp-bar-label');
  const decayWarningEl  = document.getElementById('decay-warning');

  const questFormEl     = document.getElementById('quest-form');
  const questInputEl    = document.getElementById('quest-input');
  const questXpInputEl  = document.getElementById('quest-xp-input');

  const questListEl     = document.getElementById('quest-list');
  const questListEmptyEl = document.getElementById('quest-list-empty');

  const fxLayerEl       = document.getElementById('fx-layer');

  // Cada cuánto revisamos si hay que aplicar decay por inactividad (1 min).
  const DECAY_CHECK_INTERVAL_MS = 60 * 1000;

  // Cuánto dura un toast en pantalla antes de desaparecer.
  const TOAST_DURATION_MS = 3000;

  // ---- Utilidades ----

  /**
   * Elige un icono temático según palabras clave dentro del texto de la misión.
   * Devuelve el nombre de un modificador BEM para <span class="pixel-icon pixel-icon--X">
   * (los sprites reales se definen como CSS en la Sesión 4).
   * @param {string} text
   * @returns {string}
   */
  function pickQuestIcon(text) {
    const normalized = text.toLowerCase();

    if (/(entren|ejercicio|gym|pesa|musculo|correr)/.test(normalized)) {
      return 'muscle';
    }
    if (/(agua|beber|botella|hidrat)/.test(normalized)) {
      return 'bottle';
    }
    if (/(dormir|sueño|descans|luna|noche)/.test(normalized)) {
      return 'moon';
    }
    return 'star';
  }

  /**
   * Crea un toast temporal dentro de #fx-layer.
   * @param {string} message
   * @param {string} [variant] - 'xp' | 'levelup' | 'decay'
   */
  function showToast(message, variant = 'xp') {
    const toast = document.createElement('div');
    toast.className = `fx-toast fx-toast--${variant}`;
    toast.textContent = message;

    fxLayerEl.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, TOAST_DURATION_MS);
  }

  // ---- Render: Estado del héroe ----

  /**
   * Pinta nivel, barra de XP y aviso de decay a partir del estado actual
   * de HeroService. Es idempotente: se puede llamar tantas veces como haga
   * falta para refrescar la UI.
   */
  async function renderHeroStatus() {
    const state = await HeroService.getState();
    const xpNeeded = HeroService.xpToNextLevel(state.level);
    const percentage = Math.min(100, Math.round((state.xp / xpNeeded) * 100));

    levelValueEl.textContent = state.level;

    xpBarFillEl.style.width = `${percentage}%`;
    xpBarLabelEl.textContent = `EXPERIENCIA: ${state.xp} / ${xpNeeded} XP`;
    xpBarEl.setAttribute('aria-valuenow', String(percentage));

    const showWarning = await HeroService.isDecayWarning();
    decayWarningEl.hidden = !showWarning;
  }

  // ---- Render: Lista de misiones ----

  /**
   * Construye el <li> de una misión concreta.
   * @param {Object} quest - Quest de TaskService
   * @returns {HTMLLIElement}
   */
  function buildQuestCard(quest) {
    const li = document.createElement('li');
    li.className = `quest-card${quest.completed ? ' quest-card--completed' : ''}`;
    li.dataset.id = quest.id;

    // --- Icono temático ---
    const icon = document.createElement('div');
    icon.className = 'quest-card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<span class="pixel-icon pixel-icon--${pickQuestIcon(quest.text)}"></span>`;

    // --- Checkbox pixelado ---
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'quest-card__checkbox-wrapper';
    checkboxWrapper.setAttribute('aria-label', quest.completed ? 'Marcar como pendiente' : 'Marcar como completada');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'quest-card__checkbox';
    checkbox.checked = quest.completed;
    checkbox.addEventListener('change', () => handleToggleQuest(quest.id));

    checkboxWrapper.appendChild(checkbox);

    // --- Texto de la misión (editable) + badge de recompensa ---
    const body = document.createElement('div');
    body.className = 'quest-card__body';

    const textEl = document.createElement('span');
    textEl.className = 'quest-card__text';
    textEl.textContent = quest.text;

    // Badge visual con la recompensa personalizada de ESTA misión
    // (quest.xpValue), no un valor fijo global.
    const rewardEl = document.createElement('span');
    rewardEl.className = 'quest-card__reward';
    rewardEl.textContent = `+${quest.xpValue} XP`;

    body.appendChild(textEl);
    body.appendChild(rewardEl);

    // --- Acciones: Editar / Eliminar (por tarjeta, icono + etiqueta) ---
    const actions = document.createElement('div');
    actions.className = 'quest-card__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--edit';
    editBtn.innerHTML = '<span class="btn__icon btn__icon--pencil" aria-hidden="true"></span>EDITAR';
    editBtn.addEventListener('click', () => enterEditMode(li, quest));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn--delete';
    deleteBtn.innerHTML = '<span class="btn__icon btn__icon--trash" aria-hidden="true"></span>ELIMINAR';
    deleteBtn.addEventListener('click', () => handleDeleteQuest(quest.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // --- Ensamblado final ---
    li.appendChild(checkboxWrapper);
    li.appendChild(body);
    li.appendChild(icon);
    li.appendChild(actions);

    return li;
  }

  /**
   * Reemplaza el texto de una tarjeta por un input editable, y confirma
   * el cambio al pulsar Enter o perder el foco. Escape cancela.
   * @param {HTMLLIElement} li
   * @param {Object} quest
   */
  function enterEditMode(li, quest) {
    const body = li.querySelector('.quest-card__body');
    const textEl = body.querySelector('.quest-card__text');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quest-card__edit-input';
    input.value = quest.text;
    input.maxLength = 60;

    body.replaceChild(input, textEl);
    input.focus();
    input.select();

    const commit = async () => {
      const newText = input.value.trim();
      if (newText && newText !== quest.text) {
        await TaskService.editText(quest.id, newText);
      }
      await renderQuestList();
    };

    const cancel = () => {
      renderQuestList();
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit();
      if (event.key === 'Escape') cancel();
    });

    input.addEventListener('blur', commit);
  }

  /**
   * Repinta la lista completa de misiones a partir de TaskService.getAll().
   * Muestra/oculta el mensaje de "lista vacía" según corresponda.
   */
  async function renderQuestList() {
    const quests = await TaskService.getAll();

    // Limpia todo excepto el mensaje de "vacío" (se controla aparte).
    questListEl.querySelectorAll('.quest-card').forEach(card => card.remove());

    questListEmptyEl.hidden = quests.length > 0;

    quests.forEach(quest => {
      questListEl.appendChild(buildQuestCard(quest));
    });
  }

  // ---- Handlers de eventos ----

  /**
   * Maneja el submit del formulario de nueva misión.
   * @param {SubmitEvent} event
   */
  async function handleAddQuest(event) {
    event.preventDefault();

    const text = questInputEl.value.trim();
    if (!text) return;

    // XP personalizada: si el campo está vacío o inválido, TaskService.add()
    // ya cae de vuelta a 10 XP por defecto.
    const xpValue = Number(questXpInputEl.value);

    await TaskService.add(text, xpValue);

    questInputEl.value = '';
    questXpInputEl.value = '10';
    questInputEl.focus();

    await renderQuestList();
  }

  /**
   * Añade temporalmente la clase .burst-effect a la tarjeta indicada para
   * disparar el estallido de celebración ("FUF"), y la retira 600ms
   * después para que las partículas no queden pegadas en bucle.
   * @param {string} id
   */
  function triggerBurstEffect(id) {
    const card = questListEl.querySelector(`.quest-card[data-id="${id}"]`);
    if (!card) return;

    card.classList.add('burst-effect');

    window.setTimeout(() => {
      card.classList.remove('burst-effect');
    }, 600);
  }

  /**
   * Maneja el toggle de completado de una misión. Solo otorga XP al
   * completar (no al desmarcar), y refresca héroe + lista.
   * @param {string} id
   */
  async function handleToggleQuest(id) {
    const updated = await TaskService.toggleComplete(id);
    if (!updated) return;

    if (updated.completed) {
      // Usa la XP personalizada de ESTA misión (quest.xpValue), no un
      // valor fijo global.
      const { leveledUp, levelsGained, state } = await HeroService.addXp(updated.xpValue);

      showToast(`+${updated.xpValue} XP`, 'xp');

      if (leveledUp) {
        const label = levelsGained > 1
          ? `¡SUBISTE ${levelsGained} NIVELES! Ahora eres nivel ${state.level}`
          : `¡SUBISTE DE NIVEL! Ahora eres nivel ${state.level}`;
        showToast(label, 'levelup');
      }
    } else {
      // BUG FIX: desmarcar una misión debe revertir la XP que se otorgó
      // al completarla, igual que ya se hacía al eliminarla. Antes esta
      // rama no existía y permitía acumular XP infinita marcando y
      // desmarcando la misma misión.
      const { leveledDown, levelsLost, state } = await HeroService.subtractXp(updated.xpValue);

      showToast(`-${updated.xpValue} XP`, 'decay');

      if (leveledDown) {
        const label = levelsLost > 1
          ? `Perdiste ${levelsLost} niveles. Ahora eres nivel ${state.level}`
          : `Bajaste de nivel. Ahora eres nivel ${state.level}`;
        showToast(label, 'decay');
      }
    }

    await renderHeroStatus();
    await renderQuestList();

    // El estallido se dispara DESPUÉS de repintar la lista, ya que
    // renderQuestList() reconstruye el DOM y el nodo anterior ya no existe.
    if (updated.completed) {
      triggerBurstEffect(id);
    }
  }

  /**
   * Maneja la eliminación de una misión.
   *
   * Regla especial: si la misión eliminada estaba COMPLETADA, se le resta
   * al héroe la XP que esa misión otorgó (quest.xpValue), usando
   * HeroService.subtractXp(), que maneja el "de-leveling" en cascada si
   * hace falta bajar de nivel (sin nunca caer por debajo de nivel 1).
   * Si estaba pendiente (no completada), no afecta la XP del héroe.
   * @param {string} id
   */
  async function handleDeleteQuest(id) {
    const quest = await TaskService.getById(id);
    if (!quest) return;

    const wasCompleted = quest.completed;
    const xpToRevert = quest.xpValue;

    await TaskService.remove(id);

    if (wasCompleted) {
      const { leveledDown, levelsLost, state } = await HeroService.subtractXp(xpToRevert);

      showToast(`-${xpToRevert} XP`, 'decay');

      if (leveledDown) {
        const label = levelsLost > 1
          ? `Perdiste ${levelsLost} niveles. Ahora eres nivel ${state.level}`
          : `Bajaste de nivel. Ahora eres nivel ${state.level}`;
        showToast(label, 'decay');
      }

      await renderHeroStatus();
    }

    await renderQuestList();
  }

  // ---- Reinicio diario (Daily Reset) ----

  // Clave de localStorage donde guardamos la fecha del último reinicio.
  const LAST_RESET_KEY = 'lastResetDate';

  /**
   * Devuelve la fecha "de hoy" en formato YYYY-MM-DD según el reloj local
   * del dispositivo (no UTC), para que el corte sea a medianoche local.
   * @returns {string}
   */
  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Revisa si cambió el día desde el último reinicio guardado en
   * localStorage. Si cambió:
   *   a) Desmarca (completed = false) todas las misiones diarias.
   *   b) Actualiza 'lastResetDate' con la fecha de hoy.
   *   c) Persiste el nuevo estado y refresca la UI.
   *
   * IMPORTANTE: Este reinicio NUNCA toca HeroService (XP/nivel), solo
   * el estado 'completed' de las misiones en TaskService. La XP ganada
   * el día anterior se conserva intacta.
   *
   * @returns {boolean} true si se ejecutó un reinicio, false si no hacía falta.
   */
  async function checkDailyReset() {
    const todayStr = getTodayDateString();
    const lastResetStr = localStorage.getItem(LAST_RESET_KEY);

    // Primera vez que se corre la app: solo registra la fecha, sin resetear.
    if (!lastResetStr) {
      localStorage.setItem(LAST_RESET_KEY, todayStr);
      return false;
    }

    // Si la fecha guardada es igual a la de hoy, no hay nada que hacer.
    if (lastResetStr === todayStr) {
      return false;
    }

    // ---- Cambió el día: desmarcar todas las misiones completadas ----
    const quests = await TaskService.getAll();

    for (const quest of quests) {
      if (quest.completed) {
        // Reutilizamos toggleComplete() porque es la única forma pública
        // de mutar 'completed' sin duplicar lógica de persistencia.
        // No otorga ni resta XP: HeroService no se toca en ningún momento.
        await TaskService.toggleComplete(quest.id);
      }
    }

    // Actualiza la fecha de control del reinicio.
    localStorage.setItem(LAST_RESET_KEY, todayStr);

    // Refresca la interfaz (la XP/nivel del héroe no cambia).
    await renderQuestList();
    await renderHeroStatus();

    return true;
  }

  // ---- Decay periódico ----

  /**
   * Consulta a HeroService si corresponde aplicar penalización por
   * inactividad y, si ocurre, refresca la UI y avisa con un toast.
   */
  async function checkDecay() {
    const { decayed, periodsPenalized } = await HeroService.applyDecayIfNeeded();

    if (decayed) {
      showToast(
        `⚠ Energía debilitada: -${periodsPenalized * HeroService.DECAY_XP_PENALTY} XP por inactividad`,
        'decay'
      );
      await renderHeroStatus();
    } else {
      // Aunque no haya decay, el aviso previo (isDecayWarning) puede
      // haber cambiado con el paso del tiempo.
      await renderHeroStatus();
    }
  }

  // ---- Inicialización ----

  /**
   * Carga y pinta todos los datos del usuario actual: reinicio diario,
   * decay, estado del héroe y lista de misiones. Se separa de init()
   * porque necesita poder volver a ejecutarse en un momento distinto a
   * "la página cargó": justo después de que authUI.js confirme que hay
   * una sesión activa (login, registro, o sesión ya existente al abrir
   * la app). Sin esto, si el usuario inicia sesión después de que la
   * página ya cargó, el juego se mostraría con datos vacíos.
   */
  async function loadGameData() {
    await checkDailyReset();
    await checkDecay();
    await renderHeroStatus();
    await renderQuestList();
  }

  async function init() {
    questFormEl.addEventListener('submit', handleAddQuest);

    // Revisa decay periódicamente mientras la pestaña esté abierta.
    window.setInterval(checkDecay, DECAY_CHECK_INTERVAL_MS);

    // Si la app queda abierta en segundo plano (PWA) durante la noche,
    // 'visibilitychange' y 'focus' detectan cuando vuelve a primer plano
    // para aplicar el reinicio de medianoche sin necesidad de recargar.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkDailyReset();
      }
    });

    window.addEventListener('focus', checkDailyReset);

    // Vuelve a cargar los datos del héroe y las misiones cada vez que
    // authUI.js confirma una sesión activa (login, registro, o sesión
    // ya existente al abrir la app).
    document.addEventListener('hh:session-started', loadGameData);

    await loadGameData();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
