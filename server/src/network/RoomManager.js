/**
 * server/src/network/RoomManager.js
 * Gestiona la creación de salas de juego y la asignación de hasta 4 jugadores por sala.
 */

import { GameState } from '../game/GameState.js';
import { PhaseManager } from '../game/PhaseManager.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomId -> { gameState, phaseManager }
  }

  /**
   * Obtiene una sala existente disponible o crea una nueva.
   * @param {string} roomId - Identificador de la sala (por defecto 'room-default').
   */
  getOrCreateRoom(roomId = 'room-1') {
    if (!this.rooms.has(roomId)) {
      const gameState = new GameState();
      
      // Callback para emitir cambios de fase y tiempo a todos los sockets de la sala
      const phaseManager = new PhaseManager(gameState, (data) => {
        this.io.to(roomId).emit('server:phase_change', data);
      });

      this.rooms.set(roomId, { gameState, phaseManager });
    }
    return this.rooms.get(roomId);
  }

  /**
   * Agrega un jugador a una sala específica.
   */
  addPlayerToRoom(roomId, socket, playerName) {
    const room = this.getOrCreateRoom(roomId);
    
    try {
      const player = room.gameState.addPlayer(socket.id, playerName);
      socket.join(roomId);

      // Si la sala se llena (4 jugadores), se inicia el bucle de juego
      if (room.gameState.players.size === 4 && room.gameState.currentRound === 1) {
        room.phaseManager.startLoop();
      }

      return { success: true, player, room };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}