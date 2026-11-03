import test from 'node:test';
import assert from 'node:assert/strict';
import { trainBots } from '../src/training/BotTrainer.js';

test('trains four bots using one shared decision table', async () => {
  const result = await trainBots({
    games: 2,
    seed: 123,
    settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 },
    workers: 1, persist: false
  });

  assert.equal(result.games, 2);
  assert.equal(result.sharedMemory, true);
  assert.equal(Object.keys(result.wins).length, 4);
  assert.ok(result.learnedSituations > 0);
  assert.ok(Object.values(result.averageGdi).every(Number.isFinite));
  assert.ok(result.previous);
  assert.equal(typeof result.accepted, 'boolean');
  assert.ok(result.evaluated);
  assert.equal(Object.keys(result.comparison).length, 4);
});

test('evaluates a population of candidates against the same champion', async () => {
  const progress = [];
  const result = await trainBots({
    games: 2,
    candidateCount: 2,
    evaluationGames: 3,
    seed: 456,
    settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 },
    workers: 1, persist: false,
    onProgress: (event) => progress.push(event)
  });

  assert.equal(result.candidateCount, 2);
  assert.equal(result.evaluationGames, 3);
  assert.equal(typeof result.accepted, 'boolean');
  assert.equal(result.updated, false);
  assert.ok(progress.some((event) => event.phase === 'training'));
  assert.ok(progress.some((event) => event.phase === 'evaluating-candidate'));
});

test('seeded generations are reproducible and evaluate every nation competitively', async () => {
  const options = {
    games: 1, evaluationGames: 1, generations: 2, seed: 987,
    settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 }, workers: 1, persist: false
  };
  const first = await trainBots(options);
  const second = await trainBots(options);
  assert.deepEqual(first.history, second.history);
  assert.deepEqual(first.decisionTable, second.decisionTable);
  assert.equal(first.history.length, 2);
  for (const generation of first.history) {
    assert.equal(generation.competitive.plannedMatches, generation.opponents.length * 4);
    assert.ok(generation.competitive.matches <= generation.competitive.plannedMatches);
    assert.equal(generation.accepted,
      generation.competitive.points > generation.competitive.baselinePoints
        && generation.confirmation?.points > generation.confirmation?.baselinePoints);
  }
});

test('parallel workers produce the same learning and league scores as serial execution', async () => {
  const options = {
    games: 2, candidateCount: 2, evaluationGames: 1, seed: 321,
    settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 }, persist: false
  };
  const serial = await trainBots({ ...options, workers: 1 });
  const parallel = await trainBots({ ...options, workers: 2 });
  assert.deepEqual(parallel.history, serial.history);
  assert.deepEqual(parallel.decisionTable, serial.decisionTable);
  assert.ok(parallel.history[0].opponents.includes('economic'));
  assert.ok(parallel.history[0].opponents.includes('aggressive'));
});

test('early elimination uses a provable bound on remaining ranking points', async () => {
  const { cannotBeat } = await import('../src/training/BotTrainer.js');
  assert.equal(cannotBeat(2, 2, 8), true);
  assert.equal(cannotBeat(2, 2, 7), false);
  assert.equal(cannotBeat(10, 0, 9), false);
});

test('invalid training configurations reject before starting workers', async () => {
  await assert.rejects(trainBots({ workers: 0 }), /workers/);
  await assert.rejects(trainBots({ seed: 'invalid' }), /seed/);
});

test('subsequent generations include frozen historical opponents', async () => {
  const result = await trainBots({ games: 1, generations: 2, compare: false,
    persist: false, workers: 1, seed: 88, settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 } });
  assert.ok(result.history[1].opponents.includes('historical-1'));
});

test('worker task failures are reported and workers are closed', async () => {
  const { TrainingPool } = await import('../src/training/TrainingPool.js');
  const pool = new TrainingPool(2, () => {});
  try {
    await assert.rejects(pool.run({ kind: 'invalid' }), /Unknown training task/);
  } finally {
    await pool.close();
  }
});

test('elimination saves matches without changing promotion decisions', async () => {
  const options = { games: 2, generations: 2, candidateCount: 2, evaluationGames: 1, evaluationBatchSize: 1,
    workers: 1, persist: false, seed: 123, settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 } };
  const stopped = await trainBots(options);
  const full = await trainBots({ ...options, earlyStopping: false });
  assert.deepEqual(stopped.history.map((g) => g.accepted), full.history.map((g) => g.accepted));
  assert.ok(stopped.history.every((g) => g.candidates.every((c) => c.matches <= c.plannedMatches)));
  assert.ok(stopped.simulatedGames <= full.simulatedGames);
});

test('generations retain raw learner experience independently of champion promotion', async () => {
  const result = await trainBots({ generations: 3, games: 1, evaluationGames: 1, seed: 456,
    workers: 1, persist: false, settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 } });
  for (let index = 1; index < result.history.length; index += 1) {
    assert.equal(result.history[index].learnerPreviousEntries, result.history[index - 1].learnerEntries);
  }
  assert.ok(result.trainingDecisionTable.size > 0);
});

