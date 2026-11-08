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
    Object.assign(result, { type: 'TR', ownerId: player?.id ?? null, nationId: player?.nationId ?? null, troops, defense: 0 });
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

test('fixed capital defense stops an equal attack without being consumed', () => {
  const { state, alpha, beta, tile, move } = fixture();
  const destination = tile(9, 4, beta, 0);
  destination.type = 'CAP';
  destination.defense = 4;
  tile(8, 4, alpha, 4);
  move(alpha, 8, 4, 9, 4, 4);
  state.resolvePlannedActions();
  assert.equal(destination.ownerId, beta.id);
  assert.equal(destination.troops, 0);
  assert.equal(destination.defense, 4);
});

test('five troops overcome four fixed defense with one survivor', () => {
  const { state, alpha, beta, tile, move } = fixture();
  const destination = tile(9, 4, beta, 0);
  destination.type = 'CAP';
  destination.defense = 4;
  tile(8, 4, alpha, 5);
  move(alpha, 8, 4, 9, 4, 5);
  state.resolvePlannedActions();
  assert.equal(destination.ownerId, alpha.id);
  assert.equal(destination.troops, 1);
  assert.equal(destination.defense, 2);
});

test('los carros de la casilla pasan al vencedor del combate terrestre', () => {
  const { state, alpha, beta, tile, move } = fixture();
  tile(8, 4, alpha, 3);
  const destination = tile(9, 4, beta, 1);
  destination.carsByPlayer = { [beta.id]: 2 };
  move(alpha, 8, 4, 9, 4, 3);
  state.resolvePlannedActions();
  assert.deepEqual(destination.carsByPlayer, { [alpha.id]: 2 });
});

test('los carros atacantes no se destruyen si pierde el combate', () => {
  const { state, alpha, beta, tile } = fixture();
  const source = tile(8, 4, alpha, 1);
  source.carsByPlayer = { [alpha.id]: 1 };
  const destination = tile(9, 4, beta, 2);
  alpha.plannedActions[0] = {
    type: 'MOVE_CARS', x: source.x, y: source.y,
    targetX: destination.x, targetY: destination.y, troops: 1
  };
  state.resolvePlannedActions();
  assert.deepEqual(destination.carsByPlayer, { [beta.id]: 1 });
});

test('los barcos supervivientes pasan al vencedor del combate naval', () => {
  const { state, alpha, beta, tile } = fixture();
  const source = tile(8, 4, alpha, 0);
  source.type = 'AG';
  source.shipsByPlayer = { [alpha.id]: 3 };
  source.transportedTroopsByPlayer = { [alpha.id]: 3 };
  const destination = tile(9, 4, beta, 0);
  destination.type = 'AG';
  destination.shipsByPlayer = { [beta.id]: 2 };
  destination.transportedTroopsByPlayer = { [beta.id]: 2 };
  const result = state.resolveShipMovement(alpha, {
    type: 'MOVE_SHIPS', x: source.x, y: source.y,
    targetX: destination.x, targetY: destination.y, ships: 3
  });
  assert.equal(result.ok, true);
  assert.equal(destination.shipsByPlayer[alpha.id], 5);
  assert.equal(destination.shipsByPlayer[beta.id], undefined);
  assert.equal(destination.transportedTroopsByPlayer[beta.id], undefined);
  assert.equal(destination.transportedTroopsByPlayer[alpha.id], 5);
});

test('los barcos atacantes derrotados pasan al vencedor naval', () => {
  const { state, alpha, beta, tile } = fixture();
  const source = tile(8, 4, alpha, 0);
  source.type = 'AG';
  source.shipsByPlayer = { [alpha.id]: 1 };
  const destination = tile(9, 4, beta, 0);
  destination.type = 'AG';
  destination.shipsByPlayer = { [beta.id]: 2 };
  const result = state.resolveShipMovement(alpha, {
    type: 'MOVE_SHIPS', x: source.x, y: source.y,
    targetX: destination.x, targetY: destination.y, ships: 1
  });
  assert.equal(result.ok, true);
  assert.equal(destination.shipsByPlayer[beta.id], 3);
  assert.equal(source.shipsByPlayer[alpha.id], undefined);
});

test('occupying a neutral resource node grants twenty materials', () => {
  const { state, alpha, tile, move } = fixture();
  const destination = tile(9, 4, null, 0);
  destination.type = 'MPT';
  tile(8, 4, alpha, 1);
  alpha.resources.MATERIALS = 0;
  move(alpha, 8, 4, 9, 4, 1);
  state.resolvePlannedActions();
  assert.equal(alpha.resources.MATERIALS, 20);
  assert.equal(state.eventHistory.filter((event) => event.category === 'resource-capture').length, 1);
});

