import { ECONOMY, GAME_STAGES } from '../../../../shared/Constants.js';

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

export class FinancePanel {
  constructor(container, onAction = () => {}) {
    this.container = container;
    this.root = container.closest('.pax-sidebar') || container;
    this.onAction = onAction;
    this.container.innerHTML = `
      <section class="pax-finance">
        <div id="finance-economy-content">
        <p class="pax-finance-note">Compra cada Material por ${ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER} de Plata o vende cada Material por ${ECONOMY.COSTS.MARKET_SELL_MATERIAL_SILVER} de Plata. Las operaciones se suspenden durante la reunión de la OI.</p>
        <div class="pax-market-card">
          <div class="pax-market-quantity">
            <button type="button" data-quantity-adjust="-1" aria-label="Reducir cantidad">−</button>
            <output id="market-quantity">1</output>
            <input name="quantity" id="market-quantity-input" type="number" min="1" step="1" value="1" required aria-label="Cantidad de materiales">
            <button type="button" data-quantity-adjust="1" aria-label="Aumentar cantidad">+</button>
            <button type="button" data-quantity-max>Max</button>
          </div>
          <div class="pax-market-actions">
            <button type="button" data-market-action="BUY_MATERIALS">Comprar</button>
            <button type="button" data-market-action="SELL_MATERIALS">Vender</button>
          </div>
        </div>
        <section class="pax-peer-trade">
          <h4>Comercio con otros países</h4>
          <form data-trade-proposal class="pax-peer-trade-form">
            <select id="trade-proposal-recipient" name="recipientId" aria-label="País destinatario"></select>
            <div class="pax-peer-trade-fields">
              <label>Ofreces
                <select id="trade-offer-resource" name="offerResource" aria-label="Recurso ofrecido">
                  <option value="SILVER">Plata</option>
                  <option value="MATERIALS">Materiales</option>
                </select>
                <input name="offerAmount" type="number" min="1" step="1" value="1" aria-label="Cantidad ofrecida">
              </label>
              <span aria-hidden="true">⇄</span>
              <label>Solicitas
                <select id="trade-request-resource" name="requestResource" aria-label="Recurso solicitado">
                  <option value="MATERIALS">Materiales</option>
                  <option value="SILVER">Plata</option>
                </select>
                <input name="requestAmount" type="number" min="1" step="1" value="1" aria-label="Cantidad solicitada">
              </label>
            </div>
            <button type="submit" id="trade-propose-button">Proponer intercambio</button>
          </form>
          <div class="pax-peer-trade-offers" id="trade-offer-list"></div>
          <small>Con un TLC activo, las cantidades deben ser 1:1 y no pagan arancel. Sin TLC, el Banco Mundial retiene el ${Math.round(ECONOMY.BANK_TRANSFER_TARIFF_RATE * 100)}% de cada recurso transferido.</small>
        </section>
        </div>
        <div id="finance-debt-content">
          <div class="pax-bank-card">
            <div id="finance-debts"></div>
            <p class="pax-finance-note">Fondo del Banco Mundial: <strong id="finance-bank-fund">0 plata · 0 materiales</strong></p>
          </div>
          <div class="pax-bank-card pax-bank-actions">
            <button type="button" data-issue-bond>Emitir Bono (+${ECONOMY.COSTS.BOND_PROCEEDS} plata)</button>
            <button type="button" data-donate-world-bank>Donar al BM (-${ECONOMY.COSTS.DONATION_SILVER} plata, +${ECONOMY.COSTS.DONATION_INFLUENCE} Influencia)</button>
          </div>
          <div class="pax-bank-card" id="finance-repayment-card">
            <h4>Pago de deuda</h4>
            <div id="finance-repayment"></div>
          </div>
          <p class="pax-finance-status" id="finance-status" role="status"></p>
        </div>
      </section>
    `;
    this.root.addEventListener('click', (event) => {
      const quantityButton = event.target.closest?.('[data-quantity-adjust], [data-quantity-max]');
      if (quantityButton) {
        const input = this.container.querySelector('#market-quantity-input');
        if (!input) return;
        input.value = quantityButton.hasAttribute('data-quantity-max')
          ? input.max || '1'
          : Math.max(1, Number(input.value || 1) + Number(quantityButton.dataset.quantityAdjust));
        this.updateMarketQuantity();
        return;
      }
      const marketButton = event.target.closest?.('[data-market-action]');
      if (marketButton) {
        this.onAction({
          type: marketButton.dataset.marketAction,
          quantity: Number(this.container.querySelector('#market-quantity-input')?.value || 1)
        });
        return;
      }
      const tradeResponse = event.target.closest?.('[data-trade-response]');
      if (tradeResponse) {
        this.onAction({
          type: 'RESPOND_TO_TRADE',
          offerId: tradeResponse.dataset.offerId,
          accepted: tradeResponse.dataset.tradeResponse === 'accept'
        });
        return;
      }
      const tradeCancel = event.target.closest?.('[data-trade-cancel]');
      if (tradeCancel) {
        this.onAction({ type: 'CANCEL_TRADE', offerId: tradeCancel.dataset.offerId });
        return;
      }
      const button = event.target.closest?.('[data-issue-bond], [data-repay-bond], [data-donate-world-bank]');
      if (!button) return;
      if (button.matches('[data-donate-world-bank]')) {
        this.onAction({ type: 'DONATE_TO_WORLD_BANK' });
        return;
      }
      if (button.matches('[data-issue-bond]')) {
        this.onAction({ type: 'ISSUE_BOND' });
        return;
      }
      const input = button.parentElement?.querySelector('[data-bond-amount]');
      const amount = Number(input?.value);
      this.onAction({
        type: 'REPAY_BOND',
        bondId: button.dataset.repayBond,
        amount
      });
    });
    this.root.addEventListener('submit', (event) => {
      const form = event.target.closest?.('[data-trade-proposal]');
      if (!form) return;
      event.preventDefault();
      const values = new FormData(form);
      this.onAction({
        type: 'PROPOSE_TRADE',
        recipientId: values.get('recipientId'),
        offerResource: values.get('offerResource'),
        offerAmount: Number(values.get('offerAmount')),
        requestResource: values.get('requestResource'),
        requestAmount: Number(values.get('requestAmount'))
      });
    });
    this.root.addEventListener('input', (event) => {
      if (event.target.matches('#market-quantity-input')) this.updateMarketQuantity();
    });
    this.root.addEventListener('change', (event) => {
      if (!event.target.matches('#trade-offer-resource, #trade-request-resource')) return;
      const offerResource = this.container.querySelector('#trade-offer-resource');
      const requestResource = this.container.querySelector('#trade-request-resource');
      if (offerResource.value === requestResource.value) {
        requestResource.value = offerResource.value === 'SILVER' ? 'MATERIALS' : 'SILVER';
      }
    });
  }

