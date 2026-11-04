/**
 * server/src/network/RoomManager.js
 */

import { GameState } from '../game/GameState.js';
import { PhaseManager } from '../game/PhaseManager.js';
import { MAX_PLAYERS } from '../../../shared/Constants.js';
import { loadBotDecisionTables } from '../training/BotMemoryStore.js';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOLO_SAVE_DIRECTORY = fileURLToPath(new URL('../../data/solo-games/', import.meta.url));
const soloRoomId = (id) => /^solo-[a-z0-9-]{1,100}$/i.test(id);
const encodeMaps = (_key, value) => value instanceof Map ? { __paxMap: [...value] } : value;
const decodeMaps = (_key, value) => value?.__paxMap ? new Map(value.__paxMap) : value;

export class Room {
  constructor(id, publishState, settings = {}) {
    this.id = id;
    this.publishState = publishState;
    this.settings = settings;
    this.isSinglePlayer = soloRoomId(id);
    this.pauseReasons = new Set();
    this.onCheckpoint = () => {};
    this.botDecisionTables = loadBotDecisionTables();
    this.gameState = new GameState(settings, this.botDecisionTables);
    this.phaseManager = new PhaseManager(this.gameState, (state) => this.publishGameState(state));
  }

  publishGameState(state) {
    this.publishState(state);
    if (state.gameOver) this.onCheckpoint();
  }

  start() {
    if (this.gameState.gameStarted) return false;
    this.gameState.gameStarted = true;
    this.gameState.recordEvent('La partida ha comenzado.');
    this.phaseManager.startLoop();
    this.onCheckpoint();
    return true;
  }

  addPlayer(socketId, playerName) {
    return this.gameState.addPlayer(socketId, playerName);
  }

  markPlayerDisconnected(socketId) {
    const disconnected = this.gameState.markPlayerDisconnected(socketId);
    if (disconnected && this.isSinglePlayer) {
      if (this.gameState.gameOver) this.onCheckpoint();
      else this.setPauseReason('disconnect', true);
    }
    return disconnected;
  }

