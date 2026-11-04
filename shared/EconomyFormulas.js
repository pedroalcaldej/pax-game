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

/** Amounts are gross payments; only silver is taxed in a neutral-country trade. */
export function calculateCountryTrade(offer, { atWar = false, freeTrade = false } = {}) {
  if (atWar) return { ok: false, message: 'Los países en conflicto no pueden comerciar entre sí.' };
  const { offerResource, requestResource, offerAmount, requestAmount } = offer;
  if (!['SILVER', 'MATERIALS'].includes(offerResource)
    || !['SILVER', 'MATERIALS'].includes(requestResource) || offerResource === requestResource) {
    return { ok: false, message: 'El intercambio debe combinar Plata y Materiales.' };
  }
  if (![offerAmount, requestAmount].every((amount) => Number.isSafeInteger(amount) && amount > 0)) {
    return { ok: false, message: 'Indica cantidades enteras mayores que cero.' };
  }
  const materials = offerResource === 'MATERIALS' ? offerAmount : requestAmount;
  const silver = offerResource === 'SILVER' ? offerAmount : requestAmount;
  const rate = freeTrade ? 1 : 2;
  if (!Number.isSafeInteger(materials * rate) || silver !== materials * rate) {
    return { ok: false, message: freeTrade
      ? 'Con un TLC activo, el intercambio debe ser 1 de Plata por 1 Material.'
      : 'Entre países neutrales, el intercambio debe ser 2 de Plata por 1 Material.' };
  }
  const silverTariff = freeTrade ? 0 : materials;
  const proposerTariff = offerResource === 'SILVER' ? silverTariff : 0;
  const recipientTariff = requestResource === 'SILVER' ? silverTariff : 0;
  return { ok: true, freeTrade, silverTariff, proposerTariff, recipientTariff,
    receivedByRecipient: offerAmount - proposerTariff,
    receivedByProposer: requestAmount - recipientTariff };
}
