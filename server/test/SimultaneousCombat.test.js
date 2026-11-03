import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';

function fixture(reverse = false) {
  const state = new GameState({ preset: 'quick', mapSeed: 'simultaneous-combat' });
  state.gameStarted = true;
  state.currentPhase = 2;
  const [alpha, beta, gamma] = [...state.players.values()];
  if (reverse) state.players = new Map([...state.players].reverse());
  for (const tile of state.grid.flat()) {
    Object.assign(tile, { ownerId: null, nationId: null, troops: 0 });
    delete tile.visitingTroops;
  }
  const tile = (x, y, player, troops) => {
    const result = state.grid[y][x];
    Object.assign(result, { type: 'TR', ownerId: player?.id ?? null, nationId: player?.nationId ?? null, troops });
    return result;
  };
  const move = (player, x, y, targetX, targetY, troops, slot = 0) => {
    player.plannedActions[slot] = { type: 'MOVE_TROOPS', x, y, targetX, targetY, troops };
  };
  return { state, alpha, beta, gamma, tile, move };
}

for (const reverse of [false, true]) {
  test(`2 attacking 1 stationary wins with 1 survivor (reverse order ${reverse})`, () => {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    tile(8, 4, alpha, 2);
    const destination = tile(9, 4, beta, 1);
    move(alpha, 8, 4, 9, 4, 2);
    const results = state.resolvePlannedActions();
    assert.equal(destination.ownerId, alpha.id);
    assert.equal(destination.troops, 1);
    assert.equal(results[0].combat.attackerSurvivors, 1);
    assert.equal(destination.visitingTroops, undefined);
  });

  test(`2 and 1 arriving simultaneously fight at their common destination (reverse order ${reverse})`, () => {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    tile(8, 4, alpha, 2);
    tile(10, 4, beta, 1);
    const destination = tile(9, 4, null, 0);
    move(alpha, 8, 4, 9, 4, 2);
    move(beta, 10, 4, 9, 4, 1);
    const results = state.resolvePlannedActions();
    assert.equal(destination.ownerId, alpha.id);
    assert.equal(destination.troops, 1);
    assert.ok(results.every((result) => result.combat.winnerId === alpha.id));
  });

  test(`a defender leaving in another slot escapes before the attacker arrives (reverse order ${reverse})`, () => {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    tile(8, 4, alpha, 2);
    const destination = tile(9, 4, beta, 1);
    const escape = tile(10, 4, beta, 0);
    move(alpha, 8, 4, 9, 4, 2);
    move(beta, 9, 4, 10, 4, 1, 2);
    const results = state.resolvePlannedActions();
    assert.equal(destination.ownerId, alpha.id);
    assert.equal(destination.troops, 2);
    assert.equal(escape.troops, 1);
    assert.ok(results.every((result) => !result.combat));
  });
}

test('remaining defenders and incoming reinforcements combine before combat', () => {
  const { state, alpha, beta, tile, move } = fixture();
  tile(8, 4, alpha, 5);
  const destination = tile(9, 4, beta, 2);
  tile(10, 4, beta, 1);
  move(alpha, 8, 4, 9, 4, 5);
  move(beta, 10, 4, 9, 4, 1);
  state.resolvePlannedActions();
  assert.equal(destination.ownerId, alpha.id);
  assert.equal(destination.troops, 2);
});

test('a failed escape stays at the origin and defends; failure and order are separate log entries', () => {
  const { state, alpha, beta, tile, move } = fixture();
  tile(8, 4, alpha, 2);
  const destination = tile(9, 4, beta, 1);
  tile(10, 4, beta, 0);
  state.activeDmzZones.push({ x: 12, y: 4, expiresAfterRound: 5 });
  move(alpha, 8, 4, 9, 4, 2);
  move(beta, 9, 4, 10, 4, 1);
  const results = state.resolvePlannedActions();
  assert.equal(results.find((result) => result.playerId === beta.id).ok, false);
  assert.equal(destination.troops, 1);
  assert.equal(destination.ownerId, alpha.id);
  const order = state.eventHistory.find((event) => event.playerId === beta.id && event.category === 'action');
  const error = state.eventHistory.find((event) => event.playerId === beta.id && event.category === 'action-error');
  assert.ok(order.message.includes('Mover tropas (1 tropa)'));
  assert.equal(order.message.includes('no realizada'), false);
  assert.match(error.message, /Zona Desmilitarizada/);
});

