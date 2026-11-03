export const BOT_ACTION_TYPES = [
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
  'RESPOND_TREATY',
  'VOTE_OI',
  'ISSUE_BOND',
  'REPAY_BOND',
  'TRANSFER_RESOURCE',
  'PROPOSE_TRADE',
  'SET_TAX_RATE',
  'HOLD_POSITION'
];

export const ACTION_MODEL_KEY = '@action-model';
// Fixed schema and bounded inputs: these are unit scales, not hand-assigned rewards.
const SCALES = {
  troopsSent: 20, visibleDefenders: 20, ownTroopsAtTarget: 20, forceRatio: 3,
  forceAdvantage: 20, forceSurvivorsIfDefendersStay: 20, forceLossesIfDefendersStay: 20,
  sourceIsCapital: 1, sourceIsCity: 1, sourceIsFactory: 1, sourcePopulation: 100,
  sourceTroopsBefore: 20, sourceTroopsReserved: 20, sourceTroopsAfter: 20,
  sourceEnemyAdjacentTiles: 4, sourceEnemyAdjacentTroops: 30, sourceDefenseMargin: 30,
  leavesSourceExposed: 1, targetEnemyAdjacentTiles: 4, targetEnemyAdjacentTroops: 30,
  targetIsNeutral: 1, targetIsEnemy: 1, targetIsWater: 1, targetVisibleEnemyShips: 5,
  targetIsCapital: 1, targetIsCity: 1, targetIsResource: 1, targetIsFactory: 1,
  targetPopulation: 100, targetTaxIncome: 10, targetMaterialProduction: 4,
  targetInfluenceProduction: 2, canCaptureIfDefendersStay: 1, populationAdded: 50,
  silverIncomeGain: 10, populationGainIfCaptured: 100, materialProductionGain: 4,
  influenceGain: 2, debtAdded: 25, debtRepaid: 25, silverCost: 50, materialCost: 50,
  influenceCost: 10, availableSilver: 200, availableMaterials: 200, silverAfter: 200,
  materialsAfter: 200, silverBudgetFraction: 1, materialBudgetFraction: 1,
  taxIncomeDelta: 10, taxPopulationDelta: 50, troopsRecruited: 20, shipsSent: 5,
  sourceCargoBefore: 20, sourceCargoAfter: 20, sourceShipsAfter: 5,
  breaksNonAggressionPact: 1, breaksFreeTradeTreaty: 1, pactInfluencePenalty: 10
};
export const ACTION_MODEL_FEATURES = Object.keys(SCALES);
export const ACTION_MODEL_DIMENSION = 1 + BOT_ACTION_TYPES.length + ACTION_MODEL_FEATURES.length;
const D = ACTION_MODEL_DIMENSION;
const MATRIX_SIZE = D * (D + 1) / 2;
const index = (row, column) => row * (row + 1) / 2 + column;
const finiteArray = (array, size) => Array.isArray(array) && array.length === size && array.every(Number.isFinite);

export function createActionModel() {
  return { version: 1, featureVersion: 1, samples: 0, episodes: 0, fittedEpisodes: 0,
    weight: 0, gram: Array(MATRIX_SIZE).fill(0), rhs: Array(D).fill(0), weights: Array(D).fill(0) };
}

export function validateActionModel(model) {
  return model?.version === 1 && model.featureVersion === 1
    && ['samples', 'episodes', 'fittedEpisodes'].every((key) => Number.isSafeInteger(model[key]) && model[key] >= 0)
    && model.fittedEpisodes <= model.episodes && Number.isFinite(model.weight) && model.weight >= 0
    && finiteArray(model.gram, MATRIX_SIZE) && finiteArray(model.rhs, D) && finiteArray(model.weights, D)
    && Array.from({ length: D }, (_, i) => model.gram[index(i, i)]).every((value) => value >= 0);
}

export function encodeActionFeatures(actionType, features) {
  const type = actionType.split('~')[0];
  const typeIndex = BOT_ACTION_TYPES.indexOf(type);
  if (typeIndex < 0 || features?.version !== 1) return null;
  const vector = Array(D).fill(0);
  vector[0] = 1;
  vector[1 + typeIndex] = 1;
  for (let i = 0; i < ACTION_MODEL_FEATURES.length; i += 1) {
    const name = ACTION_MODEL_FEATURES[i];
    const value = features[name] ?? 0;
    if (!Number.isFinite(value)) return null;
    vector[1 + BOT_ACTION_TYPES.length + i] = Math.tanh(value / SCALES[name]);
  }
  return vector;
}

