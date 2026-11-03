/** Immutable start-of-round maps, after economy and before decisions. Only the requested round is sent to the client. */
export function captureRoundMap(state) {
  state.roundMapHistory ||= new Map();
  if (state.roundMapHistory.has(state.currentRound)) return;
  state.roundMapHistory.set(state.currentRound, structuredClone({
    round: state.currentRound,
    moment: 'start',
    grid: state.grid,
    players: [...state.players.values()].map(({ id, nationId, name, color }) => ({ id, nationId, name, color })),
    activeDmzZones: state.activeDmzZones
  }));
}

export function readRoundMap(room, socket, round) {
  if (!room || !socket.rooms.has(room.id)) return { ok: false, message: 'Únete a la partida para consultar su historial.' };
  if (!Number.isInteger(round)) return { ok: false, message: 'La ronda no es válida.' };
  const snapshot = room.gameState.roundMapHistory?.get(round);
  if (!snapshot) return { ok: false, message: 'El mapa de esa ronda no está disponible.' };
  return { ok: true, snapshot: structuredClone(snapshot) };
}
