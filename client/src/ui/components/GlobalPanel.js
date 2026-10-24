import { TREATY_TYPES } from '../../../../shared/Constants.js';
import { getPlayerRankings } from './PlayerRankings.js';

const TREATY_NAMES = {
  [TREATY_TYPES.NON_AGGRESSION_PACT]: 'Pacto de No Agresión',
  [TREATY_TYPES.FREE_TRADE]: 'Tratado de Libre Comercio'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatValue(value) {
  return Number.isFinite(value) ? Math.floor(value).toLocaleString('es-ES') : '0';
}

export class GlobalPanel {
  constructor(container, { onProposeTreaty, onRespondToTreaty, onCancelTreatyOffer } = {}) {
    this.container = container;
    this.onProposeTreaty = onProposeTreaty || (() => {});
    this.onRespondToTreaty = onRespondToTreaty || (() => {});
    this.onCancelTreatyOffer = onCancelTreatyOffer || (() => {});
    this.container.addEventListener('submit', (event) => {
      const form = event.target.closest?.('[data-treaty-form]');
      if (!form) return;
      event.preventDefault();
      const formData = new FormData(form);
      this.onProposeTreaty({
        recipientId: formData.get('recipientId'),
        type: formData.get('type')
      });
    });
    this.container.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-treaty-response]');
      if (button) {
        this.onRespondToTreaty({
          offerId: button.dataset.offerId,
          accepted: button.dataset.treatyResponse === 'accept'
        });
        return;
      }
      const cancelButton = event.target.closest?.('[data-treaty-cancel]');
      if (cancelButton) this.onCancelTreatyOffer(cancelButton.dataset.offerId);
    });
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <section class="pax-global-panel">
        <div class="pax-scoreboard-status">
          <div><span>Fase actual</span><strong id="global-phase">Fase 1</strong></div>
          <div class="pax-scoreboard-clock"><span>Tiempo</span><strong id="global-timer">60s</strong></div>
        </div>
        <div class="pax-global-table-scroll">
          <table class="pax-global-table">
            <thead>
              <tr>
                <th>País</th><th>Control</th><th>Territorio</th><th>Población</th>
                <th>Tropas</th><th>Ciudades</th><th>Fábricas</th><th>Impuesto</th>
                <th>Plata</th><th>Materiales</th><th>Influencia</th><th>GDI</th>
              </tr>
            </thead>
            <tbody id="global-player-list"><tr><td colspan="12">Cargando países...</td></tr></tbody>
          </table>
        </div>
        <p class="pax-scoreboard-note">GDI: Plata + Materiales + Influencia + Población.</p>
        <section class="pax-global-treaties">
          <h3>Tratados vigentes</h3>
          <div id="global-treaty-list"></div>
        </section>
        <section class="pax-global-treaties">
          <h3>Propuestas pendientes</h3>
          <div id="global-treaty-offers"></div>
        </section>
        <form class="pax-global-treaty-form" data-treaty-form>
          <h3>Proponer un tratado</h3>
          <label>País destinatario
            <select name="recipientId" id="treaty-recipient"></select>
          </label>
          <label>Tratado
            <select name="type">
              <option value="${TREATY_TYPES.NON_AGGRESSION_PACT}">Pacto de No Agresión</option>
              <option value="${TREATY_TYPES.FREE_TRADE}">Tratado de Libre Comercio</option>
            </select>
          </label>
          <p>Los tratados aceptados duran cinco rondas. El Libre Comercio queda registrado, pero no tiene efecto económico hasta que se implemente un mercado.</p>
          <button type="submit" id="treaty-propose-button">Enviar propuesta</button>
          <p class="pax-global-panel-status" id="treaty-status" role="status"></p>
        </form>
      </section>
    `;
  }

  update(gameState, localPlayerId) {
    const players = Array.isArray(gameState?.players) ? gameState.players : [];
    const round = gameState?.currentRound || 1;
    const localPlayer = players.find((player) => player.id === localPlayerId);
    const phase = gameState?.currentPhase || 1;
    this.container.querySelector('#global-phase').textContent = `Fase ${phase}`;
    this.container.querySelector('#global-timer').textContent = (
      `${gameState?.timeRemaining ?? 60}s${gameState?.isPaused ? ' · Pausado' : ''}`
    );

    const sortedPlayers = getPlayerRankings(gameState);

    this.container.querySelector('#global-player-list').innerHTML = sortedPlayers.map((entry, index) => {
      const { player } = entry;
      const color = /^#[0-9a-f]{6}$/i.test(player.color || '') ? player.color : '#2563eb';
      const control = player.isBot ? 'Bot' : player.phaseReady && phase === 2 ? 'Listo' : 'Humano';
      return `
        <tr style="--score-nation-color:${color}" class="${player.id === localPlayerId ? 'is-local-player' : ''}">
          <th><span class="pax-score-rank">${index + 1}</span>${escapeHtml(player.name || 'País')}</th>
          <td>${control}</td>
          <td>${formatValue(entry.ownedTiles.length)}</td>
          <td>${formatValue(entry.population)}</td>
          <td>${formatValue(entry.troops)}</td>
          <td>${formatValue(entry.cities)}</td>
          <td>${formatValue(entry.factories)}</td>
          <td>${formatValue((player.taxRate || 0) * 100)}%</td>
          <td>${formatValue(entry.silver)}</td>
          <td>${formatValue(entry.materials)}</td>
          <td>${formatValue(entry.influence)}</td>
          <td class="pax-score-total">${formatValue(entry.total)}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="12">Sin países en la sala.</td></tr>';

    const playerNames = new Map(players.map((player) => [player.id, player.name]));
    const activePacts = (gameState?.nonAggressionPacts || [])
      .filter((pact) => pact.expiresAfterRound >= round)
      .map((pact) => ({ ...pact, type: TREATY_TYPES.NON_AGGRESSION_PACT }));
    const activeFreeTrade = (gameState?.freeTradeTreaties || [])
      .filter((treaty) => treaty.expiresAfterRound >= round)
      .map((treaty) => ({ ...treaty, type: TREATY_TYPES.FREE_TRADE }));
    const activeTreaties = [...activePacts, ...activeFreeTrade];
    this.container.querySelector('#global-treaty-list').innerHTML = activeTreaties.length
      ? activeTreaties.map((treaty) => `
        <div class="pax-global-treaty">
          <strong>${TREATY_NAMES[treaty.type]}</strong>
          <span>${treaty.playerIds.map((id) => escapeHtml(playerNames.get(id) || id)).join(' · ')}</span>
          <small>${Math.max(0, treaty.expiresAfterRound - round + 1)} rondas restantes</small>
        </div>
      `).join('')
      : '<p class="pax-global-empty">No hay tratados vigentes.</p>';

    const offers = gameState?.treatyOffers || [];
    const canRespond = Boolean(localPlayer && gameState?.gameStarted && !gameState?.gameOver);
    this.container.querySelector('#global-treaty-offers').innerHTML = offers.length
      ? offers.map((offer) => {
        const isIncoming = offer.recipientId === localPlayerId;
        const otherParty = isIncoming ? offer.proposerName : offer.recipientName;
        return `
          <div class="pax-global-treaty">
            <strong>${TREATY_NAMES[offer.type]}</strong>
            <span>${isIncoming ? `De ${escapeHtml(otherParty)}` : `Para ${escapeHtml(otherParty)}`}</span>
            ${isIncoming ? `
              <button type="button" data-treaty-response="accept" data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Aceptar</button>
              <button type="button" data-treaty-response="reject" data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Rechazar</button>
            ` : `
              <small>Esperando respuesta</small>
              ${offer.proposerId === localPlayerId ? `<button type="button" data-treaty-cancel data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Cancelar propuesta</button>` : ''}
            `}
          </div>
        `;
      }).join('')
      : '<p class="pax-global-empty">No hay propuestas pendientes.</p>';

    const recipientSelect = this.container.querySelector('#treaty-recipient');
    const previousRecipient = recipientSelect.value;
    recipientSelect.innerHTML = players
      .filter((player) => player.id !== localPlayerId)
      .map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`)
      .join('');
    if (players.some((player) => player.id === previousRecipient)) {
      recipientSelect.value = previousRecipient;
    }
    const canPropose = Boolean(localPlayer && gameState?.gameStarted && !gameState?.gameOver);
    for (const input of this.container.querySelectorAll('[data-treaty-form] select, #treaty-propose-button')) {
      input.disabled = !canPropose || recipientSelect.options.length === 0;
    }
    this.container.querySelector('#treaty-status').textContent = canPropose
      ? ''
      : 'La negociación está disponible durante una partida activa.';
  }
}
