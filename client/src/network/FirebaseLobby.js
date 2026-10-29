const SLOT_COUNT = 4;
const NATIONS = [
  'Nación Amarilla',
  'Nación Azul',
  'Nación Roja',
  'Nación Verde'
];

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

export class FirebaseLobby {
  constructor({ playerId, playerName = 'Nación Alpha', onChange, onError }) {
    this.firebase = getFirebase();
    this.playerId = playerId;
    this.playerName = playerName;
    this.onChange = onChange;
    this.onError = onError;
    this.roomCode = null;
    this.roomRef = null;
    this.unsubscribe = null;
    this.disconnectHandle = null;
    this.authError = null;
    this.ready = this.firebase.auth().signInAnonymously().catch((error) => {
      this.authError = error;
      return null;
    });
  }

  get enabled() {
    return Boolean(this.firebase);
  }

  async createRoom() {
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
          estado: 'esperando',
          rondaActual: 1,
          jugadores: {
            slot_1: { id: this.playerId, nombre: this.playerName, tipo: 'humano' }
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
          [slot]: { id: this.playerId, nombre: this.playerName, tipo: 'humano' }
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

  async startGame() {
    if (!this.roomRef) throw new Error('Primero debes entrar a una sala.');
    await this.ready;
    if (this.authError) throw new Error('Firebase no permite autenticación anónima.');
    const result = await this.roomRef.transaction((room) => {
      if (!room || room.creador !== this.playerId || room.estado !== 'esperando') return;
      const players = { ...(room.jugadores || {}) };
      for (let index = 0; index < SLOT_COUNT; index += 1) {
        const slot = `slot_${index + 1}`;
        if (!players[slot]) {
          players[slot] = {
            id: `BOT_${index + 1}`,
            nombre: `${NATIONS[index]} (Bot)`,
            tipo: 'bot'
          };
        }
      }
      return { ...room, jugadores: players, estado: 'en_juego', rondaActual: 1 };
    });
    if (!result.committed) throw new Error('Solo el creador puede iniciar esta sala.');
  }

  stopWatching() {
    if (this.roomRef && this.unsubscribe) this.roomRef.off('value', this.unsubscribe);
    this.roomRef = null;
    this.unsubscribe = null;
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
