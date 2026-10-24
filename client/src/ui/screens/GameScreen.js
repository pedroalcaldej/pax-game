/**
 * Pantalla principal de PAX: panel de nación, mapa e inspector territorial.
 */

import { Map } from '../components/Map.js';
import { Inspector } from '../components/Inspector.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { socket } from '../../network/SocketClient.js';
import {
  ACTION_SLOT_COUNT,
  MAP_CONFIG,
  NATIONS,
  OI_RESOLUTIONS,
  PROTOCOL
} from '../../../../shared/Constants.js';

const PHASE_LABELS = {
  1: 'Crecimiento y recaudación',
  2: 'Planificación de órdenes',
  3: 'Validación de acciones',
  4: 'Cierre de acciones',
  5: 'Actualización del tablero',
  6: 'Reunión extraordinaria de la OI'
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
  .pax-start-button:disabled { opacity: .5; cursor: not-allowed; }
  .pax-start-status { min-height: 18px; margin-top: 12px !important; font-size: 11px; }
  .pax-shell *, .pax-shell *::before, .pax-shell *::after { box-sizing: border-box; }
  .pax-topbar {
    display: grid;
    grid-template-columns: 38px 68px minmax(186px, 240px) minmax(170px, 1fr) auto 112px;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    background: #080e1d;
    border-bottom: 1px solid var(--pax-border);
  }
  .pax-brand { color: var(--pax-gold); font-size: 18px; font-weight: 900; letter-spacing: .05em; white-space: nowrap; }
  .pax-round, .pax-phase, .pax-resources, .pax-gdi-button {
    min-height: 40px;
    display: flex;
    align-items: center;
    border: 1px solid var(--pax-border);
    border-radius: 7px;
    background: #10192b;
  }
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
  .pax-menu-button { width: 34px; height: 34px; border: 1px solid #39455d; border-radius: 6px; color: #e2e8f0; background: #10192b; font-size: 18px; cursor: pointer; }
  .pax-menu-overlay { position: fixed; z-index: 12; inset: 0; display: grid; place-items: center; padding: 20px; background: #030712cc; backdrop-filter: blur(6px); }
  .pax-menu-overlay[hidden] { display: none; }
  .pax-menu-card { width: min(360px, 100%); padding: 24px; border: 1px solid #34435d; border-radius: 12px; background: linear-gradient(145deg, #121d32, #080e1d); box-shadow: 0 24px 80px #0009; }
  .pax-menu-card h2 { margin: 0 0 18px; font-size: 18px; }
  .pax-menu-actions { display: grid; gap: 10px; }
  .pax-menu-actions button { min-height: 42px; padding: 9px 12px; border: 1px solid #39455d; border-radius: 6px; color: var(--pax-text); background: #1a263b; font: inherit; font-weight: 700; cursor: pointer; }
  .pax-menu-actions .pax-menu-end { border-color: #713a43; color: #fecaca; background: #351a22; }
  .pax-phase { display: block; min-width: 0; padding: 6px 12px; }
  .pax-phase strong { display: block; overflow: hidden; margin-top: 2px; color: #dce4f2; font-size: 11px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .pax-resources { justify-content: center; gap: 0; padding: 0 4px; }
  .pax-resource { display: flex; align-items: center; gap: 5px; padding: 0 9px; color: #d8e1ef; font-weight: 800; white-space: nowrap; }
  .pax-resource + .pax-resource { border-left: 1px solid var(--pax-border); }
  .pax-resource-icon { color: var(--pax-gold); }
  .pax-resource-icon[data-tooltip] { position: relative; font-style: normal; }
  .pax-resource-icon[data-tooltip]::after {
    position: absolute;
    z-index: 20;
    left: 50%;
    bottom: calc(100% + 9px);
    width: max-content;
    max-width: 180px;
    padding: 6px 8px;
    border: 1px solid #40506a;
    border-radius: 5px;
    color: #e8edf5;
    background: #111b2d;
    box-shadow: 0 5px 16px #0008;
    content: attr(data-tooltip);
    font: inherit;
    font-size: 11px;
    line-height: 1.3;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 3px);
    transition: opacity .12s, transform .12s;
    visibility: hidden;
  }
  .pax-resource-icon[data-tooltip]:hover::after,
  .pax-resource-icon[data-tooltip]:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
    visibility: visible;
  }
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
  .pax-formula-line.is-forecast { padding-top: 5px; border-top: 1px solid #202c41; font-family: inherit; }
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
  .pax-oi-controls { display: grid; gap: 8px; margin-top: 9px; }
  .pax-oi-controls label { display: grid; gap: 4px; color: #aab6c9; font-size: 10px; }
  .pax-oi-controls select, .pax-oi-controls input { width: 100%; min-height: 30px; padding: 5px 7px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-oi-controls button { min-height: 31px; padding: 6px 8px; border: 1px solid #5b4770; border-radius: 5px; color: #ead9fa; background: #21172e; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-oi-controls button:disabled { opacity: .45; cursor: not-allowed; }
  .pax-oi-vote { padding: 8px 0; border-top: 1px solid #202c41; }
  .pax-oi-vote > strong { display: block; margin-bottom: 6px; color: #e4eaf3; font-size: 10px; line-height: 1.4; }
  .pax-oi-vote-fields { display: grid; grid-template-columns: 1fr 80px; gap: 6px; }
  .pax-oi-note { color: #8f9cb2; font-size: 10px; line-height: 1.45; }
  .pax-event-log { max-height: 120px; overflow: auto; padding: 8px 9px; border: 1px solid #202c41; border-radius: 6px; background: #070d1c; color: #a9b5c8; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-event-entry + .pax-event-entry { margin-top: 6px; }
  .pax-center { min-width: 0; min-height: 0; display: grid; grid-template-rows: 46px minmax(0, 1fr) auto 37px; padding: 0 14px; background: #050a19; }
  .pax-map-viewport { position: relative; min-width: 0; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #26334a; border-radius: 12px; background: #0d1527; box-shadow: 0 8px 24px #0005; }
  .pax-action-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 9px 0; }
  .pax-action-slots-heading { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; color: #aab6c9; font-size: 10px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  .pax-action-slots-heading small { color: #77849a; font-size: 9px; font-weight: 500; letter-spacing: 0; text-transform: none; }
  .pax-action-slot-wrap { min-width: 0; display: flex; align-items: center; gap: 6px; }
  .pax-action-slot { min-width: 0; min-height: 60px; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid #2d3b54; border-radius: 8px; color: #e2e8f0; background: #101a2c; text-align: left; cursor: pointer; }
  .pax-action-slot-wrap .pax-action-slot { flex: 1; }
  .pax-action-slot.is-active { border-color: #f5b72f; box-shadow: 0 0 0 1px #f5b72f44; }
  .pax-action-slot:disabled { opacity: .55; cursor: not-allowed; }
  .pax-action-slot-number { flex: 0 0 24px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: #f5c34f; background: #2a2417; font-size: 11px; font-weight: 900; }
  .pax-action-slot-copy { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .pax-action-slot-copy strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .pax-action-slot-copy small { overflow: hidden; color: #94a3b8; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .pax-action-slot-clear { flex: 0 0 auto; width: 25px; height: 25px; border: 1px solid #43516a; border-radius: 5px; color: #cbd5e1; background: #1b2639; cursor: pointer; }
  .pax-action-slot-clear:disabled { opacity: .35; cursor: not-allowed; }
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
  .pax-tile-action-control { display: grid; grid-template-columns: minmax(76px, 92px) minmax(0, 1fr); align-items: end; gap: 6px; }
  .pax-tile-quantity { display: grid; gap: 4px; color: #97a5ba; font-size: 9px; }
  .pax-tile-quantity input { width: 100%; min-width: 0; padding: 7px 6px; border: 1px solid #35445e; border-radius: 6px; color: #e2e8f0; background: #0b1322; font: inherit; font-size: 11px; }
  .pax-tile-quantity input:disabled { opacity: .4; }
  .pax-tile-action { width: 100%; min-height: 47px; display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; padding: 7px 8px; border: 1px solid #35445e; border-radius: 7px; color: #e2e8f0; background: #17243a; text-align: left; cursor: pointer; transition: opacity .15s, border-color .15s, background .15s; }
  .pax-tile-action:not(:disabled):hover { border-color: #d99d2c; background: #202b3c; }
  .pax-tile-action.is-unavailable { opacity: .38; filter: saturate(.55); cursor: not-allowed; }
  .pax-tile-action-copy { min-width: 0; display: grid; grid-template-rows: auto auto; gap: 3px; }
  .pax-tile-action-copy strong { font-size: 10px; }
  .pax-tile-action-copy small { color: #97a5ba; font-size: 9px; }
  .pax-dialog { width: min(900px, calc(100vw - 32px)); max-height: min(80vh, 650px); overflow: auto; margin: auto; padding: 0; border: 1px solid #334155; border-radius: 12px; background: #0d1426; color: var(--pax-text); }
  .pax-dialog::backdrop { background: #020617c9; backdrop-filter: blur(3px); }
  .pax-dialog-heading { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--pax-border); font-weight: 900; }
  .pax-dialog-close { padding: 5px 9px; border: 1px solid #334155; border-radius: 5px; color: var(--pax-text); background: #172238; cursor: pointer; }
  .pax-scoreboard-wrap { padding: 12px; }
  .pax-scoreboard-status { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #263249; }
  .pax-scoreboard-status div { display: grid; gap: 4px; }
  .pax-scoreboard-status span, .pax-scoreboard-note { color: #93a1b5; font-size: 10px; }
  .pax-scoreboard-status strong { color: #f2bb3b; font-size: 15px; }
  .pax-scoreboard-clock { text-align: right; }
  .pax-score-table-scroll { overflow-x: auto; }
  .pax-score-table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
  .pax-score-table th, .pax-score-table td { padding: 10px 12px; border-bottom: 1px solid #263249; text-align: right; font-variant-numeric: tabular-nums; }
  .pax-score-table thead th { color: #93a1b5; background: #10192b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .pax-score-table thead th:first-child, .pax-score-table tbody th { text-align: left; }
  .pax-score-table tbody tr { border-left: 3px solid var(--score-nation-color); }
  .pax-score-table tbody th { color: #e2e8f0; font-weight: 700; }
  .pax-score-table tbody td { color: #cbd5e1; }
  .pax-score-table .pax-score-total { color: #38bdf8; font-size: 14px; font-weight: 900; }
  .pax-score-rank { display: inline-grid; width: 20px; height: 20px; margin-right: 8px; place-items: center; border-radius: 50%; color: #cbd5e1; background: #263249; font-size: 10px; }
  .pax-scoreboard-note { margin: 10px 2px 0; }
  @media (max-width: 1100px) {
    .pax-main { grid-template-columns: 240px minmax(0, 1fr) 260px; }
    .pax-topbar { grid-template-columns: 36px 62px minmax(150px, 190px) minmax(140px, 1fr) auto 98px; gap: 6px; padding-inline: 7px; }
    .pax-resource { gap: 4px; padding-inline: 6px; }
    .pax-center { padding-inline: 9px; }
  }
  @media (max-width: 820px) {
    .pax-shell { height: auto; min-height: 100dvh; grid-template-rows: auto minmax(70vh, 1fr); overflow: auto; }
    .pax-topbar { grid-template-columns: 36px 62px minmax(0, 1fr) 92px; }
    .pax-phase { display: none; }
    .pax-resources { grid-column: 1 / 5; grid-row: 2; justify-content: flex-start; min-height: 34px; }
    .pax-topbar { grid-template-rows: 40px 34px; }
    .pax-main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(55vh, 1fr) auto auto; }
    .pax-center { grid-row: 1; min-height: 55vh; }
    .pax-sidebar { grid-row: 2; border-top: 1px solid var(--pax-border); border-right: 0; }
    .pax-inspector { grid-row: 3; border-top: 1px solid var(--pax-border); border-left: 0; }
    .pax-inspector-content { display: grid; grid-template-columns: minmax(190px, 240px) minmax(0, 1fr); gap: 20px; align-items: center; }
    .pax-development { margin-top: 0; }
  }
  @media (max-width: 520px) {
    .pax-topbar { grid-template-columns: 36px 58px minmax(0, 1fr) 90px; }
    .pax-brand { font-size: 13px; letter-spacing: 0; }
    .pax-brand { grid-column: 2; }
    .pax-round { grid-column: 3; }
    .pax-resources { grid-column: 1 / 5; overflow-x: auto; }
    .pax-gdi-button { font-size: 10px; }
    .pax-center { grid-template-rows: 58px minmax(0, 1fr) auto 37px; padding-inline: 5px; }
    .pax-action-slots { gap: 6px; }
    .pax-action-slot { min-height: 54px; gap: 5px; padding: 6px; }
    .pax-inspector-content { grid-template-columns: minmax(0, 1fr); }
    .pax-development { margin-top: 8px; }
    .pax-map-size { font-size: 9px; }
  }
`;

function formatValue(value) {
  return Number.isFinite(value) ? Math.floor(value).toLocaleString('es-ES') : '—';
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
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
    this.localEvents = [];
    this.pendingMoveSource = null;
    this.activeActionSlot = 0;
    this.startPending = false;
    this.startError = '';
    this.connectionError = '';
    this.oiTargetSelection = false;
    this.oiDraftBallot = {};
    this.oiSessionId = null;
    this.oiRenderKey = '';
    this.audioContext = null;

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
        <section class="pax-menu-overlay" id="game-menu" aria-label="Menú de partida" hidden>
          <div class="pax-menu-card">
            <h2>Menú de partida</h2>
            <div class="pax-menu-actions">
              <button type="button" id="menu-resume">Reanudar</button>
              <button type="button" class="pax-menu-end" id="menu-end-game">Terminar partida y volver al menú principal</button>
            </div>
          </div>
        </section>
        <header class="pax-topbar">
          <button class="pax-menu-button" id="menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="game-menu" title="Menú">☰</button>
          <div class="pax-brand">◉ PAX</div>
          <div class="pax-round">
            <span class="pax-round-icon">⌛</span>
            <div><span class="pax-label">Ronda</span><span class="pax-round-value" id="round-value">1/30</span></div>
            <span class="pax-timer" id="timer-value">60s</span>
            <button class="pax-force-button" id="force-phase-button" type="button" disabled title="La fase termina cuando todos los jugadores humanos confirman que están listos">⏩ Forzar</button>
          </div>
          <div class="pax-phase"><span class="pax-label">Fase actual:</span><strong id="phase-value">Fase 1: Crecimiento y recaudación</strong></div>
          <div class="pax-resources" aria-label="Recursos nacionales">
            <span class="pax-resource" title="Plata"><i class="pax-resource-icon" data-tooltip="Plata" tabindex="0" aria-label="Plata">◉</i><span id="silver-value">—</span></span>
            <span class="pax-resource" title="Materiales"><i class="pax-resource-icon" data-tooltip="Materiales" tabindex="0" aria-label="Materiales">▣</i><span id="materials-value">—</span></span>
            <span class="pax-resource" title="Influencia"><i class="pax-resource-icon" data-tooltip="Influencia" tabindex="0" aria-label="Influencia">♧</i><span id="influence-value">—</span></span>
            <span class="pax-resource" title="Población"><i class="pax-resource-icon" data-tooltip="Población" tabindex="0" aria-label="Población">♟</i><span id="population-value">0</span></span>
          </div>
          <button class="pax-gdi-button" id="gdi-open" type="button" title="Ver puntaje total y desglose de cada jugador"><span aria-hidden="true">🏆</span><span>Marcador<br>GDI</span></button>
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
                <div class="pax-formula-line is-forecast"><span>Población próximo turno:</span><strong id="forecast-population">—</strong></div>
                <div class="pax-formula-line"><span>Recaudación esperada:</span><strong id="forecast-revenue">—</strong></div>
                <p class="pax-tax-note">A menor impuesto, mayor crecimiento demográfico. A mayor impuesto, más recaudación inmediata.</p>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading"><span class="pax-panel-heading-icon" style="color:#b684e8">♙</span>Organización Int. (OI)<span class="pax-oi-tag">Sesión cada 5 rondas</span></div>
              <div class="pax-oi-card">
                <div class="pax-oi-row"><span>Próxima reunión:</span><strong id="next-vote">Después de ronda 5</strong></div>
                <div class="pax-oi-note" id="oi-status"></div>
                <div id="oi-content"></div>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading"><span style="color:#8996aa">≡</span>Log</div>
              <div class="pax-event-log" id="event-log" aria-live="polite"></div>
            </section>
          </aside>
          <section class="pax-center">
            <div class="pax-map-legend" aria-hidden="true"></div>
            <div class="pax-map-viewport" id="map-container"></div>
            <section class="pax-action-slots" id="action-slots" aria-label="Acciones de este turno"></section>
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
    this.container.addEventListener('click', (event) => {
      const button = event.target.closest?.('button');
      if (button && !button.disabled) this.playButtonClick();
    }, true);

    this.onConnect = () => {
      this.startPending = false;
      this.startError = '';
      this.connectionError = '';
      this.joinGame();
      this.updateStartMenu();
    };
    this.onDisconnect = () => {
      this.startPending = false;
      this.startError = 'Se perdió la conexión con el servidor. Reconectando…';
      this.connectionError = '';
      this.updateStartMenu();
    };
    this.onConnectError = () => {
      this.connectionError = 'No se pudo conectar con el servidor. Comprueba que esté iniciado en la Terminal 1.';
      this.updateStartMenu();
    };
    this.onGameState = (gameState) => this.updateGameState(gameState);
    socket.on('connect', this.onConnect);
    socket.on('disconnect', this.onDisconnect);
    socket.on('connect_error', this.onConnectError);
    socket.on(PROTOCOL.GAME_STATE_UPDATE, this.onGameState);
    this.onActionError = (message) => {
      this.startPending = false;
      this.startError = message;
      if (this.player && this.confirmedPlannedActions) {
        this.player.plannedActions = this.confirmedPlannedActions.map((action) => (
          action ? { ...action } : null
        ));
      }
      this.addEvent(`Acción no realizada: ${message}`);
      this.updateActionHighlights();
      this.updateActionSlots();
      this.updateStartMenu();
    };
    socket.on(PROTOCOL.ACTION_ERROR, this.onActionError);

    const menuToggle = this.container.querySelector('#menu-toggle');
    const gameMenu = this.container.querySelector('#game-menu');
    menuToggle.addEventListener('click', () => this.setGameMenuOpen(gameMenu.hidden));
    this.container.querySelector('#menu-resume').addEventListener('click', () => {
      this.setGameMenuOpen(false);
    });
    this.container.querySelector('#menu-end-game').addEventListener('click', () => {
      if (!socket.connected || !this.gameState?.gameStarted) return;
      socket.emit(PROTOCOL.END_GAME, { roomId: 'room-1' });
    });
    this.container.querySelector('#force-phase-button').addEventListener('click', () => {
      if (!socket.connected || this.gameState?.currentPhase !== 2) return;
      socket.emit(PROTOCOL.READY_PHASE_END, {
        roomId: 'room-1',
        ready: !this.player?.phaseReady
      });
    });

    this.container.querySelector('#action-slots').addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-clear-slot], [data-action-slot]');
      const clearButton = target?.matches('[data-clear-slot]') ? target : null;
      if (clearButton) {
        const slot = Number(clearButton.dataset.clearSlot);
        this.emitPlannedAction(slot, null);
        if (this.pendingMoveSource?.slot === slot) {
          this.pendingMoveSource = null;
          this.updateActionSlots();
          this.updateActionHighlights();
        }
        return;
      }

      const slotButton = target?.matches('[data-action-slot]') ? target : null;
      if (!slotButton || slotButton.disabled) return;
      this.activeActionSlot = Number(slotButton.dataset.actionSlot);
      this.pendingMoveSource = null;
      this.inspector.setContext(
        this.player,
        this.gameState?.currentPhase || 1,
        (action) => this.handleInspectorAction(action),
        this.activeActionSlot,
        this.gameState?.grid
      );
      this.updateActionSlots();
      this.updateActionHighlights();
    });

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

    const oiCard = this.container.querySelector('.pax-oi-card');
    oiCard.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'oi-propose') this.handleOIProposal();
      if (button.id === 'oi-select-target') this.beginOITargetSelection();
      if (button.id === 'oi-submit-vote') this.submitOIVote();
    });
    oiCard.addEventListener('input', () => this.captureOIDraft());
    oiCard.addEventListener('change', (event) => {
      if (event.target.matches('[data-oi-choice]')) {
        const proposalId = event.target.dataset.oiChoice;
        const draft = this.oiDraftBallot[proposalId] || { choice: 'ABSTAIN', wager: 0 };
        const wagerInput = oiCard.querySelector(`[data-oi-wager="${CSS.escape(proposalId)}"]`);
        if (event.target.value === 'ABSTAIN') {
          wagerInput.min = '0';
          wagerInput.value = '0';
        } else {
          wagerInput.min = '1';
          if (draft.choice === 'ABSTAIN' || Number(wagerInput.value) < 1) {
            wagerInput.value = '1';
          }
        }
      }
      this.captureOIDraft();
      if (event.target.matches('#oi-resolution-type')) {
        this.container.querySelector('#oi-select-target').hidden = (
          event.target.value !== OI_RESOLUTIONS.DEMILITARIZED_ZONE
        );
      }
    });
  }

  playButtonClick() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.audioContext ||= new AudioContextClass();
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(820, now);
    oscillator.frequency.exponentialRampToValueAtTime(480, now + 0.035);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.04);
  }

  setGameMenuOpen(open) {
    const gameMenu = this.container.querySelector('#game-menu');
    const menuToggle = this.container.querySelector('#menu-toggle');
    const shouldOpen = Boolean(open);
    gameMenu.hidden = !shouldOpen;
    menuToggle.setAttribute('aria-expanded', String(shouldOpen));
    const players = this.gameState?.players || [];
    const connectedHumans = players.filter((player) => !player.isBot && player.socketId).length;
    if (
      this.gameState?.gameStarted
      && players.length === 4
      && connectedHumans === 1
      && socket.connected
    ) {
      socket.emit(PROTOCOL.SET_GAME_PAUSED, {
        roomId: 'room-1',
        paused: shouldOpen
      });
    }
  }

  updateTaxMetrics(taxRate) {
    const growth = taxRate > 0 ? 1 / (100 * taxRate) : 0;
    this.container.querySelector('#tax-value').textContent = `${Math.round(taxRate * 100)}%`;
    this.container.querySelector('#growth-value').textContent = `+${(growth * 100).toFixed(2)}%`;
    this.container.querySelector('#revenue-value').textContent = `${taxRate.toFixed(2)}¤`;
    const plannedActions = this.player?.plannedActions || [];
    let forecastPopulation = 0;
    for (const tile of this.gameState?.grid?.flat() || []) {
      if (tile.ownerId !== this.player?.id) continue;
      if (tile.type === 'CAP' || tile.type === 'CIU') {
        forecastPopulation += Math.floor((tile.population || 0) * (1 + growth));
      }
    }
    for (const action of plannedActions) {
      if (action?.type !== 'BUILD_CITY') continue;
      const tile = this.gameState?.grid?.[action.y]?.[action.x];
      if (tile && tile.ownerId === this.player?.id && tile.type === 'TR' && !tile.building) {
        forecastPopulation += Math.floor(50 * (1 + growth));
      }
    }
    this.container.querySelector('#forecast-population').textContent = formatValue(forecastPopulation);
    this.container.querySelector('#forecast-revenue').textContent = `${formatValue(Math.floor(forecastPopulation * taxRate))}¤`;
  }

  updateGameState(gameState) {
    if (!gameState) return;
    this.gameState = gameState;
    const phase = gameState.currentPhase || 1;
    if (phase !== 2) this.pendingMoveSource = null;
    this.map.setDemilitarizedZones(gameState.activeDmzZones || [], false);
    this.map.render(gameState.grid);

    const players = Array.isArray(gameState.players) ? gameState.players : [];
    this.player = players.find((player) => (
      player.boundPlayerId === this.playerId || player.socketId === socket.id
    )) || null;
    if (this.player) {
      this.player.plannedActions = Array.from(
        { length: ACTION_SLOT_COUNT },
        (_, index) => this.player.plannedActions?.[index] ?? null
      );
    }
    this.confirmedPlannedActions = (this.player?.plannedActions || Array(ACTION_SLOT_COUNT).fill(null)).map((action) => (
      action ? { ...action } : null
    ));
    if (gameState.gameStarted) this.startPending = false;
    this.updateStartMenu(gameState.gameStarted);
    if (!gameState.gameStarted) {
      this.container.querySelector('#game-menu').hidden = true;
      this.container.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
    }
    this.inspector.setContext(
      this.player,
      phase,
      (action) => this.handleInspectorAction(action),
      this.activeActionSlot,
      gameState.grid
    );
    this.updateActionSlots();
    this.updateActionHighlights();
    this.updateForcePhaseButton(players, phase, gameState.gameStarted);
    this.scoreboard.update(
      players,
      gameState.currentPhase,
      gameState.timeRemaining,
      gameState.grid,
      gameState.isPaused
    );

    const round = gameState.oiSession?.phase === 'voting'
      ? gameState.oiSession.meetingAfterRound
      : gameState.currentRound || 1;
    const roundEl = this.container.querySelector('#round-value');
    roundEl.textContent = `${round}/30`;
    this.container.querySelector('#timer-value').textContent = `${gameState.timeRemaining ?? 60}s${gameState.isPaused ? ' · Pausado' : ''}`;
    this.container.querySelector('#phase-value').textContent = `Fase ${phase}: ${PHASE_LABELS[phase] || 'En curso'}`;
    this.container.querySelector('#next-vote').textContent = gameState.oiSession?.phase === 'voting'
      ? `En curso · ronda ${round}`
      : `Después de ronda ${Math.ceil(round / 5) * 5}`;
    this.updateOIPanel(gameState, round);
    this.updateNationPanel();
    this.updateResources();
    this.taxSlider.setEnabled(Boolean(this.player && phase === 2));
    this.syncGameEventHistory(gameState.eventHistory);

    if (this.player && Number.isFinite(this.player.taxRate)) {
      this.taxSlider.setValue(this.player.taxRate);
      this.updateTaxMetrics(this.player.taxRate);
    } else {
      this.updateTaxMetrics(this.taxSlider.currentValue);
    }
  }

  updateOIPanel(gameState, round) {
    const card = this.container.querySelector('.pax-oi-card');
    const status = card.querySelector('#oi-status');
    const content = card.querySelector('#oi-content');
    const session = gameState.oiSession;
    const sessionId = session?.id || null;
    if (sessionId !== this.oiSessionId) {
      this.oiSessionId = sessionId;
      this.oiDraftBallot = {};
    }

    const hasVoted = Boolean(this.player && session?.votesSubmitted?.includes(this.player.id));
    const renderKey = JSON.stringify({
      round,
      phase: gameState.currentPhase,
      playerId: this.player?.id,
      influence: this.player?.resources?.INFLUENCE,
      proposals: gameState.oiProposals,
      session: session && {
        id: session.id,
        phase: session.phase,
        proposals: session.proposals,
        votes: session.votes,
        results: session.results
      },
      votesSubmitted: session?.votesSubmitted,
      policies: gameState.oiPolicies,
      zones: gameState.activeDmzZones,
      pacts: gameState.nonAggressionPacts
    });
    if (renderKey === this.oiRenderKey) {
      if (session?.phase === 'voting') {
        status.textContent = `Votación abierta · ${session.timeRemaining}s restantes · ${this.player?.resources?.INFLUENCE || 0} de Influencia disponible.`;
      }
      return;
    }
    this.oiRenderKey = renderKey;

    if (session?.phase === 'voting') {
      status.textContent = `Votación abierta · ${session.timeRemaining}s restantes · ${this.player?.resources?.INFLUENCE || 0} de Influencia disponible.`;
      content.innerHTML = `
        <div class="pax-oi-controls">
          <p class="pax-oi-note">Reunión después de la ronda ${session.meetingAfterRound}. Votos registrados: ${session.votesSubmitted?.length || 0}/${gameState.players.length}. La sesión dura 60 segundos; las papeletas se revelan al cerrar.</p>
          ${hasVoted
            ? '<p class="pax-oi-note">Tu papeleta quedó registrada. Espera a que voten los demás o termine el plazo.</p>'
            : `${session.proposals.map((proposal) => {
              const draft = this.oiDraftBallot[proposal.id] || { choice: 'ABSTAIN', wager: 0 };
              return `
                <div class="pax-oi-vote">
                  <strong>${escapeHTML(proposal.name)}${proposal.target ? ` · casilla (${proposal.target.x}, ${proposal.target.y})` : ''}</strong>
                  <div class="pax-oi-vote-fields">
                    <label>Voto
                      <select data-oi-choice="${escapeHTML(proposal.id)}">
                        <option value="FOR" ${draft.choice === 'FOR' ? 'selected' : ''}>A favor</option>
                        <option value="AGAINST" ${draft.choice === 'AGAINST' ? 'selected' : ''}>En contra</option>
                        <option value="ABSTAIN" ${draft.choice === 'ABSTAIN' ? 'selected' : ''}>Abstención</option>
                      </select>
                    </label>
                    <label>Influencia
                      <input data-oi-wager="${escapeHTML(proposal.id)}" type="number" min="${draft.choice === 'ABSTAIN' ? 0 : 1}" step="1" value="${draft.wager}" />
                    </label>
                  </div>
                </div>
              `;
            }).join('')}
            <button id="oi-submit-vote" type="button" ${this.player ? '' : 'disabled'}>Registrar todos los votos</button>`}
        </div>
      `;
      return;
    }

    const proposalWindow = gameState.gameStarted
      && gameState.currentPhase === 2;
    const resultsMarkup = session?.phase === 'complete' && session.results
      ? `
        <div class="pax-oi-controls">
          <p class="pax-oi-note">Resultados de la sesión anterior:</p>
          ${session.results.length
            ? session.results.map((result) => `
              <div class="pax-oi-vote">
                <strong>${escapeHTML(result.name)}</strong>
                <span class="pax-oi-note">${result.message}: a favor ${result.forInfluence} · en contra ${result.againstInfluence}.</span>
              </div>
            `).join('')
            : '<p class="pax-oi-note">No se presentaron resoluciones en la última sesión.</p>'}
        </div>
      `
      : '';
    status.textContent = proposalWindow
      ? 'Puedes proponer resoluciones durante la planificación. Cada propuesta cuesta 2 de Influencia.'
      : `Próxima sesión después de ronda ${Math.ceil(round / 5) * 5}.`;
    content.innerHTML = `
      <div class="pax-oi-controls">
        ${resultsMarkup}
        ${proposalWindow ? `
          <label>Resolución
            <select id="oi-resolution-type">
              <option value="${OI_RESOLUTIONS.ARMAMENT_LIMIT}">Límite de armamento · 10 tropas</option>
              <option value="${OI_RESOLUTIONS.INDUSTRY_LIMIT}">Límite de industria · 10 fábricas</option>
              <option value="${OI_RESOLUTIONS.DEMILITARIZED_ZONE}">Zona Desmilitarizada · elegir casilla</option>
              <option value="${OI_RESOLUTIONS.CONDITIONAL_SUBSIDY}">Subsidio condicionado · 25 de plata</option>
            </select>
          </label>
          <button id="oi-select-target" type="button" hidden>Elegir casilla para la ZDM</button>
          <button id="oi-propose" type="button" ${this.player?.resources?.INFLUENCE >= 2 ? '' : 'disabled'}>Proponer (cuesta 2 Influencia)</button>
          ${this.oiTargetSelection ? '<p class="pax-oi-note">Haz clic en la casilla objetivo del mapa (el centro de una zona de 5×5).</p>' : ''}
        ` : ''}
        ${gameState.oiProposals.length
          ? `<div class="pax-oi-note">Propuestas acumuladas: ${gameState.oiProposals.map((proposal) => `
            <div class="pax-oi-proposal">${escapeHTML(proposal.name)} · ${escapeHTML(proposal.proposerName)}${proposal.target ? ` · (${proposal.target.x}, ${proposal.target.y})` : ''}</div>
          `).join('')}</div>`
          : '<p class="pax-oi-note">Aún no hay propuestas para la próxima sesión.</p>'}
        <p class="pax-oi-note">Los límites aprobados se mantienen activos. Las ZDM y los pactos duran hasta la siguiente sesión.</p>
      </div>
    `;
    const selectTargetButton = content.querySelector('#oi-select-target');
    if (selectTargetButton) {
      selectTargetButton.hidden = (
        content.querySelector('#oi-resolution-type').value !== OI_RESOLUTIONS.DEMILITARIZED_ZONE
      );
    }
  }

  captureOIDraft() {
    const card = this.container.querySelector('.pax-oi-card');
    for (const select of card.querySelectorAll('[data-oi-choice]')) {
      const proposalId = select.dataset.oiChoice;
      this.oiDraftBallot[proposalId] ||= {};
      this.oiDraftBallot[proposalId].choice = select.value;
    }
    for (const input of card.querySelectorAll('[data-oi-wager]')) {
      const proposalId = input.dataset.oiWager;
      this.oiDraftBallot[proposalId] ||= {};
      this.oiDraftBallot[proposalId].wager = Number(input.value);
    }
  }

  handleOIProposal() {
    const type = this.container.querySelector('#oi-resolution-type')?.value;
    if (!type || type === OI_RESOLUTIONS.DEMILITARIZED_ZONE || !socket.connected) return;
    socket.emit(PROTOCOL.PROPOSE_OI_RESOLUTION, {
      roomId: 'room-1',
      proposal: { type }
    });
  }

  beginOITargetSelection() {
    if (!socket.connected || !this.container.querySelector('#oi-resolution-type')) return;
    this.oiTargetSelection = true;
    this.map.setTargetSelectionMode(true);
    this.updateOIPanel(this.gameState, this.gameState.currentRound);
    this.container.querySelector('#oi-status').textContent = 'Selecciona la casilla central de la ZDM en el mapa.';
  }

  submitOIVote() {
    const session = this.gameState?.oiSession;
    if (!socket.connected || session?.phase !== 'voting') return;
    this.captureOIDraft();
    const ballot = session.proposals.map((proposal) => {
      const draft = this.oiDraftBallot[proposal.id] || { choice: 'ABSTAIN', wager: 0 };
      const wager = draft.choice === 'ABSTAIN'
        ? 0
        : Math.max(1, Number.isInteger(draft.wager) ? draft.wager : 1);
      this.oiDraftBallot[proposal.id] = { choice: draft.choice, wager };
      const input = this.container.querySelector(`[data-oi-wager="${CSS.escape(proposal.id)}"]`);
      if (input) input.value = String(wager);
      return { proposalId: proposal.id, choice: draft.choice, wager };
    });
    socket.emit(PROTOCOL.SUBMIT_OI_VOTE, { roomId: 'room-1', ballot });
  }

  updateForcePhaseButton(players, phase, gameStarted) {
    const button = this.container.querySelector('#force-phase-button');
    if (!button) return;
    const participants = players;
    const readyCount = participants.filter((player) => player.phaseReady).length;
    const requiredCount = participants.length;
    const canForce = Boolean(gameStarted && this.player && phase === 2);
    const isReady = Boolean(this.player?.phaseReady);
    button.disabled = !canForce;
    button.textContent = isReady
      ? `↩ Quitar listo (${readyCount}/${requiredCount})`
      : requiredCount > 0
        ? `⏩ Forzar (${readyCount}/${requiredCount})`
        : '⏩ Forzar';
    button.title = isReady
      ? 'Retirar tu confirmación para que continúe la planificación'
      : 'Los bots ya están listos; la fase termina cuando todos los jugadores humanos confirman que están listos.';
  }

  updateActionSlots() {
    const slots = this.container.querySelector('#action-slots');
    if (!slots) return;
    const plannedActions = this.player?.plannedActions || Array(ACTION_SLOT_COUNT).fill(null);
    const canPlan = Boolean(this.player && this.gameState?.currentPhase === 2);
    const labels = {
      BUILD_CITY: 'Construir ciudad',
      BUILD_FACTORY: 'Construir fábrica',
      RECRUIT_TROOP: 'Reclutar tropa',
      MOVE_CAPITAL: 'Trasladar capital',
      MOVE_TROOPS: 'Mover tropas'
    };
    slots.innerHTML = `
      <div class="pax-action-slots-heading">
        <span>Acciones del turno</span>
        <small>Se ejecutan cuando termina el tiempo</small>
      </div>
      ${Array.from({ length: ACTION_SLOT_COUNT }, (_, slot) => {
      const action = plannedActions[slot];
      let detail = action
        ? `Casilla (${action.x}, ${action.y})`
        : 'Vacío · selecciona para editar';
      if (action?.type === 'MOVE_TROOPS') {
        detail = `(${action.x}, ${action.y}) → (${action.targetX}, ${action.targetY}) · ${action.troops} tropas`;
      } else if (action?.type === 'RECRUIT_TROOP') {
        detail = `Casilla (${action.x}, ${action.y}) · ${action.count || 1} tropas`;
      }
      if (this.pendingMoveSource?.slot === slot) {
        detail = `Origen marcado · ${this.pendingMoveSource.troops} tropas · selecciona destino`;
      }
      const active = this.activeActionSlot === slot;
      return `
        <div class="pax-action-slot-wrap">
          <button class="pax-action-slot ${active ? 'is-active' : ''}" type="button"
            data-action-slot="${slot}" ${canPlan ? '' : 'disabled'}
            aria-pressed="${active}">
            <span class="pax-action-slot-number">${slot + 1}</span>
            <span class="pax-action-slot-copy">
              <strong>${action ? labels[action.type] || 'Acción planificada' : `Espacio ${slot + 1} · vacío`}</strong>
              <small>${detail}</small>
            </span>
          </button>
          <button class="pax-action-slot-clear" type="button" data-clear-slot="${slot}"
            title="Vaciar espacio ${slot + 1}" aria-label="Vaciar espacio ${slot + 1}"
            ${canPlan && (action || this.pendingMoveSource?.slot === slot) ? '' : 'disabled'}>×</button>
        </div>
      `;
      }).join('')}
    `;
    this.updateTaxMetrics(this.player?.taxRate ?? this.taxSlider?.currentValue ?? 0);
  }

  updateActionHighlights(provisionalDestination = null) {
    const highlights = [];
    const plannedActions = this.player?.plannedActions || [];
    for (const action of plannedActions) {
      if (action?.type !== 'MOVE_TROOPS') continue;
      highlights.push({ x: action.x, y: action.y, role: 'source' });
      highlights.push({ x: action.targetX, y: action.targetY, role: 'target' });
    }
    if (this.pendingMoveSource) {
      highlights.push({
        x: this.pendingMoveSource.x,
        y: this.pendingMoveSource.y,
        role: 'source'
      });
    }
    if (provisionalDestination) {
      highlights.push({ ...provisionalDestination, role: 'target' });
    }
    this.map.setActionHighlights(highlights);
  }

  emitPlannedAction(slot, plannedAction) {
    if (!this.player) return;
    this.player.plannedActions ||= Array(ACTION_SLOT_COUNT).fill(null);
    this.player.plannedActions[slot] = plannedAction ? { ...plannedAction } : null;
    if (plannedAction) {
      const nextAvailableSlot = Array.from(
        { length: ACTION_SLOT_COUNT },
        (_, offset) => (slot + offset + 1) % ACTION_SLOT_COUNT
      ).find((candidate) => !this.player.plannedActions[candidate]);
      if (nextAvailableSlot != null) this.activeActionSlot = nextAvailableSlot;
    }
    this.inspector.setContext(
      this.player,
      this.gameState?.currentPhase || 1,
      (action) => this.handleInspectorAction(action),
      this.activeActionSlot,
      this.gameState?.grid
    );
    this.updateActionSlots();
    this.updateActionHighlights();
    socket.emit(PROTOCOL.PLAYER_ACTION, {
      roomId: 'room-1',
      action: { type: 'PLAN_ACTION', slot, plannedAction }
    });
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
      ? this.connectionError || 'No hay conexión con el servidor. Reconectando…'
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
    if (this.gameState?.currentPhase !== 2 || !this.player) return;
    if (action.type === 'MOVE_TROOPS') {
      this.pendingMoveSource = { ...action, slot: this.activeActionSlot };
      this.updateActionSlots();
      this.updateActionHighlights();
      return;
    }
    this.emitPlannedAction(this.activeActionSlot, action);
  }

  handleTileSelection(tile) {
    if (this.oiTargetSelection && this.map.selectionFromUser && tile) {
      const type = this.container.querySelector('#oi-resolution-type')?.value;
      this.oiTargetSelection = false;
      this.map.setTargetSelectionMode(false);
      socket.emit(PROTOCOL.PROPOSE_OI_RESOLUTION, {
        roomId: 'room-1',
        proposal: { type, x: tile.x, y: tile.y }
      });
      this.updateOIPanel(this.gameState, this.gameState.currentRound);
      return;
    }
    this.inspector.render(tile);
    if (!this.pendingMoveSource || !tile) return;

    const source = this.pendingMoveSource;
    if (tile.x === source.x && tile.y === source.y) return;
    this.updateActionHighlights({ x: tile.x, y: tile.y });
    const sourceTile = this.gameState?.grid?.[source.y]?.[source.x];
    this.pendingMoveSource = null;
    this.updateActionSlots();
    this.emitPlannedAction(source.slot, {
      type: 'MOVE_TROOPS',
      x: source.x,
      y: source.y,
      targetX: tile.x,
      targetY: tile.y,
      troops: source.troops ?? sourceTile?.troops
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

  syncGameEventHistory(history = []) {
    const savedScrollTop = this.container.querySelector('#event-log')?.scrollTop || 0;
    this.events = [
      ...this.localEvents,
      ...history.slice().reverse().map((event) => event.message)
    ];
    this.renderEventHistory(savedScrollTop);
  }

  addEvent(message) {
    this.localEvents.unshift(message);
    this.events.unshift(message);
    this.renderEventHistory(0);
  }

  renderEventHistory(scrollTop) {
    const log = this.container.querySelector('#event-log');
    if (log) {
      log.innerHTML = this.events
        .map((entry) => `<div class="pax-event-entry">› ${escapeHTML(entry)}</div>`)
        .join('');
      log.scrollTop = scrollTop;
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
    socket.off('connect_error', this.onConnectError);
    socket.off(PROTOCOL.ACTION_ERROR, this.onActionError);
    this.styleElement.remove();
    this.container.innerHTML = '';
  }
}
