/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { ACTION_SLOT_COUNT, ECONOMY, GAME_PHASES, LAND_TERRAIN, TREATY_TYPES, TERRAIN_TYPES, WATER_TERRAIN } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';
import { createEmptyActionSlots } from './GameStateUtils.js';

function isDiagonalOrOrthogonalStep(source, destination) {
  const deltaX = Math.abs(source.x - destination.x);
  const deltaY = Math.abs(source.y - destination.y);
  return Math.max(deltaX, deltaY) === 1;
}

export const ActionEngine = {
  performPlayerAction(socketId, action) {
    const player = Array.from(this.players.values()).find((entry) => entry.socketId === socketId);
    if (!player) return { ok: false, message: 'No tienes un país asignado.' };
    if (!this.gameStarted) return { ok: false, message: 'La partida todavía no ha comenzado.' };
    if (this.currentPhase !== 2) return { ok: false, message: 'Las acciones solo están disponibles en la fase de planificación.' };
    if (!action || action.type !== 'PLAN_ACTION') {
      return { ok: false, message: 'La orden de planificación no es válida.' };
    }
    const { slot, plannedAction } = action;
    if (!Number.isInteger(slot) || slot < 0 || slot >= ACTION_SLOT_COUNT) {
      return { ok: false, message: `Selecciona uno de los ${ACTION_SLOT_COUNT} espacios de acción.` };
    }

    player.plannedActions = Array.from(
      { length: ACTION_SLOT_COUNT },
      (_, index) => player.plannedActions?.[index] ?? null
    );
    if (plannedAction == null) {
      player.plannedActions[slot] = null;
      return { ok: true, message: `Espacio ${slot + 1} de acción vaciado.` };
    }
    if (typeof plannedAction.type !== 'string') {
      return { ok: false, message: 'La acción no es válida.' };
    }

    const validation = this.validatePlannedAction(player, plannedAction, slot);
    if (!validation.ok) return validation;

    player.plannedActions[slot] = { ...plannedAction };
    const name = this.getActionName(plannedAction.type);
    return {
      ok: true,
      message: `${name} guardada en el espacio ${slot + 1}. Se ejecutará cuando termine el tiempo de planificación.`
    };
  },

  getActionName(type) {
    const names = {
      BUILD_CITY: 'Construir ciudad',
      BUILD_FACTORY: 'Construir fábrica',
      RECRUIT_TROOP: 'Reclutar tropa',
      BUILD_SHIP: 'Construir barco',
      MOVE_CAPITAL: 'Trasladar capital',
      MOVE_TROOPS: 'Mover tropas',
      MOVE_SHIPS: 'Mover barcos',
      EMBARK_TROOPS: 'Embarcar tropas',
      DISEMBARK_TROOPS: 'Desembarcar tropas',
      HOLD_POSITION: 'Mantener posición'
    };
    return names[type] || 'Acción';
  },

  validatePlannedAction(player, action, slot) {
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    const tile = this.grid[action.y]?.[action.x];
    if (!tile) {
      return { ok: false, message: 'La casilla seleccionada no es válida.' };
    }
    if (action.type === 'MOVE_TROOPS' || action.type === 'EMBARK_TROOPS') {
      const transported = tile.transportedTroopsByPlayer?.[player.id] || 0;
      if (this.getTroopsForPlayerOnTile(tile, player.id) <= 0 && transported <= 0) {
        return { ok: false, message: 'No hay tropas propias en la casilla de origen.' };
      }
    } else if (action.type === 'MOVE_SHIPS' || action.type === 'DISEMBARK_TROOPS') {
      if (this.getShipsForPlayerOnTile(tile, player.id) <= 0) {
        return { ok: false, message: 'No hay barcos propios en la casilla de origen.' };
      }
    } else if (tile.ownerId !== player.id) {
      return { ok: false, message: 'Solo puedes planificar acciones sobre tu propio territorio.' };
    }

    const otherActions = (player.plannedActions || [])
      .filter((planned, index) => planned && index !== slot);
    const structureActions = ['BUILD_CITY', 'BUILD_FACTORY', 'BUILD_SHIP', 'MOVE_CAPITAL'];
    const usesStructureSlot = structureActions.includes(action.type);
    if (otherActions.some((planned) => (
      planned.x === action.x
      && planned.y === action.y
      && usesStructureSlot
      && structureActions.includes(planned.type)
    ))) {
      return { ok: false, message: 'Ya hay otra acción incompatible planificada para esa casilla.' };
    }

    let silverCost = 0;
    let materialCost = 0;
    switch (action.type) {
      case 'BUILD_CITY':
        if (tile.type !== TERRAIN_TYPES.TR || tile.building) {
          return { ok: false, message: 'Solo puedes construir una ciudad en tierra vacía.' };
        }
        silverCost = ECONOMY.COSTS.BUILD_CITY_SILVER;
        break;
      case 'BUILD_FACTORY':
        if (![TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA].includes(tile.type)
          || tile.building) {
          return { ok: false, message: 'No puedes construir una fábrica en esta casilla.' };
        }
        if (this.oiPolicies.industryLimit != null) {
          const plannedFactories = otherActions.filter(
            (planned) => planned.type === 'BUILD_FACTORY'
          ).length;
          if (
            InternationalOrganizationEngine.countFactories(this, player.id) + plannedFactories + 1
            > this.oiPolicies.industryLimit
          ) {
            return { ok: false, message: `El límite de industria es de ${this.oiPolicies.industryLimit} fábricas.` };
          }
        }
        silverCost = tile.type === TERRAIN_TYPES.MPT || tile.type === TERRAIN_TYPES.MPA
          ? ECONOMY.COSTS.BUILD_FACTORY_RESOURCE_SILVER
          : ECONOMY.COSTS.BUILD_FACTORY_SILVER;
        break;
      case 'BUILD_SHIP': {
        const count = action.count ?? 1;
        if (!Number.isInteger(count) || count < 1) {
          return { ok: false, message: 'La cantidad de barcos no es válida.' };
        }
        if (!this.getShipyardWaterTile(tile, player.id)) {
          return { ok: false, message: 'Necesitas una fábrica costera propia para construir barcos.' };
        }
        action.count = count;
        silverCost = ECONOMY.COSTS.BUILD_SHIP_SILVER * count;
        materialCost = ECONOMY.COSTS.BUILD_SHIP_MATERIALS * count;
        break;
      }
      case 'RECRUIT_TROOP':
        {
          const count = action.count ?? 1;
          if (!Number.isInteger(count) || count < 1) {
            return { ok: false, message: 'La cantidad de tropas a reclutar no es válida.' };
          }
          if (!LAND_TERRAIN.has(tile.type)) {
            return { ok: false, message: 'Las tropas solo pueden reclutarse en casillas terrestres.' };
          }
          if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) {
            return { ok: false, message: 'No puedes reclutar tropas dentro de una Zona Desmilitarizada.' };
          }
          action.count = count;
          if (this.oiPolicies.armamentLimit != null) {
            const plannedRecruitment = otherActions
              .filter((planned) => planned.type === 'RECRUIT_TROOP')
              .reduce((sum, planned) => sum + (planned.count ?? 1), 0);
            if (
              InternationalOrganizationEngine.countTroops(this, player.id)
              + plannedRecruitment
              + count
              > this.oiPolicies.armamentLimit
            ) {
              return { ok: false, message: `El límite de armamento es de ${this.oiPolicies.armamentLimit} tropas.` };
            }
          }
          silverCost = ECONOMY.COSTS.RECRUIT_TROOP_SILVER * count;
          materialCost = ECONOMY.COSTS.RECRUIT_TROOP_MATERIALS * count;
        }
        break;
      case 'MOVE_CAPITAL':
        if (tile.type !== TERRAIN_TYPES.CIU) {
          return { ok: false, message: 'Selecciona una ciudad propia para trasladar la capital.' };
        }
        silverCost = ECONOMY.COSTS.MOVE_CAPITAL_SILVER;
        materialCost = ECONOMY.COSTS.MOVE_CAPITAL_MATERIALS;
        break;
      case 'MOVE_TROOPS': {
        const destination = this.grid[action.targetY]?.[action.targetX];
        if (!destination) return { ok: false, message: 'Selecciona una casilla de destino válida.' };
        if (!isDiagonalOrOrthogonalStep(tile, destination)) {
          return { ok: false, message: 'El destino debe ser una casilla terrestre adyacente, incluso en diagonal.' };
        }
        if (WATER_TERRAIN.has(destination.type)) {
          if (!LAND_TERRAIN.has(tile.type)) {
            return { ok: false, message: 'Las tropas solo pueden embarcar desde tierra.' };
          }
          const ships = this.getShipsForPlayerOnTile(destination, player.id);
          const carried = destination.transportedTroopsByPlayer?.[player.id] || 0;
          const troops = action.troops ?? this.getTroopsForPlayerOnTile(tile, player.id);
          if (ships < 1) {
            return { ok: false, message: 'Necesitas barcos propios en la casilla de agua.' };
          }
          if (!Number.isInteger(troops) || troops < 1
            || troops > this.getTroopsForPlayerOnTile(tile, player.id)
            || carried + troops > ships * ECONOMY.NAVAL.TROOPS_PER_SHIP) {
            return { ok: false, message: 'La flota no tiene capacidad para esas tropas.' };
          }
          action.troops = troops;
          return { ok: true };
        }
        if (WATER_TERRAIN.has(tile.type)) {
          const ships = this.getShipsForPlayerOnTile(tile, player.id);
          const transported = tile.transportedTroopsByPlayer?.[player.id] || 0;
          const troops = action.troops ?? transported;
          if (ships < 1) {
            return { ok: false, message: 'Necesitas barcos propios en la casilla de origen.' };
          }
          if (destination.ownerId != null && destination.ownerId !== player.id) {
            return { ok: false, message: 'No puedes desembarcar directamente en territorio enemigo.' };
          }
          if (!Number.isInteger(troops) || troops < 1 || troops > transported) {
            return { ok: false, message: 'No hay tantas tropas embarcadas en esta flota.' };
          }
          action.troops = troops;
          return { ok: true };
        }
        if (!LAND_TERRAIN.has(destination.type)) {
          return { ok: false, message: 'Las tropas solo pueden avanzar sobre tierra.' };
        }
        if (
          InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
          || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
        ) {
          return { ok: false, message: 'No se pueden mover tropas hacia, desde o a través de una Zona Desmilitarizada.' };
        }
        if (otherActions.some((planned) => (
          planned.type === 'MOVE_TROOPS'
          && planned.targetX === destination.x && planned.targetY === destination.y
        ))) {
          return { ok: false, message: 'Ya tienes un movimiento planificado hacia esa casilla.' };
        }
        const otherTroops = otherActions
          .filter((planned) => (
            planned.type === 'MOVE_TROOPS'
            && planned.x === action.x && planned.y === action.y
          ))
          .reduce((sum, planned) => sum + planned.troops, 0);
        const troops = action.troops ?? tile.troops;
        const availableTroops = this.getTroopsForPlayerOnTile(tile, player.id);
        if (!Number.isInteger(troops) || troops < 1 || troops > availableTroops - otherTroops) {
          return { ok: false, message: 'La cantidad de tropas supera las disponibles para planificar.' };
        }
        action.troops = troops;
        return { ok: true };
      }
      case 'MOVE_SHIPS': {
        const destination = this.grid[action.targetY]?.[action.targetX];
        if (!destination || !WATER_TERRAIN.has(destination.type)) {
          return { ok: false, message: 'Los barcos solo pueden navegar hacia casillas de agua.' };
        }
        if (!isDiagonalOrOrthogonalStep(tile, destination)) {
          return { ok: false, message: 'El destino debe ser una casilla de agua adyacente, incluso en diagonal.' };
        }
        if (
          InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
          || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
        ) {
          return { ok: false, message: 'Los barcos no pueden navegar hacia, desde o a través de una Zona Desmilitarizada.' };
        }
        const movedShips = action.ships ?? this.getShipsForPlayerOnTile(tile, player.id);
        const transportedTroops = tile.transportedTroopsByPlayer?.[player.id] || 0;
        if (transportedTroops < movedShips) {
          return { ok: false, message: 'Cada barco que se mueve debe llevar al menos una tropa embarcada.' };
        }
        const reservedShips = otherActions
          .filter((planned) => planned.type === 'MOVE_SHIPS' && planned.x === action.x && planned.y === action.y)
          .reduce((sum, planned) => sum + planned.ships, 0);
        if (!Number.isInteger(movedShips) || movedShips < 1 || movedShips > this.getShipsForPlayerOnTile(tile, player.id) - reservedShips) {
          return { ok: false, message: 'La cantidad de barcos supera los disponibles para planificar.' };
        }
        if (otherActions.some((planned) => planned.type === 'MOVE_SHIPS' && planned.targetX === destination.x && planned.targetY === destination.y)) {
          return { ok: false, message: 'Ya tienes un movimiento de barcos planificado hacia esa casilla.' };
        }
        action.ships = movedShips;
        return { ok: true };
      }
      case 'EMBARK_TROOPS': {
        const destination = this.grid[action.targetY]?.[action.targetX];
        const troops = action.troops ?? this.getTroopsForPlayerOnTile(tile, player.id);
        if (!destination || !WATER_TERRAIN.has(destination.type)
          || (
            !(
              tile.x === destination.x
              && tile.y === destination.y
              && WATER_TERRAIN.has(tile.type)
            )
            && !isDiagonalOrOrthogonalStep(tile, destination)
          )) {
          return { ok: false, message: 'Selecciona una casilla de agua adyacente para embarcar.' };
        }
        if (this.getShipsForPlayerOnTile(destination, player.id) < 1) {
          return { ok: false, message: 'Necesitas barcos propios en el agua adyacente.' };
        }
        const carried = destination.transportedTroopsByPlayer?.[player.id] || 0;
        const capacity = this.getShipsForPlayerOnTile(destination, player.id) * ECONOMY.NAVAL.TROOPS_PER_SHIP;
        const reserved = otherActions
          .filter((planned) => planned.type === 'EMBARK_TROOPS' && planned.targetX === destination.x && planned.targetY === destination.y)
          .reduce((sum, planned) => sum + planned.troops, 0);
        if (!Number.isInteger(troops) || troops < 1 || troops > this.getTroopsForPlayerOnTile(tile, player.id) || carried + reserved + troops > capacity) {
          return { ok: false, message: `La flota puede transportar hasta ${capacity - carried - reserved} tropas más.` };
        }
        if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
          || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)) {
          return { ok: false, message: 'No puedes embarcar tropas dentro de una Zona Desmilitarizada.' };
        }
        action.troops = troops;
        return { ok: true };
      }
      case 'DISEMBARK_TROOPS': {
        const destination = this.grid[action.targetY]?.[action.targetX];
        const troops = action.troops ?? tile.transportedTroopsByPlayer?.[player.id] ?? 0;
        const carried = tile.transportedTroopsByPlayer?.[player.id] || 0;
        if (!destination || !LAND_TERRAIN.has(destination.type)
          || !isDiagonalOrOrthogonalStep(tile, destination)) {
          return { ok: false, message: 'Selecciona una casilla terrestre adyacente, incluso en diagonal, para desembarcar.' };
        }
        if (destination.ownerId != null && destination.ownerId !== player.id) {
          return { ok: false, message: 'No puedes desembarcar directamente en territorio enemigo.' };
        }
        if (!Number.isInteger(troops) || troops < 1 || troops > carried) {
          return { ok: false, message: 'No hay tantas tropas embarcadas en esta flota.' };
        }
        if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
          || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)) {
          return { ok: false, message: 'No puedes desembarcar tropas dentro de una Zona Desmilitarizada.' };
        }
        action.troops = troops;
        return { ok: true };
      }
      case 'HOLD_POSITION':
        return player.isBot ? { ok: true } : { ok: false, message: 'Esta acción está reservada para los bots.' };
      default:
        return { ok: false, message: 'La acción no está disponible.' };
    }

    const otherSilver = otherActions.reduce((sum, planned) => sum + this.getSilverCost(planned), 0);
    const otherMaterials = otherActions.reduce((sum, planned) => sum + this.getMaterialCost(planned), 0);
    if (player.resources.SILVER < otherSilver + silverCost) {
      return { ok: false, message: 'No hay plata suficiente para todas las acciones planificadas.' };
    }
    if (player.resources.MATERIALS < otherMaterials + materialCost) {
      return { ok: false, message: 'No hay materiales suficientes para todas las acciones planificadas.' };
    }
    return { ok: true };
  },

  getSilverCost(action) {
    if (action.type === 'BUILD_CITY') return ECONOMY.COSTS.BUILD_CITY_SILVER;
    if (action.type === 'BUILD_FACTORY') {
      const tile = this.grid[action.y]?.[action.x];
      return tile?.type === TERRAIN_TYPES.MPT || tile?.type === TERRAIN_TYPES.MPA
        ? ECONOMY.COSTS.BUILD_FACTORY_RESOURCE_SILVER
        : ECONOMY.COSTS.BUILD_FACTORY_SILVER;
    }
    if (action.type === 'RECRUIT_TROOP') return ECONOMY.COSTS.RECRUIT_TROOP_SILVER * (action.count ?? 1);
    if (action.type === 'BUILD_SHIP') return ECONOMY.COSTS.BUILD_SHIP_SILVER * (action.count ?? 1);
    if (action.type === 'MOVE_CAPITAL') return ECONOMY.COSTS.MOVE_CAPITAL_SILVER;
    return 0;
  },

  getMaterialCost(action) {
    return action.type === 'RECRUIT_TROOP'
      ? ECONOMY.COSTS.RECRUIT_TROOP_MATERIALS * (action.count ?? 1)
      : action.type === 'BUILD_SHIP'
        ? ECONOMY.COSTS.BUILD_SHIP_MATERIALS * (action.count ?? 1)
      : action.type === 'MOVE_CAPITAL'
        ? ECONOMY.COSTS.MOVE_CAPITAL_MATERIALS
        : 0;
  },

  getShipsForPlayerOnTile(tile, playerId) {
    return tile?.shipsByPlayer?.[playerId] || 0;
  },

  normalizeWaterTroops() {
    for (const tile of this.grid.flat()) {
      if (!WATER_TERRAIN.has(tile.type) || !(tile.troops > 0)) continue;
      const shipEntries = Object.entries(tile.shipsByPlayer || {})
        .filter(([, count]) => count > 0);
      if (!shipEntries.length) {
        tile.troops = 0;
        continue;
      }
      const [playerId, ships] = shipEntries
        .sort(([, left], [, right]) => right - left)[0];
      tile.transportedTroopsByPlayer ||= {};
      const capacity = ships * ECONOMY.NAVAL.TROOPS_PER_SHIP;
      const cargo = tile.transportedTroopsByPlayer[playerId] || 0;
      const availableCapacity = Math.max(0, capacity - cargo);
      const movedTroops = Math.min(tile.troops, availableCapacity);
      if (movedTroops > 0) {
        tile.transportedTroopsByPlayer[playerId] = cargo + movedTroops;
        tile.troops -= movedTroops;
      }
      if (tile.troops > 0) tile.troops = 0;
    }
  },

  getShipyardWaterTile(tile, playerId) {
    if (!tile || tile.building !== 'FACTORY') return null;
    if (tile.type === TERRAIN_TYPES.FA && tile.ownerId === playerId) return tile;
    if (tile.type !== TERRAIN_TYPES.FT || tile.ownerId !== playerId) return null;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const waterTile = this.grid[tile.y + dy]?.[tile.x + dx];
      if (!waterTile || !WATER_TERRAIN.has(waterTile.type)) continue;
      if (waterTile.ownerId != null && waterTile.ownerId !== playerId) continue;
      const hostileShips = Object.entries(waterTile.shipsByPlayer || {})
        .some(([ownerId, count]) => ownerId !== playerId && count > 0);
      if (!hostileShips) return waterTile;
    }
    return null;
  },

  resolvePlannedActions() {
    const results = [];
    for (const player of this.players.values()) {
      const plannedActions = player.plannedActions || createEmptyActionSlots();
      for (let slot = 0; slot < plannedActions.length; slot += 1) {
        const action = plannedActions[slot];
        if (!action) continue;

        let result;
        if (action.type === 'MOVE_TROOPS') {
          const destination = this.grid[action.targetY]?.[action.targetX];
          const source = this.grid[action.y]?.[action.x];
          result = destination && WATER_TERRAIN.has(destination.type)
            ? this.resolveEmbarkTroops(player, action)
            : source && WATER_TERRAIN.has(source.type)
              ? this.resolveDisembarkTroops(player, action)
              : this.resolveTroopMovement(player, action);
        } else if (action.type === 'MOVE_SHIPS') {
          result = this.resolveShipMovement(player, action);
        } else if (action.type === 'EMBARK_TROOPS') {
          result = this.resolveEmbarkTroops(player, action);
        } else if (action.type === 'DISEMBARK_TROOPS') {
          result = this.resolveDisembarkTroops(player, action);
        } else {
          const tile = this.grid[action.y]?.[action.x];
          result = tile?.ownerId === player.id
            ? this.applyPlayerAction(player, tile, action.type, action)
            : { ok: false, message: 'La casilla ya no pertenece a tu país.' };
        }
        results.push({
          playerId: player.id,
          slot: slot + 1,
          action: { ...action },
          message: result.message || (result.ok ? 'Acción realizada.' : 'No se pudo realizar la acción.'),
          ...result
        });
        if (action.type !== 'HOLD_POSITION') {
          const coordinates = ['MOVE_TROOPS', 'MOVE_SHIPS', 'EMBARK_TROOPS', 'DISEMBARK_TROOPS'].includes(action.type)
            ? ` desde (${action.x}, ${action.y}) hasta (${action.targetX}, ${action.targetY})`
            : ` en (${action.x}, ${action.y})`;
          this.recordEvent(result.ok
            ? `${player.name}: ${this.getActionName(action.type)}${coordinates}.`
            : `${player.name}: ${this.getActionName(action.type)}${coordinates} no realizada: ${result.message || 'No se pudo realizar la acción.'}`);
        }
      }
      player.plannedActions = createEmptyActionSlots();
    }
    return results;
  },

  resolveTroopMovement(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    if (
      !source
      || !destination
      || this.getTroopsForPlayerOnTile(source, player.id) < action.troops
      || !LAND_TERRAIN.has(destination.type)
      || !isDiagonalOrOrthogonalStep(source, destination)
      || InternationalOrganizationEngine.isInActiveDmz(this, source?.x, source?.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination?.x, destination?.y)
    ) {
      return { ok: false, message: 'El movimiento ya no es válido o atraviesa una Zona Desmilitarizada.' };
    }
    const enteredRivalTerritory = (
      (source.ownerId != null && source.ownerId !== player.id)
      || (destination.ownerId != null && destination.ownerId !== player.id)
    );
    if (enteredRivalTerritory) {
      this.registerMilitaryConflict(
        player,
        destination.ownerId !== player.id ? destination.ownerId : source.ownerId
      );
    }
    const hostilePlayers = new Set(
      Object.entries(destination.visitingTroops || {})
        .filter(([visitorId, count]) => visitorId !== player.id && count > 0)
        .map(([visitorId]) => visitorId)
    );
    if (destination.ownerId != null && destination.ownerId !== player.id) {
      hostilePlayers.add(destination.ownerId);
    }
    const brokePacts = [];
    for (const defenderId of hostilePlayers) {
      this.registerMilitaryConflict(player, defenderId);
      if (this.breakNonAggressionPact(player, defenderId)) brokePacts.push(defenderId);
    }
    if (destination.ownerId != null && destination.ownerId !== player.id) {
      const defenderId = destination.ownerId;
      const defenderTroops = this.getTroopsForPlayerOnTile(destination, defenderId);
      const attackerWins = action.troops > defenderTroops;
      if (!attackerWins) {
        const attackerSurvivors = Math.floor(action.troops / 2);
        this.removeTroopsFromPlayerOnTile(source, player.id, action.troops - attackerSurvivors);
        return {
          ok: true,
          message: `${brokePacts.length ? 'PNA roto: perdió Influencia Política. ' : ''}${attackerSurvivors
            ? `Ataque rechazado: ${player.name} pierde ${action.troops - attackerSurvivors} tropas y se retira.`
            : `Ataque rechazado: ${player.name} pierde todas sus tropas y se retira.`}`,
          combat: {
            attackerId: player.id,
            defenderId,
            attackerTroops: action.troops,
            defenderTroops,
            winnerId: defenderId,
            attackerSurvivors,
            defenderSurvivors: defenderTroops
          }
        };
      }

      const defenderSurvivors = Math.floor(defenderTroops / 2);
      this.removeTroopsFromPlayerOnTile(source, player.id, action.troops);
      destination.troops = Math.max(0, (destination.troops || 0) - defenderTroops + defenderSurvivors);
      if (defenderSurvivors > 0) {
        destination.visitingTroops ||= {};
        destination.visitingTroops[defenderId] = (
          destination.visitingTroops[defenderId] || 0
        ) + defenderSurvivors;
      }
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
      destination.troops += action.troops;
      return {
        ok: true,
        message: `${brokePacts.length ? 'PNA roto: perdió Influencia Política. ' : ''}${defenderSurvivors
          ? `Victoria de ${player.name}: territorio conquistado; ${defenderSurvivors} tropas enemigas supervivientes permanecen en la casilla.`
          : `Victoria de ${player.name}: territorio conquistado; la guarnición fue derrotada.`}`,
        claimed: true,
        combat: {
          attackerId: player.id,
          defenderId,
          attackerTroops: action.troops,
          defenderTroops,
          winnerId: player.id,
          attackerSurvivors: action.troops,
          defenderSurvivors
        }
      };
    }

    if (source.ownerId === player.id) {
      source.troops -= action.troops;
    } else {
      source.visitingTroops[player.id] -= action.troops;
      source.troops -= action.troops;
      if (source.visitingTroops[player.id] === 0) delete source.visitingTroops[player.id];
      if (Object.keys(source.visitingTroops).length === 0) delete source.visitingTroops;
    }
    destination.troops = (destination.troops || 0) + action.troops;
    const claimed = destination.ownerId == null;
    if (claimed) {
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
    } else if (destination.ownerId !== player.id) {
      destination.visitingTroops ||= {};
      destination.visitingTroops[player.id] = (destination.visitingTroops[player.id] || 0) + action.troops;
    }
    return {
      ok: true,
      message: claimed ? 'Territorio neutral reclamado.' : 'Tropas trasladadas.',
      claimed
    };
  },

  resolveShipMovement(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    const ships = this.getShipsForPlayerOnTile(source, player.id);
    if (
      !source || !destination || !WATER_TERRAIN.has(source.type) || !WATER_TERRAIN.has(destination.type)
      || !Number.isInteger(action.ships) || action.ships < 1 || ships < action.ships
      || !isDiagonalOrOrthogonalStep(source, destination)
      || InternationalOrganizationEngine.isInActiveDmz(this, source.x, source.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
    ) {
      return { ok: false, message: 'El movimiento naval ya no es válido o atraviesa una Zona Desmilitarizada.' };
    }

    const defenders = Object.entries(destination.shipsByPlayer || {})
      .filter(([playerId, count]) => playerId !== player.id && count > 0);
    const defendingShips = defenders.reduce((sum, [, count]) => sum + count, 0);
    const rivalOwner = destination.ownerId != null && destination.ownerId !== player.id
      ? destination.ownerId
      : null;
    const hostilePlayers = new Set(defenders.map(([playerId]) => playerId));
    if (rivalOwner) hostilePlayers.add(rivalOwner);
    for (const defenderId of hostilePlayers) {
      this.registerMilitaryConflict(player, defenderId);
      this.breakNonAggressionPact(player, defenderId);
    }

    if (defendingShips > 0 && action.ships <= defendingShips) {
      const survivors = Math.floor(action.ships / 2);
      const losses = action.ships - survivors;
      source.shipsByPlayer[player.id] -= losses;
      if (source.shipsByPlayer[player.id] <= 0) delete source.shipsByPlayer[player.id];
      const cargo = source.transportedTroopsByPlayer?.[player.id] || 0;
      const survivingCargo = Math.min(cargo, ships - losses > 0 ? (ships - losses) * ECONOMY.NAVAL.TROOPS_PER_SHIP : 0);
      if (survivingCargo > 0) source.transportedTroopsByPlayer[player.id] = survivingCargo;
      else if (source.transportedTroopsByPlayer) delete source.transportedTroopsByPlayer[player.id];
      return {
        ok: true,
        message: `Batalla naval perdida: ${player.name} pierde ${losses} barcos${cargo > survivingCargo ? ` y ${cargo - survivingCargo} tropas embarcadas` : ''}.`,
        combat: { naval: true, attackerId: player.id, defenderId: [...hostilePlayers][0], attackerTroops: action.ships, defenderTroops: defendingShips }
      };
    }

    if (defendingShips > 0) {
      for (const [defenderId, count] of defenders) {
        const survivors = Math.floor(count / 2);
        const losses = count - survivors;
        destination.shipsByPlayer[defenderId] = survivors;
        if (survivors <= 0) delete destination.shipsByPlayer[defenderId];
        const cargo = destination.transportedTroopsByPlayer?.[defenderId] || 0;
        const survivingCargo = Math.min(cargo, survivors * ECONOMY.NAVAL.TROOPS_PER_SHIP);
        if (survivingCargo > 0) destination.transportedTroopsByPlayer[defenderId] = survivingCargo;
        else if (destination.transportedTroopsByPlayer) delete destination.transportedTroopsByPlayer[defenderId];
        if (cargo > survivingCargo) {
          this.recordEvent(`${cargo - survivingCargo} tropas embarcadas de ${this.players.get(defenderId)?.name || defenderId} se perdieron en la batalla naval.`);
        }
        if (losses > 0) this.recordEvent(`${this.players.get(defenderId)?.name || defenderId} perdió ${losses} barcos en la batalla naval.`);
      }
    }

    source.shipsByPlayer[player.id] -= action.ships;
    if (source.shipsByPlayer[player.id] <= 0) delete source.shipsByPlayer[player.id];
    source.shipsByPlayer = Object.fromEntries(
      Object.entries(source.shipsByPlayer).filter(([, count]) => count > 0)
    );
    destination.shipsByPlayer ||= {};
    destination.shipsByPlayer[player.id] = (destination.shipsByPlayer[player.id] || 0) + action.ships;
    const cargo = source.transportedTroopsByPlayer?.[player.id] || 0;
    const movedCargo = Math.min(cargo, action.ships * ECONOMY.NAVAL.TROOPS_PER_SHIP);
    if (movedCargo > 0) {
      source.transportedTroopsByPlayer[player.id] -= movedCargo;
      if (source.transportedTroopsByPlayer[player.id] <= 0) delete source.transportedTroopsByPlayer[player.id];
      destination.transportedTroopsByPlayer ||= {};
      destination.transportedTroopsByPlayer[player.id] = (destination.transportedTroopsByPlayer[player.id] || 0) + movedCargo;
    }
    destination.ownerId = player.id;
    destination.nationId = player.nationId;
    return {
      ok: true,
      message: defendingShips > 0
        ? `Victoria naval: ${player.name} controla el agua; los barcos supervivientes enemigos permanecen en la casilla.`
        : 'La flota navegó y tomó el control de la casilla de agua.',
      claimed: destination.ownerId === player.id,
      combat: defendingShips > 0
        ? { naval: true, attackerId: player.id, defenderId: [...hostilePlayers][0], attackerTroops: action.ships, defenderTroops: defendingShips, winnerId: player.id }
        : null
    };
  },

  resolveEmbarkTroops(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    const availableTroops = this.getTroopsForPlayerOnTile(source, player.id);
    const ships = this.getShipsForPlayerOnTile(destination, player.id);
    const cargo = destination?.transportedTroopsByPlayer?.[player.id] || 0;
    if (
      !source || !destination || (!LAND_TERRAIN.has(source.type) && !WATER_TERRAIN.has(source.type))
      || !WATER_TERRAIN.has(destination.type)
      || !Number.isInteger(action.troops) || action.troops < 1
      || action.troops > availableTroops || ships < 1
      || cargo + action.troops > ships * ECONOMY.NAVAL.TROOPS_PER_SHIP
      || (
        !(source.x === destination.x && source.y === destination.y)
        && !isDiagonalOrOrthogonalStep(source, destination)
      )
      || InternationalOrganizationEngine.isInActiveDmz(this, source.x, source.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
    ) {
      return { ok: false, message: 'La orden de embarque ya no es válida o la flota no tiene capacidad.' };
    }
    this.removeTroopsFromPlayerOnTile(source, player.id, action.troops);
    destination.transportedTroopsByPlayer ||= {};
    destination.transportedTroopsByPlayer[player.id] = cargo + action.troops;
    return { ok: true, message: `${action.troops} tropas embarcaron en la flota.` };
  },

  resolveDisembarkTroops(player, action) {
    const source = this.grid[action.y]?.[action.x];
    const destination = this.grid[action.targetY]?.[action.targetX];
    const cargo = source?.transportedTroopsByPlayer?.[player.id] || 0;
    if (
      !source || !destination || !WATER_TERRAIN.has(source.type) || !LAND_TERRAIN.has(destination.type)
      || this.getShipsForPlayerOnTile(source, player.id) < 1
      || !Number.isInteger(action.troops) || action.troops < 1 || action.troops > cargo
      || (destination.ownerId != null && destination.ownerId !== player.id)
      || !isDiagonalOrOrthogonalStep(source, destination)
      || InternationalOrganizationEngine.isInActiveDmz(this, source.x, source.y)
      || InternationalOrganizationEngine.isInActiveDmz(this, destination.x, destination.y)
    ) {
      return { ok: false, message: 'La orden de desembarco ya no es válida.' };
    }
    source.transportedTroopsByPlayer[player.id] -= action.troops;
    if (source.transportedTroopsByPlayer[player.id] <= 0) delete source.transportedTroopsByPlayer[player.id];
    destination.troops = (destination.troops || 0) + action.troops;
    if (destination.ownerId == null) {
      destination.ownerId = player.id;
      destination.nationId = player.nationId;
    }
    return { ok: true, message: `${action.troops} tropas desembarcaron${destination.ownerId === player.id ? ' en territorio propio' : ''}.` };
  },

  removeTroopsFromPlayerOnTile(tile, playerId, count) {
    if (count <= 0) return;
    if (tile.ownerId === playerId) {
      tile.troops = Math.max(0, (tile.troops || 0) - count);
      return;
    }
    tile.visitingTroops[playerId] -= count;
    tile.troops = Math.max(0, (tile.troops || 0) - count);
    if (tile.visitingTroops[playerId] === 0) delete tile.visitingTroops[playerId];
    if (Object.keys(tile.visitingTroops).length === 0) delete tile.visitingTroops;
  },

  getTroopsForPlayerOnTile(tile, playerId) {
    const visitingTroops = tile.visitingTroops || {};
    if (tile.ownerId === playerId) {
      const foreignTroops = Object.values(visitingTroops)
        .reduce((sum, count) => sum + count, 0);
      return Math.max(0, (tile.troops || 0) - foreignTroops);
    }
    return visitingTroops[playerId] || 0;
  },

  applyPlayerAction(player, tile, type, action = {}) {
    const resources = player.resources;
    switch (type) {
      case 'BUILD_CITY': {
        if (tile.type !== TERRAIN_TYPES.TR || tile.building) {
          return { ok: false, message: 'Solo puedes construir una ciudad en una casilla de tierra vacía.' };
        }
        if (resources.SILVER < ECONOMY.COSTS.BUILD_CITY_SILVER) {
          return { ok: false, message: `Necesitas ${ECONOMY.COSTS.BUILD_CITY_SILVER} de plata.` };
        }
        resources.SILVER -= ECONOMY.COSTS.BUILD_CITY_SILVER;
        tile.type = TERRAIN_TYPES.CIU;
        tile.building = 'CITY';
        tile.population = ECONOMY.POPULATION.NEW_CITY;
        tile.defense = 2;
        return { ok: true, message: 'Ciudad construida.' };
      }
      case 'BUILD_FACTORY': {
        const isLand = tile.type === TERRAIN_TYPES.TR || tile.type === TERRAIN_TYPES.MPT;
        const isWater = tile.type === TERRAIN_TYPES.AG || tile.type === TERRAIN_TYPES.MPA;
        if ((!isLand && !isWater) || tile.building) {
          return { ok: false, message: 'No puedes construir una fábrica en esta casilla.' };
        }
        if (
          this.oiPolicies.industryLimit != null
          && InternationalOrganizationEngine.countFactories(this, player.id) >= this.oiPolicies.industryLimit
        ) {
          return { ok: false, message: `El límite de industria es de ${this.oiPolicies.industryLimit} fábricas.` };
        }
        const cost = tile.type === TERRAIN_TYPES.MPT || tile.type === TERRAIN_TYPES.MPA
          ? ECONOMY.COSTS.BUILD_FACTORY_RESOURCE_SILVER
          : ECONOMY.COSTS.BUILD_FACTORY_SILVER;
        if (resources.SILVER < cost) return { ok: false, message: `Necesitas ${cost} de plata.` };
        resources.SILVER -= cost;
        tile.type = isWater ? TERRAIN_TYPES.FA : TERRAIN_TYPES.FT;
        tile.building = 'FACTORY';
        tile.factoriesCount = 1;
        return { ok: true, message: 'Fábrica construida.' };
      }
      case 'BUILD_SHIP': {
        const count = action.count ?? 1;
        const port = this.getShipyardWaterTile(tile, player.id);
        const silverCost = ECONOMY.COSTS.BUILD_SHIP_SILVER * count;
        const materialCost = ECONOMY.COSTS.BUILD_SHIP_MATERIALS * count;
        if (!port) return { ok: false, message: 'La fábrica ya no tiene acceso a un puerto seguro.' };
        if (resources.SILVER < silverCost || resources.MATERIALS < materialCost) {
          return { ok: false, message: `Necesitas ${silverCost} de Plata y ${materialCost} Materiales para construir barcos.` };
        }
        resources.SILVER -= silverCost;
        resources.MATERIALS -= materialCost;
        port.shipsByPlayer ||= {};
        port.shipsByPlayer[player.id] = (port.shipsByPlayer[player.id] || 0) + count;
        if (port.ownerId == null) {
          port.ownerId = player.id;
          port.nationId = player.nationId;
        }
        return { ok: true, message: `${count} ${count === 1 ? 'barco construido' : 'barcos construidos'} en el puerto.` };
      }
      case 'RECRUIT_TROOP': {
        const count = action.count ?? 1;
        if (!LAND_TERRAIN.has(tile.type)) {
          return { ok: false, message: 'Las tropas solo pueden reclutarse en casillas terrestres.' };
        }
        const silverCost = ECONOMY.COSTS.RECRUIT_TROOP_SILVER * count;
        const materialCost = ECONOMY.COSTS.RECRUIT_TROOP_MATERIALS * count;
        if (!Number.isInteger(count) || count < 1) {
          return { ok: false, message: 'La cantidad de tropas a reclutar no es válida.' };
        }
        if (
          this.oiPolicies.armamentLimit != null
          && InternationalOrganizationEngine.countTroops(this, player.id) + count
            > this.oiPolicies.armamentLimit
        ) {
          return { ok: false, message: `El límite de armamento es de ${this.oiPolicies.armamentLimit} tropas.` };
        }
        if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) {
          return { ok: false, message: 'No puedes reclutar tropas dentro de una Zona Desmilitarizada.' };
        }
        if (resources.SILVER < silverCost || resources.MATERIALS < materialCost) {
          return { ok: false, message: `Necesitas ${silverCost} de plata y ${materialCost} materiales para reclutar.` };
        }
        resources.SILVER -= silverCost;
        resources.MATERIALS -= materialCost;
        tile.troops = (tile.troops || 0) + count;
        return { ok: true, message: `${count} ${count === 1 ? 'tropa reclutada' : 'tropas reclutadas'}.` };
      }
      case 'MOVE_CAPITAL': {
        if (tile.type !== TERRAIN_TYPES.CIU || tile.ownerId !== player.id) {
          return { ok: false, message: 'Selecciona una ciudad propia para trasladar la capital.' };
        }
        if (
          resources.SILVER < ECONOMY.COSTS.MOVE_CAPITAL_SILVER
          || resources.MATERIALS < ECONOMY.COSTS.MOVE_CAPITAL_MATERIALS
        ) {
          return {
            ok: false,
            message: `Necesitas ${ECONOMY.COSTS.MOVE_CAPITAL_SILVER} de plata y ${ECONOMY.COSTS.MOVE_CAPITAL_MATERIALS} materiales.`
          };
        }
        const oldCapital = this.grid.flat().find((candidate) => (
          candidate.ownerId === player.id && candidate.type === TERRAIN_TYPES.CAP
        ));
        if (!oldCapital) return { ok: false, message: 'No se encontró la capital actual.' };
        resources.SILVER -= ECONOMY.COSTS.MOVE_CAPITAL_SILVER;
        resources.MATERIALS -= ECONOMY.COSTS.MOVE_CAPITAL_MATERIALS;
        oldCapital.type = TERRAIN_TYPES.CIU;
        oldCapital.building = 'CITY';
        oldCapital.defense = 2;
        tile.type = TERRAIN_TYPES.CAP;
        tile.building = 'CAPITAL';
        tile.defense = 4;
        return { ok: true, message: 'Capital trasladada.' };
      }
      case 'HOLD_POSITION':
        return player.isBot
          ? { ok: true, message: 'Las tropas mantienen la posición.' }
          : { ok: false, message: 'Esta acción está reservada para los bots.' };
      default:
        return { ok: false, message: 'Acción no reconocida.' };
    }
  },
};
