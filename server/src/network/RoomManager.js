/**
 * server/src/network/RoomManager.js
 */

import { GameState } from '../game/GameState.js';
import { PhaseManager } from '../game/PhaseManager.js';

export class Room {
  constructor(id, publishState) {
    this.id = id;
    this.gameState = new GameState();
    this.phaseManager = new PhaseManager(this.gameState, publishState);
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