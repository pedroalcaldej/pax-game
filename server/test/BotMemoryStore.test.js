import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { loadBotDecisionTables, saveBotDecisionTables, loadLeague, saveLeague } from '../src/training/BotMemoryStore.js';

test('bot decision memory survives saving and loading', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-bot-memory-'));
  const filePath = join(directory, 'memory.json');
  try {
    const table = BotDecisionTable.create();
    BotDecisionTable.remember(table, 'context', 'BUILD_CITY', true);
    const tables = new Map([
      ['nation-0', table],
      ['nation-1', table]
    ]);

    saveBotDecisionTables(tables, filePath);
    const loaded = loadBotDecisionTables(filePath);

    assert.deepEqual(loaded.get('nation-0'), loaded.get('nation-1'));
    assert.deepEqual(loaded.get('nation-0').get('context|BUILD_CITY'), {
      attempts: 1,
      successes: 1,
      reward: 0
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('preserves different action families instead of keeping only three actions per context', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-bot-memory-'));
  const filePath = join(directory, 'memory.json');
  try {
    const table = BotDecisionTable.create();
    for (const [action, reward] of [
      ['BUILD_CITY', 50], ['BUILD_FACTORY', 40], ['MOVE_TROOPS', 30], ['RECRUIT_TROOP', 20]
    ]) {
      table.set(`context|${action}`, { attempts: 2, successes: 2, reward });
    }
    saveBotDecisionTables(new Map([['nation-0', table]]), filePath);
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(stored.version, 2);
    assert.equal(Object.keys(stored.table).length, 4);
    assert.ok(Array.isArray(stored.table['context|BUILD_CITY']));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the representation evaluated in training survives deployment unchanged', async () => {
  const { compactBotDecisionTables } = await import('../src/training/BotMemoryStore.js');
  const directory = mkdtempSync(join(tmpdir(), 'pax-deployment-'));
  try {
    const table = new Map(Array.from({ length: 5 }, (_, index) => [
      `context|SET_TAX_RATE~taxRate=${index / 10}`,
      { attempts: 1, successes: 1, reward: 12.3456 + index }
    ]));
    const compact = compactBotDecisionTables(new Map([['nation-0', table]]));
    const path = join(directory, 'memory.json');
    saveBotDecisionTables(compact, path);
    assert.deepEqual(loadBotDecisionTables(path), compact);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('deployment retains three variants per action family and learner storage retains all experiments', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-family-memory-'));
  try {
    const table = new Map();
    for (const type of ['BUILD_CITY', 'MOVE_TROOPS', 'SET_TAX_RATE']) {
      for (let index = 0; index < 5; index += 1) table.set(`c|${type}~variant=${index}`,
        { attempts: 1, successes: 1, reward: index - 5.123456 });
    }
    const tables = new Map([['nation-0', table]]);
    const champion = join(directory, 'champion.json');
    const learner = join(directory, 'learner.json');
    saveBotDecisionTables(tables, champion);
    const deployed = loadBotDecisionTables(champion).get('nation-0');
    assert.equal(deployed.size, 9);
    for (const type of ['BUILD_CITY', 'MOVE_TROOPS', 'SET_TAX_RATE']) {
      assert.equal([...deployed.keys()].filter((key) => key.startsWith(`c|${type}~`)).length, 3);
    }
    saveBotDecisionTables(tables, learner, { retainAll: true });
    assert.deepEqual(loadBotDecisionTables(learner).get('nation-0'), table);
    assert.equal(loadBotDecisionTables(champion).get('nation-0').size, 9);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('historical champions survive reload without sharing mutable statistics', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pax-league-'));
  try {
    const path = join(directory, 'league.json');
    assert.deepEqual(loadLeague(path), []);
    const table = new Map([['context|BUILD_CITY', { reward: 10, attempts: 2, successes: 1 }]]);
    saveLeague([table], path);
    const loaded = loadLeague(path);
    assert.deepEqual(loaded, [table]);
    loaded[0].get('context|BUILD_CITY').reward = -1;
    assert.equal(loadLeague(path)[0].get('context|BUILD_CITY').reward, 10);
    writeFileSync(path, '{"version":1,"champions":[[["bad",{}]]]}');
    assert.throws(() => loadLeague(path), /invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
