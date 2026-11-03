import { availableParallelism } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NATIONS } from '../../../shared/Constants.js';
import { trainBots, evaluate, executeTrainingTask } from './BotTrainer.js';
import { TrainingPool } from './TrainingPool.js';

async function runTraining() {
  const positiveInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };

  const result = await trainBots({
    persist: process.env.BOT_PERSIST !== '0',
    settings: {
      ...(process.env.BOT_MAX_ROUNDS == null ? {} : { maxRounds: positiveInteger(process.env.BOT_MAX_ROUNDS, 30) }),
      botSearchWidth: process.env.BOT_SEARCH_WIDTH === '0' ? 0 : positiveInteger(process.env.BOT_SEARCH_WIDTH, 3),
      botDirectedExploration: process.env.BOT_DIRECTED_EXPLORATION !== '0',
      botIntermediateRewards: process.env.BOT_INTERMEDIATE_REWARDS !== '0'
    },
    workers: positiveInteger(process.env.BOT_WORKERS, 4),
    evaluationBatchSize: positiveInteger(process.env.BOT_EVALUATION_BATCH, 8),
    earlyStopping: process.env.BOT_EARLY_STOP !== '0',
    reset: process.env.RESET_BOT_MEMORY === '1',
    games: positiveInteger(process.env.BOT_GAMES, 100),
    generations: positiveInteger(process.env.BOT_GENERATIONS, 1),
    seed: process.env.BOT_SEED == null ? Date.now() : Number(process.env.BOT_SEED),
    candidateCount: positiveInteger(process.env.BOT_CANDIDATES, 1),
    evaluationGames: positiveInteger(process.env.BOT_EVALUATION_GAMES, 100),
    onProgress: ({ phase, completed, total, candidate, candidates, generation, generations }) => {
      const interval = Math.max(1, Math.ceil(total / 10));
      if (completed !== total && completed % interval !== 0) return;
      const percentage = Math.round(completed / total * 100);
      const label = phase === 'training'
        ? `Entrenando candidato ${candidate}/${candidates}`
        : phase === 'evaluating-champion'
          ? 'Evaluando campeón'
          : phase === 'confirming-champion' ? 'Confirmando campeón en mapas nuevos'
          : phase === 'confirming-candidate' ? 'Confirmando candidato en mapas nuevos'
          : `Evaluando candidato ${candidate}/${candidates}`;
      console.log(`Generación ${generation}/${generations} — ${label}: ${percentage}% (${completed}/${total})`);
    }
  });

  const formatDelta = (value, digits = 2) => {
    const rounded = Number(value.toFixed(digits));
    return `${rounded >= 0 ? '+' : ''}${rounded}`;
  };

  console.log('\n=== Sesión de entrenamiento de bots ===');
  console.log(`Partidas simuladas totales: ${result.simulatedGames}`);
  console.log(
    `Candidatos evaluados: ${result.candidateCount}; `
    + `partidas de evaluación: ${result.evaluationGames}`
  );
  console.log(
    `Aprendizaje: ${result.learning.previousEntries} -> ${result.learning.entries} `
    + `entradas (${formatDelta(result.learning.newEntries, 0)} nuevas), `
    + `${result.learning.contexts} situaciones, `
    + `${result.learning.attempts} decisiones registradas`
  );
  console.log(
    `Resultados de acciones: ${result.learning.successes} exitosas, `
    + `${result.learning.failures} fallidas, `
    + `${result.learning.finalResults} resultados finales`
  );
  const measuredResults = result.evaluated || result;
  console.log(
    `\nResultados de la liga (todas las naciones de los encuentros):`
  );
  for (const playerId of Object.keys(measuredResults.wins)) {
    const comparison = result.comparison?.[playerId];
    console.log(
      `- ${playerId}: ${measuredResults.wins[playerId]} victorias, `
      + `${measuredResults.turnWins[playerId]} liderazgos por ronda, `
      + `GDI promedio ${measuredResults.averageGdi[playerId].toFixed(2)}`
      + (comparison
        ? ` (cambio ${formatDelta(comparison.averageGdiDelta)})`
        : '')
      + `, recompensa promedio ${measuredResults.averageReward[playerId].toFixed(2)}`
    );
  }

  if (result.accepted === false) {
    console.log(
      '\nÚltima generación: no promovida. La candidata no superó al campeón; '
      + 'se conservó la memoria anterior.'
    );
  } else if (result.accepted === true) {
    console.log('\nÚltima generación: promovida. La candidata superó al campeón en selección y confirmación independiente.');
  }

  console.log(
    `Memoria actualizada: ${result.updated ? 'SÍ' : 'NO'}`
    + (result.updated ? ' (server/data/bot-decision-memory.json)' : '')
  );

  for (const generation of result.history) {
    const score = generation.competitive;
    if (!score) continue;
    console.log(`Generación ${generation.generation}: ${generation.accepted ? 'promovida' : 'conserva campeón'}; ${score.wins}/${score.matches} victorias; ${score.pruned ? 'puntos parciales' : 'puntos'} ${score.points} vs umbral ${score.baselinePoints}; ${(100 * score.winRate).toFixed(1)}% victorias; ${generation.candidates.filter((c) => c.pruned).length} candidatos descartados antes de terminar`);
  }
  console.log(`Duración: ${result.elapsedSeconds.toFixed(1)} segundos`);
  console.log(`Rendimiento: ${(result.simulatedGames / result.elapsedSeconds).toFixed(1)} partidas/segundo`);

  console.log(`Memoria de aprendizaje: ${result.trainingUpdated ? 'guardada' : 'solo en memoria'}; ${result.trainingDecisionTable.size} entradas. El campeón se actualiza por separado.`);

  console.log(`Evaluador del campeón: ${result.actionModel.enabled ? 'activo' : 'sin modelo entrenado'}; ${result.actionModel.samples} decisiones observadas.`);
  console.log(`Evaluador en aprendizaje: ${result.trainingActionModel.samples} decisiones, ${result.trainingActionModel.episodes} resultados de jugador.`);
}

