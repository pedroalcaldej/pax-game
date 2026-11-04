import { ECONOMY, LAND_TERRAIN, WATER_TERRAIN } from '../../../../shared/Constants.js';
import { calculateTaxIncome, projectUrbanPopulation } from '../../../../shared/EconomyFormulas.js';

const DIRECTIONS = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => [dx, dy]));
const MOVES_TROOPS = new Set(['MOVE_TROOPS', 'EMBARK_TROOPS', 'DISEMBARK_TROOPS']);
const location = (x, y) => `${x}:${y}`;
const number = (value) => Number.isFinite(value) ? value : 0;
const urban = (tile) => Boolean(tile && ['CAP', 'CIU'].includes(tile.type));

/** One public-board/own-plan summary per decision, reused by all candidate descriptions. */
export function createActionFeatureContext(state, player, slot = null) {
  const planned = (player.plannedActions || []).filter((action, index) => action && index !== slot);
  const departing = new Map();
  const arriving = new Map();
  const shipsDeparting = new Map();
  for (const action of planned) {
    const source = location(action.x, action.y);
    if (MOVES_TROOPS.has(action.type)) {
      departing.set(source, (departing.get(source) || 0) + number(action.troops));
      const target = location(action.targetX, action.targetY);
      arriving.set(target, (arriving.get(target) || 0) + number(action.troops));
    }
    if (action.type === 'MOVE_SHIPS') shipsDeparting.set(source, (shipsDeparting.get(source) || 0) + number(action.ships));
  }
  const cities = state.grid.flat().filter((tile) => tile.ownerId === player.id && urban(tile));
  return {
    departing, arriving, shipsDeparting, cities, neighborhoods: new Map(),
    reservedSilver: planned.reduce((sum, action) => sum + state.getSilverCost(action), 0),
    reservedMaterials: planned.reduce((sum, action) => sum + state.getMaterialCost(action), 0)
  };
}

function neighborhood(state, player, tile, context) {
  if (!tile) return { enemyTiles: 0, enemyTroops: 0 };
  const key = location(tile.x, tile.y);
  if (context.neighborhoods.has(key)) return context.neighborhoods.get(key);
  let enemyTiles = 0;
  let enemyTroops = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const neighbor = state.grid[tile.y + dy]?.[tile.x + dx];
    if (!neighbor || !LAND_TERRAIN.has(neighbor.type)) continue;
    if (neighbor.ownerId != null && neighbor.ownerId !== player.id) enemyTiles += 1;
    for (const id of state.players.keys()) {
      if (id !== player.id) enemyTroops += state.getTroopsForPlayerOnTile(neighbor, id);
    }
  }
  const result = { enemyTiles, enemyTroops };
  context.neighborhoods.set(key, result);
  return result;
}

