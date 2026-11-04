import { randomUUID } from 'node:crypto';
/**
 * server/src/game/GameState.js
 */

import { generateInitialGrid } from '../../../shared/MapGenerator.js';
import { GAME_STAGES, normalizeGameSettings } from '../../../shared/Constants.js';
import { DiplomacyEngine } from './DiplomacyEngine.js';
import { EconomyEngine } from './EconomyEngine.js';
import { FinanceEngine } from './FinanceEngine.js';
import { PlayerManager } from './PlayerManager.js';
import { ActionEngine } from './ActionEngine.js';
import { BotController } from './bots/BotController.js';
import { BotDecisionTable } from './bots/BotDecisionTable.js';
import { recordHumanExperience } from '../training/BotMemoryStore.js';
export class GameState {
  constructor(settings = {}, botDecisionTables = null) {
    this.settings = normalizeGameSettings(settings);
    this.gridWidth = this.settings.mapSize;
    this.gridHeight = this.settings.mapSize;
    this.players = new Map();
    this.gameStarted = false;
    this.gameOver = false;
    this.currentPhase = 1;
    this.currentStage = GAME_STAGES.ROUND_START;
    this.timeRemaining = this.settings.planningDuration;
    this.isPaused = false;
    this.currentRound = 1;
    this.seed = this.settings.mapSeed || Date.now();
    this.actionResolutionId = 0;
    this.lastActionResolutions = [];
    this.eventHistory = [];
    this.roundMapHistory = new Map();
    this.mapHistoryId = randomUUID();
    this.nextEventId = 1;
    this.oiProposals = [];
    this.nextOIProposalId = 1;
    this.oiSession = null;
    this.oiPolicies = {
      armamentLimit: null,
      industryLimit: null
    };
    this.activeDmzZones = [];
    this.nonAggressionPacts = [];
    this.freeTradeTreaties = [];
    this.treatyOffers = [];
    this.nextTreatyOfferId = 1;
    this.tradeOffers = [];
    this.nextTradeOfferId = 1;
    this.bankFund = { SILVER: 0, MATERIALS: 0 };
    this.worldBankFund = this.bankFund;
    this.bonds = [];
    this.nextBondId = 1;
    this.conflicts = [];
    this.aggressions = [];
    this.casusBelli = [];
    this.taxRatesAtLastRoundEnd = new Map();
    this.botDecisionTables = botDecisionTables || new Map();
    this.trainingMode = false;
    this.botExplorationRate = 0.05;
    this.botSearchWidth = 3;
    this.botDirectedExploration = true;
    this.botIntermediateRewards = true;
    this.botStrategicActionsEnabled = true;

    const numericSeed = typeof this.seed === 'number'
      ? this.seed
      : [...String(this.seed)].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
    this.grid = generateInitialGrid(numericSeed, { size: this.settings.mapSize });
    this.createNations();
    for (const player of this.players.values()) {
      this.taxRatesAtLastRoundEnd.set(player.id, player.taxRate);
      if (!this.botDecisionTables.has(player.id)) {
        this.botDecisionTables.set(player.id, BotDecisionTable.create());
      }
    }
  }

  createNations(...args) {
    return PlayerManager.createNations.apply(this, args);
  }

  refreshBotColors(...args) {
    return PlayerManager.refreshBotColors.apply(this, args);
  }

  recordEvent(message, details = {}) {
    const event = {
      id: this.nextEventId,
      timestamp: Date.now(),
      round: this.currentRound,
      phase: this.currentPhase,
      message,
      ...details
    };
    this.nextEventId += 1;
    this.eventHistory.push(event);
    return event;
  }

  recordTaxRateChangesAtRoundEnd() {
    for (const player of this.players.values()) {
      const previousTaxRate = this.taxRatesAtLastRoundEnd.get(player.id);
      if (previousTaxRate !== undefined && previousTaxRate !== player.taxRate) {
        this.recordEvent(
          `${player.name} cambió su tasa de impuestos a ${Math.round(player.taxRate * 100)}%.`
        );
      }
      this.taxRatesAtLastRoundEnd.set(player.id, player.taxRate);
    }
  }

  proposeTreaty(...args) {
    return DiplomacyEngine.proposeTreaty.apply(this, args);
  }

  respondToTreaty(...args) {
    return DiplomacyEngine.respondToTreaty.apply(this, args);
  }

