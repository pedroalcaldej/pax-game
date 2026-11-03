import { createActionFeatureContext, extractActionFeatures, actionFeatureSignature } from './BotActionFeatures.js';
import { EconomyEngine } from '../EconomyEngine.js';
import { calculateTaxIncome } from '../../../../shared/EconomyFormulas.js';
import { BotDecisionTable } from './BotDecisionTable.js';

/** Bounded public-state potential. Its undiscounted differences telescope over a game. */
export function strategicPotential(state, playerId) {
  const player = state.players.get(playerId);
  const owned = state.grid.flat().filter((tile) => tile.ownerId === playerId);
  const population = owned.reduce((sum, tile) => sum + (['CIU', 'CAP'].includes(tile.type) ? tile.population || 0 : 0), 0);
  const income = calculateTaxIncome(population, player.taxRate).silverEarned;
  const factories = owned.reduce((sum, tile) => sum + (tile.building === 'FACTORY' ? tile.factoriesCount || 1 : 0), 0);
  const troops = state.grid.flat().reduce((sum, tile) => sum
    + state.getTroopsForPlayerOnTile(tile, playerId)
    + (tile.transportedTroopsByPlayer?.[playerId] || 0), 0);
  const valuable = owned.filter((tile) => ['MPT', 'MPA', 'CIU', 'CAP'].includes(tile.type)).length;
  return 2 * Math.tanh(income / 30) + 2 * Math.tanh(factories / 5)
    + 2 * Math.tanh(troops / 20) + 2 * Math.tanh(valuable / 8)
    + Math.tanh(owned.length / 15) + Math.tanh(state.calculateGDI(player) / 500);
}

export function rewardRound(state, before, historyStarts) {
  if (!state.trainingMode || state.botIntermediateRewards === false) return;
  for (const player of state.players.values()) {
    if (!player.isBot) continue;
    const decisions = (player.botDecisionHistory || []).slice(historyStarts.get(player.id) || 0);
    if (!decisions.length) continue;
    const delta = strategicPotential(state, player.id) - before.get(player.id);
    // Total auxiliary credit per game is bounded by the potential's range (10),
    // far below the 100-point first-place terminal reward.
    const credit = delta / decisions.length;
    const table = state.botDecisionTables.get(player.id);
    for (const decision of decisions) {
      decision.intermediateReward = (decision.intermediateReward || 0) + credit;
      BotDecisionTable.addReward(table, decision.contextKey, decision.actionType, credit);
    }
  }
}

export function describeAction(state, player, action, context = createActionFeatureContext(state, player)) {
  const target = state.grid[action.targetY ?? action.y]?.[action.targetX ?? action.x];
  const base = BotDecisionTable.getActionKey({ ...action, decisionKey: undefined });
  let legacyKey = base;
  if (target) {
    const purpose = target.ownerId == null ? 'neutral' : target.ownerId === player.id ? 'own' : 'enemy';
    // Preserve the old descriptor exactly as a read fallback for existing champions.
    const frontier = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
      const neighbor = state.grid[target.y + dy]?.[target.x + dx];
      return neighbor && neighbor.ownerId !== player.id && neighbor.type !== 'AG';
    });
    const defenders = target.ownerId ? state.getTroopsForPlayerOnTile(target, target.ownerId) : 0;
    legacyKey = `${base}~${purpose}:${target.type}:front=${Number(frontier)}:def=${Math.floor(defenders / 3)}:building=${target.building || 'none'}`;
  }
  action.features = extractActionFeatures(state, player, action, context);
  action.legacyDecisionKey = legacyKey;
  action.decisionKey = `${legacyKey}~${actionFeatureSignature(action.features)}`;
  return action;
}

/** Mutate the learned best quantity locally, retaining legality and tactical purpose. */
export function directedVariants(state, player, slot, candidates, table, context) {
  if (!candidates.length || (state.botPolicies?.[player.id]?.directedExploration ?? state.botDirectedExploration) === false) return candidates;
  const best = BotDecisionTable.choose(table, context, candidates, () => 1, 0);
  const field = ['troops', 'count', 'ships'].find((name) => best[name] != null);
  if (!field) return candidates;
  const featureContext = createActionFeatureContext(state, player, slot);
  const variants = [-1, 1, -Math.ceil(best[field] * 0.2), Math.ceil(best[field] * 0.2)]
    .map((delta) => {
      const variant = { ...best, [field]: best[field] + delta };
      delete variant.decisionKey;
      return describeAction(state, player, variant, featureContext);
    }).filter((action) => action[field] > 0 && state.validatePlannedAction(player, action, slot).ok);
  return [...new Map([...candidates, ...variants].map((action) => [BotDecisionTable.candidateIdentity(action), action])).values()];
}

