import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { extractActionFeatures, createActionFeatureContext } from '../src/game/bots/BotActionFeatures.js';
import { describeAction } from '../src/game/bots/BotLearning.js';

function fixture() {
  const state = new GameState({ preset: 'quick', mapSeed: 'action-features' });
  const [player, enemy] = [...state.players.values()];
  for (const tile of state.grid.flat()) {
    Object.assign(tile, { type: 'TR', ownerId: player.id, nationId: player.nationId, troops: 0, population: 0, building: null });
    delete tile.visitingTroops;
  }
  state.grid[4][8].troops = 6;
  Object.assign(state.grid[4][9], { ownerId: enemy.id, nationId: enemy.nationId, troops: 1 });
  const action = (troops = 2) => ({ type: 'MOVE_TROOPS', x: 8, y: 4, targetX: 9, targetY: 4, troops });
  return { state, player, enemy, action };
}

test('describes attack strength, one-for-one losses and reserve rather than treating every winning attack alike', () => {
  const { state, player, action } = fixture();
  const economical = extractActionFeatures(state, player, action(2));
  const large = extractActionFeatures(state, player, action(5));
  assert.equal(economical.visibleDefenders, 1);
  assert.equal(economical.forceRatio, 2);
  assert.equal(economical.forceLossesIfDefendersStay, 1);
  assert.equal(economical.forceSurvivorsIfDefendersStay, 1);
  assert.equal(economical.sourceTroopsAfter, 4);
  assert.equal(large.forceSurvivorsIfDefendersStay, 4);
  assert.equal(large.sourceTroopsAfter, 1);
  assert.ok(Object.values(large).every(Number.isFinite));
  state.resolveTroopMovement(player, action(2));
  assert.equal(state.grid[4][9].troops, economical.forceSurvivorsIfDefendersStay);
  assert.equal(state.grid[4][8].troops, economical.sourceTroopsAfter);
});

test('uses own reservations and diagonal enemy threats to describe an exposed capital', () => {
  const { state, player, enemy, action } = fixture();
  const source = state.grid[4][8];
  source.type = 'CAP';
  source.population = 50;
  player.plannedActions[0] = { ...action(3), targetX: 7 };
  Object.assign(state.grid[3][7], { ownerId: enemy.id, troops: 4 });
  const described = describeAction(state, player, action(3));
  assert.equal(described.features.sourceTroopsReserved, 3);
  assert.equal(described.features.sourceTroopsAfter, 0);
  assert.equal(described.features.sourceIsCapital, 1);
  assert.equal(described.features.sourcePopulation, 50);
  assert.equal(described.features.sourceEnemyAdjacentTroops, 5);
  assert.equal(described.features.leavesSourceExposed, 1);
  const safe = describeAction(state, player, action(1));
  assert.equal(safe.features.sourceTroopsAfter, 2);
  assert.equal(safe.features.leavesSourceExposed, 0);
  assert.notEqual(safe.decisionKey, described.decisionKey);
});

test('describes city income, resource access, factories and active treaty penalties', () => {
  const { state, player, enemy, action } = fixture();
  const target = state.grid[4][9];
  Object.assign(target, { type: 'CAP', population: 100, building: 'FACTORY', factoriesCount: 2 });
  state.nonAggressionPacts = [{ playerIds: [player.id, enemy.id], expiresAfterRound: 5 }];
  state.freeTradeTreaties = [{ playerIds: [player.id, enemy.id], expiresAfterRound: 5 }];
  const f = extractActionFeatures(state, player, action());
  assert.equal(f.targetIsCapital, 1);
  assert.equal(f.targetPopulation, 100);
  assert.ok(f.targetTaxIncome > 0);
  assert.equal(f.targetMaterialProduction, 4);
  assert.equal(f.populationGainIfCaptured, 100);
  assert.equal(f.materialProductionGain, 4);
  assert.equal(f.breaksNonAggressionPact, 1);
  assert.equal(f.breaksFreeTradeTreaty, 1);
  assert.equal(f.pactInfluencePenalty, 10);
  state.currentRound = 6;
  assert.equal(extractActionFeatures(state, player, action()).pactInfluencePenalty, 0);
  target.type = 'MPT';
  assert.equal(extractActionFeatures(state, player, action()).targetIsResource, 1);
});

test('never reads opponent planned actions or changes the live board while describing a move', () => {
  const { state, player, enemy, action } = fixture();
  const before = structuredClone(state.grid);
  const stationary = extractActionFeatures(state, player, action());
  Object.defineProperty(enemy, 'plannedActions', { get() { throw new Error('Private orders accessed'); } });
  assert.deepEqual(extractActionFeatures(state, player, action()), stationary);
  assert.deepEqual(state.grid, before);
  assert.equal(state.nonAggressionPacts.length, 0);
});

