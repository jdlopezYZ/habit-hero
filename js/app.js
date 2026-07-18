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
  function renderHeroStatus() {
    const state = HeroService.getState();
    const xpNeeded = HeroService.xpToNextLevel(state.level);
    const percentage = Math.min(100, Math.round((state.xp / xpNeeded) * 100));

    levelValueEl.textContent = state.level;

    xpBarFillEl.style.width = `${percentage}%`;
    xpBarLabelEl.textContent = `EXPERIENCIA: ${state.xp} / ${xpNeeded} XP`;
    xpBarEl.setAttribute('aria-valuenow', String(percentage));

    const showWarning = HeroService.isDecayWarning();
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

    const commit = () => {
      const newText = input.value.trim();
      if (newText && newText !== quest.text) {
        TaskService.editText(quest.id, newText);
      }
      renderQuestList();
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
  function renderQuestList() {
    const quests = TaskService.getAll();

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
  function handleAddQuest(event) {
    event.preventDefault();

    const text = questInputEl.value.trim();
    if (!text) return;

    // XP personalizada: si el campo está vacío o inválido, TaskService.add()
    // ya cae de vuelta a 10 XP por defecto.
    const xpValue = Number(questXpInputEl.value);

    TaskService.add(text, xpValue);

    questInputEl.value = '';
    questXpInputEl.value = '10';
    questInputEl.focus();

    renderQuestList();
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
  function handleToggleQuest(id) {
    const updated = TaskService.toggleComplete(id);
    if (!updated) return;

    if (updated.completed) {
      // Usa la XP personalizada de ESTA misión (quest.xpValue), no un
      // valor fijo global.
      const { leveledUp, levelsGained, state } = HeroService.addXp(updated.xpValue);

      showToast(`+${updated.xpValue} XP`, 'xp');

      if (leveledUp) {
        const label = levelsGained > 1
          ? `¡SUBISTE ${levelsGained} NIVELES! Ahora eres nivel ${state.level}`
          : `¡SUBISTE DE NIVEL! Ahora eres nivel ${state.level}`;
        showToast(label, 'levelup');
      }
    }

    renderHeroStatus();
    renderQuestList();

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
  function handleDeleteQuest(id) {
    const quest = TaskService.getById(id);
    if (!quest) return;

    const wasCompleted = quest.completed;
    const xpToRevert = quest.xpValue;

    TaskService.remove(id);

    if (wasCompleted) {
      const { leveledDown, levelsLost, state } = HeroService.subtractXp(xpToRevert);

      showToast(`-${xpToRevert} XP`, 'decay');

      if (leveledDown) {
        const label = levelsLost > 1
          ? `Perdiste ${levelsLost} niveles. Ahora eres nivel ${state.level}`
          : `Bajaste de nivel. Ahora eres nivel ${state.level}`;
        showToast(label, 'decay');
      }

      renderHeroStatus();
    }

    renderQuestList();
  }

  // ---- Decay periódico ----

  /**
   * Consulta a HeroService si corresponde aplicar penalización por
   * inactividad y, si ocurre, refresca la UI y avisa con un toast.
   */
  function checkDecay() {
    const { decayed, periodsPenalized } = HeroService.applyDecayIfNeeded();

    if (decayed) {
      showToast(
        `⚠ Energía debilitada: -${periodsPenalized * HeroService.DECAY_XP_PENALTY} XP por inactividad`,
        'decay'
      );
      renderHeroStatus();
    } else {
      // Aunque no haya decay, el aviso previo (isDecayWarning) puede
      // haber cambiado con el paso del tiempo.
      renderHeroStatus();
    }
  }

  // ---- Inicialización ----

  function init() {
    questFormEl.addEventListener('submit', handleAddQuest);

    // Revisa decay una vez al cargar (por si el usuario estuvo fuera)
    // y luego periódicamente mientras la pestaña esté abierta.
    checkDecay();
    window.setInterval(checkDecay, DECAY_CHECK_INTERVAL_MS);

    renderHeroStatus();
    renderQuestList();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
