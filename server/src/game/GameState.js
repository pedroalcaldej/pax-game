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
    this.pendingMovements = [];

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
        return player;
      }
    }

    for (const player of this.players.values()) {
      if (player.isBot) {
        player.boundPlayerId = id;
        player.socketId = socketId;
        player.isBot = false;
        if (playerName && playerName !== 'Nación Alpha') {
          player.name = playerName;
        }
        return player;
      }
    }

    return null;
  }

  removePlayer(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.socketId = null;
        player.boundPlayerId = null;
        player.isBot = true;
        player.name = NATIONS[player.nationId].name;
      }
    }
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

  performPlayerAction(socketId, action) {
    const player = Array.from(this.players.values()).find((entry) => entry.socketId === socketId);
    if (!player) return { ok: false, message: 'No tienes un país asignado.' };
    if (!this.gameStarted) return { ok: false, message: 'La partida todavía no ha comenzado.' };
    if (this.currentPhase !== 2) return { ok: false, message: 'Las acciones solo están disponibles en la fase de planificación.' };
    if (!action || typeof action.type !== 'string') {
      return { ok: false, message: 'La acción no es válida.' };
    }

    const { x, y } = action;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    const tile = this.grid[y]?.[x];

    if (action.type === 'MOVE_TROOPS') {
      return this.queueTroopMovement(player, tile, action);
    }

    if (!tile || tile.ownerId !== player.id) {
      return { ok: false, message: 'Solo puedes actuar sobre tu propio territorio.' };
    }

    return this.applyPlayerAction(player, tile, action.type);
  }

  queueTroopMovement(player, source, action) {
    const { targetX, targetY } = action;
    const destination = this.grid[targetY]?.[targetX];
    const troops = action.troops ?? source?.troops;
    if (!source || source.ownerId !== player.id) {
      return { ok: false, message: 'El origen debe ser una casilla propia.' };
    }
    if (!destination || (destination.ownerId != null && destination.ownerId !== player.id)) {
      return { ok: false, message: 'El destino debe ser neutral o pertenecer a tu país.' };
    }
    if (Math.abs(source.x - destination.x) + Math.abs(source.y - destination.y) !== 1) {
      return { ok: false, message: 'Solo puedes mover tropas a una casilla terrestre adyacente.' };
    }
    if (destination.type !== TERRAIN_TYPES.TR && destination.type !== TERRAIN_TYPES.MPT) {
      return { ok: false, message: 'Las tropas terrestres solo pueden avanzar sobre tierra neutral.' };
    }
    if (!Number.isInteger(troops) || troops < 1 || troops > (source.troops || 0)) {
      return { ok: false, message: 'La cantidad de tropas no es válida.' };
    }
    const reservedTroops = this.pendingMovements
      .filter((movement) => (
        movement.playerId === player.id
        && movement.sourceX === source.x
        && movement.sourceY === source.y
      ))
      .reduce((total, movement) => total + movement.troops, 0);
    if (troops > (source.troops || 0) - reservedTroops) {
      return { ok: false, message: 'Ya ordenaste mover las tropas disponibles en esta casilla.' };
    }
    if (this.pendingMovements.some((movement) => (
      movement.targetX === destination.x && movement.targetY === destination.y
    ))) {
      return { ok: false, message: 'Ya hay un movimiento ordenado hacia esa casilla.' };
    }

    this.pendingMovements.push({
      playerId: player.id,
      sourceX: source.x,
      sourceY: source.y,
      targetX: destination.x,
      targetY: destination.y,
      troops
    });
    return { ok: true, message: `${troops} tropas ordenadas hacia (${destination.x}, ${destination.y}); el movimiento se resolverá al final de la fase 4.` };
  }

  resolvePendingMovements() {
    const results = [];
    for (const movement of this.pendingMovements) {
      const player = this.players.get(movement.playerId);
      const source = this.grid[movement.sourceY]?.[movement.sourceX];
      const destination = this.grid[movement.targetY]?.[movement.targetX];
      if (
        !player
        || !source
        || !destination
        || source.ownerId !== player.id
        || (destination.ownerId != null && destination.ownerId !== player.id)
        || source.troops < movement.troops
      ) {
        results.push({ ok: false, movement });
        continue;
      }

      source.troops -= movement.troops;
      destination.troops = (destination.troops || 0) + movement.troops;
      const claimed = destination.ownerId == null;
      if (claimed) {
        destination.ownerId = player.id;
        destination.nationId = player.nationId;
      }
      results.push({ ok: true, claimed, playerId: player.id, x: destination.x, y: destination.y });
    }
    this.pendingMovements = [];
    return results;
  }

  applyPlayerAction(player, tile, type) {
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
        const cost = tile.type === TERRAIN_TYPES.MPT || tile.type === TERRAIN_TYPES.MPA ? 5 : 10;
        if (resources.SILVER < cost) return { ok: false, message: `Necesitas ${cost} de plata.` };
        resources.SILVER -= cost;
        tile.type = isWater ? TERRAIN_TYPES.FA : TERRAIN_TYPES.FT;
        tile.building = 'FACTORY';
        tile.factoriesCount = 1;
        return { ok: true, message: 'Fábrica construida.' };
      }
      case 'RECRUIT_TROOP': {
        if (resources.SILVER < 5 || resources.MATERIALS < 2) {
          return { ok: false, message: 'Necesitas 5 de plata y 2 materiales para reclutar.' };
        }
        resources.SILVER -= 5;
        resources.MATERIALS -= 2;
        tile.troops = (tile.troops || 0) + 1;
        return { ok: true, message: 'Tropa reclutada.' };
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

  runBotDecisions() {
    for (const player of this.players.values()) {
      if (!player.isBot) continue;
      const taxChoices = [0.15, 0.2, 0.25];
      player.taxRate = taxChoices[(this.currentRound + player.nationId) % taxChoices.length];

      const ownedTile = this.grid.flat().find((tile) => (
        tile.ownerId === player.id
        && (tile.type === TERRAIN_TYPES.TR || tile.type === TERRAIN_TYPES.MPT)
        && !tile.building
      ));
      if (ownedTile && player.resources.SILVER >= 10) {
        this.applyPlayerAction(player, ownedTile, 'BUILD_FACTORY');
      }
    }
  }

  getState() {
    return {
      grid: this.grid,
      players: Array.from(this.players.values()),
      gameStarted: this.gameStarted,
      currentPhase: this.currentPhase,
      timeRemaining: this.timeRemaining,
      currentRound: this.currentRound,
      seed: this.seed
    };
  }
}
