/**
 * Pantalla principal de PAX: panel de nación, mapa e inspector territorial.
 */

import { Map } from '../components/Map.js';
import { Inspector } from '../components/Inspector.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { socket } from '../../network/SocketClient.js';
import {
  MAP_CONFIG,
  NATIONS,
  PROTOCOL
} from '../../../../shared/Constants.js';

const PHASE_LABELS = {
  1: 'Crecimiento y recaudación',
  2: 'Planificación de órdenes',
  3: 'Validación de acciones',
  4: 'Organización Internacional',
  5: 'Actualización del tablero'
};

const STYLES = `
  .pax-shell {
    --pax-bg: #050a19;
    --pax-panel: #0d1426;
    --pax-panel-raised: #121c31;
    --pax-border: #263249;
    --pax-muted: #8390a8;
    --pax-text: #e2e8f0;
    --pax-gold: #f5a900;
    height: 100dvh;
    width: 100%;
    display: grid;
    grid-template-rows: 58px minmax(0, 1fr);
    overflow: hidden;
    background: var(--pax-bg);
    color: var(--pax-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
  }
  .pax-start-menu {
    position: fixed;
    z-index: 10;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 7, 18, .88);
    backdrop-filter: blur(8px);
  }
  .pax-start-menu[hidden] { display: none; }
  .pax-start-card {
    width: min(440px, 100%);
    padding: 36px;
    border: 1px solid #34435d;
    border-radius: 16px;
    background: linear-gradient(145deg, #121d32, #080e1d);
    box-shadow: 0 24px 80px #0009;
    text-align: center;
  }
  .pax-start-brand { color: #f5a900; font-size: 42px; font-weight: 950; letter-spacing: .12em; }
  .pax-start-card h1 { margin: 10px 0; font-size: 23px; }
  .pax-start-card p { margin: 0; color: #9ba9bf; line-height: 1.6; }
  .pax-start-button {
    width: 100%;
    margin-top: 24px;
    padding: 13px 18px;
    border: 1px solid #eab23e;
    border-radius: 8px;
    color: #17120a;
    background: linear-gradient(180deg, #ffd66c, #efa91d);
    font: inherit;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
  }
  .pax-start-button:disabled { opacity: .5; cursor: wait; }
  .pax-start-status { min-height: 18px; margin-top: 12px !important; font-size: 11px; }
  .pax-shell *, .pax-shell *::before, .pax-shell *::after { box-sizing: border-box; }
  .pax-topbar {
    display: grid;
    grid-template-columns: 68px 74px minmax(186px, 240px) minmax(170px, 1fr) auto 112px;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    background: #080e1d;
    border-bottom: 1px solid var(--pax-border);
  }
  .pax-brand { color: var(--pax-gold); font-size: 18px; font-weight: 900; letter-spacing: .05em; white-space: nowrap; }
  .pax-version, .pax-round, .pax-phase, .pax-resources, .pax-gdi-button {
    min-height: 40px;
    display: flex;
    align-items: center;
    border: 1px solid var(--pax-border);
    border-radius: 7px;
    background: #10192b;
  }
  .pax-version { padding: 0 9px; color: #98a6bd; font-size: 11px; line-height: 1.2; }
  .pax-round { gap: 10px; padding: 0 10px; }
  .pax-round-icon { color: var(--pax-gold); font-size: 17px; }
  .pax-label { display: block; color: var(--pax-muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .pax-round-value { font-size: 13px; font-weight: 800; }
  .pax-timer { margin-left: auto; color: var(--pax-gold); font-size: 15px; font-weight: 900; font-variant-numeric: tabular-nums; }
  .pax-force-button, .pax-gdi-button, .pax-action-button, .pax-development button {
    border: 1px solid #39455d;
    border-radius: 6px;
    color: var(--pax-text);
    background: #1a263b;
    font: inherit;
  }
  .pax-force-button { margin-left: 8px; padding: 5px 8px; color: #f4bd4d; font-size: 10px; font-weight: 800; }
  .pax-phase { display: block; min-width: 0; padding: 6px 12px; }
  .pax-phase strong { display: block; overflow: hidden; margin-top: 2px; color: #dce4f2; font-size: 11px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .pax-resources { justify-content: center; gap: 0; padding: 0 4px; }
  .pax-resource { display: flex; align-items: center; gap: 5px; padding: 0 9px; color: #d8e1ef; font-weight: 800; white-space: nowrap; }
  .pax-resource + .pax-resource { border-left: 1px solid var(--pax-border); }
  .pax-resource-icon { color: var(--pax-gold); }
  .pax-resource:nth-child(2) .pax-resource-icon { color: #df8d31; }
  .pax-resource:nth-child(3) .pax-resource-icon { color: #a878e8; }
  .pax-resource:nth-child(4) .pax-resource-icon { color: #60a5fa; }
  .pax-resource-change { margin-left: -2px; color: #29ce9a; font-size: 10px; }
  .pax-gdi-button { justify-content: center; gap: 8px; cursor: pointer; font-size: 11px; font-weight: 800; }
  .pax-gdi-button span:first-child { color: #ffd24b; }
  .pax-main {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(250px, 22.5%) minmax(0, 1fr) minmax(260px, 23%);
  }
  .pax-sidebar, .pax-inspector {
    min-width: 0;
    min-height: 0;
    background: var(--pax-panel);
  }
  .pax-sidebar { overflow: auto; border-right: 1px solid var(--pax-border); }
  .pax-nation {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 74px;
    padding: 13px 15px;
    border-bottom: 1px solid var(--pax-border);
  }
  .pax-nation-dot { flex: 0 0 14px; width: 14px; height: 14px; border: 2px solid #50350a; border-radius: 50%; background: var(--nation-color); box-shadow: 0 0 10px color-mix(in srgb, var(--nation-color), transparent 55%); }
  .pax-nation-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 800; line-height: 1.35; }
  .pax-human-tag { padding: 4px 7px; border: 1px solid #674914; border-radius: 5px; color: #f5b72f; background: #251c12; font-size: 10px; font-weight: 800; }
  .pax-panel-section { padding: 14px 12px; border-bottom: 1px solid #1c273b; }
  .pax-panel-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; color: #9ba9bf; font-size: 11px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  .pax-panel-heading-icon { color: var(--pax-gold); font-size: 14px; }
  .pax-tax-card { margin-top: 10px; padding: 11px; border: 1px solid #202c41; border-radius: 8px; background: #070d1c; }
  .pax-shell .tax-slider-container { padding: 0; border: 0; border-radius: 0; color: var(--pax-text); background: transparent; font: inherit; }
  .pax-shell .tax-slider-container label { display: none; }
  .pax-shell .tax-slider-container input { width: 100%; height: 8px; accent-color: #f5a900; cursor: pointer; }
  .pax-shell .tax-slider-container p { display: none; }
  .pax-formula-line { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0; color: #9eabc0; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-formula-line strong { color: #32d5a3; white-space: nowrap; }
  .pax-tax-note { margin: 8px 0 0; color: #68758d; font-size: 10px; font-style: italic; line-height: 1.4; }
  .pax-action-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; text-align: left; }
  .pax-action-main { display: flex; align-items: center; gap: 8px; }
  .pax-action-icon { color: #f5b72f; font-size: 16px; }
  .pax-action-name { display: block; font-size: 11px; font-weight: 800; }
  .pax-action-caption { display: block; margin-top: 3px; color: var(--pax-muted); font-size: 10px; }
  .pax-action-cost { padding: 4px 5px; border-radius: 4px; color: #f4c253; background: #1a1b27; font-size: 9px; font-weight: 800; white-space: nowrap; }
  .pax-action-button:disabled, .pax-force-button:disabled { opacity: .38; cursor: not-allowed; }
  .pax-oi-tag { margin-left: auto; padding: 5px 7px; border: 1px solid #493361; border-radius: 5px; color: #c8a6ed; background: #1b1528; font-size: 9px; letter-spacing: 0; text-transform: none; }
  .pax-oi-card { padding: 10px; border: 1px solid #202c41; border-radius: 8px; background: #070d1c; }
  .pax-oi-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; color: var(--pax-muted); font-size: 10px; }
  .pax-oi-row strong { color: #d1b0ef; }
  .pax-oi-proposal { color: #bac5d6; font-size: 10px; line-height: 1.45; }
  .pax-oi-proposal strong { display: block; margin-top: 4px; color: #e4eaf3; }
  .pax-event-log { max-height: 120px; overflow: auto; padding: 8px 9px; border: 1px solid #202c41; border-radius: 6px; background: #070d1c; color: #a9b5c8; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-event-entry + .pax-event-entry { margin-top: 6px; }
  .pax-center { min-width: 0; min-height: 0; display: grid; grid-template-rows: 46px minmax(0, 1fr) 37px; padding: 0 14px; background: #050a19; }
  .pax-map-legend { display: flex; align-items: end; justify-content: space-between; gap: 14px; padding: 0 5px 8px; color: #8c99af; font-size: 10px; }
  .pax-legend-types, .pax-legend-status { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .pax-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .pax-legend-swatch { width: 9px; height: 9px; border-radius: 2px; }
  .pax-legend-status .pax-legend-item { gap: 5px; }
  .pax-status-mini { width: 8px; height: 8px; border-radius: 50%; background: var(--status-color); }
  .pax-map-viewport { position: relative; min-width: 0; min-height: 0; overflow: auto; display: flex; align-items: center; justify-content: center; border: 1px solid #26334a; border-radius: 12px; background: #0d1527; box-shadow: 0 8px 24px #0005; }
  .pax-map-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #8491a7; font-size: 10px; }
  .pax-map-hint { color: #f2b938; }
  .pax-map-size { color: #68758d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .pax-inspector { overflow: auto; border-left: 1px solid var(--pax-border); }
  .pax-section-heading { min-height: 53px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid var(--pax-border); font-size: 13px; font-weight: 900; }
  .pax-heading-icon { color: #f2b938; font-size: 16px; }
  .pax-coordinates { margin-left: auto; padding: 4px 6px; border-radius: 4px; color: #9aa7bb; background: #1a2437; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .pax-inspector-content { padding: 16px; }
  .pax-inspector-empty { margin: 16px; padding: 24px 18px; border: 1px dashed #35415a; border-radius: 9px; color: var(--pax-muted); font-size: 12px; line-height: 1.5; text-align: center; }
  .pax-tile-card { max-width: 225px; min-height: 205px; margin: 0 auto; padding: 13px; border: 2px solid var(--nation-color); border-radius: 11px; background: #080e1d; box-shadow: inset 0 0 0 1px #ffffff08, 0 8px 25px #0004; }
  .pax-tile-card-top, .pax-tile-card-bottom { display: flex; justify-content: space-between; align-items: center; color: #dce5f4; }
  .pax-tile-defense, .pax-tile-type { padding: 4px 6px; border: 1px solid #26334a; border-radius: 4px; background: #111a2b; font-size: 10px; font-weight: 800; }
  .pax-tile-art { height: 90px; display: flex; align-items: center; justify-content: center; color: var(--tile-accent); font-size: 58px; line-height: 1; text-shadow: 0 4px 20px #0008; }
  .pax-tile-owner { width: fit-content; max-width: 100%; margin: 0 auto 8px; overflow: hidden; padding: 4px 9px; border-radius: 4px; color: #aebbd0; background: #202b3e; font-size: 9px; font-weight: 900; letter-spacing: .04em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .pax-tile-details { display: flex; justify-content: space-between; padding: 0 3px 8px; color: #b4c0d2; font-size: 10px; }
  .pax-tile-details span { display: flex; align-items: center; gap: 4px; }
  .pax-tile-details i { color: #6bb4f1; font-style: normal; }
  .pax-tile-card-bottom { min-height: 22px; color: #99a6ba; font-size: 9px; }
  .pax-status-dot { width: 13px; height: 13px; border: 2px solid #1b2938; border-radius: 50%; background: var(--status-color); box-shadow: 0 0 8px color-mix(in srgb, var(--status-color), transparent 45%); }
  .pax-development { margin-top: 30px; }
  .pax-development h3 { margin: 0 0 12px; color: #8b98ad; font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .pax-development p { color: #77849a; font-size: 11px; font-style: italic; line-height: 1.5; }
  .pax-feature-tag { width: fit-content; padding: 4px 7px; border-radius: 4px; color: #a9d9f7; background: #132638; font-size: 10px; }
  .pax-development button { width: 100%; padding: 8px; font-size: 11px; }
  .pax-tile-actions { display: grid; gap: 7px; margin-top: 10px; }
  .pax-tile-action { width: 100%; min-height: 47px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px; border: 1px solid #35445e; border-radius: 7px; color: #e2e8f0; background: #17243a; text-align: left; cursor: pointer; transition: opacity .15s, border-color .15s, background .15s; }
  .pax-tile-action:not(:disabled):hover { border-color: #d99d2c; background: #202b3c; }
  .pax-tile-action.is-unavailable { opacity: .38; filter: saturate(.55); cursor: not-allowed; }
  .pax-tile-action-copy { min-width: 0; display: grid; gap: 3px; }
  .pax-tile-action-copy strong { font-size: 10px; }
  .pax-tile-action-copy small { color: #97a5ba; font-size: 9px; }
  .pax-tile-action-cost { flex: 0 0 auto; padding: 4px 5px; border-radius: 4px; color: #e9bd58; background: #101a2c; font-size: 8px; font-weight: 800; }
  .pax-dialog { width: min(440px, calc(100vw - 32px)); max-height: min(80vh, 650px); overflow: auto; margin: auto; padding: 0; border: 1px solid #334155; border-radius: 12px; background: #0d1426; color: var(--pax-text); }
  .pax-dialog::backdrop { background: #020617c9; backdrop-filter: blur(3px); }
  .pax-dialog-heading { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--pax-border); font-weight: 900; }
  .pax-dialog-close { padding: 5px 9px; border: 1px solid #334155; border-radius: 5px; color: var(--pax-text); background: #172238; cursor: pointer; }
  .pax-scoreboard-wrap { padding: 12px; }
  .pax-scoreboard-wrap > div { box-shadow: none !important; }
  @media (max-width: 1100px) {
    .pax-main { grid-template-columns: 240px minmax(0, 1fr) 260px; }
    .pax-topbar { grid-template-columns: 62px 58px minmax(150px, 190px) minmax(140px, 1fr) auto 98px; gap: 6px; padding-inline: 7px; }
    .pax-resource { gap: 4px; padding-inline: 6px; }
    .pax-center { padding-inline: 9px; }
  }
  @media (max-width: 820px) {
    .pax-shell { height: auto; min-height: 100dvh; grid-template-rows: auto minmax(70vh, 1fr); overflow: auto; }
    .pax-topbar { grid-template-columns: 62px 58px minmax(0, 1fr) 92px; }
    .pax-phase { display: none; }
    .pax-resources { grid-column: 1 / 4; grid-row: 2; justify-content: flex-start; min-height: 34px; }
    .pax-topbar { grid-template-rows: 40px 34px; }
    .pax-main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(55vh, 1fr) auto auto; }
    .pax-center { grid-row: 1; min-height: 55vh; }
    .pax-sidebar { grid-row: 2; border-top: 1px solid var(--pax-border); border-right: 0; }
    .pax-inspector { grid-row: 3; border-top: 1px solid var(--pax-border); border-left: 0; }
    .pax-inspector-content { display: grid; grid-template-columns: minmax(190px, 240px) minmax(0, 1fr); gap: 20px; align-items: center; }
    .pax-development { margin-top: 0; }
  }
  @media (max-width: 520px) {
    .pax-topbar { grid-template-columns: 58px minmax(0, 1fr) 90px; }
    .pax-brand { font-size: 13px; letter-spacing: 0; }
    .pax-version { display: none; }
    .pax-round { grid-column: 2; }
    .pax-resources { grid-column: 1 / 4; overflow-x: auto; }
    .pax-gdi-button { font-size: 10px; }
    .pax-map-legend { align-items: start; flex-direction: column; justify-content: center; gap: 5px; padding-top: 6px; font-size: 9px; }
    .pax-center { grid-template-rows: 58px minmax(0, 1fr) 37px; padding-inline: 5px; }
    .pax-inspector-content { grid-template-columns: minmax(0, 1fr); }
    .pax-development { margin-top: 8px; }
    .pax-map-size { font-size: 9px; }
  }
`;

