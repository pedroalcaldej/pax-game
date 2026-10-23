/**
 * client/src/ui/screens/GameScreen.js
 * Pantalla principal del juego. Unifica el Canvas del mapa, la red
 * y los componentes de interfaz (TaxSlider, Scoreboard).
 */

import { SocketClient } from '../../network/SocketClient.js';
import { Map } from '../../core/Map.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { Scoreboard } from '../components/Scoreboard.js';

export class GameScreen {
  /**
   * @param {HTMLElement} rootElement - Elemento contenedor principal en el DOM.
   */
  constructor(rootElement) {
    this.root = rootElement;
    this.roomId = 'room-1';
    
    // Inicializar capa de red
    this.socketClient = new SocketClient();
    
    this.renderLayout();
    this.initGameEngine();
    this.setupNetworkListeners();
  }

  /**
   * Monta el diseño general de la pantalla con la cuadrícula y el panel lateral.
   */
  renderLayout() {
    this.root.innerHTML = `
      <div style="display: flex; gap: 20px; padding: 20px; background: #0f172a; min-height: 100vh; color: #fff; justify-content: center; align-items: flex-start; font-family: sans-serif;">
        <!-- Canvas para el mapa 16x16 -->
        <div style="box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden; background: #1e293b;">
          <canvas id="gameCanvas"></canvas>
        </div>

        <!-- Panel Lateral (UI) -->
        <div style="display: flex; flex-direction: column; gap: 15px; width: 320px;">
          <div id="scoreboardContainer"></div>
          <div id="taxSliderContainer"></div>
        </div>
      </div>
    `;
  }

  /**
   * Inicializa las referencias de clases de UI y Canvas.
   */
  initGameEngine() {
    const canvas = this.root.querySelector('#gameCanvas');
    this.mapRenderer = new Map(canvas);

    const scoreboardEl = this.root.querySelector('#scoreboardContainer');
    this.scoreboard = new Scoreboard(scoreboardEl);

    const taxSliderEl = this.root.querySelector('#taxSliderContainer');
    this.taxSlider = new TaxSlider(taxSliderEl, (newTaxRate) => {
      this.socketClient.setTaxRate(this.roomId, newTaxRate);
    });
  }

  /**
   * Escucha los eventos del servidor e interactúa con la interfaz.
   */
  setupNetworkListeners() {
    this.socketClient.connect();

    // Actualización de grilla y jugadores
    this.socketClient.onGameStateUpdate((gameState) => {
      if (gameState && gameState.grid) {
        this.mapRenderer.render(gameState.grid, gameState.players);
        this.scoreboard.update({
          phase: gameState.currentPhase,
          round: gameState.currentRound,
          players: gameState.players
        });
      }
    });

    // Actualización de tiempos y fases
    this.socketClient.onPhaseChange((data) => {
      const { phase, round, secondsRemaining, gameState } = data;

      this.scoreboard.update({
        phase,
        round,
        secondsRemaining,
        players: gameState ? gameState.players : []
      });

      if (gameState && gameState.grid) {
        this.mapRenderer.render(gameState.grid, gameState.players);
      }

      // Habilitar el slider de impuestos solo en Fase 2 (Toma de decisiones)
      this.taxSlider.setEnabled(phase === 2);
    });

    // Solicitar unirse a la sala por defecto
    const randomPlayerName = `Nación_${Math.floor(Math.random() * 8999 + 1000)}`;
    this.socketClient.joinGame(randomPlayerName, this.roomId);
  }
}