export function cloneForSearch(state) {
  const clone = Object.create(Object.getPrototypeOf(state));
  const data = Object.fromEntries(Object.entries(state).filter(([key, value]) =>
    !['botDecisionTables', 'botHumanIdeas', 'roundMapHistory', 'players', 'eventHistory', 'lastActionResolutions'].includes(key) && typeof value !== 'function'));
  data.players = new Map([...state.players].map(([id, player]) => [id, {
    ...player, isBot: true, botDecisionHistory: [], botDecisionContext: {}, humanDecisionContext: {},
    plannedActions: player.plannedActions.map(() => null)
  }]));
  Object.assign(clone, structuredClone(data));
  clone.lastActionResolutions = [];
  clone.botDecisionTables = new Map();
  clone.roundMapHistory = new Map();
  clone.trainingMode = false;
  clone.botSearchWidth = 0;
  clone.eventHistory = [];
  return clone;
}

/** One own-turn rollout plus next economy; bounded breadth, no recursive bot calls. */
export function searchAction(state, player, slot, candidates, table, context, preferred) {
  const width = state.botPolicies?.[player.id]?.searchWidth ?? state.botSearchWidth ?? 3;
  if (width < 1 || candidates.length < 2) return preferred;
  const remaining = BotDecisionTable.choose(table, context, candidates, () => 1, 0, true);
  const shortlist = [preferred];
  const deferred = [];
  const signatures = new Set([`${preferred.type}:${preferred.targetX ?? preferred.x}:${preferred.targetY ?? preferred.y}`]);
  while (remaining.length && shortlist.length < width) {
    const action = remaining.shift();
    const signature = `${action.type}:${action.targetX ?? action.x}:${action.targetY ?? action.y}`;
    if (!signatures.has(signature)) { shortlist.push(action); signatures.add(signature); }
    else if (action !== preferred) deferred.push(action);
  }
  shortlist.push(...deferred.slice(0, Math.max(0, width - shortlist.length)));
  let best = preferred;
  let bestScore = -Infinity;
  for (const action of shortlist) {
    const clone = cloneForSearch(state);
    const hypothetical = clone.players.get(player.id);
    hypothetical.plannedActions = structuredClone(player.plannedActions);
    hypothetical.plannedActions[slot] = { ...action };
    clone.resolvePlannedActions();
    EconomyEngine.processRoundEconomy(clone);
    const score = strategicPotential(clone, player.id);
    if (score > bestScore) { bestScore = score; best = action; }
  }
  return best;
}

const PARAMETERS = ['troops', 'ships', 'count', 'quantity', 'taxRate', 'treatyType', 'resolutionType'];

/** Human execution success is deliberately not a reward or a quality filter. */
export function indexHumanIdeas(experiences) {
  const index = new Map();
  for (const experience of experiences) {
    if (typeof experience?.contextKey !== 'string' || typeof experience.actionType !== 'string') continue;
    const ideas = index.get(experience.contextKey) || new Map();
    const idea = { type: experience.actionType };
    for (const field of PARAMETERS) {
      const value = experience.action?.[field];
      if (typeof value === 'string' || Number.isFinite(value)) idea[field] = value;
    }
    ideas.set(JSON.stringify(idea), idea);
    // Deduplicate repeated human choices; retain a bounded set of hypotheses.
    if (ideas.size > 32) ideas.delete(ideas.keys().next().value);
    index.set(experience.contextKey, ideas);
  }
  return index;
}

export function proposeHumanVariants(state, player, slot, candidates, context) {
  if (!state.trainingMode) return candidates;
  const ideas = state.botHumanIdeas?.get(context);
  if (!ideas) return candidates;
  const proposals = [...candidates];
  const featureContext = createActionFeatureContext(state, player, slot);
  for (const candidate of candidates) {
    for (const idea of ideas.values()) {
      if (idea.type !== candidate.type) continue;
      const action = { ...candidate };
      delete action.decisionKey;
      for (const field of PARAMETERS) if (idea[field] != null) action[field] = idea[field];
      if (state.validatePlannedAction(player, action, slot).ok) proposals.push(describeAction(state, player, action, featureContext));
    }
  }
  return [...new Map(proposals.map((action) => [BotDecisionTable.candidateIdentity(action), action])).values()];
}

export function humanExplorationCandidates(index, context, candidates) {
  const ideas = index?.get(context);
  if (!ideas) return [];
  return candidates.filter((candidate) => [...ideas.values()].some((idea) =>
    candidate.type === idea.type && PARAMETERS.every((field) => idea[field] == null || candidate[field] === idea[field])));
}
