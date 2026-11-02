import { ECONOMY } from './Constants.js';

export function getPopulationGrowthRate(taxRate) {
  if (!(taxRate > 0)) return 0;
  return 1 / (ECONOMY.POPULATION.GROWTH_DIVISOR * taxRate);
}

export function projectUrbanPopulation(tile, taxRate) {
  const population = Number.isFinite(tile?.population) ? tile.population : 0;
  if (!(taxRate > 0)) {
    return { population, populationIncrease: 0 };
  }

  const populationIncrease = Math.round(population * getPopulationGrowthRate(taxRate));
  return {
    population: population + populationIncrease,
    populationIncrease
  };
}

export function calculateTaxIncome(population, taxRate) {
  const taxRevenue = population * taxRate * ECONOMY.POPULATION.TAX_REVENUE_RATE;
  return { silverEarned: Math.round(taxRevenue) };
}
