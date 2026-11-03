import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { GameState } from '../src/game/GameState.js';
import { ACTION_MODEL_KEY, ACTION_MODEL_DIMENSION, createActionModel, learnActionReturns,
  fitActionModel, predictActionReturn, validateActionModel, mergeActionModels } from '../src/game/bots/BotActionEvaluator.js';
import { compactBotDecisionTables, loadBotDecisionTables, saveBotDecisionTables, loadLeague, saveLeague } from '../src/training/BotMemoryStore.js';

const safe = { type: 'MOVE_TROOPS', features: { version: 1, troopsSent: 2, sourceTroopsAfter: 4, leavesSourceExposed: 0 } };
const exposed = { type: 'MOVE_TROOPS', features: { version: 1, troopsSent: 6, sourceTroopsAfter: 0, leavesSourceExposed: 1 } };
function learn(table, repetitions = 20, reverse = false) {
  for (let i = 0; i < repetitions; i += 1) learnActionReturns(table, [
    { actionType: safe.type, features: safe.features, target: reverse ? -0.6 : 1 },
    { actionType: exposed.type, features: exposed.features, target: reverse ? 1 : -0.6 }
  ]);
  return fitActionModel(table);
}

test('learned numeric features change action ranking without memorizing a situation key', () => {
  const table = new Map();
  const model = learn(table);
  assert.ok(model.weights.some((weight) => weight !== 0));
  assert.equal(model.weights.length, ACTION_MODEL_DIMENSION);
  assert.ok(predictActionReturn(model, safe) > predictActionReturn(model, exposed));
  const unseen = { ...safe, x: 999, y: 999, features: { ...safe.features, troopsSent: 3, sourceTroopsAfter: 5 } };
  assert.equal(BotDecisionTable.choose(table, 'never-seen-context', [exposed, unseen], () => 1, 0), unseen);
});

test('preferences follow observed returns rather than manually imposed tactical weights', () => {
  const table = new Map();
  learn(table, 20, true);
  assert.equal(BotDecisionTable.choose(table, 'new', [safe, exposed], () => 1, 0), exposed);
});

test('regression interpolates an unseen feature value and keeps weights finite', () => {
  const table = new Map();
  for (let i = 0; i < 60; i += 1) learnActionReturns(table, [-40, -20, 20, 40].map((margin) => ({
    actionType: 'MOVE_TROOPS', features: { version: 1, forceAdvantage: margin }, target: 0.8 * Math.tanh(margin / 20)
  })));
  const model = fitActionModel(table);
  const prediction = predictActionReturn(model, { type: 'MOVE_TROOPS', features: { version: 1, forceAdvantage: 15 } });
  assert.ok(Math.abs(prediction - 0.8 * Math.tanh(15 / 20)) < 0.05);
  assert.equal(validateActionModel(model), true);
});

test('inference is read only, unsupported inputs fall back to the table, and malformed examples are ignored', () => {
  const table = new Map();
  const model = learn(table);
  const before = structuredClone(model);
  for (let i = 0; i < 20; i += 1) predictActionReturn(model, safe);
  BotDecisionTable.choose(table, 'new', [safe, exposed], () => 1, 0);
  assert.deepEqual(model, before);
  assert.equal(predictActionReturn(model, { type: 'MOVE_TROOPS' }), null);
  const empty = new Map();
  learnActionReturns(empty, [{ actionType: 'MOVE_TROOPS', features: { version: 1, troopsSent: NaN }, target: 1 }]);
  assert.equal(empty.has(ACTION_MODEL_KEY), false);
});

test('parallel training statistics merge without counting the parent twice or sharing mutable arrays', () => {
  const parentTable = new Map();
  const parent = learn(parentTable, 10);
  const before = structuredClone(parent);
  const a = new Map([[ACTION_MODEL_KEY, structuredClone(parent)]]);
  const b = new Map([[ACTION_MODEL_KEY, structuredClone(parent)]]);
  learn(a, 4);
  learn(b, 6, true);
  const merged = mergeActionModels(parent, [a.get(ACTION_MODEL_KEY), b.get(ACTION_MODEL_KEY)]);
  assert.equal(merged.episodes, 20);
  assert.equal(merged.samples, 40);
  assert.equal(merged.fittedEpisodes, 20);
  assert.equal(validateActionModel(merged), true);
  assert.deepEqual(parent, before);
  assert.notEqual(merged.weights, parent.weights);
});

test('champion, learner, compaction and historical league preserve exactly the evaluated model', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-evaluator-'));
  try {
    const table = new Map([['c|BUILD_CITY', { attempts: 1, successes: 1, reward: 1 }]]);
    const model = learn(table);
    const tables = new Map([['nation-0', table]]);
    const compact = compactBotDecisionTables(tables).get('nation-0');
    assert.deepEqual(compact.get(ACTION_MODEL_KEY), model);
    assert.notEqual(compact.get(ACTION_MODEL_KEY).gram, model.gram);
    for (const retainAll of [false, true]) {
      const path = join(directory, `memory-${retainAll}.json`);
      saveBotDecisionTables(tables, path, { retainAll });
      const loaded = loadBotDecisionTables(path).get('nation-0');
      assert.deepEqual(loaded.get(ACTION_MODEL_KEY), model);
      assert.equal(predictActionReturn(loaded.get(ACTION_MODEL_KEY), safe), predictActionReturn(model, safe));
    }
    const leaguePath = join(directory, 'league.json');
    saveLeague([table], leaguePath);
    assert.deepEqual(loadLeague(leaguePath)[0].get(ACTION_MODEL_KEY), model);
    const invalid = createActionModel();
    invalid.weights = [1];
    const path = join(directory, 'invalid.json');
    writeFileSync(path, JSON.stringify({ version: 2, table: {}, actionModel: invalid }));
    assert.throws(() => loadBotDecisionTables(path), /evaluador/);
    assert.throws(() => saveBotDecisionTables(new Map([['a', new Map([[ACTION_MODEL_KEY, invalid]])]]), path), /evaluador/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('only learning games convert recorded numeric features and match results into model updates', () => {
  const state = new GameState({ preset: 'quick', mapSeed: 'evaluation-only' });
  const player = state.players.values().next().value;
  const table = state.botDecisionTables.get(player.id);
  player.botDecisionHistory = [{ contextKey: 'c', actionType: safe.type, features: safe.features, round: 1 }];
  state.awardBotFinalRewards();
  assert.equal(table.has(ACTION_MODEL_KEY), false);
  state.trainingMode = true;
  state.awardBotFinalRewards();
  const model = table.get(ACTION_MODEL_KEY);
  assert.equal(model.samples, 1);
  assert.equal(model.episodes, 1);
  assert.equal(model.fittedEpisodes, 1);
  assert.ok(model.weights.every(Number.isFinite));
});
