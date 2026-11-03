import { LAND_TERRAIN } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine as OI } from './InternationalOrganizationEngine.js';

/** All legal departures precede any arrival, independent of country iteration order. */
export function resolveLandMovements(state, orders) {
  const results = new Map();
  const accepted = [];
  const pactsAtStart = [...state.nonAggressionPacts];
  const chargedBreaches = new Set();
  const reserved = new Map();
  for (const order of orders) {
    const { player, action } = order;
    const source = state.grid[action.y]?.[action.x];
    const target = state.grid[action.targetY]?.[action.targetX];
    let reason = null;
    const sourceKey = `${player.id}:${action.x}:${action.y}`;
    if (!source || !target || !LAND_TERRAIN.has(source.type) || !LAND_TERRAIN.has(target.type)
      || Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y)) !== 1) {
      reason = 'El origen o el destino del movimiento ya no es válido.';
    } else if (OI.isInActiveDmz(state, source.x, source.y) || OI.isInActiveDmz(state, target.x, target.y)) {
      reason = 'El movimiento atraviesa una Zona Desmilitarizada.';
    } else if (!Number.isInteger(action.troops) || action.troops < 1
      || action.troops > state.getTroopsForPlayerOnTile(source, player.id) - (reserved.get(sourceKey) || 0)) {
      reason = 'No hay suficientes tropas disponibles en el origen.';
    }
    if (reason) { results.set(order, { ok: false, message: reason }); continue; }
    reserved.set(sourceKey, (reserved.get(sourceKey) || 0) + action.troops);
    accepted.push({ order, source, sourceOwnerId: source.ownerId, target });
  }

  // Invalid orders never depart. Reinforcements arriving later cannot fund departures.
  for (const { order, source } of accepted) {
    state.removeTroopsFromPlayerOnTile(source, order.player.id, order.action.troops);
  }
  const destinations = new Map();
  for (const movement of accepted) {
    const key = `${movement.target.x}:${movement.target.y}`;
    const group = destinations.get(key) || [];
    group.push(movement);
    destinations.set(key, group);
  }

  for (const movements of destinations.values()) {
    const target = movements[0].target;
    const ownerBefore = target.ownerId;
    const forces = new Map([...state.players.keys()].map((id) => [id, state.getTroopsForPlayerOnTile(target, id)]));
    for (const { order } of movements) {
      forces.set(order.player.id, (forces.get(order.player.id) || 0) + order.action.troops);
    }
    const armies = [...forces].filter(([, count]) => count > 0).sort(([left], [right]) => left.localeCompare(right));
    const total = armies.reduce((sum, [, count]) => sum + count, 0);
    // In a two-country battle the survivor count is exactly abs(A - B).
    // With more countries a force must exceed all opposing troops combined.
    const winner = armies.find(([, count]) => count > total - count);
    const winnerId = winner?.[0] || null;
    const survivors = winner ? winner[1] - (total - winner[1]) : 0;
    const fought = armies.length > 1;

    for (const { order, sourceOwnerId } of movements) {
      const opponents = new Set(armies.map(([id]) => id).filter((id) => id !== order.player.id));
      if (ownerBefore != null && ownerBefore !== order.player.id) opponents.add(ownerBefore);
      if (sourceOwnerId != null && sourceOwnerId !== order.player.id) {
        state.registerMilitaryConflict(order.player, sourceOwnerId);
      }
      for (const opponentId of opponents) {
        state.registerMilitaryConflict(order.player, opponentId);
        const breachKey = `${order.player.id}:${opponentId}`;
        if (!chargedBreaches.has(breachKey)) {
          state.breakNonAggressionPact(order.player, opponentId, pactsAtStart);
          chargedBreaches.add(breachKey);
        }
      }
    }
    target.troops = survivors;
    delete target.visitingTroops;
    if (winnerId) {
      target.ownerId = winnerId;
      target.nationId = state.players.get(winnerId).nationId;
    }
    const combat = fought ? {
      simultaneous: true, x: target.x, y: target.y,
      participants: armies.map(([playerId, troops]) => ({ playerId, troops, survivors: playerId === winnerId ? survivors : 0 })),
      winnerId
    } : null;
    if (fought) {
      const forcesText = armies.map(([id, count]) => `${state.players.get(id).name}: ${count}`).join(' contra ');
      state.recordEvent(`Combate en (${target.x}, ${target.y}): ${forcesText}. ${winnerId
        ? `${state.players.get(winnerId).name} conserva ${survivors} ${survivors === 1 ? 'tropa' : 'tropas'} y controla la casilla.`
        : 'Todas las tropas fueron eliminadas; la casilla conserva su propietario anterior.'}`);
    }
    for (const { order } of movements) {
      const opponentId = armies.find(([id]) => id !== order.player.id)?.[0] || ownerBefore;
      results.set(order, {
        ok: true,
        message: fought ? (winnerId === order.player.id ? 'Combate ganado.' : winnerId ? 'Combate perdido.' : 'Ambas fuerzas eliminadas.')
          : winnerId !== ownerBefore ? 'Territorio conquistado sin combate.' : 'Tropas trasladadas.',
        claimed: winnerId === order.player.id && ownerBefore !== winnerId,
        ...(combat ? { combat: {
          ...combat, attackerId: order.player.id, defenderId: opponentId,
          attackerTroops: forces.get(order.player.id), defenderTroops: total - forces.get(order.player.id),
          attackerSurvivors: winnerId === order.player.id ? survivors : 0,
          defenderSurvivors: winnerId && winnerId !== order.player.id ? survivors : 0
        } } : {})
      });
    }
  }
  return results;
}
