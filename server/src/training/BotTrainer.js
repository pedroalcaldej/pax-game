import { ACTION_MODEL_KEY, mergeActionModels, actionModelSummary } from '../game/bots/BotActionEvaluator.js';
import { indexHumanIdeas, strategicPotential, rewardRound } from '../game/bots/BotLearning.js';
import { availableParallelism } from 'node:os';
import { TrainingPool } from './TrainingPool.js';
import { NATIONS } from '../../../shared/Constants.js';
import { EconomyEngine } from '../game/EconomyEngine.js';
import { GameState } from '../game/GameState.js';
import { InternationalOrganizationEngine } from '../game/InternationalOrganizationEngine.js';
import { BotDecisionTable } from '../game/bots/BotDecisionTable.js';
import { DEFAULT_TRAINING_MEMORY_FILE, compactBotDecisionTables, loadBotDecisionTables, saveBotDecisionTables, loadLeague, saveLeague, loadHumanExperiences } from './BotMemoryStore.js';

function createSharedDecisionTables(persisted = false, memoryPath) {
  if (persisted) return loadBotDecisionTables(memoryPath);
  const sharedTable = BotDecisionTable.create();
  return new Map(NATIONS.map((nation) => [nation.id, sharedTable]));
}

function cloneSharedDecisionTables(source) {
  const sourceTable = source.values().next().value;
  const clonedTable = BotDecisionTable.create();
  for (const [key, stats] of sourceTable) {
    clonedTable.set(key, key === ACTION_MODEL_KEY ? structuredClone(stats) : { ...stats });
  }
  return new Map(NATIONS.map((nation) => [nation.id, clonedTable]));
}

/** Merge independent experiment deltas without counting their shared parent twice. */
export function mergeLearningTables(parent, candidates) {
  const merged = cloneSharedDecisionTables(parent);
  const base = parent.values().next().value;
  const table = merged.values().next().value;
  const fields = ['attempts', 'successes', 'reward', 'failures', 'finalResults'];
  for (const candidate of candidates) {
    for (const [key, stats] of candidate.values().next().value) {
      if (key === ACTION_MODEL_KEY) continue;
      const previous = base.get(key);
      const deltas = fields.map((field) => [field, (stats[field] || 0) - (previous?.[field] || 0)]);
      if (!deltas.some(([, delta]) => delta !== 0)) continue;
      const target = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
      for (const [field, delta] of deltas) if (delta !== 0) target[field] = (target[field] || 0) + delta;
      table.set(key, target);
    }
  }
  const model = mergeActionModels(base.get(ACTION_MODEL_KEY),
    candidates.map((candidate) => candidate.values().next().value.get(ACTION_MODEL_KEY)));
  if (model) table.set(ACTION_MODEL_KEY, model);
  return merged;
}

function createTrainingSettings(settings, seed, maxRounds) {
  return {
    ...settings,
    maxRounds,
    mapSeed: String(seed)
  };
}

function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function simulateGame(sharedTables, settings, seed, explorationRate, learn = true, strategies = {}, policies = {}, humanIdeas = null) {
  const gameState = new GameState(
    createTrainingSettings(settings, seed, settings.maxRounds),
    sharedTables
  );
  gameState.botSearchWidth = settings.botSearchWidth ?? 3;
  gameState.botDirectedExploration = settings.botDirectedExploration !== false;
  gameState.botIntermediateRewards = settings.botIntermediateRewards !== false;
  gameState.botHumanIdeas = learn ? humanIdeas : null;
  gameState.botStrategies = strategies;
  gameState.botPolicies = policies;
  gameState.botRandom = seededRandom(seed);
  gameState.gameStarted = true;
  gameState.trainingMode = learn;
  gameState.botExplorationRate = explorationRate;
  const roundRankings = [];

  for (let round = 1; round <= gameState.settings.maxRounds; round += 1) {
    const before = new Map([...gameState.players.keys()].map((id) => [id, strategicPotential(gameState, id)]));
    const historyStarts = new Map([...gameState.players.values()].map((p) => [p.id, p.botDecisionHistory?.length || 0]));
    gameState.currentRound = round;
    gameState.currentPhase = 1;
    gameState.processBondsAtRoundStart(round);
    if (round > 1) EconomyEngine.processRoundEconomy(gameState);

    gameState.currentPhase = 2;
    gameState.runBotDecisions();
    gameState.currentPhase = 3;
    gameState.resolvePlannedActions();

    if (
      gameState.settings.oiFrequency > 0
      && round % gameState.settings.oiFrequency === 0
    ) {
      gameState.currentPhase = 6;
      const session = InternationalOrganizationEngine.startSession(gameState);
      if (session.phase === 'voting') {
        InternationalOrganizationEngine.finishSession(gameState);
      }
    }

    gameState.currentPhase = 5;
    EconomyEngine.awardEndOfTurnInfluence(gameState);
    rewardRound(gameState, before, historyStarts);
    roundRankings.push([...gameState.players.values()]
      .sort((left, right) => (
        gameState.calculateGDI(right) - gameState.calculateGDI(left)
        || left.nationId - right.nationId
      ))
      .map((player, index) => ({
        playerId: player.id,
        rank: index + 1
      })));
  }

  gameState.gameOver = true;
  const rewards = gameState.awardBotFinalRewards();
  const ranking = [...gameState.players.values()]
    .sort((left, right) => (
      gameState.calculateGDI(right) - gameState.calculateGDI(left)
      || left.nationId - right.nationId
    ));

  return {
    roundRankings,
    ranking: ranking.map((player, index) => ({
      playerId: player.id,
      rank: index + 1,
      gdiPoints: gameState.calculateGDI(player)
    })),
    rewards
  };
}

