/**
 * client/src/ui/components/Scoreboard.js
 * Componente UI para la tabla de clasificación y estado de la ronda.
 */

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
      playersList = players;
    } else if (players && typeof players === 'object') {
      playersList = Object.values(players);
    }

    if (playersList.length === 0) {
      listEl.innerHTML = `<div style="color: #64748b; font-size: 13px;">Sin jugadores en la sala...</div>`;
      return;
    }

    // Dibujar cada jugador en la lista
    listEl.innerHTML = playersList
      .map((player, index) => {
        const name = player.name || `Nación ${index + 1}`;
        const gdi = player.gdiPoints ?? 100;

        return `
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 10px 14px; 
            background: #0f172a; 
            border-radius: 8px; 
            border-left: 4px solid #2563eb;
          ">
            <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">#${index + 1} ${name}</span>
            <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">${gdi} GDI</span>
          </div>
        `;
      })
      .join('');
  }
}