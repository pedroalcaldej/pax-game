/**
 * server/src/network/SocketServer.js
 */

import { PROTOCOL } from '../../../shared/Constants.js';

export class SocketServer {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`[Network] Cliente conectado: ${socket.id}`);

      // Recibir datos de unión incluyendo playerId
      socket.on(PROTOCOL.JOIN_GAME, ({ playerName, roomId, playerId }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getOrCreateRoom(targetRoomId);

        // Registrar o reconectar al jugador
        const player = room.gameState.addPlayer(socket.id, playerName || 'Nación Alpha', playerId);

        socket.join(room.id);
        console.log(`[Network] Jugador "${player.name}" (${player.id}) conectado a la sala: ${room.id}`);

        // Emitir estado actualizado a todos
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.SET_TAX_RATE, ({ roomId, taxRate }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getRoom(targetRoomId);

        if (room) {
          room.gameState.setPlayerTaxRate(socket.id, taxRate);
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Network] Cliente desconectado: ${socket.id}`);
      });
    });
  }
}