function formatValue(value) {
  return Number.isFinite(value) ? Math.floor(value).toLocaleString('es-ES') : '—';
}

export class GameScreen {
  constructor(container) {
    this.container = container;
    this.map = null;
    this.inspector = null;
    this.scoreboard = null;
    this.taxSlider = null;
    this.gameState = null;
    this.playerId = null;
    this.player = null;
    this.events = [];
    this.lastEventState = null;
    this.pendingMoveSource = null;
    this.startPending = false;
    this.startError = '';

    this.init();
  }

  init() {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = STYLES;
    document.head.appendChild(this.styleElement);

    this.container.innerHTML = `
      <div class="pax-shell">
        <section class="pax-start-menu" id="start-menu" aria-label="Menú inicial">
          <div class="pax-start-card">
            <div class="pax-start-brand">PAX</div>
            <h1>El mundo espera tus órdenes</h1>
            <p>Juega contra los demás países. Los países sin jugador serán controlados por bots. Cada nación comienza con 100 de plata.</p>
            <button class="pax-start-button" id="play-button" type="button" disabled>Jugar</button>
            <p class="pax-start-status" id="start-status" role="status">Conectando con la partida…</p>
          </div>
        </section>
        <header class="pax-topbar">
          <div class="pax-brand">◉ PAX</div>
          <div class="pax-version">GDD<br>v3.0</div>
          <div class="pax-round">
            <span class="pax-round-icon">⌛</span>
            <div><span class="pax-label">Ronda</span><span class="pax-round-value" id="round-value">1/30</span></div>
            <span class="pax-timer" id="timer-value">60s</span>
            <button class="pax-force-button" type="button" disabled title="El avance manual aún no está disponible">⏩ Forzar</button>
          </div>
          <div class="pax-phase"><span class="pax-label">Fase actual:</span><strong id="phase-value">Fase 1: Crecimiento y recaudación</strong></div>
          <div class="pax-resources" aria-label="Recursos nacionales">
            <span class="pax-resource" title="Plata"><i class="pax-resource-icon">◉</i><span id="silver-value">—</span></span>
            <span class="pax-resource" title="Materiales"><i class="pax-resource-icon">▣</i><span id="materials-value">—</span></span>
            <span class="pax-resource" title="Influencia"><i class="pax-resource-icon">♧</i><span id="influence-value">—</span></span>
            <span class="pax-resource" title="Población"><i class="pax-resource-icon">♟</i><span id="population-value">0</span></span>
          </div>
          <button class="pax-gdi-button" id="gdi-open" type="button"><span>🏆</span><span>Marcador<br>GDI</span></button>
        </header>
        <main class="pax-main">
          <aside class="pax-sidebar">
            <section class="pax-nation">
              <span class="pax-nation-dot" id="nation-dot"></span>
              <strong class="pax-nation-name" id="nation-name">Nación Amarilla</strong>
              <span class="pax-human-tag" id="player-kind">Humano</span>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading"><span class="pax-panel-heading-icon">％</span>Tasa impositiva (τ)<strong id="tax-value" style="margin-left:auto;color:#f2bb3b">20%</strong></div>
              <div id="tax-container"></div>
              <div class="pax-tax-card">
                <div class="pax-formula-line"><span>Fórmula crecimiento:</span><strong>G = 1 / (100 × τ)</strong></div>
                <div class="pax-formula-line"><span>Tasa crecimiento (G):</span><strong id="growth-value">+5.00%</strong></div>
                <div class="pax-formula-line"><span>Recaudación por hab.:</span><strong id="revenue-value">0.20¤</strong></div>
                <p class="pax-tax-note">A menor impuesto, mayor crecimiento demográfico. A mayor impuesto, más recaudación inmediata.</p>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading"><span class="pax-panel-heading-icon" style="color:#b684e8">♙</span>Organización Int. (OI)<span class="pax-oi-tag">Sesión cada 5 rondas</span></div>
              <div class="pax-oi-card">
                <div class="pax-oi-row"><span>Próxima votación:</span><strong id="next-vote">Ronda 5</strong></div>
                <div class="pax-oi-proposal">Resolución propuesta:<strong>Límites Ambientales de Industria (Max. 4 FT/FA)</strong></div>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading"><span style="color:#8996aa">≡</span>Registro de eventos</div>
              <div class="pax-event-log" id="event-log" aria-live="polite"></div>
            </section>
          </aside>
          <section class="pax-center">
            <div class="pax-map-legend">
              <div class="pax-legend-types">
                <span class="pax-legend-item"><i class="pax-legend-swatch" style="background:#718096"></i>Urbano (CAP/CIU)</span>
                <span class="pax-legend-item"><i class="pax-legend-swatch" style="background:#8D5B4C"></i>Tierra (TR/MPT/FT)</span>
                <span class="pax-legend-item"><i class="pax-legend-swatch" style="background:#3182CE"></i>Agua (AG/MPA/FA)</span>
                <span class="pax-legend-item"><i class="pax-legend-swatch" style="background:#38BDF8"></i>Río</span>
              </div>
              <div class="pax-legend-status">
                <span class="pax-legend-item"><i class="pax-status-mini" style="--status-color:#22C55E"></i>Normal</span>
                <span class="pax-legend-item"><i class="pax-status-mini" style="--status-color:#EAB308"></i>Conflicto</span>
                <span class="pax-legend-item"><i class="pax-status-mini" style="--status-color:#EF4444"></i>Bloqueada</span>
              </div>
            </div>
            <div class="pax-map-viewport" id="map-container"></div>
            <footer class="pax-map-footer">
              <span class="pax-map-hint">ⓘ Haz clic en una casilla para inspeccionarla; arrastra para desplazarte.</span>
              <span class="pax-map-size">Matriz ${MAP_CONFIG.GRID_WIDTH}×${MAP_CONFIG.GRID_HEIGHT} (${MAP_CONFIG.TOTAL_TILES} casillas)</span>
            </footer>
          </section>
          <aside class="pax-inspector" id="inspector-container"></aside>
        </main>
        <dialog class="pax-dialog" id="gdi-dialog">
          <header class="pax-dialog-heading"><span>🏆 Marcador GDI</span><button class="pax-dialog-close" type="button" id="gdi-close">Cerrar</button></header>
          <div class="pax-scoreboard-wrap" id="scoreboard-container"></div>
        </dialog>
      </div>
    `;

    const taxEl = this.container.querySelector('#tax-container');
    this.inspector = new Inspector(this.container.querySelector('#inspector-container'));
    this.map = new Map(this.container.querySelector('#map-container'), (tile) => this.handleTileSelection(tile));
    this.scoreboard = new Scoreboard(this.container.querySelector('#scoreboard-container'));
    this.taxSlider = new TaxSlider(taxEl, (newTaxRate) => {
      this.updateTaxMetrics(newTaxRate);
      socket.emit(PROTOCOL.SET_TAX_RATE, { roomId: 'room-1', taxRate: newTaxRate });
    });
    this.updateTaxMetrics(this.taxSlider.currentValue);
    this.bindEvents();
    this.addEvent('Esperando actividad de la partida.');
    this.joinGame();
  }

