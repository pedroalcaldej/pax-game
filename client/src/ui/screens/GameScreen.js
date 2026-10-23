/**
 * client/src/ui/screens/GameScreen.js
 * Pantalla principal del juego PAX.
 * Coordina el Canvas de la grilla, el Scoreboard y el TaxSlider.
 */

import { Map } from '../components/Map.js';
import { TaxSlider } from '../components/TaxSlider.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { socket } from '../../network/SocketClient.js';
import { PROTOCOL } from '../../../../shared/Constants.js';

export class GameScreen {
  /**
   * @param {HTMLElement} container - Elemento DOM raíz (ej. #app) donde se monta la pantalla.
   */
  constructor(container) {
    this.container = container;
    this.map = null;
    this.scoreboard = null;
    this.taxSlider = null;

    this.init();
  }

  /**
   * Genera el maquetado base y conecta los componentes con Socket.io.
   */
  init() {
    // 1. Inyectar estructura HTML del Layout principal
    this.container.innerHTML = `
      <div class="game-screen-layout" style="
        display: flex;
        gap: 24px;
        padding: 24px;
        height: 100vh;
        width: 100vw;
        box-sizing: border-box;
        background-color: #0f172a;
        font-family: system-ui, -apple-system, sans-serif;
        overflow: hidden;
      ">
        <!-- Panel Izquierdo: Mapa/Grilla 16x16 -->
        <main id="map-container" style="
          flex: 1;
          background: #1e293b;
          border-radius: 12px;
          border: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        "></main>

        <!-- Panel Derecho: Marcador de Naciones y Slider Fiscal -->
        <aside style="
          width: 360px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        ">
          <div id="scoreboard-container"></div>
          <div id="tax-container"></div>
        </aside>
      </div>
    `;

    // 2. Obtener referencias a las zonas de montaje
    const mapEl = this.container.querySelector('#map-container');
    const scoreEl = this.container.querySelector('#scoreboard-container');
    const taxEl = this.container.querySelector('#tax-container');

    // 3. Instanciar componentes hijos
    this.map = new Map(mapEl);
    this.scoreboard = new Scoreboard(scoreEl);
    this.taxSlider = new TaxSlider(taxEl, (newTaxRate) => {
      // Callback ejecutado al mover el slider
      socket.emit(PROTOCOL.SET_TAX_RATE, {
        roomId: 'room-1',
        taxRate: newTaxRate
      });
    });

    // 4. Suscribirse a los eventos del servidor vía Socket.io
    this.bindSocketEvents();

    // 5. Unirse a la partida al cargar la pantalla
    this.joinGame();
  }

  /**
   * Registra los escuchadores de eventos WebSocket.
   */
  bindSocketEvents() {
    // Escuchar el evento de conexión exitosa
    socket.on('connect', () => {
      console.log('[Socket] Conectado al servidor con ID:', socket.id);
      this.joinGame();
    });

    // Escuchar actualización del estado del juego
    socket.on(PROTOCOL.GAME_STATE_UPDATE, (gameState) => {
      console.log('[Client] Estado recibido:', gameState);
      if (!gameState) return;

      if (gameState.grid) {
        this.map.render(gameState.grid);
      }

      if (gameState.players) {
        this.scoreboard.update(
          gameState.players,
          gameState.currentPhase,
          gameState.timeRemaining
        );
      }
    });
  }

  /**
   * Emite el evento inicial JOIN_GAME para registrar la nación en la sala.
   */
  joinGame() {
    if (socket.connected) {
      // Obtener o crear ID único de navegador
      let playerId = localStorage.getItem('pax_player_id');
      if (!playerId) {
        playerId = 'player_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('pax_player_id', playerId);
      }

      socket.emit(PROTOCOL.JOIN_GAME, {
        playerId: playerId,
        playerName: 'Nación Alpha',
        roomId: 'room-1'
      });
    }
  }

  /**
   * Limpieza de eventos al desmontar la pantalla (para prevenir memory leaks).
   */
  destroy() {
    socket.off(PROTOCOL.GAME_STATE_UPDATE);
    socket.off('connect');
    this.container.innerHTML = '';
  }
}