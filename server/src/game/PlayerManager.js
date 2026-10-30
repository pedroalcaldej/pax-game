/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { ECONOMIC_POLICY, AVAILABLE_NATION_COLORS, LEGACY_NATION_NAMES, ACTION_SLOT_COUNT, NATIONS } from '../../../shared/Constants.js';
import { createEmptyActionSlots } from './GameStateUtils.js';

export const PlayerManager = {
  createNations() {
    NATIONS.forEach((nation) => {
      this.players.set(nation.id, {
        id: nation.id,
        nationId: nation.nationId,
        socketId: null,
        boundPlayerId: null,
        isDisconnected: false,
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
  },

  refreshBotColors() {
    const usedColors = new Set(
      Array.from(this.players.values())
        .filter((player) => !player.isBot)
        .map((player) => player.color)
    );
    const availableColors = AVAILABLE_NATION_COLORS.filter((color) => !usedColors.has(color));
    let nextColor = 0;
    for (const player of this.players.values()) {
      if (!player.isBot) continue;
      player.color = availableColors[nextColor % availableColors.length] || NATIONS[player.nationId].color;
      nextColor += 1;
    }
  },

  addPlayer(socketId, playerName, playerId, playerColor) {
    const id = playerId || socketId;

    for (const player of this.players.values()) {
      if (player.boundPlayerId === id) {
        player.socketId = socketId;
        player.isDisconnected = false;
        player.isBot = false;
        player.phaseReady = false;
        if (playerName && playerName !== 'alpha') {
          player.name = LEGACY_NATION_NAMES.get(playerName) || playerName;
        }
        if (AVAILABLE_NATION_COLORS.includes(playerColor)) {
          if (Array.from(this.players.values()).some((other) => (
            other !== player && !other.isBot && other.color === playerColor
          ))) return null;
          player.color = playerColor;
        }
        this.refreshBotColors();
        return player;
      }
    }

    for (const player of this.players.values()) {
      if (player.isBot) {
        player.boundPlayerId = id;
        player.socketId = socketId;
        player.isDisconnected = false;
        player.isBot = false;
        player.phaseReady = false;
        player.plannedActions = createEmptyActionSlots();
        if (playerName && playerName !== 'alpha') {
          player.name = LEGACY_NATION_NAMES.get(playerName) || playerName;
        }
        if (AVAILABLE_NATION_COLORS.includes(playerColor)) {
          if (Array.from(this.players.values()).some((other) => (
            other !== player && !other.isBot && other.color === playerColor
          ))) return null;
          player.color = playerColor;
        }
        this.refreshBotColors();
        return player;
      }
    }

    return null;
  },

  markPlayerDisconnected(socketId) {
    let disconnected = false;
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.socketId = null;
        player.isDisconnected = true;
        player.phaseReady = false;
        disconnected = true;
      }
    }
    return disconnected;
  },

  rejoinPlayer(socketId, userId) {
    const player = Array.from(this.players.values())
      .find((entry) => entry.boundPlayerId === userId);
    if (!player) return null;
    player.socketId = socketId;
    player.isDisconnected = false;
    player.isBot = false;
    player.phaseReady = false;
    this.refreshBotColors();
    return player;
  },

  leavePlayer(socketId, userId) {
    const player = Array.from(this.players.values()).find((entry) => (
      entry.boundPlayerId === userId && entry.socketId === socketId && !entry.isBot
    ));
    if (!player) return null;
    player.socketId = null;
    player.boundPlayerId = null;
    player.isDisconnected = false;
    player.isBot = true;
    player.phaseReady = false;
    player.name = NATIONS[player.nationId].name;
    this.refreshBotColors();
    return player;
  },

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
  },

  markPlayerReady(socketId, ready = true) {
    if (!this.gameStarted || this.currentPhase !== 2) {
      return { ok: false, message: 'Solo puedes marcarte listo durante la fase de planificación.' };
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
  },

  allPlayersReady() {
    return Array.from(this.players.values()).every((player) => player.phaseReady);
  },
};
