import { ECONOMY, GAME_STAGES } from '../../../../shared/Constants.js';
import { calculateCountryTrade } from '../../../../shared/EconomyFormulas.js';

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
          <small id="trade-quote">Entre países neutrales: 2 de Plata por 1 Material; el vendedor recibe 1 de Plata y el banco 1. Con TLC: 1:1 sin arancel. Los países en conflicto no comercian.</small>
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
      if (event.target.matches('[data-trade-proposal] input')) this.updateTradeQuote();
    });
    this.root.addEventListener('change', (event) => {
      if (!event.target.matches('[data-trade-proposal] input, [data-trade-proposal] select')) return;
      const offerResource = this.container.querySelector('#trade-offer-resource');
      const requestResource = this.container.querySelector('#trade-request-resource');
      if (offerResource.value === requestResource.value) {
        const other = event.target === requestResource ? offerResource : requestResource;
        other.value = event.target.value === 'SILVER' ? 'MATERIALS' : 'SILVER';
      }
      this.syncTradeAmounts(event.target.name);
    });
  }

  update(gameState, localPlayerId) {
    const root = this.root;
    const players = Array.isArray(gameState?.players) ? gameState.players : [];
    const localPlayer = players.find((player) => player.id === localPlayerId);
    this.gameState = gameState;
    this.localPlayerId = localPlayerId;
    this.localPlayer = localPlayer;
    const active = Boolean(
      localPlayer
      && gameState?.gameStarted
      && !gameState?.gameOver
      && !gameState?.isPaused
      && gameState?.currentStage === GAME_STAGES.PLANNING
    );
    this.canTrade = active;
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
    const tradePlayers = players.filter((player) => player.id !== localPlayerId);
    const recipientSignature = tradePlayers.map((player) => `${player.id}:${player.name}`).join('|');
    if (tradeRecipient && recipientSignature !== this.tradeRecipientSignature) {
      const selectedRecipient = tradeRecipient.value;
      tradeRecipient.innerHTML = tradePlayers.length
        ? tradePlayers.map((player) => (
          `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name || 'País')}</option>`
        )).join('')
        : '<option value="">No hay otros países</option>';
      if (tradePlayers.some((player) => player.id === selectedRecipient)) {
        tradeRecipient.value = selectedRecipient;
      }
      this.tradeRecipientSignature = recipientSignature;
    }
    root.querySelector('#trade-propose-button').disabled = !active || !tradePlayers.length;
    for (const control of root.querySelectorAll(
      '[data-market-action], #market-quantity-input, [data-quantity-adjust], [data-quantity-max], #trade-proposal-recipient, [data-trade-proposal] select, [data-trade-proposal] input, [data-trade-proposal] button, [data-trade-response], [data-trade-cancel], [data-issue-bond], [data-donate-world-bank]'
    )) {
      const needsRecipient = control.matches('#trade-proposal-recipient, #trade-propose-button');
      control.disabled = !active || (needsRecipient && !tradePlayers.length);
    }
    this.renderTradeOffers(gameState, localPlayerId, tradePlayers, active);
    const tradeSignature = JSON.stringify([tradeRecipient?.value, gameState?.activeConflicts,
      gameState?.freeTradeTreaties, gameState?.currentRound]);
    if (tradeSignature !== this.tradeContextSignature) {
      this.tradeContextSignature = tradeSignature;
      this.syncTradeAmounts();
    } else this.updateTradeQuote();
    this.updateMarketQuantity();
    const donate = root.querySelector('[data-donate-world-bank]');
    donate.disabled = !active || silver < ECONOMY.COSTS.DONATION_SILVER;
    donate.dataset.tooltip = !active ? 'Disponible durante la planificación de una partida sin pausar'
      : donate.disabled ? 'Plata insuficiente' : '';

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
    const quantity = Number(input.value);
    const valid = Number.isSafeInteger(quantity) && quantity > 0;
    for (const type of ['BUY_MATERIALS', 'SELL_MATERIALS']) {
      const button = this.root.querySelector(`[data-market-action="${type}"]`);
      const buying = type === 'BUY_MATERIALS';
      const price = (valid ? quantity : 1) * (buying
        ? ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER : ECONOMY.COSTS.MARKET_SELL_MATERIAL_SILVER);
      button.textContent = buying ? `Comprar (${price} plata)` : `Vender (+${price} plata)`;
      const enough = buying ? this.localPlayer?.resources?.SILVER >= price
        : this.localPlayer?.resources?.MATERIALS >= quantity;
      button.disabled = !this.canTrade || !valid || !enough;
      button.dataset.tooltip = !this.canTrade ? 'Disponible durante la planificación de una partida sin pausar'
        : !valid ? 'Indica una cantidad entera mayor que cero'
        : !enough ? buying ? 'Plata insuficiente' : 'Materiales insuficientes' : '';
    }
  }

  tradeRelations(recipientId) {
    const includesBoth = (entry) => entry.playerIds.includes(this.localPlayerId) && entry.playerIds.includes(recipientId);
    return {
      atWar: (this.gameState?.activeConflicts || []).some(includesBoth),
      freeTrade: (this.gameState?.freeTradeTreaties || []).some((entry) =>
        entry.expiresAfterRound >= this.gameState.currentRound && includesBoth(entry))
    };
  }

  readTradeDraft() {
    const form = this.root.querySelector('[data-trade-proposal]');
    return Object.fromEntries(['recipientId', 'offerResource', 'offerAmount', 'requestResource', 'requestAmount']
      .map((name) => [name, name.endsWith('Amount') ? Number(form.elements[name].value) : form.elements[name].value]));
  }

  syncTradeAmounts(changedField) {
    const form = this.root.querySelector('[data-trade-proposal]');
    const draft = this.readTradeDraft();
    const silverField = draft.offerResource === 'SILVER' ? 'offerAmount' : 'requestAmount';
    const materialField = silverField === 'offerAmount' ? 'requestAmount' : 'offerAmount';
    const rate = this.tradeRelations(draft.recipientId).freeTrade ? 1 : 2;
    const materials = changedField === silverField ? Math.max(1, Math.floor(draft[silverField] / rate))
      : Math.max(1, draft[materialField]);
    if (Number.isSafeInteger(materials) && Number.isSafeInteger(materials * rate)) {
      form.elements[materialField].value = materials;
      form.elements[silverField].value = materials * rate;
    }
    this.updateTradeQuote();
  }

  updateTradeQuote() {
    const draft = this.readTradeDraft();
    const terms = calculateCountryTrade(draft, this.tradeRelations(draft.recipientId));
    const recipient = (this.gameState?.players || []).find((player) => player.id === draft.recipientId);
    const enough = this.localPlayer?.resources?.[draft.offerResource] >= draft.offerAmount
      && recipient?.resources?.[draft.requestResource] >= draft.requestAmount;
    const reason = !this.canTrade ? 'Disponible durante la planificación de una partida sin pausar'
      : !recipient ? 'Selecciona otro país' : !terms.ok ? terms.message
      : !enough ? 'Uno de los países no tiene suficientes recursos' : '';
    const button = this.root.querySelector('#trade-propose-button');
    button.disabled = Boolean(reason);
    button.dataset.tooltip = reason;
    this.root.querySelector('#trade-quote').textContent = !terms.ok ? terms.message : terms.freeTrade
      ? 'TLC: 1 de Plata por 1 Material, sin arancel.'
      : `Por cada Material: el comprador paga 2 de Plata; el vendedor recibe 1 y el banco 1. Banco: ${terms.silverTariff} de Plata.`;
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
        const terms = calculateCountryTrade(offer, this.tradeRelations(otherPlayer?.id));
        const canAccept = canRespond && terms.ok
          && playersById.get(offer.proposerId)?.resources?.[offer.offerResource] >= offer.offerAmount
          && playersById.get(offer.recipientId)?.resources?.[offer.requestResource] >= offer.requestAmount;
        return `
          <article class="pax-peer-trade-offer">
            <strong>${incoming ? `Propuesta de ${playerName}` : `Propuesta para ${playerName}`}</strong>
            <span>${incoming ? `Recibes ${formatValue(terms.receivedByRecipient)} ${offerResource} · entregas ${requestText}` : `Ofreces ${offerText} · recibes ${formatValue(terms.receivedByProposer)} ${requestResource}`}</span>
            <small>${terms.ok ? `Banco: ${terms.silverTariff} de Plata` : escapeHtml(terms.message)}</small>
            ${incoming
              ? `<div><button type="button" data-trade-response="accept" data-offer-id="${escapeHtml(offer.id)}" ${canAccept ? '' : 'disabled'}>Aceptar</button><button type="button" data-trade-response="reject" data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Rechazar</button></div>`
              : `<button type="button" data-trade-cancel data-offer-id="${escapeHtml(offer.id)}" ${canRespond ? '' : 'disabled'}>Cancelar</button>`}
          </article>
        `;
      }).join('')
      : `<p class="pax-peer-trade-empty">${tradePlayers.length ? 'No hay propuestas pendientes.' : 'No hay otros países disponibles para comerciar.'}</p>`;
  }

  setStatus(message) {
    this.root.querySelector('#finance-status').textContent = message;
  }
}
