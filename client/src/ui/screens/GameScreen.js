/**
 * Pantalla principal de PAX: panel de nación, mapa e inspector territorial.
 */

import { Map } from '../components/Map.js';
import { Inspector } from '../components/Inspector.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { GlobalPanel } from '../components/GlobalPanel.js';
import { FinancePanel } from '../components/FinancePanel.js';
import { socket } from '../../network/SocketClient.js';
import { SocketLobby } from '../../network/SocketLobby.js';
import {
  ACTION_SLOT_COUNT,
  GAME_STAGES,
  MAX_ROUNDS,
  MAP_CONFIG,
  NATIONS,
  LEGACY_NATION_NAMES,
  OI_RESOLUTIONS,
  PROTOCOL,
  STAGE_TIMINGS
} from '../../../../shared/Constants.js';
import { getPlayerRankings } from '../components/PlayerRankings.js';
import { Chat } from '../components/Chat.js';
import { EventLog } from '../components/EventLog.js';
import { PhaseReadyButton } from '../components/PhaseReadyButton.js';
import { LobbyScreen } from './LobbyScreen.js';
import { renderGameScreen } from './GameScreenView.js';
import '../styles/GameScreen.css';

const SESSION_ROOM_KEY = 'pax_room_id';
const SESSION_USER_KEY = 'pax_user_id';
const createPlayerId = () => {
  const id = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `player_${id}`;
};
const createSoloRoomId = () => {
  const id = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `solo-${id}`;
};

