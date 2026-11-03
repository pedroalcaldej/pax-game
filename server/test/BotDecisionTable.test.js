import test from 'node:test';
import assert from 'node:assert/strict';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { GameState } from '../src/game/GameState.js';
import { describeAction } from '../src/game/bots/BotLearning.js';

test('decision table learns successful actions for a game situation', () => {
  const table = BotDecisionTable.create();
  const action = { type: 'BUILD_FACTORY', x: 1, y: 1 };

  assert.equal(BotDecisionTable.choose(table, 'context', [action], () => 0.9), action);
  BotDecisionTable.remember(table, 'context', action.type, true);

  assert.deepEqual(table.get('context|BUILD_FACTORY'), {
    attempts: 1,
    successes: 1,
    reward: 0
  });
});

test('decision table prefers the action with the best observed reward', () => {
  const table = BotDecisionTable.create();
  const factory = { type: 'BUILD_FACTORY', x: 1, y: 1 };
  const city = { type: 'BUILD_CITY', x: 2, y: 2 };
  BotDecisionTable.rememberFinalResult(table, [
    { contextKey: 'context', actionType: factory.type }
  ], 4);
  BotDecisionTable.rememberFinalResult(table, [
    { contextKey: 'context', actionType: city.type }
  ], 1);

  assert.equal(
    BotDecisionTable.choose(table, 'context', [factory, city], () => 0.9).type,
    'BUILD_CITY'
  );
});

test('final rank rewards are graduated and punish lower placements', () => {
  const table = BotDecisionTable.create();
  const decisions = [{ contextKey: 'context', actionType: 'BUILD_CITY' }];

  assert.equal(BotDecisionTable.rememberFinalResult(table, decisions, 1), 100);
  assert.equal(BotDecisionTable.rememberFinalResult(table, decisions, 2), 40);
  assert.deepEqual(table.get('context|BUILD_CITY'), {
    attempts: 0,
    successes: 0,
    reward: 140,
    finalResults: 2
  });
});

test('exploration can select an alternative candidate explicitly', () => {
  const table = BotDecisionTable.create();
  const factory = { type: 'BUILD_FACTORY', x: 1, y: 1 };
  const city = { type: 'BUILD_CITY', x: 2, y: 2 };
  let calls = 0;

  const selected = BotDecisionTable.choose(
    table,
    'context',
    [factory, city],
    () => (calls++ === 0 ? 0 : 0.9),
    1
  );

  assert.equal(selected, city);
});

test('failed actions are recorded and terminal credit favors successful recent actions', () => {
  const table = BotDecisionTable.create();
  BotDecisionTable.remember(table, 'context', 'BUILD_FACTORY', false);
  assert.equal(table.get('context|BUILD_FACTORY').failures, 1);

  BotDecisionTable.rememberFinalResult(table, [
    { contextKey: 'context', actionType: 'BUILD_FACTORY', successful: false },
    { contextKey: 'context', actionType: 'BUILD_CITY', successful: true }
  ], 1);

  assert.ok(
    table.get('context|BUILD_CITY').reward > table.get('context|BUILD_FACTORY').reward
  );
});

test('normal games read bot memory without changing it', () => {
  const gameState = new GameState({ maxRounds: 1 });
  const player = gameState.players.get('nation-0');
  const table = gameState.botDecisionTables.get(player.id);

  gameState.rememberBotActionResult(player.id, {
    type: 'BUILD_CITY',
    slot: 0
  }, true);
  gameState.awardBotFinalRewards();

  assert.equal(table.size, 0);
});

test('learns tax variants separately while retaining legacy type fallback', () => {
  const table = BotDecisionTable.create();
  const low = { type: 'SET_TAX_RATE', taxRate: 0.1 };
  const high = { type: 'SET_TAX_RATE', taxRate: 0.3 };
  BotDecisionTable.rememberFinalResult(table, [{
    contextKey: 'tax', actionType: BotDecisionTable.getActionKey(high)
  }], 1);
  assert.equal(BotDecisionTable.choose(table, 'tax', [low, high], () => 0.9, 0), high);
  assert.ok(table.has('tax|SET_TAX_RATE~taxRate=0.3'));
});

