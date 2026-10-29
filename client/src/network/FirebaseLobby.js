import { AVAILABLE_NATION_COLORS, NATIONS } from '../../../shared/Constants.js';

const SLOT_COUNT = 4;

function getFirebase() {
  if (!globalThis.firebase || !globalThis.PAX_FIREBASE_CONFIG?.apiKey) {
    return null;
  }
  if (!globalThis.firebase.apps.length) {
    globalThis.firebase.initializeApp(globalThis.PAX_FIREBASE_CONFIG);
  }
  return globalThis.firebase;
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
    this.disconnectHandle = null;
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
          creadaEn: this.firebase.database.ServerValue.TIMESTAMP,
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
    const ref = this.firebase.database().ref(`salas/${code}`);
    const result = await ref.transaction((room) => {
      if (!room || room.estado !== 'esperando') return;
      const players = room.jugadores || {};
      if (Object.values(players).some((player) => player?.id === this.playerId)) return room;
      const slot = Array.from({ length: SLOT_COUNT }, (_, index) => `slot_${index + 1}`)
        .find((slotName) => !players[slotName]);
      if (!slot) return;
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
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error('La sala no existe, está llena o ya inició.');
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
      if (!this.disconnectHandle) {
        const ownSlot = Object.entries(room.jugadores || {})
          .find(([, player]) => player?.id === this.playerId)?.[0];
        this.disconnectHandle = room.creador === this.playerId
          ? this.roomRef.onDisconnect().remove()
          : ownSlot
            ? this.roomRef.child(`jugadores/${ownSlot}`).onDisconnect().remove()
            : null;
      }
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
      createdAt: this.firebase.database.ServerValue.TIMESTAMP
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
      players[slot] = { ...players[slot], nombre: name, color, listo: false };
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
      players[ownSlot] = { ...players[ownSlot], listo: true };
      const humans = Object.values(players).filter((player) => player?.tipo === 'humano');
      if (!humans.length || humans.some((player) => !player.listo)) return;
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
    if (!result.committed) throw new Error('Todos los jugadores humanos deben pulsar Jugar.');
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
    this.disconnectHandle = null;
  }

  async leaveRoom() {
    if (!this.roomRef) return;
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');

    const ref = this.roomRef;
    const snapshot = await ref.once('value');
    const room = snapshot.val();
    if (room) {
      if (room.creador === this.playerId) {
        await ref.remove();
      } else {
        const ownSlot = Object.entries(room.jugadores || {})
          .find(([, player]) => player?.id === this.playerId)?.[0];
        if (ownSlot) await ref.child(`jugadores/${ownSlot}`).remove();
      }
    }
    this.stopWatching();
  }

  destroy() {
    this.stopWatching();
  }
}

export { normalizeCode };
