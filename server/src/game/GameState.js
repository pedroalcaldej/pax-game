/**
 * server/src/game/GameState.js
 */

import { generateInitialGrid } from '../../../shared/MapGenerator.js';
import {
  ECONOMIC_POLICY,
  ACTION_SLOT_COUNT,
  LAND_TERRAIN,
  MAP_CONFIG,
  NATIONS,
  TREATY_TYPES,
  TERRAIN_TYPES
} from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';

const createEmptyActionSlots = () => Array(ACTION_SLOT_COUNT).fill(null);
const TREATY_DURATION_ROUNDS = 5;
const BANK_TARIFF_RATE = 0.2;
const VALID_TRADE_RESOURCES = new Set(['SILVER', 'MATERIALS']);

export class GameState {
  constructor() {
    this.gridWidth = MAP_CONFIG.GRID_WIDTH;
    this.gridHeight = MAP_CONFIG.GRID_HEIGHT;
    this.players = new Map();
    this.gameStarted = false;
    this.gameOver = false;
    this.currentPhase = 1;
    this.timeRemaining = 60;
    this.isPaused = false;
    this.currentRound = 1;
    this.seed = Date.now();
    this.actionResolutionId = 0;
    this.lastActionResolutions = [];
    this.eventHistory = [];
    this.nextEventId = 1;
    this.oiProposals = [];
    this.nextOIProposalId = 1;
    this.oiSession = null;
    this.oiPolicies = {
      armamentLimit: null,
      industryLimit: null
    };
    this.activeDmzZones = [];
    this.nonAggressionPacts = [];
    this.freeTradeTreaties = [];
    this.treatyOffers = [];
    this.nextTreatyOfferId = 1;
    this.bankFund = { SILVER: 0, MATERIALS: 0 };
    this.bonds = [];
    this.nextBondId = 1;
    this.conflicts = [];
    this.aggressions = [];
    this.casusBelli = [];

    this.grid = generateInitialGrid(this.seed);
    this.createNations();
  }

  createNations() {
    NATIONS.forEach((nation) => {
      this.players.set(nation.id, {
        id: nation.id,
        nationId: nation.nationId,
        socketId: null,
        boundPlayerId: null,
        isBot: true,
        name: nation.name,
        color: nation.color,
        gdiPoints: 100,
        gdiBreakdown: {
          initial: 100,
          population: 0,
          industry: 0
        },
        plannedActions: createEmptyActionSlots(),
        phaseReady: false,
        taxRate: ECONOMIC_POLICY.DEFAULT_TAX_RATE,
        resources: {
          SILVER: 100,
          MATERIALS: 10,
          INFLUENCE: 20
        }
      });
    });
  }

  recordEvent(message) {
    const event = {
      id: this.nextEventId,
      round: this.currentRound,
      phase: this.currentPhase,
      message
    };
    this.nextEventId += 1;
    this.eventHistory.push(event);
    return event;
  }