  bindEvents() {
    this.onConnect = () => {
      this.startPending = false;
      this.startError = '';
      this.joinGame();
      this.updateStartMenu();
    };
    this.onDisconnect = () => {
      this.startPending = false;
      this.startError = 'Se perdió la conexión con el servidor. Reconectando…';
      this.updateStartMenu();
    };
    this.onGameState = (gameState) => this.updateGameState(gameState);
    socket.on('connect', this.onConnect);
    socket.on('disconnect', this.onDisconnect);
    socket.on(PROTOCOL.GAME_STATE_UPDATE, this.onGameState);
    this.onActionResult = (message) => this.addEvent(message);
    socket.on(PROTOCOL.ACTION_RESULT, this.onActionResult);
    this.onActionError = (message) => {
      this.startPending = false;
      this.startError = message;
      this.addEvent(`Acción no realizada: ${message}`);
      this.updateStartMenu();
    };
    socket.on(PROTOCOL.ACTION_ERROR, this.onActionError);

    this.container.querySelector('#play-button').addEventListener('click', () => {
      if (!socket.connected || !this.player || this.startPending) return;
      this.startPending = true;
      this.startError = '';
      this.updateStartMenu();
      socket.timeout(5000).emit(
        PROTOCOL.START_GAME,
        { roomId: 'room-1' },
        (error, result) => {
          this.startPending = false;
          if (error) {
            this.startError = 'El servidor no respondió. Comprueba la conexión e inténtalo otra vez.';
          } else if (!result?.ok) {
            this.startError = result?.message || 'No se pudo iniciar la partida.';
          } else {
            this.startError = '';
          }
          this.updateStartMenu(result?.gameStarted);
        }
      );
    });

    this.container.querySelector('#gdi-open').addEventListener('click', () => {
      this.container.querySelector('#gdi-dialog').showModal();
    });
    this.container.querySelector('#gdi-close').addEventListener('click', () => {
      this.container.querySelector('#gdi-dialog').close();
    });
    this.container.querySelector('#taxInput').addEventListener('input', (event) => {
      this.container.querySelector('#tax-value').textContent = `${Math.round(Number(event.target.value) * 100)}%`;
    });
  }