/** Numeric, coordinate-independent descriptors, not a learned score or an enemy-order prediction. */
export function extractActionFeatures(state, player, action, context = createActionFeatureContext(state, player)) {
  const source = state.grid[action.y]?.[action.x];
  const target = state.grid[action.targetY ?? action.y]?.[action.targetX ?? action.x];
  const movingTroops = MOVES_TROOPS.has(action.type);
  const troopsSent = movingTroops ? number(action.troops) : 0;
  const ownSourceTroops = source ? state.getTroopsForPlayerOnTile(source, player.id) : 0;
  const cargoBefore = number(source?.transportedTroopsByPlayer?.[player.id]);
  const reservedShips = context.shipsDeparting.get(source ? location(source.x, source.y) : '') || 0;
  const cargoReservedForShips = Math.min(cargoBefore, reservedShips * ECONOMY.NAVAL.TROOPS_PER_SHIP);
  const usesCargo = action.type === 'DISEMBARK_TROOPS' || (action.type === 'MOVE_TROOPS' && WATER_TERRAIN.has(source?.type));
  const sourceStock = usesCargo ? cargoBefore : ownSourceTroops;
  const reservedTroopsBase = source ? context.departing.get(location(source.x, source.y)) || 0 : 0;
  const reservedTroops = reservedTroopsBase + (usesCargo ? cargoReservedForShips : 0);
  const sourceTroopsAfter = Math.max(0, sourceStock - reservedTroops - troopsSent)
    + (action.type === 'RECRUIT_TROOP' ? number(action.count) : 0);
  const sourceNeighbors = neighborhood(state, player, source, context);
  const targetNeighbors = neighborhood(state, player, target, context);
  const enemyIds = target ? [...state.players.keys()].filter((id) => id !== player.id
    && state.getTroopsForPlayerOnTile(target, id) > 0) : [];
  const visibleDefenders = enemyIds.reduce((sum, id) => sum + state.getTroopsForPlayerOnTile(target, id), 0);
  const targetDefense = target?.ownerId != null && target.ownerId !== player.id
    ? number(target.defense) : 0;
  const targetKey = target ? location(target.x, target.y) : '';
  const ownTarget = target ? Math.max(0, state.getTroopsForPlayerOnTile(target, player.id)
    - (context.departing.get(targetKey) || 0)) + (context.arriving.get(targetKey) || 0) : 0;
  const landArrival = movingTroops && LAND_TERRAIN.has(target?.type);
  const arrivingForce = landArrival ? troopsSent + ownTarget : 0;
  const defensiveStrength = visibleDefenders + targetDefense;
  const canCaptureIfDefendersStay = landArrival && arrivingForce > defensiveStrength && target.ownerId !== player.id;

  let silverCost = state.getSilverCost(action);
  let materialCost = state.getMaterialCost(action);
  let silverGain = 0;
  let materialGain = 0;
  let influenceCost = 0;
  if (action.type === 'BUY_MATERIALS') { silverCost = number(action.quantity) * ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER; materialGain = number(action.quantity); }
  if (action.type === 'SELL_MATERIALS') { materialCost = number(action.quantity); silverGain = number(action.quantity) * ECONOMY.COSTS.MARKET_SELL_MATERIAL_SILVER; }
  if (action.type === 'DONATE_TO_WORLD_BANK') silverCost = ECONOMY.COSTS.DONATION_SILVER;
  if (action.type === 'REPAY_BOND') silverCost = number(action.amount);
  if (action.type === 'ISSUE_BOND') silverGain = ECONOMY.COSTS.BOND_PROCEEDS;
  if (action.type === 'TRANSFER_RESOURCE') {
    if (action.resource === 'SILVER') silverCost = number(action.amount);
    if (action.resource === 'MATERIALS') materialCost = number(action.amount);
  }
  if (action.type === 'PROPOSE_OI_RESOLUTION') influenceCost = ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE;
  const availableSilver = Math.max(0, number(player.resources.SILVER) - context.reservedSilver);
  const availableMaterials = Math.max(0, number(player.resources.MATERIALS) - context.reservedMaterials);
  const affected = new Set(landArrival ? enemyIds : []);
  if ((landArrival || action.type === 'MOVE_SHIPS') && target?.ownerId != null && target.ownerId !== player.id) affected.add(target.ownerId);
  const treaties = (entries) => [...affected].filter((id) => (entries || []).some((entry) =>
    entry.expiresAfterRound >= state.currentRound && entry.playerIds.includes(player.id) && entry.playerIds.includes(id))).length;
  const brokenPacts = treaties(state.nonAggressionPacts);
  const brokenTradeTreaties = treaties(state.freeTradeTreaties);
  const taxRate = action.type === 'SET_TAX_RATE' ? action.taxRate : player.taxRate;
  const projectedPopulation = context.cities.reduce((sum, tile) => sum + projectUrbanPopulation(tile, taxRate).population, 0);
  const previousPopulation = context.cities.reduce((sum, tile) => sum + projectUrbanPopulation(tile, player.taxRate).population, 0);
  const targetPopulation = urban(target) ? number(target.population) : 0;
  const targetTaxIncome = urban(target) ? calculateTaxIncome(projectUrbanPopulation(target, player.taxRate).population, player.taxRate).silverEarned : 0;
  const targetMaterials = target?.building === 'FACTORY' ? (target.factoriesCount || 1) * ECONOMY.ROUND_PRODUCTION.MATERIALS_PER_FACTORY : 0;
  const sourceShips = source ? state.getShipsForPlayerOnTile(source, player.id) : 0;
  return {
    version: 1,
    troopsSent, visibleDefenders, targetDefense, defensiveStrength, ownTroopsAtTarget: ownTarget,
    forceRatio: defensiveStrength > 0 && landArrival ? arrivingForce / defensiveStrength : 0,
    forceAdvantage: landArrival ? arrivingForce - defensiveStrength : 0,
    forceSurvivorsIfDefendersStay: landArrival ? Math.max(0, arrivingForce - defensiveStrength) : 0,
    forceLossesIfDefendersStay: landArrival ? Math.min(arrivingForce, defensiveStrength) : 0,
    sourceIsCapital: Number(source?.type === 'CAP'), sourceIsCity: Number(urban(source)),
    sourceIsFactory: Number(source?.building === 'FACTORY'), sourcePopulation: number(source?.population),
    sourceTroopsBefore: sourceStock, sourceTroopsReserved: reservedTroops, sourceTroopsAfter,
    sourceEnemyAdjacentTiles: sourceNeighbors.enemyTiles, sourceEnemyAdjacentTroops: sourceNeighbors.enemyTroops,
    sourceDefenseMargin: sourceTroopsAfter - sourceNeighbors.enemyTroops,
    leavesSourceExposed: Number(movingTroops && sourceNeighbors.enemyTiles > 0 && sourceTroopsAfter === 0),
    targetEnemyAdjacentTiles: targetNeighbors.enemyTiles, targetEnemyAdjacentTroops: targetNeighbors.enemyTroops,
    targetIsNeutral: Number(target != null && target.ownerId == null),
    targetIsEnemy: Number(target?.ownerId != null && target.ownerId !== player.id),
    targetIsWater: Number(WATER_TERRAIN.has(target?.type)),
    targetVisibleEnemyShips: target ? Object.entries(target.shipsByPlayer || {})
      .reduce((sum, [id, count]) => sum + (id !== player.id ? count : 0), 0) : 0,
    targetIsCapital: Number(target?.type === 'CAP'), targetIsCity: Number(urban(target)),
    targetIsResource: Number(['MPT', 'MPA'].includes(target?.type)),
    targetIsFactory: Number(target?.building === 'FACTORY'), targetPopulation, targetTaxIncome,
    targetMaterialProduction: targetMaterials,
    targetInfluenceProduction: urban(target) ? ECONOMY.ROUND_PRODUCTION.INFLUENCE_PER_CITY : 0,
    canCaptureIfDefendersStay: Number(canCaptureIfDefendersStay),
    populationAdded: action.type === 'BUILD_CITY' ? ECONOMY.POPULATION.NEW_CITY : 0,
    silverIncomeGain: (canCaptureIfDefendersStay ? targetTaxIncome : 0)
      + (action.type === 'BUILD_CITY' ? calculateTaxIncome(projectUrbanPopulation(
        { population: ECONOMY.POPULATION.NEW_CITY }, player.taxRate).population, player.taxRate).silverEarned : 0),
    populationGainIfCaptured: canCaptureIfDefendersStay ? targetPopulation : 0,
    materialProductionGain: (action.type === 'BUILD_FACTORY' ? ECONOMY.ROUND_PRODUCTION.MATERIALS_PER_FACTORY : 0)
      + (canCaptureIfDefendersStay ? targetMaterials : 0),
    influenceGain: action.type === 'DONATE_TO_WORLD_BANK' ? ECONOMY.COSTS.DONATION_INFLUENCE : 0,
    debtAdded: action.type === 'ISSUE_BOND' ? ECONOMY.COSTS.BOND_PRINCIPAL : 0,
    debtRepaid: action.type === 'REPAY_BOND' ? number(action.amount) : 0,
    silverCost, materialCost, influenceCost, availableSilver, availableMaterials,
    silverAfter: availableSilver - silverCost + silverGain,
    materialsAfter: availableMaterials - materialCost + materialGain,
    silverBudgetFraction: silverCost / Math.max(1, availableSilver),
    materialBudgetFraction: materialCost / Math.max(1, availableMaterials),
    taxIncomeDelta: calculateTaxIncome(projectedPopulation, taxRate).silverEarned
      - calculateTaxIncome(previousPopulation, player.taxRate).silverEarned,
    taxPopulationDelta: projectedPopulation - previousPopulation,
    troopsRecruited: action.type === 'RECRUIT_TROOP' ? number(action.count) : 0,
    shipsSent: action.type === 'MOVE_SHIPS' ? number(action.ships) : 0,
    sourceCargoBefore: cargoBefore,
    sourceCargoAfter: Math.max(0, cargoBefore - cargoReservedForShips
      - (WATER_TERRAIN.has(source?.type) ? reservedTroopsBase : 0)
      - (action.type === 'MOVE_SHIPS' ? number(action.ships) * ECONOMY.NAVAL.TROOPS_PER_SHIP
        : usesCargo ? troopsSent : 0)),
    sourceShipsAfter: Math.max(0, sourceShips - reservedShips
      - (action.type === 'MOVE_SHIPS' ? number(action.ships) : 0)),
    breaksNonAggressionPact: Number(brokenPacts > 0), breaksFreeTradeTreaty: Number(brokenTradeTreaties > 0),
    pactInfluencePenalty: Math.min(number(player.resources.INFLUENCE), brokenPacts * ECONOMY.COSTS.BROKEN_PACT_INFLUENCE_PENALTY)
  };
}

/** Bounded categories for the decision table; the evaluator uses the numeric features. */
export function actionFeatureSignature(features) {
  const magnitude = (value) => value <= 0 ? 0 : Math.floor(Math.log2(value)) + 1;
  const budget = Math.max(features.silverBudgetFraction, features.materialBudgetFraction);
  const cost = budget === 0 ? 0 : budget < 0.25 ? 1 : budget < 0.75 ? 2 : 3;
  return `f1:balance=${Math.sign(features.forceAdvantage)}:guard=${magnitude(features.sourceTroopsAfter)}`
    + `:risk=${features.leavesSourceExposed}:value=${features.targetIsCapital * 8 + features.targetIsCity * 4 + features.targetIsResource * 2 + features.targetIsFactory}`
    + `:home=${features.sourceIsCapital * 4 + features.sourceIsCity * 2 + features.sourceIsFactory}`
    + `:pact=${features.breaksNonAggressionPact}${features.breaksFreeTradeTreaty}:cost=${cost}`;
}