function summarizeResults(results, games) {
  const wins = new Map(NATIONS.map((nation) => [nation.id, 0]));
  const turnWins = new Map(NATIONS.map((nation) => [nation.id, 0]));
  const averageGdi = new Map(NATIONS.map((nation) => [nation.id, 0]));
  const averageReward = new Map(NATIONS.map((nation) => [nation.id, 0]));
  for (const result of results) {
    for (const entry of result.ranking) {
      averageGdi.set(entry.playerId, averageGdi.get(entry.playerId) + entry.gdiPoints);
      if (entry.rank === 1) wins.set(entry.playerId, wins.get(entry.playerId) + 1);
    }
    for (const roundRanking of result.roundRankings) {
      for (const entry of roundRanking) {
        if (entry.rank === 1) {
          turnWins.set(entry.playerId, turnWins.get(entry.playerId) + 1);
        }
      }
    }
    for (const entry of result.rewards) {
      averageReward.set(
        entry.playerId,
        averageReward.get(entry.playerId) + entry.reward
      );
    }
  }
  return {
    wins: Object.fromEntries(wins),
    turnWins: Object.fromEntries(turnWins),
    averageGdi: Object.fromEntries(
      [...averageGdi].map(([playerId, total]) => [playerId, total / games])
    ),
    averageReward: Object.fromEntries(
      [...averageReward].map(([playerId, total]) => [playerId, total / games])
    )
  };
}

function summarizeLearning(table, previousSize = 0) {
  let attempts = 0;
  let successes = 0;
  let failures = 0;
  let finalResults = 0;
  const contexts = new Set();
  const actionTypes = new Set();
  let generalizedEntries = 0;

  for (const [key, stats] of table) {
    if (key === ACTION_MODEL_KEY) continue;
    if (key.startsWith('@general:')) { generalizedEntries += 1; continue; }
    const separator = key.lastIndexOf('|');
    contexts.add(key.slice(0, separator));
    actionTypes.add(key.slice(separator + 1));
    attempts += stats.attempts || 0;
    successes += stats.successes || 0;
    failures += stats.failures || 0;
    finalResults += stats.finalResults || 0;
  }

  return {
    previousEntries: previousSize,
    generalizedEntries,
    entries: table.size,
    newEntries: Math.max(0, table.size - previousSize),
    contexts: contexts.size,
    attempts,
    successes,
    failures,
    finalResults,
    actionTypes: actionTypes.size
  };
}

function trainCandidate(
  previousTables,
  humanExperiences,
  games,
  settings,
  seed,
  onProgress,
  candidate,
  candidates
) {
  const tables = cloneSharedDecisionTables(previousTables);
  const table = tables.values().next().value;
  const humanIdeas = indexHumanIdeas(humanExperiences);
  const results = [];
  for (let game = 0; game < games; game += 1) {
    const explorationRate = Math.max(0.01, 0.12 * (1 - game / games));
    results.push(simulateGame(
      tables,
      settings,
      Number(seed) + game,
      explorationRate,
      true, {}, {}, humanIdeas
    ));
    onProgress({
      phase: 'training',
      completed: game + 1,
      total: games,
      candidate,
      candidates
    });
  }
  return {
    tables,
    table,
    results,
    summary: {
      games,
      sharedMemory: true,
      ...summarizeResults(results, games),
      learnedSituations: table.size,
      learning: summarizeLearning(
        table,
        previousTables.values().next().value.size
      ),
      decisionTable: table
    }
  };
}

