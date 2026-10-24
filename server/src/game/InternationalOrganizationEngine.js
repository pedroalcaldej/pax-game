import {
  LAND_TERRAIN,
  OI_RESOLUTIONS,
  TIMINGS
} from '../../../shared/Constants.js';

export const OI_RESOLUTION_NAMES = {
  [OI_RESOLUTIONS.ARMAMENT_LIMIT]: 'Límites de Armamento (máximo 10 tropas)',
  [OI_RESOLUTIONS.INDUSTRY_LIMIT]: 'Límites de Industria (máximo 10 fábricas)',
  [OI_RESOLUTIONS.DEMILITARIZED_ZONE]: 'Zona Desmilitarizada (ZDM)',
  [OI_RESOLUTIONS.CONDITIONAL_SUBSIDY]: 'Subsidios Condicionados (+25 de plata)'
};

const VALID_RESOLUTIONS = new Set(Object.values(OI_RESOLUTIONS));
export class InternationalOrganizationEngine {
  static propose(gameState, socketId, proposal) {
    const player = Array.from(gameState.players.values()).find(
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
    if (player.resources.INFLUENCE < 2) {
      return { ok: false, message: 'Necesitas 2 puntos de Influencia para proponer una resolución.' };
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

    player.resources.INFLUENCE -= 2;
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
    return { ok: true, message: `Resolución propuesta: ${entry.name}. Se descontaron 2 puntos de Influencia.` };
  }

  static startSession(gameState) {
    const nextRound = gameState.currentRound;
    gameState.activeDmzZones = gameState.activeDmzZones.filter(
      (zone) => zone.expiresAfterRound >= nextRound
    );
    gameState.nonAggressionPacts = gameState.nonAggressionPacts.filter(
      (pact) => pact.expiresAfterRound >= nextRound
    );
    const selected = [...gameState.oiProposals]
      .sort((left, right) => left.sequence - right.sequence)
      .slice(0, 3)
      .map((proposal) => ({ ...proposal, votes: [] }));
    gameState.oiProposals = [];
    gameState.oiSession = {
      id: `oi-session-${gameState.currentRound}`,
      phase: 'voting',
      meetingAfterRound: gameState.currentRound,
      timeRemaining: TIMINGS.DECISION_PHASE_DURATION,
      proposals: selected,
      votes: {},
      botVoterIds: [],
      results: null
    };

    for (const player of gameState.players.values()) {
      if (player.isBot) {
        gameState.oiSession.votes[player.id] = this.getBotBallot(gameState, player, selected);
        gameState.oiSession.botVoterIds.push(player.id);
        gameState.recordEvent(`${player.name} (bot) registró su papeleta de la OI.`);
      }
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
      const wager = Math.floor(remainingInfluence * 0.5);
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
      return this.countTroops(gameState, player.id) > 10;
    }
    if (proposal.type === OI_RESOLUTIONS.INDUSTRY_LIMIT) {
      return this.countFactories(gameState, player.id) > 10;
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
    return this.getLowestGDIPlayer(gameState)?.id === player.id;
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
    switch (proposal.type) {
      case OI_RESOLUTIONS.ARMAMENT_LIMIT:
        gameState.oiPolicies.armamentLimit = 10;
        break;
      case OI_RESOLUTIONS.INDUSTRY_LIMIT:
        gameState.oiPolicies.industryLimit = 10;
        break;
      case OI_RESOLUTIONS.DEMILITARIZED_ZONE: {
        const zone = {
          ...proposal.target,
          expiresAfterRound: gameState.currentRound + 4
        };
        gameState.activeDmzZones.push(zone);
        this.evacuateZone(gameState, zone);
        break;
      }
      case OI_RESOLUTIONS.CONDITIONAL_SUBSIDY: {
        const beneficiary = this.getLowestGDIPlayer(gameState);
        if (!beneficiary) break;
        beneficiary.resources.SILVER += 25;
        for (const vote of votes) {
          if (vote.choice !== 'FOR' || vote.playerId === beneficiary.id) continue;
          gameState.nonAggressionPacts.push({
            playerIds: [beneficiary.id, vote.playerId].sort(),
            expiresAfterRound: gameState.currentRound + 4
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

  static countTroops(gameState, playerId) {
    return gameState.grid.flat().reduce(
      (sum, tile) => {
        const visitors = tile.visitingTroops || {};
        if (tile.ownerId === playerId) {
          const foreignTroops = Object.values(visitors)
            .reduce((total, count) => total + count, 0);
          return sum + Math.max(0, (tile.troops || 0) - foreignTroops);
        }
        return sum + (visitors[playerId] || 0);
      },
      0
    );
  }

  static countFactories(gameState, playerId) {
    return gameState.grid.flat().reduce(
      (sum, tile) => sum + (tile.ownerId === playerId && tile.building === 'FACTORY'
        ? tile.factoriesCount || 1
        : 0),
      0
    );
  }

  static isWithinZone(x, y, zone) {
    return Math.abs(x - zone.x) <= 2 && Math.abs(y - zone.y) <= 2;
  }

  static isInActiveDmz(gameState, x, y) {
    return gameState.activeDmzZones.some((zone) => this.isWithinZone(x, y, zone));
  }

  static arePlayersBoundByPact(gameState, firstPlayerId, secondPlayerId) {
    return gameState.nonAggressionPacts.some((pact) => (
      pact.playerIds.includes(firstPlayerId) && pact.playerIds.includes(secondPlayerId)
    ));
  }
}
