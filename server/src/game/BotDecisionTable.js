const ACTION_TYPES = [
  'MOVE_TROOPS',
  'BUILD_FACTORY',
  'BUILD_CITY',
  'RECRUIT_TROOP',
  'BUILD_SHIP',
  'MOVE_SHIPS',
  'EMBARK_TROOPS',
  'DISEMBARK_TROOPS',
  'MOVE_CAPITAL',
  'BUY_MATERIALS',
  'SELL_MATERIALS',
  'DONATE_TO_WORLD_BANK',
  'PROPOSE_TREATY',
  'PROPOSE_OI_RESOLUTION',
  'SET_TAX_RATE',
  'HOLD_POSITION'
];

function bucket(value, size) {
  return Math.floor(Math.max(0, value) / size);
}

export const BotDecisionTable = {
  FINAL_REWARDS: [100, 40, -25, -60],
  FINAL_REWARD_DECAY: 0.85,
  SUCCESS_CREDIT: 1.15,
  FAILURE_CREDIT: 0.5,

  create() {
    return new Map();
  },

  getContext(gameState, player) {
    const ownedTiles = gameState.grid.flat().filter((tile) => tile.ownerId === player.id);
    const enemyTiles = gameState.grid.flat().filter(
      (tile) => tile.ownerId != null && tile.ownerId !== player.id
    );
    const troops = ownedTiles.reduce((sum, tile) => sum + gameState.getTroopsForPlayerOnTile(tile, player.id), 0);
    const factories = ownedTiles.filter((tile) => tile.building === 'FACTORY').length;
    const resourceTotal = Object.values(player.resources || {})
      .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

    return [
      `r${bucket(gameState.currentRound, 3)}`,
      `p${gameState.players.size}`,
      `t${bucket(ownedTiles.length, 3)}`,
      `e${bucket(enemyTiles.length, 3)}`,
      `u${bucket(troops, 5)}`,
      `f${bucket(factories, 2)}`,
      `m${bucket(resourceTotal, 100)}`
    ].join(':');
  },

  choose(table, contextKey, candidates, random = Math.random, explorationRate = 0.2) {
    if (!candidates.length) return null;
    const uniqueCandidates = [...new Map(candidates.map((action) => [action.type, action])).values()];
    const entries = uniqueCandidates.map((action) => ({
      action,
      stats: table.get(`${contextKey}|${action.type}`) || { attempts: 0, successes: 0, reward: 0 }
    }));
    if (random() < explorationRate) {
      return uniqueCandidates[Math.floor(random() * uniqueCandidates.length)];
    }
    const totalObservations = entries.reduce(
      (sum, { stats }) => sum + (stats.attempts || 0) + (stats.finalResults || 0),
      0
    );
    entries.sort((left, right) => {
      const leftObservations = (left.stats.attempts || 0) + (left.stats.finalResults || 0);
      const rightObservations = (right.stats.attempts || 0) + (right.stats.finalResults || 0);
      const leftAverage = leftObservations ? left.stats.reward / leftObservations : 0;
      const rightAverage = rightObservations ? right.stats.reward / rightObservations : 0;
      const leftConfidence = Math.sqrt(
        2 * Math.log(totalObservations + 1) / (leftObservations || 1)
      );
      const rightConfidence = Math.sqrt(
        2 * Math.log(totalObservations + 1) / (rightObservations || 1)
      );
      const leftFailurePenalty = left.stats.attempts
        ? (left.stats.failures || 0) / left.stats.attempts * 10
        : 0;
      const rightFailurePenalty = right.stats.attempts
        ? (right.stats.failures || 0) / right.stats.attempts * 10
        : 0;
      const leftScore = leftAverage + leftConfidence - leftFailurePenalty;
      const rightScore = rightAverage + rightConfidence - rightFailurePenalty;
      return rightScore - leftScore;
    });
    return entries[0].action;
  },

  remember(table, contextKey, actionType, successful) {
    if (!ACTION_TYPES.includes(actionType)) return;
    const key = `${contextKey}|${actionType}`;
    const stats = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
    stats.attempts += 1;
    if (successful) stats.successes += 1;
    if (!successful) stats.failures = (stats.failures || 0) + 1;
    table.set(key, stats);
  },

  rememberFinalResult(table, decisions, rank) {
    const reward = this.FINAL_REWARDS[rank - 1] ?? this.FINAL_REWARDS.at(-1);
    decisions.forEach(({ contextKey, actionType, successful }, index) => {
      if (!ACTION_TYPES.includes(actionType)) return;
      const key = `${contextKey}|${actionType}`;
      const stats = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
      const recency = this.FINAL_REWARD_DECAY ** (decisions.length - index - 1);
      const outcomeCredit = successful === true
        ? this.SUCCESS_CREDIT
        : successful === false ? this.FAILURE_CREDIT : 1;
      stats.reward += reward * recency * outcomeCredit;
      stats.finalResults = (stats.finalResults || 0) + 1;
      table.set(key, stats);
    });
    return reward;
  }
};