const STAGE_LABELS = {
  [GAME_STAGES.ROUND_START]: 'Inicio de ronda',
  [GAME_STAGES.PLANNING]: 'Planificación',
  [GAME_STAGES.RESOLVING]: 'Resolviendo acciones…',
  [GAME_STAGES.CLOSING]: 'Actualizando el mundo…',
  [GAME_STAGES.INTERNATIONAL_MEETING]: 'Reunión de la OI'
};



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
    this.roomCode = null;
    this.lobby = null;
    this.lobbyState = null;
    this.lobbyError = '';
    this.serverJoinedRoom = null;
    this.autoStartPending = false;
    this.isLeaving = false;

    this.init();
  }

  init() {
    renderGameScreen(this.container);
    this.lobbyScreen = new LobbyScreen(this.container.querySelector('#lobby-screen-mount'), {
      onCreate: () => this.createRoom(),
      onQuickMatch: () => this.quickMatch(),
      onSinglePlayer: () => this.startSinglePlayer(),
      onJoin: (code) => this.joinRoom(code),
      onCopy: () => this.copyRoomCode(),
      onReady: () => this.startRoom(),
      onLeave: () => this.returnToMainMenu(),
      onProfileChange: () => this.saveLobbyProfile(),
      onColorSelect: (picker) => {
        if (picker.id === 'lobby-player-color') this.saveLobbyProfile();
      }
    });
    this.eventLog = new EventLog(this.container.querySelector('#event-log'));
    this.phaseReadyButton = new PhaseReadyButton(
      this.container.querySelector('#phase-ready-button'),
      () => {
        if (!socket.connected || this.gameState?.currentStage !== GAME_STAGES.PLANNING) return;
        socket.emit(PROTOCOL.READY_PHASE_END, {
          roomId: this.roomCode,
          ready: !this.player?.phaseReady
        });
      }
    );

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
    this.setupLobby();
    if (socket.connected) this.onConnect();
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
      this.lobbyScreen.setSinglePlayerEnabled(true);
      this.setRoomControlsEnabled(true);
      this.rejoinStoredSession();
      this.updateStartMenu();
    };
    this.onDisconnect = () => {
      this.startPending = false;
      this.startError = 'Se perdió la conexión con el servidor. Reconectando…';
      this.connectionError = '';
      this.lobbyScreen.setSinglePlayerEnabled(false);
      this.setRoomControlsEnabled(false);
      this.updateStartMenu();
    };
    this.onConnectError = () => {
      this.connectionError = 'No se pudo conectar con el servidor. Comprueba que esté iniciado en la Terminal 1.';
      this.updateStartMenu();
    };
    this.onGameState = (gameState) => {
      if (!this.isLeaving) this.updateGameState(gameState);
    };
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
      this.returnToMainMenu();
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

    this.container.querySelector('#global-panel-open').addEventListener('click', () => {
      this.container.querySelector('#global-panel-dialog').showModal();
    });
    this.container.querySelector('#global-panel-close').addEventListener('click', () => {
      this.container.querySelector('#global-panel-dialog').close();
    });
    this.container.querySelector('#game-summary-replay').addEventListener('click', () => {
      this.replayGame();
    });
    this.container.querySelector('#game-summary-menu').addEventListener('click', () => {
      if (!this.gameState?.gameOver) return;
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
      else if (element.matches('#create-room-button, #quick-match-button, #join-room-button')) element.dataset.tooltip = 'El servidor no está disponible';
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
      else if (element.matches('#phase-ready-button')) element.dataset.tooltip = 'Pulsa para marcarte listo; puedes volver a pulsar para retirar tu confirmación';
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
    this.updatePhaseReadyButton(players, phase, gameState.gameStarted);
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

  updatePhaseReadyButton(players, phase, gameStarted) {
    const participants = players;
    const readyCount = participants.filter((player) => player.phaseReady).length;
    const requiredCount = participants.length;
    const enabled = Boolean(
      gameStarted
      && !this.gameState?.gameOver
      && this.player
      && (this.gameState?.currentStage || this.getStageFromLegacyPhase(phase)) === GAME_STAGES.PLANNING
    );
    this.phaseReadyButton.update({
      ready: Boolean(this.player?.phaseReady),
      readyCount,
      requiredCount,
      enabled
    });
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
    const savedScrollTop = this.eventLog?.element?.scrollTop || 0;
    this.events = [
      ...this.localEvents,
      ...history.slice().reverse().map((event) => ({
        message: event.message,
        timestamp: event.timestamp
      }))
    ];
    this.eventLog.render(this.events, this.gameState?.players, savedScrollTop);
  }

  addEvent(message) {
    const event = { message, timestamp: Date.now() };
    this.localEvents.unshift(event);
    this.events.unshift(event);
    this.eventLog.render(this.events, this.gameState?.players, 0);
  }

  getSelectedNationColor(id) {
    return this.lobbyScreen.selectedColor(id);
  }

  readStoredSession() {
    const roomId = sessionStorage.getItem(SESSION_ROOM_KEY);
    const userId = sessionStorage.getItem(SESSION_USER_KEY);
    return roomId && userId ? { roomId, userId } : null;
  }

  saveGameSession(roomId = this.roomCode, userId = this.playerId) {
    if (!roomId || !userId) return;
    sessionStorage.setItem(SESSION_ROOM_KEY, roomId);
    sessionStorage.setItem(SESSION_USER_KEY, userId);
  }

  clearGameSession() {
    sessionStorage.removeItem(SESSION_ROOM_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  rejoinStoredSession() {
    const session = this.readStoredSession();
    if (!session || !socket.connected) return;
    const { roomId, userId } = session;
    this.roomCode = roomId;
    this.playerId = userId;
    this.serverJoinedRoom = roomId;
    sessionStorage.setItem(SESSION_USER_KEY, userId);

    socket.emit(PROTOCOL.REJOIN_ROOM, { roomId, userId }, (result) => {
      if (this.isLeaving) return;
      if (result?.ok) {
        this.serverJoinedRoom = roomId;
        if (result.state) this.updateGameState(result.state);
        return;
      }
      this.serverJoinedRoom = null;
      if (this.lobbyState?.code === roomId && this.lobbyState.estado === 'en_juego') {
        socket.emit(PROTOCOL.JOIN_GAME, {
          playerId: userId,
          playerName: this.lobbyState.slots.find((player) => player?.id === userId)?.nombre || 'alpha',
          playerColor: this.lobbyState.slots.find((player) => player?.id === userId)?.color,
          roomId
        });
        socket.emit(PROTOCOL.START_GAME, { roomId });
      }
    });

    if (roomId.startsWith('PAX') && this.lobby?.enabled) {
      this.chat.setEnabled(true);
      this.lobby.watchRoom(roomId).catch((error) => {
        this.lobbyError = error.message;
        this.setStartStatus(error.message);
      });
    }
  }

  normalizeNationName(name) {
    return LEGACY_NATION_NAMES.get(name) || name;
  }

  setupLobby() {
    const session = this.readStoredSession();
    this.playerId = session?.userId || sessionStorage.getItem(SESSION_USER_KEY) || createPlayerId();
    sessionStorage.setItem(SESSION_USER_KEY, this.playerId);

    this.lobby = new SocketLobby({
      playerId: this.playerId,
      playerName: 'alpha',
      onChange: (room) => this.handleLobbyChange(room),
      onChatMessage: (message) => this.chat.addMessage(message),
      onError: (error) => {
        this.lobbyError = error.message;
        this.setStartStatus(error.message);
      }
    });
    this.lobbyScreen.setRoomControlsEnabled(this.lobby.enabled);
    this.lobbyScreen.setSinglePlayerEnabled(socket.connected);
    if (!socket.connected) {
      this.setStartStatus('Conéctate al servidor para crear o unirte a salas.');
      return;
    }
    if (socket.connected) this.updateStartMenu();
  }

  async createRoom() {
    await this.enterLobby(() => this.lobby.createRoom({ privada: true }));
  }

  async quickMatch() {
    await this.enterLobby(() => this.lobby.quickMatch());
  }

  startSinglePlayer() {
    if (!socket.connected) return;
    this.isLeaving = false;
    this.chat.setEnabled(false);
    const name = this.container.querySelector('#single-player-name').value.trim();
    const color = this.getSelectedNationColor('single-player-color');
    if (!name) {
      this.setStartStatus('El nombre del país no puede estar vacío.');
      return;
    }
    this.roomCode = createSoloRoomId();
    this.saveGameSession(this.roomCode, this.playerId);
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
    this.isLeaving = false;
    this.chat.setEnabled(true);
    this.setStartStatus('Conectando con la sala…');
    this.setRoomControlsEnabled(false);
    try {
      const roomId = await operation();
      this.saveGameSession(roomId || this.lobby.roomCode, this.playerId);
    } catch (error) {
      this.setStartStatus(error.message);
      this.setRoomControlsEnabled(true);
    }
  }

  setRoomControlsEnabled(enabled) {
    this.lobbyScreen.setRoomControlsEnabled(Boolean(enabled && socket.connected));
  }

  async replayGame() {
    if (!socket.connected || !this.gameState?.gameOver) return;
    const button = this.container.querySelector('#game-summary-replay');
    button.disabled = true;
    const previousRoomId = this.roomCode;
    const isPrivate = this.lobbyState?.privada !== false;
    if (this.serverJoinedRoom === this.roomCode) {
      socket.emit(PROTOCOL.END_GAME, { roomId: this.roomCode });
      this.serverJoinedRoom = null;
    }
    try {
      if (isPrivate) {
        await this.lobby.returnToLobbyForReplay();
        this.gameState = null;
        this.container.querySelector('#game-summary-dialog')?.close();
        this.container.querySelector('#start-menu').hidden = false;
      } else {
        await this.lobby.leaveRoom();
        socket.emit(PROTOCOL.LEAVE_ROOM, { roomId: previousRoomId, userId: this.playerId });
        this.lobbyState = null;
        this.gameState = null;
        this.container.querySelector('#game-summary-dialog')?.close();
        await this.lobby.quickMatch();
      }
    } catch (error) {
      button.disabled = false;
      this.addEvent(`No se pudo preparar otra partida: ${error.message}`);
    }
  }

  handleLobbyChange(room) {
    if (this.roomCode !== room.code) this.chat.clear();
    this.lobbyState = room;
    this.roomCode = room.code;
    this.saveGameSession(room.code, this.playerId);
    const { ownSlot, privateRoom } = this.lobbyScreen.updateRoom(
      room,
      this.playerId,
      (name) => this.normalizeNationName(name)
    );
    if (room.estado === 'en_juego') {
      this.setStartStatus('Partida iniciada. Cargando el mapa…');
      if (socket.connected && this.serverJoinedRoom !== room.code) {
        this.serverJoinedRoom = room.code;
        this.joinGame();
        socket.timeout(5000).emit(PROTOCOL.START_GAME, { roomId: this.roomCode });
      }
    } else {
      this.setStartStatus(ownSlot?.listo
        ? 'Estás listo. Pulsa «Listo» de nuevo para retirar tu confirmación.'
        : privateRoom
          ? 'Comparte el código. La partida empieza cuando todos estén listos.'
          : 'Esperando jugadores aleatorios. Pulsa Listo cuando quieras comenzar.');
    }
  }

  async startRoom() {
    try {
      if (!await this.saveLobbyProfile()) return;
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
      return false;
    }
    try {
      await this.lobby.updateProfile({ name, color });
      this.joinGame();
      return true;
    } catch (error) {
      this.setStartStatus(error.message);
      return false;
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
    if (this.isLeaving) return;
    this.isLeaving = true;
    const roomCode = this.roomCode;
    const userId = this.playerId;
    this.lobby?.leaveRoom().catch((error) => {
      this.showToast(`No se pudo limpiar la sala: ${error.message}`, 'error');
    });

    this.setGameMenuOpen(false);
    if (roomCode && userId) {
      socket.emit(PROTOCOL.LEAVE_ROOM, { roomId: roomCode, userId });
    }
    this.clearGameSession();

    this.chat.setEnabled(false);
    this.container.querySelector('#game-summary-dialog')?.close();
    this.lobbyState = null;
    this.lobbyError = '';
    this.gameState = null;
    this.player = null;
    this.roomCode = null;
    this.serverJoinedRoom = null;
    this.startPending = false;
    this.startError = '';
    this.lobbyScreen.showMainMenu();
    this.setRoomControlsEnabled(Boolean(this.lobby?.enabled));
    this.setStartStatus('Crea una sala o introduce un código para unirte.');
  }

  setStartStatus(message) {
    const status = this.container.querySelector('#start-status');
    if (status) status.textContent = message;
  }

  joinGame() {
    if (!socket.connected || !this.roomCode) return;
    this.playerId ||= sessionStorage.getItem(SESSION_USER_KEY) || createPlayerId();
    sessionStorage.setItem(SESSION_USER_KEY, this.playerId);
    this.saveGameSession(this.roomCode, this.playerId);
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
    this.map?.destroy();
    this.lobby?.destroy();
    socket.off(PROTOCOL.GAME_STATE_UPDATE, this.onGameState);
    socket.off('connect', this.onConnect);
    socket.off('disconnect', this.onDisconnect);
    socket.off('connect_error', this.onConnectError);
    socket.off(PROTOCOL.ACTION_ERROR, this.onActionError);
    document.removeEventListener('pointermove', this.tooltipPointerMove);
    window.removeEventListener('resize', this.tooltipViewportChange);
    window.removeEventListener('scroll', this.tooltipViewportChange, true);
    this.tooltipLayer?.remove();
    this.container.innerHTML = '';
  }
}
