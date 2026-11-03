import { ACTION_MODEL_KEY, BOT_ACTION_TYPES as ACTION_TYPES, learnActionReturns, predictActionReturn } from './BotActionEvaluator.js';

function bucket(value, size) {
  return Math.floor(Math.max(0, value) / size);
}

export const BotDecisionTable = {
  FINAL_REWARDS: [100, 40, -25, -60],
  FINAL_REWARD_DECAY: 0.97,
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

  getActionKey(action) {
    if (action.decisionKey) return action.decisionKey;
    const fields = ['taxRate', 'treatyType', 'resolutionType', 'troops', 'ships', 'count', 'quantity'];
    const details = fields.filter((field) => action[field] != null)
      .map((field) => `${field}=${action[field]}`);
    return details.length ? `${action.type}~${details.join(',')}` : action.type;
  },

  candidateIdentity(action) {
    const { features, decisionKey, legacyDecisionKey, ...execution } = action;
    return JSON.stringify(execution);
  },

  generalKey(contextKey, actionType) {
    const context = contextKey.split(':').slice(0, 2).join(':');
    const action = actionType.replace(/(troops|ships|count|quantity)=(\d+)/g, (_, field, amount) =>
      `${field}=b${Math.floor(Math.log2(Math.max(1, Number(amount))))}`);
    return `@general:${context}|${action}`;
  },

  learningKeys(contextKey, actionType) {
    return [`${contextKey}|${actionType}`, this.generalKey(contextKey, actionType)];
  },

  addReward(table, contextKey, actionType, reward) {
    for (const key of this.learningKeys(contextKey, actionType)) {
      const stats = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
      stats.reward += reward;
      table.set(key, stats);
    }
  },

  choose(table, contextKey, candidates, random = Math.random, explorationRate = 0.2, ranked = false) {
    if (!candidates.length) return null;
    const uniqueCandidates = [...new Map(candidates.map((action) => [this.candidateIdentity(action), action])).values()];
    if (!ranked && random() < explorationRate) {
      return uniqueCandidates[Math.floor(random() * uniqueCandidates.length)];
    }
    const actionModel = table.get(ACTION_MODEL_KEY);
    const observations = (stats) => (stats?.attempts || 0) + (stats?.finalResults || 0);
    const entries = uniqueCandidates.map((action) => {
      const key = `${contextKey}|${this.getActionKey(action)}`;
      const exact = table.get(key)
        || (action.legacyDecisionKey ? table.get(`${contextKey}|${action.legacyDecisionKey}`) : null)
        || table.get(`${contextKey}|${action.type}`);
      const prior = table.get(this.generalKey(contextKey, this.getActionKey(action)))
        || (action.legacyDecisionKey ? table.get(this.generalKey(contextKey, action.legacyDecisionKey)) : null);
      const count = observations(exact);
      const priorCount = Math.min(4, observations(prior));
      const total = count + priorCount;
      const average = total ? ((exact?.reward || 0)
        + priorCount * (prior?.reward || 0) / Math.max(1, observations(prior))) / total : 0;
      const failureRate = ((exact?.failures || 0) + priorCount
        * (prior?.failures || 0) / Math.max(1, prior?.attempts || 0))
        / Math.max(1, (exact?.attempts || 0) + priorCount);
      const prediction = predictActionReturn(actionModel, action);
      const modelShare = prediction == null ? 0
        : Math.min(0.8, actionModel.episodes / (actionModel.episodes + 20)) / (1 + count / 20);
      return { action, key, count: total, average, failureRate, prediction, modelShare };
    });
    const totalObservations = [...new Map(entries.map((entry) => [entry.key, entry.count])).values()]
      .reduce((sum, count) => sum + count, 0);
    const score = (entry) => (1 - entry.modelShare) * entry.average
      + entry.modelShare * (entry.prediction || 0) * 100 - entry.failureRate * 10
      + (explorationRate > 0 ? Math.sqrt(2 * Math.log(totalObservations + 1) / (entry.count || 1)) : 0);
    entries.sort((left, right) => score(right) - score(left));
    return ranked ? entries.map((entry) => entry.action) : entries[0].action;
  },

  remember(table, contextKey, actionType, successful) {
    if (!ACTION_TYPES.includes(actionType.split('~')[0])) return;
    for (const key of this.learningKeys(contextKey, actionType)) {
      const stats = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
      stats.attempts += 1;
      if (successful) stats.successes += 1;
      else stats.failures = (stats.failures || 0) + 1;
      table.set(key, stats);
    }
  },

  rememberFinalResult(table, decisions, rank) {
    const reward = this.FINAL_REWARDS[rank - 1] ?? this.FINAL_REWARDS.at(-1);
    const finalRound = Math.max(1, ...decisions.map((decision) => decision.round || 1));
    const modelExamples = [];
    decisions.forEach(({ contextKey, actionType, successful, round, features, intermediateReward }, index) => {
      if (!ACTION_TYPES.includes(actionType.split('~')[0])) return;
      const age = Number.isInteger(round) ? Math.max(0, finalRound - round)
        : 29 * (decisions.length - index - 1) / Math.max(1, decisions.length - 1);
      const recency = this.FINAL_REWARD_DECAY ** age;
      const outcomeCredit = successful === true ? this.SUCCESS_CREDIT
        : successful === false ? this.FAILURE_CREDIT : 1;
      modelExamples.push({ actionType, features,
        target: (reward * recency * outcomeCredit + (intermediateReward || 0)) / 100 });
      for (const key of this.learningKeys(contextKey, actionType)) {
        const stats = table.get(key) || { attempts: 0, successes: 0, reward: 0 };
        stats.reward += reward * recency * outcomeCredit;
        stats.finalResults = (stats.finalResults || 0) + 1;
        table.set(key, stats);
      }
    });
    learnActionReturns(table, modelExamples);
    return reward;
  }
};
