import { PROTOCOL } from '../../../shared/Constants.js';
import { socket } from './SocketClient.js';

export class SocketLobby {
  constructor({ playerId, playerName = 'alpha', onChange, onChatMessage, onError }) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.onChange = onChange;
    this.onChatMessage = onChatMessage;
    this.onError = onError;
    this.roomCode = null;
    this.enabled = true;
    this.handleState = (room) => {
      if (room?.deleted) {
        this.onError?.(new Error('La sala ya no existe.'));
        return;
      }
      if (room?.code) {
        this.roomCode = room.code;
        const players = room.jugadores || {};
        this.onChange?.({
          ...room,
          slots: room.slots || Array.from({ length: 4 }, (_, index) => players[`slot_${index + 1}`] || null),
          isHost: room.creador === this.playerId
        });
      }
    };
    this.handleChat = (message) => this.onChatMessage?.(message);
    socket.on(PROTOCOL.LOBBY_STATE_UPDATE, this.handleState);
    socket.on(PROTOCOL.LOBBY_CHAT_MESSAGE, this.handleChat);
  }

  request(event, payload = {}) {
    if (!socket.connected) return Promise.reject(new Error('No hay conexión con el servidor.'));
    return new Promise((resolve, reject) => {
      socket.timeout(10000).emit(event, payload, (timeoutError, result) => {
        if (timeoutError) return reject(new Error('El servidor no respondió. Inténtalo de nuevo.'));
        if (!result?.ok) return reject(new Error(result?.message || 'No se pudo completar la operación.'));
        resolve(result);
      });
    });
  }

  async createRoom({ privada = true } = {}) {
    const result = await this.request(PROTOCOL.LOBBY_CREATE, { userId: this.playerId, playerName: this.playerName, privada });
    return result.roomId;
  }
  async quickMatch() {
    const result = await this.request(PROTOCOL.LOBBY_QUICK_MATCH, { userId: this.playerId, playerName: this.playerName });
    return result.roomId;
  }
  async joinRoom(roomId) {
    const result = await this.request(PROTOCOL.LOBBY_JOIN, { roomId, userId: this.playerId, playerName: this.playerName });
    return result.roomId;
  }
  async watchRoom(roomId) {
    await this.request(PROTOCOL.LOBBY_WATCH, { roomId, userId: this.playerId });
  }
  async updateProfile({ name, color }) {
    await this.request(PROTOCOL.LOBBY_UPDATE_PROFILE, { roomId: this.roomCode, userId: this.playerId, name, color });
  }
  async startGame() {
    await this.request(PROTOCOL.LOBBY_TOGGLE_READY, { roomId: this.roomCode, userId: this.playerId });
  }
  async returnToLobbyForReplay() {
    await this.request(PROTOCOL.LOBBY_REPLAY, { roomId: this.roomCode });
  }
  async sendChatMessage(message) {
    await this.request(PROTOCOL.LOBBY_SEND_CHAT, { roomId: this.roomCode, userId: this.playerId, message });
  }
  async leaveRoom() {
    if (!this.roomCode) return;
    const roomCode = this.roomCode;
    await this.request(PROTOCOL.LOBBY_LEAVE, { roomId: roomCode, userId: this.playerId });
    this.roomCode = null;
  }
  destroy() {
    socket.off(PROTOCOL.LOBBY_STATE_UPDATE, this.handleState);
    socket.off(PROTOCOL.LOBBY_CHAT_MESSAGE, this.handleChat);
  }
}
