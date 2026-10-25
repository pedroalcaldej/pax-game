/**
 * server/src/network/SocketServer.js
 */

import { PROTOCOL } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from '../game/InternationalOrganizationEngine.js';

export class SocketServer {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.roomManager.setStatePublisher((room, state) => {
      this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, state);
    });
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`[Network] Cliente conectado: ${socket.id}`);

      const defaultRoom = this.roomManager.getOrCreateRoom('room-1');
      socket.emit(PROTOCOL.GAME_STATE_UPDATE, defaultRoom.gameState.getState());

      // Recibir datos de unión incluyendo playerId
      socket.on(PROTOCOL.JOIN_GAME, ({ playerName, roomId, playerId }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getOrCreateRoom(targetRoomId);

        // Registrar o reconectar al jugador
        const existingPlayer = playerId && Array.from(room.gameState.players.values()).find(
          (entry) => entry.boundPlayerId === playerId
        );
        const wasBot = existingPlayer?.isBot;
        const player = room.gameState.addPlayer(socket.id, playerName || 'Nación Alpha', playerId);
        if (!player) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'La sala ya tiene cuatro jugadores humanos.');
          return;
        }
        room.gameState.recordEvent(
          wasBot ? `${player.name} se reconectó.` : `${player.name} se unió a la partida.`
        );
        room.enforcePauseEligibility();
        const session = room.gameState.oiSession;
        if (
          wasBot
          && session?.phase === 'voting'
          && session.botVoterIds.includes(player.id)
        ) {
          delete session.votes[player.id];
          session.botVoterIds = session.botVoterIds.filter((id) => id !== player.id);
        }

        socket.join(room.id);
        console.log(`[Network] Jugador "${player.name}" (${player.id}) conectado a la sala: ${room.id}`);

        // Emitir estado actualizado a todos
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.START_GAME, ({ roomId } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          const message = 'Únete a la sala antes de iniciar la partida.';
          socket.emit(PROTOCOL.ACTION_ERROR, message);
          acknowledge({ ok: false, message });
          return;
        }

        const started = room.start();
        if (started) {
          socket.emit(PROTOCOL.ACTION_RESULT, 'La partida ha comenzado.');
        }
        acknowledge({ ok: true, gameStarted: room.gameState.gameStarted });
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.RESTART_GAME, ({ roomId } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          const message = 'Únete a la sala antes de iniciar otra partida.';
          socket.emit(PROTOCOL.ACTION_ERROR, message);
          acknowledge({ ok: false, message });
          return;
        }

        const state = room.restart();
        if (!state) {
          const message = 'Solo puedes volver a jugar cuando termina la partida.';
          socket.emit(PROTOCOL.ACTION_ERROR, message);
          acknowledge({ ok: false, message });
          return;
        }
        acknowledge({ ok: true, gameStarted: true });
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, state);
      });

      socket.on(PROTOCOL.READY_PHASE_END, ({ roomId, ready } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de forzar el fin de fase.');
          return;
        }
        const result = room.markPlayerReady(socket.id, ready);
        if (!result.ok) {
          socket.emit(PROTOCOL.ACTION_ERROR, result.message);
          return;
        }
        socket.emit(
          PROTOCOL.ACTION_RESULT,
          result.ready
            ? `Listo para terminar la fase (${result.readyCount}/${result.requiredCount}).`
            : `Ya no estás listo (${result.readyCount}/${result.requiredCount}).`
        );
      });

      socket.on(PROTOCOL.SET_GAME_PAUSED, ({ roomId, paused } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de pausar la partida.');
          return;
        }
        const result = room.setPaused(socket.id, paused);
        if (!result.ok) {
          socket.emit(PROTOCOL.ACTION_ERROR, result.message);
          return;
        }
        if (!result.eligible && paused) {
          socket.emit(PROTOCOL.ACTION_RESULT, 'La pausa solo está disponible cuando juegas sin otros jugadores humanos.');
        }
      });

      socket.on(PROTOCOL.END_GAME, ({ roomId } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de terminar la partida.');
          return;
        }
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.end());
      });

      socket.on(PROTOCOL.SET_TAX_RATE, ({ roomId, taxRate }) => {
        const targetRoomId = roomId || 'room-1';
        const room = this.roomManager.getRoom(targetRoomId);

        if (room) {
          const accepted = room.gameState.setPlayerTaxRate(socket.id, taxRate);
          if (!accepted) {
            socket.emit(PROTOCOL.ACTION_ERROR, 'Los impuestos solo se pueden ajustar en fase 2 y dentro del rango permitido.');
            return;
          }
          const player = Array.from(room.gameState.players.values())
            .find((entry) => entry.socketId === socket.id);
          if (player) room.gameState.recordEvent(`${player.name} ajustó sus impuestos al ${Math.round(taxRate * 100)}%.`);
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.PLAYER_ACTION, ({ roomId, action } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'No se encontró la sala.');
          return;
        }

        const result = room.gameState.performPlayerAction(socket.id, action);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) {
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.PROPOSE_OI_RESOLUTION, ({ roomId, proposal } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de proponer una resolución.');
          return;
        }
        const result = InternationalOrganizationEngine.propose(
          room.gameState,
          socket.id,
          proposal
        );
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) {
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.SUBMIT_OI_VOTE, ({ roomId, ballot } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de votar en la OI.');
          return;
        }
        const result = InternationalOrganizationEngine.submitVote(
          room.gameState,
          socket.id,
          ballot
        );
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) {
          room.phaseManager.checkOIVotes();
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.PROPOSE_TREATY, ({ roomId, treaty } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de proponer un tratado.');
          return;
        }
        const result = room.gameState.proposeTreaty(socket.id, treaty);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.RESPOND_TO_TREATY, ({ roomId, offerId, accepted } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de responder a un tratado.');
          return;
        }
        const result = room.gameState.respondToTreaty(socket.id, offerId, accepted);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.CANCEL_TREATY_OFFER, ({ roomId, offerId } = {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de cancelar una propuesta.');
          return;
        }
        const result = room.gameState.cancelTreatyOffer(socket.id, offerId);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.FINANCIAL_ACTION, ({ roomId, action } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId || 'room-1');
        if (!room || !socket.rooms.has(room.id)) {
          const message = 'Únete a la partida antes de realizar una operación financiera.';
          socket.emit(PROTOCOL.ACTION_ERROR, message);
          acknowledge({ ok: false, message });
          return;
        }
        const result = room.gameState.performFinancialAction(socket.id, action);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        acknowledge(result);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on('disconnect', () => {
        for (const room of this.roomManager.rooms.values()) {
          const disconnectedPlayer = Array.from(room.gameState.players.values())
            .find((player) => player.socketId === socket.id);
          const removed = room.gameState.removePlayer(socket.id);
          if (removed && room.gameState.gameStarted) {
            room.gameState.recordEvent(`${disconnectedPlayer?.name || 'Un jugador'} se desconectó; su país queda bajo control del bot.`);
          }
          room.enforcePauseEligibility();
          if (removed && room.gameState.currentPhase === 2) {
            room.gameState.runBotDecisions({ resetReadiness: false });
            room.phaseManager.checkDecisionReadiness();
          }
          const session = room.gameState.oiSession;
          if (session?.phase === 'voting') {
            for (const player of room.gameState.players.values()) {
              if (player.isBot && !session.votes[player.id]) {
                session.votes[player.id] = InternationalOrganizationEngine.getBotBallot(
                  room.gameState,
                  player,
                  session.proposals
                );
                session.botVoterIds.push(player.id);
              }
            }
            room.phaseManager.checkOIVotes();
          }
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
        console.log(`[Network] Cliente desconectado: ${socket.id}`);
      });
    });
  }
}