/**
 * shared/Constants.js
 * Configuración global y constantes mecánicas de PAX.
 * Compartido entre Servidor y Cliente para garantizar sincronización.
 */

export const NATIONS = [
  { id: 'nation-0', nationId: 0, name: 'alpha', color: '#FDE047' },
  { id: 'nation-1', nationId: 1, name: 'beta', color: '#FB7185' },
  { id: 'nation-2', nationId: 2, name: 'gamma', color: '#34D399' },
  { id: 'nation-3', nationId: 3, name: 'delta', color: '#A78BFA' }
];

export const MAX_PLAYERS = NATIONS.length;
export const MAX_PLAYER_NAME_LENGTH = 24;
export const MAX_CHAT_MESSAGE_LENGTH = 240;

const GRID_SIZE = 30;

export const MAP_CONFIG = {
  GRID_SIZE,
  TOTAL_TILES: GRID_SIZE * GRID_SIZE,
  TILE_SIZE: 32,
  MAX_PLAYERS
};

export const ACTION_SLOT_COUNT = 3;
export const MAX_ROUNDS = 30;

export const GAME_SETTINGS_LIMITS = {
  maxRounds: { min: 5, max: 100 },
  planningDuration: { min: 15, max: 300 },
  actionSlotCount: { min: 1, max: 6 },
  startingResource: { min: 0, max: 1000 },
  oiFrequency: { min: 0, max: 20 },
  oiMeetingDuration: { min: 15, max: 180 },
  mapSize: { min: 12, max: 50 }
};

export const GAME_SETTINGS_PRESETS = {
  quick: { maxRounds: 15, planningDuration: 30, actionSlotCount: 2 },
  normal: { maxRounds: 30, planningDuration: 60, actionSlotCount: 3 },
  strategic: { maxRounds: 40, planningDuration: 120, actionSlotCount: 4 }
};

export const DEFAULT_GAME_SETTINGS = {
  preset: 'normal',
  maxRounds: MAX_ROUNDS,
  planningDuration: 60,
  actionSlotCount: ACTION_SLOT_COUNT,
  startingResources: { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 },
  oiFrequency: 5,
  oiMeetingDuration: 60,
  mapSeed: null,
  mapSize: GRID_SIZE,
  dmzEnabled: true
};

const clampSetting = (value, { min, max }, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

export function normalizeGameSettings(input = {}) {
  const preset = GAME_SETTINGS_PRESETS[input.preset] ? input.preset : DEFAULT_GAME_SETTINGS.preset;
  const presetValues = GAME_SETTINGS_PRESETS[preset];
  const source = { ...DEFAULT_GAME_SETTINGS, ...presetValues, ...input };
  const resources = input.startingResources || DEFAULT_GAME_SETTINGS.startingResources;
  const mapSeed = input.mapSeed === null || input.mapSeed === undefined || input.mapSeed === ''
    ? null
    : String(input.mapSeed).slice(0, 40);
  return {
    preset,
    maxRounds: clampSetting(source.maxRounds, GAME_SETTINGS_LIMITS.maxRounds, presetValues.maxRounds),
    planningDuration: clampSetting(source.planningDuration, GAME_SETTINGS_LIMITS.planningDuration, presetValues.planningDuration),
    actionSlotCount: clampSetting(source.actionSlotCount, GAME_SETTINGS_LIMITS.actionSlotCount, presetValues.actionSlotCount),
    startingResources: {
      SILVER: clampSetting(resources.SILVER, GAME_SETTINGS_LIMITS.startingResource, 100),
      MATERIALS: clampSetting(resources.MATERIALS, GAME_SETTINGS_LIMITS.startingResource, 100),
      INFLUENCE: clampSetting(resources.INFLUENCE, GAME_SETTINGS_LIMITS.startingResource, 100)
    },
    oiFrequency: clampSetting(source.oiFrequency, GAME_SETTINGS_LIMITS.oiFrequency, 5),
    oiMeetingDuration: clampSetting(source.oiMeetingDuration, GAME_SETTINGS_LIMITS.oiMeetingDuration, 60),
    mapSeed,
    mapSize: clampSetting(
      source.mapSize,
      GAME_SETTINGS_LIMITS.mapSize,
      GRID_SIZE
    ),
    dmzEnabled: source.dmzEnabled !== false
  };
}

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
export const LAND_TERRAIN = new Set([
  TERRAIN_TYPES.CAP,
  TERRAIN_TYPES.CIU,
  TERRAIN_TYPES.TR,
  TERRAIN_TYPES.MPT,
  TERRAIN_TYPES.FT
]);
export const WATER_TERRAIN = new Set([TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA, TERRAIN_TYPES.FA]);

export const SPAWN_POSITIONS = [
  { x: 6, y: 6 },
  { x: 23, y: 6 },
  { x: 6, y: 23 },
  { x: 23, y: 23 }
];

export const NATION_COLORS = NATIONS.map((nation) => nation.color);
export const AVAILABLE_NATION_COLORS = [
  '#FDE047',
  '#FB7185',
  '#34D399',
  '#A78BFA',
  '#22D3EE',
  '#FB923C',
  '#F472B6',
  '#A3E635'
];

export const LEGACY_NATION_NAMES = new Map([
  ['Nación Amarilla', 'alpha'],
  ['Nación Azul', 'beta'],
  ['Nación Roja', 'gamma'],
  ['Nación Verde', 'delta']
]);

export const PROTOCOL = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_GAME: 'join_game',
  REJOIN_ROOM: 'rejoin_room',
  LEAVE_ROOM: 'leave_room',
  START_GAME: 'start_game',
  RESTART_GAME: 'restart_game',
  READY_PHASE_END: 'ready_phase_end',
  SET_GAME_PAUSED: 'set_game_paused',
  END_GAME: 'end_game',
  GAME_STATE_UPDATE: 'game_state_update',
  PHASE_CHANGE: 'phase_change',
  SET_TAX_RATE: 'set_tax_rate',
  PLAYER_ACTION: 'player_action',
  PROPOSE_OI_RESOLUTION: 'propose_oi_resolution',
  SUBMIT_OI_VOTE: 'submit_oi_vote',
  PROPOSE_TREATY: 'propose_treaty',
  RESPOND_TO_TREATY: 'respond_to_treaty',
  CANCEL_TREATY_OFFER: 'cancel_treaty_offer',
  FINANCIAL_ACTION: 'financial_action',
  ACTION_RESULT: 'action_result',
  ACTION_ERROR: 'action_error'
};

