import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY, GAME_PHASES, OI_RESOLUTIONS, OI_RESOLUTION_DURATION_ROUNDS } from '../../shared/Constants.js';
import { GameState } from '../src/game/GameState.js';
import { InternationalOrganizationEngine as OI } from '../src/game/InternationalOrganizationEngine.js';
import { PhaseManager } from '../src/game/PhaseManager.js';
import { Inspector } from '../../client/src/ui/components/Inspector.js';
import { getGameEventNotifications } from '../../client/src/ui/components/GameEventHistory.js';

function fixture() {
  const state = new GameState({ mapSeed: 'oi-limits' });
  state.gameStarted = true;
  state.currentPhase = 2;
  state.currentRound = 5;
  state.recordHumanExperience = () => {};
  const [player, other] = [...state.players.values()];
  player.isBot = false;
  player.socketId = 'human';
  for (const country of state.players.values()) country.resources = { SILVER: 1000, MATERIALS: 1000, INFLUENCE: 100 };
  for (const tile of state.grid.flat()) {
    Object.assign(tile, { type: 'TR', ownerId: null, nationId: null, troops: 0, building: null, defense: 0 });
    delete tile.visitingTroops;
    delete tile.transportedTroopsByPlayer;
    delete tile.factoriesCount;
  }
  const home = state.grid[4][4];
  Object.assign(home, { ownerId: player.id, type: 'CIU', building: 'CITY', troops: 23 });
  const factories = state.grid.flat().slice(0, 21);
  for (const tile of factories) Object.assign(tile, { ownerId: player.id, type: 'FT', building: 'FACTORY' });
  const approve = () => {
    OI.applyResolution(state, { type: OI_RESOLUTIONS.ARMAMENT_LIMIT }, []);
    OI.applyResolution(state, { type: OI_RESOLUTIONS.INDUSTRY_LIMIT }, []);
  };
  const reduce = (action) => state.performPlayerAction(player.socketId, action);
  return { state, player, other, home, factories, approve, reduce };
}

test('limits allow one full round, charge both excesses each round, and preserve debt', () => {
  const { state, player, approve } = fixture();
  approve();
  assert.equal(state.oiPolicies.armamentLimit, 20);
  assert.equal(state.oiPolicies.industryLimit, 20);
  assert.equal(state.oiPolicies.armamentLimitFinesFromRound, 6);
  player.resources.SILVER = 1;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, 1);
  state.currentRound = 6;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, -10); // 3 troops * 2 + 1 factory * 5
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, -10);
  state.currentRound = 7;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, -21);
  const fines = state.getState().eventHistory.filter(event => event.category === 'oi-limit-fine');
  assert.deepEqual(fines.map(event => [event.round, event.troopFine, event.factoryFine]), [[6, 6, 5], [7, 6, 5]]);
});

test('voluntary reductions before the deadline avoid fines without consuming orders or refunding resources', () => {
  const { state, player, home, factories, approve, reduce } = fixture();
  approve();
  state.currentRound = 6;
  player.plannedActions[0] = { type: 'HOLD_POSITION', x: home.x, y: home.y };
  const actions = structuredClone(player.plannedActions);
  const resources = structuredClone(player.resources);
  assert.equal(reduce({ type: 'DEMOBILIZE_TROOPS', x: home.x, y: home.y, count: 3 }).ok, true);
  assert.equal(reduce({ type: 'DISMANTLE_FACTORY', x: factories[0].x, y: factories[0].y }).ok, true);
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(OI.countTroops(state, player.id), 20);
  assert.equal(OI.countFactories(state, player.id), 20);
  assert.deepEqual(player.resources, resources);
  assert.deepEqual(player.plannedActions, actions);
  assert.ok(!state.eventHistory.some(event => event.category === 'oi-limit-fine'));
});

