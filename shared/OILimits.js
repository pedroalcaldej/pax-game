import { ECONOMY } from './Constants.js';

export function countCountryTroops(grid, playerId) {
  return grid.flat().reduce((sum, tile) => {
    const visitors = tile.visitingTroops || {};
    const landTroops = tile.ownerId === playerId
      ? Math.max(0, (tile.troops || 0) - Object.values(visitors).reduce((total, count) => total + count, 0))
      : visitors[playerId] || 0;
    return sum + landTroops + (tile.transportedTroopsByPlayer?.[playerId] || 0);
  }, 0);
}

export function countCountryFactories(grid, playerId) {
  return grid.flat().reduce((sum, tile) => sum + (
    tile.ownerId === playerId && tile.building === 'FACTORY' ? tile.factoriesCount || 1 : 0
  ), 0);
}

export function getCountryLimitStatus(grid, playerId, policies = {}) {
  const troops = countCountryTroops(grid, playerId);
  const factories = countCountryFactories(grid, playerId);
  const excessTroops = policies.armamentLimit == null ? 0 : Math.max(0, troops - policies.armamentLimit);
  const excessFactories = policies.industryLimit == null ? 0 : Math.max(0, factories - policies.industryLimit);
  return {
    troops, factories, excessTroops, excessFactories,
    troopFine: excessTroops * ECONOMY.OI_LIMITS.TROOP_FINE_SILVER,
    factoryFine: excessFactories * ECONOMY.OI_LIMITS.FACTORY_FINE_SILVER
  };
}