test('candidate generation explores multiple legal locations, targets and quantities', () => {
  const state = new GameState({ mapSeed: 'variants', maxRounds: 5 });
  const player = state.players.values().next().value;
  player.resources.SILVER = 1000;
  player.resources.MATERIALS = 1000;
  player.plannedActions = [null, null, null];
  const owned = state.grid.flat().filter((tile) => tile.ownerId === player.id);
  for (const tile of owned) { tile.troops = 8; tile.building = null; }
  const candidates = state.findBotCandidates(player, 0);
  assert.ok(candidates.length > 3);
  assert.ok(candidates.every((action) => state.validatePlannedAction(player, action, 0).ok));
  const recruit = candidates.filter((action) => action.type === 'RECRUIT_TROOP');
  assert.ok(new Set(recruit.map((action) => `${action.x}:${action.y}`)).size > 1);
  assert.ok(new Set(recruit.map((action) => action.count)).size > 1);
  const moves = candidates.filter((action) => action.type === 'MOVE_TROOPS');
  assert.ok(new Set(moves.map((action) => `${action.targetX}:${action.targetY}`)).size > 1);
});

test('fixed opponents have distinct economic and military priorities', () => {
  const state = new GameState({ maxRounds: 5 });
  const actions = [{ type: 'MOVE_TROOPS' }, { type: 'BUILD_FACTORY' }];
  state.activeBotStrategy = 'economic';
  assert.equal(state.chooseBotCandidate(new Map(), 'c', actions).type, 'BUILD_FACTORY');
  state.activeBotStrategy = 'aggressive';
  assert.equal(state.chooseBotCandidate(new Map(), 'c', actions).type, 'MOVE_TROOPS');
});

test('planning a selected action preserves its identity and the random stream', () => {
  const state = new GameState({ mapSeed: 'selected-action' });
  const player = state.players.values().next().value;
  const action = describeAction(state, player, state.findBotCandidates(player, 0)[0]);
  state.botRandom = () => { throw new Error('Planning must not select the action again'); };

  assert.equal(state.planBotAction(player, action, 0), true);
  assert.equal(player.plannedActions[0], action);
  assert.equal(player.botDecisionHistory.length, 1);
  assert.equal(player.botDecisionHistory[0].actionType, action.decisionKey);
  assert.equal(player.botDecisionHistory[0].features, action.features);

  assert.equal(state.planBotAction(player, { type: 'RECRUIT_TROOP', x: -1, y: -1, count: 1 }, 1), false);
  assert.equal(player.plannedActions[1], null);
  assert.equal(player.botDecisionHistory.length, 1);
});

test('zero exploration never adds a confidence bonus to unknown actions', () => {
  const table = new Map([['c|BUILD_CITY', { attempts: 10000, successes: 10000, reward: 1000 }]]);
  const known = { type: 'BUILD_CITY' };
  const unknown = { type: 'BUILD_FACTORY' };
  assert.equal(BotDecisionTable.choose(table, 'c', [known, unknown], () => 0.99, 0), known);
  assert.equal(BotDecisionTable.choose(table, 'c', [known, unknown], () => 0.99, 0.1), unknown);
});

test('winning credits early-round decisions regardless of how many other decisions follow', () => {
  const initial = { contextKey: 'early', actionType: 'BUILD_CITY', round: 1 };
  const final = { contextKey: 'late', actionType: 'BUILD_FACTORY', round: 30 };
  const short = new Map();
  const long = new Map();
  BotDecisionTable.rememberFinalResult(short, [initial, final], 1);
  BotDecisionTable.rememberFinalResult(long, [initial,
    ...Array.from({ length: 150 }, () => ({ contextKey: 'middle', actionType: 'RECRUIT_TROOP', round: 15 })), final], 1);
  const firstReward = long.get('early|BUILD_CITY').reward;
  assert.ok(firstReward > 40);
  assert.equal(firstReward, short.get('early|BUILD_CITY').reward);
});

test('learning generalizes quantities to similar previously unseen situations without overwriting exact evidence', () => {
  const table = new Map();
  const first = 'r1:p4:t2:e2:u2:f0:m1';
  const unseen = 'r1:p4:t8:e9:u3:f1:m8';
  BotDecisionTable.rememberFinalResult(table, [{ contextKey: first, actionType: 'RECRUIT_TROOP~count=5', round: 3 }], 1);
  const recruit = { type: 'RECRUIT_TROOP', count: 6 };
  const city = { type: 'BUILD_CITY' };
  assert.equal(BotDecisionTable.choose(table, unseen, [city, recruit], () => 1, 0), recruit);
  table.set(`${unseen}|RECRUIT_TROOP~count=6`, { attempts: 100, successes: 0, reward: -10000 });
  assert.equal(BotDecisionTable.choose(table, unseen, [city, recruit], () => 1, 0), city);
});
