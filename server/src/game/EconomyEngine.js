/**
 * Procesa crecimiento demográfico, recaudación y producción al comenzar una ronda.
 */

export class EconomyEngine {
  static processRoundEconomy(gameState) {
    for (const player of gameState.players.values()) {
      const taxRate = player.taxRate;
      let population = 0;
      let factoryCount = 0;

      for (const row of gameState.grid) {
        for (const tile of row) {
          if (tile.ownerId !== player.id) continue;

          if (tile.type === 'CAP' || tile.type === 'CIU') {
            tile.population = Math.floor(tile.population * (1 + 1 / (100 * taxRate)));
            population += tile.population;
          }
          if (tile.building === 'FACTORY') {
            factoryCount += tile.factoriesCount || 1;
          }
        }
      }

      player.resources.SILVER += Math.floor(population * taxRate);
      player.resources.MATERIALS += factoryCount * 2;
      const populationPoints = population;
      const industryPoints = factoryCount * 2;
      player.gdiBreakdown.population += populationPoints;
      player.gdiBreakdown.industry += industryPoints;
      player.gdiPoints = gameState.calculateGDI(player);
    }
  }
}
