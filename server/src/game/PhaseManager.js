/**
 * server/src/game/PhaseManager.js
 * Controla el reloj principal, los temporizadores y el avance entre las 5 fases.
 */

import { TIMINGS, GAME_PHASES } from '../../../shared/Constants.js';
import { EconomyEngine } from './EconomyEngine.js';

export class PhaseManager {
  /**
   * @param {GameState} gameState - Referencia al estado maestro de la partida.
   * @param {Function} onPhaseChangeCallback - Callback invocado al cambiar de fase o segundo.
   */
  constructor(gameState, onPhaseChangeCallback) {
    this.gameState = gameState;
    this.onPhaseChange = onPhaseChangeCallback;
    this.timer = null;
    this.secondsRemaining = 0;
  }

  /**
   * Inicia el ciclo automático del juego en la Fase 1.
   */
  startLoop() {
    this.transitionToPhase(GAME_PHASES.PHASE_1_STATS);
  }

  /**
   * Transiciona el estado a una nueva fase y gestiona sus temporizadores.
   * @param {number} nextPhase - Número de la fase (1 a 5).
   */
  transitionToPhase(nextPhase) {
    this.gameState.currentPhase = nextPhase;
    this.stopTimer();

    switch (nextPhase) {
      case GAME_PHASES.PHASE_1_STATS:
        // Fase 1: Cálculo automático de economía y población
        EconomyEngine.processRoundEconomy(this.gameState);
        this.notifyState();
        // Transición rápida a la Fase 2 activa
        setTimeout(() => this.transitionToPhase(GAME_PHASES.PHASE_2_DECISIONS), 1000);
        break;

      case GAME_PHASES.PHASE_2_DECISIONS:
        // Fase 2: 60 segundos activos para decisiones de los jugadores
        this.secondsRemaining = TIMINGS.DECISION_PHASE_DURATION;
        this.notifyState();
        this.startDecisionTimer();
        break;

      case GAME_PHASES.PHASE_3_RESOLUTION:
        // Fase 3: Resolución de acciones y movimientos
        this.notifyState();
        setTimeout(() => this.transitionToPhase(GAME_PHASES.PHASE_4_GLOBAL_OI), 2000);
        break;

      case GAME_PHASES.PHASE_4_GLOBAL_OI:
        // Fase 4: Sesión de votación u Organismo Internacional
        this.notifyState();
        setTimeout(() => this.transitionToPhase(GAME_PHASES.PHASE_5_SUMMARY), 2000);
        break;

      case GAME_PHASES.PHASE_5_SUMMARY:
        // Fase 5: Resumen de ronda e incremento del contador de ronda
        this.gameState.currentRound += 1;
        this.notifyState();
        // Reinicia el ciclo volviendo a la Fase 1
        setTimeout(() => this.transitionToPhase(GAME_PHASES.PHASE_1_STATS), 3000);
        break;
    }
  }

  /**
   * Inicia la cuenta regresiva de 60 segundos para la Fase 2.
   */
  startDecisionTimer() {
    this.timer = setInterval(() => {
      this.secondsRemaining -= 1;
      this.notifyState();

      if (this.secondsRemaining <= 0) {
        this.stopTimer();
        this.transitionToPhase(GAME_PHASES.PHASE_3_RESOLUTION);
      }
    }, 1000);
  }

  /**
   * Detiene el intervalo de tiempo actual.
   */
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Envía el estado actualizado al callback externo.
   */
  notifyState() {
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange({
        phase: this.gameState.currentPhase,
        round: this.gameState.currentRound,
        secondsRemaining: this.secondsRemaining,
        gameState: this.gameState.getPublicState()
      });
    }
  }
}