test('land and disembark arrivals fight simultaneously on a neutral resource', () => {
  const { state, alpha, beta, tile, move } = fixture();
  const water = tile(12, 5, null, 0);
  water.type = 'AG';
  water.shipsByPlayer = { [alpha.id]: 1 };
  water.transportedTroopsByPlayer = { [alpha.id]: 5 };
  const destination = tile(11, 5, null, 0);
  destination.type = 'MPT';
  tile(10, 6, beta, 1);
  move(alpha, 12, 5, 11, 5, 5);
  move(beta, 10, 6, 11, 5, 1);
  alpha.resources.MATERIALS = 0;
  const results = state.resolvePlannedActions();
  assert.ok(results.every((result) => result.ok));
  assert.equal(destination.ownerId, alpha.id);
  assert.equal(destination.troops, 4);
  assert.equal(alpha.resources.MATERIALS, 20);
  assert.equal(water.transportedTroopsByPlayer[alpha.id], undefined);
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

test('neutral combat ends the pact without charging either country, independent of country order', () => {
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
    assert.equal(state.nonAggressionPacts.length, 0);
    const breaches = state.eventHistory.filter((event) => event.category === 'treaty-breach');
    assert.equal(breaches.length, 1);
    assert.equal(breaches[0].attackerId, null);
    assert.equal(breaches[0].influencePenalty, 0);
    assert.equal(alpha.resources.INFLUENCE, 100);
    assert.equal(beta.resources.INFLUENCE, 100);
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

for (const reverse of [false, true]) {
  test(`defensive reinforcements never pay for an invader's breach (reverse ${reverse})`, () => {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    alpha.resources.INFLUENCE = beta.resources.INFLUENCE = 100;
    tile(8, 4, alpha, 5);
    tile(10, 4, beta, 2);
    tile(9, 4, beta, 1);
    state.nonAggressionPacts.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
    state.freeTradeTreaties.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
    move(alpha, 8, 4, 9, 4, 5);
    move(beta, 10, 4, 9, 4, 2);
    state.resolvePlannedActions();
    assert.equal(alpha.resources.INFLUENCE, 90);
    assert.equal(beta.resources.INFLUENCE, 100);
    assert.equal(state.nonAggressionPacts.length, 0);
    assert.equal(state.freeTradeTreaties.length, 0);
    const breaches = state.eventHistory.filter((event) => event.category === 'treaty-breach');
    assert.equal(breaches.length, 2);
    assert.ok(breaches.every((event) => event.attackerId === alpha.id && event.defenderId === beta.id));
  });
}

test('naval combat in neutral water ends both treaties without influence loss', () => {
  const { state, alpha, beta, tile } = fixture();
  const source = tile(8, 4, alpha, 0);
  const target = tile(9, 4, null, 0);
  source.type = target.type = 'AG';
  source.shipsByPlayer = { [alpha.id]: 3 };
  target.shipsByPlayer = { [beta.id]: 2 };
  alpha.resources.INFLUENCE = beta.resources.INFLUENCE = 100;
  for (const treaties of [state.nonAggressionPacts, state.freeTradeTreaties]) {
    treaties.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
  }
  const result = state.resolveShipMovement(alpha, { x: 8, y: 4, targetX: 9, targetY: 4, ships: 3 });
  assert.equal(result.ok, true);
  assert.equal(alpha.resources.INFLUENCE, 100);
  assert.equal(beta.resources.INFLUENCE, 100);
  assert.equal(state.nonAggressionPacts.length, 0);
  assert.equal(state.freeTradeTreaties.length, 0);
});

test('mutual invasions penalize each invader once even with several attacks', () => {
  for (const reverse of [false, true]) {
    const { state, alpha, beta, tile, move } = fixture(reverse);
    alpha.resources.INFLUENCE = beta.resources.INFLUENCE = 100;
    tile(8, 4, alpha, 4);
    tile(9, 4, beta, 4);
    tile(8, 5, alpha, 2);
    tile(9, 5, beta, 1);
    state.nonAggressionPacts.push({ playerIds: [alpha.id, beta.id], expiresAfterRound: 5 });
    move(alpha, 8, 4, 9, 4, 2);
    move(alpha, 8, 5, 9, 5, 2, 1);
    move(beta, 9, 4, 8, 4, 2);
    state.resolvePlannedActions();
    assert.equal(alpha.resources.INFLUENCE, 90);
    assert.equal(beta.resources.INFLUENCE, 90);
    assert.equal(state.nonAggressionPacts.length, 0);
    assert.equal(state.eventHistory.filter(event => event.category === 'treaty-breach').length, 2);
  }
});
