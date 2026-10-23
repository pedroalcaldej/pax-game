import {
  NATIONS,
  TILE_STATUS,
  TILE_STATUS_COLORS
} from '../../../../shared/Constants.js';

const TILE_ICONS = {
  CAP: '♜',
  CIU: '▥',
  TR: '▲',
  MPT: '◆',
  FT: '▥',
  AG: '≋',
  MPA: '◈',
  FA: '▤'
};

const STATUS_LABELS = {
  [TILE_STATUS.NORMAL]: 'Normal',
  [TILE_STATUS.CONFLICT]: 'En conflicto',
  [TILE_STATUS.BLOCKED]: 'Bloqueada'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export class Inspector {
  constructor(container) {
    this.container = container;
    this.player = null;
    this.phase = 1;
    this.onAction = () => {};
    this.tile = null;
    this.renderSignature = null;
    this.activeSlot = 0;
    this.actionQuantities = new Map();
    this.grid = null;
    this.render();
  }

  setContext(player, phase, onAction = this.onAction, activeSlot = this.activeSlot, grid = this.grid) {
    this.player = player;
    this.phase = phase;
    this.onAction = onAction;
    this.activeSlot = activeSlot;
    this.grid = grid;
    const signature = JSON.stringify({
      playerId: player?.id,
      resources: player?.resources,
      plannedActions: player?.plannedActions,
      phase,
      activeSlot,
      tile: this.tile
    });
    if (signature !== this.renderSignature) this.render();
  }

  getActions(tile, nation) {
    const isOwned = Boolean(this.player && tile && tile.ownerId === this.player.id);
    const resources = this.player?.resources || {};
    const hasSilver = (amount) => (resources.SILVER || 0) >= amount;
    const hasMaterials = (amount) => (resources.MATERIALS || 0) >= amount;
    const planningPhase = this.phase === 2;
    const landCanBuild = ['TR', 'MPT'].includes(tile?.type) && !tile?.building;
    const waterCanBuild = ['AG', 'MPA'].includes(tile?.type) && !tile?.building;
    const otherActions = (this.player?.plannedActions || [])
      .filter((action, index) => action && index !== this.activeSlot);
    const silverReserved = otherActions.reduce((sum, action) => {
      if (action.type === 'BUILD_CITY') return sum + 50;
      if (action.type === 'BUILD_FACTORY') {
        const target = this.grid?.[action.y]?.[action.x];
        return sum + (target?.type === 'MPT' || target?.type === 'MPA' ? 5 : 10);
      }
      if (action.type === 'RECRUIT_TROOP') return sum + 5 * (action.count || 1);
      if (action.type === 'MOVE_CAPITAL') return sum + 10;
      return sum;
    }, 0);
    const materialsReserved = otherActions.reduce((sum, action) => {
      if (action.type === 'RECRUIT_TROOP') return sum + 2 * (action.count || 1);
      if (action.type === 'MOVE_CAPITAL') return sum + 2;
      return sum;
    }, 0);
    const availableSilver = Math.max(0, (resources.SILVER || 0) - silverReserved);
    const availableMaterials = Math.max(0, (resources.MATERIALS || 0) - materialsReserved);
    const recruitLimit = Math.floor(Math.min(availableSilver / 5, availableMaterials / 2));
    const movementReserved = otherActions
      .filter((action) => action.type === 'MOVE_TROOPS' && action.x === tile?.x && action.y === tile?.y)
      .reduce((sum, action) => sum + action.troops, 0);
    const movableTroops = Math.max(0, (tile?.troops || 0) - movementReserved);
    const quantity = (type, limit, unit, field) => {
      const key = `${tile?.x}:${tile?.y}:${type}`;
      const previous = this.actionQuantities.get(key) || 1;
      const value = Math.min(limit, Math.max(1, previous));
      this.actionQuantities.set(key, value);
      return { max: limit, unit, field, value };
    };

    return [
      {
        type: 'BUILD_CITY',
        title: 'Construir ciudad',
        cost: '50 plata',
        enabled: planningPhase && isOwned && tile.type === 'TR' && !tile.building && hasSilver(50),
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : tile?.type !== 'TR' || tile?.building ? 'Requiere tierra vacía' : 'Plata insuficiente'
      },
      {
        type: 'BUILD_FACTORY',
        title: 'Construir fábrica',
        cost: `${['MPT', 'MPA'].includes(tile?.type) ? 5 : 10} plata`,
        enabled: planningPhase && isOwned && (landCanBuild || waterCanBuild) && hasSilver(['MPT', 'MPA'].includes(tile?.type) ? 5 : 10),
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : !(landCanBuild || waterCanBuild) ? 'Terreno no apto o ya edificado' : 'Plata insuficiente'
      },
      {
        type: 'RECRUIT_TROOP',
        title: 'Reclutar tropa',
        cost: '5 plata · 2 materiales por tropa',
        quantity: quantity('RECRUIT_TROOP', recruitLimit, 'tropas', 'count'),
        enabled: planningPhase && isOwned && recruitLimit > 0,
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : 'Recursos insuficientes o reservados'
      },
      {
        type: 'MOVE_TROOPS',
        title: 'Mover tropas',
        cost: `${movableTroops} tropas disponibles`,
        quantity: quantity('MOVE_TROOPS', movableTroops, 'tropas', 'troops'),
        enabled: planningPhase && isOwned && movableTroops > 0,
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : 'No hay tropas disponibles para otro movimiento'
      },
      {
        type: 'MOVE_CAPITAL',
        title: 'Trasladar capital',
        cost: '10 plata · 2 materiales',
        enabled: planningPhase && isOwned && tile?.type === 'CIU' && hasSilver(10) && hasMaterials(2),
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : tile?.type !== 'CIU' ? 'Selecciona una ciudad propia' : 'Recursos insuficientes'
      }
    ];
  }

  render(tile = this.tile) {
    this.tile = tile;
    this.renderSignature = JSON.stringify({
      playerId: this.player?.id,
      resources: this.player?.resources,
      plannedActions: this.player?.plannedActions,
      phase: this.phase,
      activeSlot: this.activeSlot,
      tile
    });
    const nation = tile?.nationId == null ? null : NATIONS[tile.nationId];
    const status = tile?.status || TILE_STATUS.NORMAL;
    const statusColor = TILE_STATUS_COLORS[status] || '#64748b';

    if (!tile) {
      this.container.innerHTML = `
        <section class="pax-inspector">
          <header class="pax-section-heading"><span class="pax-heading-icon">⌖</span> Inspector de Casilla</header>
          <div class="pax-inspector-empty">Selecciona una casilla del mapa para ver sus datos.</div>
        </section>
      `;
      return;
    }

    const type = escapeHtml(tile.type || '—');
    const label = nation ? escapeHtml(nation.name) : 'Territorio neutral';
    const building = tile.building ? escapeHtml(tile.building) : 'Sin edificio';
    const feature = tile.waterFeature === 'RIVER'
      ? 'Río'
      : tile.waterFeature === 'SEA'
        ? 'Mar'
        : null;
    const details = [
      ['Población', tile.population ?? 0, '♟'],
      ['Tropas', tile.troops ?? 0, '⚔'],
      ['Defensa', tile.defense ?? 0, '⬡']
    ];

    this.container.innerHTML = `
      <section class="pax-inspector">
        <header class="pax-section-heading">
          <span class="pax-heading-icon">⌖</span>
          <span>Inspector de Casilla</span>
          <span class="pax-coordinates">(X: ${tile.x}, Y: ${tile.y})</span>
        </header>
        <div class="pax-inspector-content">
          <article class="pax-tile-card" style="--nation-color:${nation?.color || '#334155'};--tile-accent:${nation?.color || '#f2a900'}">
            <div class="pax-tile-card-top">
              <span class="pax-tile-defense">⬡ ${tile.defense ?? 0}</span>
              <span class="pax-tile-type">${type}</span>
            </div>
            <div class="pax-tile-art" aria-hidden="true">${TILE_ICONS[tile.type] || '◇'}</div>
            <div class="pax-tile-owner">${label}</div>
            <div class="pax-tile-details">
              ${details.map(([name, value, icon]) => `
                <span title="${name}"><i>${icon}</i>${value}</span>
              `).join('')}
            </div>
            <div class="pax-tile-card-bottom">
              <span>${building}</span>
              <span class="pax-status-dot" style="--status-color:${statusColor}" title="${STATUS_LABELS[status] || status}"></span>
            </div>
          </article>
          <section class="pax-development">
            <h3>Opciones de desarrollo</h3>
            ${feature ? `<div class="pax-feature-tag">${feature}</div>` : ''}
            <p>${this.phase === 2
              ? 'Elige un espacio de acción abajo. La orden queda guardada allí y se ejecuta al terminar el tiempo.'
              : 'Las órdenes se habilitan durante la fase de planificación y se ejecutan al terminar.'}</p>
            <div class="pax-tile-actions">
              ${this.getActions(tile, nation).map((action) => `
                <div class="pax-tile-action-control">
                  ${action.quantity ? `
                    <label class="pax-tile-quantity">
                      <span>Cantidad (${action.quantity.unit})</span>
                      <input type="number" min="1" max="${action.quantity.max}" step="1"
                        value="${action.quantity.value}" data-action-amount="${action.type}"
                        aria-label="Cantidad de ${action.quantity.unit} para ${action.title}"
                        ${action.enabled ? '' : 'disabled'}>
                    </label>
                  ` : ''}
                  <button
                    class="pax-tile-action ${action.enabled ? '' : 'is-unavailable'}"
                    type="button"
                    data-action="${action.type}"
                    ${action.enabled ? '' : 'disabled'}
                    title="${action.enabled ? action.title : action.reason}"
                  >
                    <span class="pax-tile-action-copy">
                      <strong>${action.title}</strong>
                      <small>${action.enabled ? action.cost : action.reason}</small>
                    </span>
                    <span class="pax-tile-action-cost">${action.cost}</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </section>
    `;

    for (const input of this.container.querySelectorAll('[data-action-amount]')) {
      input.addEventListener('input', () => {
        const amount = Number(input.value);
        if (Number.isInteger(amount) && amount >= 1 && amount <= Number(input.max)) {
          this.actionQuantities.set(`${tile.x}:${tile.y}:${input.dataset.actionAmount}`, amount);
        }
      });
    }
    for (const button of this.container.querySelectorAll('[data-action]')) {
      button.addEventListener('click', () => {
        const type = button.dataset.action;
        const input = button.parentElement.querySelector(`[data-action-amount="${type}"]`);
        const amount = input ? Number(input.value) : null;
        this.onAction({
          type,
          x: tile.x,
          y: tile.y,
          ...(type === 'RECRUIT_TROOP' ? { count: amount } : {}),
          ...(type === 'MOVE_TROOPS' ? { troops: amount } : {})
        });
      });
    }
  }
}