  updateTaxMetrics(taxRate) {
    const growth = taxRate > 0 ? 1 / (100 * taxRate) : 0;
    this.container.querySelector('#tax-value').textContent = `${Math.round(taxRate * 100)}%`;
    this.container.querySelector('#growth-value').textContent = `+${(growth * 100).toFixed(2)}%`;
    this.container.querySelector('#revenue-value').textContent = `${taxRate.toFixed(2)}¤`;
  }

  updateGameState(gameState) {
    if (!gameState) return;
    this.gameState = gameState;
    this.map.render(gameState.grid);

    const players = Array.isArray(gameState.players) ? gameState.players : [];
    this.player = players.find((player) => (
      player.boundPlayerId === this.playerId || player.socketId === socket.id
    )) || null;
    if (gameState.gameStarted) this.startPending = false;
    this.updateStartMenu(gameState.gameStarted);
    const phase = gameState.currentPhase || 1;
    this.inspector.setContext(this.player, phase, (action) => this.handleInspectorAction(action));
    this.scoreboard.update(players, gameState.currentPhase, gameState.timeRemaining);

    const round = gameState.currentRound || 1;
    const roundEl = this.container.querySelector('#round-value');
    roundEl.textContent = `${round}/30`;
    this.container.querySelector('#timer-value').textContent = `${gameState.timeRemaining ?? 60}s`;
    this.container.querySelector('#phase-value').textContent = `Fase ${phase}: ${PHASE_LABELS[phase] || 'En curso'}`;
    this.container.querySelector('#next-vote').textContent = `Ronda ${Math.ceil((round + 1) / 5) * 5}`;
    this.updateNationPanel();
    this.updateResources();
    this.taxSlider.setEnabled(Boolean(this.player && phase === 2));
    this.recordPhaseEvent(round, phase);

    if (this.player && Number.isFinite(this.player.taxRate)) {
      this.taxSlider.setValue(this.player.taxRate);
      this.updateTaxMetrics(this.player.taxRate);
    }
  }