  rejoinPlayer(socketId, userId, { backgrounded = false } = {}) {
    const player = this.gameState.rejoinPlayer(socketId, userId);
    if (player && this.isSinglePlayer) {
      this.setPauseReason('background', Boolean(backgrounded));
      this.setPauseReason('disconnect', false);
    }
    return player;
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

  setPaused(socketId, paused, reason = 'menu') {
    const players = Array.from(this.gameState.players.values());
    const humans = players.filter((player) => !player.isBot);
    const caller = humans.find((player) => player.socketId === socketId);
    if (!caller || !this.gameState.gameStarted) {
      return { ok: false, message: 'No puedes pausar esta partida.' };
    }
    if (players.length !== MAX_PLAYERS || humans.length !== 1) {
      return { ok: true, paused: this.gameState.isPaused, eligible: false };
    }
    const changed = this.setPauseReason(reason === 'background' ? 'background' : 'menu', Boolean(paused));
    return { ok: true, paused: this.gameState.isPaused, eligible: true, changed };
  }

  setPauseReason(reason, paused) {
    if (!this.gameState.gameStarted || this.gameState.gameOver) return false;
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    const changed = this.phaseManager.setPaused(this.pauseReasons.size > 0);
    const isPaused = this.gameState.isPaused;
    if (changed) this.gameState.recordEvent(isPaused ? 'La partida se pausó.' : 'La partida se reanudó.');
    if (changed) this.publishState(this.gameState.getState());
    this.onCheckpoint();
    return changed;
  }

  enforcePauseEligibility() {
    const humans = Array.from(this.gameState.players.values())
      .filter((player) => !player.isBot);
    if (this.gameState.isPaused && humans.length !== 1) {
      this.pauseReasons.clear();
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
    this.pauseReasons.clear();
    this.gameState = new GameState(this.settings, this.botDecisionTables);
    for (const player of connectedPlayers) {
      this.gameState.addPlayer(player.socketId, player.name, player.playerId);
    }
    this.phaseManager = new PhaseManager(this.gameState, (state) => this.publishGameState(state));
    this.onCheckpoint();
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
  constructor({ saveDirectory = SOLO_SAVE_DIRECTORY } = {}) {
    this.rooms = new Map();
    this.publishState = null;
    this.saveDirectory = saveDirectory;
  }

  setStatePublisher(publishState) {
    this.publishState = publishState;
    for (const room of this.rooms.values()) {
      room.publishState = (state) => this.publishState(room, state);
    }
  }

  getOrCreateRoom(roomId, settings = {}) {
    if (!roomId) throw new Error('Se requiere un identificador de sala.');
    if (!this.getRoom(roomId)) {
      const room = new Room(roomId, (state) => {
        if (this.publishState) this.publishState(room, state);
      }, settings);
      room.onCheckpoint = () => this.saveRoom(room);
      this.rooms.set(roomId, room);
      console.log(`[RoomManager] Sala creada: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    if (this.rooms.has(roomId)) return this.rooms.get(roomId);
    if (!soloRoomId(roomId)) return undefined;
    try {
      const saved = JSON.parse(readFileSync(join(this.saveDirectory, `${roomId}.json`), 'utf8'), decodeMaps);
      if (saved.version !== 1 || saved.roomId !== roomId || !(saved.state?.players instanceof Map)) {
        throw new Error('La partida guardada no es válida.');
      }
      const room = new Room(roomId, (state) => this.publishState?.(room, state), saved.settings);
      Object.assign(room.gameState, saved.state);
      room.gameState.worldBankFund = room.gameState.bankFund;
      for (const player of room.gameState.players.values()) {
        player.socketId = null;
        if (!player.isBot) player.isDisconnected = true;
      }
      room.pauseReasons = new Set([...saved.pauseReasons, 'disconnect']);
      Object.assign(room.phaseManager, saved.clock, {
        running: room.gameState.gameStarted && !room.gameState.gameOver,
        paused: !room.gameState.gameOver
      });
      room.gameState.isPaused = !room.gameState.gameOver;
      room.onCheckpoint = () => this.saveRoom(room);
      this.rooms.set(roomId, room);
      return room;
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('[Partida individual] No se pudo recuperar la partida:', error.message);
      return undefined;
    }
  }

  /**
   * Una conexión no puede mantener dos partidas individuales activas a la vez.
   * Esto cubre doble clic, reintentos de conexión y eventos duplicados del cliente.
   */
  removeDuplicateSoloSessions(socketId, playerId, exceptRoomId) {
    if (!socketId || !playerId) return;
    for (const room of [...this.rooms.values()]) {
      if (room.id === exceptRoomId || !room.isSinglePlayer) continue;
      const player = [...room.gameState.players.values()]
        .find((entry) => entry.boundPlayerId === playerId && entry.socketId === socketId);
      if (!player) continue;
      room.leavePlayer(socketId, playerId);
      const hasHumanPlayers = [...room.gameState.players.values()].some((entry) => !entry.isBot);
      if (!hasHumanPlayers) this.removeRoom(room.id);
      else room.setPauseReason('disconnect', true);
      console.warn(`[RoomManager] Sesión individual duplicada cerrada: ${room.id}`);
    }
  }

  saveRoom(room) {
    if (!room.isSinglePlayer) return;
    const path = join(this.saveDirectory, `${room.id}.json`);
    try {
      if (!room.gameState.gameStarted) {
        try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        return;
      }
      const state = Object.fromEntries(Object.entries(room.gameState)
        .filter(([key]) => !['botDecisionTables', 'botHumanIdeas', 'botRandom'].includes(key)));
      const manager = room.phaseManager;
      const clock = {
        secondsRemaining: manager.secondsRemaining,
        pausedTransition: manager.pausedTransition || (manager.transitionTimer ? {
          phase: manager.scheduledPhase,
          remaining: Math.max(0, manager.transitionDueAt - Date.now())
        } : null)
      };
      const payload = JSON.stringify({ version: 1, roomId: room.id, settings: room.settings,
        state, clock, pauseReasons: [...room.pauseReasons] }, encodeMaps);
      mkdirSync(this.saveDirectory, { recursive: true });
      writeFileSync(`${path}.tmp`, payload, 'utf8');
      renameSync(`${path}.tmp`, path);
    } catch (error) {
      console.error('[Partida individual] No se pudo guardar la partida:', error.message);
    }
  }

  removeRoom(roomId) {
    this.rooms.get(roomId)?.phaseManager.stop();
    this.rooms.delete(roomId);
    if (soloRoomId(roomId)) {
      try { unlinkSync(join(this.saveDirectory, `${roomId}.json`)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
