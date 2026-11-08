import { countCountryTroops, countCountryFactories, getCountryLimitStatus } from '../../../shared/OILimits.js';
import {
  LAND_TERRAIN,
  ECONOMY,
  OI_RESOLUTIONS,
  OI_RESOLUTION_DURATION_ROUNDS,
  TIMINGS
} from '../../../shared/Constants.js';

export const OI_RESOLUTION_NAMES = {
  [OI_RESOLUTIONS.ARMAMENT_LIMIT]: `Límites de Armamento (máximo ${ECONOMY.OI_LIMITS.TROOPS} tropas)`,
  [OI_RESOLUTIONS.INDUSTRY_LIMIT]: `Límites de Industria (máximo ${ECONOMY.OI_LIMITS.FACTORIES} fábricas)`,
  [OI_RESOLUTIONS.DEMILITARIZED_ZONE]: 'Zona Desmilitarizada (ZDM)',
  [OI_RESOLUTIONS.CONDITIONAL_SUBSIDY]: `Subsidios Condicionados (+${ECONOMY.COSTS.OI_SUBSIDY_SILVER} de plata)`
};

const VALID_RESOLUTIONS = new Set(Object.values(OI_RESOLUTIONS));
export class InternationalOrganizationEngine {
  static propose(gameState, socketId, proposal) {
    const player = proposal?.playerId
      ? gameState.players.get(proposal.playerId)
      : Array.from(gameState.players.values()).find(
        (entry) => entry.socketId === socketId && !entry.isBot
      );
    if (!player) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (
      !gameState.gameStarted
      || gameState.currentPhase !== 2
      || gameState.oiSession?.phase === 'voting'
    ) {
      return { ok: false, message: 'Solo puedes proponer resoluciones durante la planificación, antes de la próxima reunión de la OI.' };
    }
    if (!proposal || !VALID_RESOLUTIONS.has(proposal.type)) {
      return { ok: false, message: 'La resolución seleccionada no está disponible.' };
    }
    if (gameState.oiProposals.some((entry) => entry.type === proposal.type)) {
      return {
        ok: false,
        message: 'Esta resolución ya fue propuesta para la próxima reunión de la OI; solo puede votarse una vez por reunión.'
      };
    }
    if (player.resources.INFLUENCE < ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE) {
      return { ok: false, message: `Necesitas ${ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE} puntos de Influencia para proponer una resolución.` };
    }

    let target = null;
    if (proposal.type === OI_RESOLUTIONS.DEMILITARIZED_ZONE) {
      const { x, y } = proposal;
      if (
        !Number.isInteger(x)
        || !Number.isInteger(y)
        || x < 0
        || y < 0
        || x >= gameState.gridWidth
        || y >= gameState.gridHeight
      ) {
        return { ok: false, message: 'Selecciona una casilla válida del mapa para proponer la ZDM.' };
      }
      target = { x, y };
    }

    player.resources.INFLUENCE -= ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE;
    const sequence = gameState.nextOIProposalId++;
    const entry = {
      id: `oi-proposal-${sequence}`,
      type: proposal.type,
      name: OI_RESOLUTION_NAMES[proposal.type],
      proposerId: player.id,
      proposerName: player.name,
      sequence,
      ...(target ? { target } : {})
    };
    gameState.oiProposals.push(entry);
    gameState.recordEvent(`${player.name} propuso: ${entry.name}${target ? ` en (${target.x}, ${target.y})` : ''}.`);
    return { ok: true, message: `Resolución propuesta: ${entry.name}. Se descontaron ${ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE} puntos de Influencia.` };
  }

