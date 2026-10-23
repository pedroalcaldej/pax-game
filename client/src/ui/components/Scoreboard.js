/**
 * client/src/ui/components/Scoreboard.js
 * Componente UI para la tabla de clasificación y estado de la ronda.
 */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatScore(value) {
  return Number.isFinite(value) ? Math.floor(value).toLocaleString('es-ES') : '0';
}

export class Scoreboard {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div style="
        background: #1e293b; 
        border: 1px solid #334155; 
        border-radius: 12px; 
        padding: 20px; 
        color: #f8fafc;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      ">
        <!-- Encabezado de Fase y Tiempo -->
        <div style="
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 16px; 
          border-bottom: 1px solid #334155; 
          padding-bottom: 12px;
        ">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Fase Actual</div>
            <div id="phase-label" style="font-size: 18px; font-weight: 700; color: #f59e0b;">Fase 1</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Tiempo</div>
            <div id="timer-label" style="font-size: 20px; font-weight: 700; color: #ef4444;">60s</div>
          </div>
        </div>

        <!-- Título Ranking -->
        <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
          Ranking Naciones (GDI)
        </div>

        <!-- Contenedor dinámico de jugadores -->
        <div id="player-list" style="display: flex; flex-direction: column; gap: 8px;">
          <div style="color: #64748b; font-size: 13px;">Cargando jugadores...</div>
        </div>
      </div>
    `;
  }

  /**
   * Recibe la actualización del estado del juego y renderiza los datos.
   */
  update(players = [], currentPhase = 1, timeRemaining = 60) {
    const phaseEl = this.container.querySelector('#phase-label');
    const timerEl = this.container.querySelector('#timer-label');
    const listEl = this.container.querySelector('#player-list');

    if (phaseEl) phaseEl.textContent = `Fase ${currentPhase}`;
    if (timerEl) timerEl.textContent = `${timeRemaining}s`;

    if (!listEl) return;

    // Normalizar la entrada: convertir a Array si viene como Objeto o Map
    let playersList = [];
    if (Array.isArray(players)) {
      playersList = [...players];
    } else if (players && typeof players === 'object') {
      playersList = Object.values(players);
    }

    if (playersList.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 13px;">Sin jugadores en la sala...</div>`;
      return;
    }

    playersList.sort((left, right) => (
      (right.gdiPoints ?? 100) - (left.gdiPoints ?? 100)
    ));

    // Dibujar cada jugador en la lista
    listEl.innerHTML = playersList
      .map((player, index) => {
        const name = escapeHtml(player.name || `Nación ${index + 1}`);
        const breakdown = player.gdiBreakdown || {};
        const initial = Number.isFinite(breakdown.initial) ? breakdown.initial : 100;
        const population = Number.isFinite(breakdown.population)
          ? breakdown.population
          : Math.max(0, (player.gdiPoints ?? 100) - initial);
        const industry = Number.isFinite(breakdown.industry) ? breakdown.industry : 0;
        const total = Number.isFinite(player.gdiPoints)
          ? player.gdiPoints
          : initial + population + industry;
        const color = /^#[0-9a-f]{6}$/i.test(player.color || '') ? player.color : '#2563eb';

        return `
          <div class="pax-score-entry" style="--score-nation-color:${color}">
            <div class="pax-score-entry-heading">
              <span class="pax-score-player">#${index + 1} ${name}</span>
              <span class="pax-score-total">${formatScore(total)} GDI</span>
            </div>
            <dl class="pax-score-breakdown" aria-label="Desglose del puntaje de ${name}">
              <div><dt>Puntaje inicial</dt><dd>${formatScore(initial)}</dd></div>
              <div><dt>Población</dt><dd>+${formatScore(population)}</dd></div>
              <div><dt>Industria</dt><dd>+${formatScore(industry)}</dd></div>
            </dl>
          </div>
        `;
      })
      .join('');
  }
}