  cancelTreatyOffer(...args) {
    return DiplomacyEngine.cancelTreatyOffer.apply(this, args);
  }

  applyTreatyResponse(...args) {
    return DiplomacyEngine.applyTreatyResponse.apply(this, args);
  }

  expireTreatiesAfterRound(...args) {
    return DiplomacyEngine.expireTreatiesAfterRound.apply(this, args);
  }

  breakNonAggressionPact(...args) {
    return DiplomacyEngine.breakNonAggressionPact.apply(this, args);
  }

  isPlayersAtWar(...args) {
    return DiplomacyEngine.isPlayersAtWar.apply(this, args);
  }

  getActiveConflicts(...args) {
    return DiplomacyEngine.getActiveConflicts.apply(this, args);
  }

  registerMilitaryConflict(...args) {
    return DiplomacyEngine.registerMilitaryConflict.apply(this, args);
  }

  areTreatyPartners(...args) {
    return DiplomacyEngine.areTreatyPartners.apply(this, args);
  }

  performFinancialAction(...args) {
    return FinanceEngine.performFinancialAction.apply(this, args);
  }

  processBondsAtRoundStart(...args) {
    return FinanceEngine.processBondsAtRoundStart.apply(this, args);
  }

  awardEndOfTurnInfluence(...args) {
    return EconomyEngine.awardEndOfTurnInfluence.apply(this, args);
  }

  botAcceptsTreaty(...args) {
    return DiplomacyEngine.botAcceptsTreaty.apply(this, args);
  }

  getTreatyName(...args) {
    return DiplomacyEngine.getTreatyName.apply(this, args);
  }

  addPlayer(...args) {
    return PlayerManager.addPlayer.apply(this, args);
  }

  markPlayerDisconnected(...args) {
    return PlayerManager.markPlayerDisconnected.apply(this, args);
  }

  rejoinPlayer(...args) {
    return PlayerManager.rejoinPlayer.apply(this, args);
  }

  leavePlayer(...args) {
    return PlayerManager.leavePlayer.apply(this, args);
  }

  removePlayer(...args) {
    return PlayerManager.removePlayer.apply(this, args);
  }

  setPlayerTaxRate(...args) {
    return PlayerManager.setPlayerTaxRate.apply(this, args);
  }

  markPlayerReady(...args) {
    return PlayerManager.markPlayerReady.apply(this, args);
  }

  performPlayerAction(...args) {
    return ActionEngine.performPlayerAction.apply(this, args);
  }

  getActionName(...args) {
    return ActionEngine.getActionName.apply(this, args);
  }

  validatePlannedAction(...args) {
    return ActionEngine.validatePlannedAction.apply(this, args);
  }

  getSilverCost(...args) {
    return ActionEngine.getSilverCost.apply(this, args);
  }

  getMaterialCost(...args) {
    return ActionEngine.getMaterialCost.apply(this, args);
  }

  resolvePlannedActions(...args) {
    return ActionEngine.resolvePlannedActions.apply(this, args);
  }

  resolveTroopMovement(...args) {
    return ActionEngine.resolveTroopMovement.apply(this, args);
  }

  resolveShipMovement(...args) {
    return ActionEngine.resolveShipMovement.apply(this, args);
  }

  resolveEmbarkTroops(...args) {
    return ActionEngine.resolveEmbarkTroops.apply(this, args);
  }

  resolveDisembarkTroops(...args) {
    return ActionEngine.resolveDisembarkTroops.apply(this, args);
  }

  removeTroopsFromPlayerOnTile(...args) {
    return ActionEngine.removeTroopsFromPlayerOnTile.apply(this, args);
  }

  getTroopsForPlayerOnTile(...args) {
    return ActionEngine.getTroopsForPlayerOnTile.apply(this, args);
  }

  getShipsForPlayerOnTile(...args) {
    return ActionEngine.getShipsForPlayerOnTile.apply(this, args);
  }

  getCarsForPlayerOnTile(...args) {
    return ActionEngine.getCarsForPlayerOnTile.apply(this, args);
  }

  normalizeWaterTroops(...args) {
    return ActionEngine.normalizeWaterTroops.apply(this, args);
  }

  getShipyardWaterTile(...args) {
    return ActionEngine.getShipyardWaterTile.apply(this, args);
  }

