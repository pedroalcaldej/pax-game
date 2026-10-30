/**
 * server/src/game/GameState.js
 */

import { generateInitialGrid } from '../../../shared/MapGenerator.js';
import { MAP_CONFIG, GAME_STAGES } from '../../../shared/Constants.js';
import { DiplomacyEngine } from './DiplomacyEngine.js';
import { FinanceEngine } from './FinanceEngine.js';
import { PlayerManager } from './PlayerManager.js';
import { ActionEngine } from './ActionEngine.js';
import { BotController } from './BotController.js';
export class GameState {
  constructor() {
    this.gridWidth = MAP_CONFIG.GRID_WIDTH;
    this.gridHeight = MAP_CONFIG.GRID_HEIGHT;
    this.players = new Map();
    this.gameStarted = false;
    this.gameOver = false;
    this.currentPhase = 1;
    this.currentStage = GAME_STAGES.ROUND_START;
    this.timeRemaining = 60;
    this.isPaused = false;
    this.currentRound = 1;
    this.seed = Date.now();
    this.actionResolutionId = 0;
    this.lastActionResolutions = [];
    this.eventHistory = [];
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
    this.bankFund = { SILVER: 0, MATERIALS: 0 };
    this.worldBankFund = this.bankFund;
    this.bonds = [];
    this.nextBondId = 1;
    this.conflicts = [];
    this.aggressions = [];
    this.casusBelli = [];

    this.grid = generateInitialGrid(this.seed);
    this.createNations();
  }

  createNations(...args) {
    return PlayerManager.createNations.apply(this, args);
  }

  refreshBotColors(...args) {
    return PlayerManager.refreshBotColors.apply(this, args);
  }

  recordEvent(message) {
    const event = {
      id: this.nextEventId,
      timestamp: Date.now(),
      round: this.currentRound,
      phase: this.currentPhase,
      message
    };
    this.nextEventId += 1;
    this.eventHistory.push(event);
    return event;
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

  removeTroopsFromPlayerOnTile(...args) {
    return ActionEngine.removeTroopsFromPlayerOnTile.apply(this, args);
  }

  getTroopsForPlayerOnTile(...args) {
    return ActionEngine.getTroopsForPlayerOnTile.apply(this, args);
  }

  applyPlayerAction(...args) {
    return ActionEngine.applyPlayerAction.apply(this, args);
  }

  runBotDecisions(...args) {
    return BotController.runBotDecisions.apply(this, args);
  }

  findBotExpansion(...args) {
    return BotController.findBotExpansion.apply(this, args);
  }

  findBotAttack(...args) {
    return BotController.findBotAttack.apply(this, args);
  }

  findBotBuildAction(...args) {
    return BotController.findBotBuildAction.apply(this, args);
  }

  findBotRecruitment(...args) {
    return BotController.findBotRecruitment.apply(this, args);
  }

  planBotAction(...args) {
    return BotController.planBotAction.apply(this, args);
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
      players: Array.from(this.players.values(), (player) => ({
        ...player,
        gdiPoints: this.calculateGDI(player)
      })),
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      isPaused: this.isPaused,
      actionResolutionId: this.actionResolutionId,
      lastActionResolutions: this.lastActionResolutions,
      eventHistory: this.eventHistory,
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
      bankFund: this.bankFund,
      worldBankFund: this.worldBankFund,
      bonds: this.bonds,
      activeConflicts: this.getActiveConflicts(),
      aggressions: this.aggressions,
      casusBelli: this.casusBelli
    };
  }
}
