import { ECONOMY, LAND_TERRAIN, TERRAIN_TYPES, WATER_TERRAIN } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine as OI } from './InternationalOrganizationEngine.js';

function hasLandRoute(grid, source, target, maxDistance) {
  const distance = Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y));
  if (distance < 1 || distance > maxDistance) return false;
  const dx = Math.sign(target.x - source.x);
  const dy = Math.sign(target.y - source.y);
  for (let step = 1; step <= distance; step += 1) {
    if (!LAND_TERRAIN.has(grid[source.y + dy * step]?.[source.x + dx * step]?.type)) return false;
  }
  return true;
}

export function awardNeutralResourceCapture(state, playerId, tile, previousOwnerId) {
  if (previousOwnerId != null || ![TERRAIN_TYPES.MPT, TERRAIN_TYPES.MPA].includes(tile?.type)) return false;
  const player = state.players.get(playerId);
  if (!player) return false;
  const reward = ECONOMY.REWARDS.RESOURCE_NODE_CAPTURE_MATERIALS;
  player.resources.MATERIALS += reward;
  state.recordEvent(
    `${player.name} obtuvo ${reward} Materiales al ocupar una materia prima neutral.`,
    { category: 'resource-capture', playerId, x: tile.x, y: tile.y, materials: reward }
  );
  return true;
}

export function claimNeutralTransitTiles(state, playerId, source, target, terrainSet) {
  const distance = Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y));
  if (distance <= 1) return;
  const dx = Math.sign(target.x - source.x);
  const dy = Math.sign(target.y - source.y);
  const player = state.players.get(playerId);
  for (let step = 1; step < distance; step += 1) {
    const tile = state.grid[source.y + dy * step]?.[source.x + dx * step];
    if (!tile || !terrainSet.has(tile.type) || tile.ownerId != null) continue;
    tile.ownerId = playerId;
    tile.nationId = player.nationId;
    awardNeutralResourceCapture(state, playerId, tile, null);
  }
}

/** Los transportes son botín de la casilla: no se destruyen con las tropas. */
export function transferVehiclesToWinner(tile, winnerId) {
  if (!tile || winnerId == null) return;
  for (const key of ['carsByPlayer', 'shipsByPlayer']) {
    const total = Object.values(tile[key] || {})
      .reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
    if (total > 0) tile[key] = { [winnerId]: total };
    else delete tile[key];
  }
  const cargo = Object.values(tile.transportedTroopsByPlayer || {})
    .reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  if (cargo > 0) tile.transportedTroopsByPlayer = { [winnerId]: cargo };
  else delete tile.transportedTroopsByPlayer;
}

export function applyCapitalConquest(state, winnerId, defeatedId, capitalTile) {
  if (!capitalTile || capitalTile.type !== TERRAIN_TYPES.CAP
    || winnerId == null || defeatedId == null || winnerId === defeatedId) return false;
  const winner = state.players.get(winnerId);
  const defeated = state.players.get(defeatedId);
  if (!winner || !defeated) return false;

  for (const tile of state.grid.flat()) {
    const hasDefeatedAssets = tile.carsByPlayer?.[defeatedId] != null
      || tile.shipsByPlayer?.[defeatedId] != null
      || tile.transportedTroopsByPlayer?.[defeatedId] != null;
    if (tile.ownerId === defeatedId || hasDefeatedAssets) transferVehiclesToWinner(tile, winnerId);
    if (tile.ownerId === defeatedId) {
      tile.ownerId = winnerId;
      tile.nationId = winner.nationId;
      tile.troops = 0;
      if (tile.visitingTroops) {
        delete tile.visitingTroops[defeatedId];
        if (!Object.keys(tile.visitingTroops).length) delete tile.visitingTroops;
      }
    }
    if (tile.visitingTroops?.[defeatedId] != null) {
      delete tile.visitingTroops[defeatedId];
      if (!Object.keys(tile.visitingTroops).length) delete tile.visitingTroops;
    }
    if (tile.shipsByPlayer?.[defeatedId] != null) {
      delete tile.shipsByPlayer[defeatedId];
      if (!Object.keys(tile.shipsByPlayer).length) delete tile.shipsByPlayer;
    }
    if (tile.transportedTroopsByPlayer?.[defeatedId] != null) {
      delete tile.transportedTroopsByPlayer[defeatedId];
      if (!Object.keys(tile.transportedTroopsByPlayer).length) delete tile.transportedTroopsByPlayer;
    }
  }

  capitalTile.type = TERRAIN_TYPES.CIU;
  capitalTile.building = 'CITY';
  capitalTile.defense = 2;
  defeated.isEliminated = true;
  defeated.phaseReady = true;
  defeated.plannedActions = [];
  state.recordEvent(
    `${winner.name} conquistó la capital de ${defeated.name}; ${defeated.name} fue eliminado y todo su territorio pasó a ${winner.name}.`,
    { category: 'elimination', winnerId, defeatedId, x: capitalTile.x, y: capitalTile.y }
  );
  return true;
}