Object.assign(PROTOCOL, {
  LOBBY_CREATE: 'lobby_create',
  LOBBY_JOIN: 'lobby_join',
  LOBBY_QUICK_MATCH: 'lobby_quick_match',
  LOBBY_WATCH: 'lobby_watch',
  LOBBY_UPDATE_PROFILE: 'lobby_update_profile',
  LOBBY_UPDATE_SETTINGS: 'lobby_update_settings',
  LOBBY_TOGGLE_READY: 'lobby_toggle_ready',
  LOBBY_REPLAY: 'lobby_replay',
  LOBBY_LEAVE: 'lobby_leave',
  LOBBY_SEND_CHAT: 'lobby_send_chat',
  LOBBY_STATE_UPDATE: 'lobby_state_update',
  LOBBY_CHAT_MESSAGE: 'lobby_chat_message'
});

export const TREATY_TYPES = {
  NON_AGGRESSION_PACT: 'NON_AGGRESSION_PACT',
  FREE_TRADE: 'FREE_TRADE'
};

export const OI_RESOLUTIONS = {
  ARMAMENT_LIMIT: 'ARMAMENT_LIMIT',
  INDUSTRY_LIMIT: 'INDUSTRY_LIMIT',
  DEMILITARIZED_ZONE: 'DEMILITARIZED_ZONE',
  CONDITIONAL_SUBSIDY: 'CONDITIONAL_SUBSIDY'
};

export const TIMINGS = {
  // Duraciones de fase en segundos
  DECISION_PHASE_DURATION: 60, // Duración de la etapa de planificación
  AUTOMATIC_PHASE_DURATION: 5  // Tiempo de procesamiento para fases automáticas
};

export const ECONOMIC_POLICY = {
  // Límites impositivos (Tasa impositiva Tau)
  MIN_TAX_RATE: 0.05, // 5%
  MAX_TAX_RATE: 0.50, // 50%
  DEFAULT_TAX_RATE: 0.20, // 20%
};

// Economía en unidades comparables: los cuatro componentes del GDI comienzan
// en 100 puntos y sus ingresos por ronda mantienen magnitudes similares.
export const ECONOMY = {
  STARTING_RESOURCES: { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 },
  POPULATION: {
    CAPITAL_START: 50,
    CITY_START: 50,
    NEW_CITY: 50,
    GROWTH_DIVISOR: 250,
    TAX_REVENUE_RATE: 0.2
  },
  ROUND_PRODUCTION: {
    MATERIALS_PER_FACTORY: 2,
    INFLUENCE_PER_CITY: 1
  },
  NAVAL: {
    TROOPS_PER_SHIP: 5
  },
  OI_BOT_WAGER_SHARE: 0.5,
  BANK_TRANSFER_TARIFF_RATE: 0.2,
  COSTS: {
    BUILD_CITY_SILVER: 50,
    BUILD_FACTORY_SILVER: 10,
    BUILD_FACTORY_RESOURCE_SILVER: 5,
    RECRUIT_TROOP_SILVER: 5,
    RECRUIT_TROOP_MATERIALS: 20,
    MOVE_CAPITAL_SILVER: 10,
    MOVE_CAPITAL_MATERIALS: 20,
    BUILD_SHIP_SILVER: 15,
    BUILD_SHIP_MATERIALS: 15,
    MARKET_BUY_MATERIAL_SILVER: 3,
    MARKET_SELL_MATERIAL_SILVER: 1,
    DONATION_SILVER: 15,
    DONATION_INFLUENCE: 1,
    BOND_PRINCIPAL: 25,
    BOND_PROCEEDS: 20,
    BOND_INTEREST_PER_ROUND: 1,
    OI_PROPOSAL_INFLUENCE: 2,
    OI_SUBSIDY_SILVER: 25,
    BROKEN_PACT_INFLUENCE_PENALTY: 10,
    BOND_DEFAULT_INFLUENCE_PENALTY: 5
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

export const GAME_STAGES = {
  ROUND_START: 'ROUND_START',
  PLANNING: 'PLANNING',
  RESOLVING: 'RESOLVING',
  CLOSING: 'CLOSING',
  INTERNATIONAL_MEETING: 'INTERNATIONAL_MEETING'
};

export const STAGE_TIMINGS = {
  ROUND_START_MS: 1400,
  CLOSING_MS: 2600,
  RESOLUTION_LOADING_THRESHOLD_MS: 350
};
