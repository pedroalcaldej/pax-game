/**
 * server/src/game/EconomyEngine.js
 * Procesa la economía de la partida al final de cada turno.
 * Utiliza las fórmulas puras de shared/Formulas.js.
 */

import { calculatePopulationGrowth, calculateResourceProduction, calculateTaxRevenue, calculateGDI } from '../../../shared/Formulas.js';

export class EconomyEngine {
  /**
   * Procesa la fase económica para todos los jugadores y casillas.
   * @param {GameState} gameState - Instancia actual del estado del juego.
   */
  static processRoundEconomy(gameState) {
    const players = gameState.players;

    // 1. Recorrer la grilla para actualizar población y producción por casilla
    gameState.grid.forEach(row => {
      row.forEach(tile => {
        if (tile.ownerId && players.has(tile.ownerId)) {
          const owner = players.get(tile.ownerId);

          // Crecimiento demográfico según la tasa impositiva (tau) del dueño
          const growthRate = calculatePopulationGrowth(owner.taxRate);
          tile.population = Math.floor(tile.population * (1 + growthRate));

          // Producción de recursos de la casilla
          if (tile.factoriesCount > 0) {
            const production = calculateResourceProduction(tile.factoriesCount, tile.population);
            const taxRevenue = calculateTaxRevenue(production, owner.taxRate);

            // Se añaden los recursos recaudados a las arcas del jugador
            owner.resources.BASIC += taxRevenue;
          }
        }
      });
    });

    // 2. Actualizar el índice GDI de cada jugador para el ranking
    players.forEach(player => {
      player.gdiPoints += calculateGDI(player.resources.BASIC, 1.0);
    });
  }
}