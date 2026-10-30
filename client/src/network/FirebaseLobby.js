import { AVAILABLE_NATION_COLORS, NATIONS } from '../../../shared/Constants.js';

const SLOT_COUNT = 4;

function getFirebase() {
  if (!globalThis.firebase || !globalThis.PAX_FIREBASE_CONFIG?.apiKey) {
    return null;
  }
  const firebase = globalThis.firebase;
  const config = globalThis.PAX_FIREBASE_CONFIG;
  const matchesConfig = (app) => app.options.projectId === config.projectId
    && app.options.databaseURL === config.databaseURL;
  let app = firebase.apps.find(matchesConfig);

  if (!app) {
    const appName = 'pax-game';
    app = firebase.apps.find((candidate) => candidate.name === appName);
    if (app) {
      throw new Error(
        `La app Firebase "${appName}" ya está inicializada para otro proyecto. `
        + `Se esperaba ${config.projectId} (${config.databaseURL}).`
      );
    }
    app = firebase.initializeApp(config, appName);
  }

  return {
    app,
    auth: () => firebase.auth(app),
    database: () => firebase.database(app)
  };
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function createCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `PAX${Array.from({ length: 3 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')}`;
}

function emptySlots(players = {}) {
  return Array.from({ length: SLOT_COUNT }, (_, index) => players[`slot_${index + 1}`] || null);
}

function getAvailableColor(players = {}, preferredColor) {
  const usedColors = new Set(Object.values(players).map((player) => player?.color).filter(Boolean));
  if (preferredColor && AVAILABLE_NATION_COLORS.includes(preferredColor) && !usedColors.has(preferredColor)) {
    return preferredColor;
  }
  return AVAILABLE_NATION_COLORS.find((color) => !usedColors.has(color)) || AVAILABLE_NATION_COLORS[0];
}

export class FirebaseLobby {
  constructor({ playerId, playerName = 'alpha', onChange, onChatMessage, onError }) {
    this.firebase = getFirebase();
    this.playerId = playerId;
    this.playerName = playerName;
    this.onChange = onChange;
    this.onChatMessage = onChatMessage;
    this.onError = onError;
    this.roomCode = null;
    this.roomRef = null;
    this.unsubscribe = null;
    this.chatRef = null;
    this.chatUnsubscribe = null;
    this.authError = null;
    this.ready = this.firebase
      ? this.firebase.auth().signInAnonymously().catch((error) => {
      this.authError = error;
      return null;
      })
      : Promise.resolve(null);
  }

  get enabled() {
    return Boolean(this.firebase);
  }

  async createRoom({ privada = true } = {}) {
    if (!this.firebase) throw new Error('Firebase no está configurado.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const database = this.firebase.database();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createCode();
      const ref = database.ref(`salas/${code}`);
      const result = await ref.transaction((room) => {
        if (room) return;
        return {
          creador: this.playerId,
          privada,
          estado: 'esperando',
          rondaActual: 1,
          creadaEn: globalThis.firebase.database.ServerValue.TIMESTAMP,
          jugadores: {
            slot_1: { id: this.playerId, nombre: this.playerName, color: AVAILABLE_NATION_COLORS[0], tipo: 'humano', listo: false }
          }
        };
      });
      if (result.committed) {
        await this.watchRoom(code);
        return code;
      }
    }
    throw new Error('No se pudo generar un código de sala disponible.');
  }

