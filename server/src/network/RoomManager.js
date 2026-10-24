/**
 * server/src/network/RoomManager.js
 */

import { GameState } from '../game/GameState.js';
import { PhaseManager } from '../game/PhaseManager.js';

export class Room {
  constructor(id, publishState) {
    this.id = id;
    this.publishState = publishState;
    this.gameState = new GameState();
    this.phaseManager = new PhaseManager(this.gameState, (state) => this.publishState(state));
  }

  start() {
    if (this.gameState.gameStarted) return false;
    this.gameState.gameStarted = true;
    this.phaseManager.startLoop();
    return true;
  }

  addPlayer(socketId, playerName) {
    const player = this.gameState.addPlayer(socketId, playerName);
    if (!player) return null;
    this.start();
    return player;
  }

  removePlayer(socketId) {
    return this.gameState.removePlayer(socketId);
  }

  markPlayerReady(socketId, ready) {
    const result = this.gameState.markPlayerReady(socketId, ready);
    if (!result.ok) return result;
    if (result.allReady) {
      this.phaseManager.finishDecisionPhase();
    } else {
      this.publishState(this.gameState.getState());
    }
    return result;
  }

  setPaused(socketId, paused) {
    const players = Array.from(this.gameState.players.values());
    const humans = players.filter((player) => !player.isBot && player.socketId);
    const caller = humans.find((player) => player.socketId === socketId);
    if (!caller || !this.gameState.gameStarted) {
      return { ok: false, message: 'No puedes pausar esta partida.' };
    }
    if (players.length !== 4 || humans.length !== 1) {
      return { ok: true, paused: this.gameState.isPaused, eligible: false };
    }
    const changed = this.phaseManager.setPaused(Boolean(paused));
    return { ok: true, paused: this.gameState.isPaused, eligible: true, changed };
  }

  enforcePauseEligibility() {
    const humans = Array.from(this.gameState.players.values())
      .filter((player) => !player.isBot && player.socketId);
    if (this.gameState.isPaused && humans.length !== 1) {
      this.phaseManager.setPaused(false);
    }
  }

  end() {
    const connectedPlayers = Array.from(this.gameState.players.values())
      .filter((player) => player.socketId)
      .map((player) => ({
        socketId: player.socketId,
        playerId: player.boundPlayerId,
        name: player.name
      }));
    this.phaseManager.stop();
    this.gameState = new GameState();
    for (const player of connectedPlayers) {
      this.gameState.addPlayer(player.socketId, player.name, player.playerId);
    }
    this.phaseManager = new PhaseManager(this.gameState, (state) => this.publishState(state));
    return this.gameState.getState();
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.publishState = null;
  }

  setStatePublisher(publishState) {
    this.publishState = publishState;
    for (const room of this.rooms.values()) {
      room.phaseManager.onPhaseChange = (state) => this.publishState(room, state);
    }
  }

  getOrCreateRoom(roomId = 'room-1') {
    if (!this.rooms.has(roomId)) {
      const room = new Room(roomId, (state) => {
        if (this.publishState) this.publishState(room, state);
      });
      this.rooms.set(roomId, room);
      console.log(`[RoomManager] Sala creada: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId) {
    this.rooms.get(roomId)?.phaseManager.stop();
    this.rooms.delete(roomId);
  }
}