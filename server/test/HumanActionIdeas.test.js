import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameState } from '../src/game/GameState.js';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { indexHumanIdeas, proposeHumanVariants } from '../src/game/bots/BotLearning.js';
import { recordHumanExperience, loadHumanExperiences } from '../src/training/BotMemoryStore.js';

const human = (successful) => ({ contextKey: 'c', actionType: 'BUILD_CITY', successful });

test('human execution success and repetition do not become quality or frequency rewards', () => {
  const success = indexHumanIdeas(Array.from({ length: 100 }, () => human(true)));
  const failure = indexHumanIdeas([human(false)]);
  assert.deepEqual(success, failure);
  assert.equal(success.get('c').size, 1);
});

test('human ideas can be tried during exploration without altering rewards or evaluation decisions', () => {
  const state = new GameState({ mapSeed: 'human-ideas' });
  const table = new Map([
    ['c|BUILD_CITY', { attempts: 1, successes: 0, reward: -60, finalResults: 1 }],
    ['c|BUILD_FACTORY', { attempts: 1, successes: 1, reward: 100, finalResults: 1 }]
  ]);
  const candidates = [{ type: 'BUILD_FACTORY' }, { type: 'BUILD_CITY' }];
  state.botHumanIdeas = indexHumanIdeas([human(true)]);
  const before = structuredClone(table);
  state.trainingMode = true;
  assert.equal(state.chooseBotCandidate(table, 'c', candidates, () => 0, 1).type, 'BUILD_CITY');
  assert.deepEqual(table, before);
  assert.equal(state.chooseBotCandidate(table, 'c', candidates, () => 0.9, 0).type, 'BUILD_FACTORY');
  state.trainingMode = false;
  assert.equal(state.chooseBotCandidate(table, 'c', candidates, () => 0.9, 0).type, 'BUILD_FACTORY');
  assert.deepEqual(table, before);
});

test('human quantities propose legal alternatives rather than reusing map coordinates', () => {
  const state = new GameState({ mapSeed: 'human-variants' });
  const player = state.players.values().next().value;
  player.resources.SILVER = 100;
  player.resources.MATERIALS = 100;
  player.plannedActions = [null, null, null];
  const tile = state.grid.flat().find((tile) => tile.ownerId === player.id && tile.type !== 'AG');
  const base = { type: 'RECRUIT_TROOP', x: tile.x, y: tile.y, count: 1 };
  state.botHumanIdeas = indexHumanIdeas([
    { contextKey: 'c', actionType: base.type, action: { count: 3, x: -100, y: -100 } },
    { contextKey: 'c', actionType: base.type, action: { count: 9999999 } }
  ]);
  state.trainingMode = true;
  const proposals = proposeHumanVariants(state, player, 0, [base], 'c');
  assert.ok(proposals.some((a) => a.count === 3));
  assert.ok(proposals.every((a) => a.x === tile.x && a.y === tile.y));
  assert.ok(proposals.every((a) => state.validatePlannedAction(player, a, 0).ok));
  state.trainingMode = false;
  assert.deepEqual(proposeHumanVariants(state, player, 0, [base], 'c'), [base]);
});

test('a failed bot experiment is penalized even when a human previously executed the idea successfully', () => {
  const table = new Map();
  BotDecisionTable.remember(table, 'c', 'BUILD_CITY', false);
  BotDecisionTable.rememberFinalResult(table, [{ contextKey: 'c', actionType: 'BUILD_CITY', successful: false }], 4);
  assert.ok(table.get('c|BUILD_CITY').reward < 0);
  assert.equal(BotDecisionTable.choose(table, 'c', [{ type: 'BUILD_CITY' }, { type: 'BUILD_FACTORY' }], () => 0.9, 0).type, 'BUILD_FACTORY');
});

test('experience storage retains action parameters, omits connection data and reads legacy records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-human-ideas-'));
  try {
    const path = join(directory, 'experiences.json');
    writeFileSync(path, JSON.stringify({ version: 1, experiences: [human(true)] }));
    recordHumanExperience({ ...human(false), action: { type: 'RECRUIT_TROOP', count: 3, socketId: 'private' } }, path);
    const loaded = loadHumanExperiences(path);
    assert.equal(loaded.length, 2);
    assert.deepEqual(loaded[1].action, { type: 'RECRUIT_TROOP', count: 3 });
    assert.equal(indexHumanIdeas(loaded).get('c').size, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