  async quickMatch() {
    if (!this.firebase) throw new Error('Firebase no está configurado.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const snapshot = await this.firebase.database().ref('salas')
      .orderByChild('estado').equalTo('esperando').once('value');
    const rooms = snapshot.val() || {};
    const candidates = Object.entries(rooms)
      .filter(([, room]) => room?.privada === false
        && Object.values(room.jugadores || {}).filter(Boolean).length < SLOT_COUNT)
      .sort(([, left], [, right]) => (left.creadaEn || 0) - (right.creadaEn || 0));
    for (const [code] of candidates) {
      try {
        return await this.joinRoom(code);
      } catch (error) {
        if (!/no existe|llena|ya inició/i.test(error.message)) throw error;
      }
    }
    return this.createRoom({ privada: false });
  }

  async joinRoom(rawCode) {
    if (!this.firebase) throw new Error('Firebase no está configurado.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const code = normalizeCode(rawCode);
    if (code.length !== 6) throw new Error('El código debe tener 6 caracteres.');
    const { projectId, databaseURL: databaseUrl } = this.firebase.app.options;
    const ref = this.firebase.database().ref(`salas/${code}`);
    const initialSnapshot = await ref.get();
    if (!initialSnapshot.exists()) {
      throw new Error(
        `No se encontró /salas/${code}. El cliente consultó el proyecto "${projectId}" `
        + `en ${databaseUrl}. Comprueba que la sala esté guardada en esa ruta exacta.`
      );
    }
    let usedInitialSnapshot = false;
    let rejectionReason = '';
    const result = await ref.transaction((currentRoom) => {
      rejectionReason = '';
      let room = currentRoom;
      // A server-confirmed get() is not necessarily in the Realtime Database
      // client's transaction cache. Seed the first null callback with that
      // snapshot; the transaction hash check will retry against newer server data.
      if (!room) {
        if (!usedInitialSnapshot) {
          room = initialSnapshot.val();
          usedInitialSnapshot = true;
        }
        if (!room) {
          rejectionReason = 'La sala fue eliminada mientras intentabas entrar.';
          return;
        }
      }
      if (!['esperando', 'en_juego'].includes(room.estado)) {
        rejectionReason = 'La sala no está abierta para nuevos jugadores.';
        return;
      }
      const players = room.jugadores || {};
      if (Object.values(players).some((player) => player?.id === this.playerId)) return room;
      const slots = Array.from({ length: SLOT_COUNT }, (_, index) => `slot_${index + 1}`);
      const slot = room.estado === 'en_juego'
        ? slots.find((slotName) => players[slotName]?.tipo === 'bot')
          || slots.find((slotName) => !players[slotName])
        : slots.find((slotName) => !players[slotName]);
      if (!slot) {
        rejectionReason = 'La sala está llena; no quedan países disponibles.';
        return;
      }
      return {
        ...room,
        jugadores: {
          ...players,
          [slot]: {
            id: this.playerId,
            nombre: this.playerName,
            color: getAvailableColor(players),
            tipo: 'humano',
            listo: false
          }
        }
      };
    });
    const committedRoom = result.snapshot.val();
    const alreadyJoined = Object.values(committedRoom?.jugadores || {})
      .some((player) => player?.id === this.playerId);
    if (!result.committed && result.snapshot.exists() && alreadyJoined) {
      await this.watchRoom(code);
      return code;
    }
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error(
        `La sala /salas/${code} sí fue encontrada en "${projectId}" (${databaseUrl}), `
        + `pero no se pudo reservar un país: ${rejectionReason || 'inténtalo de nuevo.'}`
      );
    }
    await this.watchRoom(code);
    return code;
  }

  async watchRoom(code) {
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    this.stopWatching();
    this.roomCode = normalizeCode(code);
    this.roomRef = this.firebase.database().ref(`salas/${this.roomCode}`);
    this.watchChat();
    this.unsubscribe = this.roomRef.on('value', (snapshot) => {
      const room = snapshot.val();
      if (!room) {
        this.onError?.(new Error('La sala ya no existe.'));
        return;
      }
      this.onChange?.({
        ...room,
        code: this.roomCode,
        slots: emptySlots(room.jugadores),
        isHost: room.creador === this.playerId
      });
    });
  }

  watchChat() {
    if (!this.roomRef) return;
    this.chatRef = this.roomRef.child('mensajes');
    this.chatQuery = this.chatRef.limitToLast(100);
    this.chatUnsubscribe = (snapshot) => {
      const message = snapshot.val();
      if (message) this.onChatMessage?.({ id: snapshot.key, ...message });
    };
    this.chatQuery.on('child_added', this.chatUnsubscribe);
  }

  async sendChatMessage(message) {
    if (!this.chatRef) throw new Error('Primero debes entrar a una sala.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    await this.chatRef.push({
      playerId: this.playerId,
      nationName: message.nationName,
      nationColor: message.nationColor,
      text: message.text,
      createdAt: globalThis.firebase.database.ServerValue.TIMESTAMP
    });
  }

