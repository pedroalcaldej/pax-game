import { GAME_STAGES } from '../../../../shared/Constants.js';

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
        <p class="pax-finance-note">Compra materiales por 3 de plata o vende cada material por 1 de plata. Las operaciones se suspenden durante la reunión de la OI.</p>
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
        </div>
        <div id="finance-debt-content">
          <div class="pax-bank-card">
            <div id="finance-debts"></div>
            <p class="pax-finance-note">Fondo del Banco Mundial: <strong id="finance-bank-fund">0 plata · 0 materiales</strong></p>
          </div>
          <div class="pax-bank-card pax-bank-actions">
            <button type="button" data-issue-bond>Emitir Bono (+20 plata)</button>
            <button type="button" data-donate-world-bank>Donar al BM (-15 plata, +1 Influencia)</button>
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
      const form = button.closest('[data-bond-form]');
      const amount = Number(new FormData(form).get('amount'));
      this.onAction({
        type: 'REPAY_BOND',
        bondId: button.dataset.repayBond,
        amount
      });
    });
    this.root.addEventListener('input', (event) => {
      if (event.target.matches('#market-quantity-input')) this.updateMarketQuantity();
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
    if (marketInput) marketInput.max = String(Math.max(1, Math.min(materials, Math.floor(silver / 3) || 1)));
    this.updateMarketQuantity();
    for (const control of root.querySelectorAll(
      '[data-market-action], #market-quantity-input, [data-quantity-adjust], [data-quantity-max], [data-issue-bond], [data-donate-world-bank]'
    )) {
      control.disabled = !active;
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

  setStatus(message) {
    this.root.querySelector('#finance-status').textContent = message;
  }
}