  update(gameState, localPlayerId) {
    const root = this.root;
    const players = Array.isArray(gameState?.players) ? gameState.players : [];
    const localPlayer = players.find((player) => player.id === localPlayerId);
    const active = Boolean(
      localPlayer
      && gameState?.gameStarted
      && !gameState?.gameOver
      && gameState?.currentStage === GAME_STAGES.PLANNING
    );
    const silver = Number(localPlayer?.resources?.SILVER ?? localPlayer?.silver ?? 0);
    const materials = Number(localPlayer?.resources?.MATERIALS ?? localPlayer?.materials ?? 0);
    const marketInput = root.querySelector('#market-quantity-input');
    if (marketInput) {
      marketInput.max = String(Math.max(
        1,
        Math.max(
          Math.floor(silver / ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER),
          materials
        )
      ));
    }
    const tradeRecipient = root.querySelector('#trade-proposal-recipient');
    const tradePlayers = players.filter((player) => player.id !== localPlayerId && !player.isBot);
    const recipientSignature = tradePlayers.map((player) => `${player.id}:${player.name}`).join('|');
    if (tradeRecipient && recipientSignature !== this.tradeRecipientSignature) {
      const selectedRecipient = tradeRecipient.value;
      tradeRecipient.innerHTML = tradePlayers.length
        ? tradePlayers.map((player) => (
          `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name || 'País')}</option>`
        )).join('')
        : '<option value="">No hay otros jugadores humanos</option>';
      if (tradePlayers.some((player) => player.id === selectedRecipient)) {
        tradeRecipient.value = selectedRecipient;
      }
      this.tradeRecipientSignature = recipientSignature;
    }
    root.querySelector('#trade-propose-button').disabled = !active || !tradePlayers.length;
    this.renderTradeOffers(gameState, localPlayerId, tradePlayers, active);
    this.updateMarketQuantity();
    for (const control of root.querySelectorAll(
      '[data-market-action], #market-quantity-input, [data-quantity-adjust], [data-quantity-max], #trade-proposal-recipient, [data-trade-proposal] select, [data-trade-proposal] input, [data-trade-proposal] button, [data-trade-response], [data-trade-cancel], [data-issue-bond], [data-donate-world-bank]'
    )) {
      const needsRecipient = control.matches('#trade-proposal-recipient, #trade-propose-button');
      control.disabled = !active || (needsRecipient && !tradePlayers.length);
    }

    const bonds = (gameState?.bonds || []).filter((bond) => (
      bond.playerId === localPlayerId && !bond.paid
    ));
    const repaymentDrafts = new Map(Array.from(
      root.querySelectorAll('[data-bond-amount]'),
      (input) => [input.dataset.bondAmount, input.value]
    ));
    root.querySelector('#finance-debts').innerHTML = bonds.length
      ? bonds.map((bond) => `<div class="pax-finance-debt"><strong>Deuda pendiente: ${formatValue(bond.balance)} plata</strong><small>${bond.defaulted ? 'En impago' : 'Pendiente'} · vence ronda ${bond.dueRound}</small></div>`).join('')
      : '<p class="pax-finance-note">No tienes deuda pendiente.</p>';
    root.querySelector('#finance-repayment-card').hidden = !bonds.length;
    root.querySelector('#finance-repayment').innerHTML = bonds.map((bond) => `
      <div class="pax-repayment-row">
        <input name="amount" data-bond-amount="${escapeHtml(bond.id)}" type="number" min="1" max="${bond.balance}" step="1" value="${Math.min(bond.balance, Math.max(1, Number(repaymentDrafts.get(bond.id)) || bond.balance))}" required ${active ? '' : 'disabled'}>
        <button type="button" data-repay-bond="${escapeHtml(bond.id)}" ${active ? '' : 'disabled'}>Pagar Deuda</button>
      </div>
    `).join('');
    const bankFund = gameState?.worldBankFund || gameState?.bankFund;
    root.querySelector('#finance-bank-fund').textContent = (
      `${formatValue(bankFund?.SILVER)} plata · ${formatValue(bankFund?.MATERIALS)} materiales`
    );
  }