/** Accumulate regression statistics from observed returns, never from human origin. */
export function learnActionReturns(table, examples) {
  const valid = examples.map(({ actionType, features, target }) => ({
    vector: encodeActionFeatures(actionType, features), target
  })).filter(({ vector, target }) => vector && Number.isFinite(target));
  if (!valid.length) return;
  const model = table.get(ACTION_MODEL_KEY) || createActionModel();
  // One player's match contributes total weight one, independent of order count.
  const weight = 1 / valid.length;
  for (const { vector, target } of valid) {
    const boundedTarget = Math.max(-2, Math.min(2, target));
    const active = vector.map((value, i) => value ? i : -1).filter((i) => i >= 0);
    for (let a = 0; a < active.length; a += 1) {
      const row = active[a];
      const x = vector[row];
      model.rhs[row] += weight * x * boundedTarget;
      for (let b = 0; b <= a; b += 1) {
        const column = active[b];
        model.gram[index(row, column)] += weight * x * vector[column];
      }
    }
  }
  model.samples += valid.length;
  model.episodes += 1;
  model.weight += 1;
  table.set(ACTION_MODEL_KEY, model);
}

/** Ridge regression via Cholesky; all weights are learned from the sufficient statistics. */
export function fitActionModel(table) {
  const model = table.get(ACTION_MODEL_KEY);
  if (!model || model.fittedEpisodes === model.episodes) return model;
  const lower = new Float64Array(MATRIX_SIZE);
  const ridge = 0.1;
  for (let row = 0; row < D; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let value = model.gram[index(row, column)] + (row === column ? ridge : 0);
      for (let k = 0; k < column; k += 1) value -= lower[index(row, k)] * lower[index(column, k)];
      lower[index(row, column)] = row === column ? Math.sqrt(Math.max(value, 1e-12))
        : value / lower[index(column, column)];
    }
  }
  const intermediate = new Float64Array(D);
  for (let row = 0; row < D; row += 1) {
    let value = model.rhs[row];
    for (let column = 0; column < row; column += 1) value -= lower[index(row, column)] * intermediate[column];
    intermediate[row] = value / lower[index(row, row)];
  }
  for (let row = D - 1; row >= 0; row -= 1) {
    let value = intermediate[row];
    for (let column = row + 1; column < D; column += 1) value -= lower[index(column, row)] * model.weights[column];
    model.weights[row] = value / lower[index(row, row)];
  }
  if (!model.weights.every(Number.isFinite)) throw new Error('El evaluador produjo pesos no finitos.');
  model.fittedEpisodes = model.episodes;
  return model;
}

export function predictActionReturn(model, action) {
  if (!model || model.episodes < 4 || model.fittedEpisodes !== model.episodes) return null;
  const vector = encodeActionFeatures(action.type, action.features);
  if (!vector) return null;
  const prediction = vector.reduce((sum, value, i) => sum + value * model.weights[i], 0);
  return Math.max(-2, Math.min(2, prediction));
}

/** Combine fork statistics exactly, subtracting their common parent once per fork. */
export function mergeActionModels(parent, candidates) {
  const models = candidates.filter(Boolean);
  if (!parent && !models.length) return null;
  const merged = parent ? structuredClone(parent) : createActionModel();
  for (const model of models) {
    for (const key of ['samples', 'episodes', 'weight']) merged[key] += model[key] - (parent?.[key] || 0);
    for (const key of ['gram', 'rhs']) {
      for (let i = 0; i < merged[key].length; i += 1) merged[key][i] += model[key][i] - (parent?.[key][i] || 0);
    }
  }
  merged.fittedEpisodes = -1;
  const table = new Map([[ACTION_MODEL_KEY, merged]]);
  fitActionModel(table);
  return merged;
}

export function actionModelSummary(table) {
  const model = table?.get(ACTION_MODEL_KEY);
  return { enabled: Boolean(model && model.episodes >= 4 && model.fittedEpisodes === model.episodes),
    samples: model?.samples || 0, episodes: model?.episodes || 0, dimensions: D };
}
