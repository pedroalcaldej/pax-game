/**
 * Procesa crecimiento demográfico, recaudación y producción al comenzar una ronda.
 */

import { ECONOMY } from '../../../shared/Constants.js';
import { calculateTaxIncome, projectUrbanPopulation } from '../../../shared/EconomyFormulas.js';

export class EconomyEngine {
  static processRoundEconomy(gameState) {
    const economies = Array.from(gameState.players.values(), (player) => {
      const ownedTiles = gameState.grid.flat().filter((tile) => tile.ownerId === player.id);
      return {
        player,
        taxRate: player.taxRate,
        ownedTiles,
        factoryCount: ownedTiles.reduce((count, tile) => (
          count + (tile.building === 'FACTORY' ? tile.factoriesCount || 1 : 0)
        ), 0),
        controlledCities: ownedTiles.filter((tile) => tile.type === 'CAP' || tile.type === 'CIU').length,
        population: 0
      };
    });

    // Aplicar cada fase a todos los países mantiene el orden económico global.
    for (const economy of economies) {
      economy.player.resources.MATERIALS += (
        economy.factoryCount * ECONOMY.ROUND_PRODUCTION.MATERIALS_PER_FACTORY
      );
    }

    for (const economy of economies) {
      const { player, controlledCities } = economy;
      const influenceEarned = controlledCities * ECONOMY.ROUND_PRODUCTION.INFLUENCE_PER_CITY;
      player.resources.INFLUENCE += influenceEarned;
      if (influenceEarned > 0) {
        gameState.recordEvent(
          `${player.name} obtuvo ${influenceEarned} de Influencia Política por sus ciudades y capitales controladas.`
        );
      }
    }

    for (const economy of economies) {
      for (const tile of economy.ownedTiles) {
        if (tile.type !== 'CAP' && tile.type !== 'CIU') continue;
        const projected = projectUrbanPopulation(tile, economy.taxRate);
        tile.population = projected.population;
        economy.population += tile.population;
      }
    }

    for (const economy of economies) {
      const { player, taxRate, population } = economy;
      const taxIncome = calculateTaxIncome(population, taxRate);
      player.resources.SILVER += taxIncome.silverEarned;
      player.gdiPoints = gameState.calculateGDI(player);
    }
  }
}
