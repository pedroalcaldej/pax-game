/**
 * client/src/network/SocketClient.js
 * Gestiona la conexión WebSocket desde el navegador hacia el servidor de PAX.
 */

import { io } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../../../shared/Protocol.js';

export class SocketClient {
  /**
   * @param {string} serverUrl - URL del servidor (ej: 'http://localhost:3000')
   */
  constructor(serverUrl = 'http://localhost:3000') {
    this.socket = io(serverUrl, { autoConnect: false });
    this.initListeners();
  }

  /**
   * Conecta con el servidor backend.
   */
  connect() {
    this.socket.connect();
  }

  /**
   * Configura los escuchadores de eventos del servidor.
   */
  initListeners() {
    this.socket.on('connect', () => {
      console.log(`[SocketClient] Conectado exitosamente con ID: ${this.socket.id}`);
    });

    this.socket.on('disconnect', () => {
      console.warn('[SocketClient] Desconectado del servidor.');
    });

    this.socket.on(SERVER_EVENTS.ERROR_MESSAGE, (data) => {
      console.error(`[Servidor Error]: ${data.message}`);
    });
  }

  /**
   * Solicita unirse a una sala de juego.
   * @param {string} playerName - Nombre de usuario.
   * @param {string} roomId - Identificador de la sala.
   */
  joinGame(playerName, roomId = 'room-1') {
    this.socket.emit(CLIENT_EVENTS.JOIN_GAME, { playerName, roomId });
  }

  /**
   * Envia la actualización de la tasa impositiva (tau) seleccionada por el jugador.
   * @param {string} roomId - ID de la sala.
   * @param {number} taxRate - Nuevo valor de tau (0.05 a 0.50).
   */
  setTaxRate(roomId, taxRate) {
    this.socket.emit(CLIENT_EVENTS.SET_TAX_RATE, { roomId, taxRate });
  }

  /**
   * Suscribe un callback para recibir actualizaciones de estado del juego.
   */
  onGameStateUpdate(callback) {
    this.socket.on(SERVER_EVENTS.GAME_STATE_UPDATE, callback);
  }

  /**
   * Suscribe un callback para recibir cambios de fase y temporizador.
   */
  onPhaseChange(callback) {
    this.socket.on(SERVER_EVENTS.PHASE_CHANGE, callback);
  }
}