  static startSession(gameState) {
    const nextRound = gameState.currentRound;
    this.expireResolutionsBeforeRound(gameState);
    gameState.expireTreatiesAfterRound(nextRound - 1);
    const seenResolutionTypes = new Set();
    const selected = [...gameState.oiProposals]
      .sort((left, right) => left.sequence - right.sequence)
      .filter((proposal) => {
        if (seenResolutionTypes.has(proposal.type)) return false;
        seenResolutionTypes.add(proposal.type);
        return true;
      })
      .slice(0, 3)
      .map((proposal) => {
        if (proposal.type !== OI_RESOLUTIONS.CONDITIONAL_SUBSIDY) return { ...proposal, votes: [] };
        const beneficiary = this.getLowestGDIPlayer(gameState);
        return { ...proposal, votes: [], beneficiaryId: beneficiary?.id,
          beneficiaryName: beneficiary?.name,
          name: `${OI_RESOLUTION_NAMES[proposal.type]} para ${beneficiary?.name || 'país no disponible'}` };
      });
    gameState.oiProposals = [];
    gameState.oiSession = {
      id: `oi-session-${gameState.currentRound}`,
      phase: selected.length ? 'voting' : 'complete',
      meetingAfterRound: gameState.currentRound,
      timeRemaining: selected.length ? gameState.settings.oiMeetingDuration : 0,
      proposals: selected,
      votes: {},
      botVoterIds: [],
      results: selected.length ? null : []
    };

    if (selected.length) {
      for (const player of gameState.players.values()) {
        if (player.isBot) {
          gameState.oiSession.votes[player.id] = this.getBotBallot(gameState, player, selected);
          gameState.oiSession.botVoterIds.push(player.id);
          gameState.recordEvent(`${player.name} (bot) registró su papeleta de la OI.`);
        }
      }
    } else {
      gameState.recordEvent('La reunión de la OI terminó: no hay mociones para votar.');
      gameState.aggressions = [];
      gameState.casusBelli = [];
    }
    gameState.recordEvent(`Comenzó la sesión de la OI de la ronda ${gameState.currentRound}.`);
    return gameState.oiSession;
  }

  static submitVote(gameState, socketId, ballot) {
    const session = gameState.oiSession;
    const player = Array.from(gameState.players.values()).find(
      (entry) => entry.socketId === socketId && !entry.isBot
    );
    if (!session || session.phase !== 'voting') {
      return { ok: false, message: 'No hay una votación de la OI abierta.' };
    }
    if (!player) return { ok: false, message: 'No tienes un país activo en esta partida.' };
    if (session.votes[player.id]) {
      return { ok: false, message: 'Ya registraste tu papeleta para esta sesión.' };
    }
    if (!Array.isArray(ballot) || ballot.length !== session.proposals.length) {
      return { ok: false, message: 'Debes emitir un voto para cada resolución de la sesión.' };
    }

    const proposalIds = new Set(session.proposals.map((proposal) => proposal.id));
    const seen = new Set();
    let totalWager = 0;
    for (const vote of ballot) {
      if (
        !vote
        || !proposalIds.has(vote.proposalId)
        || seen.has(vote.proposalId)
        || !['FOR', 'AGAINST', 'ABSTAIN'].includes(vote.choice)
        || !Number.isInteger(vote.wager)
        || vote.wager < 0
      ) {
        return { ok: false, message: 'La papeleta contiene un voto o una apuesta no válida.' };
      }
      seen.add(vote.proposalId);
      totalWager += vote.wager;
    }
    if (totalWager > player.resources.INFLUENCE) {
      return { ok: false, message: 'La apuesta total supera tu Influencia disponible.' };
    }

    session.votes[player.id] = ballot.map((vote) => ({ ...vote }));
    session.botVoterIds = session.botVoterIds.filter((id) => id !== player.id);
    gameState.recordEvent(`${player.name} registró su papeleta de la OI.`);
    return {
      ok: true,
      message: 'Votos de la OI registrados.',
      allVoted: this.haveAllPlayersVoted(gameState)
    };
  }

  static haveAllPlayersVoted(gameState) {
    const session = gameState.oiSession;
    if (!session || session.phase !== 'voting') return false;
    return Array.from(gameState.players.values())
      .filter((player) => !player.isBot && player.socketId)
      .every((player) => Array.isArray(session.votes[player.id]));
  }

  static getBotBallot(gameState, player, proposals) {
    let remainingInfluence = player.resources.INFLUENCE;
    return proposals.map((proposal) => {
      const harmful = this.isHarmfulToPlayer(gameState, player, proposal);
      const beneficial = this.isBeneficialToPlayer(gameState, player, proposal);
      if (!harmful && !beneficial) {
        return { proposalId: proposal.id, choice: 'ABSTAIN', wager: 0 };
      }
      const wager = Math.floor(remainingInfluence * ECONOMY.OI_BOT_WAGER_SHARE);
      remainingInfluence -= wager;
      return {
        proposalId: proposal.id,
        choice: harmful ? 'AGAINST' : 'FOR',
        wager
      };
    });
  }