export function executeTrainingTask(task, onProgress = () => {}) {
  if (task.kind === 'simulate') {
    return simulateGame(task.tables, task.settings, task.seed, 0, false, task.strategies, task.policies);
  }
  if (task.kind === 'train') {
    const candidate = trainCandidate(task.tables, task.experiences, task.games, task.settings,
      task.seed, onProgress, task.candidate, task.candidates);
    candidate.learningTables = candidate.tables;
    candidate.tables = compactBotDecisionTables(candidate.tables);
    candidate.table = candidate.tables.values().next().value;
    candidate.summary.decisionTable = candidate.table;
    candidate.summary.learnedSituations = candidate.table.size;
    return candidate;
  }
  throw new Error(`Unknown training task: ${task.kind}`);
}

// The upper bound assumes every unplayed match is won: pruning cannot eliminate
// a candidate capable of beating the threshold, unlike noisy short-sample tests.
export function cannotBeat(points, remainingMatches, threshold) {
  return points + remainingMatches * (NATIONS.length - 1) <= threshold;
}

function tableSeats(table) {
  return new Map(NATIONS.map((nation) => [nation.id, table]));
}

export async function evaluate(pool, tables, opponents, settings, seeds, {
  baseline = null, threshold = -Infinity, batchSize = 8, earlyStopping = true,
  onProgress = () => {}, candidatePolicy = null
} = {}) {
  pool.resetEvaluationCache?.();
  const fixtures = seeds.flatMap((seed) => opponents.flatMap((opponent) =>
    NATIONS.map((nation) => ({ seed, opponent, seat: nation.id }))));
  const total = fixtures.length;
  const results = [];
  let points = 0;
  let wins = 0;
  const byOpponent = {};
  const fixturePoints = [];
  for (let offset = 0; offset < total; offset += batchSize) {
    const batch = fixtures.slice(offset, offset + batchSize);
    const played = await Promise.all(batch.map(({ seed, opponent, seat }) => {
      const mixed = tableSeats(opponent.table);
      mixed.set(seat, tables.values().next().value);
      const strategies = opponent.strategy ? Object.fromEntries(NATIONS
        .filter((nation) => nation.id !== seat).map((nation) => [nation.id, opponent.strategy])) : {};
      const policies = Object.fromEntries(NATIONS.map((nation) => [nation.id,
        nation.id === seat ? candidatePolicy : opponent.policy]));
      return pool.run({ kind: 'simulate', tables: mixed, settings, seed, strategies, policies });
    }));
    played.forEach((result, index) => {
      const fixture = batch[index];
      const entry = result.ranking.find((entry) => entry.playerId === fixture.seat);
      const earned = NATIONS.length - entry.rank;
      points += earned;
      fixturePoints.push(earned);
      wins += Number(entry.rank === 1);
      byOpponent[fixture.opponent.name] = (byOpponent[fixture.opponent.name] || 0) + earned;
      results.push(result);
    });
    onProgress(results.length, total);
    if (earlyStopping && baseline && results.length < total
      && cannotBeat(points, total - results.length, Math.max(baseline.points, threshold))) break;
  }
  return {
    points, wins, matches: results.length, plannedMatches: total,
    baselinePoints: baseline?.points ?? points,
    winRate: wins / results.length,
    pruned: results.length < total, byOpponent, fixturePoints,
    meanPointDelta: baseline ? (points - (baseline.fixturePoints || [])
      .slice(0, results.length).reduce((sum, value) => sum + value, 0)) / results.length : 0,
    summary: summarizeResults(results, results.length)
  };
}

