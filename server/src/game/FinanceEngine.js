/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { ECONOMY, GAME_PHASES, TREATY_TYPES } from '../../../shared/Constants.js';
import { BANK_TARIFF_RATE, TREATY_DURATION_ROUNDS, VALID_TRADE_RESOURCES } from './GameStateUtils.js';
import { calculateCountryTrade } from '../../../shared/EconomyFormulas.js';

function quoteTrade(state, proposerId, recipientId, offer) {
  return calculateCountryTrade(offer, {
    atWar: state.isPlayersAtWar(proposerId, recipientId),
    freeTrade: state.areTreatyPartners(proposerId, recipientId, TREATY_TYPES.FREE_TRADE)
  });
}

export const FinanceEngine = {
  performFinancialAction(socketId, action = {}) {
    const player = action.playerId
      ? this.players.get(action.playerId)
      : Array.from(this.players.values()).find(
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

    if (action.type === 'TRANSFER_RESOURCE') {
      const recipient = this.players.get(action.recipientId);
      const { resource, amount } = action;
      if (!recipient || recipient.id === player.id) {
        return { ok: false, message: 'Selecciona otro país como destinatario.' };
      }
      if (this.isPlayersAtWar(player.id, recipient.id)) {
        return { ok: false, message: 'Los países en conflicto no pueden transferirse recursos.' };
      }
      if (!VALID_TRADE_RESOURCES.has(resource)) {
        return { ok: false, message: 'Solo puedes transferir Plata o Materiales.' };
      }
      if (!Number.isSafeInteger(amount) || amount < 1) {
        return { ok: false, message: 'Indica una cantidad entera mayor que cero.' };
      }
      if (player.resources[resource] < amount) {
        return { ok: false, message: 'No tienes suficientes recursos para transferir esa cantidad.' };
      }
      const tariffExempt = this.areTreatyPartners(
        player.id,
        recipient.id,
        TREATY_TYPES.FREE_TRADE
      ) && !this.isPlayersAtWar(player.id, recipient.id);
      const tariff = tariffExempt ? 0 : Math.ceil(amount * BANK_TARIFF_RATE);
      player.resources[resource] -= amount;
      recipient.resources[resource] += amount - tariff;
      this.bankFund[resource] += tariff;
      this.recordEvent(
        `${player.name} transfirió ${amount} ${resource === 'SILVER' ? 'de Plata' : 'de Materiales'} a ${recipient.name}; ${tariffExempt ? 'sin arancel por TLC' : `el Banco Mundial recaudó ${tariff} de arancel`}.`
      );
      return {
        ok: true,
        message: tariffExempt
          ? 'Transferencia completada sin arancel.'
          : `Transferencia completada; se cobraron ${tariff} de arancel.`
      };
    }

    if (action.type === 'BUY_MATERIALS' || action.type === 'SELL_MATERIALS') {
      const quantity = action.quantity;
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return { ok: false, message: 'Indica una cantidad entera de materiales mayor que cero.' };
      }
      if (action.type === 'BUY_MATERIALS') {
        const cost = quantity * ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER;
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
      const proceeds = quantity * ECONOMY.COSTS.MARKET_SELL_MATERIAL_SILVER;
      player.resources.SILVER += proceeds;
      this.bankFund.MATERIALS += quantity;
      this.recordEvent(`${player.name} vendió ${quantity} materiales por ${proceeds} de plata en el Mercado Global.`);
      return { ok: true, message: `Vendiste ${quantity} materiales por ${proceeds} de plata.` };
    }

    if (action.type === 'PROPOSE_TRADE') {
      const recipient = this.players.get(action.recipientId);
      const { offerResource, offerAmount, requestResource, requestAmount } = action;
      if (!recipient || recipient.id === player.id) {
        return { ok: false, message: 'Selecciona otro país de la partida.' };
      }
      const terms = quoteTrade(this, player.id, recipient.id, action);
      if (!terms.ok) return terms;
      if (player.resources[offerResource] < offerAmount || recipient.resources[requestResource] < requestAmount) {
        return { ok: false, message: 'Uno de los países no tiene los recursos ofrecidos.' };
      }

      const offer = {
        id: `trade-offer-${this.nextTradeOfferId++}`,
        proposerId: player.id,
        recipientId: recipient.id,
        proposerName: player.name,
        recipientName: recipient.name,
        offerResource,
        offerAmount,
        requestResource,
        requestAmount,
        createdRound: this.currentRound
      };
      this.tradeOffers.push(offer);
      this.recordEvent(
        `${player.name} propuso a ${recipient.name} intercambiar ${offerAmount} ${offerResource === 'SILVER' ? 'de Plata' : 'Materiales'} por ${requestAmount} ${requestResource === 'SILVER' ? 'de Plata' : 'Materiales'}.`,
        {
          category: 'trade-offer',
          offerId: offer.id,
          proposerId: player.id,
          recipientId: recipient.id
        }
      );
      if (recipient.isBot) {
        // Legal fixed-rate trades give each side one unit net per unit exchanged.
        const result = this.performFinancialAction(recipient.id, {
          type: 'RESPOND_TO_TRADE', playerId: recipient.id, offerId: offer.id, accepted: true
        });
        return { ...result, accepted: result.ok, message: result.ok
          ? `${recipient.name} aceptó el intercambio. ${result.message}`
          : result.message };
      }
      return { ok: true, message: `Propuesta de intercambio enviada a ${recipient.name}.` };
    }

    if (action.type === 'RESPOND_TO_TRADE') {
      const offerIndex = this.tradeOffers.findIndex((entry) => entry.id === action.offerId);
      const offer = this.tradeOffers[offerIndex];
      if (!offer || offer.recipientId !== player.id) {
        return { ok: false, message: 'No tienes una propuesta de intercambio con ese identificador.' };
      }
      if (typeof action.accepted !== 'boolean') {
        return { ok: false, message: 'La respuesta a la propuesta no es válida.' };
      }
      if (!action.accepted) {
        this.tradeOffers.splice(offerIndex, 1);
        this.recordEvent(`${player.name} rechazó la propuesta de intercambio de ${offer.proposerName}.`);
        return { ok: true, message: 'Rechazaste la propuesta de intercambio.' };
      }

      const proposer = this.players.get(offer.proposerId);
      if (!proposer) return { ok: false, message: 'El país que propuso el intercambio ya no está disponible.' };
      if (
        proposer.resources[offer.offerResource] < offer.offerAmount
        || player.resources[offer.requestResource] < offer.requestAmount
      ) {
        return { ok: false, message: 'Uno de los países ya no tiene los recursos necesarios; la propuesta sigue pendiente.' };
      }

      const terms = quoteTrade(this, proposer.id, player.id, offer);
      if (!terms.ok) return terms;
      const { freeTrade, proposerTariff, recipientTariff, receivedByRecipient, receivedByProposer } = terms;

      proposer.resources[offer.offerResource] -= offer.offerAmount;
      player.resources[offer.requestResource] -= offer.requestAmount;
      player.resources[offer.offerResource] += receivedByRecipient;
      proposer.resources[offer.requestResource] += receivedByProposer;
      this.bankFund[offer.offerResource] += proposerTariff;
      this.bankFund[offer.requestResource] += recipientTariff;
      this.tradeOffers.splice(offerIndex, 1);
      this.recordEvent(
        `${player.name} aceptó el intercambio de ${proposer.name}; ${freeTrade ? 'el TLC permitió el cambio 1:1 sin aranceles' : `el cambio fue 2 de Plata por 1 Material y el Banco Mundial recibió ${terms.silverTariff} de Plata`}.`
      );
      return {
        ok: true,
        message: freeTrade
          ? `Intercambio completado 1:1 con ${proposer.name}; no se cobraron aranceles.`
          : `Intercambio completado con ${proposer.name}; el Banco Mundial recibió ${terms.silverTariff} de Plata.`
      };
    }

    if (action.type === 'CANCEL_TRADE') {
      const offerIndex = this.tradeOffers.findIndex((entry) => entry.id === action.offerId);
      const offer = this.tradeOffers[offerIndex];
      if (!offer || offer.proposerId !== player.id) {
        return { ok: false, message: 'No puedes cancelar esa propuesta de intercambio.' };
      }
      this.tradeOffers.splice(offerIndex, 1);
      this.recordEvent(`${player.name} canceló su propuesta de intercambio a ${offer.recipientName}.`);
      return { ok: true, message: 'Cancelaste la propuesta de intercambio.' };
    }

    if (action.type === 'DONATE_TO_WORLD_BANK') {
      const donationCost = ECONOMY.COSTS.DONATION_SILVER;
      if (player.resources.SILVER < donationCost) {
        return { ok: false, message: `Necesitas ${donationCost} de plata para donar al Banco Mundial.` };
      }
      player.resources.SILVER -= donationCost;
      player.resources.INFLUENCE += ECONOMY.COSTS.DONATION_INFLUENCE;
      this.bankFund.SILVER += donationCost;
      this.recordEvent(
        `${player.name} donó ${donationCost} de plata al Banco Mundial y obtuvo ${ECONOMY.COSTS.DONATION_INFLUENCE} de Influencia Política.`
      );
      return {
        ok: true,
        message: `Donación realizada: pagaste ${donationCost} de plata y obtuviste ${ECONOMY.COSTS.DONATION_INFLUENCE} de Influencia.`
      };
    }

    if (action.type === 'ISSUE_BOND') {
      if (this.bonds.some((bond) => bond.playerId === player.id && !bond.paid)) {
        return { ok: false, message: 'Ya tienes un bono pendiente. Debes saldarlo antes de emitir otro.' };
      }
      const bond = {
        id: `bond-${this.nextBondId++}`,
        playerId: player.id,
        principal: ECONOMY.COSTS.BOND_PRINCIPAL,
        balance: ECONOMY.COSTS.BOND_PRINCIPAL,
        issueRound: this.currentRound,
        dueRound: this.currentRound + TREATY_DURATION_ROUNDS,
        defaulted: false,
        paid: false,
        lastInterestRound: null
      };
      this.bonds.push(bond);
      player.resources.SILVER += ECONOMY.COSTS.BOND_PROCEEDS;
      this.bankFund.SILVER -= ECONOMY.COSTS.BOND_PROCEEDS;
      this.recordEvent(
        `${player.name} emitió el bono ${bond.id}: recibió ${ECONOMY.COSTS.BOND_PROCEEDS} de plata y debe pagar ${bond.principal} en la ronda ${bond.dueRound}.`
      );
      return { ok: true, message: `Bono emitido: recibiste ${ECONOMY.COSTS.BOND_PROCEEDS} de plata; debes ${bond.principal} en la ronda ${bond.dueRound}.` };
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
          player.resources.INFLUENCE = Math.max(
            0,
            player.resources.INFLUENCE - ECONOMY.COSTS.BOND_DEFAULT_INFLUENCE_PENALTY
          );
          this.recordEvent(
            `${player.name} incumplió el bono ${bond.id}: no pudo pagar ${bond.balance} de plata y perdió ${ECONOMY.COSTS.BOND_DEFAULT_INFLUENCE_PENALTY} de Influencia Política.`
          );
        }
      } else if (bond.defaulted && round > bond.dueRound && bond.lastInterestRound !== round) {
        bond.balance += ECONOMY.COSTS.BOND_INTEREST_PER_ROUND;
        bond.lastInterestRound = round;
        this.recordEvent(
          `El bono ${bond.id} de ${player.name} acumuló ${ECONOMY.COSTS.BOND_INTEREST_PER_ROUND} de interés; la deuda asciende a ${bond.balance} de plata.`
        );
      }
    }
  },
};
