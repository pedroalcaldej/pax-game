/**
 * Controla el reloj y la transición automática de rondas.
 */

import { GAME_PHASES, TIMINGS } from '../../../shared/Constants.js';
import { EconomyEngine } from './EconomyEngine.js';

const NEXT_PHASE = {
  [GAME_PHASES.PHASE_3_RESOLUTION]: GAME_PHASES.PHASE_4_GLOBAL_OI,
  [GAME_PHASES.PHASE_4_GLOBAL_OI]: GAME_PHASES.PHASE_5_SUMMARY
};

export class PhaseManager {
  constructor(gameState, onPhaseChangeCallback) {
    this.gameState = gameState;
    this.onPhaseChange = onPhaseChangeCallback;
    this.timer = null;
    this.transitionTimer = null;
    this.secondsRemaining = TIMINGS.DECISION_PHASE_DURATION;
    this.running = false;
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.transitionToPhase(GAME_PHASES.PHASE_1_STATS);
  }

  transitionToPhase(nextPhase) {
    if (!this.running) return;
    this.stopTimer();
    this.stopTransitionTimer();
    this.gameState.currentPhase = nextPhase;

    switch (nextPhase) {
      case GAME_PHASES.PHASE_1_STATS:
        if (this.gameState.currentRound > 1) {
          EconomyEngine.processRoundEconomy(this.gameState);
        }
        this.gameState.timeRemaining = 1;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_2_DECISIONS, 1000);
        break;
      case GAME_PHASES.PHASE_2_DECISIONS:
        this.secondsRemaining = TIMINGS.DECISION_PHASE_DURATION;
        this.gameState.timeRemaining = this.secondsRemaining;
        this.gameState.runBotDecisions();
        this.notifyState();
        this.startDecisionTimer();
        break;
      case GAME_PHASES.PHASE_3_RESOLUTION:
        this.gameState.timeRemaining = 2;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_4_GLOBAL_OI, 2000);
        break;
      case GAME_PHASES.PHASE_4_GLOBAL_OI:
        this.gameState.timeRemaining = 2;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_5_SUMMARY, 2000);
        break;
      case GAME_PHASES.PHASE_5_SUMMARY:
        this.gameState.resolvePendingMovements();
        this.gameState.currentRound += 1;
        this.gameState.timeRemaining = 3;
        this.notifyState();
        this.schedulePhase(GAME_PHASES.PHASE_1_STATS, 3000);
        break;
      default:
        throw new Error(`Fase de juego desconocida: ${nextPhase}`);
    }
  }

  schedulePhase(phase, delay) {
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.transitionToPhase(phase);
    }, delay);
  }

  startDecisionTimer() {
    this.timer = setInterval(() => {
      this.secondsRemaining = Math.max(0, this.secondsRemaining - 1);
      this.gameState.timeRemaining = this.secondsRemaining;
      this.notifyState();

      if (this.secondsRemaining === 0) {
        this.stopTimer();
        this.transitionToPhase(GAME_PHASES.PHASE_3_RESOLUTION);
      }
    }, 1000);
  }

  stopTimer() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  stopTransitionTimer() {
    if (!this.transitionTimer) return;
    clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }

  stop() {
    this.running = false;
    this.stopTimer();
    this.stopTransitionTimer();
  }

  notifyState() {
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(this.gameState.getState());
    }
  }
}
