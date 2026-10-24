/**
 * client/src/ui/components/Map.js
 * Renderiza el mapa usando HTML5 Canvas.
 */

import {
  MAP_CONFIG,
  NATION_COLORS,
  TERRAIN_COLORS,
  TERRAIN_TYPES,
  TILE_STATUS_COLORS
} from '../../../../shared/Constants.js';
import { generateInitialGrid } from '../../../../shared/MapGenerator.js';

export class Map {
  /**
   * @param {HTMLElement} container - Contenedor DOM (#map-container) donde se insertará el Canvas.
   * @param {(tile: object | null) => void} onTileSelected - Notifica la casilla seleccionada.
   */
  constructor(container, onTileSelected = () => {}) {
    this.viewport = container;
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'overflow:auto',
      'align-items:center',
      'justify-content:center'
    ].join(';');
    this.onTileSelected = onTileSelected;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.grid = null;
    this.selectedPosition = null;
    this.dmzZones = [];
    this.selectionFromUser = false;
    this.actionHighlights = [];
    this.proposalPreview = null;
    this.zoom = 1;
    this.minZoom = 0.2;
    this.maxZoom = 2;
    this.dragStart = null;
    this.didDrag = false;
    this.targetSelectionMode = false;

    this.tileSize = MAP_CONFIG?.TILE_SIZE || 40;
    this.cols = MAP_CONFIG?.GRID_WIDTH || 30;
    this.rows = MAP_CONFIG?.GRID_HEIGHT || 30;

    const pixelWidth = this.cols * this.tileSize;
    const pixelHeight = this.rows * this.tileSize;

    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.display = 'block';
    this.canvas.style.width = `${pixelWidth}px`;
    this.canvas.style.height = `${pixelHeight}px`;
    this.canvas.style.minWidth = `${pixelWidth}px`;
    this.canvas.style.minHeight = `${pixelHeight}px`;
    this.canvas.style.flexShrink = '0';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'none';

    this.viewport.innerHTML = '';
    this.viewport.appendChild(this.container);
    this.container.appendChild(this.canvas);

