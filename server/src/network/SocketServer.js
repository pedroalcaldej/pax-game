/**
 * server/src/network/SocketServer.js
 */

import { PROTOCOL } from '../../../shared/Constants.js';

export class SocketServer {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.roomManager.setStatePublisher((room, state) => {
      this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, state);
    });
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`[Network] Cliente conectado: ${socket.id}`);

      const defaultRoom = this.roomManager.getOrCreateRoom('room-1');
      socket.emit(PROTOCOL.GAME_STATE_UPDATE, defaultRoom.gameState.getState());

      // Recibir datos de unión incluyendo playerId
      socket.on(PROTOCOL.JOIN_GAME, ({ playerName, roomId, playerId }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getOrCreateRoom(targetRoomId);

        // Registrar o reconectar al jugador
        const player = room.gameState.addPlayer(socket.id, playerName || 'Nación Alpha', playerId);
        if (!player) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'La sala ya tiene cuatro jugadores humanos.');
          return;
        }

        socket.join(room.id);
        console.log(`[Network] Jugador "${player.name}" (${player.id}) conectado a la sala: ${room.id}`);

        // Emitir estado actualizado a todos
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.START_GAME, ({ roomId } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          const message = 'Únete a la sala antes de iniciar la partida.';
          socket.emit(PROTOCOL.ACTION_ERROR, message);
          acknowledge({ ok: false, message });
          return;
        }

        const started = room.start();
        if (started) {
          socket.emit(PROTOCOL.ACTION_RESULT, 'La partida ha comenzado.');
        }
        acknowledge({ ok: true, gameStarted: room.gameState.gameStarted });
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.SET_TAX_RATE, ({ roomId, taxRate }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getRoom(targetRoomId);

        if (room) {
          const accepted = room.gameState.setPlayerTaxRate(socket.id, taxRate);
          if (!accepted) {
            socket.emit(PROTOCOL.ACTION_ERROR, 'Los impuestos solo se pueden ajustar en fase 2 y dentro del rango permitido.');
            return;
          }
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.PLAYER_ACTION, ({ roomId, action } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'No se encontró la sala.');
          return;
        }

        const result = room.gameState.performPlayerAction(socket.id, action);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) {
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on('disconnect', () => {
        for (const room of this.roomManager.rooms.values()) {
          room.gameState.removePlayer(socket.id);
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
        console.log(`[Network] Cliente desconectado: ${socket.id}`);
      });
    });
  }
}