async function runBenchmark() {
  const integer = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} debe ser un entero positivo.`);
    return value;
  };
  const seed = Number(process.env.BOT_SEED ?? 123);
  if (!Number.isFinite(seed)) throw new RangeError('BOT_SEED debe ser numérica y finita.');
  const games = integer('BOT_GAMES', 10);
  const maps = integer('BOT_EVALUATION_GAMES', 3);
  const workers = integer('BOT_WORKERS', Math.min(4, availableParallelism()));
  const maxRounds = integer('BOT_MAX_ROUNDS', 10);
  const options = { games, evaluationGames: maps, workers, seed, persist: false,
    generations: integer('BOT_GENERATIONS', 1), candidateCount: integer('BOT_CANDIDATES', 2) };
  const disabled = { botSearchWidth: 0, botDirectedExploration: false, botIntermediateRewards: false };
  const enabled = { botSearchWidth: integer('BOT_SEARCH_WIDTH', 3), botDirectedExploration: true, botIntermediateRewards: true };

  console.log('Benchmark A/B desde memoria vacía; no modifica el campeón ni la liga guardados.');
  console.log('Entrenando referencia sin búsqueda, mutación dirigida ni recompensas intermedias...');
  const reference = await trainBots({ ...options, settings: { maxRounds, ...disabled } });
  console.log('Entrenando sistema completo con el mismo presupuesto de partidas...');
  const upgraded = await trainBots({ ...options, settings: { maxRounds, ...enabled } });
  const opponents = [
    { name: 'reference', table: reference.championDecisionTable, policy: { searchWidth: 0, directedExploration: false } },
    { name: 'economic', table: new Map(), strategy: 'economic' },
    { name: 'aggressive', table: new Map(), strategy: 'aggressive' }
  ];
  // This namespace is withheld from both training sessions, selection and confirmation.
  const seeds = Array.from({ length: maps }, (_, index) => seed + 900000000 + index);
  const seats = (table) => new Map(NATIONS.map((nation) => [nation.id, table]));
  const pool = new TrainingPool(workers, executeTrainingTask);
  let baseline;
  let candidate;
  const started = performance.now();
  try {
    baseline = await evaluate(pool, seats(reference.championDecisionTable), opponents, { maxRounds, ...disabled }, seeds,
      { earlyStopping: false, candidatePolicy: { searchWidth: 0, directedExploration: false } });
    candidate = await evaluate(pool, seats(upgraded.championDecisionTable), opponents, { maxRounds, ...disabled }, seeds,
      { baseline, earlyStopping: false, candidatePolicy: { searchWidth: enabled.botSearchWidth, directedExploration: true } });
  } finally {
    await pool.close();
  }
  const measurement = (training, score) => ({
    points: score.points, wins: score.wins, matches: score.matches, winRate: score.winRate,
    byOpponent: score.byOpponent, trainingSeconds: training.elapsedSeconds,
    simulatedGames: training.simulatedGames,
    gamesPerSecond: training.simulatedGames / training.elapsedSeconds,
    promotions: training.history.filter((entry) => entry.accepted).length
  });
  const report = {
    version: 1, createdAt: new Date().toISOString(), seed, games, maps, workers, maxRounds,
    generations: options.generations, candidateCount: options.candidateCount,
    reference: measurement(reference, baseline), upgraded: measurement(upgraded, candidate),
    pointDelta: candidate.points - baseline.points,
    winRateDelta: candidate.winRate - baseline.winRate,
    benchmarkSeconds: (performance.now() - started) / 1000,
    limitation: 'Equal game budget, not equal wall time. Small samples do not establish human-level strength or statistical significance.'
  };
  const output = resolve(process.env.BOT_BENCHMARK_OUTPUT || 'data/bot-benchmark-latest.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Reporte: ${output}`);
}

if (process.argv.includes('--benchmark')) await runBenchmark();
else await runTraining();