test('departures cannot spend troops that only arrive in the same turn', () => {
  const { state, alpha, tile, move } = fixture();
  tile(8, 4, alpha, 2);
  const middle = tile(9, 4, alpha, 0);
  const target = tile(10, 4, alpha, 0);
  move(alpha, 8, 4, 9, 4, 2);
  move(alpha, 9, 4, 10, 4, 2, 1);
  const results = state.resolvePlannedActions();
  assert.equal(results[1].ok, false);
  assert.equal(middle.troops, 2);
  assert.equal(target.troops, 0);
});

test('simultaneous ties leave no troops and preserve the previous owner', () => {
  const { state, alpha, beta, tile, move } = fixture();
  tile(8, 4, alpha, 2);
  const target = tile(9, 4, beta, 2);
  move(alpha, 8, 4, 9, 4, 2);
  state.resolvePlannedActions();
  assert.equal(target.troops, 0);
  assert.equal(target.ownerId, beta.id);
});

test('crossing armies escape each other and do not fight on the border', () => {
  const { state, alpha, beta, tile, move } = fixture();
  const left = tile(8, 4, alpha, 2);
  const right = tile(9, 4, beta, 1);
  move(alpha, 8, 4, 9, 4, 2);
  move(beta, 9, 4, 8, 4, 1);
  const results = state.resolvePlannedActions();
  assert.equal(left.ownerId, beta.id);
  assert.equal(left.troops, 1);
  assert.equal(right.ownerId, alpha.id);
  assert.equal(right.troops, 2);
  assert.ok(results.every((result) => !result.combat));
});

test('three-country arrivals resolve once without country iteration bias', () => {
  const run = (reverse) => {
    const { state, alpha, beta, gamma, tile, move } = fixture(reverse);
    tile(8, 4, alpha, 5);
    tile(10, 4, beta, 1);
    tile(9, 3, gamma, 2);
    const target = tile(9, 4, null, 0);
    move(alpha, 8, 4, 9, 4, 5);
    move(beta, 10, 4, 9, 4, 1);
    move(gamma, 9, 3, 9, 4, 2);
    state.resolvePlannedActions();
    return { ownerId: target.ownerId, troops: target.troops };
  };
  assert.deepEqual(run(false), { ownerId: 'nation-0', troops: 2 });
  assert.deepEqual(run(true), run(false));
});

test('simultaneous pact violations charge each aggressor once, independent of country order', () => {
  for (const reverse of [false, true]) {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    alpha.resources.INFLUENCE = 100;
    beta.resources.INFLUENCE = 100;
    tile(8, 4, alpha, 2);
    tile(10, 4, beta, 1);
    tile(9, 4, null, 0);
    state.nonAggressionPacts.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
    move(alpha, 8, 4, 9, 4, 2);
    move(beta, 10, 4, 9, 4, 1);
    state.resolvePlannedActions();
    assert.equal(alpha.resources.INFLUENCE, 90);
    assert.equal(beta.resources.INFLUENCE, 90);
  }
});

test('withdrawing legacy visiting troops does not count as a new pact violation', () => {
  const { state, alpha, beta, tile, move } = fixture();
  const source = tile(8, 4, beta, 3);
  source.visitingTroops = { [alpha.id]: 2 };
  const destination = tile(9, 4, alpha, 0);
  alpha.resources.INFLUENCE = 100;
  state.nonAggressionPacts.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
  move(alpha, 8, 4, 9, 4, 2);
  state.resolvePlannedActions();
  assert.equal(source.troops, 1);
  assert.equal(destination.troops, 2);
  assert.equal(alpha.resources.INFLUENCE, 100);
  assert.equal(state.nonAggressionPacts.length, 1);
});
