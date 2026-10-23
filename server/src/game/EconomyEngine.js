/**
 * server/src/game/EconomyEngine.js
 * Lógica económica de PAX.
 * Calcula el crecimiento de población, recaudación fiscal y puntos GDI.
 */

import { GAME_CONFIG } from '../../../shared/Constants.js';

export class EconomyEngine {
  /**
   * Aplica el ciclo económico a todos los jugadores según su tasa impositiva (tau).
   * @param {Array} players - Lista de jugadores activos en la partida.
   * @param {Array} grid - Matriz 16x16 del mapa para calcular territorios.
   */
  static processEconomyCycle(players, grid) {
    if (!players || players.length === 0) return;

    players.forEach(player => {
      // 1. Contar territorios dominados por el jugador
      let territoryCount = 0;
      let buildingBonus = 1;

      grid.forEach(row => {
        row.forEach(tile => {
          if (tile.ownerId === player.id) {
            territoryCount++;
            if (tile.building === 'CAPITAL') buildingBonus += 0.5;
            if (tile.building === 'CITY') buildingBonus += 0.2;
            if (tile.building === 'FACTORY') buildingBonus += 0.3;
          }
        });
      });

      // 2. Calcular crecimiento y recaudación basada en la tasa impositiva (tau)
      const taxRate = player.taxRate || GAME_CONFIG.DEFAULT_TAX_RATE; // Tasa tau (ej. 0.15)
      
      // A mayor impuesto, menor crecimiento de población/puntos
      const growthFactor = (1 - taxRate) * buildingBonus;
      const income = Math.floor(territoryCount * taxRate * 100);

      // 3. Actualizar recursos y puntos GDI del jugador
      player.resources = (player.resources || 0) + income;
      player.gdiPoints = (player.gdiPoints || 0) + Math.floor(territoryCount * growthFactor);
    });
  }
}