/**
 * server/src/game/GameState.js
 * Maneja el estado global del juego en memoria dentro del servidor.
 * Es la fuente única de verdad para el mapa y los jugadores.
 */

import { MAP_CONFIG, INITIAL_STATE, ECONOMIC_POLICY, BUILDING_TYPES } from '../../../shared/Constants.js';

export class GameState {
  constructor() {
    this.grid = this.createGrid();
    this.players = new Map(); // Guardará los datos de los 4 jugadores
    this.currentPhase = 1;     // Inicia en Fase 1
    this.currentRound = 1;     // Ronda actual
  }

  /**
   * Crea una matriz vacía de 16x16 representando las casillas del mapa.
   */
  createGrid() {
    const grid = [];
    for (let y = 0; y < MAP_CONFIG.GRID_HEIGHT; y++) {
      const row = [];
      for (let x = 0; x < MAP_CONFIG.GRID_WIDTH; x++) {
        row.push({
          x,
          y,
          ownerId: null,        // ID del jugador dueño de la casilla
          building: null,       // Tipo de edificio ('CAPITAL', 'CITY', 'FACTORY', etc.)
          population: 10,       // Población base inicial por casilla
          factoriesCount: 0     // Cantidad de fábricas construidas en esta casilla
        });
      }
      row.push(row);
    }
    return grid;
  }

  /**
   * Registra a un nuevo jugador en la partida (Máximo 4).
   * @param {string} playerId - ID único del socket/jugador.
   * @param {string} playerName - Nombre público del jugador.
   */
  addPlayer(playerId, playerName) {
    if (this.players.size >= MAP_CONFIG.MAX_PLAYERS) {
      throw new Error("La partida ya está llena (máximo 4 jugadores).");
    }

    const playerIndex = this.players.size; // 0, 1, 2 o 3

    const playerData = {
      id: playerId,
      name: playerName,
      slot: playerIndex,
      taxRate: ECONOMIC_POLICY.DEFAULT_TAX_RATE, // Tasa impositiva inicial (20%)
      resources: { ...INITIAL_STATE.INITIAL_RESOURCES },
      gdiPoints: 0,
      isReady: false
    };

    this.players.set(playerId, playerData);

    // Asignar posición inicial en la grilla (Capital + Ciudad)
    this.setupInitialTerritory(playerId, playerIndex);

    return playerData;
  }

  /**
   * Coloca la Capital y la Ciudad inicial de cada jugador en esquinas estratégicas.
   */
  setupInitialTerritory(playerId, slot) {
    // Definimos esquinas estratégicas según el turno de ingreso del jugador
    const spawnPoints = [
      { capX: 2, capY: 2, cityX: 3, cityY: 2 },   // Jugador 1 (Arriba Izquierda)
      { capX: 13, capY: 2, cityX: 12, cityY: 2 }, // Jugador 2 (Arriba Derecha)
      { capX: 2, capY: 13, cityX: 3, cityY: 13 }, // Jugador 3 (Abajo Izquierda)
      { capX: 13, capY: 13, cityX: 12, cityY: 13 }// Jugador 4 (Abajo Derecha)
    ];

    const pos = spawnPoints[slot];

    // Asignar Capital
    const capTile = this.grid[pos.capY][pos.capX];
    capTile.ownerId = playerId;
    capTile.building = BUILDING_TYPES.CAPITAL.id;
    capTile.population = 100; // Población alta en la capital

    // Asignar Ciudad
    const cityTile = this.grid[pos.cityY][pos.cityX];
    cityTile.ownerId = playerId;
    cityTile.building = BUILDING_TYPES.CITY.id;
    cityTile.population = 50;
  }

  /**
   * Retorna una representación limpia del estado para enviar a los clientes.
   */
  getPublicState() {
    return {
      grid: this.grid,
      players: Array.from(this.players.values()),
      currentPhase: this.currentPhase,
      currentRound: this.currentRound
    };
  }
}