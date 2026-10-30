/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { GAME_PHASES, TREATY_TYPES } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';
import { TREATY_DURATION_ROUNDS } from './GameStateUtils.js';

export const DiplomacyEngine = {
  proposeTreaty(socketId, treaty = {}) {
    const { recipientId, type } = treaty || {};
    const proposer = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!proposer) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes proponer tratados durante una partida activa.' };
    }
    if (this.currentPhase !== GAME_PHASES.PHASE_2_DECISIONS) {
      return { ok: false, message: 'Los tratados solo pueden gestionarse durante la planificación.' };
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
  },

  respondToTreaty(socketId, offerId, accepted) {
    const recipient = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!recipient) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes responder a tratados durante una partida activa.' };
    }
    if (this.currentPhase !== GAME_PHASES.PHASE_2_DECISIONS) {
      return { ok: false, message: 'Los tratados solo pueden gestionarse durante la planificación.' };
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
  },

  cancelTreatyOffer(socketId, offerId) {
    const proposer = Array.from(this.players.values()).find(
      (player) => player.socketId === socketId && !player.isBot
    );
    if (!proposer) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (!this.gameStarted || this.gameOver) {
      return { ok: false, message: 'Solo puedes cancelar propuestas durante una partida activa.' };
    }
    if (this.currentPhase !== GAME_PHASES.PHASE_2_DECISIONS) {
      return { ok: false, message: 'Los tratados solo pueden gestionarse durante la planificación.' };
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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  areTreatyPartners(firstPlayerId, secondPlayerId, type) {
    const treaties = type === TREATY_TYPES.FREE_TRADE
      ? this.freeTradeTreaties
      : this.nonAggressionPacts;
    return treaties.some((treaty) => (
      treaty.expiresAfterRound >= this.currentRound
      && treaty.playerIds.includes(firstPlayerId)
      && treaty.playerIds.includes(secondPlayerId)
    ));
  },

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
  },

  getTreatyName(type) {
    return type === TREATY_TYPES.NON_AGGRESSION_PACT
      ? 'Pacto de No Agresión'
      : 'Tratado de Libre Comercio';
  },
};
