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
      <section class="pax-scoreboard">
        <div class="pax-scoreboard-status">
          <div>
            <span>Fase actual</span>
            <strong id="phase-label">Fase 1</strong>
          </div>
          <div class="pax-scoreboard-clock">
            <span>Tiempo</span>
            <strong id="timer-label">60s</strong>
          </div>
        </div>
        <div class="pax-score-table-scroll">
          <table class="pax-score-table">
            <thead>
              <tr>
                <th scope="col">País</th>
                <th scope="col">Plata</th>
                <th scope="col">Materiales</th>
                <th scope="col">Influencia</th>
                <th scope="col">Población</th>
                <th scope="col">GDI total</th>
              </tr>
            </thead>
            <tbody id="player-list">
              <tr><td colspan="6">Cargando países...</td></tr>
            </tbody>
          </table>
        </div>
        <p class="pax-scoreboard-note">El GDI es la suma de Plata, Materiales, Influencia y Población.</p>
      </section>
    `;
  }

  /**
   * Recibe la actualización del estado del juego y renderiza los datos.
   */
  update(players = [], currentPhase = 1, timeRemaining = 60, grid = [], isPaused = false) {
    const phaseEl = this.container.querySelector('#phase-label');
    const timerEl = this.container.querySelector('#timer-label');
    const listEl = this.container.querySelector('#player-list');

    if (phaseEl) phaseEl.textContent = `Fase ${currentPhase}`;
    if (timerEl) timerEl.textContent = `${timeRemaining}s${isPaused ? ' · Pausado' : ''}`;

    if (!listEl) return;

    // Normalizar la entrada: convertir a Array si viene como Objeto o Map
    let playersList = [];
    if (Array.isArray(players)) {
      playersList = [...players];
    } else if (players && typeof players === 'object') {
      playersList = Object.values(players);
    }

    if (playersList.length === 0) {
      listEl.innerHTML = '<tr><td colspan="6">Sin países en la sala.</td></tr>';
      return;
    }

    const scores = playersList.map((player, index) => {
      const resources = player.resources || {};
      const silver = Number.isFinite(resources.SILVER) ? resources.SILVER : 0;
      const materials = Number.isFinite(resources.MATERIALS) ? resources.MATERIALS : 0;
      const influence = Number.isFinite(resources.INFLUENCE) ? resources.INFLUENCE : 0;
      const population = (Array.isArray(grid) ? grid : []).flat().reduce(
        (total, tile) => total + (tile.ownerId === player.id ? tile.population || 0 : 0),
        0
      );
      return {
        player,
        index,
        silver,
        materials,
        influence,
        population,
        total: silver + materials + influence + population
      };
    }).sort((left, right) => right.total - left.total);

    listEl.innerHTML = scores.map((score, rank) => {
        const { player, silver, materials, influence, population, total } = score;
        const name = escapeHtml(player.name || `Nación ${score.index + 1}`);
        const color = /^#[0-9a-f]{6}$/i.test(player.color || '') ? player.color : '#2563eb';
        return `
          <tr style="--score-nation-color:${color}">
            <th scope="row"><span class="pax-score-rank">${rank + 1}</span>${name}</th>
            <td>${formatScore(silver)}</td>
            <td>${formatScore(materials)}</td>
            <td>${formatScore(influence)}</td>
            <td>${formatScore(population)}</td>
            <td class="pax-score-total">${formatScore(total)}</td>
          </tr>
        `;
      })
      .join('');
  }
}