  static isHarmfulToPlayer(gameState, player, proposal) {
    if (proposal.type === OI_RESOLUTIONS.ARMAMENT_LIMIT) {
      return this.countTroops(gameState, player.id) > ECONOMY.OI_LIMITS.TROOPS;
    }
    if (proposal.type === OI_RESOLUTIONS.INDUSTRY_LIMIT) {
      return this.countFactories(gameState, player.id) > ECONOMY.OI_LIMITS.FACTORIES;
    }
    if (proposal.type === OI_RESOLUTIONS.DEMILITARIZED_ZONE) {
      return gameState.grid.flat().some((tile) => (
        tile.ownerId === player.id
        && tile.troops > 0
        && this.isWithinZone(tile.x, tile.y, proposal.target)
      ));
    }
    return false;
  }

  static isBeneficialToPlayer(gameState, player, proposal) {
    if (proposal.type !== OI_RESOLUTIONS.CONDITIONAL_SUBSIDY) return false;
    return (proposal.beneficiaryId || this.getLowestGDIPlayer(gameState)?.id) === player.id;
  }

  static finishSession(gameState) {
    const session = gameState.oiSession;
    if (!session || session.phase !== 'voting') return false;

    for (const [playerId, ballot] of Object.entries(session.votes)) {
      const player = gameState.players.get(playerId);
      if (!player) continue;
      const totalWager = ballot.reduce((sum, vote) => sum + vote.wager, 0);
      player.resources.INFLUENCE = Math.max(0, player.resources.INFLUENCE - totalWager);
    }

    session.results = session.proposals.map((proposal) => {
      const votes = Object.entries(session.votes).flatMap(([playerId, ballot]) => (
        ballot
          .filter((vote) => vote.proposalId === proposal.id)
          .map((vote) => ({ ...vote, playerId }))
      ));
      const forInfluence = votes
        .filter((vote) => vote.choice === 'FOR')
        .reduce((sum, vote) => sum + vote.wager, 0);
      const againstInfluence = votes
        .filter((vote) => vote.choice === 'AGAINST')
        .reduce((sum, vote) => sum + vote.wager, 0);
      const passed = forInfluence > againstInfluence;
      const result = {
        proposalId: proposal.id,
        name: proposal.name,
        ...(proposal.beneficiaryId ? { beneficiaryId: proposal.beneficiaryId, beneficiaryName: proposal.beneficiaryName } : {}),
        forInfluence,
        againstInfluence,
        passed,
        message: passed ? 'Aprobada' : 'Rechazada'
      };
      gameState.recordEvent(
        `${result.name}: ${result.message.toLowerCase()} (a favor ${result.forInfluence}, en contra ${result.againstInfluence}).`
      );
      if (passed) this.applyResolution(gameState, proposal, votes);
      return result;
    });
    session.phase = 'complete';
    session.timeRemaining = 0;
    gameState.aggressions = [];
    gameState.casusBelli = [];
    return true;
  }

  static applyResolution(gameState, proposal, votes) {
    this.expireResolutionsBeforeRound(gameState);
    switch (proposal.type) {
      case OI_RESOLUTIONS.INDUSTRY_LIMIT:
        this.activateLimit(gameState, 'industryLimit', ECONOMY.OI_LIMITS.FACTORIES);
        break;
      case OI_RESOLUTIONS.ARMAMENT_LIMIT:
        this.activateLimit(gameState, 'armamentLimit', ECONOMY.OI_LIMITS.TROOPS);
        break;
      case OI_RESOLUTIONS.DEMILITARIZED_ZONE: {
        const zone = {
          ...proposal.target,
          expiresAfterRound: gameState.currentRound + OI_RESOLUTION_DURATION_ROUNDS
        };
        gameState.activeDmzZones.push(zone);
        this.evacuateZone(gameState, zone);
        break;
      }
      case OI_RESOLUTIONS.CONDITIONAL_SUBSIDY: {
        const beneficiary = proposal.beneficiaryId
          ? gameState.players.get(proposal.beneficiaryId) : this.getLowestGDIPlayer(gameState);
        if (!beneficiary) break;
        beneficiary.resources.SILVER += ECONOMY.COSTS.OI_SUBSIDY_SILVER;
        gameState.recordEvent(`${beneficiary.name} recibió un Subsidio Condicionado de ${ECONOMY.COSTS.OI_SUBSIDY_SILVER} de plata de la OI.`);
        for (const vote of votes) {
          if (vote.choice !== 'FOR' || vote.playerId === beneficiary.id) continue;
          gameState.nonAggressionPacts.push({
            playerIds: [beneficiary.id, vote.playerId].sort(),
            expiresAfterRound: gameState.currentRound + OI_RESOLUTION_DURATION_ROUNDS
          });
        }
        break;
      }
      default:
        throw new Error(`Resolución OI desconocida: ${proposal.type}`);
    }
  }