test('reapproving limits never renews grace and each policy has its own deadline', () => {
  const { state, player } = fixture();
  OI.applyResolution(state, { type: OI_RESOLUTIONS.ARMAMENT_LIMIT }, []);
  state.currentRound = 6;
  OI.applyResolution(state, { type: OI_RESOLUTIONS.ARMAMENT_LIMIT }, []);
  OI.applyResolution(state, { type: OI_RESOLUTIONS.INDUSTRY_LIMIT }, []);
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(state.oiPolicies.armamentLimitFinesFromRound, 6);
  assert.equal(state.oiPolicies.industryLimitFinesFromRound, 7);
  assert.equal(player.resources.SILVER, 994);
});

test('round summary automatically charges fines, including the final round', () => {
  const { state, player, approve } = fixture();
  approve();
  state.currentRound = 6;
  state.settings.maxRounds = 6;
  state.awardBotFinalRewards = () => {};
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  manager.transitionToPhase(GAME_PHASES.PHASE_5_SUMMARY);
  assert.equal(player.resources.SILVER, 989);
  assert.equal(state.gameOver, true);
});

test('troop limits include visitors and embarked troops belonging to each country', () => {
  const { state, player, other, home, approve, reduce } = fixture();
  home.troops = 23;
  home.visitingTroops = { [other.id]: 3 }; // only 20 belong to the owner
  const sea = state.grid[4][5];
  Object.assign(sea, { type: 'AG', ownerId: other.id, transportedTroopsByPlayer: { [player.id]: 4, [other.id]: 2 } });
  approve();
  assert.equal(OI.countTroops(state, player.id), 24);
  assert.equal(OI.countTroops(state, other.id), 5);
  assert.equal(reduce({ type: 'DEMOBILIZE_TROOPS', x: sea.x, y: sea.y, count: 4, embarked: true }).ok, true);
  assert.equal(OI.countTroops(state, player.id), 20);
  assert.equal(sea.transportedTroopsByPlayer[other.id], 2);
  assert.equal(reduce({ type: 'DEMOBILIZE_TROOPS', x: home.x, y: home.y, count: 21 }).ok, false);
});

test('demobilization allows withdrawing own visiting troops without harming foreign troops', () => {
  const { state, player, other, home, reduce } = fixture();
  Object.assign(home, { ownerId: other.id, troops: 8, visitingTroops: { [player.id]: 3 } });
  assert.equal(reduce({ type: 'DEMOBILIZE_TROOPS', x: home.x, y: home.y, count: 2 }).ok, true);
  assert.equal(home.troops, 6);
  assert.equal(home.visitingTroops[player.id], 1);
  assert.equal(state.getTroopsForPlayerOnTile(home, other.id), 5);
});

test('reductions reject invalid quantities, foreign factories and inactive phases', () => {
  const { state, player, other, home, factories, reduce } = fixture();
  const action = { type: 'DEMOBILIZE_TROOPS', x: home.x, y: home.y, count: 1 };
  for (const count of [0, -1, 1.5, NaN, 24]) assert.equal(reduce({ ...action, count }).ok, false);
  factories[0].ownerId = other.id;
  assert.equal(reduce({ type: 'DISMANTLE_FACTORY', x: factories[0].x, y: factories[0].y }).ok, false);
  for (const phase of [1, 3, 4, 5, 6]) {
    state.currentPhase = phase;
    assert.equal(reduce(action).ok, false);
  }
  state.currentPhase = 2;
  state.gameOver = true;
  assert.equal(reduce(action).ok, false);
  state.gameOver = false;
  player.isEliminated = true;
  assert.equal(reduce(action).ok, false);
  assert.equal(home.troops, 23);
});

