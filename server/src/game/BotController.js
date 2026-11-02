/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { ECONOMY, LAND_TERRAIN, NATIONS, TERRAIN_TYPES } from '../../../shared/Constants.js';
import { InternationalOrganizationEngine } from './InternationalOrganizationEngine.js';
import { createEmptyActionSlots } from './GameStateUtils.js';
import { BotDecisionTable } from './BotDecisionTable.js';

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
      player.plannedActions = createEmptyActionSlots(this.settings?.actionSlotCount);
      this.chooseBotTaxRate(player);
      this.runBotStrategicActions(player);

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
        const candidates = [
          this.findBotNavalAction(player, slot),
          this.findBotCapitalAction(player, slot),
          this.findBotExpansion(player, slot),
          this.findBotAttack(player, slot),
          this.findBotBuildAction(player, 'BUILD_FACTORY', slot),
          this.findBotBuildAction(player, 'BUILD_CITY', slot)
        ].filter(Boolean);
        if (!candidates.length) continue;
        const contextKey = BotDecisionTable.getContext(this, player);
        const table = this.botDecisionTables.get(player.id);
        const selected = table
          ? BotDecisionTable.choose(
            table,
            contextKey,
            candidates,
            Math.random,
            this.botExplorationRate
          )
          : candidates[0];
        this.planBotAction(player, selected, slot);
      }
      player.phaseReady = true;
    }
  },

  chooseBotTaxRate(player) {
    const rates = [0.1, 0.15, 0.2, 0.25, 0.3];
    const contextKey = BotDecisionTable.getContext(this, player);
    const table = this.botDecisionTables.get(player.id);
    const candidates = rates.map((taxRate) => ({ type: 'SET_TAX_RATE', taxRate }));
    const selected = table
      ? BotDecisionTable.choose(
        table,
        contextKey,
        candidates,
        Math.random,
        this.botExplorationRate
      )
      : candidates[1];
    player.taxRate = selected.taxRate;
    this.rememberStrategicDecision(player, contextKey, selected.type);
  },

  runBotStrategicActions(player) {
    if (!this.botStrategicActionsEnabled) return;
    const contextKey = BotDecisionTable.getContext(this, player);
    const actions = [
      ...this.findBotFinanceActions(player),
      ...this.findBotTreatyActions(player),
      ...this.findBotOIProposals(player)
    ].filter(Boolean);
    if (!actions.length) return;
    const table = this.botDecisionTables.get(player.id);
    const selected = table
      ? BotDecisionTable.choose(
        table,
        contextKey,
        actions,
        Math.random,
        this.botExplorationRate
      )
      : actions[0];
    if (selected.type === 'PROPOSE_TREATY') {
      this.proposeTreaty(player.id, {
        ...selected,
        type: selected.treatyType
      });
    } else if (selected.type === 'PROPOSE_OI_RESOLUTION') {
      InternationalOrganizationEngine.propose(this, player.id, {
        type: selected.resolutionType,
        playerId: player.id
      });
    } else {
      this.performFinancialAction(player.id, selected);
    }
    this.rememberStrategicDecision(player, contextKey, selected.type);
  },

  rememberStrategicDecision(player, contextKey, actionType) {
    player.botDecisionHistory ||= [];
    player.botDecisionHistory.push({ contextKey, actionType });
  },

  findBotFinanceActions(player) {
    const actions = [];
    if (player.resources.SILVER >= ECONOMY.COSTS.DONATION_SILVER) {
      actions.push({ type: 'DONATE_TO_WORLD_BANK', playerId: player.id });
    }
    if (player.resources.SILVER >= ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER) {
      actions.push({ type: 'BUY_MATERIALS', quantity: 1, playerId: player.id });
    }
    if (player.resources.MATERIALS > 0) {
      actions.push({ type: 'SELL_MATERIALS', quantity: 1, playerId: player.id });
    }
    if (!this.bonds.some((bond) => bond.playerId === player.id && !bond.paid)) {
      actions.push({ type: 'ISSUE_BOND', playerId: player.id });
    }
    const bond = this.bonds.find((entry) => entry.playerId === player.id && !entry.paid);
    if (bond && player.resources.SILVER > 0) {
      actions.push({
        type: 'REPAY_BOND',
        bondId: bond.id,
        amount: Math.min(player.resources.SILVER, bond.balance),
        playerId: player.id
      });
    }
    const recipient = [...this.players.values()].find((candidate) => candidate.id !== player.id);
    if (recipient && player.resources.SILVER > 0) {
      actions.push({
        type: 'TRANSFER_RESOURCE',
        recipientId: recipient.id,
        resource: 'SILVER',
        amount: 1,
        playerId: player.id
      });
    }
    return actions;
  },

  findBotTreatyActions(player) {
    const recipient = [...this.players.values()].find((candidate) => (
      candidate.id !== player.id
      && !this.isPlayersAtWar(player.id, candidate.id)
    ));
    if (!recipient) return [];
    return [
      {
        type: 'PROPOSE_TREATY',
        recipientId: recipient.id,
        treatyType: 'NON_AGGRESSION_PACT',
        playerId: player.id
      },
      {
        type: 'PROPOSE_TREATY',
        recipientId: recipient.id,
        treatyType: 'FREE_TRADE',
        playerId: player.id
      }
    ];
  },

  findBotOIProposals(player) {
    if (
      this.settings?.oiFrequency <= 0
      || this.currentRound % this.settings.oiFrequency === 0
      || player.resources.INFLUENCE < ECONOMY.COSTS.OI_PROPOSAL_INFLUENCE
    ) return [];
    return ['ARMAMENT_LIMIT', 'INDUSTRY_LIMIT', 'CONDITIONAL_SUBSIDY']
      .map((resolutionType) => ({
        type: 'PROPOSE_OI_RESOLUTION',
        resolutionType,
        playerId: player.id
      }));
  },

  findBotNavalAction(player, slot) {
    for (const tile of this.grid.flat()) {
      if (tile.ownerId !== player.id) continue;
      const waterNeighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]]
        .map(([dx, dy]) => this.grid[tile.y + dy]?.[tile.x + dx])
        .filter(Boolean);
      const candidates = [];
      if (tile.building === 'FACTORY' && this.getShipyardWaterTile(tile, player.id)) {
        candidates.push({ type: 'BUILD_SHIP', x: tile.x, y: tile.y, count: 1 });
      }
      for (const destination of waterNeighbors) {
        if (this.getShipsForPlayerOnTile(tile, player.id) > 0 && destination.type === 'AG') {
          candidates.push({
            type: 'MOVE_SHIPS', x: tile.x, y: tile.y,
            targetX: destination.x, targetY: destination.y, ships: 1
          });
        }
        if (destination.type === 'AG' && this.getShipsForPlayerOnTile(destination, player.id) > 0) {
          candidates.push({
            type: 'EMBARK_TROOPS', x: tile.x, y: tile.y,
            targetX: destination.x, targetY: destination.y, troops: 1
          });
        }
        if (tile.type === 'AG' && this.getShipsForPlayerOnTile(tile, player.id) > 0) {
          const landDestination = destination;
          if (landDestination && LAND_TERRAIN.has(landDestination.type)) {
            candidates.push({
              type: 'DISEMBARK_TROOPS', x: tile.x, y: tile.y,
              targetX: landDestination.x, targetY: landDestination.y, troops: 1
            });
          }
        }
      }
      if (candidates.some((action) => this.validatePlannedAction(player, action, slot).ok)) {
        return candidates.find((action) => this.validatePlannedAction(player, action, slot).ok);
      }
    }
    return null;
  },

  findBotCapitalAction(player, slot) {
    const city = this.grid.flat().find((tile) => tile.ownerId === player.id && tile.type === TERRAIN_TYPES.CIU);
    const action = city && { type: 'MOVE_CAPITAL', x: city.x, y: city.y };
    return action && this.validatePlannedAction(player, action, slot).ok ? action : null;
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
    const reservedSilver = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getSilverCost(action), 0);
    const reservedMaterials = player.plannedActions
      .filter(Boolean)
      .reduce((sum, action) => sum + this.getMaterialCost(action), 0);
    const count = Math.min(
      Math.floor((player.resources.SILVER - reservedSilver) / ECONOMY.COSTS.RECRUIT_TROOP_SILVER),
      Math.floor((player.resources.MATERIALS - reservedMaterials) / ECONOMY.COSTS.RECRUIT_TROOP_MATERIALS)
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
    const table = this.botDecisionTables.get(player.id);
    const contextKey = BotDecisionTable.getContext(this, player);
    const selected = table
      ? BotDecisionTable.choose(
        table,
        contextKey,
        [action],
        Math.random,
        this.botExplorationRate
      )
      : action;
    const validation = this.validatePlannedAction(player, selected, slot);
    if (!validation.ok) return false;
    player.botDecisionContext ||= {};
    player.botDecisionHistory ||= [];
    player.botDecisionContext[slot] = { contextKey, actionType: selected.type };
    player.botDecisionHistory.push({ contextKey, actionType: selected.type, slot });
    player.plannedActions[slot] = selected;
    return true;
  },

  rememberBotActionResult(playerId, action, successful) {
    const player = this.players.get(playerId);
    if (!player?.isBot || !action?.type) return;
    const contextKey = player.botDecisionContext?.[action.slot]?.contextKey
      || BotDecisionTable.getContext(this, player);
    const table = this.botDecisionTables.get(playerId);
    if (table && this.trainingMode) {
      BotDecisionTable.remember(table, contextKey, action.type, successful);
    }
    const decision = [...(player.botDecisionHistory || [])]
      .reverse()
      .find((entry) => (
        entry.contextKey === contextKey
        && entry.actionType === action.type
        && entry.successful === undefined
      ));
    if (decision) decision.successful = successful;
    if (player.botDecisionContext) delete player.botDecisionContext[action.slot];
  },

  awardBotFinalRewards() {
    const rankings = [...this.players.values()]
      .sort((left, right) => (
        this.calculateGDI(right) - this.calculateGDI(left)
        || left.nationId - right.nationId
      ));
    const rewards = [];
    rankings.forEach((player, index) => {
      if (!player.isBot) return;
      const table = this.botDecisionTables.get(player.id);
      const reward = table && this.trainingMode
        ? BotDecisionTable.rememberFinalResult(
          table,
          player.botDecisionHistory || [],
          index + 1
        )
        : 0;
      player.botFinalRank = index + 1;
      player.botFinalReward = reward;
      rewards.push({ playerId: player.id, rank: index + 1, reward });
    });
    return rewards;
  },
};
