/**
 * server/src/network/RoomManager.js
 */

import { GameState } from '../game/GameState.js';

export class Room {
  constructor(id) {
    this.id = id;
    this.gameState = new GameState();
  }

  addPlayer(socketId, playerName) {
    return this.gameState.addPlayer(socketId, playerName);
  }

  removePlayer(socketId) {
    return this.gameState.removePlayer(socketId);
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  getOrCreateRoom(roomId = 'room-1') {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId));
      console.log(`[RoomManager] Sala creada: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId) {
    this.rooms.delete(roomId);
  }
}