  async updateProfile({ name, color }) {
    if (!this.roomRef) throw new Error('Primero debes entrar a una sala.');
    await this.ready;
    const result = await this.roomRef.transaction((room) => {
      if (!room || room.estado !== 'esperando') return;
      const players = { ...(room.jugadores || {}) };
      const slot = Object.keys(players).find((key) => players[key]?.id === this.playerId);
      if (!slot) return;
      if (!AVAILABLE_NATION_COLORS.includes(color)) return;
      if (Object.entries(players).some(([playerSlot, player]) => (
        playerSlot !== slot && player?.color === color
      ))) return;
      const currentPlayer = players[slot];
      const profileChanged = currentPlayer.nombre !== name || currentPlayer.color !== color;
      players[slot] = {
        ...currentPlayer,
        nombre: name,
        color,
        listo: profileChanged ? false : Boolean(currentPlayer.listo)
      };
      return { ...room, jugadores: players };
    });
    if (!result.committed) throw new Error('No se pudo actualizar tu país.');
  }

  async startGame() {
    if (!this.roomRef) throw new Error('Primero debes entrar a una sala.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const result = await this.roomRef.transaction((room) => {
      if (!room || room.estado !== 'esperando') return;
      const players = { ...(room.jugadores || {}) };
      const ownSlot = Object.keys(players).find((key) => players[key]?.id === this.playerId);
      if (!ownSlot) return;
      const ready = !players[ownSlot].listo;
      players[ownSlot] = { ...players[ownSlot], listo: ready };
      if (!ready) return { ...room, jugadores: players };
      const humans = Object.values(players).filter((player) => player?.tipo === 'humano');
      if (!humans.length || humans.some((player) => !player.listo)) {
        return { ...room, jugadores: players };
      }
      for (let index = 0; index < SLOT_COUNT; index += 1) {
        const slot = `slot_${index + 1}`;
        if (!players[slot]) {
          const color = getAvailableColor(players, NATIONS[index].color);
          players[slot] = {
            id: `BOT_${index + 1}`,
            nombre: NATIONS[index].name,
            color,
            tipo: 'bot',
            listo: true
          };
        }
      }
      return { ...room, jugadores: players, estado: 'en_juego', rondaActual: 1 };
    });
    if (!result.committed) throw new Error('Todos los jugadores humanos deben estar listos.');
  }

  async returnToLobbyForReplay() {
    if (!this.roomRef) throw new Error('Primero debes entrar a una sala.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const result = await this.roomRef.transaction((room) => {
      if (!room || room.estado !== 'en_juego') return;
      const jugadores = Object.fromEntries(
        Object.entries(room.jugadores || {})
          .filter(([, player]) => player?.tipo === 'humano')
          .map(([slot, player]) => [slot, { ...player, listo: false }])
      );
      return { ...room, estado: 'esperando', rondaActual: 1, jugadores };
    });
    if (!result.committed) throw new Error('La sala ya no está disponible para otra partida.');
  }

  stopWatching() {
    if (this.roomRef && this.unsubscribe) this.roomRef.off('value', this.unsubscribe);
    if (this.chatQuery && this.chatUnsubscribe) this.chatQuery.off('child_added', this.chatUnsubscribe);
    this.roomRef = null;
    this.unsubscribe = null;
    this.chatRef = null;
    this.chatQuery = null;
    this.chatUnsubscribe = null;
  }

  async leaveRoom() {
    if (!this.roomRef) return;
    const ref = this.roomRef;
    const playerId = this.playerId;
    this.stopWatching();
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');

    const snapshot = await ref.once('value');
    const room = snapshot.val();
    if (room) {
      if (room.creador === playerId) {
        await ref.remove();
      } else {
        const ownSlot = Object.entries(room.jugadores || {})
          .find(([, player]) => player?.id === playerId)?.[0];
        if (ownSlot) await ref.child(`jugadores/${ownSlot}`).remove();
      }
    }
  }

  destroy() {
    this.stopWatching();
  }
}

export { normalizeCode };