  static evacuateZone(gameState, zone) {
    const zones = gameState.activeDmzZones;
    for (const tile of gameState.grid.flat()) {
      if (tile.troops <= 0 || !this.isWithinZone(tile.x, tile.y, zone)) continue;
      const visitors = tile.visitingTroops || {};
      const visitorCount = Object.values(visitors).reduce((sum, count) => sum + count, 0);
      const troopGroups = [];
      if (tile.ownerId != null && tile.troops > visitorCount) {
        troopGroups.push([tile.ownerId, tile.troops - visitorCount]);
      }
      for (const [playerId, count] of Object.entries(visitors)) {
        troopGroups.push([playerId, count]);
      }
      for (const [playerId, count] of troopGroups) {
        const destination = gameState.grid.flat()
          .filter((candidate) => (
            candidate.ownerId === playerId
            && LAND_TERRAIN.has(candidate.type)
            && !zones.some((activeZone) => this.isWithinZone(candidate.x, candidate.y, activeZone))
          ))
          .sort((left, right) => (
            Math.abs(left.x - tile.x) + Math.abs(left.y - tile.y)
            - Math.abs(right.x - tile.x) - Math.abs(right.y - tile.y)
          ))[0];
        if (destination) destination.troops = (destination.troops || 0) + count;
      }
      tile.troops = 0;
      delete tile.visitingTroops;
    }
  }

  static getLowestGDIPlayer(gameState) {
    return Array.from(gameState.players.values())
      .sort((left, right) => (
        gameState.calculateGDI(left) - gameState.calculateGDI(right)
        || left.nationId - right.nationId
      ))[0];
  }

  static activateLimit(gameState, policy, limit) {
    const expiresAfterRound = gameState.currentRound + OI_RESOLUTION_DURATION_ROUNDS;
    if (gameState.oiPolicies[policy] != null) {
      // A new vote renews the duration, but does not forgive ongoing violations.
      gameState.oiPolicies[`${policy}ExpiresAfterRound`] = expiresAfterRound;
      gameState.recordEvent(`La OI renovó el límite de ${policy === 'armamentLimit' ? 'tropas' : 'fábricas'} hasta el cierre de la ronda ${expiresAfterRound}, sin reiniciar la gracia.`,
        { category: 'oi-limit-approved', policy, limit, expiresAfterRound });
      return;
    }
    gameState.oiPolicies[`${policy}ExpiresAfterRound`] = expiresAfterRound;
    gameState.oiPolicies[policy] = limit;
    const finesFromRound = gameState.currentRound + ECONOMY.OI_LIMITS.GRACE_ROUNDS;
    gameState.oiPolicies[`${policy}FinesFromRound`] = finesFromRound;
    gameState.recordEvent(
      `La OI aprobó un máximo de ${limit} ${policy === 'armamentLimit' ? 'tropas' : 'fábricas'} por país. Hay ${ECONOMY.OI_LIMITS.GRACE_ROUNDS} ronda de gracia: regulariza antes del cierre de la ronda ${finesFromRound}. Las multas se cobran en ese cierre y cada ronda posterior mientras la resolución esté vigente, hasta el cierre de la ronda ${expiresAfterRound}.`,
      { category: 'oi-limit-approved', policy, limit, finesFromRound, expiresAfterRound }
    );
  }

