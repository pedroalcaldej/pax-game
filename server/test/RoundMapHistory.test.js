import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { PhaseManager } from '../src/game/PhaseManager.js';
import { captureRoundMap, readRoundMap } from '../src/game/RoundMapHistory.js';
import { roundMapOptions, roundMapStep } from '../../client/src/ui/components/RoundMapNavigation.js';

function fixture() {
  const state = new GameState({ preset: 'quick', mapSeed: 'map-history' });
  const room = { id: 'room', gameState: state };
  const socket = { rooms: new Set(['room']) };
  return { state, room, socket };
}

test('round maps are independent of live state and requesting or editing them cannot rewind the game', () => {
  const { state, room, socket } = fixture();
  const original = structuredClone(state.grid);
  captureRoundMap(state);
  state.grid[0][0].troops += 10;
  state.currentRound = 2;
  const current = structuredClone(state.grid);
  const result = readRoundMap(room, socket, 1);
  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshot.grid, original);
  result.snapshot.grid[0][0].troops = -100;
  assert.deepEqual(readRoundMap(room, socket, 1).snapshot.grid, original);
  assert.deepEqual(state.grid, current);
  assert.equal(state.currentRound, 2);
  assert.deepEqual(state.getState().mapHistoryRounds, [1]);
  assert.equal('roundMapHistory' in state.getState(), false);
  assert.ok(result.snapshot.players.every((player) => !('plannedActions' in player)));
});

test('access requires room membership and a completed, recorded round', () => {
  const { state, room, socket } = fixture();
  captureRoundMap(state);
  assert.equal(readRoundMap(room, { rooms: new Set() }, 1).ok, false);
  assert.equal(readRoundMap(undefined, socket, 1).ok, false);
  assert.equal(readRoundMap(room, socket, '1').ok, false);
  assert.equal(readRoundMap(room, socket, 2).ok, false);
});

test('round opening records one snapshot and a new game starts with an empty history', () => {
  const { state } = fixture();
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  manager.transitionToPhase(1);
  manager.stop();
  assert.equal(state.roundMapHistory.has(1), true);
  const old = structuredClone(state.roundMapHistory.get(1));
  state.currentRound = 1;
  state.grid[0][0].troops += 10;
  captureRoundMap(state);
  assert.deepEqual(state.roundMapHistory.get(1), old);
  const restarted = new GameState({ preset: 'quick', mapSeed: 'map-history' });
  assert.notEqual(state.mapHistoryId, restarted.mapHistoryId);
  assert.deepEqual(restarted.getState().mapHistoryRounds, []);
});

test('arrows navigate completed rounds and return to live without changing current round', () => {
  const state = { currentRound: 4, mapHistoryRounds: [3, 1, 2, 2, 4] };
  assert.deepEqual(roundMapOptions(state), [1, 2, 3, null]);
  assert.equal(roundMapStep(state, null, -1), 3);
  assert.equal(roundMapStep(state, 3, -1), 2);
  assert.equal(roundMapStep(state, 1, -1), 1);
  assert.equal(roundMapStep(state, 3, 1), null);
  assert.equal(roundMapStep(state, null, 1), null);
  assert.equal(state.currentRound, 4);
  assert.deepEqual(roundMapOptions({ currentRound: 1, mapHistoryRounds: [] }), [null]);
});

test('history and zoom share the header after round status and are hidden before a game starts', async () => {
  const { renderGameScreen } = await import('../../client/src/ui/screens/GameScreenView.js');
  const container = { innerHTML: '' };
  renderGameScreen(container);
  const header = container.innerHTML.split('<header class="pax-topbar">')[1].split('</header>')[0];
  assert.ok(header.indexOf('id="phase-value"') < header.indexOf('id="map-history-back"'));
  assert.ok(header.includes('id="map-zoom-controls"'));
  assert.match(header, /id="map-controls" hidden/);
  const navigation = header.split('<nav class="pax-map-history"')[1].split('</nav>')[0];
  assert.equal((navigation.match(/<button /g) || []).length, 2);
  assert.equal(navigation.includes('map-history-live'), false);
  const mapRegion = container.innerHTML.split('<section class="pax-center">')[1].split('<aside class="pax-inspector"')[0];
  assert.equal(mapRegion.includes('map-history-back'), false);
  assert.equal(mapRegion.includes('map-zoom-controls'), false);
});


test('round one keeps its initial map and round two captures its own opening after economy', () => {
  const { state, room, socket } = fixture();
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  const initial = structuredClone(state.grid);
  manager.transitionToPhase(1);
  manager.stopTransitionTimer();
  assert.deepEqual(readRoundMap(room, socket, 1).snapshot.grid, initial);
  // An action changes the board during round one.
  state.grid[0][0].troops += 7;
  const afterAction = structuredClone(state.grid);
  manager.transitionToPhase(5);
  manager.stopTransitionTimer();
  assert.equal(state.currentRound, 2);
  assert.deepEqual(readRoundMap(room, socket, 1).snapshot.grid, initial);
  assert.equal(readRoundMap(room, socket, 2).ok, false);
  manager.transitionToPhase(1);
  manager.stopTransitionTimer();
  const second = structuredClone(state.grid);
  assert.equal(readRoundMap(room, socket, 2).snapshot.moment, 'start');
  assert.deepEqual(readRoundMap(room, socket, 2).snapshot.grid, second);
  assert.equal(second[0][0].troops, afterAction[0][0].troops);
  assert.notDeepEqual(second, initial);
  state.grid[0][0].troops += 5;
  assert.deepEqual(readRoundMap(room, socket, 2).snapshot.grid, second);
  assert.deepEqual(readRoundMap(room, socket, 1).snapshot.grid, initial);
  manager.stop();
});


test('the current round is never offered as an archived map, even when its opening was captured', () => {
  const state = { currentRound: 1, mapHistoryRounds: [1] };
  assert.deepEqual(roundMapOptions(state), [null]);
  assert.equal(roundMapStep(state, null, -1), null);
  state.currentRound = 2;
  state.mapHistoryRounds.push(2);
  assert.deepEqual(roundMapOptions(state), [1, null]);
  assert.equal(roundMapStep(state, null, -1), 1);
  assert.equal(roundMapStep(state, 1, 1), null);
});
