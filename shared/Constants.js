/**
 * shared/Constants.js
 * Configuración global y constantes mecánicas de PAX.
 * Compartido entre Servidor y Cliente para garantizar sincronización.
 */

export const MAP_CONFIG = {
  GRID_WIDTH: 30,
  GRID_HEIGHT: 30,
  TOTAL_TILES: 900,
  TILE_SIZE: 32,
  MAX_PLAYERS: 4,  // Escalable a más jugadores en futuras versiones
};

// Siglas de terreno según GDD sección 8
export const TERRAIN_TYPES = {
  CAP: 'CAP', // Capital
  CIU: 'CIU', // Ciudad
  TR: 'TR',   // Tierra
  MPT: 'MPT', // Materia Prima Terrestre
  FT: 'FT',   // Fábrica Terrestre
  AG: 'AG',   // Agua
  MPA: 'MPA', // Materia Prima Acuática
  FA: 'FA'    // Fábrica Acuática
};

export const TILE_STATUS = {
  NORMAL: 'NORMAL',
  CONFLICT: 'CONFLICT',
  BLOCKED: 'BLOCKED'
};

export const TILE_STATUS_COLORS = {
  [TILE_STATUS.NORMAL]: '#22C55E',
  [TILE_STATUS.CONFLICT]: '#EAB308',
  [TILE_STATUS.BLOCKED]: '#EF4444'
};

// Colores de fondo por sigla (GDD sección 8)
export const TERRAIN_COLORS = {
  [TERRAIN_TYPES.CAP]: '#718096',
  [TERRAIN_TYPES.CIU]: '#718096',
  [TERRAIN_TYPES.TR]: '#8D5B4C',
  [TERRAIN_TYPES.MPT]: '#8D5B4C',
  [TERRAIN_TYPES.FT]: '#8D5B4C',
  [TERRAIN_TYPES.AG]: '#3182CE',
  [TERRAIN_TYPES.MPA]: '#3182CE',
  [TERRAIN_TYPES.FA]: '#3182CE'
};

export const URBAN_TERRAIN = new Set([TERRAIN_TYPES.CAP, TERRAIN_TYPES.CIU]);
export const LAND_TERRAIN = new Set([TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.FT]);
export const WATER_TERRAIN = new Set([TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA, TERRAIN_TYPES.FA]);

export const SPAWN_POSITIONS = [
  { x: 6, y: 6 },
  { x: 23, y: 6 },
  { x: 6, y: 23 },
  { x: 23, y: 23 }
];

export const NATIONS = [
  { id: 'nation-0', nationId: 0, name: 'Nación Amarilla', color: '#EAB308' },
  { id: 'nation-1', nationId: 1, name: 'Nación Roja', color: '#EF4444' },
  { id: 'nation-2', nationId: 2, name: 'Nación Verde', color: '#22C55E' },
  { id: 'nation-3', nationId: 3, name: 'Nación Morada', color: '#A855F7' }
];

export const NATION_COLORS = NATIONS.map((nation) => nation.color);

export const GAME_CONFIG = {
  DEFAULT_TAX_RATE: 0.15,
  PHASE_DURATION_SECONDS: 60,
  TOTAL_PHASES: 5
};

export const PROTOCOL = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_GAME: 'join_game',
  START_GAME: 'start_game',
  READY_PHASE_END: 'ready_phase_end',
  END_GAME: 'end_game',
  GAME_STATE_UPDATE: 'game_state_update',
  PHASE_CHANGE: 'phase_change',
  SET_TAX_RATE: 'set_tax_rate',
  PLAYER_ACTION: 'player_action',
  PROPOSE_OI_RESOLUTION: 'propose_oi_resolution',
  SUBMIT_OI_VOTE: 'submit_oi_vote',
  ACTION_RESULT: 'action_result',
  ACTION_ERROR: 'action_error'
};

export const OI_RESOLUTIONS = {
  ARMAMENT_LIMIT: 'ARMAMENT_LIMIT',
  INDUSTRY_LIMIT: 'INDUSTRY_LIMIT',
  DEMILITARIZED_ZONE: 'DEMILITARIZED_ZONE',
  CONDITIONAL_SUBSIDY: 'CONDITIONAL_SUBSIDY'
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
  PHASE_4_GLOBAL_OI: 4,  // Cierre normal de acciones
  PHASE_5_SUMMARY: 5,    // Resumen de ronda e índice GDI
  PHASE_6_OI_SESSION: 6  // Ronda extraordinaria de votación de la OI
};