test('learner memory survives separate training sessions in a separate file', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { loadBotDecisionTables } = await import('../src/training/BotMemoryStore.js');
  const directory = mkdtempSync(join(tmpdir(), 'pax-training-resume-'));
  try {
    const options = { games: 1, evaluationGames: 1, workers: 1,
      settings: { maxRounds: 5, oiFrequency: 0, botSearchWidth: 0 },
      memoryPath: join(directory, 'champion.json'), trainingMemoryPath: join(directory, 'learner.json'),
      leaguePath: join(directory, 'league.json') };
    const first = await trainBots({ ...options, seed: 12 });
    assert.deepEqual(loadBotDecisionTables(options.trainingMemoryPath).values().next().value, first.trainingDecisionTable);
    const next = await trainBots({ ...options, seed: 13 });
    assert.equal(next.history[0].learnerPreviousEntries, first.trainingDecisionTable.size);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('evaluation model transfer is reused per worker and refreshed on a new evaluation', async () => {
  const { TrainingPool } = await import('../src/training/TrainingPool.js');
  const pool = new TrainingPool(1, () => {});
  try {
    const table = new Map([['c|BUILD_CITY', { reward: 1, attempts: 1 }]]);
    const slot = { cachedTables: new Set() };
    const task = { kind: 'simulate', tables: new Map([['a', table], ['b', table]]) };
    const first = pool.encodeEvaluationTask(task, slot);
    assert.equal(first.evaluationTables.additions.length, 1);
    assert.equal(first.evaluationTables.references[0][1], first.evaluationTables.references[1][1]);
    assert.equal(pool.encodeEvaluationTask(task, slot).evaluationTables.additions.length, 0);
    slot.cachedTables.clear();
    table.get('c|BUILD_CITY').reward = 10;
    assert.equal(pool.encodeEvaluationTask(task, slot).evaluationTables.additions[0][1].get('c|BUILD_CITY').reward, 10);
  } finally { await pool.close(); }
});

test('every candidate contributes experiment deltas without duplicating the shared historical observations', async () => {
  const { mergeLearningTables } = await import('../src/training/BotTrainer.js');
  const seats = (table) => new Map([['nation-0', table]]);
  const parent = seats(new Map([['c|MOVE_TROOPS', { attempts: 10, successes: 5, reward: 20, failures: 5 }]]));
  const first = seats(new Map([['c|MOVE_TROOPS', { attempts: 12, successes: 7, reward: 30, failures: 5 }]]));
  const second = seats(new Map([['c|MOVE_TROOPS', { attempts: 11, successes: 5, reward: 10, failures: 6 }]]));
  const merged = mergeLearningTables(parent, [first, second]);
  assert.deepEqual(merged.get('nation-0').get('c|MOVE_TROOPS'), {
    attempts: 13, successes: 7, reward: 20, failures: 6
  });
  assert.equal(parent.get('nation-0').get('c|MOVE_TROOPS').attempts, 10);
});

test('the shared command runs training or benchmark without persisting experiment memory', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { mkdtempSync, readFileSync, existsSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const directory = mkdtempSync(join(tmpdir(), 'pax-training-command-'));
  try {
    const command = fileURLToPath(new URL('../src/training/runBotTraining.js', import.meta.url));
    const reportPath = join(directory, 'benchmark.json');
    const options = {
      cwd: directory,
      env: { ...process.env, BOT_PERSIST: '0', BOT_GAMES: '1', BOT_GENERATIONS: '1',
        BOT_CANDIDATES: '1', BOT_EVALUATION_GAMES: '1', BOT_MAX_ROUNDS: '1',
        BOT_WORKERS: '2', BOT_SEARCH_WIDTH: '1', BOT_SEED: '123', BOT_BENCHMARK_OUTPUT: reportPath },
      timeout: 30000
    };
    const run = promisify(execFile);
    const training = await run(process.execPath, [command], options);
    assert.match(training.stdout, /Sesión de entrenamiento de bots/);
    assert.match(training.stdout, /Memoria actualizada: NO/);
    assert.match(training.stdout, /Memoria de aprendizaje: solo en memoria/);
    assert.equal(existsSync(reportPath), false);

    const benchmark = await run(process.execPath, [command, '--benchmark'], options);
    assert.match(benchmark.stdout, /Benchmark A\/B/);
    assert.doesNotMatch(benchmark.stdout, /Sesión de entrenamiento de bots/);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.version, 1);
    assert.equal(report.seed, 123);
    assert.equal(report.workers, 2);
    assert.equal(report.reference.matches, 12);
    assert.equal(report.upgraded.matches, report.reference.matches);
    assert.ok(Number.isFinite(report.pointDelta));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
