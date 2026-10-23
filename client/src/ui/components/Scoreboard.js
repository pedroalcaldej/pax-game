/**
 * client/src/ui/components/Scoreboard.js
 * Componente UI para mostrar la fase activa, el reloj de 60s y el ranking GDI.
 */

export class Scoreboard {
  /**
   * @param {HTMLElement} containerElement - Elemento contenedor en el DOM.
   */
  constructor(containerElement) {
    this.container = containerElement;
    this.renderBase();
  }

  /**
   * Renderiza el maquetado inicial del marcador.
   */
  renderBase() {
    this.container.innerHTML = `
      <div class="scoreboard-container" style="background: #111e2e; color: #fff; padding: 15px; border-radius: 8px; font-family: sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2c3e50; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <span style="font-size: 12px; color: #8f9cae; display: block;">FASE ACTUAL</span>
            <strong id="currentPhaseLabel" style="font-size: 16px; color: #f39c12;">Esperando inicio...</strong>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 12px; color: #8f9cae; display: block;">TIEMPO</span>
            <strong id="timerLabel" style="font-size: 20px; color: #e74c3c;">60s</strong>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #bdc3c7;">RANKING NACIONES (GDI)</h4>
          <ul id="playerList" style="list-style: none; padding: 0; margin: 0; font-size: 13px;">
            <li style="color: #7f8c8d;">Sin jugadores en la sala...</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Actualiza los datos mostrados en el marcador.
   * @param {Object} data - Datos con fase, tiempo restante y lista de jugadores.
   */
  update(data) {
    const { phase, round, secondsRemaining, players } = data;

    // 1. Actualizar Fase y Ronda
    const phaseLabel = this.container.querySelector('#currentPhaseLabel');
    if (phaseLabel && phase) {
      phaseLabel.textContent = `Ronda ${round || 1} - Fase ${phase}`;
    }

    // 2. Actualizar Temporizador
    const timerLabel = this.container.querySelector('#timerLabel');
    if (timerLabel) {
      timerLabel.textContent = secondsRemaining !== undefined ? `${secondsRemaining}s` : '--';
    }

    // 3. Actualizar Lista de Jugadores
    const playerList = this.container.querySelector('#playerList');
    if (playerList && Array.isArray(players)) {
      playerList.innerHTML = players.map(p => `
        <li style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #2c3e50;">
          <span><strong>${p.name}</strong> (τ: ${Math.round(p.taxRate * 100)}%)</span>
          <span style="color: #2ecc71;">${Math.floor(p.gdiPoints)} GDI</span>
        </li>
      `).join('');
    }
  }
}