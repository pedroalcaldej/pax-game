/**
 * client/src/core/Map.js
 * Renderizador en Canvas HTML5 para la grilla 16x16 de PAX.
 * Muestra territorios, colores de jugadores e infraestructuras.
 */

import { MAP_CONFIG } from '../../../shared/Constants.js';

// Colores identificativos para los 4 jugadores
const PLAYER_COLORS = [
  '#E74C3C', // Jugador 1: Rojo
  '#3498DB', // Jugador 2: Azul
  '#2ECC71', // Jugador 3: Verde
  '#F1C40F'  // Jugador 4: Amarillo
];

export class Map {
  /**
   * @param {HTMLCanvasElement} canvasElement - Elemento canvas del DOM.
   * @param {number} tileSize - Tamaño en píxeles de cada casilla (por defecto 40px).
   */
  constructor(canvasElement, tileSize = 40) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.tileSize = tileSize;

    // Ajustar dimensiones del canvas (16 x 40px = 640px)
    this.canvas.width = MAP_CONFIG.GRID_WIDTH * this.tileSize;
    this.canvas.height = MAP_CONFIG.GRID_HEIGHT * this.tileSize;
  }

  /**
   * Renderiza la grilla completa basada en el estado recibido del servidor.
   * @param {Array} grid - Matriz 16x16 de casillas.
   * @param {Array} players - Lista de jugadores para mapear IDs a colores.
   */
  render(grid, players = []) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const playerMap = new Map();
    players.forEach((p, index) => playerMap.set(p.id, index));

    grid.forEach(row => {
      row.forEach(tile => {
        const x = tile.x * this.tileSize;
        const y = tile.y * this.tileSize;

        // 1. Dibujar el fondo de la casilla
        this.ctx.fillStyle = '#2C3E50'; // Color neutro base
        if (tile.ownerId && playerMap.has(tile.ownerId)) {
          const colorIndex = playerMap.get(tile.ownerId);
          this.ctx.fillStyle = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        }
        this.ctx.fillRect(x, y, this.tileSize, this.tileSize);

        // 2. Dibujar el borde de la casilla
        this.ctx.strokeStyle = '#1A252F';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);

        // 3. Dibujar marcador de edificio si existe
        if (tile.building) {
          this.drawBuilding(x, y, tile.building);
        }
      });
    });
  }

  /**
   * Dibuja un ícono para las infraestructuras.
   */
  drawBuilding(x, y, buildingType) {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2;

    if (buildingType === 'CAPITAL') {
      this.ctx.fillText('⭐', centerX, centerY);
    } else if (buildingType === 'CITY') {
      this.ctx.fillText('🏛️', centerX, centerY);
    } else if (buildingType === 'FACTORY') {
      this.ctx.fillText('🏭', centerX, centerY);
    }
  }
}