  updateMarketQuantity() {
    const input = this.container.querySelector('#market-quantity-input');
    const output = this.container.querySelector('#market-quantity');
    if (!input || !output) return;
    output.textContent = input.value || '1';
  }

  renderTradeOffers(gameState, localPlayerId, tradePlayers, canRespond) {
    const offersEl = this.root.querySelector('#trade-offer-list');
    if (!offersEl) return;
    const playersById = new Map((gameState?.players || []).map((player) => [player.id, player]));
    const offers = (gameState?.tradeOffers || []).filter((offer) => (
      offer.proposerId === localPlayerId || offer.recipientId === localPlayerId
    ));
    offersEl.innerHTML = offers.length
      ? offers.map((offer) => {
        const incoming = offer.recipientId === localPlayerId;
        const otherPlayer = playersById.get(incoming ? offer.proposerId : offer.recipientId);
        const playerName = escapeHtml(otherPlayer?.name || (incoming ? offer.proposerName : offer.recipientName) || 'País');
        const offerResource = offer.offerResource === 'SILVER' ? 'Plata' : 'Materiales';
        const requestResource = offer.requestResource === 'SILVER' ? 'Plata' : 'Materiales';
        const offerText = `${formatValue(offer.offerAmount)} ${offerResource}`;
        const requestText = `${formatValue(offer.requestAmount)} ${requestResource}`;
        return `
          <article class="pax-peer-trade-offer">
            <strong>${incoming ? `Propuesta de ${playerName}` : `Propuesta para ${playerName}`}</strong>
            <span>${incoming ? `Recibes ${offerText} · entregas ${requestText}` : `Ofreces ${offerText} · solicitas ${requestText}`}</span>
            ${incoming
              ? `<div><button type="button" data-trade-response="accept" data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Aceptar</button><button type="button" data-trade-response="reject" data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Rechazar</button></div>`
              : `<button type="button" data-trade-cancel data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Cancelar</button>`}
          </article>
        `;
      }).join('')
      : `<p class="pax-peer-trade-empty">${tradePlayers.length ? 'No hay propuestas pendientes.' : 'Conéctate a una partida multijugador para comerciar con otros jugadores.'}</p>`;
  }

  setStatus(message) {
    this.root.querySelector('#finance-status').textContent = message;
  }
}
