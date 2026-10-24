/**
 * server/src/game/GameState.js
 */

import { generateInitialGrid } from '../../../shared/MapGenerator.js';
import {
  ECONOMIC_POLICY,
  MAP_CONFIG,
  NATIONS,
  TERRAIN_TYPES
} from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';

export class GameState {
  constructor() {
    this.gridWidth = MAP_CONFIG.GRID_WIDTH;
    this.gridHeight = MAP_CONFIG.GRID_HEIGHT;
    this.players = new Map();
    this.gameStarted = false;
    this.currentPhase = 1;
    this.timeRemaining = 60;
    this.currentRound = 1;
    this.seed = Date.now();
    this.actionResolutionId = 0;
    this.lastActionResolutions = [];
    this.oiProposals = [];
    this.nextOIProposalId = 1;
    this.oiSession = null;
    this.oiPolicies = {
      armamentLimit: null,
      industryLimit: null
    };
    this.activeDmzZones = [];
    this.nonAggressionPacts = [];
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
        plannedActions: [null, null],
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
    if (!Number.isInteger(slot) || slot < 0 || slot > 1) {
      return { ok: false, message: 'Selecciona uno de los dos espacios de acción.' };
    }

    player.plannedActions ||= [null, null];
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
      MOVE_TROOPS: 'Mover tropas'
    };
    return names[type] || 'Acción';
  }

  validatePlannedAction(player, action, slot) {
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    const tile = this.grid[action.y]?.[action.x];
    if (!tile || tile.ownerId !== player.id) {
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
        if (!destination || (destination.ownerId != null && destination.ownerId !== player.id)) {
          return { ok: false, message: 'El destino debe ser neutral o pertenecer a tu país.' };
        }
        if (Math.abs(tile.x - destination.x) + Math.abs(tile.y - destination.y) !== 1) {
          return { ok: false, message: 'El destino debe ser una casilla terrestre adyacente.' };
        }
        if (destination.type !== TERRAIN_TYPES.TR && destination.type !== TERRAIN_TYPES.MPT) {
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
        if (!Number.isInteger(troops) || troops < 1 || troops > tile.troops - otherTroops) {
          return { ok: false, message: 'La cantidad de tropas supera las disponibles para planificar.' };
        }
        action.troops = troops;
        return { ok: true };
      }
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
      const plannedActions = player.plannedActions || [null, null];
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
      }
      player.plannedActions = [null, null];
    }
    return results;
  }

  resolveTroopMovement(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    if (
      !source
      || !destination
      || source.ownerId !== player.id
      || (destination.ownerId != null && destination.ownerId !== player.id)
      || (destination.type !== TERRAIN_TYPES.TR && destination.type !== TERRAIN_TYPES.MPT)
      || Math.abs(source.x - destination.x) + Math.abs(source.y - destination.y) !== 1
      || source.troops < action.troops
      || InternationalOrganizationEngine.isInActiveDmz(this, source?.x, source?.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination?.x, destination?.y)
    ) {
      return { ok: false, message: 'El movimiento ya no es válido o atraviesa una Zona Desmilitarizada.' };
    }
    source.troops -= action.troops;
    destination.troops = (destination.troops || 0) + action.troops;
    const claimed = destination.ownerId == null;
    if (claimed) {
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
    }
    return {
      ok: true,
      message: claimed ? 'Territorio neutral reclamado.' : 'Tropas trasladadas.',
      claimed
    };
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
      default:
        return { ok: false, message: 'Acción no reconocida.' };
    }
  }

  runBotDecisions({ resetReadiness = true } = {}) {
    for (const player of this.players.values()) {
      if (resetReadiness) player.phaseReady = false;
      if (!player.isBot) continue;
      if (!resetReadiness && player.phaseReady) continue;
      player.phaseReady = false;
      player.plannedActions = [null, null];
      player.taxRate = 0.15;

      const factoryTile = this.grid.flat().find((tile) => (
        tile.ownerId === player.id
        && [TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA].includes(tile.type)
        && !tile.building
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ));
      if (factoryTile) {
        this.planBotAction(player, {
          type: 'BUILD_FACTORY',
          x: factoryTile.x,
          y: factoryTile.y
        }, 0);
      }

      const troopLimit = this.oiPolicies.armamentLimit ?? 10;
      const currentTroops = InternationalOrganizationEngine.countTroops(this, player.id);
      const recruitTile = this.grid.flat().find((tile) => (
        tile.ownerId === player.id
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ));
      if (recruitTile && currentTroops < troopLimit) {
        const count = Math.min(
          troopLimit - currentTroops,
          Math.floor(player.resources.SILVER / 5),
          Math.floor(player.resources.MATERIALS / 2)
        );
        if (count > 0) {
          this.planBotAction(player, {
            type: 'RECRUIT_TROOP',
            x: recruitTile.x,
            y: recruitTile.y,
            count
          }, 1);
        }
      }
      player.phaseReady = true;
    }
  }

  planBotAction(player, action, slot) {
    const validation = this.validatePlannedAction(player, action, slot);
    if (validation.ok) player.plannedActions[slot] = action;
  }

  allPlayersReady() {
    return Array.from(this.players.values()).every((player) => player.phaseReady);
  }

  getState() {
    const publicOISession = this.oiSession
      ? ({
        id: this.oiSession.id,
        phase: this.oiSession.phase,
        meetingBeforeRound: this.oiSession.meetingBeforeRound,
        timeRemaining: this.oiSession.timeRemaining,
        proposals: this.oiSession.proposals,
        results: this.oiSession.results,
        votesSubmitted: Object.keys(this.oiSession.votes)
      })
      : null;
    return {
      grid: this.grid,
      players: Array.from(this.players.values()),
      gameStarted: this.gameStarted,
      actionResolutionId: this.actionResolutionId,
      lastActionResolutions: this.lastActionResolutions,
      currentPhase: this.currentPhase,
      timeRemaining: this.timeRemaining,
      currentRound: this.currentRound,
      seed: this.seed,
      oiProposals: this.oiProposals,
      oiSession: publicOISession,
      oiPolicies: this.oiPolicies,
      activeDmzZones: this.activeDmzZones,
      nonAggressionPacts: this.nonAggressionPacts,
      aggressions: this.aggressions,
      casusBelli: this.casusBelli
    };
  }
}