/** All legal departures precede any arrival, independent of country iteration order. */
export function resolveLandMovements(state, orders) {
  const results = new Map();
  const accepted = [];
  const pactsAtStart = [...state.nonAggressionPacts];
  const chargedBreaches = new Set();
  const reserved = new Map();
  for (const order of orders) {
    const { player, action } = order;
    const isDisembark = order.movementType === 'disembark';
    const isCar = order.movementType === 'car';
    const source = state.grid[action.y]?.[action.x];
    const target = state.grid[action.targetY]?.[action.targetX];
    let reason = null;
    const sourceKey = `${player.id}:${action.x}:${action.y}`;
    if (!source || !target || (!isDisembark && !LAND_TERRAIN.has(source.type))
      || (isDisembark && !WATER_TERRAIN.has(source.type)) || !LAND_TERRAIN.has(target.type)
      || (!isCar && Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y)) !== 1)
      || (isCar && !hasLandRoute(state.grid, source, target, ECONOMY.GROUND_TRANSPORT.MAX_MOVE_DISTANCE))) {
      reason = 'El origen o el destino del movimiento ya no es válido.';
    } else if (OI.isInActiveDmz(state, source.x, source.y) || OI.isInActiveDmz(state, target.x, target.y)) {
      reason = 'El movimiento atraviesa una Zona Desmilitarizada.';
    } else if (isDisembark) {
      const cargo = source.transportedTroopsByPlayer?.[player.id] || 0;
      if (state.getShipsForPlayerOnTile(source, player.id) < 1
        || !Number.isInteger(action.troops) || action.troops < 1
        || action.troops > cargo - (reserved.get(sourceKey) || 0)) {
        reason = 'No hay suficientes tropas embarcadas disponibles para desembarcar.';
      }
    } else if (isCar && (!Number.isInteger(action.troops) || action.troops < 1
        || action.troops > state.getTroopsForPlayerOnTile(source, player.id)
        || (source.carsByPlayer?.[player.id] || 0) < Math.ceil(action.troops / ECONOMY.GROUND_TRANSPORT.TROOPS_PER_CAR))) {
      reason = 'No hay suficientes tropas o carros disponibles para el movimiento.';
    } else if (!Number.isInteger(action.troops) || action.troops < 1
        || action.troops > state.getTroopsForPlayerOnTile(source, player.id) - (reserved.get(sourceKey) || 0)) {
        reason = 'No hay suficientes tropas disponibles en el origen.';
    }
    if (reason) { results.set(order, { ok: false, message: reason }); continue; }
    reserved.set(sourceKey, (reserved.get(sourceKey) || 0) + action.troops);
    accepted.push({ order, source, sourceOwnerId: source.ownerId, target,
      movedCars: isCar ? Math.ceil(order.action.troops / ECONOMY.GROUND_TRANSPORT.TROOPS_PER_CAR) : 0 });
  }

  // Invalid orders never depart. Reinforcements arriving later cannot fund departures.
  for (const { order, source } of accepted) {
    if (order.movementType === 'disembark') {
      source.transportedTroopsByPlayer[order.player.id] -= order.action.troops;
      if (source.transportedTroopsByPlayer[order.player.id] <= 0) {
        delete source.transportedTroopsByPlayer[order.player.id];
      }
    } else {
      state.removeTroopsFromPlayerOnTile(source, order.player.id, order.action.troops);
      if (order.movementType === 'car') {
        const cars = Math.ceil(order.action.troops / ECONOMY.GROUND_TRANSPORT.TROOPS_PER_CAR);
        source.carsByPlayer[order.player.id] -= cars;
        if (source.carsByPlayer[order.player.id] <= 0) delete source.carsByPlayer[order.player.id];
        if (!Object.keys(source.carsByPlayer).length) delete source.carsByPlayer;
      }
    }
  }
  const destinations = new Map();
  for (const movement of accepted) {
    const key = `${movement.target.x}:${movement.target.y}`;
    const group = destinations.get(key) || [];
    group.push(movement);
    destinations.set(key, group);
  }

  for (const movements of destinations.values()) {
    const activeMovements = movements.filter(({ order }) => !order.player.isEliminated);
    for (const movement of movements.filter(({ order }) => order.player.isEliminated)) {
      results.set(movement.order, {
        ok: false,
        message: 'La acción no se realizó porque tu país fue eliminado.'
      });
    }
    if (!activeMovements.length) continue;
    const target = activeMovements[0].target;
    const movedCars = activeMovements.reduce((sum, movement) => sum + movement.movedCars, 0);
    const ownerBefore = target.ownerId;
    const forces = new Map([...state.players.keys()].map((id) => [id, state.getTroopsForPlayerOnTile(target, id)]));
    for (const { order } of activeMovements) {
      forces.set(order.player.id, (forces.get(order.player.id) || 0) + order.action.troops);
    }
    const hostileArrival = activeMovements.some(({ order }) => ownerBefore != null && order.player.id !== ownerBefore);
    const fixedDefense = hostileArrival ? Math.max(0, Number(target.defense) || 0) : 0;
    const strengths = new Map(forces);
    if (ownerBefore != null && fixedDefense > 0) {
      strengths.set(ownerBefore, (strengths.get(ownerBefore) || 0) + fixedDefense);
    }
    const combatants = [...strengths]
      .filter(([, strength]) => strength > 0)
      .sort(([left], [right]) => left.localeCompare(right));
    const total = combatants.reduce((sum, [id]) => sum + strengths.get(id), 0);
    // Fixed defense contributes to the defensive strength but is never spent.
    const winner = combatants.find(([id]) => strengths.get(id) > total - strengths.get(id));
    const winnerId = winner?.[0] || null;
    const survivorStrength = winner ? strengths.get(winnerId) - (total - strengths.get(winnerId)) : 0;
    const survivors = winnerId === ownerBefore
      ? Math.max(0, survivorStrength - fixedDefense)
      : survivorStrength;
    const fought = combatants.length > 1;

    for (const { order, sourceOwnerId } of activeMovements) {
      const opponents = new Set(combatants.map(([id]) => id).filter((id) => id !== order.player.id));
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
    if (!winnerId && movedCars > 0) {
      // Un empate elimina las tropas, pero los carros regresan a sus orígenes.
      for (const movement of activeMovements) if (movement.movedCars > 0) {
        movement.source.carsByPlayer ||= {};
        movement.source.carsByPlayer[movement.order.player.id] = (
          movement.source.carsByPlayer[movement.order.player.id] || 0
        ) + movement.movedCars;
      }
    }
    target.troops = survivors;
    delete target.visitingTroops;
    if (winnerId) {
      target.ownerId = winnerId;
      target.nationId = state.players.get(winnerId).nationId;
      transferVehiclesToWinner(target, winnerId);
      if (movedCars > 0) {
        target.carsByPlayer ||= {};
        target.carsByPlayer[winnerId] = (target.carsByPlayer[winnerId] || 0) + movedCars;
      }
      applyCapitalConquest(state, winnerId, ownerBefore, target);
      awardNeutralResourceCapture(state, winnerId, target, ownerBefore);
    }
    const combat = fought ? {
      simultaneous: true, x: target.x, y: target.y,
      participants: combatants.map(([playerId]) => ({
        playerId,
        troops: forces.get(playerId) || 0,
        survivors: playerId === winnerId ? survivors : 0
      })),
      defense: fixedDefense,
      winnerId
    } : null;
    if (fought) {
      const forcesText = combatants.map(([id]) => `${state.players.get(id).name}: ${forces.get(id) || 0}${id === ownerBefore && fixedDefense ? ` + ${fixedDefense} defensa` : ''}`).join(' contra ');
      state.recordEvent(`Combate en (${target.x}, ${target.y}): ${forcesText}. ${winnerId
        ? `${state.players.get(winnerId).name} conserva ${survivors} ${survivors === 1 ? 'tropa' : 'tropas'} y controla la casilla.`
        : 'Todas las tropas fueron eliminadas; la casilla conserva su propietario anterior.'}`);
    }
    for (const { order } of activeMovements) {
      const opponentId = combatants.find(([id]) => id !== order.player.id)?.[0] || ownerBefore;
      results.set(order, {
        ok: true,
        message: fought ? (winnerId === order.player.id ? 'Combate ganado.' : winnerId ? 'Combate perdido.' : 'Ambas fuerzas eliminadas.')
          : winnerId !== ownerBefore ? 'Territorio conquistado sin combate.' : 'Tropas trasladadas.',
        claimed: winnerId === order.player.id && ownerBefore !== winnerId,
        ...(combat ? { combat: {
          ...combat, attackerId: order.player.id, defenderId: opponentId,
          attackerTroops: forces.get(order.player.id),
          defenderTroops: [...forces].filter(([id]) => id !== order.player.id)
            .reduce((sum, [, count]) => sum + count, 0),
          defense: fixedDefense,
          attackerSurvivors: winnerId === order.player.id ? survivors : 0,
          defenderSurvivors: winnerId && winnerId !== order.player.id ? survivors : 0
        } } : {})
      });
      if (order.movementType === 'car' && winnerId === order.player.id) {
        claimNeutralTransitTiles(state, order.player.id, movements.find((movement) => movement.order === order).source, target, LAND_TERRAIN);
      }
    }
  }
  return results;
}

