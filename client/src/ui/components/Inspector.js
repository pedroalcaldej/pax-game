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
    this.render();
  }

  setContext(player, phase, onAction = this.onAction) {
    this.player = player;
    this.phase = phase;
    this.onAction = onAction;
    this.render();
  }

  getActions(tile, nation) {
    const isOwned = Boolean(this.player && tile && tile.ownerId === this.player.id);
    const resources = this.player?.resources || {};
    const hasSilver = (amount) => (resources.SILVER || 0) >= amount;
    const hasMaterials = (amount) => (resources.MATERIALS || 0) >= amount;
    const planningPhase = this.phase === 2;
    const landCanBuild = ['TR', 'MPT'].includes(tile?.type) && !tile?.building;
    const waterCanBuild = ['AG', 'MPA'].includes(tile?.type) && !tile?.building;

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
        cost: '5 plata · 2 materiales',
        enabled: planningPhase && isOwned && hasSilver(5) && hasMaterials(2),
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : 'Recursos insuficientes'
      },
      {
        type: 'MOVE_TROOPS',
        title: 'Mover tropas',
        cost: `${tile?.troops || 0} tropas`,
        enabled: planningPhase && isOwned && (tile?.troops || 0) > 0,
        reason: !planningPhase ? 'Disponible en fase de planificación' : !isOwned ? 'Requiere territorio propio' : 'No hay tropas en esta casilla'
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
              ? 'Acciones disponibles durante la fase de planificación.'
              : 'Las acciones se habilitan durante la fase de planificación.'}</p>
            <div class="pax-tile-actions">
              ${this.getActions(tile, nation).map((action) => `
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
              `).join('')}
            </div>
          </section>
        </div>
      </section>
    `;

    for (const button of this.container.querySelectorAll('[data-action]')) {
      button.addEventListener('click', () => this.onAction({
        type: button.dataset.action,
        x: tile.x,
        y: tile.y
      }));
    }
  }
}
