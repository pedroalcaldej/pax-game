import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomManager } from '../src/network/RoomManager.js';
import { SocketServer } from '../src/network/SocketServer.js';
import { PROTOCOL } from '../../shared/Constants.js';
import { readGameSession, saveGameSession, clearGameSession, watchGameVisibility } from '../../client/src/network/GameSession.js';

function transport(manager) {
  let connection;
  new SocketServer({
    on: (_event, callback) => { connection = callback; },
    to: () => ({ emit() {} })
  }, manager, {});
  return (id) => {
    const handlers = new Map();
    const socket = { id, data: {}, rooms: new Set([id]),
      on: (event, callback) => handlers.set(event, callback),
      emit() {}, join(room) { this.rooms.add(room); }, leave(room) { this.rooms.delete(room); },
      trigger: (event, ...args) => handlers.get(event)(...args) };
    connection(socket);
    return socket;
  };
}

function fixture(roomId = 'solo-test') {
  const directory = mkdtempSync(join(tmpdir(), 'pax-solo-'));
  const manager = new RoomManager({ saveDirectory: directory });
  const connect = transport(manager);
  const socket = connect('first-connection');
  socket.trigger(PROTOCOL.JOIN_GAME, { roomId, playerId: 'owner', playerName: 'País humano' });
  const room = manager.getRoom(roomId);
  room.gameState.botSearchWidth = 0;
  socket.trigger(PROTOCOL.START_GAME, { roomId }, (result) => assert.equal(result.ok, true));
  room.phaseManager.transitionToPhase(2);
  const player = [...room.gameState.players.values()].find((entry) => entry.boundPlayerId === 'owner');
  return { manager, connect, socket, room, player, directory,
    cleanup() {
      for (const entry of manager.rooms.values()) entry.phaseManager.stop();
      rmSync(directory, { recursive: true, force: true });
    } };
}

test('solo disconnect pauses the clock and rejoining restores membership without replacing the country', async () => {
  const f = fixture();
  try {
    const { room, socket, player } = f;
    room.phaseManager.secondsRemaining = 17;
    room.gameState.timeRemaining = 17;
    player.resources.SILVER = 73;
    const city = room.gameState.grid.flat().find((tile) => tile.ownerId === player.id && tile.type === 'CAP');
    player.plannedActions[0] = { type: 'RECRUIT_TROOP', x: city.x, y: city.y, count: 2 };
    const planned = structuredClone(player.plannedActions);
    socket.trigger(PROTOCOL.SET_GAME_PAUSED, { roomId: room.id, paused: true, reason: 'background' });
    await socket.trigger('disconnect');
    assert.equal(room.gameState.isPaused, true);
    assert.equal(room.phaseManager.timer, null);
    assert.equal(player.isBot, false);
    assert.equal(player.socketId, null);
    const returning = f.connect('new-connection');
    returning.trigger(PROTOCOL.REJOIN_ROOM, { roomId: room.id, userId: 'owner', backgrounded: false }, (result) => {
      assert.equal(result.ok, true);
      assert.equal(result.state.isPaused, false);
    });
    assert.equal(returning.rooms.has(room.id), true);
    assert.equal(player.socketId, returning.id);
    assert.equal(player.resources.SILVER, 73);
    assert.deepEqual(player.plannedActions, planned);
    assert.equal(room.gameState.timeRemaining, 17);
  } finally { f.cleanup(); }
});

test('una conexión no puede mantener dos partidas individuales simultáneas', () => {
  const f = fixture('solo-first');
  try {
    const { manager, socket } = f;
    socket.trigger(PROTOCOL.JOIN_GAME, {
      roomId: 'solo-second', playerId: 'owner', playerName: 'País humano'
    });
    assert.equal(manager.getRoom('solo-first'), undefined);
    assert.ok(manager.getRoom('solo-second'));
  } finally { f.cleanup(); }
});

test('background pause never clears a manual pause and unknown sessions cannot resume it', async () => {
  const f = fixture();
  try {
    const { room, socket } = f;
    socket.trigger(PROTOCOL.SET_GAME_PAUSED, { roomId: room.id, paused: true, reason: 'menu' });
    socket.trigger(PROTOCOL.SET_GAME_PAUSED, { roomId: room.id, paused: true, reason: 'background' });
    socket.trigger(PROTOCOL.SET_GAME_PAUSED, { roomId: room.id, paused: false, reason: 'background' });
    assert.equal(room.gameState.isPaused, true);
    await socket.trigger('disconnect');
    const returning = f.connect('returning');
    returning.trigger(PROTOCOL.REJOIN_ROOM, { roomId: room.id, userId: 'unknown' }, (result) => assert.equal(result.ok, false));
    assert.equal(room.gameState.isPaused, true);
    returning.trigger(PROTOCOL.REJOIN_ROOM, { roomId: room.id, userId: 'owner' }, (result) => assert.equal(result.ok, true));
    assert.equal(room.gameState.isPaused, true);
    returning.trigger(PROTOCOL.SET_GAME_PAUSED, { roomId: room.id, paused: false, reason: 'menu' });
    assert.equal(room.gameState.isPaused, false);
  } finally { f.cleanup(); }
});

