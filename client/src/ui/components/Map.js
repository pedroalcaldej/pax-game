/**
 * client/src/ui/components/Map.js
 * Renderiza la grilla del juego 16x16 usando HTML5 Canvas.
 */

import { MAP_CONFIG } from '../../../../shared/Constants.js';

export class Map {
  /**
   * @param {HTMLElement} container - Contenedor DOM (#map-container) donde se insertará el Canvas.
   */
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    // Dimensiones de la grilla (16 casillas * 40px por casilla = 640px)
    this.tileSize = MAP_CONFIG?.TILE_SIZE || 40;
    this.cols = MAP_CONFIG?.GRID_WIDTH || 16;
    this.rows = MAP_CONFIG?.GRID_HEIGHT || 16;

    this.canvas.width = this.cols * this.tileSize;
    this.canvas.height = this.rows * this.tileSize;

    // Estilos inline para asegurar visibilidad dentro del contenedor
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

    // Limpiar contenedor e insertar canvas
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // Dibujar pantalla de espera inicial mientras llegan datos del servidor
    this.drawPlaceholder();
  }

  /**
   * Dibuja un tablero por defecto antes de recibir el GameState
   */
  drawPlaceholder() {
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
      }
    }
  }

  /**
   * Renderiza la matriz de casillas del servidor.
   * @param {Array} grid - Matriz 16x16 del servidor.
   */
  render(grid) {
    if (!grid || !Array.isArray(grid)) return;

    // Limpiar el Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        const posX = x * this.tileSize;
        const posY = y * this.tileSize;

        // 1. Color de fondo según si la casilla tiene dueño
        if (tile.ownerId) {
          this.ctx.fillStyle = '#2563eb'; // Azul nación
        } else {
          this.ctx.fillStyle = '#0f172a'; // Casilla neutral oscura
        }
        this.ctx.fillRect(posX, posY, this.tileSize, this.tileSize);

        // 2. Borde de la casilla (grilla)
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(posX, posY, this.tileSize, this.tileSize);

        // 3. Dibujar Edificios
        if (tile.building === 'CAPITAL') {
          // Capital (Cuadrado dorado)
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.fillRect(posX + 8, posY + 8, this.tileSize - 16, this.tileSize - 16);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(posX + 8, posY + 8, this.tileSize - 16, this.tileSize - 16);
        } else if (tile.building === 'CITY') {
          // Ciudad (Círculo cian)
          this.ctx.beginPath();
          this.ctx.arc(posX + this.tileSize / 2, posY + this.tileSize / 2, 8, 0, Math.PI * 2);
          this.ctx.fillStyle = '#06b6d4';
          this.ctx.fill();
        }
      });
    });
  }
}