  proposeTreaty(socketId, treaty = {}) {
    const { recipientId, type } = treaty || {};
    const proposer = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!proposer) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes proponer tratados durante una partida activa.' };
    }
    if (!Object.values(TREATY_TYPES).includes(type)) {
      return { ok: false, message: 'El tipo de tratado seleccionado no es válido.' };
    }
    const recipient = this.players.get(recipientId);
    if (!recipient || recipient.id === proposer.id) {
      return { ok: false, message: 'Selecciona otro país como destinatario del tratado.' };
    }
    if (
      type === TREATY_TYPES.FREE_TRADE
      && this.isPlayersAtWar(proposer.id, recipient.id)
    ) {
      return { ok: false, message: 'No puedes proponer un TLC mientras exista un conflicto activo con ese país.' };
    }

    const playerIds = [proposer.id, recipient.id].sort();
    const activeTreaties = type === TREATY_TYPES.NON_AGGRESSION_PACT
      ? this.nonAggressionPacts
      : this.freeTradeTreaties;
    if (activeTreaties.some((treaty) => (
      treaty.expiresAfterRound >= this.currentRound
      && treaty.playerIds.join('|') === playerIds.join('|')
    ))) {
      return { ok: false, message: 'Ya existe un tratado vigente entre esos países.' };
    }
    if (this.treatyOffers.some((offer) => (
      offer.type === type
      && [offer.proposerId, offer.recipientId].sort().join('|') === playerIds.join('|')
    ))) {
      return { ok: false, message: 'Ya hay una propuesta de ese tratado pendiente.' };
    }

    const offer = {
      id: `treaty-offer-${this.nextTreatyOfferId++}`,
      type,
      proposerId: proposer.id,
      proposerName: proposer.name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      proposedRound: this.currentRound
    };

    if (recipient.isBot) {
      const accepted = this.botAcceptsTreaty(recipient, proposer, type);
      this.applyTreatyResponse(offer, accepted);
      return {
        ok: true,
        accepted,
        message: accepted
          ? `${recipient.name} aceptó el tratado.`
          : `${recipient.name} rechazó el tratado.`
      };
    }

    this.treatyOffers.push(offer);
    this.recordEvent(`${proposer.name} propuso ${this.getTreatyName(type)} a ${recipient.name}.`);
    return { ok: true, accepted: null, message: `Propuesta de ${this.getTreatyName(type)} enviada a ${recipient.name}.` };
  }

  respondToTreaty(socketId, offerId, accepted) {
    const recipient = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!recipient) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes responder a tratados durante una partida activa.' };
    }
    const offerIndex = this.treatyOffers.findIndex((offer) => (
      offer.id === offerId && offer.recipientId === recipient.id
    ));
    if (offerIndex < 0) return { ok: false, message: 'La propuesta de tratado ya no está disponible.' };
    if (typeof accepted !== 'boolean') {
      return { ok: false, message: 'Indica si aceptas o rechazas el tratado.' };
    }

    const offer = this.treatyOffers[offerIndex];
    if (
      accepted
      && offer.type === TREATY_TYPES.FREE_TRADE
      && this.isPlayersAtWar(offer.proposerId, offer.recipientId)
    ) {
      return { ok: false, message: 'No se puede firmar un TLC mientras exista un conflicto activo entre esos países.' };
    }
    const activeTreaties = offer.type === TREATY_TYPES.NON_AGGRESSION_PACT
      ? this.nonAggressionPacts
      : this.freeTradeTreaties;
    if (accepted && activeTreaties.some((treaty) => (
      treaty.expiresAfterRound >= this.currentRound
      && treaty.playerIds.join('|') === [offer.proposerId, offer.recipientId].sort().join('|')
    ))) {
      this.treatyOffers.splice(offerIndex, 1);
      return { ok: false, message: 'Ya existe un tratado vigente entre esos países.' };
    }
    this.treatyOffers.splice(offerIndex, 1);
    this.applyTreatyResponse(offer, accepted);
    return {
      ok: true,
      message: accepted
        ? `Aceptaste el ${this.getTreatyName(offer.type)}.`
        : `Rechazaste el ${this.getTreatyName(offer.type)}.`
    };
  }

  cancelTreatyOffer(socketId, offerId) {
    const proposer = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!proposer) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes cancelar propuestas durante una partida activa.' };
    }
    const offerIndex = this.treatyOffers.findIndex((offer) => (
      offer.id === offerId && offer.proposerId === proposer.id
    ));
    if (offerIndex < 0) {
      return { ok: false, message: 'Solo puedes cancelar tus propuestas que sigan pendientes.' };
    }
    const [offer] = this.treatyOffers.splice(offerIndex, 1);
    this.recordEvent(`${proposer.name} canceló la propuesta de ${this.getTreatyName(offer.type)} a ${offer.recipientName}.`);
    return { ok: true, message: `Propuesta de ${this.getTreatyName(offer.type)} cancelada.` };
  }

  applyTreatyResponse(offer, accepted) {
    const treaty = {
      playerIds: [offer.proposerId, offer.recipientId].sort(),
      expiresAfterRound: this.currentRound + TREATY_DURATION_ROUNDS - 1
    };
    if (accepted && offer.type === TREATY_TYPES.NON_AGGRESSION_PACT) {
      this.nonAggressionPacts.push(treaty);
    } else if (accepted && offer.type === TREATY_TYPES.FREE_TRADE) {
      this.freeTradeTreaties.push(treaty);
    }
    const proposer = this.players.get(offer.proposerId);
    const recipient = this.players.get(offer.recipientId);
    this.recordEvent(accepted
      ? `${proposer?.name || offer.proposerName} y ${recipient?.name || offer.recipientName} firmaron el ${this.getTreatyName(offer.type)}.`
      : `${recipient?.name || offer.recipientName} rechazó el ${this.getTreatyName(offer.type)} propuesto por ${proposer?.name || offer.proposerName}.`);
  }

  expireTreatiesAfterRound(round) {
    const playerNames = (playerIds) => playerIds
      .map((id) => this.players.get(id)?.name || id)
      .join(' y ');
    for (const [treaties, type] of [
      [this.nonAggressionPacts, TREATY_TYPES.NON_AGGRESSION_PACT],
      [this.freeTradeTreaties, TREATY_TYPES.FREE_TRADE]
    ]) {
      const expired = treaties.filter((treaty) => treaty.expiresAfterRound <= round);
      for (const treaty of expired) {
        this.recordEvent(`${this.getTreatyName(type)} entre ${playerNames(treaty.playerIds)} expiró.`);
      }
      const expiredTreaties = new Set(expired);
      const remaining = treaties.filter((treaty) => !expiredTreaties.has(treaty));
      if (type === TREATY_TYPES.NON_AGGRESSION_PACT) this.nonAggressionPacts = remaining;
      else this.freeTradeTreaties = remaining;
    }
  }

  breakNonAggressionPact(attacker, defenderId) {
    const hadActivePact = this.nonAggressionPacts.some((pact) => (
      pact.expiresAfterRound >= this.currentRound
      && pact.playerIds.includes(attacker.id)
      && pact.playerIds.includes(defenderId)
    ));
    if (!hadActivePact) return false;

    this.nonAggressionPacts = this.nonAggressionPacts.filter((pact) => !(
      pact.expiresAfterRound >= this.currentRound
      && pact.playerIds.includes(attacker.id)
      && pact.playerIds.includes(defenderId)
    ));
    const influence = Number.isFinite(attacker.resources?.INFLUENCE)
      ? attacker.resources.INFLUENCE
      : 0;
    attacker.resources.INFLUENCE = Math.max(0, influence - 10);
    const defender = this.players.get(defenderId);
    this.recordEvent(
      `${attacker.name} traicionó el Pacto de No Agresión con ${defender?.name || defenderId}: el pacto se rompió y perdió 10 de Influencia Política.`
    );
    return true;
  }

  isPlayersAtWar(firstPlayerId, secondPlayerId) {
    const pair = [firstPlayerId, secondPlayerId].sort();
    const recentConflict = this.conflicts.some((conflict) => (
      conflict.round >= this.currentRound - 2
      && conflict.round <= this.currentRound
      && [conflict.attackerId, conflict.defenderId].sort().join('|') === pair.join('|')
    ));
    if (recentConflict) return true;
    return this.grid.some((row) => row.some((tile) => (
      (tile.ownerId === firstPlayerId && (tile.visitingTroops?.[secondPlayerId] || 0) > 0)
      || (tile.ownerId === secondPlayerId && (tile.visitingTroops?.[firstPlayerId] || 0) > 0)
    )));
  }

  getActiveConflicts() {
    const pairs = new Map();
    for (const conflict of this.conflicts) {
      if (
        conflict.round < this.currentRound - 2
        || conflict.round > this.currentRound
      ) continue;
      const playerIds = [conflict.attackerId, conflict.defenderId].sort();
      const key = playerIds.join('|');
      const existing = pairs.get(key);
      if (!existing || conflict.round > existing.round) {
        pairs.set(key, { playerIds, round: conflict.round });
      }
    }
    for (const row of this.grid) {
      for (const tile of row) {
        if (tile.ownerId == null) continue;
        for (const [visitorId, count] of Object.entries(tile.visitingTroops || {})) {
          if (count <= 0 || visitorId === tile.ownerId) continue;
          const playerIds = [tile.ownerId, visitorId].sort();
          const key = playerIds.join('|');
          if (!pairs.has(key)) pairs.set(key, { playerIds, round: this.currentRound, occupied: true });
          else pairs.get(key).occupied = true;
        }
      }
    }
    return Array.from(pairs.values(), (conflict) => ({
      ...conflict,
      playerNames: conflict.playerIds.map((id) => this.players.get(id)?.name || id)
    }));
  }

  registerMilitaryConflict(attacker, defenderId) {
    const existing = this.conflicts.find((conflict) => (
      conflict.round === this.currentRound
      && [conflict.attackerId, conflict.defenderId].sort().join('|')
        === [attacker.id, defenderId].sort().join('|')
    ));
    if (!existing) {
      this.conflicts.push({
        attackerId: attacker.id,
        defenderId,
        round: this.currentRound
      });
    }

    const hadFreeTrade = this.freeTradeTreaties.some((treaty) => (
      treaty.expiresAfterRound >= this.currentRound
      && treaty.playerIds.includes(attacker.id)
      && treaty.playerIds.includes(defenderId)
    ));
    if (hadFreeTrade) {
      this.freeTradeTreaties = this.freeTradeTreaties.filter((treaty) => !(
        treaty.expiresAfterRound >= this.currentRound
        && treaty.playerIds.includes(attacker.id)
        && treaty.playerIds.includes(defenderId)
      ));
      const defender = this.players.get(defenderId);
      this.recordEvent(
        `La acción militar de ${attacker.name} contra ${defender?.name || defenderId} rompió el Tratado de Libre Comercio; se restablece el arancel del Banco Mundial.`
      );
    }
  }

  areTreatyPartners(firstPlayerId, secondPlayerId, type) {
    const treaties = type === TREATY_TYPES.FREE_TRADE
      ? this.freeTradeTreaties
      : this.nonAggressionPacts;
    return treaties.some((treaty) => (
      treaty.expiresAfterRound >= this.currentRound
      && treaty.playerIds.includes(firstPlayerId)
      && treaty.playerIds.includes(secondPlayerId)
    ));
  }

  performFinancialAction(socketId, action = {}) {
    const player = Array.from(this.players.values()).find(
      (entry) => entry.socketId === socketId && !entry.isBot
    );
    if (!player) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Las operaciones financieras requieren una partida activa.' };
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
      const tariff = tariffExempt ? 0 : Math.floor(amount * BANK_TARIFF_RATE);
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

    if (action.type === 'ISSUE_BOND') {
      const bond = {
        id: `bond-${this.nextBondId++}`,
        playerId: player.id,
        principal: 25,
        balance: 25,
        issueRound: this.currentRound,
        dueRound: this.currentRound + TREATY_DURATION_ROUNDS - 1,
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
  }

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
  }

  botAcceptsTreaty(bot, proposer, type) {
    if (!bot || !proposer || type !== TREATY_TYPES.NON_AGGRESSION_PACT) return false;
    const proposerTroops = InternationalOrganizationEngine.countTroops(this, proposer.id);
    const botTroops = InternationalOrganizationEngine.countTroops(this, bot.id);
    return proposerTroops > botTroops && this.grid.some((row) => row.some((tile) => (
      tile.ownerId === bot.id
      && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => (
        this.grid[tile.y + dy]?.[tile.x + dx]?.ownerId === proposer.id
      ))
    )));
  }

  getTreatyName(type) {
    return type === TREATY_TYPES.NON_AGGRESSION_PACT
      ? 'Pacto de No Agresión'
      : 'Tratado de Libre Comercio';
  }

  addPlayer(socketId, playerName, playerId) {
    const id = playerId || socketId;

    for (const player of this.players.values()) {
      if (player.boundPlayerId === id) {
        player.socketId = socketId;
        player.isBot = false;
        player.phaseReady = false;
        return player;
      }
    }

    for (const player of this.players.values()) {
      if (player.isBot) {
        player.boundPlayerId = id;
        player.socketId = socketId;
        player.isBot = false;
        player.phaseReady = false;
        if (playerName && playerName !== 'Nación Alpha') {
          player.name = playerName;
        }
        return player;
      }
    }

    return null;
  }

  removePlayer(socketId) {
    let removed = false;
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.socketId = null;
        player.boundPlayerId = null;
        player.isBot = true;
        player.phaseReady = false;
        player.name = NATIONS[player.nationId].name;
        removed = true;
      }
    }
    return removed;
  }

  setPlayerTaxRate(socketId, taxRate) {
    if (
      !this.gameStarted
      || this.currentPhase !== 2
      || !Number.isFinite(taxRate)
      || taxRate < ECONOMIC_POLICY.MIN_TAX_RATE
      || taxRate > ECONOMIC_POLICY.MAX_TAX_RATE
    ) {
      return false;
    }

    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.taxRate = taxRate;
        return true;
      }
    }
    return false;
  }

  markPlayerReady(socketId, ready = true) {
    if (!this.gameStarted || this.currentPhase !== 2) {
      return { ok: false, message: 'Solo puedes forzar el fin durante la fase de planificación.' };
    }
    const player = Array.from(this.players.values()).find((entry) => entry.socketId === socketId);
    if (!player || player.isBot) {
      return { ok: false, message: 'No tienes un país activo en esta partida.' };
    }

    player.phaseReady = Boolean(ready);
    this.recordEvent(`${player.name} ${player.phaseReady ? 'confirmó' : 'retiró'} que está listo.`);
    const participants = Array.from(this.players.values());
    const readyCount = participants.filter((entry) => entry.phaseReady).length;
    return {
      ok: true,
      readyCount,
      requiredCount: participants.length,
      allReady: participants.length > 0 && readyCount === participants.length,
      ready: player.phaseReady
    };
  }

  performPlayerAction(socketId, action) {
    const player = Array.from(this.players.values()).find((entry) => entry.socketId === socketId);
    if (!player) return { ok: false, message: 'No tienes un país asignado.' };
    if (!this.gameStarted) return { ok: false, message: 'La partida todavía no ha comenzado.' };
    if (this.currentPhase !== 2) return { ok: false, message: 'Las acciones solo están disponibles en la fase de planificación.' };
    if (!action || action.type !== 'PLAN_ACTION') {
      return { ok: false, message: 'La orden de planificación no es válida.' };
    }
    const { slot, plannedAction } = action;
    if (!Number.isInteger(slot) || slot < 0 || slot >= ACTION_SLOT_COUNT) {
      return { ok: false, message: `Selecciona uno de los ${ACTION_SLOT_COUNT} espacios de acción.` };
    }

    player.plannedActions = Array.from(
      { length: ACTION_SLOT_COUNT },
      (_, index) => player.plannedActions?.[index] ?? null
    );
    if (plannedAction == null) {
      player.plannedActions[slot] = null;
      return { ok: true, message: `Espacio ${slot + 1} de acción vaciado.` };
    }
    if (typeof plannedAction.type !== 'string') {
      return { ok: false, message: 'La acción no es válida.' };
    }

    const validation = this.validatePlannedAction(player, plannedAction, slot);
    if (!validation.ok) return validation;

    player.plannedActions[slot] = { ...plannedAction };
    const name = this.getActionName(plannedAction.type);
    return {
      ok: true,
      message: `${name} guardada en el espacio ${slot + 1}. Se ejecutará cuando termine el tiempo de planificación.`
    };
  }

  getActionName(type) {
    const names = {
      BUILD_CITY: 'Construir ciudad',
      BUILD_FACTORY: 'Construir fábrica',
      RECRUIT_TROOP: 'Reclutar tropa',
      MOVE_CAPITAL: 'Trasladar capital',
      MOVE_TROOPS: 'Mover tropas',
      HOLD_POSITION: 'Mantener posición'
    };
    return names[type] || 'Acción';
  }

  validatePlannedAction(player, action, slot) {
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    const tile = this.grid[action.y]?.[action.x];
    if (!tile) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    if (action.type === 'MOVE_TROOPS') {
      if (this.getTroopsForPlayerOnTile(tile, player.id) <= 0) {
        return { ok: false, message: 'No hay tropas propias en la casilla de origen.' };
      }
    } else if (tile.ownerId !== player.id) {
      return { ok: false, message: 'Solo puedes planificar acciones sobre tu propio territorio.' };
    }

    const otherActions = (player.plannedActions || [])
      .filter((planned, index) => planned && index !== slot);
    const usesStructureSlot = ['BUILD_CITY', 'BUILD_FACTORY', 'MOVE_CAPITAL'].includes(action.type);
    if (otherActions.some((planned) => (
      planned.x === action.x
      && planned.y === action.y
      && (usesStructureSlot || ['BUILD_CITY', 'BUILD_FACTORY', 'MOVE_CAPITAL'].includes(planned.type))
    ))) {
      return { ok: false, message: 'Ya hay otra acción incompatible planificada para esa casilla.' };
    }

    let silverCost = 0;
    let materialCost = 0;
    switch (action.type) {
      case 'BUILD_CITY':
        if (tile.type !== TERRAIN_TYPES.TR || tile.building) {
          return { ok: false, message: 'Solo puedes construir una ciudad en tierra vacía.' };
        }
        silverCost = 50;
        break;
      case 'BUILD_FACTORY':
        if (![TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA].includes(tile.type)
          || tile.building) {
          return { ok: false, message: 'No puedes construir una fábrica en esta casilla.' };
        }
        if (this.oiPolicies.industryLimit != null) {
          const plannedFactories = otherActions.filter(
            (planned) => planned.type === 'BUILD_FACTORY'
          ).length;
          if (
            InternationalOrganizationEngine.countFactories(this, player.id) + plannedFactories + 1
            > this.oiPolicies.industryLimit
          ) {
            return { ok: false, message: `El límite de industria es de ${this.oiPolicies.industryLimit} fábricas.` };
          }
        }
        silverCost = tile.type === TERRAIN_TYPES.MPT || tile.type === TERRAIN_TYPES.MPA ? 5 : 10;
        break;
      case 'RECRUIT_TROOP':
        {
          const count = action.count ?? 1;
          if (!Number.isInteger(count) || count < 1) {
            return { ok: false, message: 'La cantidad de tropas a reclutar no es válida.' };
          }
          if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) {
            return { ok: false, message: 'No puedes reclutar tropas dentro de una Zona Desmilitarizada.' };
          }
          action.count = count;
          if (this.oiPolicies.armamentLimit != null) {
            const plannedRecruitment = otherActions
              .filter((planned) => planned.type === 'RECRUIT_TROOP')
              .reduce((sum, planned) => sum + (planned.count ?? 1), 0);
            if (
              InternationalOrganizationEngine.countTroops(this, player.id)
              + plannedRecruitment
              + count
              > this.oiPolicies.armamentLimit
            ) {
              return { ok: false, message: `El límite de armamento es de ${this.oiPolicies.armamentLimit} tropas.` };
            }
          }
          silverCost = 5 * count;
          materialCost = 2 * count;
        }
        break;
      case 'MOVE_CAPITAL':
        if (tile.type !== TERRAIN_TYPES.CIU) {
          return { ok: false, message: 'Selecciona una ciudad propia para trasladar la capital.' };
        }
        silverCost = 10;
        materialCost = 2;
        break;
      case 'MOVE_TROOPS': {
        const destination = this.grid[action.targetY]?.[action.targetX];
        if (!destination) return { ok: false, message: 'Selecciona una casilla de destino válida.' };
        if (Math.abs(tile.x - destination.x) + Math.abs(tile.y - destination.y) !== 1) {
          return { ok: false, message: 'El destino debe ser una casilla terrestre adyacente.' };
        }
        if (!LAND_TERRAIN.has(destination.type)) {
          return { ok: false, message: 'Las tropas solo pueden avanzar sobre tierra.' };
        }
        if (
          InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
          || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
        ) {
          return { ok: false, message: 'No se pueden mover tropas hacia, desde o a través de una Zona Desmilitarizada.' };
        }
        if (otherActions.some((planned) => (
          planned.type === 'MOVE_TROOPS'
          && planned.targetX === destination.x && planned.targetY === destination.y
        ))) {
          return { ok: false, message: 'Ya tienes un movimiento planificado hacia esa casilla.' };
        }
        const otherTroops = otherActions
          .filter((planned) => (
            planned.type === 'MOVE_TROOPS'
            && planned.x === action.x && planned.y === action.y
          ))
          .reduce((sum, planned) => sum + planned.troops, 0);
        const troops = action.troops ?? tile.troops;
        const availableTroops = this.getTroopsForPlayerOnTile(tile, player.id);
        if (!Number.isInteger(troops) || troops < 1 || troops > availableTroops - otherTroops) {
          return { ok: false, message: 'La cantidad de tropas supera las disponibles para planificar.' };
        }
        action.troops = troops;
        return { ok: true };
      }
      case 'HOLD_POSITION':
        return player.isBot ? { ok: true } : { ok: false, message: 'Esta acción está reservada para los bots.' };
      default:
        return { ok: false, message: 'La acción no está disponible.' };
    }

    const otherSilver = otherActions.reduce((sum, planned) => sum + this.getSilverCost(planned), 0);
    const otherMaterials = otherActions.reduce((sum, planned) => sum + this.getMaterialCost(planned), 0);
    if (player.resources.SILVER < otherSilver + silverCost) {
      return { ok: false, message: 'No hay plata suficiente para todas las acciones planificadas.' };
    }
    if (player.resources.MATERIALS < otherMaterials + materialCost) {
      return { ok: false, message: 'No hay materiales suficientes para todas las acciones planificadas.' };
    }
    return { ok: true };
  }

  getSilverCost(action) {
    if (action.type === 'BUILD_CITY') return 50;
    if (action.type === 'BUILD_FACTORY') {
      const tile = this.grid[action.y]?.[action.x];
      return tile?.type === TERRAIN_TYPES.MPT || tile?.type === TERRAIN_TYPES.MPA ? 5 : 10;
    }
    if (action.type === 'RECRUIT_TROOP') return 5 * (action.count ?? 1);
    if (action.type === 'MOVE_CAPITAL') return 10;
    return 0;
  }

  getMaterialCost(action) {
    return action.type === 'RECRUIT_TROOP'
      ? 2 * (action.count ?? 1)
      : action.type === 'MOVE_CAPITAL'
        ? 2
        : 0;
  }

  resolvePlannedActions() {
    const results = [];
    for (const player of this.players.values()) {
      const plannedActions = player.plannedActions || createEmptyActionSlots();
      for (let slot = 0; slot < plannedActions.length; slot += 1) {
        const action = plannedActions[slot];
        if (!action) continue;

        let result;
        if (action.type === 'MOVE_TROOPS') {
          result = this.resolveTroopMovement(player, action);
        } else {
          const tile = this.grid[action.y]?.[action.x];
          result = tile?.ownerId === player.id
            ? this.applyPlayerAction(player, tile, action.type, action)
            : { ok: false, message: 'La casilla ya no pertenece a tu país.' };
        }
        results.push({
          playerId: player.id,
          slot: slot + 1,
          message: result.message || (result.ok ? 'Acción realizada.' : 'No se pudo realizar la acción.'),
          ...result
        });
        if (action.type !== 'HOLD_POSITION') {
          const coordinates = action.type === 'MOVE_TROOPS'
            ? ` desde (${action.x}, ${action.y}) hasta (${action.targetX}, ${action.targetY})`
            : ` en (${action.x}, ${action.y})`;
          this.recordEvent(result.ok
            ? `${player.name}: ${this.getActionName(action.type)}${coordinates}.`
            : `${player.name}: ${this.getActionName(action.type)}${coordinates} no realizada: ${result.message || 'No se pudo realizar la acción.'}`);
        }
      }
      player.plannedActions = createEmptyActionSlots();
    }
    return results;
  }

  resolveTroopMovement(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    if (
      !source
      || !destination
      || this.getTroopsForPlayerOnTile(source, player.id) < action.troops
      || !LAND_TERRAIN.has(destination.type)
      || Math.abs(source.x - destination.x) + Math.abs(source.y - destination.y) !== 1
      || InternationalOrganizationEngine.isInActiveDmz(this, source?.x, source?.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination?.x, destination?.y)
    ) {
      return { ok: false, message: 'El movimiento ya no es válido o atraviesa una Zona Desmilitarizada.' };
    }
    const hostilePlayers = new Set(
      Object.entries(destination.visitingTroops || {})
        .filter(([visitorId, count]) => visitorId !== player.id && count > 0)
        .map(([visitorId]) => visitorId)
    );
    if (destination.ownerId != null && destination.ownerId !== player.id) {
      hostilePlayers.add(destination.ownerId);
    }
    const brokePacts = [];
    for (const defenderId of hostilePlayers) {
      this.registerMilitaryConflict(player, defenderId);
      if (this.breakNonAggressionPact(player, defenderId)) brokePacts.push(defenderId);
    }
    if (destination.ownerId != null && destination.ownerId !== player.id) {
      const defenderId = destination.ownerId;
      const defenderTroops = this.getTroopsForPlayerOnTile(destination, defenderId);
      const attackerWins = action.troops > defenderTroops;
      if (!attackerWins) {
        const attackerSurvivors = Math.floor(action.troops / 2);
        this.removeTroopsFromPlayerOnTile(source, player.id, action.troops - attackerSurvivors);
        return {
          ok: true,
          message: `${brokePacts.length ? 'PNA roto: perdió Influencia Política. ' : ''}${attackerSurvivors
            ? `Ataque rechazado: ${player.name} pierde ${action.troops - attackerSurvivors} tropas y se retira.`
            : `Ataque rechazado: ${player.name} pierde todas sus tropas y se retira.`}`,
          combat: {
            attackerId: player.id,
            defenderId,
            attackerTroops: action.troops,
            defenderTroops,
            winnerId: defenderId,
            attackerSurvivors,
            defenderSurvivors: defenderTroops
          }
        };
      }

      const defenderSurvivors = Math.floor(defenderTroops / 2);
      this.removeTroopsFromPlayerOnTile(source, player.id, action.troops);
      destination.troops = Math.max(0, (destination.troops || 0) - defenderTroops + defenderSurvivors);
      if (defenderSurvivors > 0) {
        destination.visitingTroops ||= {};
        destination.visitingTroops[defenderId] = (
          destination.visitingTroops[defenderId] || 0
        ) + defenderSurvivors;
      }
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
      destination.troops += action.troops;
      return {
        ok: true,
        message: `${brokePacts.length ? 'PNA roto: perdió Influencia Política. ' : ''}${defenderSurvivors
          ? `Victoria de ${player.name}: territorio conquistado; ${defenderSurvivors} tropas enemigas supervivientes permanecen en la casilla.`
          : `Victoria de ${player.name}: territorio conquistado; la guarnición fue derrotada.`}`,
        claimed: true,
        combat: {
          attackerId: player.id,
          defenderId,
          attackerTroops: action.troops,
          defenderTroops,
          winnerId: player.id,
          attackerSurvivors: action.troops,
          defenderSurvivors
        }
      };
    }

    if (source.ownerId === player.id) {
      source.troops -= action.troops;
    } else {
      source.visitingTroops[player.id] -= action.troops;
      source.troops -= action.troops;
      if (source.visitingTroops[player.id] === 0) delete source.visitingTroops[player.id];
      if (Object.keys(source.visitingTroops).length === 0) delete source.visitingTroops;
    }
    destination.troops = (destination.troops || 0) + action.troops;
    const claimed = destination.ownerId == null;
    if (claimed) {
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
    } else if (destination.ownerId !== player.id) {
      destination.visitingTroops ||= {};
      destination.visitingTroops[player.id] = (destination.visitingTroops[player.id] || 0) + action.troops;
    }
    return {
      ok: true,
      message: claimed ? 'Territorio neutral reclamado.' : 'Tropas trasladadas.',
      claimed
    };
  }

  removeTroopsFromPlayerOnTile(tile, playerId, count) {
    if (count <= 0) return;
    if (tile.ownerId === playerId) {
      tile.troops = Math.max(0, (tile.troops || 0) - count);
      return;
    }
    tile.visitingTroops[playerId] -= count;
    tile.troops = Math.max(0, (tile.troops || 0) - count);
    if (tile.visitingTroops[playerId] === 0) delete tile.visitingTroops[playerId];
    if (Object.keys(tile.visitingTroops).length === 0) delete tile.visitingTroops;
  }

  getTroopsForPlayerOnTile(tile, playerId) {
    const visitingTroops = tile.visitingTroops || {};
    if (tile.ownerId === playerId) {
      const foreignTroops = Object.values(visitingTroops)
        .reduce((sum, count) => sum + count, 0);
      return Math.max(0, (tile.troops || 0) - foreignTroops);
    }
    return visitingTroops[playerId] || 0;
  }

  applyPlayerAction(player, tile, type, action = {}) {
    const resources = player.resources;
    switch (type) {
      case 'BUILD_CITY': {
        if (tile.type !== TERRAIN_TYPES.TR || tile.building) {
          return { ok: false, message: 'Solo puedes construir una ciudad en una casilla de tierra vacía.' };
        }
        if (resources.SILVER < 50) return { ok: false, message: 'Necesitas 50 de plata.' };
        resources.SILVER -= 50;
        tile.type = TERRAIN_TYPES.CIU;
        tile.building = 'CITY';
        tile.population = 50;
        tile.defense = 2;
        return { ok: true, message: 'Ciudad construida.' };
      }
      case 'BUILD_FACTORY': {
        const isLand = tile.type === TERRAIN_TYPES.TR || tile.type === TERRAIN_TYPES.MPT;
        const isWater = tile.type === TERRAIN_TYPES.AG || tile.type === TERRAIN_TYPES.MPA;
        if ((!isLand && !isWater) || tile.building) {
          return { ok: false, message: 'No puedes construir una fábrica en esta casilla.' };
        }
        if (
          this.oiPolicies.industryLimit != null
          && InternationalOrganizationEngine.countFactories(this, player.id) >= this.oiPolicies.industryLimit
        ) {
          return { ok: false, message: `El límite de industria es de ${this.oiPolicies.industryLimit} fábricas.` };
        }
        const cost = tile.type === TERRAIN_TYPES.MPT || tile.type === TERRAIN_TYPES.MPA ? 5 : 10;
        if (resources.SILVER < cost) return { ok: false, message: `Necesitas ${cost} de plata.` };
        resources.SILVER -= cost;
        tile.type = isWater ? TERRAIN_TYPES.FA : TERRAIN_TYPES.FT;
        tile.building = 'FACTORY';
        tile.factoriesCount = 1;
        return { ok: true, message: 'Fábrica construida.' };
      }
      case 'RECRUIT_TROOP': {
        const count = action.count ?? 1;
        const silverCost = 5 * count;
        const materialCost = 2 * count;
        if (!Number.isInteger(count) || count < 1) {
          return { ok: false, message: 'La cantidad de tropas a reclutar no es válida.' };
        }
        if (
          this.oiPolicies.armamentLimit != null
          && InternationalOrganizationEngine.countTroops(this, player.id) + count
            > this.oiPolicies.armamentLimit
        ) {
          return { ok: false, message: `El límite de armamento es de ${this.oiPolicies.armamentLimit} tropas.` };
        }
        if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) {
          return { ok: false, message: 'No puedes reclutar tropas dentro de una Zona Desmilitarizada.' };
        }
        if (resources.SILVER < silverCost || resources.MATERIALS < materialCost) {
          return { ok: false, message: `Necesitas ${silverCost} de plata y ${materialCost} materiales para reclutar.` };
        }
        resources.SILVER -= silverCost;
        resources.MATERIALS -= materialCost;
        tile.troops = (tile.troops || 0) + count;
        return { ok: true, message: `${count} ${count === 1 ? 'tropa reclutada' : 'tropas reclutadas'}.` };
      }
      case 'MOVE_CAPITAL': {
        if (tile.type !== TERRAIN_TYPES.CIU || tile.ownerId !== player.id) {
          return { ok: false, message: 'Selecciona una ciudad propia para trasladar la capital.' };
        }
        if (resources.SILVER < 10 || resources.MATERIALS < 2) {
          return { ok: false, message: 'Necesitas 10 de plata y 2 materiales.' };
        }
        const oldCapital = this.grid.flat().find((candidate) => (
          candidate.ownerId === player.id && candidate.type === TERRAIN_TYPES.CAP
        ));
        if (!oldCapital) return { ok: false, message: 'No se encontró la capital actual.' };
        resources.SILVER -= 10;
        resources.MATERIALS -= 2;
        oldCapital.type = TERRAIN_TYPES.CIU;
        oldCapital.building = 'CITY';
        oldCapital.defense = 2;
        tile.type = TERRAIN_TYPES.CAP;
        tile.building = 'CAPITAL';
        tile.defense = 4;
        return { ok: true, message: 'Capital trasladada.' };
      }
      case 'HOLD_POSITION':
        return player.isBot
          ? { ok: true, message: 'Las tropas mantienen la posición.' }
          : { ok: false, message: 'Esta acción está reservada para los bots.' };
      default:
        return { ok: false, message: 'Acción no reconocida.' };
    }
  }

  runBotDecisions({ resetReadiness = true } = {}) {
    for (const offer of [...this.treatyOffers]) {
      const recipient = this.players.get(offer.recipientId);
      if (!recipient?.isBot) continue;
      this.treatyOffers = this.treatyOffers.filter((entry) => entry.id !== offer.id);
      this.applyTreatyResponse(offer, this.botAcceptsTreaty(
        recipient,
        this.players.get(offer.proposerId),
        offer.type
      ));
    }

    for (const player of this.players.values()) {
      if (resetReadiness) player.phaseReady = false;
      if (!player.isBot) continue;
      if (!resetReadiness && player.phaseReady) continue;
      player.phaseReady = false;
      player.plannedActions = createEmptyActionSlots();
      player.taxRate = 0.15;

      const expansion = this.findBotExpansion(player, 0);
      if (expansion) {
        this.planBotAction(player, expansion, 0);
      }

      let slot = player.plannedActions.findIndex((action) => !action);
      let factory = this.findBotBuildAction(player, 'BUILD_FACTORY', slot);
      if (factory) {
        this.planBotAction(player, factory, slot);
      }

      for (slot = 0; slot < player.plannedActions.length; slot += 1) {
        if (player.plannedActions[slot]) continue;
        const recruitment = this.findBotRecruitment(player, slot);
        if (recruitment) this.planBotAction(player, recruitment, slot);
      }

      for (let slot = 0; slot < player.plannedActions.length; slot += 1) {
        if (player.plannedActions[slot]) continue;
        const extraAction = this.findBotExpansion(player, slot)
          || this.findBotAttack(player, slot)
          || this.findBotBuildAction(player, 'BUILD_FACTORY', slot)
          || this.findBotBuildAction(player, 'BUILD_CITY', slot);
        if (!extraAction) continue;
        this.planBotAction(player, extraAction, slot);
      }
      player.phaseReady = true;
    }
  }

  findBotExpansion(player, slot = 0) {
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const sources = this.grid.flat()
      .filter((tile) => (
        tile.ownerId === player.id
        && tile.troops > 0
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ))
      .sort((left, right) => right.troops - left.troops);

    for (const source of sources) {
      for (const [dx, dy] of directions) {
        const targetX = source.x + dx;
        const targetY = source.y + dy;
        const target = this.grid[targetY]?.[targetX];
        if (
          !target
          || target.ownerId != null
          || !LAND_TERRAIN.has(target.type)
          || InternationalOrganizationEngine.isInActiveDmz(this, targetX, targetY)
        ) {
          continue;
        }
        const alreadyMoved = (player.plannedActions || [])
          .filter((planned) => planned?.type === 'MOVE_TROOPS'
            && planned.x === source.x && planned.y === source.y)
          .reduce((sum, planned) => sum + planned.troops, 0);
        const availableTroops = this.getTroopsForPlayerOnTile(source, player.id) - alreadyMoved;
        const troops = Math.max(1, Math.floor(availableTroops / 2));
        const action = {
          type: 'MOVE_TROOPS',
          x: source.x,
          y: source.y,
          targetX,
          targetY,
          troops
        };
        if (this.validatePlannedAction(player, action, slot).ok) return action;
      }
    }
    return null;
  }

  findBotAttack(player, slot) {
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const sources = this.grid.flat()
      .filter((tile) => (
        tile.ownerId === player.id
        && this.getTroopsForPlayerOnTile(tile, player.id) > 0
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ))
      .sort((left, right) => right.troops - left.troops);

    for (const source of sources) {
      const alreadyMoved = (player.plannedActions || [])
        .filter((planned) => planned?.type === 'MOVE_TROOPS'
          && planned.x === source.x && planned.y === source.y)
        .reduce((sum, planned) => sum + planned.troops, 0);
      const availableTroops = this.getTroopsForPlayerOnTile(source, player.id) - alreadyMoved;
      if (availableTroops < 1) continue;

      for (const [dx, dy] of directions) {
        const target = this.grid[source.y + dy]?.[source.x + dx];
        if (
          !target
          || target.ownerId == null
          || target.ownerId === player.id
          || !LAND_TERRAIN.has(target.type)
          || InternationalOrganizationEngine.isInActiveDmz(this, target.x, target.y)
        ) {
          continue;
        }
        const defenders = this.getTroopsForPlayerOnTile(target, target.ownerId);
        const troops = defenders + 1;
        if (troops > availableTroops) continue;
        const action = {
          type: 'MOVE_TROOPS',
          x: source.x,
          y: source.y,
          targetX: target.x,
          targetY: target.y,
          troops
        };
        if (this.validatePlannedAction(player, action, slot).ok) return action;
      }
    }
    return null;
  }

  findBotBuildAction(player, type, slot) {
    const candidates = this.grid.flat().filter((tile) => {
      if (tile.ownerId !== player.id || tile.building) return false;
      if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) return false;
      if (type === 'BUILD_CITY') return tile.type === TERRAIN_TYPES.TR;
      return [TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA]
        .includes(tile.type);
    });
    for (const tile of candidates) {
      const action = { type, x: tile.x, y: tile.y };
      if (this.validatePlannedAction(player, action, slot).ok) return action;
    }
    return null;
  }

  findBotRecruitment(player, slot) {
    const troopLimit = this.oiPolicies.armamentLimit ?? 10;
    const currentTroops = InternationalOrganizationEngine.countTroops(this, player.id);
    const plannedRecruitment = player.plannedActions
      .filter((action) => action?.type === 'RECRUIT_TROOP')
      .reduce((sum, action) => sum + action.count, 0);
    const reservedSilver = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getSilverCost(action), 0);
    const reservedMaterials = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getMaterialCost(action), 0);
    const count = Math.min(
      troopLimit - currentTroops - plannedRecruitment,
      Math.floor((player.resources.SILVER - reservedSilver) / 5),
      Math.floor((player.resources.MATERIALS - reservedMaterials) / 2)
    );
    if (count < 1) return null;

    for (const tile of this.grid.flat()) {
      if (
        tile.ownerId !== player.id
        || InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ) {
        continue;
      }
      const action = {
        type: 'RECRUIT_TROOP',
        x: tile.x,
        y: tile.y,
        count
      };
      if (this.validatePlannedAction(player, action, slot).ok) return action;
    }
    return null;
  }

  planBotAction(player, action, slot) {
    const validation = this.validatePlannedAction(player, action, slot);
    if (!validation.ok) return false;
    player.plannedActions[slot] = action;
    return true;
  }

  allPlayersReady() {
    return Array.from(this.players.values()).every((player) => player.phaseReady);
  }

  calculateGDI(player) {
    const resources = ['SILVER', 'MATERIALS', 'INFLUENCE']
      .reduce((total, resource) => (
        total + (Number.isFinite(player.resources?.[resource]) ? player.resources[resource] : 0)
      ), 0);
    const population = this.grid.flat().reduce(
      (total, tile) => total + (tile.ownerId === player.id ? tile.population || 0 : 0),
      0
    );
    return Math.floor(resources + population);
  }

  getState() {
    const publicOISession = this.oiSession
      ? ({
        id: this.oiSession.id,
        phase: this.oiSession.phase,
        meetingAfterRound: this.oiSession.meetingAfterRound,
        timeRemaining: this.oiSession.timeRemaining,
        proposals: this.oiSession.proposals,
        results: this.oiSession.results,
        votesSubmitted: Object.keys(this.oiSession.votes)
      })
      : null;
    return {
      grid: this.grid,
      players: Array.from(this.players.values(), (player) => ({
        ...player,
        gdiPoints: this.calculateGDI(player)
      })),
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      isPaused: this.isPaused,
      actionResolutionId: this.actionResolutionId,
      lastActionResolutions: this.lastActionResolutions,
      eventHistory: this.eventHistory,
      currentPhase: this.currentPhase,
      timeRemaining: this.timeRemaining,
      currentRound: this.currentRound,
      seed: this.seed,
      oiProposals: this.oiProposals,
      oiSession: publicOISession,
      oiPolicies: this.oiPolicies,
      activeDmzZones: this.activeDmzZones,
      nonAggressionPacts: this.nonAggressionPacts,
      freeTradeTreaties: this.freeTradeTreaties,
      treatyOffers: this.treatyOffers,
      bankFund: this.bankFund,
      bonds: this.bonds,
      activeConflicts: this.getActiveConflicts(),
      aggressions: this.aggressions,
      casusBelli: this.casusBelli
    };
  }
}
