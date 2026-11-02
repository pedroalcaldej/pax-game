import { trainBots } from './BotTrainer.js';

const result = trainBots();
console.log(JSON.stringify({
  games: result.games,
  sharedMemory: result.sharedMemory,
  wins: result.wins,
  averageGdi: result.averageGdi,
  learnedSituations: result.learnedSituations,
  baseline: result.baseline,
  comparison: result.comparison
}, null, 2));
console.log('Memoria persistida en server/data/bot-decision-memory.json');
