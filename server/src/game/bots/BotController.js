import { fitActionModel } from './BotActionEvaluator.js';
import { createActionFeatureContext } from './BotActionFeatures.js';
/** State-bound domain operations; GameState delegates here to keep its state authoritative. */
import { ECONOMY } from '../../../../shared/Constants.js';
import { InternationalOrganizationEngine } from '../InternationalOrganizationEngine.js';
import { createEmptyActionSlots } from '../GameStateUtils.js';
import { describeAction, directedVariants, searchAction, proposeHumanVariants, humanExplorationCandidates } from './BotLearning.js';
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
      if (player.isEliminated) {
        player.phaseReady = true;
        player.plannedActions = createEmptyActionSlots(this.settings?.actionSlotCount);
        continue;
      }
      if (resetReadiness) player.phaseReady = false;
      if (!player.isBot) continue;
      if (!resetReadiness && player.phaseReady) continue;
      player.plannedActions = createEmptyActionSlots(this.settings?.actionSlotCount);
      this.activeBotStrategy = this.botStrategies?.[player.id];
      this.activeBotPlayer = player;
      this.chooseBotTaxRate(player);
      this.runBotStrategicActions(player);

      for (let slot = 0; slot < player.plannedActions.length; slot += 1) {
        const table = this.botDecisionTables.get(player.id);
        const context = BotDecisionTable.getContext(this, player);
        const featureContext = createActionFeatureContext(this, player, slot);
        const baseCandidates = this.findBotCandidates(player, slot)
          .map((action) => describeAction(this, player, action, featureContext));
        const directed = this.activeBotStrategy ? baseCandidates
          : directedVariants(this, player, slot, baseCandidates, table, context);
        const candidates = this.activeBotStrategy ? directed
          : proposeHumanVariants(this, player, slot, directed, context);
        if (!candidates.length) continue;
        const random = this.botRandom || Math.random;
        const exploring = random() < (this.botExplorationRate ?? 0.05);
        const mutations = candidates.filter((action) => !baseCandidates.includes(action));
        const choices = exploring && mutations.length && random() < 0.7 ? mutations : candidates;
        let selected = this.chooseBotCandidate(
          table,
          context,
          choices,
          random,
          exploring ? 1 : 0
        );
        if (!this.activeBotStrategy && !exploring && !this.findBotDefenseNeeds(player).length) {
          selected = searchAction(this, player, slot, candidates, table, context, selected);
        }
        this.planBotAction(player, selected, slot);
      }
      player.phaseReady = true;
      this.activeBotStrategy = null;
      this.activeBotPlayer = null;
    }
  },

  chooseBotCandidate(table, context, candidates, random, exploration) {
    const defenseNeeds = this.findBotDefenseNeeds(this.activeBotPlayer);
    if (defenseNeeds.length) {
      const urgency = new Map(defenseNeeds.map((need) => [`${need.x}:${need.y}`, need]));
      const defensiveRecruitment = candidates
        .filter((action) => action.type === 'RECRUIT_TROOP')
        .map((action) => ({ action, need: urgency.get(`${action.x}:${action.y}`) }))
        .filter((entry) => entry.need)
        .sort((left, right) => right.need.score - left.need.score
          || (right.action.count || 0) - (left.action.count || 0));
      if (defensiveRecruitment.length) return defensiveRecruitment[0].action;

      const defensiveMoves = candidates
        .filter((action) => action.type === 'MOVE_TROOPS')
        .map((action) => ({ action, need: urgency.get(`${action.targetX}:${action.targetY}`) }))
        .filter((entry) => entry.need)
        .sort((left, right) => right.need.score - left.need.score);
      if (defensiveMoves.length) return defensiveMoves[0].action;
    }
    if (!this.activeBotStrategy) {
      const hypotheses = this.trainingMode
        ? humanExplorationCandidates(this.botHumanIdeas, context, candidates) : [];
      if (hypotheses.length && exploration > 0 && random() < exploration) {
        const pool = random() < 0.5 ? hypotheses : candidates;
        return pool[Math.floor(random() * pool.length)];
      }
      return BotDecisionTable.choose(table, context, candidates, random, exploration);
    }
    const priorities = this.activeBotStrategy === 'economic'
      ? ['BUILD_FACTORY', 'BUILD_CITY', 'SELL_MATERIALS', 'SET_TAX_RATE', 'RECRUIT_TROOP', 'MOVE_TROOPS']
      : ['MOVE_TROOPS', 'RECRUIT_TROOP', 'BUILD_SHIP', 'BUILD_FACTORY', 'BUILD_CITY'];
    const score = (action) => {
      const index = priorities.indexOf(action.type);
      return index < 0 ? 100 : index;
    };
    return [...candidates].sort((a, b) => score(a) - score(b))[0];
  },

  findBotDefenseNeeds(player) {
    if (!player || player.isEliminated) return [];
    const needs = [];
    const settlements = new Set(['CAP', 'CIU', 'PUE']);
    for (const tile of this.grid.flat()) {
      if (tile.ownerId !== player.id || !settlements.has(tile.type)) continue;
      let adjacentEnemy = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const neighbor = this.grid[tile.y + dy]?.[tile.x + dx];
        if (!neighbor) continue;
        for (const enemy of this.players.values()) {
          if (enemy.id === player.id || enemy.isEliminated) continue;
          adjacentEnemy += this.getTroopsForPlayerOnTile(neighbor, enemy.id);
        }
      }
      const ownStrength = this.getTroopsForPlayerOnTile(tile, player.id) + (tile.defense || 0);
      const attackStrength = adjacentEnemy;
      if (attackStrength <= 0) continue;
      const score = (tile.type === 'CAP' ? 100 : tile.type === 'CIU' ? 60 : 30)
        + Math.max(0, attackStrength - ownStrength) * 10
        + attackStrength;
      needs.push({ x: tile.x, y: tile.y, score, attackStrength, ownStrength });
    }
    return needs.sort((left, right) => right.score - left.score);
  },

  findBotCandidates(player, slot) {
    const candidates = [];
    const add = (action) => {
      const field = action.troops != null ? 'troops' : action.count != null ? 'count'
        : action.ships != null ? 'ships' : null;
      const variants = field ? [...new Set([action[field], Math.ceil(action[field] / 2), 1])]
        .map((value) => ({ ...action, [field]: value })) : [action];
      for (const variant of variants) {
        const target = this.grid[variant.targetY]?.[variant.targetX];
        if (variant.type === 'MOVE_TROOPS' && target?.ownerId != null
          && target.ownerId !== player.id
          && variant.troops <= this.getTroopsForPlayerOnTile(target, target.ownerId)) continue;
        if (this.validatePlannedAction(player, variant, slot).ok) candidates.push(variant);
      }
    };
    const reserved = player.plannedActions.filter(Boolean);
    const silver = player.resources.SILVER - reserved.reduce((sum, a) => sum + this.getSilverCost(a), 0);
    const materials = player.resources.MATERIALS - reserved.reduce((sum, a) => sum + this.getMaterialCost(a), 0);
    const count = Math.min(Math.floor(silver / ECONOMY.COSTS.RECRUIT_TROOP_SILVER),
      Math.floor(materials / ECONOMY.COSTS.RECRUIT_TROOP_MATERIALS));
    for (const source of this.grid.flat()) {
      const hasUnits = this.getShipsForPlayerOnTile(source, player.id) > 0
        || this.getTroopsForPlayerOnTile(source, player.id) > 0;
      // El desarrollo no depende de que haya tropas en la casilla. Antes de esta
      // separación los bots solo evaluaban edificios en capitales/territorios con
      // unidades, dejando fuera casi todas las casillas aptas para una ciudad.
      const canDevelop = source.ownerId === player.id;
      if (!canDevelop && !hasUnits) continue;
      for (const type of ['BUILD_FACTORY', 'BUILD_CITY', 'MOVE_CAPITAL']) {
        if (canDevelop) add({ type, x: source.x, y: source.y });
      }
      if (count > 0 && canDevelop && ['CAP', 'CIU', 'PUE'].includes(source.type)) {
        add({ type: 'RECRUIT_TROOP', x: source.x, y: source.y, count });
      }
      if (!hasUnits) continue;
      if (canDevelop) add({ type: 'BUILD_SHIP', x: source.x, y: source.y, count: 1 });
      if (canDevelop && source.type === 'FT' && source.building === 'FACTORY') {
        add({ type: 'BUILD_CAR', x: source.x, y: source.y, count: 1 });
      }
      const available = this.getTroopsForPlayerOnTile(source, player.id) - reserved
        .filter((a) => a.type === 'MOVE_TROOPS' && a.x === source.x && a.y === source.y)
        .reduce((sum, a) => sum + a.troops, 0);
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        if (dx === 0 && dy === 0 || Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
        const target = this.grid[source.y + dy]?.[source.x + dx];
        if (!target) continue;
        const recentMoves = player.botMoveHistory || [];
        const repeatsRecentRoute = recentMoves.some((move) => move.round >= this.currentRound - 2
          && move.x === target.x && move.y === target.y
          && move.targetX === source.x && move.targetY === source.y);
        const repeatsSameRoute = recentMoves.some((move) => move.round >= this.currentRound - 2
          && move.x === source.x && move.y === source.y
          && move.targetX === target.x && move.targetY === target.y);
        // No repetir ida y vuelta dentro de tres rondas salvo que sea una
        // conquista/avance sobre territorio neutral o enemigo.
        if ((repeatsRecentRoute || repeatsSameRoute) && target.ownerId === player.id) continue;
        const base = { x: source.x, y: source.y, targetX: target.x, targetY: target.y };
        const defenders = target.ownerId && target.ownerId !== player.id
          ? this.getTroopsForPlayerOnTile(target, target.ownerId) + (target.defense || 0) : 0;
        for (const troops of new Set([Math.max(1, Math.floor(available / 2)), defenders + 1, available])) {
          if (troops > 0 && troops <= available && troops > defenders) add({ ...base, type: 'MOVE_TROOPS', troops });
        }
        const ships = Math.min(this.getShipsForPlayerOnTile(source, player.id),
          source.transportedTroopsByPlayer?.[player.id] || 0);
        if (ships > 0) add({ ...base, type: 'MOVE_SHIPS', ships });
        const cars = this.getCarsForPlayerOnTile(source, player.id);
        const carTroops = Math.min(available, cars * ECONOMY.GROUND_TRANSPORT.TROOPS_PER_CAR);
        if (carTroops > 0) add({ ...base, type: 'MOVE_CARS', troops: carTroops });
        const capacity = this.getShipsForPlayerOnTile(target, player.id) * ECONOMY.NAVAL.TROOPS_PER_SHIP
          - (target.transportedTroopsByPlayer?.[player.id] || 0);
        const embark = Math.min(available, capacity);
        if (embark > 0) add({ ...base, type: 'EMBARK_TROOPS', troops: embark });
        const carried = source.transportedTroopsByPlayer?.[player.id] || 0;
        if (carried > 0) add({ ...base, type: 'DISEMBARK_TROOPS', troops: carried });
      }
    }
    // Preserve a useful untrained default; learned scores can override this order.
    const priority = (a) => a.type === 'MOVE_TROOPS'
      ? (this.grid[a.targetY][a.targetX].ownerId == null ? 0
          : this.grid[a.targetY][a.targetX].ownerId !== player.id ? 1 : 4)
      : a.type === 'BUILD_FACTORY' ? 2 : a.type === 'RECRUIT_TROOP' ? 3 : 5;
    return [...new Map(candidates.map((action) => [JSON.stringify(action), action])).values()]
      .sort((a, b) => priority(a) - priority(b));
  },

  chooseBotTaxRate(player) {
    const rates = [0.1, 0.15, 0.2, 0.25, 0.3];
    const contextKey = BotDecisionTable.getContext(this, player);
    const table = this.botDecisionTables.get(player.id);
    const featureContext = createActionFeatureContext(this, player);
    const candidates = rates.map((taxRate) => describeAction(this, player, { type: 'SET_TAX_RATE', taxRate }, featureContext));
    const selected = table
      ? this.chooseBotCandidate(
        table,
        contextKey,
        candidates,
        this.botRandom || Math.random,
        this.botExplorationRate
      )
      : candidates[1];
    player.taxRate = selected.taxRate;
    this.rememberStrategicDecision(player, contextKey, BotDecisionTable.getActionKey(selected), selected.features);
  },

  runBotStrategicActions(player) {
    if (!this.botStrategicActionsEnabled) return;
    const contextKey = BotDecisionTable.getContext(this, player);
    const featureContext = createActionFeatureContext(this, player);
    const actions = [
      ...this.findBotFinanceActions(player),
      ...this.findBotTreatyActions(player),
      ...this.findBotOIProposals(player)
    ].filter(Boolean).map((action) => describeAction(this, player, action, featureContext));
    if (!actions.length) return;
    const table = this.botDecisionTables.get(player.id);
    const selected = table
      ? this.chooseBotCandidate(
        table,
        contextKey,
        actions,
        this.botRandom || Math.random,
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
    this.rememberStrategicDecision(player, contextKey, BotDecisionTable.getActionKey(selected), selected.features);
  },

  rememberStrategicDecision(player, contextKey, actionType, features) {
    player.botDecisionHistory ||= [];
    player.botDecisionHistory.push({ contextKey, actionType, round: this.currentRound, features });
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
    if (!this.bonds.some((bond) => bond.playerId === player.id && !bond.paid)
      && (this.bankFund?.SILVER || 0) >= ECONOMY.COSTS.BOND_PROCEEDS) {
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
    const alreadyProposed = new Set((this.oiProposals || []).map((proposal) => proposal.type));
    return ['ARMAMENT_LIMIT', 'INDUSTRY_LIMIT', 'CONDITIONAL_SUBSIDY']
      .filter((resolutionType) => !alreadyProposed.has(resolutionType))
      .map((resolutionType) => ({
        type: 'PROPOSE_OI_RESOLUTION',
        resolutionType,
        playerId: player.id
      }));
  },

  planBotAction(player, action, slot) {
    const validation = this.validatePlannedAction(player, action, slot);
    if (!validation.ok) return false;
    const contextKey = BotDecisionTable.getContext(this, player);
    const actionType = BotDecisionTable.getActionKey(action);
    player.botDecisionContext ||= {};
    player.botDecisionHistory ||= [];
    player.botDecisionContext[slot] = { contextKey, actionType };
    player.botDecisionHistory.push({ contextKey, actionType, slot, round: this.currentRound, features: action.features });
    if (['MOVE_TROOPS', 'MOVE_CARS', 'MOVE_SHIPS'].includes(action.type)) {
      player.botMoveHistory ||= [];
      player.botMoveHistory.push({
        x: action.x, y: action.y,
        targetX: action.targetX, targetY: action.targetY,
        round: this.currentRound
      });
      if (player.botMoveHistory.length > 12) player.botMoveHistory.shift();
    }
    player.plannedActions[slot] = action;
    return true;
  },

  rememberBotActionResult(playerId, action, successful) {
    const player = this.players.get(playerId);
    if (!player?.isBot || !action?.type) return;
    const contextKey = player.botDecisionContext?.[action.slot]?.contextKey
      || BotDecisionTable.getContext(this, player);
    const actionType = player.botDecisionContext?.[action.slot]?.actionType || BotDecisionTable.getActionKey(action);
    const table = this.botDecisionTables.get(playerId);
    if (table && this.trainingMode) {
      BotDecisionTable.remember(table, contextKey, actionType, successful);
    }
    const decision = [...(player.botDecisionHistory || [])]
      .reverse()
      .find((entry) => (
        entry.contextKey === contextKey
        && entry.actionType === actionType
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
    if (this.trainingMode) {
      for (const table of new Set(this.botDecisionTables.values())) fitActionModel(table);
    }
    return rewards;
  },
};
