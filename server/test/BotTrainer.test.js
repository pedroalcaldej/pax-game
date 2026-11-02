import test from 'node:test';
import assert from 'node:assert/strict';
import { trainBots } from '../src/training/BotTrainer.js';

test('trains four bots using one shared decision table', () => {
  const result = trainBots({
    games: 2,
    seed: 123,
    settings: { maxRounds: 2, oiFrequency: 0 },
    persist: false
  });

  assert.equal(result.games, 2);
  assert.equal(result.sharedMemory, true);
  assert.equal(Object.keys(result.wins).length, 4);
  assert.ok(result.learnedSituations > 0);
  assert.ok(Object.values(result.averageGdi).every(Number.isFinite));
  assert.ok(result.baseline);
  assert.equal(Object.keys(result.comparison).length, 4);
});
