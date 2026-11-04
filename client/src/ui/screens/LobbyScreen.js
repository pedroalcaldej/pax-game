import {
  AVAILABLE_NATION_COLORS,
  MAX_PLAYER_NAME_LENGTH,
  MAX_PLAYERS,
  NATIONS,
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_PRESETS
} from '../../../../shared/Constants.js';

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export class LobbyScreen {
  constructor(mount, callbacks = {}) {
    this.mount = mount;
    this.callbacks = callbacks;
    this.mount.innerHTML = `
      <section class="pax-start-menu" id="start-menu" aria-label="Menú inicial">
        <div class="pax-start-card">
          <div class="pax-start-brand">PAX</div>
          <div id="room-menu">
            <h1>El mundo espera tus órdenes</h1>
            <div class="pax-start-options">
              <section class="pax-start-option">
                <h2>Un jugador</h2>
                <p>Juega una partida contra países controlados por la IA.</p>
                <div class="pax-profile-fields">
                  <label>Nombre <input id="single-player-name" maxlength="${MAX_PLAYER_NAME_LENGTH}" value="alpha" autocomplete="off" /></label>
                  <label>Color <div class="pax-color-picker" id="single-player-color" role="radiogroup" aria-label="Color del país"></div></label>
                </div>
                <button class="pax-lobby-copy pax-settings-toggle" id="single-settings-toggle" type="button" aria-expanded="false" aria-controls="single-settings">⚙ Configurar partida</button>
                <div class="pax-single-settings" id="single-settings" hidden>
                  <label>Preset
                    <select id="single-settings-preset">
                      <option value="short" selected>Corto</option><option value="long">Largo</option><option value="custom">Personalizado</option>
                    </select>
                  </label>
                  <div class="pax-settings-grid">
                    <label>Rondas <input id="single-settings-rounds" type="number" min="5" max="100" value="15"></label>
                    <label>Planificación (s) <input id="single-settings-planning" type="number" min="15" max="300" value="30"></label>
                    <label>Acciones <input id="single-settings-actions" type="number" min="1" max="6" value="3"></label>
                    <label>Frecuencia OI <input id="single-settings-oi-frequency" type="number" min="0" max="20" value="5"></label>
                    <label>Tamaño del mapa <input id="single-settings-map-size" type="number" min="12" max="50" value="20"></label>
                  </div>
                  <label>Semilla <input id="single-settings-seed" maxlength="40" placeholder="Aleatoria"></label>
                </div>
                <button class="pax-start-button" id="single-player-button" type="button">Nueva partida</button>
              </section>
              <section class="pax-start-option">
                <h2>Multijugador</h2>
                <p>Crea una sala o únete con un código de seis caracteres.</p>
                <div class="pax-room-actions">
                  <button class="pax-start-button" id="create-room-button" type="button">Crear sala</button>
                  <button class="pax-start-button" id="quick-match-button" type="button">Partida rápida</button>
                  <div class="pax-join-room">
                    <label for="room-code-input">Código de sala</label>
                    <div class="pax-join-room-row">
                      <input id="room-code-input" maxlength="6" autocomplete="off" placeholder="PAX123" />
                      <button class="pax-start-button" id="join-room-button" type="button">Unirse</button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <section class="pax-audio-controls" aria-label="Controles de sonido">
              <h3>Sonido</h3>
              <label><span>Música <output data-audio-output="music">28%</output></span><input type="range" min="0" max="100" step="1" data-audio-volume="music" aria-label="Volumen de la música"></label>
              <label><span>Efectos <output data-audio-output="effects">65%</output></span><input type="range" min="0" max="100" step="1" data-audio-volume="effects" aria-label="Volumen de los efectos de sonido"></label>
            </section>
          </div>
          <div id="lobby-view" hidden>
            <h1 id="lobby-title">Sala <strong id="lobby-code"></strong></h1>
            <div class="pax-lobby-code-row">
              <button class="pax-lobby-copy" id="copy-room-code" type="button">Copiar código</button>
              <span id="lobby-count">Jugadores en la sala: 0 / ${MAX_PLAYERS}</span>
            </div>
            <div class="pax-lobby-profile">
              <label>Nombre <input id="lobby-player-name" maxlength="${MAX_PLAYER_NAME_LENGTH}" autocomplete="off" /></label>
              <label>Color <div class="pax-color-picker" id="lobby-player-color" role="radiogroup" aria-label="Color del país"></div></label>
            </div>
            <button class="pax-lobby-copy pax-settings-toggle" id="lobby-settings-toggle" type="button" aria-expanded="false" aria-controls="lobby-settings" hidden>⚙ Configurar partida</button>
            <section class="pax-lobby-settings" id="lobby-settings" hidden>
              <h2>Configuración de partida</h2>
              <label>Preset
                <select id="lobby-settings-preset">
                  <option value="short" selected>Corto</option>
                  <option value="long">Largo</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              <div class="pax-settings-grid">
                <label>Rondas <input id="settings-rounds" type="number" min="5" max="100"></label>
                <label>Segundos de planificación <input id="settings-planning" type="number" min="15" max="300"></label>
                <label>Acciones por ronda <input id="settings-actions" type="number" min="1" max="6"></label>
                <label>Frecuencia OI (0 = nunca) <input id="settings-oi-frequency" type="number" min="0" max="20"></label>
                <label>Tamaño del mapa <input id="settings-map-size" type="number" min="12" max="50"></label>
                <label>Semilla <input id="settings-seed" maxlength="40" placeholder="Aleatoria"></label>
              </div>
              <button class="pax-lobby-copy" id="save-lobby-settings" type="button">Guardar configuración</button>
              <p id="lobby-settings-summary"></p>
            </section>
            <div class="pax-lobby-slots" id="lobby-slots"></div>
            <button class="pax-start-button" id="start-room-button" type="button" hidden>Listo (0/0)</button>
            <button class="pax-lobby-copy" id="leave-lobby-button" type="button">Volver al menú principal</button>
          </div>
          <p class="pax-start-status" id="start-status" role="status">Conéctate al servidor para crear o unirte a salas.</p>
        </div>
      </section>`;
    this.root = this.mount.querySelector('#start-menu');
    this.populateColorSelectors();
    this.bindEvents();
  }

  query(selector) {
    return this.mount.querySelector(selector);
  }

  bindEvents() {
    this.query('#create-room-button').addEventListener('click', () => this.callbacks.onCreate?.());
    this.query('#quick-match-button').addEventListener('click', () => this.callbacks.onQuickMatch?.());
    this.query('#single-player-button').addEventListener('click', () => this.callbacks.onSinglePlayer?.());
    this.query('#join-room-button').addEventListener('click', () => {
      this.callbacks.onJoin?.(this.query('#room-code-input').value);
    });
    this.query('#room-code-input').addEventListener('input', (event) => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });
    this.query('#copy-room-code').addEventListener('click', () => this.callbacks.onCopy?.());
    this.query('#start-room-button').addEventListener('click', () => this.callbacks.onReady?.());
    this.query('#leave-lobby-button').addEventListener('click', () => this.callbacks.onLeave?.());
    this.query('#save-lobby-settings').addEventListener('click', () => this.callbacks.onSettingsChange?.(this.readSettings()));
    this.query('#single-settings-toggle').addEventListener('click', () => this.toggleSettings('single'));
    this.query('#lobby-settings-toggle').addEventListener('click', () => this.toggleSettings('lobby'));
    this.query('#single-settings-preset').addEventListener('change', (event) => {
      const preset = GAME_SETTINGS_PRESETS[event.target.value];
      if (preset) this.writeSettings({ ...this.readSettings('single'), ...preset, preset: event.target.value }, 'single');
    });
    this.query('#lobby-settings-preset').addEventListener('change', (event) => {
      const preset = GAME_SETTINGS_PRESETS[event.target.value];
      if (!preset) return;
      this.writeSettings({ ...this.readSettings(), ...preset, preset: event.target.value });
    });

    const nameInput = this.query('#lobby-player-name');
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nameInput.blur();
      }
    });
    nameInput.addEventListener('blur', () => this.callbacks.onProfileChange?.());

    for (const picker of this.mount.querySelectorAll('.pax-color-picker')) {
      picker.addEventListener('click', (event) => {
        const choice = event.target.closest?.('[data-color]');
        if (!choice || choice.disabled) return;
        this.selectColor(picker, choice.dataset.color);
        this.callbacks.onColorSelect?.(picker, choice.dataset.color);
      });
    }
  }

  populateColorSelectors() {
    const options = AVAILABLE_NATION_COLORS.map((color) => (
      `<button class="pax-color-choice" type="button" data-color="${color}" style="background:${color}" aria-label="Seleccionar color ${color}" aria-checked="false" role="radio"></button>`
    )).join('');
    for (const picker of this.mount.querySelectorAll('.pax-color-picker')) picker.innerHTML = options;
    this.selectColor(this.query('#single-player-color'), AVAILABLE_NATION_COLORS[0]);
    this.selectColor(this.query('#lobby-player-color'), AVAILABLE_NATION_COLORS[0]);
  }

  selectColor(picker, color) {
    for (const choice of picker?.querySelectorAll('[data-color]') || []) {
      const selected = choice.dataset.color === color;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-checked', String(selected));
    }
  }

  selectedColor(id) {
    return this.query(`#${id} .is-selected`)?.dataset.color;
  }

  readSettings(scope = 'lobby') {
    const prefix = scope === 'single' ? 'single-settings' : 'settings';
    const value = (id) => Number(this.query(`#${id}`)?.value);
    return {
      preset: this.query(scope === 'single' ? '#single-settings-preset' : '#lobby-settings-preset').value,
      maxRounds: value(`${prefix}-rounds`),
      planningDuration: value(`${prefix}-planning`),
      actionSlotCount: value(`${prefix}-actions`),
      oiFrequency: value(`${prefix}-oi-frequency`),
      mapSize: value(`${prefix}-map-size`),
      mapSeed: this.query(`#${prefix}-seed`).value.trim() || null,
    };
  }

  writeSettings(settings = DEFAULT_GAME_SETTINGS, scope = 'lobby') {
    const prefix = scope === 'single' ? 'single-settings' : 'settings';
    const setValue = (id, value) => {
      const element = this.query(`#${id}`);
      if (element) element.value = value;
    };
    setValue(scope === 'single' ? 'single-settings-preset' : 'lobby-settings-preset', settings.preset || 'short');
    setValue(`${prefix}-rounds`, settings.maxRounds);
    setValue(`${prefix}-planning`, settings.planningDuration);
    setValue(`${prefix}-actions`, settings.actionSlotCount);
    setValue(`${prefix}-oi-frequency`, settings.oiFrequency);
    setValue(`${prefix}-map-size`, settings.mapSize);
    setValue(`${prefix}-seed`, settings.mapSeed || '');
    const editable = settings.preset === 'custom';
    for (const suffix of ['rounds', 'planning', 'actions', 'oi-frequency', 'map-size', 'seed']) {
      const field = this.query(`#${prefix}-${suffix}`);
      if (field) field.disabled = !editable;
    }
    const summary = this.query('#lobby-settings-summary');
    if (summary) {
      summary.textContent =
        `${settings.maxRounds} rondas · ${settings.planningDuration}s · ${settings.actionSlotCount} acciones · mapa ${settings.mapSize}×${settings.mapSize}`;
    }
  }

  getSinglePlayerSettings() {
    return this.readSettings('single');
  }

  toggleSettings(scope) {
    const panelId = scope === 'single' ? 'single-settings' : 'lobby-settings';
    const toggleId = scope === 'single' ? 'single-settings-toggle' : 'lobby-settings-toggle';
    const panel = this.query(`#${panelId}`);
    const toggle = this.query(`#${toggleId}`);
    const expanded = !panel.hidden;
    panel.hidden = expanded;
    toggle.setAttribute('aria-expanded', String(!expanded));
  }

  setRoomControlsEnabled(enabled) {
    this.mount.querySelectorAll('#create-room-button, #quick-match-button, #join-room-button')
      .forEach((button) => {
        button.disabled = !enabled;
        if (enabled) button.removeAttribute('data-tooltip');
        else button.dataset.tooltip = 'El servidor no está disponible';
      });
  }

  setSinglePlayerEnabled(enabled) {
    const button = this.query('#single-player-button');
    if (!button) return;
    button.disabled = !enabled;
    if (enabled) button.removeAttribute('data-tooltip');
    else button.dataset.tooltip = 'Esperando conexión con la partida';
  }

  showMainMenu() {
    this.query('#start-menu').hidden = false;
    this.query('#room-menu').hidden = false;
    this.query('#lobby-view').hidden = true;
    this.query('#room-code-input').value = '';
    this.query('#single-settings').hidden = true;
    this.query('#single-settings-toggle').setAttribute('aria-expanded', 'false');
    this.query('#lobby-settings').hidden = true;
    this.query('#lobby-settings-toggle').setAttribute('aria-expanded', 'false');
  }

  updateRoom(room, playerId, normalizeName) {
    const players = room.jugadores || {};
    const rawSlots = Array.isArray(room.slots)
      ? room.slots
      : Object.values(room.slots || {});
    const slots = Array.from({ length: MAX_PLAYERS }, (_, index) => (
      rawSlots[index] || players[`slot_${index + 1}`] || null
    ));
    const privateRoom = room.privada !== false;
    const humanCount = slots.filter((player) => player?.tipo === 'humano').length;
    this.query('#room-menu').hidden = true;
    this.query('#lobby-view').hidden = false;
    this.query('#lobby-title').firstChild.textContent = privateRoom ? 'Sala ' : 'Partida rápida ';
    this.query('#lobby-code').textContent = room.code;
    this.query('#lobby-code').hidden = !privateRoom;
    this.query('#copy-room-code').hidden = !privateRoom;
    this.query('#lobby-count').textContent = `Jugadores en la sala: ${humanCount} / ${MAX_PLAYERS}`;
    const settingsToggle = this.query('#lobby-settings-toggle');
    settingsToggle.hidden = !room.isHost;
    if (!room.isHost) {
      this.query('#lobby-settings').hidden = true;
      this.query('#lobby-settings-toggle').setAttribute('aria-expanded', 'false');
      settingsToggle.setAttribute('aria-expanded', 'false');
    }
    this.query('#save-lobby-settings').disabled = !room.isHost || room.estado !== 'esperando';

    const ownSlot = slots.find((player) => player?.id === playerId);
    if (ownSlot) {
      const nameInput = this.query('#lobby-player-name');
      if (document.activeElement !== nameInput) nameInput.value = normalizeName(ownSlot.nombre || 'alpha');
      this.selectColor(this.query('#lobby-player-color'), ownSlot.color || AVAILABLE_NATION_COLORS[0]);
    }
    const ownColor = this.selectedColor('lobby-player-color');
    const usedColors = new Set(slots.filter((player) => player?.id !== playerId).map((player) => player?.color));
    for (const choice of this.mount.querySelectorAll('#lobby-player-color [data-color]')) {
      const occupied = usedColors.has(choice.dataset.color) && choice.dataset.color !== ownColor;
      choice.disabled = occupied;
      choice.setAttribute('aria-disabled', String(occupied));
      choice.title = occupied ? 'Este color ya está siendo usado' : 'Seleccionar color';
    }

    this.query('#lobby-slots').innerHTML = slots.map((player, index) => `
      <div class="pax-lobby-slot">
        <strong>Ranura ${index + 1}:</strong>
        ${player
          ? `<span style="color:${/^#[0-9A-Fa-f]{6}$/.test(player.color || '') ? player.color : '#cbd5e1'}">●</span> ${escapeHTML(normalizeName(player.nombre || NATIONS[index]?.name || 'alpha'))} <span>(${player.tipo === 'bot' ? 'Bot' : player.listo ? 'Listo' : 'Preparado'})</span>`
          : 'Esperando jugador…'}
      </div>`).join('');

    const readyCount = slots.filter((player) => player?.tipo === 'humano' && player.listo).length;
    const readyButton = this.query('#start-room-button');
    readyButton.hidden = room.estado !== 'esperando';
    readyButton.disabled = false;
    readyButton.textContent = `${ownSlot?.listo ? 'Listo ✓' : 'Listo'} (${readyCount}/${humanCount})`;
    readyButton.title = ownSlot?.listo
      ? 'Pulsa de nuevo para dejar de estar listo'
      : 'Pulsa para confirmar que estás listo';
    this.writeSettings(room.settings || DEFAULT_GAME_SETTINGS);
    return { ownSlot, humanCount, readyCount, privateRoom };
  }
}
