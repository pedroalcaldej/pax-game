/**
 * Controla el reloj y la transición automática de rondas.
 */

import { GAME_PHASES, TIMINGS } from '../../../shared/Constants.js';
import { EconomyEngine } from './EconomyEngine.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';

export class PhaseManager {
  constructor(gameState, onPhaseChangeCallback) {
    this.gameState = gameState;
    this.onPhaseChange = onPhaseChangeCallback;
    this.timer = null;
    this.transitionTimer = null;
    this.oiTimer = null;
    this.transitionDueAt = null;
    this.scheduledPhase = null;
    this.pausedTransition = null;
    this.secondsRemaining = TIMINGS.DECISION_PHASE_DURATION;
    this.running = false;
    this.paused = false;
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.gameState.recordEvent(`Comienza la ronda ${this.gameState.currentRound}.`);
    this.transitionToPhase(GAME_PHASES.PHASE_1_STATS);
  }

  transitionToPhase(nextPhase) {
    if (!this.running || this.paused) return;
    this.stopTimer();
    this.stopTransitionTimer();
    this.gameState.currentPhase = nextPhase;

    switch (nextPhase) {
      case GAME_PHASES.PHASE_1_STATS:
        if (this.gameState.currentRound > 1) {
          EconomyEngine.processRoundEconomy(this.gameState);
        }
        this.gameState.timeRemaining = 0;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_2_DECISIONS, 0);
        break;
      case GAME_PHASES.PHASE_2_DECISIONS:
        this.secondsRemaining = TIMINGS.DECISION_PHASE_DURATION;
        this.gameState.timeRemaining = this.secondsRemaining;
        this.gameState.runBotDecisions();
        this.notifyState();
        if (this.gameState.allPlayersReady()) {
          this.finishDecisionPhase();
          break;
        }
        this.startDecisionTimer();
        break;
      case GAME_PHASES.PHASE_3_RESOLUTION:
        this.gameState.lastActionResolutions = this.gameState.resolvePlannedActions();
        this.gameState.actionResolutionId += 1;
        this.gameState.timeRemaining = 0;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_4_GLOBAL_OI, 0);
        break;
      case GAME_PHASES.PHASE_4_GLOBAL_OI:
        this.gameState.timeRemaining = 0;
        this.notifyState();
        this.schedulePhase(
          this.gameState.currentRound % 5 === 0
            ? GAME_PHASES.PHASE_6_OI_SESSION
            : GAME_PHASES.PHASE_5_SUMMARY,
          0
        );
        break;
      case GAME_PHASES.PHASE_5_SUMMARY: {
        this.gameState.currentRound += 1;
        this.gameState.recordEvent(`Comienza la ronda ${this.gameState.currentRound}.`);
        this.gameState.timeRemaining = 0;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_1_STATS, 0);
        break;
      }
      case GAME_PHASES.PHASE_6_OI_SESSION:
        this.startOISession();
        break;
      default:
        throw new Error(`Fase de juego desconocida: ${nextPhase}`);
    }
  }

  getPhaseName(phase) {
    const names = {
      [GAME_PHASES.PHASE_1_STATS]: 'Crecimiento y recaudación',
      [GAME_PHASES.PHASE_2_DECISIONS]: 'Planificación de órdenes',
      [GAME_PHASES.PHASE_3_RESOLUTION]: 'Resolución de acciones',
      [GAME_PHASES.PHASE_4_GLOBAL_OI]: 'Cierre de acciones',
      [GAME_PHASES.PHASE_5_SUMMARY]: 'Actualización del tablero',
      [GAME_PHASES.PHASE_6_OI_SESSION]: 'Reunión de la OI'
    };
    return names[phase] || 'Fase desconocida';
  }

  schedulePhase(phase, delay) {
    if (this.paused) {
      this.pausedTransition = { phase, remaining: delay };
      return;
    }
    this.stopTransitionTimer();
    this.scheduledPhase = phase;
    this.transitionDueAt = Date.now() + delay;
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.transitionDueAt = null;
      this.scheduledPhase = null;
      this.transitionToPhase(phase);
    }, delay);
  }

  startDecisionTimer() {
    if (this.paused || this.timer) return;
    this.timer = setInterval(() => {
      this.secondsRemaining = Math.max(0, this.secondsRemaining - 1);
      this.gameState.timeRemaining = this.secondsRemaining;
      this.notifyState();

      if (this.secondsRemaining === 0) {
        this.finishDecisionPhase();
      }
    }, 1000);
  }

  finishDecisionPhase() {
    if (
      !this.running
      || this.paused
      || this.gameState.currentPhase !== GAME_PHASES.PHASE_2_DECISIONS
    ) {
      return false;
    }
    this.stopTimer();
    this.transitionToPhase(GAME_PHASES.PHASE_3_RESOLUTION);
    return true;
  }

  startOISession() {
    const session = InternationalOrganizationEngine.startSession(this.gameState);
    this.gameState.timeRemaining = session.timeRemaining;
    this.notifyState();
    if (InternationalOrganizationEngine.haveAllPlayersVoted(this.gameState)) {
      this.completeOISession();
      return;
    }
    this.startOITimer();
  }

  startOITimer() {
    if (this.paused || this.oiTimer) return;
    const session = this.gameState.oiSession;
    this.oiTimer = setInterval(() => {
      session.timeRemaining = Math.max(0, session.timeRemaining - 1);
      this.gameState.timeRemaining = session.timeRemaining;
      this.notifyState();
      if (session.timeRemaining === 0) this.completeOISession();
    }, 1000);
  }

  checkDecisionReadiness() {
    if (
      this.running
      && !this.paused
      && this.gameState.currentPhase === GAME_PHASES.PHASE_2_DECISIONS
      && this.gameState.allPlayersReady()
    ) {
      return this.finishDecisionPhase();
    }
    return false;
  }

  checkOIVotes() {
    if (
      this.running
      && !this.paused
      && this.gameState.currentPhase === GAME_PHASES.PHASE_6_OI_SESSION
      && InternationalOrganizationEngine.haveAllPlayersVoted(this.gameState)
    ) {
      this.completeOISession();
      return true;
    }
    return false;
  }

  completeOISession() {
    if (!this.running || this.paused || this.gameState.currentPhase !== GAME_PHASES.PHASE_6_OI_SESSION) return;
    this.stopOITimer();
    InternationalOrganizationEngine.finishSession(this.gameState);
    this.gameState.timeRemaining = 0;
    this.notifyState();
    this.schedulePhase(GAME_PHASES.PHASE_5_SUMMARY, 0);
  }

  stopOITimer() {
    if (!this.oiTimer) return;
    clearInterval(this.oiTimer);
    this.oiTimer = null;
  }

  stopTimer() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  stopTransitionTimer() {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.transitionDueAt = null;
  }

  setPaused(paused) {
    if (!this.running || this.paused === paused) return false;
    this.paused = paused;
    this.gameState.isPaused = paused;

    if (paused) {
      this.stopTimer();
      this.stopOITimer();
      if (this.transitionTimer) {
        this.pausedTransition = {
          phase: this.scheduledPhase,
          remaining: Math.max(0, this.transitionDueAt - Date.now())
        };
        this.stopTransitionTimer();
        this.scheduledPhase = null;
      }
    } else {
      const transition = this.pausedTransition;
      this.pausedTransition = null;
      if (transition) {
        this.schedulePhase(transition.phase, transition.remaining);
      } else if (this.gameState.currentPhase === GAME_PHASES.PHASE_2_DECISIONS) {
        if (this.gameState.allPlayersReady()) {
          this.finishDecisionPhase();
        } else {
          this.startDecisionTimer();
        }
      } else if (this.gameState.currentPhase === GAME_PHASES.PHASE_6_OI_SESSION) {
        this.startOITimer();
      }
    }

    this.notifyState();
    return true;
  }

  stop() {
    this.running = false;
    this.stopTimer();
    this.stopTransitionTimer();
    this.stopOITimer();
    this.gameState.isPaused = false;
  }

  notifyState() {
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(this.gameState.getState());
    }
  }
}