  getShipyardWaterTiles(...args) {
    return ActionEngine.getShipyardWaterTiles.apply(this, args);
  }

  applyPlayerAction(...args) {
    return ActionEngine.applyPlayerAction.apply(this, args);
  }

  runBotDecisions(...args) {
    return BotController.runBotDecisions.apply(this, args);
  }

  chooseBotCandidate(...args) {
    return BotController.chooseBotCandidate.apply(this, args);
  }

  findBotCandidates(...args) {
    return BotController.findBotCandidates.apply(this, args);
  }

  findBotDefenseNeeds(...args) {
    return BotController.findBotDefenseNeeds.apply(this, args);
  }

  chooseBotTaxRate(...args) {
    return BotController.chooseBotTaxRate.apply(this, args);
  }

  runBotStrategicActions(...args) {
    return BotController.runBotStrategicActions.apply(this, args);
  }

  rememberStrategicDecision(...args) {
    return BotController.rememberStrategicDecision.apply(this, args);
  }

  findBotFinanceActions(...args) {
    return BotController.findBotFinanceActions.apply(this, args);
  }

  findBotTreatyActions(...args) {
    return BotController.findBotTreatyActions.apply(this, args);
  }

  findBotOIProposals(...args) {
    return BotController.findBotOIProposals.apply(this, args);
  }

  planBotAction(...args) {
    return BotController.planBotAction.apply(this, args);
  }

  rememberBotActionResult(...args) {
    return BotController.rememberBotActionResult.apply(this, args);
  }

  recordHumanExperience(action, successful, contextKey) {
    if (this.trainingMode || !action?.type) return;
    recordHumanExperience({
      contextKey: contextKey || BotDecisionTable.getContext(
        this,
        [...this.players.values()].find((player) => player.id === action.playerId)
      ),
      actionType: action.type,
      action,
      successful
    });
  }

  awardBotFinalRewards(...args) {
    return BotController.awardBotFinalRewards.apply(this, args);
  }

  allPlayersReady(...args) {
    return PlayerManager.allPlayersReady.apply(this, args);
  }

  calculateGDI(player) {
    const resources = ['SILVER', 'MATERIALS', 'INFLUENCE']
      .reduce((total, resource) => (
        total + (Number.isFinite(player.resources?.[resource]) ? player.resources[resource] : 0)
      ), 0);
    const population = this.grid.flat().reduce(
      (total, tile) => total + (tile.ownerId === player.id ? tile.population || 0 : 0),
      0
    );
    return Math.floor(resources + population);
  }

  getState() {
    this.normalizeWaterTroops();
    const publicOISession = this.oiSession
      ? ({
        id: this.oiSession.id,
        phase: this.oiSession.phase,
        meetingAfterRound: this.oiSession.meetingAfterRound,
        timeRemaining: this.oiSession.timeRemaining,
        proposals: this.oiSession.proposals,
        results: this.oiSession.results,
        votesSubmitted: Object.keys(this.oiSession.votes)
      })
      : null;
    return {
      grid: this.grid,
      players: Array.from(this.players.values(), (player) => {
        const { botDecisionContext, botDecisionHistory, ...publicPlayer } = player;
        return { ...publicPlayer, gdiPoints: this.calculateGDI(player) };
      }),
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      isPaused: this.isPaused,
      actionResolutionId: this.actionResolutionId,
      lastActionResolutions: this.lastActionResolutions,
      eventHistory: this.eventHistory,
      mapHistoryId: this.mapHistoryId,
      mapHistoryRounds: [...this.roundMapHistory.keys()],
      currentPhase: this.currentPhase,
      currentStage: this.currentStage,
      timeRemaining: this.timeRemaining,
      currentRound: this.currentRound,
      seed: this.seed,
      oiProposals: this.oiProposals,
      oiSession: publicOISession,
      oiPolicies: this.oiPolicies,
      activeDmzZones: this.activeDmzZones,
      nonAggressionPacts: this.nonAggressionPacts,
      freeTradeTreaties: this.freeTradeTreaties,
      treatyOffers: this.treatyOffers,
      tradeOffers: this.tradeOffers,
      bankFund: this.bankFund,
      worldBankFund: this.worldBankFund,
      bonds: this.bonds,
      activeConflicts: this.getActiveConflicts(),
      aggressions: this.aggressions,
      casusBelli: this.casusBelli,
      settings: this.settings
    };
  }
}