  updateStartMenu(gameStarted = this.gameState?.gameStarted) {
    const menu = this.container.querySelector('#start-menu');
    if (!menu) return;
    menu.hidden = Boolean(gameStarted && socket.connected);
    const button = this.container.querySelector('#play-button');
    const status = this.container.querySelector('#start-status');
    if (!button || !status) return;
    if (gameStarted) {
      this.startPending = false;
      button.disabled = true;
      status.textContent = 'Partida iniciada.';
      return;
    }

    button.disabled = !socket.connected || !this.player || this.startPending;
    status.textContent = !socket.connected
      ? 'No hay conexión con el servidor. Reconectando…'
      : this.startError
        ? this.startError
      : this.startPending
        ? 'Iniciando la partida…'
          : !this.player
            ? 'Asignando tu país…'
            : `Listo: ${this.player.name}. Los otros países serán bots.`;
  }

  updateNationPanel() {
    const nation = this.player
      ? NATIONS[this.player.nationId]
      : null;
    const displayName = this.player?.name || nation?.name || 'Esperando nación';
    const color = this.player?.color || nation?.color || '#64748b';
    this.container.querySelector('#nation-name').textContent = displayName;
    this.container.querySelector('#nation-dot').style.setProperty('--nation-color', color);
    this.container.querySelector('#player-kind').textContent = this.player?.boundPlayerId ? 'Humano' : 'IA';
  }

