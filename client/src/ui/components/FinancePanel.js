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
    this.onAction = onAction;
    this.container.innerHTML = `
      <section class="pax-finance">
        <h3>Mercado Global</h3>
        <p class="pax-finance-note">Compra materiales por 3 de plata o vende cada material por 1 de plata.</p>
        <form data-financial-form="BUY_MATERIALS">
          <label>Comprar materiales
            <input name="quantity" type="number" min="1" step="1" value="1" required>
          </label>
          <button type="submit">Comprar</button>
        </form>
        <form data-financial-form="SELL_MATERIALS">
          <label>Vender materiales
            <input name="quantity" type="number" min="1" step="1" value="1" required>
          </label>
          <button type="submit">Vender</button>
        </form>
        <h3>Transferencias directas</h3>
        <p class="pax-finance-note" id="finance-tariff-note">El arancel del Banco Mundial es del 20%; un TLC vigente lo elimina.</p>
        <form data-financial-form="TRANSFER_RESOURCE">
          <label>Destinatario
            <select name="recipientId" id="finance-recipient"></select>
          </label>
          <label>Recurso
            <select name="resource">
              <option value="SILVER">Plata</option>
              <option value="MATERIALS">Materiales</option>
            </select>
          </label>
          <label>Cantidad enviada
            <input name="amount" type="number" min="1" step="1" value="1" required>
          </label>
          <button type="submit">Enviar recurso</button>
        </form>
        <h3>Deuda y bonos</h3>
        <p class="pax-finance-note">Cada bono entrega 20 de plata y vence por 25 en cinco rondas. Tras un impago, la deuda acumula 1 de interés por ronda.</p>
        <button type="button" data-issue-bond>Emitir bono (+20 plata)</button>
        <div id="finance-debts"></div>
        <p class="pax-finance-note">Fondo del Banco Mundial: <span id="finance-bank-fund">0 plata · 0 materiales</span></p>
        <p class="pax-finance-status" id="finance-status" role="status"></p>
      </section>
    `;
    this.container.addEventListener('submit', (event) => {
      const form = event.target.closest?.('[data-financial-form]');
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      const type = form.dataset.financialForm;
      this.onAction(type === 'TRANSFER_RESOURCE'
        ? {
          type,
          recipientId: data.get('recipientId'),
          resource: data.get('resource'),
          amount: Number(data.get('amount'))
        }
        : { type, quantity: Number(data.get('quantity')) });
    });
    this.container.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-issue-bond], [data-repay-bond]');
      if (!button) return;
      if (button.matches('[data-issue-bond]')) {
        this.onAction({ type: 'ISSUE_BOND' });
        return;
      }
      const form = button.closest('[data-bond-form]');
      const amount = Number(new FormData(form).get('amount'));
      this.onAction({
        type: 'REPAY_BOND',
        bondId: button.dataset.repayBond,
        amount
      });
    });
  }

  update(gameState, localPlayerId) {
    const players = Array.isArray(gameState?.players) ? gameState.players : [];
    const localPlayer = players.find((player) => player.id === localPlayerId);
    const active = Boolean(localPlayer && gameState?.gameStarted && !gameState?.gameOver);
    const recipient = this.container.querySelector('#finance-recipient');
    const previousRecipient = recipient.value;
    recipient.innerHTML = players
      .filter((player) => player.id !== localPlayerId)
      .map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`)
      .join('');
    if (players.some((player) => player.id === previousRecipient)) recipient.value = previousRecipient;
    for (const control of this.container.querySelectorAll('form button, form input, form select, [data-issue-bond]')) {
      control.disabled = !active;
    }

    const bonds = (gameState?.bonds || []).filter((bond) => (
      bond.playerId === localPlayerId && !bond.paid
    ));
    const repaymentDrafts = new Map(Array.from(
      this.container.querySelectorAll('[data-bond-amount]'),
      (input) => [input.dataset.bondAmount, input.value]
    ));
    this.container.querySelector('#finance-debts').innerHTML = bonds.length
      ? bonds.map((bond) => `
        <form data-bond-form class="pax-finance-debt">
          <strong>Bono · vence ronda ${bond.dueRound}</strong>
          <small>${bond.defaulted ? 'En impago' : 'Pendiente'} · deuda: ${formatValue(bond.balance)} plata</small>
          <label>Pago
            <input name="amount" data-bond-amount="${escapeHtml(bond.id)}" type="number" min="1" max="${bond.balance}" step="1" value="${Math.min(bond.balance, Math.max(1, Number(repaymentDrafts.get(bond.id)) || bond.balance))}" required ${active ? '' : 'disabled'}>
          </label>
          <button type="button" data-repay-bond="${escapeHtml(bond.id)}" ${active ? '' : 'disabled'}>Pagar deuda</button>
        </form>
      `).join('')
      : '<p class="pax-finance-note">No tienes bonos pendientes.</p>';
    this.container.querySelector('#finance-bank-fund').textContent = (
      `${formatValue(gameState?.bankFund?.SILVER)} plata · ${formatValue(gameState?.bankFund?.MATERIALS)} materiales`
    );
    const activeConflicts = gameState?.activeConflicts || [];
    const atWar = localPlayer && activeConflicts.some((conflict) => (
      conflict.playerIds.includes(localPlayerId)
    ));
    this.container.querySelector('#finance-tariff-note').textContent = atWar
      ? 'El arancel es del 20% durante conflictos; un TLC vigente fuera de conflicto lo elimina.'
      : 'El arancel del Banco Mundial es del 20%; un TLC vigente lo elimina.';
  }

  setStatus(message) {
    this.container.querySelector('#finance-status').textContent = message;
  }
}
