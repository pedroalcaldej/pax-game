import { MAX_ROUNDS, MAP_CONFIG } from '../../../../shared/Constants.js';

export function renderGameScreen(container) {
  container.innerHTML = `
      <div class="pax-shell">
        <div id="lobby-screen-mount"></div>
        <section class="pax-menu-overlay" id="game-menu" aria-label="Menú de partida" hidden>
          <div class="pax-menu-card">
            <h2>Menú de partida</h2>
            <div class="pax-menu-actions">
              <button type="button" id="menu-resume">Reanudar</button>
              <button type="button" class="pax-menu-end" id="menu-end-game">Salir de la partida y volver al menú</button>
            </div>
          </div>
        </section>
        <div class="pax-stage-overlay" id="stage-overlay" hidden aria-live="polite">
          <div class="pax-stage-overlay-card" id="stage-overlay-message"></div>
        </div>
        <header class="pax-topbar">
          <button class="pax-menu-button" id="menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="game-menu" title="Menú">☰</button>
          <div class="pax-brand">PAX</div>
          <div class="pax-round">
            <span class="pax-round-icon" aria-hidden="true">◷</span>
            <div><span class="pax-label">Ronda</span><span class="pax-round-value" id="round-value">1/${MAX_ROUNDS}</span></div>
            <span class="pax-timer" id="timer-value">60s</span>
            <button class="pax-ready-button" id="phase-ready-button" type="button" disabled title="Pulsa para marcarte listo; puedes pulsar de nuevo para retirar tu confirmación">Listo (0/0)</button>
          </div>
          <div class="pax-phase"><span class="pax-label">Estado:</span><strong id="phase-value">Inicio de ronda</strong></div>
          <div class="pax-resources" aria-label="Recursos nacionales">
            <span class="pax-resource" title="Plata"><i class="pax-resource-icon" data-tooltip="Plata" tabindex="0" aria-label="Plata">◉</i><span id="silver-value">—</span></span>
            <span class="pax-resource" title="Materiales"><i class="pax-resource-icon" data-tooltip="Materiales" tabindex="0" aria-label="Materiales">▣</i><span id="materials-value">—</span></span>
            <span class="pax-resource" title="Influencia"><i class="pax-resource-icon" data-tooltip="Influencia" tabindex="0" aria-label="Influencia">♧</i><span id="influence-value">—</span></span>
            <span class="pax-resource" title="Población"><i class="pax-resource-icon" data-tooltip="Población" tabindex="0" aria-label="Población">♟</i><span id="population-value">0</span></span>
          </div>
          <button class="pax-global-panel-button" id="global-panel-open" type="button" title="Ver información de todos los países y tratados"><span aria-hidden="true">◎</span><span>Panel<br>Global</span></button>
        </header>
        <main class="pax-main">
          <aside class="pax-sidebar">
            <section class="pax-nation">
              <span class="pax-nation-dot" id="nation-dot"></span>
              <strong class="pax-nation-name" id="nation-name">alpha</strong>
              <span class="pax-human-tag" id="player-kind">Humano</span>
            </section>
            <nav class="pax-tabs" role="tablist" aria-label="Panel de nación">
              <button class="pax-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="economy-tab" data-panel-tab="economy"><span aria-hidden="true">▥</span> Economía</button>
              <button class="pax-tab" type="button" role="tab" aria-selected="false" aria-controls="finance-tab" data-panel-tab="finance"><span aria-hidden="true">▤</span> Banca &amp; Diplomacia</button>
              <button class="pax-tab" type="button" role="tab" aria-selected="false" aria-controls="log-tab" data-panel-tab="log"><span aria-hidden="true">≡</span> Log</button>
            </nav>
            <div class="pax-tab-panel" id="economy-tab" role="tabpanel">
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">％</span>Tasa impositiva (τ)<strong id="tax-value" style="margin-left:auto;color:#f2bb3b">20%</strong><span class="pax-section-help" data-tooltip="La tasa impositiva cambia el crecimiento demográfico y la recaudación." aria-label="Ayuda sobre la tasa impositiva" tabindex="0">?</span></div>
              <div id="tax-container"></div>
              <div class="pax-tax-card">
                <div class="pax-formula-line"><span>Crecimiento</span><strong id="growth-value">+5.00%</strong></div>
                <div class="pax-formula-line"><span>Recaudación esperada</span><strong id="forecast-revenue"><span class="pax-resource-icon" aria-hidden="true">◉</span><span id="forecast-revenue-value">—</span></strong></div>
                <p class="pax-tax-note">A menor impuesto, mayor crecimiento demográfico. A mayor impuesto, más recaudación inmediata.</p>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">¤</span>Mercado Global<span class="pax-section-help" data-tooltip="Compra o vende materiales al precio fijo del mercado neutral." aria-label="Ayuda sobre el Mercado Global" tabindex="0">?</span></div>
              <div id="finance-panel"></div>
            </section>
            </div>
            <div class="pax-tab-panel" id="finance-tab" role="tabpanel" hidden>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">¤</span>Banco Mundial<span class="pax-section-help" data-tooltip="Administra bonos, deuda pendiente, pagos y el fondo común del Banco Mundial." aria-label="Ayuda sobre el Banco Mundial" tabindex="0">?</span></div>
              <div id="finance-debt-panel"></div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon" style="color:#b684e8">♙</span>Organización Internacional (OI)<span class="pax-section-help" data-tooltip="La OI abre sesiones periódicas para proponer y votar resoluciones." aria-label="Ayuda sobre la Organización Internacional" tabindex="0">?</span><span class="pax-oi-tag" id="oi-session-badge">Próxima sesión: Ronda 5</span></div>
              <div class="pax-oi-card">
                <div class="pax-oi-row"><span>Próxima reunión:</span><strong id="next-vote">Después de ronda 5</strong></div>
                <div class="pax-oi-note" id="oi-status"></div>
                <div id="oi-content"></div>
              </div>
            </section>
            </div>
            <div class="pax-tab-panel log-tab-panel" id="log-tab" role="tabpanel" hidden>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span style="color:#8996aa">≡</span>Log<span class="pax-section-help" data-tooltip="Consulta eventos, advertencias y respuestas del sistema." aria-label="Ayuda sobre el Log" tabindex="0">?</span></div>
              <div class="pax-event-log" id="event-log" aria-live="polite"></div>
            </section>
            </div>
          </aside>
          <section class="pax-center">
            <div class="pax-map-viewport" id="map-container"><div class="pax-toasts" id="toast-container" aria-live="polite" aria-atomic="true"></div></div>
            <section class="pax-action-slots" id="action-slots" aria-label="Acciones de este turno"></section>
            <footer class="pax-map-footer">
              <span class="pax-map-hint">ⓘ Haz clic en una casilla para inspeccionarla; arrastra para desplazarte.</span>
              <span class="pax-map-size">Matriz ${MAP_CONFIG.GRID_WIDTH}×${MAP_CONFIG.GRID_HEIGHT} (${MAP_CONFIG.TOTAL_TILES} casillas)</span>
            </footer>
            <div id="chat-container"></div>
          </section>
          <aside class="pax-inspector" id="inspector-container"></aside>
        </main>
        <dialog class="pax-dialog" id="global-panel-dialog">
          <header class="pax-dialog-heading"><span>◎ Panel Global</span><button class="pax-dialog-close" type="button" id="global-panel-close">Cerrar</button></header>
          <div class="pax-scoreboard-wrap" id="global-panel-container"></div>
        </dialog>
        <dialog class="pax-dialog pax-end-dialog" id="game-summary-dialog" aria-labelledby="game-summary-title">
          <header class="pax-dialog-heading"><span>Resumen de la partida</span></header>
          <div class="pax-end-result" id="game-summary-content"></div>
          <div class="pax-scoreboard-wrap">
            <div class="pax-global-table-scroll">
              <table class="pax-global-table">
                <thead>
                  <tr>
                    <th>País</th><th>Control</th><th>Territorio</th><th>Población</th>
                    <th>Tropas</th><th>Ciudades</th><th>Fábricas</th><th>Impuesto</th>
                    <th>Plata</th><th>Materiales</th><th>Influencia</th><th>GDI</th>
                  </tr>
                </thead>
                <tbody id="game-summary-rankings"></tbody>
              </table>
            </div>
            <p class="pax-scoreboard-note">GDI: Plata + Materiales + Influencia + Población.</p>
          </div>
          <div class="pax-end-actions">
            <button id="game-summary-replay" type="button">🔄 Jugar de nuevo</button>
            <button id="game-summary-menu" type="button">🏠 Menú principal</button>
          </div>
        </dialog>
      </div>
  `;
}
