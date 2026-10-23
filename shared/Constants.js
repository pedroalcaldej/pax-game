/**
 * shared/Constants.js
 * Configuración global y constantes mecánicas de PAX.
 * Compartido entre Servidor y Cliente para garantizar sincronización.
 */

export const MAP_CONFIG = {
  GRID_WIDTH: 16,  // Matriz de 16x16 casillas
  GRID_HEIGHT: 16,
  TOTAL_TILES: 256,
  TILE_SIZE: 40,
  MAX_PLAYERS: 4,  // Escalable a más jugadores en futuras versiones
};

export const GAME_CONFIG = {
  DEFAULT_TAX_RATE: 0.15,
  PHASE_DURATION_SECONDS: 60,
  TOTAL_PHASES: 5
};

export const PROTOCOL = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_GAME: 'join_game',
  GAME_STATE_UPDATE: 'game_state_update',
  PHASE_CHANGE: 'phase_change',
  SET_TAX_RATE: 'set_tax_rate'
};

export const INITIAL_STATE = {
  // Infraestructura asignada a cada jugador al iniciar la partida
  BUILDINGS: [
    { type: 'CAPITAL', count: 1 },
    { type: 'CITY', count: 1 }
  ],
  INITIAL_RESOURCES: {
    BASIC: 100 // Reserva inicial de recurso base
  }
};

export const TIMINGS = {
  // Duraciones de fase en segundos
  DECISION_PHASE_DURATION: 60, // Fase 2: Planificación activa de jugadores
  AUTOMATIC_PHASE_DURATION: 5,  // Tiempo de procesamiento para fases automáticas
  TOTAL_PHASES: 5
};

export const ECONOMIC_POLICY = {
  // Límites impositivos (Tasa impositiva Tau)
  MIN_TAX_RATE: 0.05, // 5%
  MAX_TAX_RATE: 0.50, // 50%
  DEFAULT_TAX_RATE: 0.20, // 20%
};

// Tipos de recursos (Diseñado para expandirse a múltiples recursos en el futuro)
export const RESOURCE_TYPES = {
  BASIC: 'BASIC' // Por el momento un solo recurso genérico
};

// Tipos de infraestructuras/fábricas
export const BUILDING_TYPES = {
  CAPITAL: {
    id: 'CAPITAL',
    name: 'Capital',
    cost: { [RESOURCE_TYPES.BASIC]: 0 }
  },
  CITY: {
    id: 'CITY',
    name: 'Ciudad',
    cost: { [RESOURCE_TYPES.BASIC]: 50 }
  },
  FACTORY: {
    id: 'FACTORY',
    name: 'Fábrica Base',
    cost: { [RESOURCE_TYPES.BASIC]: 100 }, // Costo de construcción en recurso base
    baseProduction: 10 // Producción base por ronda
  }
};

// Identificadores de las 5 Fases del Ciclo de Juego
export const GAME_PHASES = {
  PHASE_1_STATS: 1,      // Cálculo demográfico y económico
  PHASE_2_DECISIONS: 2,  // Fase activa de 60s (Impuestos, construcciones, tratados)
  PHASE_3_RESOLUTION: 3, // Resolución de acciones
  PHASE_4_GLOBAL_OI: 4,   // Organismo Internacional / Propuestas
  PHASE_5_SUMMARY: 5     // Resumen de ronda e índice GDI
};