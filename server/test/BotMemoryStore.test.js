import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BotDecisionTable } from '../src/game/BotDecisionTable.js';
import { loadBotDecisionTables, saveBotDecisionTables } from '../src/training/BotMemoryStore.js';

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
