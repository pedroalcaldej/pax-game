/**
 * Pantalla principal de PAX: panel de nación, mapa e inspector territorial.
 */

import { Map } from '../components/Map.js';
import { Inspector } from '../components/Inspector.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { GlobalPanel } from '../components/GlobalPanel.js';
import { FinancePanel } from '../components/FinancePanel.js';
import { socket } from '../../network/SocketClient.js';
import { FirebaseLobby } from '../../network/FirebaseLobby.js';
import {
  ACTION_SLOT_COUNT,
  GAME_STAGES,
  MAX_ROUNDS,
  MAP_CONFIG,
  NATIONS,
  AVAILABLE_NATION_COLORS,
  LEGACY_NATION_NAMES,
  OI_RESOLUTIONS,
  PROTOCOL,
  STAGE_TIMINGS
} from '../../../../shared/Constants.js';
import { getPlayerRankings } from '../components/PlayerRankings.js';
import { Chat } from '../components/Chat.js';

const STAGE_LABELS = {
  [GAME_STAGES.ROUND_START]: 'Inicio de ronda',
  [GAME_STAGES.PLANNING]: 'Planificación',
  [GAME_STAGES.RESOLVING]: 'Resolviendo acciones…',
  [GAME_STAGES.CLOSING]: 'Actualizando el mundo…',
  [GAME_STAGES.INTERNATIONAL_MEETING]: 'Reunión de la OI'
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
    width: min(760px, 100%);
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
  .pax-start-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 24px; text-align: left; }
  .pax-start-option { min-width: 0; padding: 18px; border: 1px solid #34435d; border-radius: 10px; background: rgba(15, 23, 42, .65); }
  .pax-start-option h2 { margin: 0 0 8px; color: #e2e8f0; font-size: 15px; }
  .pax-start-option > p { font-size: 11px; }
  .pax-profile-fields { display: grid; gap: 8px; margin-top: 14px; }
  .pax-profile-fields label { display: grid; gap: 5px; color: #a7b3c7; font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .pax-profile-fields input { width: 100%; min-height: 32px; padding: 6px 8px; border: 1px solid #34435d; border-radius: 6px; color: #f1f5f9; background: #0f172a; font: inherit; }
  .pax-color-picker { display: flex; flex-wrap: wrap; gap: 7px; padding: 5px; border: 1px solid #34435d; border-radius: 6px; background: #0f172a; }
  .pax-color-choice { width: 24px; height: 24px; padding: 0; border: 2px solid transparent; border-radius: 50%; cursor: pointer; }
  .pax-color-choice:disabled { cursor: not-allowed; filter: grayscale(1); opacity: .3; }
  .pax-color-choice.is-selected { border-color: #f8fafc; box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px currentColor; }
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
  .pax-room-actions { display: grid; gap: 14px; margin-top: 22px; }
  .pax-join-room { display: grid; gap: 6px; text-align: left; }
  .pax-join-room label { color: #a7b3c7; font-size: 11px; font-weight: 800; text-transform: uppercase; }
  .pax-join-room-row, .pax-lobby-code-row { display: flex; gap: 8px; align-items: center; }
  .pax-join-room input {
    min-width: 0;
    flex: 1;
    padding: 12px;
    border: 1px solid #34435d;
    border-radius: 7px;
    color: #f1f5f9;
    background: #0f172a;
    font: inherit;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .pax-join-room-row .pax-start-button { width: auto; margin-top: 0; }
  .pax-lobby-code-row { justify-content: space-between; margin: 14px 0; color: #a7b3c7; font-size: 11px; }
  .pax-lobby-code-row span { font-variant-numeric: tabular-nums; }
  .pax-lobby-profile { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, .7fr) auto; gap: 8px; align-items: end; margin: 14px 0; text-align: left; }
  .pax-lobby-profile label { display: grid; gap: 5px; color: #a7b3c7; font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .pax-lobby-profile input { width: 100%; min-height: 32px; padding: 6px 8px; border: 1px solid #34435d; border-radius: 6px; color: #f1f5f9; background: #0f172a; font: inherit; }
  .pax-lobby-copy {
    padding: 7px 10px;
    border: 1px solid #53627d;
    border-radius: 6px;
    color: #e2e8f0;
    background: #1a263b;
    font: inherit;
    cursor: pointer;
  }
  .pax-lobby-slots { display: grid; gap: 7px; margin: 16px 0; text-align: left; }
  .pax-lobby-slot {
    padding: 9px 10px;
    border: 1px solid #34435d;
    border-radius: 6px;
    color: #cbd5e1;
    background: rgba(15, 23, 42, .65);
    font-size: 12px;
  }
  @media (max-width: 620px) {
    .pax-start-options { grid-template-columns: 1fr; }
  }
  .pax-stage-overlay {
    position: fixed; inset: 0; z-index: 8; display: grid; place-items: center;
    pointer-events: none; background: rgba(3, 7, 18, .18);
  }
  .pax-stage-overlay[hidden] { display: none; }
  .pax-stage-overlay-card {
    padding: 12px 18px; border: 1px solid #53627d; border-radius: 9px;
    color: #e2e8f0; background: rgba(13, 20, 38, .94); box-shadow: 0 12px 35px #0008;
    font-weight: 800; letter-spacing: .02em;
  }
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
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button {
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
  .pax-force-button, .pax-global-panel-button, .pax-action-button, .pax-development button {
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
  .pax-global-panel-button { justify-content: center; gap: 8px; cursor: pointer; font-size: 11px; font-weight: 800; }
  .pax-global-panel-button span:first-child { color: #ffd24b; }
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
  .pax-sidebar { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--pax-border); }
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
  .pax-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 8px; border-bottom: 1px solid var(--pax-border); background: #0a1120; }
  .pax-tab { min-width: 0; min-height: 34px; padding: 6px 4px; border: 1px solid #293750; border-radius: 6px; color: #93a1b5; background: #10192b; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-tab:hover { color: #e2e8f0; border-color: #53627d; }
  .pax-tab.is-active { color: #17120a; border-color: #f5b72f; background: linear-gradient(180deg, #ffd66c, #efa91d); }
  .pax-tab-panel { min-height: 0; flex: 1; overflow: auto; }
  .pax-tab-panel[hidden] { display: none; }
  .pax-tab-panel.log-tab-panel { overflow: hidden; }
  .pax-tab-panel.log-tab-panel .pax-panel-section {
    min-height: 0;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .pax-info-heading { cursor: help; }
  .pax-panel-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; color: #9ba9bf; font-size: 11px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  .pax-panel-heading-icon { color: var(--pax-gold); font-size: 14px; }
  .pax-tax-card { margin-top: 10px; padding: 11px; border: 1px solid #202c41; border-radius: 8px; background: #070d1c; }
  .pax-shell .tax-slider-container { padding: 0; border: 0; border-radius: 0; color: var(--pax-text); background: transparent; font: inherit; }
  .pax-shell .tax-slider-container label { display: none; }
  .pax-shell .tax-slider-container input { width: 100%; height: 8px; accent-color: #f5a900; cursor: pointer; }
  .pax-shell .tax-slider-container p { display: none; }
  .pax-formula-line { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0; color: #9eabc0; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-formula-line.is-detail { display: none; }
  .pax-formula-line strong { color: #32d5a3; white-space: nowrap; }
  .pax-formula-line.is-forecast { padding-top: 5px; border-top: 1px solid #202c41; font-family: inherit; }
  .pax-tax-note { display: none; }
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
  .pax-event-log { min-height: 0; height: 0; flex: 1 1 auto; overflow-y: scroll; overscroll-behavior: contain; padding: 8px 9px; border: 1px solid #202c41; border-radius: 6px; background: #070d1c; color: #a9b5c8; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-event-entry + .pax-event-entry { margin-top: 6px; }
  .pax-event-entry time, .pax-chat-message time { margin-right: 5px; color: #718096; font-size: 9px; }
  .pax-center { position: relative; min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto 37px; gap: 8px; padding: 0 14px; background: #050a19; }
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
  #chat-container { position: absolute; z-index: 4; right: 14px; bottom: 0; left: 14px; min-width: 0; min-height: 0; overflow: hidden; pointer-events: none; }
  .pax-chat { height: min(50vh, 420px); min-height: 0; display: grid; grid-template-rows: 30px minmax(0, 1fr) 34px; border: 1px solid #26334a; border-radius: 8px; background: #0d1527; overflow: hidden; }
  .pax-chat.is-collapsed { height: 30px; grid-template-rows: 30px 0 0; }
  .pax-chat { pointer-events: auto; }
  .pax-chat-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 6px 9px; border: 0; color: #aab6c9; background: transparent; font: inherit; font-size: 10px; font-weight: 900; letter-spacing: .07em; text-align: left; text-transform: uppercase; cursor: pointer; }
  .pax-chat-messages { min-height: 0; overflow-y: auto; padding: 4px 9px; font-size: 11px; line-height: 1.45; }
  .pax-chat-message { padding: 2px 0; overflow-wrap: anywhere; }
  .pax-chat-message strong { margin-right: 5px; }
  .pax-chat-form { display: flex; gap: 6px; min-height: 34px; padding: 5px 7px; border-top: 1px solid #26334a; background: #0d1527; }
  .pax-chat-form input { min-width: 0; flex: 1; padding: 5px 7px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; font-size: 11px; }
  .pax-chat-form button { padding: 4px 10px; border: 1px solid #53627d; border-radius: 5px; color: #e2e8f0; background: #1a263b; font: inherit; font-size: 10px; cursor: pointer; }
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
  .pax-dialog { width: min(1200px, calc(100vw - 32px)); max-height: min(88vh, 820px); overflow: auto; margin: auto; padding: 0; border: 1px solid #334155; border-radius: 12px; background: #0d1426; color: var(--pax-text); }
  .pax-end-dialog { width: min(1100px, calc(100vw - 32px)); }
  .pax-dialog::backdrop { background: #020617c9; backdrop-filter: blur(3px); }
  .pax-dialog-heading { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--pax-border); font-weight: 900; }
  .pax-dialog-close { padding: 5px 9px; border: 1px solid #334155; border-radius: 5px; color: var(--pax-text); background: #172238; cursor: pointer; }
  .pax-scoreboard-wrap { padding: 12px; }
  .pax-scoreboard-status { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #263249; }
  .pax-scoreboard-status div { display: grid; gap: 4px; }
  .pax-scoreboard-status span, .pax-scoreboard-note { color: #93a1b5; font-size: 10px; }
  .pax-scoreboard-status strong { color: #f2bb3b; font-size: 15px; }
  .pax-scoreboard-clock { text-align: right; }
  .pax-global-table-scroll { overflow-x: auto; }
  .pax-global-table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
  .pax-global-table th, .pax-global-table td { padding: 9px 10px; border-bottom: 1px solid #263249; text-align: right; font-variant-numeric: tabular-nums; }
  .pax-global-table thead th { color: #93a1b5; background: #10192b; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .pax-global-table thead th:first-child, .pax-global-table tbody th { text-align: left; }
  .pax-global-table tbody tr { border-left: 3px solid var(--score-nation-color); }
  .pax-global-table tbody tr.is-local-player { background: #f2bb3b0d; }
  .pax-global-table tbody th { color: #e2e8f0; font-weight: 700; }
  .pax-global-table tbody td { color: #cbd5e1; }
  .pax-global-table .pax-score-total { color: #38bdf8; font-size: 13px; font-weight: 900; }
  .pax-score-rank { display: inline-grid; width: 20px; height: 20px; margin-right: 8px; place-items: center; border-radius: 50%; color: #cbd5e1; background: #263249; font-size: 10px; }
  .pax-scoreboard-note { margin: 10px 2px 0; }
  .pax-end-result { padding: 18px 16px 6px; text-align: center; }
  .pax-end-result h2 { margin: 0; color: #f5c451; font-size: 23px; }
  .pax-end-result p { margin: 8px 0 0; color: #cbd5e1; }
  .pax-end-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 12px 16px 18px; }
  .pax-end-actions button { min-height: 42px; padding: 9px 16px; border: 1px solid #39455d; border-radius: 6px; color: var(--pax-text); background: #1a263b; font: inherit; font-weight: 800; cursor: pointer; }
  .pax-end-actions button:first-child { border-color: #eab23e; color: #17120a; background: linear-gradient(180deg, #ffd66c, #efa91d); }
  .pax-end-actions button:disabled { opacity: .6; cursor: wait; }
  .pax-global-treaties { margin-top: 16px; padding-top: 12px; border-top: 1px solid #263249; }
  .pax-global-treaties h3, .pax-global-treaty-form h3 { margin: 0 0 9px; color: #e2e8f0; font-size: 12px; }
  .pax-global-treaty { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 9px; border: 1px solid #263249; border-radius: 6px; background: #10192b; font-size: 10px; }
  .pax-global-treaty + .pax-global-treaty { margin-top: 6px; }
  .pax-global-treaty strong { color: #e2e8f0; }
  .pax-global-treaty span, .pax-global-treaty small, .pax-global-empty, .pax-global-treaty-form p { color: #93a1b5; }
  .pax-global-treaty button, .pax-global-treaty-form button { padding: 5px 9px; border: 1px solid #42516b; border-radius: 5px; color: #e2e8f0; background: #1b2940; cursor: pointer; font: inherit; }
  .pax-global-treaty button:disabled { opacity: .5; cursor: not-allowed; }
  .pax-global-treaty-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #263249; }
  .pax-global-treaty-form h3, .pax-global-treaty-form p, .pax-global-treaty-form button, .pax-global-panel-status { grid-column: 1 / -1; }
  .pax-global-treaty-form label { display: grid; gap: 5px; color: #aab6c9; font-size: 10px; }
  .pax-global-treaty-form select { min-height: 32px; padding: 5px 7px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-global-treaty-form :disabled { opacity: .5; cursor: not-allowed; }
  .pax-global-treaty-form p, .pax-global-empty, .pax-global-panel-status { margin: 0; font-size: 10px; line-height: 1.45; }
  .pax-finance { display: grid; gap: 9px; }
  .pax-finance h3 { margin: 8px 0 0; color: #dce4f2; font-size: 11px; }
  .pax-finance form { display: grid; gap: 7px; padding: 8px; border: 1px solid #263249; border-radius: 6px; background: #070d1c; }
  .pax-finance label { display: grid; gap: 4px; color: #aab6c9; font-size: 10px; }
  .pax-finance input, .pax-finance select { width: 100%; min-height: 29px; padding: 4px 6px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-finance button { min-height: 30px; padding: 6px 8px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #1a263b; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-finance button:disabled, .pax-finance input:disabled, .pax-finance select:disabled { opacity: .45; cursor: not-allowed; }
  .pax-finance-note, .pax-finance-debt small, .pax-finance-status { margin: 0; color: #93a1b5; font-size: 10px; line-height: 1.45; }
  .pax-finance-debt { margin-top: 7px; }
  .pax-finance-debt strong { color: #e2e8f0; font-size: 10px; }
  .pax-finance-status { color: #f2bb3b; }
  .pax-market-card { display: grid; gap: 8px; padding: 9px; border: 1px solid #263249; border-radius: 7px; background: #070d1c; }
  .pax-market-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .pax-market-actions form { padding: 0; border: 0; background: transparent; }
  .pax-market-actions input { text-align: center; }
  .pax-market-actions button { min-height: 28px; }
  .pax-quantity-controls { display: grid; grid-template-columns: 28px minmax(0, 1fr) 28px 42px; gap: 4px; }
  .pax-quantity-controls button { padding: 2px; }
  #finance-debt-content { display: grid; gap: 8px; }
  #finance-debt-content h3 { margin-top: 0; }
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
    .pax-global-panel-button { font-size: 10px; }
    .pax-center { grid-template-rows: 58px minmax(0, 1fr) auto 37px; padding-inline: 5px; }
    .pax-action-slots { gap: 6px; }
    .pax-action-slot { min-height: 54px; gap: 5px; padding: 6px; }
    .pax-inspector-content { grid-template-columns: minmax(0, 1fr); }
    .pax-development { margin-top: 8px; }
    .pax-map-size { font-size: 9px; }
  }
  /* Terminal geopolítico: superficies y estados compartidos por toda la interfaz. */
  .pax-shell {
    --pax-bg: #0f172a;
    --pax-panel: #111c2f;
    --pax-panel-raised: #1e293b;
    --pax-border: rgba(148, 163, 184, .18);
    --pax-muted: #94a3b8;
    --pax-text: #e2e8f0;
    --pax-gold: #fbbf24;
    --pax-purple: #c4b5fd;
    --pax-positive: #86efac;
    background: var(--pax-bg);
    letter-spacing: .01em;
  }
  .pax-shell button,
  .pax-shell input,
  .pax-shell select {
    transition: color .18s ease, background-color .18s ease, border-color .18s ease,
      box-shadow .18s ease, opacity .18s ease, transform .18s ease;
  }
  .pax-shell button:not(:disabled):hover {
    border-color: rgba(251, 191, 36, .72);
    box-shadow: 0 3px 14px rgba(2, 6, 23, .28);
  }
  .pax-shell button:not(:disabled):active { transform: translateY(1px); }
  [data-tooltip] { position: relative; }
  [data-tooltip]::after {
    position: absolute;
    z-index: 30;
    left: 50%;
    bottom: calc(100% + 8px);
    width: max-content;
    max-width: 230px;
    padding: 6px 8px;
    border: 1px solid rgba(148, 163, 184, .38);
    border-radius: 5px;
    color: #e2e8f0;
    background: #0f172a;
    box-shadow: 0 8px 20px rgba(2, 6, 23, .42);
    content: attr(data-tooltip);
    font: 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 3px);
    transition: opacity .15s ease, transform .15s ease;
    visibility: hidden;
  }
  [data-tooltip]:hover::after, [data-tooltip]:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
    visibility: visible;
  }
  .pax-shell [data-tooltip]::after { display: none; }
  .pax-tooltip-layer {
    position: fixed;
    z-index: 10000;
    max-width: min(280px, calc(100vw - 24px));
    padding: 7px 9px;
    border: 1px solid rgba(148, 163, 184, .48);
    border-radius: 6px;
    color: #f8fafc;
    background: #0b1324;
    box-shadow: 0 10px 28px rgba(2, 6, 23, .6);
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    opacity: 0;
    pointer-events: none;
    transition: opacity .12s ease;
  }
  .pax-tooltip-layer.is-visible { opacity: 1; }
  .pax-toasts {
    position: absolute;
    z-index: 5;
    top: 10px;
    left: 10px;
    right: 132px;
    display: grid;
    gap: 7px;
    pointer-events: none;
  }
  .pax-toast {
    width: fit-content;
    max-width: min(440px, 100%);
    padding: 8px 11px;
    border: 1px solid var(--toast-color);
    border-radius: 7px;
    color: #f8fafc;
    background: rgba(15, 23, 42, .94);
    box-shadow: 0 8px 24px rgba(2, 6, 23, .38);
    font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0;
    transform: translateY(-5px);
    animation: pax-toast-in .18s ease forwards;
  }
  .pax-toast.is-leaving { animation: pax-toast-out .22s ease forwards; }
  .pax-toast[data-type="success"] { --toast-color: #57d69a; }
  .pax-toast[data-type="info"] { --toast-color: #79a7f2; }
  .pax-toast[data-type="warning"] { --toast-color: #f5b62e; }
  .pax-toast[data-type="error"] { --toast-color: #f87171; }
  @keyframes pax-toast-in { to { opacity: 1; transform: translateY(0); } }
  @keyframes pax-toast-out { to { opacity: 0; transform: translateY(-5px); } }
  .pax-topbar { background: #0b1324; border-color: var(--pax-border); }
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button,
  .pax-menu-button { background: var(--pax-panel-raised); border-color: var(--pax-border); }
  .pax-round-value, .pax-resource, .pax-formula-line strong,
  .pax-finance-debt strong, .pax-scoreboard-status strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .pax-main, .pax-center { background: var(--pax-bg); }
  .pax-sidebar, .pax-inspector { background: var(--pax-panel); }
  .pax-nation, .pax-panel-section, .pax-section-heading { border-color: var(--pax-border); }
  .pax-nation { background: rgba(30, 41, 59, .42); }
  .pax-nation-name { color: #f8fafc; }
  .pax-human-tag, .pax-force-button { color: var(--pax-gold); border-color: rgba(251, 191, 36, .35); background: rgba(120, 83, 10, .2); }
  .pax-tabs { background: #0d1729; border-color: var(--pax-border); }
  .pax-tab { color: #a5b4fc; background: var(--pax-panel-raised); border-color: var(--pax-border); }
  .pax-tab[data-panel-tab="finance"] { color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"] { color: #cbd5e1; }
  .pax-tab.is-active { color: #0f172a; background: var(--pax-gold); border-color: var(--pax-gold); }
  .pax-panel-heading, .pax-info-heading { color: #cbd5e1; }
  .pax-tax-card, .pax-market-card, .pax-finance form, .pax-oi-card,
  .pax-event-log, .pax-action-slot, .pax-inspector-empty, .pax-tile-card {
    background: var(--pax-panel-raised);
    border-color: var(--pax-border);
    box-shadow: 0 5px 16px rgba(2, 6, 23, .16);
  }
  .pax-formula-line strong, .pax-timer, .pax-round-icon, .pax-resource-icon { color: var(--pax-gold); }
  .pax-resource:nth-child(3) .pax-resource-icon, .pax-oi-tag,
  .pax-oi-row strong { color: var(--pax-purple); }
  .pax-oi-tag { border-color: rgba(196, 181, 253, .3); background: rgba(124, 58, 237, .15); }
  .pax-oi-card { border-color: rgba(196, 181, 253, .22); }
  .pax-finance button[data-issue-bond],
  .pax-finance button[data-donate-world-bank],
  .pax-finance form button[type="submit"],
  .pax-start-button { color: #052e16; border-color: rgba(134, 239, 172, .65); background: #86efac; }
  .pax-finance button[data-issue-bond]:hover,
  .pax-finance button[data-donate-world-bank]:hover,
  .pax-finance form button[type="submit"]:hover,
  .pax-start-button:hover { background: #bbf7d0; border-color: #bbf7d0; }
  .pax-finance input, .pax-finance select, .pax-oi-controls select,
  .pax-oi-controls input, .pax-global-treaty-form select, .pax-tile-quantity input {
    background: #0f172a;
    border-color: var(--pax-border);
  }
  .pax-finance input:focus, .pax-finance select:focus, .pax-oi-controls select:focus,
  .pax-oi-controls input:focus, .pax-global-treaty-form select:focus {
    outline: none;
    border-color: rgba(251, 191, 36, .75);
    box-shadow: 0 0 0 3px rgba(251, 191, 36, .12);
  }
  .pax-finance input, .pax-finance-debt input, .pax-oi-controls input,
  .pax-global-table td, .pax-global-table th, .pax-round-value,
  .pax-resource, .pax-map-size { font-variant-numeric: tabular-nums; }
  .pax-finance input, .pax-finance-debt input, .pax-oi-controls input,
  .pax-global-table td, .pax-global-table th, .pax-round-value,
  .pax-resource, .pax-map-size { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .pax-action-slot:not(:disabled):hover { border-color: rgba(134, 239, 172, .7); background: #263a3a; }
  .pax-action-slot.is-active { border-color: var(--pax-gold); box-shadow: 0 0 0 1px rgba(251, 191, 36, .3); }
  .pax-event-log { color: #cbd5e1; }
  .pax-dialog, .pax-menu-card, .pax-start-card {
    background: var(--pax-panel-raised);
    border-color: var(--pax-border);
    box-shadow: 0 20px 55px rgba(2, 6, 23, .48);
  }
  /* Reference skin: keep the existing layout, but use a restrained terminal palette. */
  .pax-shell {
    --pax-bg: #101a2b;
    --pax-panel: rgba(15, 25, 42, .94);
    --pax-panel-raised: rgba(30, 41, 59, .92);
    --pax-border: rgba(148, 163, 184, .28);
    --pax-muted: #a7b3c7;
    --pax-text: #f1f5f9;
    --pax-gold: #f5b62e;
    --pax-blue: #79a7f2;
    --pax-purple: #a78bda;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    background:
      linear-gradient(135deg, rgba(15, 23, 42, .9), rgba(15, 23, 42, .68)),
      var(--pax-bg);
  }
  .pax-shell h1, .pax-shell h2, .pax-shell h3, .pax-shell button,
  .pax-shell input, .pax-shell select, .pax-shell label, .pax-shell strong,
  .pax-shell span, .pax-shell p { font-family: inherit; }
  .pax-topbar { background: rgba(10, 18, 32, .94); }
  .pax-brand { color: #f8fafc; font-size: 17px; letter-spacing: .12em; }
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button,
  .pax-menu-button { background: rgba(30, 41, 59, .74); border-color: var(--pax-border); }
  .pax-label { color: #94a3b8; }
  .pax-nation { background: rgba(15, 25, 42, .72); }
  .pax-nation-name { font-size: 14px; letter-spacing: .02em; }
  .pax-human-tag { color: #dbeafe; border-color: rgba(96, 165, 250, .85); background: #3974c5; }
  .pax-tabs { padding: 6px 8px 5px; background: transparent; }
  .pax-tab {
    min-height: 28px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: var(--pax-blue);
    background: transparent;
    text-align: left;
  }
  .pax-tab span { margin-right: 4px; color: currentColor; }
  .pax-tab[data-panel-tab="finance"] { color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"] { color: #cbd5e1; }
  .pax-tab.is-active {
    color: #f8fafc;
    border-bottom-color: var(--pax-gold);
    background: transparent;
    box-shadow: none;
  }
  .pax-tab[data-panel-tab="finance"].is-active { border-bottom-color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"].is-active { border-bottom-color: #94a3b8; }
  .pax-panel-section { padding: 12px 10px; }
  .pax-panel-heading { color: #f8fafc; font-size: 12px; letter-spacing: .02em; }
  .pax-panel-heading-icon { color: var(--pax-gold); }
  .pax-section-help {
    width: 17px;
    height: 17px;
    display: inline-grid;
    flex: 0 0 auto;
    margin-left: auto;
    place-items: center;
    border: 1px solid rgba(148, 163, 184, .55);
    border-radius: 50%;
    color: #cbd5e1;
    background: rgba(15, 23, 42, .65);
    font-size: 10px;
    font-weight: 900;
    cursor: help;
  }
  .pax-section-help:hover, .pax-section-help:focus-visible {
    border-color: var(--pax-gold);
    color: var(--pax-gold);
    outline: none;
  }
  .pax-tax-card, .pax-market-card, .pax-finance form, .pax-oi-card,
  .pax-event-log, .pax-action-slot, .pax-inspector-empty, .pax-tile-card {
    background: rgba(30, 41, 59, .78);
    border-color: var(--pax-border);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(2, 6, 23, .22);
  }
  .pax-formula-line, .pax-finance-note, .pax-oi-note, .pax-tax-note {
    color: #c0cad8;
  }
  .pax-formula-line strong, .pax-timer { color: var(--pax-gold); }
  .pax-resource:nth-child(2) .pax-resource-icon { color: #d5a548; }
  .pax-resource:nth-child(3) .pax-resource-icon { color: var(--pax-purple); }
  .pax-resource:nth-child(4) .pax-resource-icon { color: var(--pax-blue); }
  .pax-global-panel-button span:first-child { color: var(--pax-blue); }
  .pax-finance button, .pax-global-treaty button, .pax-global-treaty-form button,
  .pax-development button, .pax-action-button {
    background: rgba(30, 41, 59, .95);
    border-color: rgba(148, 163, 184, .38);
  }
  .pax-finance button[data-issue-bond],
  .pax-finance button[data-donate-world-bank],
  .pax-finance form button[type="submit"] {
    color: #b9f6c9;
    border-color: #5da477;
    background: rgba(31, 78, 55, .72);
  }
  .pax-finance button[data-issue-bond]:hover,
  .pax-finance button[data-donate-world-bank]:hover,
  .pax-finance form button[type="submit"]:hover {
    color: #dcffe4;
    background: rgba(49, 112, 77, .92);
  }
  .pax-oi-tag, .pax-oi-card { color: var(--pax-purple); border-color: rgba(167, 139, 218, .48); }
  .pax-oi-tag { background: rgba(91, 63, 135, .28); }
  .pax-oi-controls button { color: #d7c6f4; border-color: rgba(167, 139, 218, .55); background: rgba(91, 63, 135, .35); }
  .pax-finance input, .pax-finance select, .pax-oi-controls select,
  .pax-oi-controls input, .pax-global-treaty-form select, .pax-tile-quantity input {
    color: #f1f5f9;
    background: rgba(15, 23, 42, .82);
    border-color: rgba(148, 163, 184, .38);
  }
  .pax-finance input:focus, .pax-finance select:focus, .pax-oi-controls select:focus,
  .pax-oi-controls input:focus, .pax-global-treaty-form select:focus {
    border-color: var(--pax-gold);
    box-shadow: 0 0 0 2px rgba(245, 182, 46, .16);
  }
  .pax-event-log { color: #d1d9e6; }
  .pax-dialog, .pax-menu-card, .pax-start-card {
    background: rgba(15, 25, 42, .98);
    border-color: var(--pax-border);
  }
  .pax-market-card {
    display: grid;
    gap: 18px;
    padding: 18px;
    border: 1px solid rgba(121, 167, 242, .5);
    background: rgba(22, 35, 57, .84);
  }
  .pax-market-card::before {
    content: "Compra: 3 Plata   |   Vende: 1 Plata / Material";
    color: #b7c4d8;
    font-size: 11px;
    letter-spacing: .02em;
  }
  .pax-market-quantity {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 38px 58px;
    align-items: center;
    gap: 7px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(148, 163, 184, .24);
  }
  .pax-market-quantity button, .pax-market-quantity output {
    min-height: 34px;
    display: grid;
    place-items: center;
    padding: 5px;
    border: 1px solid rgba(148, 163, 184, .4);
    border-radius: 6px;
    color: #e2e8f0;
    background: rgba(15, 23, 42, .75);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }
  .pax-market-quantity output {
    border-color: rgba(121, 167, 242, .45);
    font-size: 15px;
  }
  .pax-market-quantity input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .pax-market-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pax-market-actions button {
    min-height: 46px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 900;
  }
  .pax-market-actions button[data-market-action="BUY_MATERIALS"] {
    color: #061b12;
    border-color: #4fc98b;
    background: #35bd80;
  }
  .pax-market-actions button[data-market-action="SELL_MATERIALS"] {
    color: #241703;
    border-color: #e9aa31;
    background: #e9a719;
  }
  .pax-market-actions button:hover { filter: brightness(1.12); }
  .pax-bank-card {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid rgba(148, 163, 184, .28);
    border-radius: 8px;
    background: rgba(30, 41, 59, .66);
  }
  .pax-bank-card[hidden] { display: none; }
  .pax-bank-actions { grid-template-columns: 1fr 1fr; }
  .pax-bank-actions button { min-height: 36px; }
  .pax-repayment-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
  .pax-repayment-row input { min-width: 0; }
  .pax-finance-debt { display: grid; gap: 5px; margin: 0; }
  .pax-finance-debt small { color: #a7b3c7; }
  .pax-oi-card { display: grid; gap: 10px; }
  .pax-oi-tag { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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

function formatEventTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export class GameScreen {
  constructor(container) {
    this.container = container;
    this.map = null;
    this.inspector = null;
    this.globalPanel = null;
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
    this.displayedResourceValues = null;
    this.resourceAnimationFrame = null;
    this.lastAnimatedResolutionId = 0;
    this.stageOverlayTimer = null;
    this.roomCode = 'room-1';
    this.lobby = null;
    this.lobbyState = null;
    this.lobbyError = '';
    this.serverJoinedRoom = null;
    this.autoStartPending = false;

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
            <div id="room-menu">
              <h1>El mundo espera tus órdenes</h1>
              <div class="pax-start-options">
                <section class="pax-start-option">
                  <h2>Un jugador</h2>
                  <p>Juega una partida contra países controlados por la IA.</p>
                  <div class="pax-profile-fields">
                    <label>Nombre <input id="single-player-name" maxlength="24" value="alpha" autocomplete="off" /></label>
                    <label>Color <div class="pax-color-picker" id="single-player-color" role="radiogroup" aria-label="Color del país"></div></label>
                  </div>
                  <button class="pax-start-button" id="single-player-button" type="button">Nueva partida</button>
                </section>
                <section class="pax-start-option">
                  <h2>Multijugador</h2>
                  <p>Crea una sala o únete con un código de seis caracteres.</p>
                  <div class="pax-room-actions">
                    <button class="pax-start-button" id="create-room-button" type="button">Crear sala</button>
                    <div class="pax-join-room">
                      <label for="room-code-input">Código de sala</label>
                      <div class="pax-join-room-row">
                        <input id="room-code-input" maxlength="6" autocomplete="off" placeholder="PAX123" />
                        <button class="pax-start-button" id="join-room-button" type="button">Unirse</button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div id="lobby-view" hidden>
              <h1>Sala <strong id="lobby-code"></strong></h1>
              <div class="pax-lobby-code-row">
                <button class="pax-lobby-copy" id="copy-room-code" type="button">Copiar código</button>
                <span id="lobby-count">Jugadores conectados: 0 / 4</span>
              </div>
              <div class="pax-lobby-profile">
                <label>Nombre <input id="lobby-player-name" maxlength="24" autocomplete="off" /></label>
                <label>Color <div class="pax-color-picker" id="lobby-player-color" role="radiogroup" aria-label="Color del país"></div></label>
                <button class="pax-lobby-copy" id="save-lobby-profile" type="button">Guardar</button>
              </div>
              <div class="pax-lobby-slots" id="lobby-slots"></div>
              <button class="pax-start-button" id="start-room-button" type="button" hidden>Jugar</button>
              <button class="pax-lobby-copy" id="leave-lobby-button" type="button">Volver al menú principal</button>
            </div>
            <p class="pax-start-status" id="start-status" role="status">Configura Firebase para crear o unirte a salas.</p>
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
            <button class="pax-force-button" id="force-phase-button" type="button" disabled title="La fase termina cuando todos los jugadores humanos confirman que están listos">⏩ Forzar</button>
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
            <button id="game-summary-replay" type="button">Volver a jugar</button>
            <button id="game-summary-menu" type="button">Ir al menú principal</button>
          </div>
        </dialog>
      </div>
    `;

    const taxEl = this.container.querySelector('#tax-container');
    this.inspector = new Inspector(this.container.querySelector('#inspector-container'));
    this.map = new Map(this.container.querySelector('#map-container'), (tile) => this.handleTileSelection(tile));
    requestAnimationFrame(() => this.map.fitToPanel());
    this.chat = new Chat(this.container.querySelector('#chat-container'), {
      onSend: (message) => this.lobby?.sendChatMessage(message)
    });
    this.chat.setEnabled(false);
    this.container.querySelector('#chat-container').addEventListener('chaterror', (event) => {
      this.showToast(event.detail?.message || 'No se pudo enviar el mensaje.', 'error');
    });
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'pax-toasts';
    this.toastContainer.id = 'toast-container';
    this.toastContainer.setAttribute('aria-live', 'polite');
    this.toastContainer.setAttribute('aria-atomic', 'true');
    this.container.querySelector('#map-container').appendChild(this.toastContainer);
    this.tooltipLayer = document.createElement('div');
    this.tooltipLayer.className = 'pax-tooltip-layer';
    this.tooltipLayer.setAttribute('role', 'tooltip');
    document.body.appendChild(this.tooltipLayer);
    this.globalPanel = new GlobalPanel(this.container.querySelector('#global-panel-container'), {
      onProposeTreaty: (treaty) => {
        socket.emit(PROTOCOL.PROPOSE_TREATY, {
          roomId: this.roomCode,
          treaty
        });
        this.showToast('Propuesta diplomática enviada.', 'info');
      },
      onRespondToTreaty: ({ offerId, accepted }) => socket.emit(PROTOCOL.RESPOND_TO_TREATY, {
        roomId: this.roomCode,
        offerId,
        accepted
      }),
      onCancelTreatyOffer: (offerId) => socket.emit(PROTOCOL.CANCEL_TREATY_OFFER, {
        roomId: this.roomCode,
        offerId
      })
    });
    this.financePanel = new FinancePanel(
      this.container.querySelector('#finance-panel'),
      (action) => {
        socket.timeout(5000).emit(
          PROTOCOL.FINANCIAL_ACTION,
          { roomId: this.roomCode, action },
          (error, result) => {
            this.financePanel.setStatus(error
              ? 'El servidor no respondió; comprueba la conexión e inténtalo otra vez.'
              : result?.message || 'No se pudo completar la operación financiera.');
            this.showToast(
              error || !result?.ok ? (error || result?.message || 'No se pudo completar la operación financiera.') : result.message,
              error || !result?.ok ? 'error' : ['BUY_MATERIALS', 'SELL_MATERIALS', 'REPAY_BOND'].includes(action.type) ? 'success' : 'info'
            );
          }
        );
      }
    );
    this.container.querySelector('#finance-debt-panel').append(
      this.container.querySelector('#finance-debt-content')
    );
    this.taxSlider = new TaxSlider(taxEl, (newTaxRate) => {
      this.updateTaxMetrics(newTaxRate);
      socket.emit(PROTOCOL.SET_TAX_RATE, { roomId: this.roomCode, taxRate: newTaxRate });
    });
    this.updateTaxMetrics(this.taxSlider.currentValue);
    this.bindEvents();
    this.addEvent('Esperando actividad de la partida.');
    this.populateColorSelectors();
    this.setupLobby();
  }

  bindEvents() {
    this.container.addEventListener('pointerover', (event) => {
      const target = event.target.closest?.('[data-tooltip]');
      if (target) this.showTooltip(target);
    });
    this.container.addEventListener('pointerout', (event) => {
      const target = event.target.closest?.('[data-tooltip]');
      if (target && !target.contains(event.relatedTarget)) this.hideTooltip();
    });
    this.container.addEventListener('focusin', (event) => {
      if (event.target.matches?.('[data-tooltip]')) this.showTooltip(event.target);
    });
    this.container.addEventListener('focusout', (event) => {
      if (event.target.matches?.('[data-tooltip]')) this.hideTooltip();
    });
    this.tooltipPointerMove = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target?.matches?.('[data-tooltip]')) {
        if (target !== this.tooltipTarget) this.showTooltip(target);
      } else if (this.tooltipTarget && !this.tooltipTarget.matches(':focus')) {
        this.hideTooltip();
      }
    };
    document.addEventListener('pointermove', this.tooltipPointerMove);
    this.tooltipViewportChange = () => {
      if (this.tooltipTarget) this.showTooltip(this.tooltipTarget);
    };
    window.addEventListener('resize', this.tooltipViewportChange);
    window.addEventListener('scroll', this.tooltipViewportChange, true);
    this.container.querySelector('.pax-tabs').addEventListener('click', (event) => {
      const tab = event.target.closest?.('[data-panel-tab]');
      if (!tab) return;
      const selected = tab.dataset.panelTab;
      for (const button of this.container.querySelectorAll('[data-panel-tab]')) {
        const active = button === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      }
      for (const panel of this.container.querySelectorAll('.pax-tab-panel')) {
        panel.hidden = panel.id !== `${selected}-tab`;
      }
    });
    this.container.addEventListener('click', (event) => {
      const button = event.target.closest?.('button');
      if (button && !button.disabled) this.playButtonClick();
    }, true);

    this.onConnect = () => {
      this.startPending = false;
      this.startError = '';
      this.connectionError = '';
      this.container.querySelector('#single-player-button').disabled = false;
      if (!this.lobby?.enabled) this.joinGame();
      this.updateStartMenu();
    };
    this.onDisconnect = () => {
      this.startPending = false;
      this.startError = 'Se perdió la conexión con el servidor. Reconectando…';
      this.connectionError = '';
      this.container.querySelector('#single-player-button').disabled = true;
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
      this.showToast(message, 'error');
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
      this.returnToMainMenu();
    });
    this.container.querySelector('#force-phase-button').addEventListener('click', () => {
      if (!socket.connected || this.gameState?.currentStage !== GAME_STAGES.PLANNING) return;
      socket.emit(PROTOCOL.READY_PHASE_END, {
        roomId: this.roomCode,
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

    this.container.querySelector('#create-room-button').addEventListener('click', () => {
      this.createRoom();
    });
    this.container.querySelector('#single-player-button').addEventListener('click', () => {
      this.startSinglePlayer();
    });
    this.container.querySelector('#join-room-button').addEventListener('click', () => {
      this.joinRoom(this.container.querySelector('#room-code-input').value);
    });
    this.container.querySelector('#room-code-input').addEventListener('input', (event) => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });
    this.container.querySelector('#copy-room-code').addEventListener('click', async () => {
      await this.copyRoomCode();
    });
    this.container.querySelector('#start-room-button').addEventListener('click', () => {
      this.startRoom();
    });
    this.container.querySelector('#save-lobby-profile').addEventListener('click', () => {
      this.saveLobbyProfile();
    });
    this.container.querySelector('#leave-lobby-button').addEventListener('click', () => {
      this.returnToMainMenu();
    });

    this.container.querySelector('#global-panel-open').addEventListener('click', () => {
      this.container.querySelector('#global-panel-dialog').showModal();
    });
    this.container.querySelector('#global-panel-close').addEventListener('click', () => {
      this.container.querySelector('#global-panel-dialog').close();
    });
    this.container.querySelector('#game-summary-replay').addEventListener('click', () => {
      if (!socket.connected || !this.gameState?.gameOver) return;
      const button = this.container.querySelector('#game-summary-replay');
      button.disabled = true;
      socket.timeout(5000).emit(
        PROTOCOL.RESTART_GAME,
        { roomId: this.roomCode },
        (error, result) => {
          if (error || !result?.ok) {
            button.disabled = false;
            this.addEvent(`No se pudo iniciar otra partida: ${result?.message || 'el servidor no respondió.'}`);
          }
        }
      );
    });
    this.container.querySelector('#game-summary-menu').addEventListener('click', () => {
      if (!socket.connected || !this.gameState?.gameOver) return;
      this.returnToMainMenu();
    });
    this.container.querySelector('#taxInput').addEventListener('input', (event) => {
      this.container.querySelector('#tax-value').textContent = `${Math.round(Number(event.target.value) * 100)}%`;
    });

    const oiCard = this.container.querySelector('.pax-oi-card');
    oiCard.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'oi-propose') {
        this.handleOIProposal();
        this.showToast('Propuesta enviada a la OI.', 'info');
      }
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

  showToast(message, type = 'info') {
    if (!message || !this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'pax-toast';
    toast.dataset.type = type;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 240);
    }, 3000);
  }

  showTooltip(target) {
    const text = target?.dataset.tooltip;
    if (!text || !this.tooltipLayer) return;
    this.tooltipLayer.textContent = text;
    this.tooltipLayer.classList.remove('is-visible');
    this.tooltipLayer.style.left = '0px';
    this.tooltipLayer.style.top = '0px';
    this.tooltipLayer.style.visibility = 'hidden';
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipLayer.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    let left = targetRect.left + ((targetRect.width - tooltipRect.width) / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    const fitsAbove = targetRect.top >= tooltipRect.height + gap + margin;
    const top = fitsAbove
      ? targetRect.top - tooltipRect.height - gap
      : Math.min(
        window.innerHeight - tooltipRect.height - margin,
        targetRect.bottom + gap
      );
    this.tooltipLayer.style.left = `${left}px`;
    this.tooltipLayer.style.top = `${Math.max(margin, top)}px`;
    this.tooltipLayer.style.visibility = 'visible';
    this.tooltipLayer.classList.add('is-visible');
    this.tooltipTarget = target;
  }

  hideTooltip() {
    if (!this.tooltipLayer) return;
    this.tooltipLayer.classList.remove('is-visible');
    this.tooltipTarget = null;
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
        roomId: this.roomCode,
        paused: shouldOpen
      });
    }
  }

  updateTaxMetrics(taxRate) {
    const growth = taxRate > 0 ? 1 / (100 * taxRate) : 0;
    this.container.querySelector('#tax-value').textContent = `${Math.round(taxRate * 100)}%`;
    this.container.querySelector('#growth-value').textContent = `+${(growth * 100).toFixed(2)}%`;
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
    this.container.querySelector('#forecast-revenue-value').textContent = formatValue(
      Math.floor(forecastPopulation * taxRate)
    );
  }

  updateDisabledTooltips(stage) {
    const planning = stage === GAME_STAGES.PLANNING;
    const reason = planning ? 'Requisito de recursos no cumplido' : 'Acción bloqueada fuera de la planificación';
    for (const element of this.container.querySelectorAll('button:disabled, input:disabled, select:disabled')) {
      if (element.id === 'play-button') element.dataset.tooltip = 'Esperando conexión con la partida';
      else if (element.id === 'single-player-button') element.dataset.tooltip = 'Esperando conexión con la partida';
      else if (element.matches('#create-room-button, #join-room-button')) element.dataset.tooltip = 'Firebase no está disponible';
      else if (element.matches('[data-issue-bond]')) element.dataset.tooltip = planning
        ? 'Ya tienes un bono pendiente'
        : 'Acción bloqueada fuera de la planificación';
      else if (element.matches('[data-donate-world-bank]')) element.dataset.tooltip = planning
        ? 'Requiere 15 Plata'
        : 'Acción bloqueada fuera de la planificación';
      else if (element.matches('[data-market-action], [data-quantity-adjust], [data-quantity-max]')) element.dataset.tooltip = planning
        ? reason
        : 'Mercado suspendido durante la ronda de OI o la resolución';
      else if (element.matches('[data-repay-bond], [data-bond-amount]')) element.dataset.tooltip = planning
        ? 'Requiere saldo de Plata para pagar la deuda'
        : 'Pago bloqueado fuera de la planificación';
      else if (element.matches('#oi-propose')) element.dataset.tooltip = planning
        ? 'Requiere 2 de Influencia'
        : 'Propuesta bloqueada fuera de la reunión de la OI';
      else if (element.matches('#oi-submit-vote')) element.dataset.tooltip = 'Solo puedes votar durante una sesión activa de la OI';
      else if (element.matches('#force-phase-button')) element.dataset.tooltip = 'La planificación termina cuando todos los jugadores están listos';
      else element.dataset.tooltip ||= 'Acción no disponible en este momento';
    }
  }

  updateGameState(gameState) {
    if (!gameState) return;
    this.gameState = gameState;
    const phase = gameState.currentPhase || 1;
    const stage = gameState.currentStage || this.getStageFromLegacyPhase(phase);
    if (stage !== GAME_STAGES.PLANNING) this.pendingMoveSource = null;
    this.map.setDemilitarizedZones(gameState.activeDmzZones || [], false);

    const players = Array.isArray(gameState.players) ? gameState.players : [];
    this.map.setNationColors(players);
    this.inspector.setNationColors(players);
    this.map.render(gameState.grid);
    this.player = players.find((player) => (
      player.boundPlayerId === this.playerId || player.socketId === socket.id
    )) || null;
    this.chat.setIdentity(this.player);
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
    this.globalPanel.update(gameState, this.player?.id);
    this.financePanel.update({ ...gameState, currentStage: stage }, this.player?.id);
    this.updateDisabledTooltips(stage);

    const round = gameState.oiSession?.phase === 'voting'
      ? gameState.oiSession.meetingAfterRound
      : gameState.currentRound || 1;
    const roundEl = this.container.querySelector('#round-value');
    roundEl.textContent = `${round}/${MAX_ROUNDS}`;
    this.container.querySelector('#timer-value').textContent = `${gameState.timeRemaining ?? 60}s${gameState.isPaused ? ' · Pausado' : ''}`;
    this.container.querySelector('#phase-value').textContent = STAGE_LABELS[stage] || 'En curso';
    this.updateStageOverlay(stage);
    const nextMeetingRound = Math.max(5, Math.ceil(round / 5) * 5);
    this.container.querySelector('#next-vote').textContent = gameState.oiSession?.phase === 'voting'
      ? `En curso · ronda ${round}`
      : `Ronda ${nextMeetingRound}`;
    this.container.querySelector('#oi-session-badge').textContent = gameState.oiSession?.phase === 'voting'
      ? `Sesión activa · Ronda ${round}`
      : `Próxima sesión: Ronda ${nextMeetingRound}`;
    this.updateOIPanel(gameState, round);
    this.updateNationPanel();
    this.updateResources(
      stage === GAME_STAGES.ROUND_START || stage === GAME_STAGES.CLOSING
    );
    this.taxSlider.setEnabled(Boolean(this.player && stage === GAME_STAGES.PLANNING && !gameState.gameOver));
    this.syncGameEventHistory(gameState.eventHistory);
    this.updateGameSummary(gameState);

    if (this.player && Number.isFinite(this.player.taxRate)) {
      this.taxSlider.setValue(this.player.taxRate);
      this.updateTaxMetrics(this.player.taxRate);
    } else {
      this.updateTaxMetrics(this.taxSlider.currentValue);
    }

    if (
      stage === GAME_STAGES.CLOSING
      && gameState.actionResolutionId !== this.lastAnimatedResolutionId
    ) {
      this.lastAnimatedResolutionId = gameState.actionResolutionId;
      this.map.animateTroopMovements(gameState.lastActionResolutions || []);
    }
  }

  getStageFromLegacyPhase(phase) {
    if (phase === 1) return GAME_STAGES.ROUND_START;
    if (phase === 2) return GAME_STAGES.PLANNING;
    if (phase === 3) return GAME_STAGES.RESOLVING;
    if (phase === 4 || phase === 5) return GAME_STAGES.CLOSING;
    return GAME_STAGES.INTERNATIONAL_MEETING;
  }

  updateStageOverlay(stage) {
    const overlay = this.container.querySelector('#stage-overlay');
    const message = this.container.querySelector('#stage-overlay-message');
    if (!overlay || !message) return;
    if (this.stageOverlayTimer) {
      clearTimeout(this.stageOverlayTimer);
      this.stageOverlayTimer = null;
    }
    overlay.hidden = true;
    if (stage !== GAME_STAGES.RESOLVING) return;
    message.textContent = STAGE_LABELS[stage];
    this.stageOverlayTimer = setTimeout(() => {
      if (this.gameState?.currentStage === GAME_STAGES.RESOLVING) overlay.hidden = false;
      this.stageOverlayTimer = null;
    }, STAGE_TIMINGS.RESOLUTION_LOADING_THRESHOLD_MS);
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
      && !gameState.gameOver
      && gameState.currentStage === GAME_STAGES.PLANNING;
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
      roomId: this.roomCode,
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
    socket.emit(PROTOCOL.SUBMIT_OI_VOTE, { roomId: this.roomCode, ballot });
  }

  updateForcePhaseButton(players, phase, gameStarted) {
    const button = this.container.querySelector('#force-phase-button');
    if (!button) return;
    const participants = players;
    const readyCount = participants.filter((player) => player.phaseReady).length;
    const requiredCount = participants.length;
    const canForce = Boolean(
      gameStarted
      && !this.gameState?.gameOver
      && this.player
      && (this.gameState?.currentStage || this.getStageFromLegacyPhase(phase)) === GAME_STAGES.PLANNING
    );
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
    const canPlan = Boolean(
      this.player
      && !this.gameState?.gameOver
      && (this.gameState?.currentStage || this.getStageFromLegacyPhase(this.gameState?.currentPhase || 1))
        === GAME_STAGES.PLANNING
    );
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
      roomId: this.roomCode,
      action: { type: 'PLAN_ACTION', slot, plannedAction }
    });
  }

  updateStartMenu(gameStarted = this.gameState?.gameStarted) {
    const menu = this.container.querySelector('#start-menu');
    if (!menu) return;
    menu.hidden = Boolean(gameStarted && socket.connected);
    const status = this.container.querySelector('#start-status');
    if (!status) return;
    if (this.lobby?.enabled && !this.lobbyState) {
      this.setStartStatus(socket.connected
        ? 'Crea una sala o introduce un código para unirte.'
        : 'Conectando con el servidor…');
      return;
    }
    if (gameStarted) {
      this.startPending = false;
      status.textContent = 'Partida iniciada.';
      return;
    }

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

  updateGameSummary(gameState) {
    const dialog = this.container.querySelector('#game-summary-dialog');
    const replayButton = this.container.querySelector('#game-summary-replay');
    if (!dialog || !replayButton) return;

    if (!gameState.gameOver) {
      if (dialog.open) dialog.close();
      replayButton.disabled = false;
      return;
    }

    const rankings = getPlayerRankings(gameState);
    const winner = rankings[0]?.player;
    this.container.querySelector('#game-summary-content').innerHTML = `
      <h2 id="game-summary-title">Partida finalizada</h2>
      <p>Ronda ${gameState.currentRound} de ${MAX_ROUNDS}${winner ? ` · País ganador: <strong>${escapeHTML(winner.name)}</strong>` : ''}</p>
    `;
    this.container.querySelector('#game-summary-rankings').innerHTML = rankings.map((entry, index) => {
      const { player } = entry;
      const color = /^#[0-9a-f]{6}$/i.test(player.color || '') ? player.color : '#2563eb';
      return `
        <tr style="--score-nation-color:${color}" class="${player.id === this.player?.id ? 'is-local-player' : ''}">
          <th><span class="pax-score-rank">${index + 1}</span>${escapeHTML(player.name || 'País')}</th>
          <td>${player.isBot ? 'Bot' : 'Humano'}</td>
          <td>${formatValue(entry.ownedTiles.length)}</td>
          <td>${formatValue(entry.population)}</td>
          <td>${formatValue(entry.troops)}</td>
          <td>${formatValue(entry.cities)}</td>
          <td>${formatValue(entry.factories)}</td>
          <td>${formatValue((player.taxRate || 0) * 100)}%</td>
          <td>${formatValue(entry.silver)}</td>
          <td>${formatValue(entry.materials)}</td>
          <td>${formatValue(entry.influence)}</td>
          <td class="pax-score-total">${formatValue(entry.total)}</td>
        </tr>
      `;
    }).join('');
    if (!dialog.open) dialog.showModal();
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
    if (this.gameState?.currentStage !== GAME_STAGES.PLANNING || !this.player) return;
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
        roomId: this.roomCode,
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

  updateResources(animate = false) {
    const resources = this.player?.resources;
    const silver = typeof resources === 'number'
      ? resources
      : resources?.SILVER ?? resources?.BASIC;
    const materials = this.player?.materials ?? resources?.MATERIALS;
    const influence = this.player?.influence ?? resources?.INFLUENCE;
    const ownedTiles = (this.gameState?.grid || []).flat().filter((tile) => tile.ownerId === this.player?.id);
    const population = ownedTiles.reduce((sum, tile) => sum + (tile.population || 0), 0);
    const target = { silver, materials, influence, population };
    if (!animate || !this.displayedResourceValues) {
      this.displayedResourceValues = target;
      this.renderResourceValues(target);
      return;
    }
    const start = this.displayedResourceValues;
    this.animateResourceValues(start, target);
  }

  renderResourceValues(values) {
    this.container.querySelector('#silver-value').textContent = formatValue(values.silver);
    this.container.querySelector('#materials-value').textContent = formatValue(values.materials);
    this.container.querySelector('#influence-value').textContent = formatValue(values.influence);
    this.container.querySelector('#population-value').textContent = formatValue(values.population);
  }

  animateResourceValues(start, target) {
    if (this.resourceAnimationFrame) cancelAnimationFrame(this.resourceAnimationFrame);
    const startedAt = performance.now();
    const duration = 1100;
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const values = Object.fromEntries(Object.keys(target).map((key) => [
        key,
        start[key] + (target[key] - start[key]) * eased
      ]));
      this.displayedResourceValues = values;
      this.renderResourceValues(values);
      if (progress < 1) {
        this.resourceAnimationFrame = requestAnimationFrame(step);
      } else {
        this.resourceAnimationFrame = null;
        this.displayedResourceValues = target;
      }
    };
    this.resourceAnimationFrame = requestAnimationFrame(step);
  }

  syncGameEventHistory(history = []) {
    const savedScrollTop = this.container.querySelector('#event-log')?.scrollTop || 0;
    this.events = [
      ...this.localEvents,
      ...history.slice().reverse().map((event) => ({
        message: event.message,
        timestamp: event.timestamp
      }))
    ];
    this.renderEventHistory(savedScrollTop);
  }

  addEvent(message) {
    const event = { message, timestamp: Date.now() };
    this.localEvents.unshift(event);
    this.events.unshift(event);
    this.renderEventHistory(0);
  }

  renderEventHistory(scrollTop) {
    const log = this.container.querySelector('#event-log');
    if (log) {
      log.innerHTML = this.events
        .map((entry) => {
          const event = typeof entry === 'string' ? { message: entry } : entry;
          return `<div class="pax-event-entry"><time>${formatEventTime(event.timestamp)}</time> › ${escapeHTML(event.message)}</div>`;
        })
        .join('');
      log.scrollTop = scrollTop;
    }
  }

  populateColorSelectors() {
    const options = AVAILABLE_NATION_COLORS.map((color) => (
      `<button class="pax-color-choice" type="button" data-color="${color}" style="background:${color}" aria-label="Seleccionar color ${color}" aria-checked="false" role="radio"></button>`
    )).join('');
    for (const picker of this.container.querySelectorAll('.pax-color-picker')) {
      picker.innerHTML = options;
      picker.addEventListener('click', (event) => {
        const choice = event.target.closest('[data-color]');
        if (!choice) return;
        this.selectNationColor(picker, choice.dataset.color);
        if (picker.id === 'lobby-player-color') {
          this.updateColorAvailability(this.lobbyState?.slots
            ?.filter((player) => player?.id !== this.playerId)
            .map((player) => player?.color) || []);
        }
      });
    }
    this.selectNationColor(this.container.querySelector('#single-player-color'), AVAILABLE_NATION_COLORS[0]);
    this.selectNationColor(this.container.querySelector('#lobby-player-color'), AVAILABLE_NATION_COLORS[0]);
  }

  selectNationColor(picker, color) {
    if (!picker || !AVAILABLE_NATION_COLORS.includes(color)) return;
    for (const choice of picker.querySelectorAll('[data-color]')) {
      const selected = choice.dataset.color === color;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-checked', String(selected));
    }
  }

  getSelectedNationColor(id) {
    return this.container.querySelector(`#${id} .is-selected`)?.dataset.color;
  }

  updateColorAvailability(usedColors = []) {
    const used = new Set(usedColors.filter(Boolean));
    const ownColor = this.getSelectedNationColor('lobby-player-color');
    for (const choice of this.container.querySelectorAll('#lobby-player-color [data-color]')) {
      const occupied = used.has(choice.dataset.color) && choice.dataset.color !== ownColor;
      choice.disabled = occupied;
      choice.setAttribute('aria-disabled', String(occupied));
      choice.title = occupied ? 'Este color ya está siendo usado' : 'Seleccionar color';
    }
  }

  normalizeNationName(name) {
    return LEGACY_NATION_NAMES.get(name) || name;
  }

  setupLobby() {
    this.playerId = localStorage.getItem('pax_player_id');
    if (!this.playerId) {
      this.playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('pax_player_id', this.playerId);
    }

    this.lobby = new FirebaseLobby({
      playerId: this.playerId,
      playerName: 'alpha',
      onChange: (room) => this.handleLobbyChange(room),
      onChatMessage: (message) => this.chat.addMessage(message),
      onError: (error) => {
        this.lobbyError = error.message;
        this.setStartStatus(error.message);
      }
    });
    const buttons = this.container.querySelectorAll('#create-room-button, #join-room-button');
    buttons.forEach((button) => { button.disabled = !this.lobby.enabled; });
    this.container.querySelector('#single-player-button').disabled = !socket.connected;
    if (!this.lobby.enabled) {
      this.setStartStatus('Completa PAX_FIREBASE_CONFIG en client/index.html para usar salas.');
      return;
    }
    if (socket.connected) this.updateStartMenu();
  }

  async createRoom() {
    await this.enterLobby(() => this.lobby.createRoom());
  }

  startSinglePlayer() {
    if (!socket.connected) return;
    this.chat.setEnabled(false);
    const name = this.container.querySelector('#single-player-name').value.trim();
    const color = this.getSelectedNationColor('single-player-color');
    if (!name) {
      this.setStartStatus('El nombre del país no puede estar vacío.');
      return;
    }
    this.roomCode = 'room-1';
    this.startPending = true;
    this.setStartStatus('Iniciando la partida…');
    socket.emit(PROTOCOL.JOIN_GAME, {
      playerId: this.playerId,
      playerName: name,
      playerColor: color,
      roomId: this.roomCode
    });
    socket.timeout(5000).emit(
      PROTOCOL.START_GAME,
      { roomId: this.roomCode },
      (error, result) => {
        if (error || !result?.ok) {
          this.startPending = false;
          this.startError = result?.message || 'No se pudo iniciar la partida.';
          this.updateStartMenu();
        }
      }
    );
  }

  async joinRoom(code) {
    await this.enterLobby(() => this.lobby.joinRoom(code));
  }

  async enterLobby(operation) {
    if (!this.lobby?.enabled) return;
    this.chat.setEnabled(true);
    this.setStartStatus('Conectando con la sala…');
    this.setRoomControlsEnabled(false);
    try {
      await operation();
    } catch (error) {
      this.setStartStatus(error.message);
      this.setRoomControlsEnabled(true);
    }
  }

  setRoomControlsEnabled(enabled) {
    this.container
      .querySelectorAll('#create-room-button, #join-room-button')
      .forEach((button) => { button.disabled = !enabled; });
  }

  handleLobbyChange(room) {
    if (this.roomCode !== room.code) this.chat.clear();
    this.lobbyState = room;
    this.roomCode = room.code;
    const humanCount = room.slots.filter((player) => player?.tipo === 'humano').length;
    this.container.querySelector('#room-menu').hidden = true;
    this.container.querySelector('#lobby-view').hidden = false;
    this.container.querySelector('#lobby-code').textContent = room.code;
    this.container.querySelector('#lobby-count').textContent = `Jugadores conectados: ${humanCount} / 4`;
    const ownSlot = room.slots.find((player) => player?.id === this.playerId);
    const nameInput = this.container.querySelector('#lobby-player-name');
    const colorInput = this.container.querySelector('#lobby-player-color');
    if (ownSlot) {
      nameInput.value = this.normalizeNationName(ownSlot.nombre || 'alpha');
      this.selectNationColor(colorInput, ownSlot.color || AVAILABLE_NATION_COLORS[0]);
    }
    this.updateColorAvailability(room.slots
      .filter((player) => player?.id !== this.playerId)
      .map((player) => player?.color));
    this.container.querySelector('#lobby-slots').innerHTML = room.slots.map((player, index) => `
      <div class="pax-lobby-slot">
        <strong>Ranura ${index + 1}:</strong>
        ${player
          ? `<span style="color:${/^#[0-9A-Fa-f]{6}$/.test(player.color || '') ? player.color : '#cbd5e1'}">●</span> ${escapeHTML(this.normalizeNationName(player.nombre || NATIONS[index]?.name || 'alpha'))} <span>(${player.tipo === 'bot' ? 'Bot' : player.listo ? 'Listo' : 'Preparado'})</span>`
          : 'Esperando jugador…'}
      </div>
    `).join('');
    const startButton = this.container.querySelector('#start-room-button');
    const ownReady = Boolean(ownSlot?.listo);
    startButton.hidden = room.estado !== 'esperando' || !ownSlot;
    startButton.disabled = ownReady;
    startButton.textContent = ownReady ? 'Esperando jugadores…' : 'Jugar';
    if (room.estado === 'en_juego') {
      this.setStartStatus('Partida iniciada. Cargando el mapa…');
      if (socket.connected && this.serverJoinedRoom !== room.code) {
        this.serverJoinedRoom = room.code;
        this.joinGame();
        socket.timeout(5000).emit(PROTOCOL.START_GAME, { roomId: this.roomCode });
      }
    } else {
      this.setStartStatus(ownReady
        ? 'Esperando a que todos los jugadores pulsen Jugar…'
        : 'Edita tu país y pulsa Jugar cuando estés listo.');
    }
  }

  async startRoom() {
    try {
      await this.lobby.startGame();
    } catch (error) {
      this.setStartStatus(error.message);
    }
  }

  async saveLobbyProfile() {
      const name = this.normalizeNationName(this.container.querySelector('#lobby-player-name').value.trim());
      const color = this.getSelectedNationColor('lobby-player-color');
      if (!name) {
        this.setStartStatus('El nombre del país no puede estar vacío.');
        return;
      }
      try {
        await this.lobby.updateProfile({ name, color });
        this.joinGame();
        this.setStartStatus('Perfil actualizado. Pulsa Jugar cuando estés listo.');
      } catch (error) {
        this.setStartStatus(error.message);
      }
    }

  async copyRoomCode() {
    if (!this.roomCode) {
      this.setStartStatus('No hay un código de sala disponible.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.roomCode);
      } else {
        const input = document.createElement('textarea');
        input.value = this.roomCode;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('El navegador rechazó el copiado.');
      }
      this.setStartStatus(`Código ${this.roomCode} copiado.`);
    } catch (error) {
      this.setStartStatus(`No se pudo copiar automáticamente. Código: ${this.roomCode}`);
      this.showToast(error.message, 'error');
    }
  }

  async returnToMainMenu() {
    const roomCode = this.roomCode;
    if (this.serverJoinedRoom === roomCode && socket.connected) {
      socket.emit(PROTOCOL.END_GAME, { roomId: roomCode });
    }

    try {
      await this.lobby?.leaveRoom();
    } catch (error) {
      this.setStartStatus(`No se pudo salir de la sala: ${error.message}`);
      return;
    }

    this.chat.setEnabled(false);
    this.container.querySelector('#game-summary-dialog')?.close();
    this.setGameMenuOpen(false);
    this.lobbyState = null;
    this.lobbyError = '';
    this.gameState = null;
    this.player = null;
    this.roomCode = null;
    this.serverJoinedRoom = null;
    this.startPending = false;
    this.startError = '';
    this.container.querySelector('#start-menu').hidden = false;
    this.container.querySelector('#room-menu').hidden = false;
    this.container.querySelector('#lobby-view').hidden = true;
    this.container.querySelector('#room-code-input').value = '';
    this.setRoomControlsEnabled(Boolean(this.lobby?.enabled));
    this.setStartStatus('Crea una sala o introduce un código para unirte.');
  }

  setStartStatus(message) {
    const status = this.container.querySelector('#start-status');
    if (status) status.textContent = message;
  }

  joinGame() {
    if (!socket.connected || !this.roomCode) return;
    this.playerId = localStorage.getItem('pax_player_id');
    if (!this.playerId) {
      this.playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('pax_player_id', this.playerId);
    }
    const profileName = this.container.querySelector('#lobby-player-name')?.value.trim();
    const profileColor = this.getSelectedNationColor('lobby-player-color');
    const lobbyPlayer = this.lobbyState?.slots.find((player) => player?.id === this.playerId);
    socket.emit(PROTOCOL.JOIN_GAME, {
      playerId: this.playerId,
      playerName: this.normalizeNationName(profileName || lobbyPlayer?.nombre || 'alpha'),
      playerColor: profileColor || lobbyPlayer?.color,
      roomId: this.roomCode
    });
  }

  destroy() {
    socket.off(PROTOCOL.GAME_STATE_UPDATE, this.onGameState);
    socket.off('connect', this.onConnect);
    socket.off('disconnect', this.onDisconnect);
    socket.off('connect_error', this.onConnectError);
    socket.off(PROTOCOL.ACTION_ERROR, this.onActionError);
    document.removeEventListener('pointermove', this.tooltipPointerMove);
    window.removeEventListener('resize', this.tooltipViewportChange);
    window.removeEventListener('scroll', this.tooltipViewportChange, true);
    this.tooltipLayer?.remove();
    this.styleElement.remove();
    this.container.innerHTML = '';
  }
}
