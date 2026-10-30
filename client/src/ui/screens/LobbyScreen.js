import { AVAILABLE_NATION_COLORS, NATIONS } from '../../../../shared/Constants.js';

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
                  <label>Nombre <input id="single-player-name" maxlength="24" value="alpha" autocomplete="off" /></label>
                  <label>Color <div class="pax-color-picker" id="single-player-color" role="radiogroup" aria-label="Color del país"></div></label>
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
          </div>
          <div id="lobby-view" hidden>
            <h1 id="lobby-title">Sala <strong id="lobby-code"></strong></h1>
            <div class="pax-lobby-code-row">
              <button class="pax-lobby-copy" id="copy-room-code" type="button">Copiar código</button>
              <span id="lobby-count">Jugadores en la sala: 0 / 4</span>
            </div>
            <div class="pax-lobby-profile">
              <label>Nombre <input id="lobby-player-name" maxlength="24" autocomplete="off" /></label>
              <label>Color <div class="pax-color-picker" id="lobby-player-color" role="radiogroup" aria-label="Color del país"></div></label>
            </div>
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

  setRoomControlsEnabled(enabled) {
    this.mount.querySelectorAll('#create-room-button, #quick-match-button, #join-room-button')
      .forEach((button) => { button.disabled = !enabled; });
  }

  setSinglePlayerEnabled(enabled) {
    const button = this.query('#single-player-button');
    if (button) button.disabled = !enabled;
  }

  showMainMenu() {
    this.query('#start-menu').hidden = false;
    this.query('#room-menu').hidden = false;
    this.query('#lobby-view').hidden = true;
    this.query('#room-code-input').value = '';
  }

  updateRoom(room, playerId, normalizeName) {
    const privateRoom = room.privada !== false;
    const humanCount = room.slots.filter((player) => player?.tipo === 'humano').length;
    this.query('#room-menu').hidden = true;
    this.query('#lobby-view').hidden = false;
    this.query('#lobby-title').firstChild.textContent = privateRoom ? 'Sala ' : 'Partida rápida ';
    this.query('#lobby-code').textContent = room.code;
    this.query('#lobby-code').hidden = !privateRoom;
    this.query('#copy-room-code').hidden = !privateRoom;
    this.query('#lobby-count').textContent = `Jugadores en la sala: ${humanCount} / 4`;

    const ownSlot = room.slots.find((player) => player?.id === playerId);
    if (ownSlot) {
      const nameInput = this.query('#lobby-player-name');
      if (document.activeElement !== nameInput) nameInput.value = normalizeName(ownSlot.nombre || 'alpha');
      this.selectColor(this.query('#lobby-player-color'), ownSlot.color || AVAILABLE_NATION_COLORS[0]);
    }
    const ownColor = this.selectedColor('lobby-player-color');
    const usedColors = new Set(room.slots.filter((player) => player?.id !== playerId).map((player) => player?.color));
    for (const choice of this.mount.querySelectorAll('#lobby-player-color [data-color]')) {
      const occupied = usedColors.has(choice.dataset.color) && choice.dataset.color !== ownColor;
      choice.disabled = occupied;
      choice.setAttribute('aria-disabled', String(occupied));
      choice.title = occupied ? 'Este color ya está siendo usado' : 'Seleccionar color';
    }

    this.query('#lobby-slots').innerHTML = room.slots.map((player, index) => `
      <div class="pax-lobby-slot">
        <strong>Ranura ${index + 1}:</strong>
        ${player
          ? `<span style="color:${/^#[0-9A-Fa-f]{6}$/.test(player.color || '') ? player.color : '#cbd5e1'}">●</span> ${escapeHTML(normalizeName(player.nombre || NATIONS[index]?.name || 'alpha'))} <span>(${player.tipo === 'bot' ? 'Bot' : player.listo ? 'Listo' : 'Preparado'})</span>`
          : 'Esperando jugador…'}
      </div>`).join('');

    const readyCount = room.slots.filter((player) => player?.tipo === 'humano' && player.listo).length;
    const readyButton = this.query('#start-room-button');
    readyButton.hidden = room.estado !== 'esperando' || !ownSlot;
    readyButton.disabled = false;
    readyButton.textContent = `${ownSlot?.listo ? 'Listo ✓' : 'Listo'} (${readyCount}/${humanCount})`;
    readyButton.title = ownSlot?.listo
      ? 'Pulsa de nuevo para dejar de estar listo'
      : 'Pulsa para confirmar que estás listo';
    return { ownSlot, humanCount, readyCount, privateRoom };
  }
}