  handleInspectorAction(action) {
    if (action.type === 'MOVE_TROOPS') {
      this.pendingMoveSource = action;
      this.addEvent('Selecciona una casilla terrestre neutral o propia adyacente como destino.');
      return;
    }
    socket.emit(PROTOCOL.PLAYER_ACTION, { roomId: 'room-1', action });
  }

  handleTileSelection(tile) {
    this.inspector.render(tile);
    if (!this.pendingMoveSource || !tile) return;

    const source = this.pendingMoveSource;
    if (tile.x === source.x && tile.y === source.y) return;
    const sourceTile = this.gameState?.grid?.[source.y]?.[source.x];
    this.pendingMoveSource = null;
    socket.emit(PROTOCOL.PLAYER_ACTION, {
      roomId: 'room-1',
      action: {
        type: 'MOVE_TROOPS',
        x: source.x,
        y: source.y,
        targetX: tile.x,
        targetY: tile.y,
        troops: sourceTile?.troops
      }
    });
  }

  updateResources() {
    const resources = this.player?.resources;
    const silver = typeof resources === 'number'
      ? resources
      : resources?.SILVER ?? resources?.BASIC;
    const materials = this.player?.materials ?? resources?.MATERIALS;
    const influence = this.player?.influence ?? resources?.INFLUENCE;
    const ownedTiles = (this.gameState?.grid || []).flat().filter((tile) => tile.ownerId === this.player?.id);
    const population = ownedTiles.reduce((sum, tile) => sum + (tile.population || 0), 0);
    this.container.querySelector('#silver-value').textContent = formatValue(silver);
    this.container.querySelector('#materials-value').textContent = formatValue(materials);
    this.container.querySelector('#influence-value').textContent = formatValue(influence);
    this.container.querySelector('#population-value').textContent = formatValue(population);
  }

