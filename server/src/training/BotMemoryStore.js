import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NATIONS } from '../../../shared/Constants.js';
import { BotDecisionTable } from '../game/BotDecisionTable.js';

const DEFAULT_MEMORY_FILE = resolve(
  dirname(new URL(import.meta.url).pathname),
  '../../data/bot-decision-memory.json'
);

function createSharedTables(sharedTable) {
  return new Map(NATIONS.map((nation) => [nation.id, sharedTable]));
}

export function loadBotDecisionTables(filePath = DEFAULT_MEMORY_FILE) {
  try {
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    if (stored?.version !== 1 || !stored.table || typeof stored.table !== 'object') {
      throw new Error('El archivo de memoria de bots tiene un formato incompatible.');
    }
    const table = BotDecisionTable.create();
    for (const [key, stats] of Object.entries(stored.table)) {
      if (
        typeof key !== 'string'
        || !stats
        || !Number.isFinite(stats.attempts)
        || !Number.isFinite(stats.successes)
        || !Number.isFinite(stats.reward)
      ) continue;
      table.set(key, {
        attempts: stats.attempts,
        successes: stats.successes,
        reward: stats.reward,
        ...(Number.isFinite(stats.failures) ? { failures: stats.failures } : {}),
        ...(Number.isFinite(stats.finalResults) ? { finalResults: stats.finalResults } : {})
      });
    }
    return createSharedTables(table);
  } catch (error) {
    if (error.code === 'ENOENT') return createSharedTables(BotDecisionTable.create());
    throw new Error(`No se pudo cargar la memoria persistente de los bots: ${error.message}`, {
      cause: error
    });
  }
}

export function saveBotDecisionTables(botDecisionTables, filePath = DEFAULT_MEMORY_FILE) {
  const table = botDecisionTables?.values().next().value;
  if (!(table instanceof Map)) {
    throw new TypeError('No hay una tabla de decisiones válida para guardar.');
  }
  const serializedTable = Object.fromEntries(table);
  const payload = JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    table: serializedTable
  }, null, 2);
  const temporaryPath = `${filePath}.tmp`;
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(temporaryPath, `${payload}\n`, 'utf8');
    renameSync(temporaryPath, filePath);
  } catch (error) {
    throw new Error(`No se pudo guardar la memoria persistente de los bots: ${error.message}`, {
      cause: error
    });
  }
}
