import { ACTION_MODEL_KEY, validateActionModel } from '../game/bots/BotActionEvaluator.js';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIONS } from '../../../shared/Constants.js';
import { BotDecisionTable } from '../game/bots/BotDecisionTable.js';

const DEFAULT_MEMORY_FILE = resolve(
  dirname(new URL(import.meta.url).pathname),
  '../../data/bot-decision-memory.json'
);
const COMPACT_VERSION = 2;
export const DEFAULT_TRAINING_MEMORY_FILE = resolve(dirname(DEFAULT_MEMORY_FILE), 'bot-training-memory.json');
const MAX_VARIANTS_PER_ACTION = 3;
const DEFAULT_HUMAN_EXPERIENCES_FILE = resolve(dirname(DEFAULT_MEMORY_FILE), 'human-bot-experiences.json');
const MAX_EXPERIENCES = 20000;

function writeJson(filePath, payload) {
  const target = filePath instanceof URL ? fileURLToPath(filePath) : String(filePath);
  const temporaryPath = `${target}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(payload)}\n`, 'utf8');
  renameSync(temporaryPath, target);
}

function readStats(key, stats) {
  const values = Array.isArray(stats) ? stats : [
    stats?.attempts,
    stats?.successes,
    stats?.reward,
    stats?.failures || 0,
    stats?.finalResults || 0
  ];
  if (
    typeof key !== 'string'
    || values.length < 3
    || !values.slice(0, 3).every(Number.isFinite)
  ) return null;
  return {
    attempts: values[0],
    successes: values[1],
    reward: values[2],
    ...(Number.isFinite(values[3]) && values[3] > 0 ? { failures: values[3] } : {}),
    ...(Number.isFinite(values[4]) && values[4] > 0 ? { finalResults: values[4] } : {})
  };
}

function compactTable(table, maxVariants = MAX_VARIANTS_PER_ACTION, roundRewards = true) {
  const contexts = new Map();
  for (const [key, stats] of table) {
    if (key === ACTION_MODEL_KEY) continue;
    const parsed = readStats(key, stats);
    if (!parsed) continue;
    const context = key.slice(0, key.lastIndexOf('|'));
    const actionType = key.slice(key.lastIndexOf('|') + 1).split('~')[0];
    const family = `${context}|${actionType}`;
    const entries = contexts.get(family) || [];
    entries.push([key, parsed]);
    contexts.set(family, entries);
  }
  const compact = {};
  for (const entries of contexts.values()) {
    entries
      .sort((left, right) => (
        (right[1].reward / Math.max(1, right[1].attempts + (right[1].finalResults || 0)))
        - (left[1].reward / Math.max(1, left[1].attempts + (left[1].finalResults || 0)))
      ))
      .slice(0, maxVariants)
      .forEach(([key, stats]) => {
        compact[key] = [
          stats.attempts,
          stats.successes,
          roundRewards ? Math.round(stats.reward * 100) / 100 : stats.reward,
          stats.failures || 0,
          stats.finalResults || 0
        ];
      });
  }
  return compact;
}

function createSharedTables(sharedTable) {
  return new Map(NATIONS.map((nation) => [nation.id, sharedTable]));
}

/** The exact deployable representation, also used before competitive evaluation. */
export function compactBotDecisionTables(botDecisionTables) {
  const table = botDecisionTables.values().next().value;
  const compact = new Map(Object.entries(compactTable(table))
    .map(([key, values]) => [key, readStats(key, values)]));
  if (table.has(ACTION_MODEL_KEY)) compact.set(ACTION_MODEL_KEY, structuredClone(table.get(ACTION_MODEL_KEY)));
  return createSharedTables(compact);
}