test('describes separate resource budgets, production and tax consequences', () => {
  const { state, player } = fixture();
  player.resources.SILVER = 20;
  player.resources.MATERIALS = 80;
  player.plannedActions[0] = { type: 'BUILD_FACTORY', x: 5, y: 5 };
  const recruit = extractActionFeatures(state, player, { type: 'RECRUIT_TROOP', x: 8, y: 4, count: 2 });
  assert.equal(recruit.availableSilver, 10);
  assert.equal(recruit.silverCost, 10);
  assert.equal(recruit.materialCost, 40);
  assert.equal(recruit.silverAfter, 0);
  assert.equal(recruit.materialsAfter, 40);
  assert.equal(recruit.sourceTroopsAfter, 8);
  const factory = extractActionFeatures(state, player, { type: 'BUILD_FACTORY', x: 6, y: 6 });
  assert.equal(factory.materialProductionGain, 2);
  Object.assign(state.grid[5][5], { type: 'CAP', population: 100 });
  const tax = describeAction(state, player, { type: 'SET_TAX_RATE', taxRate: 0.3 });
  assert.ok(tax.features.taxIncomeDelta > 0);
  assert.ok(tax.features.taxPopulationDelta <= 0);
  assert.ok(Object.values(tax.features).every(Number.isFinite));
  assert.equal(extractActionFeatures(state, player, { type: 'PROPOSE_TREATY' }).influenceCost, 0);
  assert.equal(extractActionFeatures(state, player, { type: 'PROPOSE_OI_RESOLUTION' }).influenceCost, 2);
});

test('old champion keys remain readable and new features do not change the execution identity', () => {
  const { state, player, action } = fixture();
  const move = describeAction(state, player, action());
  const city = describeAction(state, player, { type: 'BUILD_CITY', x: 7, y: 4 });
  const table = new Map([[`c|${move.legacyDecisionKey}`, { attempts: 1, successes: 1, reward: 100, finalResults: 1 }]]);
  assert.equal(BotDecisionTable.choose(table, 'c', [city, move], () => 1, 0), move);
  assert.equal(BotDecisionTable.candidateIdentity(move), BotDecisionTable.candidateIdentity(action()));
  assert.equal(move.decisionKey.includes('~f1:'), true);
});

test('features are invariant under translation and reuse one neighborhood cache for a decision', () => {
  const { state, player, action } = fixture();
  const context = createActionFeatureContext(state, player);
  const first = extractActionFeatures(state, player, action(), context);
  const count = context.neighborhoods.size;
  extractActionFeatures(state, player, action(3), context);
  assert.equal(context.neighborhoods.size, count);
  const shifted = structuredClone(state.grid);
  for (let y = 1; y < state.grid.length; y += 1) for (let x = 1; x < state.grid[y].length; x += 1) {
    shifted[y][x] = { ...state.grid[y - 1][x - 1], x, y };
  }
  state.grid = shifted;
  const second = extractActionFeatures(state, player, { ...action(), x: 9, y: 5, targetX: 10, targetY: 5 });
  assert.deepEqual(second, first);
});

test('decision features stay internal in the bot history instead of growing public state every round', () => {
  const { state, player } = fixture();
  player.botDecisionHistory = [{ contextKey: 'c', actionType: 'MOVE_TROOPS', features: { troopsSent: 2 } }];
  assert.equal('botDecisionHistory' in state.getState().players[0], false);
});


test('naval descriptors deduct ships and cargo already reserved by own orders', () => {
  const { state, player } = fixture();
  const source = state.grid[4][8];
  source.type = 'AG';
  source.troops = 0;
  source.shipsByPlayer = { [player.id]: 3 };
  source.transportedTroopsByPlayer = { [player.id]: 12 };
  player.plannedActions[0] = { type: 'MOVE_SHIPS', x: 8, y: 4, targetX: 7, targetY: 4, ships: 1 };
  const features = extractActionFeatures(state, player,
    { type: 'MOVE_SHIPS', x: 8, y: 4, targetX: 8, targetY: 5, ships: 1 });
  assert.equal(features.sourceShipsAfter, 1);
  assert.equal(features.sourceCargoBefore, 12);
  assert.equal(features.sourceCargoAfter, 2);
  const landing = extractActionFeatures(state, player,
    { type: 'DISEMBARK_TROOPS', x: 8, y: 4, targetX: 9, targetY: 4, troops: 2 });
  assert.equal(landing.sourceCargoAfter, 5);
  assert.equal(landing.sourceTroopsAfter, 5);
});
