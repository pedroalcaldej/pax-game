/**
 * server/src/network/SocketServer.js
 */

import { PROTOCOL } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from '../game/InternationalOrganizationEngine.js';

export class SocketServer {
  constructor(io, roomManager, lobbyStore) {
    this.io = io;
    this.roomManager = roomManager;
    this.lobbyStore = lobbyStore;
    this.roomManager.setStatePublisher((room, state) => {
      this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, state);
    });
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`[Network] Cliente conectado: ${socket.id}`);

      const ackError = (acknowledge, error) => acknowledge?.({ ok: false, message: error.message || String(error) });
      const publishLobby = (room) => {
        if (room) this.io.to(`lobby:${room.code}`).emit(PROTOCOL.LOBBY_STATE_UPDATE, room);
      };
      const joinLobbySocket = async (room, userId) => {
        await socket.join(`lobby:${room.code}`);
        socket.data.lobbyRoomCode = room.code;
        socket.data.lobbyUserId = userId;
        socket.emit(PROTOCOL.LOBBY_STATE_UPDATE, room);
        const messages = await this.lobbyStore.getChat(room.code);
        for (const message of messages) socket.emit(PROTOCOL.LOBBY_CHAT_MESSAGE, message);
      };

      socket.on(PROTOCOL.LOBBY_CREATE, async ({ userId, playerName, privada = true } = {}, acknowledge) => {
        try {
          const room = await this.lobbyStore.create(userId, playerName || 'alpha', Boolean(privada));
          await joinLobbySocket(room, userId); publishLobby(room); acknowledge?.({ ok: true, roomId: room.code });
        } catch (error) { ackError(acknowledge, error); }
      });
      socket.on(PROTOCOL.LOBBY_JOIN, async ({ roomId, userId, playerName } = {}, acknowledge) => {
        try {
          const code = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
          if (code.length !== 6 || !userId) throw new Error('El código de sala o la sesión no son válidos.');
          const room = await this.lobbyStore.join(code, userId, playerName || 'alpha');
          await joinLobbySocket(room, userId); publishLobby(room); acknowledge?.({ ok: true, roomId: code });
        } catch (error) { ackError(acknowledge, error); }
      });
      socket.on(PROTOCOL.LOBBY_QUICK_MATCH, async ({ userId, playerName } = {}, acknowledge) => {
        try {
          if (!userId) throw new Error('No se encontró la sesión del jugador.');
          const room = await this.lobbyStore.quickMatch(userId, playerName || 'alpha');
          await joinLobbySocket(room, userId); publishLobby(room); acknowledge?.({ ok: true, roomId: room.code });
        } catch (error) { ackError(acknowledge, error); }
      });
      socket.on(PROTOCOL.LOBBY_WATCH, async ({ roomId, userId } = {}, acknowledge) => {
        try {
          const room = await this.lobbyStore.get(roomId);
          if (!room || !room.slots.some((player) => player?.id === userId)) throw new Error('La sala o el país reservado ya no existen.');
          const result = await this.lobbyStore.mutate(roomId, 'join', {
            userId, playerName: room.slots.find((player) => player?.id === userId)?.nombre || 'alpha',
            defaultColor: '#FDE047', colors: ['#FDE047', '#FB7185', '#34D399', '#A78BFA', '#22D3EE', '#FB923C', '#F472B6', '#A3E635']
          });
          if (!result.ok) throw new Error(result.error);
          const updated = await this.lobbyStore.get(roomId);
          await joinLobbySocket(updated, userId); publishLobby(updated); acknowledge?.({ ok: true });
        } catch (error) { ackError(acknowledge, error); }
      });
      socket.on(PROTOCOL.LOBBY_UPDATE_PROFILE, async ({ roomId, userId, name, color } = {}, acknowledge) => {
        try { const room = await this.lobbyStore.updateProfile(roomId,userId,name,color); publishLobby(room); acknowledge?.({ok:true}); }
        catch(error) { ackError(acknowledge,error); }
      });
      socket.on(PROTOCOL.LOBBY_TOGGLE_READY, async ({ roomId, userId } = {}, acknowledge) => {
        try { const room=await this.lobbyStore.toggleReady(roomId,userId); publishLobby(room); acknowledge?.({ok:true}); }
        catch(error) { ackError(acknowledge,error); }
      });
      socket.on(PROTOCOL.LOBBY_REPLAY, async ({ roomId } = {}, acknowledge) => {
        try { const room=await this.lobbyStore.replay(roomId); publishLobby(room); acknowledge?.({ok:true}); }
        catch(error) { ackError(acknowledge,error); }
      });
      socket.on(PROTOCOL.LOBBY_LEAVE, async ({ roomId, userId } = {}, acknowledge) => {
        try {
          const result=await this.lobbyStore.leave(roomId,userId);
          socket.leave(`lobby:${roomId}`); socket.data.lobbyRoomCode=null; socket.data.lobbyUserId=null;
          if(result.deleted) this.io.to(`lobby:${roomId}`).emit(PROTOCOL.LOBBY_STATE_UPDATE,{code:roomId,deleted:true});
          else publishLobby(await this.lobbyStore.get(roomId));
          acknowledge?.({ok:true});
        } catch(error) { ackError(acknowledge,error); }
      });
      socket.on(PROTOCOL.LOBBY_SEND_CHAT, async ({ roomId, userId, message } = {}, acknowledge) => {
        try {
          const room=await this.lobbyStore.get(roomId);
          const player=room?.slots.find((entry)=>entry?.id===userId);
          if(!player || socket.data.lobbyRoomCode!==roomId || socket.data.lobbyUserId!==userId) throw new Error('Debes estar en la sala para enviar mensajes.');
          const text=String(message?.text || '').trim().slice(0,240);
          if(!text) throw new Error('El mensaje está vacío.');
          const entry={id:`${Date.now()}-${socket.id}`,playerId:userId,nationName:player.nombre,nationColor:player.color,text,createdAt:Date.now()};
          await this.lobbyStore.addChat(roomId,entry); this.io.to(`lobby:${roomId}`).emit(PROTOCOL.LOBBY_CHAT_MESSAGE,entry); acknowledge?.({ok:true});
        } catch(error) { ackError(acknowledge,error); }
      });

      // Recibir datos de unión incluyendo playerId
      socket.on(PROTOCOL.JOIN_GAME, ({ playerName, playerColor, roomId, playerId }) => {
        if (!roomId) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Se requiere un identificador de sala para unirse.');
          return;
        }
        const targetRoomId = roomId;
        const room = this.roomManager.getOrCreateRoom(targetRoomId);

        // Registrar o reconectar al jugador
        const existingPlayer = playerId && Array.from(room.gameState.players.values()).find(
          (entry) => entry.boundPlayerId === playerId
        );
        const wasDisconnected = Boolean(existingPlayer && !existingPlayer.socketId);
        const wasBot = existingPlayer?.isBot;
        const player = room.gameState.addPlayer(socket.id, playerName || 'alpha', playerId, playerColor);
        if (!player) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'La sala ya tiene cuatro jugadores humanos.');
          return;
        }
        room.gameState.recordEvent(
          wasDisconnected || wasBot
            ? `${player.name} se reconectó.`
            : `${player.name} se unió a la partida.`
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

      socket.on(PROTOCOL.REJOIN_ROOM, ({ roomId, userId } = {}, acknowledge = () => {}) => {
        const room = roomId && this.roomManager.getRoom(roomId);
        if (!room || !userId) {
          const result = { ok: false, message: 'No se encontró la sala o el usuario de la sesión.' };
          acknowledge(result);
          return;
        }
        const player = room.rejoinPlayer(socket.id, userId);
        if (!player) {
          const result = { ok: false, message: 'No hay un país reservado para esta sesión.' };
          acknowledge(result);
          return;
        }
        socket.join(room.id);
        room.gameState.recordEvent(`${player.name} volvió a conectarse.`);
        room.enforcePauseEligibility();
        const state = room.gameState.getState();
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, state);
        acknowledge({ ok: true, state });
      });

      socket.on(PROTOCOL.LEAVE_ROOM, ({ roomId, userId } = {}, acknowledge = () => {}) => {
        const room = roomId && this.roomManager.getRoom(roomId);
        if (!room) {
          acknowledge({ ok: true, left: false });
          return;
        }
        const player = userId ? room.leavePlayer(socket.id, userId) : null;
        socket.leave(room.id);
        if (player) {
          room.gameState.recordEvent(`${player.name} salió de la partida; su país queda bajo control del bot.`);
          if (room.gameState.currentPhase === 2) {
            room.gameState.runBotDecisions({ resetReadiness: false });
            room.phaseManager.checkDecisionReadiness();
          }
          const session = room.gameState.oiSession;
          if (session?.phase === 'voting' && !session.votes[player.id]) {
            session.votes[player.id] = InternationalOrganizationEngine.getBotBallot(
              room.gameState,
              player,
              session.proposals
            );
            session.botVoterIds.push(player.id);
            room.phaseManager.checkOIVotes();
          }
          const hasHumanPlayers = Array.from(room.gameState.players.values())
            .some((entry) => !entry.isBot);
          if (!hasHumanPlayers) {
            this.roomManager.removeRoom(room.id);
          } else {
            this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
          }
        }
        acknowledge({ ok: true, left: Boolean(player) });
      });

      socket.on(PROTOCOL.START_GAME, ({ roomId } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
        if (!room) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de marcarte listo.');
          return;
        }
        const hasActivePlayer = Array.from(room.gameState.players.values()).some(
          (player) => player.socketId === socket.id && !player.isBot
        );
        if (!hasActivePlayer) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'No tienes un país activo en esta partida.');
          return;
        }
        // The assigned player is the authorization source. Rejoin the socket room
        // if its membership was lost during a reconnect before broadcasting updates.
        if (!socket.rooms.has(room.id)) socket.join(room.id);
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
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la sala antes de terminar la partida.');
          return;
        }
        this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.end());
      });

      socket.on(PROTOCOL.SET_TAX_RATE, ({ roomId, taxRate }) => {
        const targetRoomId = roomId;
        const room = this.roomManager.getRoom(targetRoomId);

        if (room) {
          const accepted = room.gameState.setPlayerTaxRate(socket.id, taxRate);
          if (!accepted) {
            socket.emit(PROTOCOL.ACTION_ERROR, 'Los impuestos solo se pueden ajustar durante la planificación y dentro del rango permitido.');
            return;
          }
          const player = Array.from(room.gameState.players.values())
            .find((entry) => entry.socketId === socket.id);
          if (player) room.gameState.recordEvent(`${player.name} ajustó sus impuestos al ${Math.round(taxRate * 100)}%.`);
          this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
        }
      });

      socket.on(PROTOCOL.PLAYER_ACTION, ({ roomId, action } = {}) => {
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
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
        const room = this.roomManager.getRoom(roomId);
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de proponer un tratado.');
          return;
        }
        const result = room.gameState.proposeTreaty(socket.id, treaty);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.RESPOND_TO_TREATY, ({ roomId, offerId, accepted } = {}) => {
        const room = this.roomManager.getRoom(roomId);
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de responder a un tratado.');
          return;
        }
        const result = room.gameState.respondToTreaty(socket.id, offerId, accepted);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.CANCEL_TREATY_OFFER, ({ roomId, offerId } = {}) => {
        const room = this.roomManager.getRoom(roomId);
        if (!room || !socket.rooms.has(room.id)) {
          socket.emit(PROTOCOL.ACTION_ERROR, 'Únete a la partida antes de cancelar una propuesta.');
          return;
        }
        const result = room.gameState.cancelTreatyOffer(socket.id, offerId);
        socket.emit(result.ok ? PROTOCOL.ACTION_RESULT : PROTOCOL.ACTION_ERROR, result.message);
        if (result.ok) this.io.to(room.id).emit(PROTOCOL.GAME_STATE_UPDATE, room.gameState.getState());
      });

      socket.on(PROTOCOL.FINANCIAL_ACTION, ({ roomId, action } = {}, acknowledge = () => {}) => {
        const room = this.roomManager.getRoom(roomId);
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

      socket.on('disconnect', async () => {
        if (socket.data.lobbyRoomCode && socket.data.lobbyUserId) {
          try {
            const roomCode = socket.data.lobbyRoomCode;
            const result = await this.lobbyStore.disconnect(roomCode, socket.data.lobbyUserId);
            if (result.room) publishLobby(await this.lobbyStore.get(roomCode));
          } catch (error) {
            console.error('[Lobby] No se pudo guardar la desconexión:', error.message);
          }
        }
        for (const room of this.roomManager.rooms.values()) {
          const disconnectedPlayer = Array.from(room.gameState.players.values())
            .find((player) => player.socketId === socket.id);
          const disconnected = room.markPlayerDisconnected(socket.id);
          if (!disconnected) continue;
          if (room.gameState.gameStarted) {
            room.gameState.recordEvent(`${disconnectedPlayer?.name || 'Un jugador'} se desconectó; su país queda reservado mientras vuelve.`);
          }
          room.enforcePauseEligibility();
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
