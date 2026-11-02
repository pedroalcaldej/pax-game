import test from 'node:test';
import assert from 'node:assert/strict';
import { BotDecisionTable } from '../src/game/BotDecisionTable.js';
import { GameState } from '../src/game/GameState.js';

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