export async function trainBots({
  generations = 1, games = 100, candidateCount = 1, evaluationGames = games,
  workers = Math.min(4, availableParallelism()), evaluationBatchSize = 8,
  historyLimit = 3, earlyStopping = true, compare = true, persist = true,
  reset = false, seed = Date.now(), settings = {}, leaguePath, memoryPath,
  trainingMemoryPath = DEFAULT_TRAINING_MEMORY_FILE,
  onProgress = () => {}
} = {}) {
  for (const [name, value] of Object.entries({ generations, games, candidateCount,
    evaluationGames, workers, evaluationBatchSize, historyLimit })) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} debe ser un entero positivo.`);
  }
  if (!Number.isFinite(Number(seed))) throw new RangeError('seed debe ser numérica y finita.');
  const started = performance.now();
  let tables = reset ? createSharedDecisionTables() : createSharedDecisionTables(persist, memoryPath);
  let archive = persist && !reset ? loadLeague(leaguePath).slice(-historyLimit) : [];
  let learnerTables = persist && !reset ? loadBotDecisionTables(trainingMemoryPath) : null;
  if (!learnerTables?.values().next().value.size) learnerTables = cloneSharedDecisionTables(tables);
  const experiences = loadHumanExperiences();
  const pool = new TrainingPool(workers, executeTrainingTask);
  const history = [];
  let result;
  try {
    for (let generation = 0; generation < generations; generation += 1) {
      const generationSeed = Number(seed) + generation * 1000000;
      const progress = (phase, candidate, completed, total) => onProgress({
        phase, candidate, candidates: candidateCount, completed, total,
        generation: generation + 1, generations
      });
      const opponents = [
        { name: 'champion', table: tables.values().next().value },
        ...archive.map((table, index) => ({ name: `historical-${index + 1}`, table })),
        { name: 'economic', table: new Map(), strategy: 'economic' },
        { name: 'aggressive', table: new Map(), strategy: 'aggressive' }
      ];
      const seeds = Array.from({ length: evaluationGames }, (_, index) =>
        generationSeed + games * candidateCount + index);
      const baseline = compare ? await evaluate(pool, tables, opponents, settings, seeds, {
        batchSize: evaluationBatchSize, earlyStopping: false,
        onProgress: (done, total) => progress('evaluating-champion', 0, done, total)
      }) : null;
      // Each worker owns its candidate memory; no shared writes or schedule-dependent learning.
      const candidates = await Promise.all(Array.from({ length: candidateCount }, (_, index) =>
        pool.run({ kind: 'train', tables: learnerTables, experiences, games, settings,
          seed: generationSeed + index * games, candidate: index + 1, candidates: candidateCount },
          (event) => progress('training', index + 1, event.completed, event.total))));
      let best = null;
      const candidateReports = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (compare) {
          candidate.competitive = await evaluate(pool, candidate.tables, opponents, settings, seeds, {
            baseline, threshold: best?.competitive.points ?? -Infinity,
            earlyStopping, batchSize: evaluationBatchSize,
            onProgress: (done, total) => progress('evaluating-candidate', index + 1, done, total)
          });
          candidateReports.push({ candidate: index + 1, ...candidate.competitive, summary: undefined });
        }
        if (!best || (!candidate.competitive.pruned
          && candidate.competitive.points > best.competitive.points)) best = candidate;
        if (!compare) { best = candidate; break; }
      }
      const learnerPreviousEntries = learnerTables.values().next().value.size;
      learnerTables = mergeLearningTables(learnerTables, candidates.map((candidate) => candidate.learningTables));
      if (persist) saveBotDecisionTables(learnerTables, trainingMemoryPath, { retainAll: true });
      let accepted = false;
      let confirmation = null;
      if (compare && !best.competitive.pruned && best.competitive.points > baseline.points) {
        // Fresh maps withheld from both learning and candidate selection.
        const confirmationSeeds = seeds.map((value) => value + 500000);
        const reference = await evaluate(pool, tables, opponents, settings, confirmationSeeds,
          { batchSize: evaluationBatchSize, earlyStopping: false,
            onProgress: (done, total) => progress('confirming-champion', 0, done, total) });
        confirmation = await evaluate(pool, best.tables, opponents, settings, confirmationSeeds,
          { baseline: reference, batchSize: evaluationBatchSize, earlyStopping: false,
            onProgress: (done, total) => progress('confirming-candidate', 0, done, total) });
        accepted = confirmation.points > reference.points;
      }
      if (accepted || !compare) {
        archive.push(cloneSharedDecisionTables(tables).values().next().value);
        archive = archive.slice(-historyLimit);
        tables = best.tables;
        if (persist) {
          saveBotDecisionTables(tables, memoryPath);
          saveLeague(archive, leaguePath);
        }
      }
      history.push({ generation: generation + 1, accepted, competitive: best.competitive,
        confirmation, learnerPreviousEntries, learnerEntries: learnerTables.values().next().value.size,
        candidates: candidateReports, opponents: opponents.map((o) => o.name) });
      const evaluated = best.competitive?.summary;
      const previous = baseline?.summary;
      result = {
        ...best.summary, candidateCount, evaluationGames: compare ? evaluationGames : 0,
        accepted: compare ? accepted : undefined, updated: persist && (accepted || !compare),
        previous, evaluated, competitive: best.competitive, confirmation,
        comparison: compare && !best.competitive.pruned ? Object.fromEntries(NATIONS.map(({ id }) => [id, {
          winRateDelta: evaluated.wins[id] / best.competitive.matches - previous.wins[id] / baseline.matches,
          turnWinDelta: evaluated.turnWins[id] / best.competitive.matches - previous.turnWins[id] / baseline.matches,
          averageGdiDelta: evaluated.averageGdi[id] - previous.averageGdi[id]
        }])) : undefined
      };
    }
    return { ...result, championDecisionTable: tables.values().next().value,
      trainingDecisionTable: learnerTables.values().next().value,
      actionModel: actionModelSummary(tables.values().next().value),
      trainingActionModel: actionModelSummary(learnerTables.values().next().value),
      trainingUpdated: persist, updated: persist && history.some((entry) => entry.accepted || !compare),
      generations, workers, history, simulatedGames: pool.simulatedGames,
      elapsedSeconds: (performance.now() - started) / 1000 };
  } finally {
    await pool.close();
  }
}