  recordPhaseEvent(round, phase) {
    const current = `${round}:${phase}`;
    if (this.lastEventState === current) return;
    this.lastEventState = current;
    this.addEvent(`Ronda ${round} · Fase ${phase}: ${PHASE_LABELS[phase] || 'En curso'}.`);
  }

  addEvent(message) {
    this.events.unshift(message);
    this.events = this.events.slice(0, 8);
    const log = this.container.querySelector('#event-log');
    if (log) {
      log.innerHTML = this.events.map((entry) => `<div class="pax-event-entry">› ${entry}</div>`).join('');
    }
  }

  joinGame() {
    if (!socket.connected) return;
    this.playerId = localStorage.getItem('pax_player_id');
    if (!this.playerId) {
      this.playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('pax_player_id', this.playerId);
    }
    socket.emit(PROTOCOL.JOIN_GAME, {
      playerId: this.playerId,
      playerName: 'Nación Alpha',
      roomId: 'room-1'
    });
  }

  destroy() {
    socket.off(PROTOCOL.GAME_STATE_UPDATE, this.onGameState);
    socket.off('connect', this.onConnect);
    socket.off('disconnect', this.onDisconnect);
    socket.off(PROTOCOL.ACTION_RESULT, this.onActionResult);
    socket.off(PROTOCOL.ACTION_ERROR, this.onActionError);
    this.styleElement.remove();
    this.container.innerHTML = '';
  }
}