test('dismantling restores each original terrain and preserves troops, vehicles and ownership', () => {
  const { state, player, factories, reduce } = fixture();
  for (const [index, type] of ['TR', 'MPT', 'AG', 'MPA'].entries()) {
    const tile = factories[index];
    Object.assign(tile, { type, building: null, troops: 2, shipsByPlayer: { [player.id]: 1 } });
    assert.equal(state.applyPlayerAction(player, tile, 'BUILD_FACTORY').ok, true);
    const resources = structuredClone(player.resources);
    assert.equal(reduce({ type: 'DISMANTLE_FACTORY', x: tile.x, y: tile.y }).ok, true);
    assert.equal(tile.type, type);
    assert.equal(tile.building, null);
    assert.equal(tile.ownerId, player.id);
    assert.equal(tile.troops, 2);
    assert.equal(tile.shipsByPlayer[player.id], 1);
    assert.deepEqual(player.resources, resources);
  }
});

test('recruitment cannot evade limits through queued orders or execution after the count changes', () => {
  const { state, player, home, approve } = fixture();
  home.troops = 19;
  approve();
  const action = { type: 'RECRUIT_TROOP', x: home.x, y: home.y, count: 1 };
  assert.equal(state.performPlayerAction(player.socketId, { type: 'PLAN_ACTION', slot: 0, plannedAction: action }).ok, true);
  assert.equal(state.performPlayerAction(player.socketId, { type: 'PLAN_ACTION', slot: 1, plannedAction: action }).ok, false);
  home.troops = 20;
  const resources = structuredClone(player.resources);
  assert.equal(state.applyPlayerAction(player, home, action.type, action).ok, false);
  assert.deepEqual(player.resources, resources);
  assert.equal(home.troops, 20);
});

test('inspector offers immediate reductions for owned factories and embarked troops', () => {
  const { state, player, other, home, factories } = fixture();
  const inspector = Object.assign(Object.create(Inspector.prototype), {
    player, phase: 2, activeSlot: 0, actionQuantities: new Map(), grid: state.grid
  });
  const actions = (tile) => inspector.getActions(tile);
  assert.equal(actions(home).find(action => action.type === 'DEMOBILIZE_TROOPS').quantity.max, 23);
  assert.equal(actions(factories[0]).find(action => action.type === 'DISMANTLE_FACTORY').enabled, true);
  factories[0].ownerId = other.id;
  assert.equal(actions(factories[0]).find(action => action.type === 'DISMANTLE_FACTORY').enabled, false);
  Object.assign(home, { type: 'AG', transportedTroopsByPlayer: { [player.id]: 4 } });
  assert.equal(actions(home).find(action => action.type === 'DEMOBILIZE_TROOPS').quantity.max, 4);
});

test('approval notifications reach all countries and fine notifications only the fined country', () => {
  const { state, player, other, approve } = fixture();
  approve();
  state.currentRound = 6;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(getGameEventNotifications(state.eventHistory, player.id).length, 3);
  assert.equal(getGameEventNotifications(state.eventHistory, other.id).length, 2);
  assert.equal(ECONOMY.OI_LIMITS.GRACE_ROUNDS, 1);
});

test('both limits expire after five complete rounds without another OI meeting', () => {
  const { state, player, home, factories, approve } = fixture();
  approve(); // meeting at the end of round 5; active through rounds 6 to 10
  const lastRound = 5 + OI_RESOLUTION_DURATION_ROUNDS;
  assert.equal(state.oiPolicies.armamentLimitExpiresAfterRound, lastRound);
  assert.equal(state.oiPolicies.industryLimitExpiresAfterRound, lastRound);
  state.currentRound = lastRound;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, 989);
  state.currentRound += 1;
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  manager.schedulePhase = () => {};
  manager.transitionToPhase(GAME_PHASES.PHASE_1_STATS);
  assert.equal(state.oiPolicies.armamentLimit, null);
  assert.equal(state.oiPolicies.industryLimit, null);
  assert.equal(state.oiPolicies.armamentLimitFinesFromRound, undefined);
  assert.equal(state.oiPolicies.industryLimitExpiresAfterRound, undefined);
  const silver = player.resources.SILVER;
  OI.enforceLimitsAtRoundEnd(state);
  assert.equal(player.resources.SILVER, silver);
  state.currentPhase = 2;
  assert.equal(state.validatePlannedAction(player, {
    type: 'RECRUIT_TROOP', x: home.x, y: home.y, count: 1
  }, 0).ok, true);
  const buildTile = state.grid[6][6];
  buildTile.ownerId = player.id;
  assert.equal(state.validatePlannedAction(player, {
    type: 'BUILD_FACTORY', x: buildTile.x, y: buildTile.y
  }, 0).ok, true);
  assert.equal(factories[0].building, 'FACTORY');
  const events = state.eventHistory.filter(event => event.category === 'oi-resolution-expired');
  assert.equal(events.length, 2);
  OI.expireResolutionsBeforeRound(state);
  assert.equal(state.eventHistory.filter(event => event.category === 'oi-resolution-expired').length, 2);
});

