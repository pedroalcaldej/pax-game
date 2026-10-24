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
  TERRAIN_TYPES
} from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';

const createEmptyActionSlots = () => Array(ACTION_SLOT_COUNT).fill(null);

export class GameState {
  constructor() {
    this.gridWidth = MAP_CONFIG.GRID_WIDTH;
    this.gridHeight = MAP_CONFIG.GRID_HEIGHT;
    this.players = new Map();
    this.gameStarted = false;
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
        if (
          destination.ownerId != null
          && destination.ownerId !== player.id
          && InternationalOrganizationEngine.arePlayersBoundByPact(
            this,
            player.id,
            destination.ownerId
          )
        ) {
          return { ok: false, message: 'El Pacto de No Agresión impide atacar a este país.' };
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
    if (
      destination.ownerId != null
      && destination.ownerId !== player.id
      && InternationalOrganizationEngine.arePlayersBoundByPact(
        this,
        player.id,
        destination.ownerId
      )
    ) {
      return { ok: false, message: 'El Pacto de No Agresión impide atacar a este país.' };
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
          message: attackerSurvivors
            ? `Ataque rechazado: ${player.name} pierde ${action.troops - attackerSurvivors} tropas y se retira.`
            : `Ataque rechazado: ${player.name} pierde todas sus tropas y se retira.`,
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
        message: defenderSurvivors
          ? `Victoria de ${player.name}: territorio conquistado; ${defenderSurvivors} tropas enemigas supervivientes permanecen en la casilla.`
          : `Victoria de ${player.name}: territorio conquistado; la guarnición fue derrotada.`,
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
      aggressions: this.aggressions,
      casusBelli: this.casusBelli
    };
  }
}
