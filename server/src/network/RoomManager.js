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
    this.gameState.recordEvent('La partida ha comenzado.');
    this.phaseManager.startLoop();
    return true;
  }

  addPlayer(socketId, playerName) {
    return this.gameState.addPlayer(socketId, playerName);
  }

  markPlayerDisconnected(socketId) {
    return this.gameState.markPlayerDisconnected(socketId);
  }

  rejoinPlayer(socketId, userId) {
    return this.gameState.rejoinPlayer(socketId, userId);
  }

  leavePlayer(socketId, userId) {
    return this.gameState.leavePlayer(socketId, userId);
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
    if (changed) this.gameState.recordEvent(paused ? 'La partida se pausó.' : 'La partida se reanudó.');
    if (changed) this.publishState(this.gameState.getState());
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

  restart() {
    if (!this.gameState.gameOver) return null;
    this.end();
    this.start();
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

  getOrCreateRoom(roomId) {
    if (!roomId) throw new Error('Se requiere un identificador de sala.');
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