export function loadBotDecisionTables(filePath = DEFAULT_MEMORY_FILE) {
  try {
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    if (
      ![1, COMPACT_VERSION].includes(stored?.version)
      || !stored.table
      || typeof stored.table !== 'object'
    ) {
      throw new Error('El archivo de memoria de bots tiene un formato incompatible.');
    }
    const table = BotDecisionTable.create();
    for (const [key, stats] of Object.entries(stored.table)) {
      const parsed = readStats(key, stats);
      if (parsed) table.set(key, parsed);
    }
    if (stored.actionModel !== undefined) {
      if (!validateActionModel(stored.actionModel)) throw new Error('El evaluador de acciones tiene un formato incompatible.');
      table.set(ACTION_MODEL_KEY, stored.actionModel);
    }
    return createSharedTables(table);
  } catch (error) {
    if (error.code === 'ENOENT') return createSharedTables(BotDecisionTable.create());
    throw new Error(`No se pudo cargar la memoria persistente de los bots: ${error.message}`, {
      cause: error
    });
  }
}

export function saveBotDecisionTables(botDecisionTables, filePath = DEFAULT_MEMORY_FILE, { retainAll = false } = {}) {
  const table = botDecisionTables?.values().next().value;
  if (!(table instanceof Map)) {
    throw new TypeError('No hay una tabla de decisiones válida para guardar.');
  }
  const actionModel = table.get(ACTION_MODEL_KEY);
  if (actionModel && !validateActionModel(actionModel)) throw new TypeError('El evaluador de acciones no es válido.');
  const payload = {
    version: COMPACT_VERSION,
    updatedAt: new Date().toISOString(),
    ...(actionModel ? { actionModel } : {}),
    table: compactTable(table, retainAll ? Infinity : MAX_VARIANTS_PER_ACTION, !retainAll)
  };
  try {
    writeJson(filePath, payload);
  } catch (error) {
    throw new Error(`No se pudo guardar la memoria persistente de los bots: ${error.message}`, {
      cause: error
    });
  }
}

export const DEFAULT_LEAGUE_FILE = new URL('../../data/bot-league.json', import.meta.url);

export function loadLeague(path = DEFAULT_LEAGUE_FILE) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.champions)) throw new Error('invalid league');
    return data.champions.map((entries) => {
      if (!Array.isArray(entries)) throw new Error('invalid champion');
      for (const [key, stats] of entries) {
        if (key === ACTION_MODEL_KEY) {
          if (!validateActionModel(stats)) throw new Error('invalid champion action model');
          continue;
        }
        if (typeof key !== 'string' || !stats || !Number.isFinite(stats.reward)
          || !Number.isFinite(stats.attempts)) throw new Error('invalid champion statistics');
      }
      return new Map(entries);
    });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function saveLeague(champions, path = DEFAULT_LEAGUE_FILE) {
  writeJson(path, { version: 1, champions: champions.map((table) => [...table]) });
}

export function loadHumanExperiences(filePath = DEFAULT_HUMAN_EXPERIENCES_FILE) {
  try {
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(stored?.experiences) ? stored.experiences : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`No se pudieron cargar las experiencias humanas: ${error.message}`, {
      cause: error
    });
  }
}

export function recordHumanExperience(experience, filePath = DEFAULT_HUMAN_EXPERIENCES_FILE) {
  const experiences = loadHumanExperiences(filePath);
  experiences.push({
    contextKey: experience.contextKey,
    actionType: experience.actionType,
    ...(experience.action ? { action: Object.fromEntries(Object.entries(experience.action)
      .filter(([key, value]) => ['type', 'x', 'y', 'targetX', 'targetY', 'troops', 'ships', 'count',
        'quantity', 'taxRate', 'treatyType', 'resolutionType'].includes(key)
        && (typeof value === 'string' || Number.isFinite(value)))) } : {}),
    successful: Boolean(experience.successful),
    createdAt: Date.now()
  });
  const payload = {
    version: 2,
    experiences: experiences.slice(-MAX_EXPERIENCES)
  };
  try {
    writeJson(filePath, payload);
  } catch (error) {
    throw new Error(`No se pudo guardar una experiencia humana: ${error.message}`, {
      cause: error
    });
  }
}
