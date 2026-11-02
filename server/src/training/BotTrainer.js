import { NATIONS } from '../../../shared/Constants.js';
import { EconomyEngine } from '../game/EconomyEngine.js';
import { GameState } from '../game/GameState.js';
import { InternationalOrganizationEngine } from '../game/InternationalOrganizationEngine.js';
import { BotDecisionTable } from '../game/BotDecisionTable.js';
import { loadBotDecisionTables, saveBotDecisionTables } from './BotMemoryStore.js';

function createSharedDecisionTables(persisted = false) {
  if (persisted) return loadBotDecisionTables();
  const sharedTable = BotDecisionTable.create();
  return new Map(NATIONS.map((nation) => [nation.id, sharedTable]));
}

function createTrainingSettings(settings, seed, maxRounds) {
  return {
    ...settings,
    maxRounds,
    mapSeed: String(seed)
  };
}

function simulateGame(sharedTables, settings, seed, explorationRate) {
  const gameState = new GameState(
    createTrainingSettings(settings, seed, settings.maxRounds),
    sharedTables
  );
  gameState.gameStarted = true;
  gameState.trainingMode = true;
  gameState.botExplorationRate = explorationRate;

  for (let round = 1; round <= gameState.settings.maxRounds; round += 1) {
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
  }

  gameState.gameOver = true;
  const rewards = gameState.awardBotFinalRewards();
  const ranking = [...gameState.players.values()]
    .sort((left, right) => (
      gameState.calculateGDI(right) - gameState.calculateGDI(left)
      || left.nationId - right.nationId
    ));

  return {
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
  const averageGdi = new Map(NATIONS.map((nation) => [nation.id, 0]));
  for (const result of results) {
    for (const entry of result.ranking) {
      averageGdi.set(entry.playerId, averageGdi.get(entry.playerId) + entry.gdiPoints);
      if (entry.rank === 1) wins.set(entry.playerId, wins.get(entry.playerId) + 1);
    }
  }
  return {
    wins: Object.fromEntries(wins),
    averageGdi: Object.fromEntries(
      [...averageGdi].map(([playerId, total]) => [playerId, total / games])
    )
  };
}

export function trainBots({
  games = 1000,
  settings = {},
  seed = Date.now(),
  compare = true,
  persist = true
} = {}) {
  if (!Number.isInteger(games) || games < 1) {
    throw new RangeError('games debe ser un entero positivo.');
  }

  const sharedTables = createSharedDecisionTables(persist);
  const results = [];

  for (let game = 0; game < games; game += 1) {
    const explorationRate = Math.max(0.01, 0.12 * (1 - game / games));
    results.push(simulateGame(
      sharedTables,
      settings,
      Number(seed) + game,
      explorationRate
    ));
  }

  const sharedTable = sharedTables.values().next().value;
  const trained = {
    games,
    sharedMemory: true,
    ...summarizeResults(results, games),
    learnedSituations: sharedTable.size,
    decisionTable: sharedTable
  };
  if (persist) saveBotDecisionTables(sharedTables);
  if (!compare) return trained;

  const baselineResults = [];
  for (let game = 0; game < games; game += 1) {
    baselineResults.push(simulateGame(
      createSharedDecisionTables(),
      settings,
      Number(seed) + games + game,
      0
    ));
  }
  const baseline = summarizeResults(baselineResults, games);
  return {
    ...trained,
    baseline,
    comparison: Object.fromEntries(NATIONS.map((nation) => [
      nation.id,
      {
        winRateDelta: (trained.wins[nation.id] - baseline.wins[nation.id]) / games,
        averageGdiDelta: trained.averageGdi[nation.id]
          - baseline.averageGdi[nation.id]
      }
    ]))
  };
}