test('a saved solo game survives a new room manager, keeping its clock, board, histories and bank alias', async () => {
  const f = fixture();
  let restored;
  try {
    const { room, player } = f;
    room.gameState.currentRound = 4;
    room.phaseManager.secondsRemaining = 23;
    room.gameState.timeRemaining = 23;
    player.resources.SILVER = 42;
    room.gameState.bankFund.SILVER = 13;
    const board = structuredClone(room.gameState.grid);
    const historyId = room.gameState.mapHistoryId;
    await f.socket.trigger('disconnect');
    assert.equal(existsSync(join(f.directory, `${room.id}.json`)), true);
    room.phaseManager.stop();
    const afterRestart = new RoomManager({ saveDirectory: f.directory });
    const connect = transport(afterRestart);
    restored = afterRestart.getRoom(room.id);
    assert.equal(restored.gameState.isPaused, true);
    assert.equal(restored.phaseManager.timer, null);
    assert.equal(restored.gameState.currentRound, 4);
    assert.equal(restored.gameState.timeRemaining, 23);
    assert.equal(restored.gameState.mapHistoryId, historyId);
    assert.ok(restored.gameState.roundMapHistory instanceof Map);
    assert.ok(restored.gameState.taxRatesAtLastRoundEnd instanceof Map);
    assert.deepEqual(restored.gameState.grid, board);
    assert.equal(restored.gameState.worldBankFund, restored.gameState.bankFund);
    const socket = connect('after-restart');
    socket.trigger(PROTOCOL.REJOIN_ROOM, { roomId: room.id, userId: 'owner' }, (result) => {
      assert.equal(result.ok, true);
      assert.equal(result.state.players.find((entry) => entry.boundPlayerId === 'owner').resources.SILVER, 42);
    });
    assert.equal(restored.gameState.isPaused, false);
    socket.trigger(PROTOCOL.LEAVE_ROOM, { roomId: room.id, userId: 'owner' }, (result) => assert.equal(result.ok, true));
    assert.equal(afterRestart.getRoom(room.id), undefined);
    assert.equal(existsSync(join(f.directory, `${room.id}.json`)), false);
  } finally { restored?.phaseManager.stop(); f.cleanup(); }
});

test('multiplayer disconnect reserves the country without pausing the other players', async () => {
  const f = fixture('PAXABC');
  try {
    await f.socket.trigger('disconnect');
    assert.equal(f.room.gameState.isPaused, false);
    assert.equal(f.player.isBot, false);
    assert.equal(existsSync(join(f.directory, 'PAXABC.json')), false);
  } finally { f.cleanup(); }
});

test('pausing between phases preserves the pending transition without repeating the round economy', async () => {
  const f = fixture();
  let restored;
  try {
    f.room.phaseManager.transitionToPhase(1);
    await f.socket.trigger('disconnect');
    assert.equal(f.room.phaseManager.pausedTransition.phase, 2);
    const resources = structuredClone(f.player.resources);
    f.room.phaseManager.stop();
    const manager = new RoomManager({ saveDirectory: f.directory });
    const connect = transport(manager);
    restored = manager.getRoom(f.room.id);
    assert.equal(restored.gameState.currentPhase, 1);
    assert.equal(restored.phaseManager.pausedTransition.phase, 2);
    connect('return').trigger(PROTOCOL.REJOIN_ROOM, { roomId: f.room.id, userId: 'owner' }, (result) => assert.equal(result.ok, true));
    assert.equal(restored.phaseManager.scheduledPhase, 2);
    assert.deepEqual(restored.gameState.players.get(f.player.id).resources, resources);
  } finally { restored?.phaseManager.stop(); f.cleanup(); }
});

test('finished solo games restore their final results without restarting the clock', () => {
  const f = fixture();
  try {
    f.room.gameState.currentRound = f.room.gameState.settings.maxRounds;
    f.room.phaseManager.transitionToPhase(5);
    assert.equal(f.room.gameState.gameOver, true);
    const manager = new RoomManager({ saveDirectory: f.directory });
    const connect = transport(manager);
    const restored = manager.getRoom(f.room.id);
    assert.equal(restored.gameState.gameOver, true);
    assert.equal(restored.phaseManager.running, false);
    connect('return').trigger(PROTOCOL.REJOIN_ROOM, { roomId: f.room.id, userId: 'owner' }, (result) => assert.equal(result.state.gameOver, true));
    assert.equal(restored.phaseManager.timer, null);
  } finally { f.cleanup(); }
});

test('solo session identity survives closing a window, while explicit exit clears it', () => {
  const storage = () => {
    const entries = new Map();
    return { getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  };
  const session = storage();
  const local = storage();
  saveGameSession('solo-saved', 'owner', session, local);
  const newWindow = storage();
  assert.deepEqual(readGameSession(newWindow, local), { roomId: 'solo-saved', userId: 'owner' });
  saveGameSession('PAXABC', 'multiplayer-user', session, local);
  assert.deepEqual(readGameSession(session, local), { roomId: 'PAXABC', userId: 'multiplayer-user' });
  clearGameSession('solo-saved', newWindow, local);
  assert.equal(readGameSession(newWindow, local), null);
});

test('tab visibility, window blur and closing pause; focus resumes and cleanup removes listeners', () => {
  const doc = Object.assign(new EventTarget(), { hidden: false, hasFocus: () => true });
  const win = new EventTarget();
  const changes = [];
  const watcher = watchGameVisibility((value) => changes.push(value), doc, win);
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(watcher.backgrounded, true);
  doc.hidden = false;
  win.dispatchEvent(new Event('focus'));
  assert.equal(watcher.backgrounded, false);
  win.dispatchEvent(new Event('blur'));
  win.dispatchEvent(new Event('pagehide'));
  win.dispatchEvent(new Event('pageshow'));
  assert.deepEqual(changes, [true, false, true, true, false]);
  watcher.destroy();
  win.dispatchEvent(new Event('blur'));
  assert.equal(changes.length, 5);
});
