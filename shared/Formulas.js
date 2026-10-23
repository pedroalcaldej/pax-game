/**
 * shared/Formulas.js
 * Ecuaciones matemáticas y reglas puras del motor económico de PAX.
 * Se ejecutan de manera idéntica en Cliente y Servidor.
 */

import { ECONOMIC_POLICY, BUILDING_TYPES } from './Constants.js';

/**
 * Calcula la tasa de crecimiento demográfico (G).
 * Fórmula: G = 1 / (100 * tau)
 * @param {number} taxRate - Tasa impositiva (tau), entre MIN_TAX_RATE y MAX_TAX_RATE.
 * @returns {number} Multiplicador de crecimiento poblacional.
 */
export function calculatePopulationGrowth(taxRate) {
  // Aseguramos que la tasa impositiva esté dentro de los límites permitidos
  const boundedTaxRate = Math.min(
    Math.max(taxRate, ECONOMIC_POLICY.MIN_TAX_RATE),
    ECONOMIC_POLICY.MAX_TAX_RATE
  );

  return 1 / (100 * boundedTaxRate);
}

/**
 * Calcula la producción bruta de recursos de un territorio.
 * @param {number} factoryCount - Cantidad de fábricas activas.
 * @param {number} population - Población disponible en la casilla o nación.
 * @returns {number} Unidades de recurso básico producidas.
 */
export function calculateResourceProduction(factoryCount, population) {
  if (factoryCount <= 0 || population <= 0) return 0;

  const baseOutput = factoryCount * BUILDING_TYPES.FACTORY.baseProduction;
  
  // La población actúa como un factor de eficiencia (mínimo 1 de eficiencia)
  const laborEfficiency = Math.log10(population + 1);
  
  return Math.floor(baseOutput * laborEfficiency);
}

/**
 * Calcula la recaudación fiscal neta asignada al Tesoro Estatal.
 * @param {number} totalProduction - Producción bruta obtenida.
 * @param {number} taxRate - Tasa impositiva aplicable (tau).
 * @returns {number} Ingresos impositivos estatales.
 */
export function calculateTaxRevenue(totalProduction, taxRate) {
  return totalProduction * taxRate;
}

/**
 * Calcula el Índice de Desarrollo Global (GDI) para el ranking de victoria.
 * @param {number} netProduction - Producción neta de la ronda.
 * @param {number} populationStability - Índice de estabilidad o crecimiento.
 * @returns {number} Puntos GDI generados en la ronda.
 */
export function calculateGDI(netProduction, populationStability) {
  return Math.max(0, netProduction * populationStability);
}