  static expireResolutionsBeforeRound(gameState) {
    for (const policy of ['armamentLimit', 'industryLimit']) {
      if (gameState.oiPolicies[policy] == null) continue;
      // Older saved games did not store expiry. Recover the approval round
      // from the grace deadline when available, otherwise start the duration now.
      if (gameState.oiPolicies[`${policy}ExpiresAfterRound`] == null) {
        const deadline = gameState.oiPolicies[`${policy}FinesFromRound`];
        const approvedRound = deadline == null ? gameState.currentRound : deadline - ECONOMY.OI_LIMITS.GRACE_ROUNDS;
        gameState.oiPolicies[`${policy}ExpiresAfterRound`] = approvedRound + OI_RESOLUTION_DURATION_ROUNDS;
      }
      const expiresAfterRound = gameState.oiPolicies[`${policy}ExpiresAfterRound`];
      if (expiresAfterRound >= gameState.currentRound) continue;
      gameState.oiPolicies[policy] = null;
      delete gameState.oiPolicies[`${policy}FinesFromRound`];
      delete gameState.oiPolicies[`${policy}ExpiresAfterRound`];
      gameState.recordEvent(`Expiró el límite de ${policy === 'armamentLimit' ? 'tropas' : 'fábricas'} de la OI; dejan de aplicarse sus restricciones y multas.`,
        { category: 'oi-resolution-expired', policy, expiresAfterRound });
    }
    gameState.activeDmzZones = gameState.activeDmzZones.filter((zone) => {
      if (zone.expiresAfterRound >= gameState.currentRound) return true;
      gameState.recordEvent(`Expiró la Zona Desmilitarizada de la OI en (${zone.x}, ${zone.y}).`,
        { category: 'oi-resolution-expired', x: zone.x, y: zone.y, expiresAfterRound: zone.expiresAfterRound });
      return false;
    });
  }

  static enforceLimitsAtRoundEnd(gameState) {
    this.expireResolutionsBeforeRound(gameState);
    const policies = gameState.oiPolicies;
    if (policies.armamentLimit == null && policies.industryLimit == null) return;
    if (policies.lastFineRound === gameState.currentRound) return;
    policies.lastFineRound = gameState.currentRound;
    for (const player of gameState.players.values()) {
      if (player.isEliminated) continue;
      const status = getCountryLimitStatus(gameState.grid, player.id, policies);
      const troopFine = policies.armamentLimit != null
        && gameState.currentRound >= (policies.armamentLimitFinesFromRound ?? 0) ? status.troopFine : 0;
      const factoryFine = policies.industryLimit != null
        && gameState.currentRound >= (policies.industryLimitFinesFromRound ?? 0) ? status.factoryFine : 0;
      const fine = troopFine + factoryFine;
      if (!fine) continue;
      // Fines remain collectible even when the country has spent all its silver.
      player.resources.SILVER -= fine;
      gameState.recordEvent(
        `${player.name} recibió una multa de la OI de ${fine} de plata: ${troopFine} por ${status.excessTroops} tropas excedentes y ${factoryFine} por ${status.excessFactories} fábricas excedentes.${player.resources.SILVER < 0 ? ' El saldo negativo queda como deuda.' : ''}`,
        { category: 'oi-limit-fine', playerId: player.id, round: gameState.currentRound,
          troopFine, factoryFine, fine, excessTroops: status.excessTroops, excessFactories: status.excessFactories }
      );
    }
  }

  static countTroops(gameState, playerId) {
    return countCountryTroops(gameState.grid, playerId);
  }

  static countFactories(gameState, playerId) {
    return countCountryFactories(gameState.grid, playerId);
  }

  static isWithinZone(x, y, zone) {
    return Math.abs(x - zone.x) <= 2 && Math.abs(y - zone.y) <= 2;
  }

  static isInActiveDmz(gameState, x, y) {
    return gameState.activeDmzZones.some((zone) => (
      zone.expiresAfterRound >= gameState.currentRound && this.isWithinZone(x, y, zone)
    ));
  }

  static arePlayersBoundByPact(gameState, firstPlayerId, secondPlayerId) {
    return gameState.nonAggressionPacts.some((pact) => (
      pact.expiresAfterRound >= gameState.currentRound
      && pact.playerIds.includes(firstPlayerId)
      && pact.playerIds.includes(secondPlayerId)
    ));
  }
}