    this.canvas.addEventListener('click', (event) => this.handleClick(event));
    this.canvas.addEventListener('pointerdown', (event) => this.startPan(event));
    this.canvas.addEventListener('pointermove', (event) => this.pan(event));
    this.canvas.addEventListener('pointerup', () => this.endPan());
    this.canvas.addEventListener('pointercancel', () => {
      this.endPan();
      this.didDrag = false;
    });
    this.container.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    this.createZoomControls();
    this.zoom = this.getFitZoom();
    this.applyZoom();
    this.render(generateInitialGrid());
  }

  setTargetSelectionMode(enabled) {
    this.targetSelectionMode = Boolean(enabled);
    if (!this.targetSelectionMode) this.proposalPreview = null;
    this.canvas.style.cursor = this.targetSelectionMode ? 'crosshair' : 'grab';
    if (this.grid) this.render(this.grid, false);
  }

  setDemilitarizedZones(zones = [], redraw = true) {
    this.dmzZones = zones;
    if (redraw && this.grid) this.render(this.grid, false);
  }

  createZoomControls() {
    this.controls = document.createElement('div');
    this.controls.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'z-index:2',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:6px',
      'border:1px solid #475569',
      'border-radius:8px',
      'background:rgba(15, 23, 42, 0.92)',
      'color:#f8fafc',
      'font:12px system-ui, sans-serif'
    ].join(';');
    this.controls.innerHTML = `
      <button type="button" aria-label="Alejar" title="Alejar" data-zoom="out">−</button>
      <span aria-live="polite" data-zoom-label></span>
      <button type="button" aria-label="Acercar" title="Acercar" data-zoom="in">+</button>
      <button type="button" title="Ajustar al panel" data-zoom="fit">Ajustar</button>
    `;

    for (const button of this.controls.querySelectorAll('button')) {
      button.style.cssText = [
        'min-width:30px',
        'height:28px',
        'border:1px solid #475569',
        'border-radius:5px',
        'background:#1e293b',
        'color:#f8fafc',
        'cursor:pointer',
        'font:inherit'
      ].join(';');
      button.addEventListener('click', () => {
        if (button.dataset.zoom === 'in') this.zoomAt(this.zoom * 1.2);
        if (button.dataset.zoom === 'out') this.zoomAt(this.zoom / 1.2);
        if (button.dataset.zoom === 'fit') this.fitToPanel();
      });
    }

    this.zoomLabel = this.controls.querySelector('[data-zoom-label]');
    this.viewport.appendChild(this.controls);
  }

  getFitZoom() {
    const availableWidth = Math.max(1, this.container.clientWidth - 32);
    const availableHeight = Math.max(1, this.container.clientHeight - 32);
    const fit = Math.min(
      availableWidth / this.canvas.width,
      availableHeight / this.canvas.height
    );
    return Math.min(1, Math.max(this.minZoom, fit));
  }

  applyZoom() {
    const width = this.canvas.width * this.zoom;
    const height = this.canvas.height * this.zoom;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.minWidth = `${width}px`;
    this.canvas.style.minHeight = `${height}px`;
    this.container.style.justifyContent = width > this.container.clientWidth ? 'flex-start' : 'center';
    this.container.style.alignItems = height > this.container.clientHeight ? 'flex-start' : 'center';
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  zoomAt(nextZoom, clientX, clientY) {
    const zoom = Math.min(this.maxZoom, Math.max(this.minZoom, nextZoom));
    if (zoom === this.zoom) return;

    const containerBounds = this.container.getBoundingClientRect();
    const canvasBounds = this.canvas.getBoundingClientRect();
    const anchorX = clientX ?? containerBounds.left + this.container.clientWidth / 2;
    const anchorY = clientY ?? containerBounds.top + this.container.clientHeight / 2;
    const mapX = (anchorX - canvasBounds.left) / this.zoom;
    const mapY = (anchorY - canvasBounds.top) / this.zoom;
    const offsetX = canvasBounds.left - containerBounds.left + this.container.scrollLeft;
    const offsetY = canvasBounds.top - containerBounds.top + this.container.scrollTop;

    this.zoom = zoom;
    this.applyZoom();

    this.container.scrollLeft = offsetX + mapX * zoom - (anchorX - containerBounds.left);
    this.container.scrollTop = offsetY + mapY * zoom - (anchorY - containerBounds.top);
  }

  fitToPanel() {
    this.zoomAt(this.getFitZoom());
    this.container.scrollLeft = 0;
    this.container.scrollTop = 0;
  }

  handleWheel(event) {
    event.preventDefault();
    this.zoomAt(this.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY);
  }

  startPan(event) {
    if (event.button !== 0) return;
    this.dragStart = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: this.container.scrollLeft,
      scrollTop: this.container.scrollTop
    };
    this.didDrag = false;
    this.canvas.setPointerCapture(event.pointerId);
  }

  pan(event) {
    this.updateProposalPreview(event);
    if (!this.dragStart || event.pointerId !== this.dragStart.pointerId) return;
    const deltaX = event.clientX - this.dragStart.clientX;
    const deltaY = event.clientY - this.dragStart.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      this.didDrag = true;
      this.canvas.style.cursor = 'grabbing';
    }
    if (!this.didDrag) return;

    this.container.scrollLeft = this.dragStart.scrollLeft - deltaX;
    this.container.scrollTop = this.dragStart.scrollTop - deltaY;
  }

  endPan() {
    if (!this.dragStart) return;
    this.dragStart = null;
    this.canvas.style.cursor = this.targetSelectionMode ? 'crosshair' : 'grab';
  }

  getTerrainColor(type) {
    return TERRAIN_COLORS[type] || TERRAIN_COLORS[TERRAIN_TYPES.TR];
  }

  getNationColor(tile) {
    if (tile == null || tile.nationId == null) return null;
    return NATION_COLORS[tile.nationId] || null;
  }

  getTile(grid, x, y) {
    if (y < 0 || x < 0 || y >= this.rows || x >= this.cols) return null;
    return grid[y] && grid[y][x] ? grid[y][x] : null;
  }

  setActionHighlights(highlights = []) {
    this.actionHighlights = highlights.filter((position) => (
      Number.isInteger(position?.x) && Number.isInteger(position?.y)
    ));
    if (this.grid) {
      this.render(this.grid, false);
    }
  }

  /**
   * Recorre todas las celdas (y, x), pinta terrenos del GDD y bordes de soberanía.
   * @param {Array} grid - Matriz del servidor o generador local.
   */
  render(grid, notifySelection = true) {
    if (!grid || !Array.isArray(grid)) return;
    this.grid = grid;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(grid, x, y);
        const type = tile?.type || TERRAIN_TYPES.TR;
        const posX = x * this.tileSize;
        const posY = y * this.tileSize;

        this.ctx.fillStyle = tile?.waterFeature === 'RIVER'
          ? '#38BDF8'
          : this.getTerrainColor(type);
        this.ctx.fillRect(posX, posY, this.tileSize, this.tileSize);

        this.drawTileIcon(type, posX, posY);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 6px system-ui, sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(type, posX + this.tileSize - 2, posY + 3);

        this.ctx.textAlign = 'left';
        const defense = tile?.defense ?? 0;
        if (defense > 0) this.ctx.fillText(`D${defense}`, posX + 3, posY + 3);

        this.ctx.font = '5px system-ui, sans-serif';
        this.ctx.textBaseline = 'bottom';
        const population = tile?.population ?? 0;
        if (population > 0) this.ctx.fillText(`P${population}`, posX + 3, posY + this.tileSize - 3);
        const troops = tile?.troops ?? 0;
        if (troops > 0) {
          this.ctx.textAlign = 'right';
          this.ctx.fillText(`T${troops}`, posX + this.tileSize - 3, posY + this.tileSize - 3);
        }

        const statusColor = TILE_STATUS_COLORS[tile?.status];
        if (statusColor) {
          this.ctx.beginPath();
          this.ctx.arc(posX + this.tileSize - 5, posY + this.tileSize - 5, 2, 0, Math.PI * 2);
          this.ctx.fillStyle = statusColor;
          this.ctx.fill();
        }
      }
    }

    this.drawBorders(grid);
    this.drawDemilitarizedZones();
    this.drawSelection();
    this.drawProposalPreview();
    if (notifySelection && this.selectedPosition) {
      this.onTileSelected(this.getTile(grid, this.selectedPosition.x, this.selectedPosition.y));
    }
  }

  drawDemilitarizedZones() {
    const ctx = this.ctx;
    for (const zone of this.dmzZones) {
      for (let y = Math.max(0, zone.y - 2); y <= Math.min(this.rows - 1, zone.y + 2); y += 1) {
        for (let x = Math.max(0, zone.x - 2); x <= Math.min(this.cols - 1, zone.x + 2); x += 1) {
          const posX = x * this.tileSize;
          const posY = y * this.tileSize;
          ctx.fillStyle = 'rgba(147, 51, 234, 0.2)';
          ctx.fillRect(posX, posY, this.tileSize, this.tileSize);
          ctx.strokeStyle = 'rgba(216, 180, 254, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(posX + 0.5, posY + 0.5, this.tileSize - 1, this.tileSize - 1);
        }
      }
    }
  }

  drawTileIcon(type, posX, posY) {
    const ctx = this.ctx;
    const centerX = posX + this.tileSize / 2;
    const centerY = posY + this.tileSize / 2 + 1;
    const iconSize = this.tileSize * 0.23;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = Math.max(1, this.tileSize / 24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === TERRAIN_TYPES.AG || type === TERRAIN_TYPES.MPA) {
      for (let line = -1; line <= 1; line++) {
        const y = centerY + line * iconSize * 0.65;
        ctx.beginPath();
        ctx.moveTo(centerX - iconSize, y);
        ctx.quadraticCurveTo(centerX - iconSize / 2, y - iconSize * 0.4, centerX, y);
        ctx.quadraticCurveTo(centerX + iconSize / 2, y + iconSize * 0.4, centerX + iconSize, y);
        ctx.stroke();
      }
    } else if (type === TERRAIN_TYPES.CAP || type === TERRAIN_TYPES.CIU
      || type === TERRAIN_TYPES.FT || type === TERRAIN_TYPES.FA) {
      const width = iconSize * 1.8;
      const height = iconSize * (type === TERRAIN_TYPES.CAP ? 1.9 : 1.5);
      ctx.fillRect(centerX - width / 2, centerY - height / 2, width, height);
      if (type === TERRAIN_TYPES.CAP) {
        ctx.beginPath();
        ctx.moveTo(centerX - width / 2, centerY - height / 2);
        ctx.lineTo(centerX, centerY - height);
        ctx.lineTo(centerX + width / 2, centerY - height / 2);
        ctx.fill();
      }
      ctx.fillStyle = this.getTerrainColor(type);
      ctx.fillRect(centerX - iconSize * 0.3, centerY + iconSize * 0.1, iconSize * 0.6, iconSize * 0.9);
    } else {
      ctx.beginPath();
      ctx.moveTo(centerX - iconSize, centerY + iconSize * 0.7);
      ctx.lineTo(centerX, centerY - iconSize);
      ctx.lineTo(centerX + iconSize, centerY + iconSize * 0.7);
      ctx.closePath();
      ctx.fill();
      if (type === TERRAIN_TYPES.MPT) {
        ctx.beginPath();
        ctx.arc(centerX, centerY + iconSize * 0.1, iconSize * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = this.getTerrainColor(type);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBorders(grid) {
    const size = this.tileSize;
    const ctx = this.ctx;

    ctx.lineCap = 'square';
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(grid, x, y);
        if (!tile || tile.ownerId != null) continue;
        const posX = x * size;
        const posY = y * size;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          posX + 0.5,
          posY + 0.5,
          size - 1,
          size - 1
        );
      }
    }

    const edges = [
      { dx: 0, dy: -1, x1: 0, y1: 0, x2: 1, y2: 0 },
      { dx: 1, dy: 0, x1: 1, y1: 0, x2: 1, y2: 1 },
      { dx: 0, dy: 1, x1: 0, y1: 1, x2: 1, y2: 1 },
      { dx: -1, dy: 0, x1: 0, y1: 0, x2: 0, y2: 1 }
    ];

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(grid, x, y);
        if (!tile || tile.ownerId == null) continue;
        const nationColor = this.getNationColor(tile) || '#f8fafc';
        const posX = x * size;
        const posY = y * size;

        for (const edge of edges) {
          const neighbor = this.getTile(grid, x + edge.dx, y + edge.dy);
          const sameOwner = neighbor?.ownerId === tile.ownerId;
          const otherNation = neighbor?.ownerId != null && !sameOwner;
          let x1 = posX + edge.x1 * size;
          let y1 = posY + edge.y1 * size;
          let x2 = posX + edge.x2 * size;
          let y2 = posY + edge.y2 * size;

          if (otherNation) {
            const inset = 1.5;
            if (edge.dx !== 0) {
              x1 += edge.dx < 0 ? inset : -inset;
              x2 += edge.dx < 0 ? inset : -inset;
            } else {
              y1 += edge.dy < 0 ? inset : -inset;
              y2 += edge.dy < 0 ? inset : -inset;
            }
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = sameOwner ? 'rgba(248, 250, 252, 0.75)' : nationColor;
          ctx.lineWidth = sameOwner ? 1 : otherNation ? 2 : 3;
          ctx.stroke();
        }
      }
    }
  }

  drawSelection() {
    const ctx = this.ctx;
    for (const highlight of this.actionHighlights) {
      const posX = highlight.x * this.tileSize;
      const posY = highlight.y * this.tileSize;
      const isTarget = highlight.role === 'target';
      ctx.fillStyle = isTarget ? 'rgba(34, 211, 238, 0.2)' : 'rgba(250, 204, 21, 0.2)';
      ctx.fillRect(posX + 2, posY + 2, this.tileSize - 4, this.tileSize - 4);
      ctx.strokeStyle = isTarget ? '#22d3ee' : '#facc15';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(posX + 2, posY + 2, this.tileSize - 4, this.tileSize - 4);
    }
    if (!this.selectedPosition) return;
    const posX = this.selectedPosition.x * this.tileSize;
    const posY = this.selectedPosition.y * this.tileSize;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(posX + 3, posY + 3, this.tileSize - 6, this.tileSize - 6);
    ctx.setLineDash([]);
  }

  drawProposalPreview() {
    if (!this.proposalPreview) return;
    const { x: centerX, y: centerY } = this.proposalPreview;
    const ctx = this.ctx;
    for (let y = Math.max(0, centerY - 2); y <= Math.min(this.rows - 1, centerY + 2); y += 1) {
      for (let x = Math.max(0, centerX - 2); x <= Math.min(this.cols - 1, centerX + 2); x += 1) {
        const posX = x * this.tileSize;
        const posY = y * this.tileSize;
        const isCenter = x === centerX && y === centerY;
        ctx.fillStyle = isCenter ? 'rgba(203, 213, 225, 0.45)' : 'rgba(148, 163, 184, 0.3)';
        ctx.fillRect(posX + 2, posY + 2, this.tileSize - 4, this.tileSize - 4);
        ctx.strokeStyle = isCenter ? '#e2e8f0' : 'rgba(226, 232, 240, 0.75)';
        ctx.lineWidth = isCenter ? 3 : 1.5;
        ctx.setLineDash([]);
        ctx.strokeRect(posX + 2, posY + 2, this.tileSize - 4, this.tileSize - 4);
      }
    }
  }

  updateProposalPreview(event) {
    if (!this.targetSelectionMode || this.dragStart) return;
    const bounds = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / bounds.width;
    const scaleY = this.canvas.height / bounds.height;
    const x = Math.floor(((event.clientX - bounds.left) * scaleX) / this.tileSize);
    const y = Math.floor(((event.clientY - bounds.top) * scaleY) / this.tileSize);
    const tile = this.getTile(this.grid, x, y);
    const nextPreview = tile ? { x: tile.x, y: tile.y } : null;
    if (
      nextPreview?.x === this.proposalPreview?.x
      && nextPreview?.y === this.proposalPreview?.y
    ) {
      return;
    }
    this.proposalPreview = nextPreview;
    this.render(this.grid, false);
  }

  handleClick(event) {
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    if (!this.grid) return;
    const bounds = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / bounds.width;
    const scaleY = this.canvas.height / bounds.height;
    const x = Math.floor(((event.clientX - bounds.left) * scaleX) / this.tileSize);
    const y = Math.floor(((event.clientY - bounds.top) * scaleY) / this.tileSize);
    const tile = this.getTile(this.grid, x, y);
    if (!tile) return;

    this.selectedPosition = { x, y };
    this.selectionFromUser = true;
    try {
      this.render(this.grid, false);
      this.onTileSelected(tile);
    } finally {
      this.selectionFromUser = false;
    }
  }
}
