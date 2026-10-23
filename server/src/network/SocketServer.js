/**
 * server/src/network/SocketServer.js
 * Escucha las conexiones entrantes de Socket.io y mapea los eventos del protocolo.
 */

import { CLIENT_EVENTS, SERVER_EVENTS } from '../../../shared/Protocol.js';
import { RoomManager } from './RoomManager.js';

export class SocketServer {
  constructor(io) {
    this.io = io;
    this.roomManager = new RoomManager(io);
    this.initListeners();
  }

  initListeners() {
    this.io.on('connection', (socket) => {
      console.log(`[Network] Cliente conectado: ${socket.id}`);

      // Evento: Jugador intenta unirse a una partida
      socket.on(CLIENT_EVENTS.JOIN_GAME, ({ playerName, roomId }) => {
        const targetRoom = roomId || 'room-1';
        const result = this.roomManager.addPlayerToRoom(targetRoom, socket, playerName || 'Jugador');

        if (result.success) {
          // Confirmar ingreso y enviar el estado actual
          this.io.to(targetRoom).emit(SERVER_EVENTS.GAME_STATE_UPDATE, result.room.gameState.getPublicState());
        } else {
          socket.emit(SERVER_EVENTS.ERROR_MESSAGE, { message: result.error });
        }
      });

      // Evento: Cambiar tasa impositiva (tau) durante la Fase 2
      socket.on(CLIENT_EVENTS.SET_TAX_RATE, ({ roomId, taxRate }) => {
        const room = this.roomManager.getOrCreateRoom(roomId || 'room-1');
        const player = room.gameState.players.get(socket.id);

        if (player && room.gameState.currentPhase === 2) {
          player.taxRate = taxRate;
          this.io.to(roomId || 'room-1').emit(SERVER_EVENTS.GAME_STATE_UPDATE, room.gameState.getPublicState());
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Network] Cliente desconectado: ${socket.id}`);
      });
    });
  }
}