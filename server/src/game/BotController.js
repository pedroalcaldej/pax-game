/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { LAND_TERRAIN, NATIONS, TERRAIN_TYPES } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';
import { createEmptyActionSlots } from './GameStateUtils.js';

export const BotController = {
  runBotDecisions({ resetReadiness = true } = {}) {
    for (const offer of [...this.treatyOffers]) {
      const recipient = this.players.get(offer.recipientId);
      if (!recipient?.isBot) continue;
      this.treatyOffers = this.treatyOffers.filter((entry) => entry.id !== offer.id);
      this.applyTreatyResponse(offer, this.botAcceptsTreaty(
        recipient,
        this.players.get(offer.proposerId),
        offer.type
      ));
    }

    for (const player of this.players.values()) {
      if (resetReadiness) player.phaseReady = false;
      if (!player.isBot) continue;
      if (!resetReadiness && player.phaseReady) continue;
      player.phaseReady = false;
      player.plannedActions = createEmptyActionSlots();
      player.taxRate = 0.15;

      const expansion = this.findBotExpansion(player, 0);
      if (expansion) {
        this.planBotAction(player, expansion, 0);
      }

      let slot = player.plannedActions.findIndex((action) => !action);
      let factory = this.findBotBuildAction(player, 'BUILD_FACTORY', slot);
      if (factory) {
        this.planBotAction(player, factory, slot);
      }

      for (slot = 0; slot < player.plannedActions.length; slot += 1) {
        if (player.plannedActions[slot]) continue;
        const recruitment = this.findBotRecruitment(player, slot);
        if (recruitment) this.planBotAction(player, recruitment, slot);
      }

      for (let slot = 0; slot < player.plannedActions.length; slot += 1) {
        if (player.plannedActions[slot]) continue;
        const extraAction = this.findBotExpansion(player, slot)
          || this.findBotAttack(player, slot)
          || this.findBotBuildAction(player, 'BUILD_FACTORY', slot)
          || this.findBotBuildAction(player, 'BUILD_CITY', slot);
        if (!extraAction) continue;
        this.planBotAction(player, extraAction, slot);
      }
      player.phaseReady = true;
    }
  },

  findBotExpansion(player, slot = 0) {
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const sources = this.grid.flat()
      .filter((tile) => (
        tile.ownerId === player.id
        && tile.troops > 0
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ))
      .sort((left, right) => right.troops - left.troops);

    for (const source of sources) {
      for (const [dx, dy] of directions) {
        const targetX = source.x + dx;
        const targetY = source.y + dy;
        const target = this.grid[targetY]?.[targetX];
        if (
          !target
          || target.ownerId != null
          || !LAND_TERRAIN.has(target.type)
          || InternationalOrganizationEngine.isInActiveDmz(this, targetX, targetY)
        ) {
          continue;
        }
        const alreadyMoved = (player.plannedActions || [])
          .filter((planned) => planned?.type === 'MOVE_TROOPS'
            && planned.x === source.x && planned.y === source.y)
          .reduce((sum, planned) => sum + planned.troops, 0);
        const availableTroops = this.getTroopsForPlayerOnTile(source, player.id) - alreadyMoved;
        const troops = Math.max(1, Math.floor(availableTroops / 2));
        const action = {
          type: 'MOVE_TROOPS',
          x: source.x,
          y: source.y,
          targetX,
          targetY,
          troops
        };
        if (this.validatePlannedAction(player, action, slot).ok) return action;
      }
    }
    return null;
  },

  findBotAttack(player, slot) {
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const sources = this.grid.flat()
      .filter((tile) => (
        tile.ownerId === player.id
        && this.getTroopsForPlayerOnTile(tile, player.id) > 0
        && !InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ))
      .sort((left, right) => right.troops - left.troops);

    for (const source of sources) {
      const alreadyMoved = (player.plannedActions || [])
        .filter((planned) => planned?.type === 'MOVE_TROOPS'
          && planned.x === source.x && planned.y === source.y)
        .reduce((sum, planned) => sum + planned.troops, 0);
      const availableTroops = this.getTroopsForPlayerOnTile(source, player.id) - alreadyMoved;
      if (availableTroops < 1) continue;

      for (const [dx, dy] of directions) {
        const target = this.grid[source.y + dy]?.[source.x + dx];
        if (
          !target
          || target.ownerId == null
          || target.ownerId === player.id
          || !LAND_TERRAIN.has(target.type)
          || InternationalOrganizationEngine.isInActiveDmz(this, target.x, target.y)
        ) {
          continue;
        }
        const defenders = this.getTroopsForPlayerOnTile(target, target.ownerId);
        const troops = defenders + 1;
        if (troops > availableTroops) continue;
        const action = {
          type: 'MOVE_TROOPS',
          x: source.x,
          y: source.y,
          targetX: target.x,
          targetY: target.y,
          troops
        };
        if (this.validatePlannedAction(player, action, slot).ok) return action;
      }
    }
    return null;
  },

  findBotBuildAction(player, type, slot) {
    const candidates = this.grid.flat().filter((tile) => {
      if (tile.ownerId !== player.id || tile.building) return false;
      if (InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)) return false;
      if (type === 'BUILD_CITY') return tile.type === TERRAIN_TYPES.TR;
      return [TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA]
        .includes(tile.type);
    });
    for (const tile of candidates) {
      const action = { type, x: tile.x, y: tile.y };
      if (this.validatePlannedAction(player, action, slot).ok) return action;
    }
    return null;
  },

  findBotRecruitment(player, slot) {
    const troopLimit = this.oiPolicies.armamentLimit ?? 10;
    const currentTroops = InternationalOrganizationEngine.countTroops(this, player.id);
    const plannedRecruitment = player.plannedActions
      .filter((action) => action?.type === 'RECRUIT_TROOP')
      .reduce((sum, action) => sum + action.count, 0);
    const reservedSilver = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getSilverCost(action), 0);
    const reservedMaterials = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getMaterialCost(action), 0);
    const count = Math.min(
      troopLimit - currentTroops - plannedRecruitment,
      Math.floor((player.resources.SILVER - reservedSilver) / 5),
      Math.floor((player.resources.MATERIALS - reservedMaterials) / 2)
    );
    if (count < 1) return null;

    for (const tile of this.grid.flat()) {
      if (
        tile.ownerId !== player.id
        || InternationalOrganizationEngine.isInActiveDmz(this, tile.x, tile.y)
      ) {
        continue;
      }
      const action = {
        type: 'RECRUIT_TROOP',
        x: tile.x,
        y: tile.y,
        count
      };
      if (this.validatePlannedAction(player, action, slot).ok) return action;
    }
    return null;
  },

  planBotAction(player, action, slot) {
    const validation = this.validatePlannedAction(player, action, slot);
    if (!validation.ok) return false;
    player.plannedActions[slot] = action;
    return true;
  },
};