test('renewal extends a limit for five rounds without renewing grace; a fresh approval after expiry grants grace', () => {
  const { state, approve } = fixture();
  approve();
  state.currentRound = 8;
  OI.applyResolution(state, { type: OI_RESOLUTIONS.ARMAMENT_LIMIT }, []);
  assert.equal(state.oiPolicies.armamentLimitExpiresAfterRound, 8 + OI_RESOLUTION_DURATION_ROUNDS);
  assert.equal(state.oiPolicies.armamentLimitFinesFromRound, 6);
  state.currentRound = 11;
  OI.expireResolutionsBeforeRound(state);
  assert.equal(state.oiPolicies.industryLimit, null);
  assert.equal(state.oiPolicies.armamentLimit, 20);
  OI.applyResolution(state, { type: OI_RESOLUTIONS.INDUSTRY_LIMIT }, []);
  assert.equal(state.oiPolicies.industryLimitExpiresAfterRound, 11 + OI_RESOLUTION_DURATION_ROUNDS);
  assert.equal(state.oiPolicies.industryLimitFinesFromRound, 12);
});

test('DMZ and subsidy pacts cover the same five complete rounds independently of meeting frequency', () => {
  const { state, player, other } = fixture();
  state.settings.oiFrequency = 0;
  OI.applyResolution(state, { type: OI_RESOLUTIONS.DEMILITARIZED_ZONE, target: { x: 15, y: 15 } }, []);
  other.resources = { SILVER: 0, MATERIALS: 0, INFLUENCE: 0 };
  const paymentBefore = other.resources.SILVER;
  OI.applyResolution(state, { type: OI_RESOLUTIONS.CONDITIONAL_SUBSIDY, beneficiaryId: other.id }, [
    { playerId: player.id, choice: 'FOR' }
  ]);
  const lastRound = 5 + OI_RESOLUTION_DURATION_ROUNDS;
  assert.equal(state.activeDmzZones[0].expiresAfterRound, lastRound);
  assert.equal(state.nonAggressionPacts[0].expiresAfterRound, lastRound);
  state.currentRound = lastRound;
  assert.equal(OI.isInActiveDmz(state, 15, 15), true);
  assert.equal(OI.arePlayersBoundByPact(state, player.id, other.id), true);
  state.expireTreatiesAfterRound(lastRound);
  state.currentRound += 1;
  assert.equal(OI.isInActiveDmz(state, 15, 15), false);
  assert.equal(OI.arePlayersBoundByPact(state, player.id, other.id), false);
  OI.expireResolutionsBeforeRound(state);
  assert.equal(state.activeDmzZones.length, 0);
  assert.equal(other.resources.SILVER, paymentBefore + ECONOMY.COSTS.OI_SUBSIDY_SILVER);
});

test('older saved limits recover expiration from their original grace deadline', () => {
  const { state, approve } = fixture();
  approve();
  delete state.oiPolicies.armamentLimitExpiresAfterRound;
  delete state.oiPolicies.industryLimitExpiresAfterRound;
  state.currentRound = 5 + OI_RESOLUTION_DURATION_ROUNDS + 1;
  OI.expireResolutionsBeforeRound(state);
  assert.equal(state.oiPolicies.armamentLimit, null);
  assert.equal(state.oiPolicies.industryLimit, null);
});
