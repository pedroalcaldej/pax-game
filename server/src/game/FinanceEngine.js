/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { GAME_PHASES, TREATY_TYPES } from '../../../shared/Constants.js';
import { BANK_TARIFF_RATE, TREATY_DURATION_ROUNDS, VALID_TRADE_RESOURCES } from './GameStateUtils.js';

export const FinanceEngine = {
  performFinancialAction(socketId, action = {}) {
    const player = Array.from(this.players.values()).find(
      (entry) => entry.socketId === socketId && !entry.isBot
    );
    if (!player) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Las operaciones financieras requieren una partida activa.' };
    }
    if (this.currentPhase !== GAME_PHASES.PHASE_2_DECISIONS) {
      return {
        ok: false,
        message: this.currentPhase === GAME_PHASES.PHASE_6_OI_SESSION
          ? 'Las operaciones financieras están suspendidas durante la reunión de la OI.'
          : 'Las operaciones financieras solo están disponibles durante la planificación.'
      };
    }
    if (!action || typeof action.type !== 'string') {
      return { ok: false, message: 'La operación financiera no es válida.' };
    }

    if (action.type === 'BUY_MATERIALS' || action.type === 'SELL_MATERIALS') {
      const quantity = action.quantity;
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return { ok: false, message: 'Indica una cantidad entera de materiales mayor que cero.' };
      }
      if (action.type === 'BUY_MATERIALS') {
        const cost = quantity * 3;
        if (!Number.isSafeInteger(cost) || player.resources.SILVER < cost) {
          return { ok: false, message: 'No tienes suficiente plata para comprar esos materiales.' };
        }
        player.resources.SILVER -= cost;
        player.resources.MATERIALS += quantity;
        this.bankFund.SILVER += cost;
        this.recordEvent(`${player.name} compró ${quantity} materiales por ${cost} de plata en el Mercado Global.`);
        return { ok: true, message: `Compraste ${quantity} materiales por ${cost} de plata.` };
      }
      if (player.resources.MATERIALS < quantity) {
        return { ok: false, message: 'No tienes suficientes materiales para vender esa cantidad.' };
      }
      player.resources.MATERIALS -= quantity;
      player.resources.SILVER += quantity;
      this.bankFund.MATERIALS += quantity;
      this.recordEvent(`${player.name} vendió ${quantity} materiales por ${quantity} de plata en el Mercado Global.`);
      return { ok: true, message: `Vendiste ${quantity} materiales por ${quantity} de plata.` };
    }

    if (action.type === 'TRANSFER_RESOURCE') {
      const { recipientId, resource, amount } = action;
      const recipient = this.players.get(recipientId);
      if (!recipient || recipient.id === player.id) {
        return { ok: false, message: 'Selecciona otro país como destinatario.' };
      }
      if (!VALID_TRADE_RESOURCES.has(resource)) {
        return { ok: false, message: 'Solo puedes transferir plata o materiales.' };
      }
      if (!Number.isSafeInteger(amount) || amount < 1) {
        return { ok: false, message: 'Indica una cantidad entera mayor que cero.' };
      }
      if (player.resources[resource] < amount) {
        return { ok: false, message: `No tienes suficientes ${resource === 'SILVER' ? 'plata' : 'materiales'}.` };
      }
      const tariffExempt = this.areTreatyPartners(
        player.id,
        recipient.id,
        TREATY_TYPES.FREE_TRADE
      ) && !this.isPlayersAtWar(player.id, recipient.id);
      const tariff = tariffExempt ? 0 : Math.ceil(amount * BANK_TARIFF_RATE);
      const received = amount - tariff;
      player.resources[resource] -= amount;
      recipient.resources[resource] += received;
      this.bankFund[resource] += tariff;
      const resourceName = resource === 'SILVER' ? 'de plata' : 'materiales';
      this.recordEvent(
        `${player.name} transfirió ${amount} ${resourceName} a ${recipient.name}; ${tariff} ${resourceName} ingresaron al Banco Mundial y el destinatario recibió ${received}.`
      );
      return {
        ok: true,
        message: `Transferiste ${amount} ${resourceName}; ${recipient.name} recibió ${received}${tariff ? ` tras el arancel de ${tariff}` : ' sin arancel por el TLC'}.`
      };
    }

    if (action.type === 'DONATE_TO_WORLD_BANK') {
      const donationCost = 15;
      if (player.resources.SILVER < donationCost) {
        return { ok: false, message: 'Necesitas 15 de plata para donar al Banco Mundial.' };
      }
      player.resources.SILVER -= donationCost;
      player.resources.INFLUENCE += 1;
      this.bankFund.SILVER += donationCost;
      this.recordEvent(
        `${player.name} donó ${donationCost} de plata al Banco Mundial y obtuvo 1 de Influencia Política.`
      );
      return {
        ok: true,
        message: 'Donación realizada: pagaste 15 de plata y obtuviste 1 de Influencia.'
      };
    }

    if (action.type === 'ISSUE_BOND') {
      if (this.bonds.some((bond) => bond.playerId === player.id && !bond.paid)) {
        return { ok: false, message: 'Ya tienes un bono pendiente. Debes saldarlo antes de emitir otro.' };
      }
      const bond = {
        id: `bond-${this.nextBondId++}`,
        playerId: player.id,
        principal: 25,
        balance: 25,
        issueRound: this.currentRound,
        dueRound: this.currentRound + TREATY_DURATION_ROUNDS,
        defaulted: false,
        paid: false,
        lastInterestRound: null
      };
      this.bonds.push(bond);
      player.resources.SILVER += 20;
      this.recordEvent(
        `${player.name} emitió el bono ${bond.id}: recibió 20 de plata y debe pagar 25 en la ronda ${bond.dueRound}.`
      );
      return { ok: true, message: `Bono emitido: recibiste 20 de plata; debes 25 en la ronda ${bond.dueRound}.` };
    }

    if (action.type === 'REPAY_BOND') {
      const bond = this.bonds.find((entry) => (
        entry.id === action.bondId
        && entry.playerId === player.id
        && !entry.paid
      ));
      if (!bond) return { ok: false, message: 'No se encontró una deuda pendiente para ese bono.' };
      const amount = action.amount;
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > bond.balance) {
        return { ok: false, message: `Indica un pago entre 1 y ${bond.balance} de plata.` };
      }
      if (player.resources.SILVER < amount) {
        return { ok: false, message: 'No tienes suficiente plata para ese pago.' };
      }
      player.resources.SILVER -= amount;
      this.bankFund.SILVER += amount;
      bond.balance -= amount;
      if (bond.balance === 0) bond.paid = true;
      this.recordEvent(
        `${player.name} pagó ${amount} de plata del bono ${bond.id}${bond.paid ? '; deuda saldada' : `; quedan ${bond.balance} de deuda`}.`
      );
      return {
        ok: true,
        message: bond.paid
          ? 'Deuda saldada.'
          : `Pago realizado; quedan ${bond.balance} de deuda.`
      };
    }

    return { ok: false, message: 'La operación financiera no está disponible.' };
  },

  processBondsAtRoundStart(round) {
    for (const bond of this.bonds) {
      if (bond.paid) continue;
      const player = this.players.get(bond.playerId);
      if (!player) continue;
      if (!bond.defaulted && round >= bond.dueRound) {
        if (player.resources.SILVER >= bond.balance) {
          player.resources.SILVER -= bond.balance;
          this.bankFund.SILVER += bond.balance;
          bond.balance = 0;
          bond.paid = true;
          this.recordEvent(`${player.name} pagó automáticamente el bono ${bond.id}; deuda saldada.`);
        } else {
          bond.defaulted = true;
          player.resources.INFLUENCE = Math.max(0, player.resources.INFLUENCE - 5);
          this.recordEvent(
            `${player.name} incumplió el bono ${bond.id}: no pudo pagar ${bond.balance} de plata y perdió 5 de Influencia Política.`
          );
        }
      } else if (bond.defaulted && round > bond.dueRound && bond.lastInterestRound !== round) {
        bond.balance += 1;
        bond.lastInterestRound = round;
        this.recordEvent(
          `El bono ${bond.id} de ${player.name} acumuló 1 de interés; la deuda asciende a ${bond.balance} de plata.`
        );
      }
    }
  },
};
