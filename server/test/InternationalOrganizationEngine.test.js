import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ROUNDS, OI_RESOLUTIONS, TERRAIN_TYPES } from '../../shared/Constants.js';
import { GameState } from '../src/game/GameState.js';
import { EconomyEngine } from '../src/game/EconomyEngine.js';
import { InternationalOrganizationEngine as OI } from '../src/game/InternationalOrganizationEngine.js';
import { PhaseManager } from '../src/game/PhaseManager.js';
import { Room } from '../src/network/RoomManager.js';

function createHumanGame() {
  const gameState = new GameState();
  gameState.gameStarted = true;
  gameState.currentPhase = 2;
  const player = gameState.players.get('nation-0');
  player.socketId = 'human-socket';
  player.boundPlayerId = 'human-player';
  player.isBot = false;
  return { gameState, player };
}

test('proposing a resolution costs two influence and rejects insufficient funds', () => {
  const { gameState, player } = createHumanGame();
  player.resources.INFLUENCE = 2;

  const accepted = OI.propose(gameState, player.socketId, {
    type: OI_RESOLUTIONS.ARMAMENT_LIMIT
  });
  const rejected = OI.propose(gameState, player.socketId, {
    type: OI_RESOLUTIONS.INDUSTRY_LIMIT
  });

  assert.equal(accepted.ok, true);
  assert.equal(player.resources.INFLUENCE, 0);
  assert.equal(rejected.ok, false);
  assert.equal(gameState.oiProposals.length, 1);
});

test('meeting selects the first three proposals, clears the rest, and hides ballots', () => {
  const { gameState, player } = createHumanGame();
  const types = [
    OI_RESOLUTIONS.ARMAMENT_LIMIT,
    OI_RESOLUTIONS.INDUSTRY_LIMIT,
    OI_RESOLUTIONS.CONDITIONAL_SUBSIDY,
    OI_RESOLUTIONS.DEMILITARIZED_ZONE
  ];
  types.forEach((type, index) => {
    gameState.oiProposals.push({
      id: `proposal-${index}`,
      sequence: index,
      type,
      name: type,
      proposerId: player.id
    });
  });
  gameState.currentRound = 5;
  gameState.aggressions = [{ attackerId: player.id }];
  gameState.casusBelli = [{ holderId: player.id }];
  gameState.activeDmzZones = [
    { x: 1, y: 1, expiresAfterRound: 4 },
    { x: 5, y: 5, expiresAfterRound: 10 }
  ];

  const session = OI.startSession(gameState);
  session.votes[player.id] = [];
  const publicState = gameState.getState();

  assert.deepEqual(session.proposals.map((proposal) => proposal.id), [
    'proposal-0',
    'proposal-1',
    'proposal-2'
  ]);
  assert.equal(gameState.oiProposals.length, 0);
  assert.equal(gameState.aggressions.length, 1);
  assert.equal(gameState.casusBelli.length, 1);
  assert.deepEqual(gameState.activeDmzZones, [{ x: 5, y: 5, expiresAfterRound: 10 }]);
  assert.equal(Object.hasOwn(publicState.oiSession, 'votes'), false);
  assert.ok(publicState.oiSession.votesSubmitted.includes(player.id));
});

test('bots oppose harmful resolutions with half their influence and abstain on neutral ones', () => {
  const { gameState } = createHumanGame();
  const bot = gameState.players.get('nation-1');
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId === bot.id) tile.troops = 0;
  }
  const troopTile = gameState.grid[5][5];
  troopTile.ownerId = bot.id;
  troopTile.troops = 11;
  const proposals = [
    {
      id: 'harmful',
      type: OI_RESOLUTIONS.ARMAMENT_LIMIT
    },
    {
      id: 'neutral',
      type: OI_RESOLUTIONS.INDUSTRY_LIMIT
    }
  ];

  assert.deepEqual(OI.getBotBallot(gameState, bot, proposals), [
    { proposalId: 'harmful', choice: 'AGAINST', wager: 10 },
    { proposalId: 'neutral', choice: 'ABSTAIN', wager: 0 }
  ]);
});

test('vote stakes are consumed and an armament limit passes only on a strict majority', () => {
  const { gameState, player } = createHumanGame();
  gameState.oiProposals = [{
    id: 'armament',
    type: OI_RESOLUTIONS.ARMAMENT_LIMIT,
    name: 'Armament limit',
    sequence: 1
  }];
  const session = OI.startSession(gameState);
  const ballot = [{
    proposalId: 'armament',
    choice: 'FOR',
    wager: 2
  }];

  assert.equal(OI.submitVote(gameState, player.socketId, ballot).ok, true);
  assert.equal(OI.submitVote(gameState, player.socketId, ballot).ok, false);
  assert.equal(OI.finishSession(gameState), true);
  assert.equal(gameState.oiPolicies.armamentLimit, 10);
  assert.equal(player.resources.INFLUENCE, 18);
  assert.equal(session.results[0].passed, true);
});

test('a tie rejects a resolution and still consumes the submitted wagers', () => {
  const { gameState, player } = createHumanGame();
  gameState.aggressions = [{ attackerId: player.id }];
  gameState.casusBelli = [{ holderId: player.id }];
  gameState.oiProposals = [{
    id: 'industry',
    type: OI_RESOLUTIONS.INDUSTRY_LIMIT,
    name: 'Industry limit',
    sequence: 1
  }];
  const session = OI.startSession(gameState);
  const opposingBot = gameState.players.get('nation-1');
  session.votes[opposingBot.id] = [{
    proposalId: 'industry',
    choice: 'AGAINST',
    wager: 2
  }];
  OI.submitVote(gameState, player.socketId, [{
    proposalId: 'industry',
    choice: 'FOR',
    wager: 2
  }]);

  OI.finishSession(gameState);

  assert.equal(session.results[0].passed, false);
  assert.equal(gameState.oiPolicies.industryLimit, null);
  assert.equal(player.resources.INFLUENCE, 18);
  assert.equal(opposingBot.resources.INFLUENCE, 18);
  assert.deepEqual(gameState.aggressions, []);
  assert.deepEqual(gameState.casusBelli, []);
});

test('approved limits prevent recruitment and factory construction above ten', () => {
  const { gameState, player } = createHumanGame();
  const tiles = gameState.grid.flat();
  for (const tile of tiles) {
    if (tile.ownerId === player.id) tile.troops = 0;
  }
  const troopTile = tiles[0];
  troopTile.ownerId = player.id;
  troopTile.type = 'TR';
  troopTile.building = null;
  troopTile.troops = 9;
  gameState.oiPolicies.armamentLimit = 10;

  assert.equal(gameState.validatePlannedAction(player, {
    type: 'RECRUIT_TROOP',
    x: troopTile.x,
    y: troopTile.y,
    count: 2
  }, 0).ok, false);

  gameState.oiPolicies.industryLimit = 10;
  const factoryTiles = tiles.slice(1, 11);
  factoryTiles.forEach((tile) => {
    tile.ownerId = player.id;
    tile.type = 'FT';
    tile.building = 'FACTORY';
    tile.factoriesCount = 1;
  });
  const buildTile = tiles[11];
  buildTile.ownerId = player.id;
  buildTile.type = 'TR';
  buildTile.building = null;

  assert.equal(gameState.validatePlannedAction(player, {
    type: 'BUILD_FACTORY',
    x: buildTile.x,
    y: buildTile.y
  }, 0).ok, false);
});

test('a demilitarized zone evacuates troops and remains active for five rounds', () => {
  const { gameState, player } = createHumanGame();
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId === player.id) tile.troops = 0;
  }
  const source = gameState.grid[10][10];
  const destination = gameState.grid[10][7];
  source.ownerId = player.id;
  source.type = 'TR';
  source.building = null;
  source.troops = 3;
  destination.ownerId = player.id;
  destination.type = 'TR';
  destination.building = null;
  destination.troops = 0;
  gameState.currentRound = 6;

  OI.applyResolution(gameState, {
    type: OI_RESOLUTIONS.DEMILITARIZED_ZONE,
    target: { x: 10, y: 10 }
  }, []);

  assert.equal(source.troops, 0);
  assert.equal(destination.troops, 3);
  assert.equal(OI.isInActiveDmz(gameState, 12, 12), true);
  assert.equal(OI.isInActiveDmz(gameState, 13, 12), false);
  assert.equal(gameState.activeDmzZones[0].expiresAfterRound, 10);
});

test('subsidies pay the lowest-GDI country and create five-round non-aggression pacts', () => {
  const { gameState } = createHumanGame();
  const beneficiary = gameState.players.get('nation-1');
  const supportingPlayer = gameState.players.get('nation-2');
  beneficiary.resources = { SILVER: 0, MATERIALS: 0, INFLUENCE: 0 };
  gameState.currentRound = 6;
  const silverBefore = beneficiary.resources.SILVER;

  OI.applyResolution(gameState, {
    type: OI_RESOLUTIONS.CONDITIONAL_SUBSIDY
  }, [{
    playerId: supportingPlayer.id,
    choice: 'FOR',
    wager: 1
  }]);

  assert.equal(beneficiary.resources.SILVER, silverBefore + 25);
  assert.equal(OI.arePlayersBoundByPact(gameState, beneficiary.id, supportingPlayer.id), true);
  assert.equal(gameState.nonAggressionPacts[0].expiresAfterRound, 10);
});

test('GDI is the sum of a nation’s resources and territory population', () => {
  const { gameState, player } = createHumanGame();
  player.resources = { SILVER: 120, MATERIALS: 14, INFLUENCE: 7 };
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId === player.id) tile.population = 0;
  }
  const city = gameState.grid.flat().find((tile) => tile.ownerId === player.id);
  city.population = 235;

  assert.equal(gameState.calculateGDI(player), 376);
  assert.equal(gameState.getState().players.find((entry) => entry.id === player.id).gdiPoints, 376);
});

test('players gain one influence for each controlled city or capital at end of turn', () => {
  const { gameState, player } = createHumanGame();
  const controlledUrbanTiles = gameState.grid.flat().filter((tile) => tile.ownerId === player.id);
  assert.ok(controlledUrbanTiles.length >= 2);
  for (const tile of controlledUrbanTiles) tile.type = 'TR';
  controlledUrbanTiles[0].type = 'CAP';
  controlledUrbanTiles[1].type = 'CIU';
  player.resources.INFLUENCE = 20;

  EconomyEngine.awardEndOfTurnInfluence(gameState);

  assert.equal(player.resources.INFLUENCE, 22);
  assert.match(gameState.eventHistory.at(-1).message, /obtuvo 2 de Influencia Política/);
});

test('players can propose and accept a five-round non-aggression pact', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  recipient.socketId = 'recipient-socket';
  recipient.isBot = false;
  gameState.currentRound = 3;

  const proposal = gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'NON_AGGRESSION_PACT'
  });

  assert.equal(proposal.ok, true);
  assert.equal(gameState.treatyOffers.length, 1);
  assert.equal(gameState.nonAggressionPacts.length, 0);

  const response = gameState.respondToTreaty(
    recipient.socketId,
    gameState.treatyOffers[0].id,
    true
  );

  assert.equal(response.ok, true);
  assert.equal(gameState.treatyOffers.length, 0);
  assert.equal(gameState.nonAggressionPacts[0].expiresAfterRound, 7);
  assert.equal(OI.arePlayersBoundByPact(gameState, player.id, recipient.id), true);
  gameState.currentRound = 8;
  assert.equal(OI.arePlayersBoundByPact(gameState, player.id, recipient.id), false);
});

test('only the recipient may reject a pending treaty offer', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  const otherPlayer = gameState.players.get('nation-2');
  recipient.socketId = 'recipient-socket';
  recipient.isBot = false;
  otherPlayer.socketId = 'other-socket';
  otherPlayer.isBot = false;

  gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'NON_AGGRESSION_PACT'
  });
  const offerId = gameState.treatyOffers[0].id;

  const unauthorizedResponse = gameState.respondToTreaty(otherPlayer.socketId, offerId, true);
  assert.equal(unauthorizedResponse.ok, false);
  assert.equal(gameState.treatyOffers.length, 1);

  const rejection = gameState.respondToTreaty(recipient.socketId, offerId, false);
  assert.equal(rejection.ok, true);
  assert.equal(gameState.treatyOffers.length, 0);
  assert.equal(gameState.nonAggressionPacts.length, 0);
});

test('players can negotiate treaties during planning and only the proposer can cancel an offer', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  const otherPlayer = gameState.players.get('nation-2');
  recipient.socketId = 'recipient-socket';
  recipient.isBot = false;
  otherPlayer.socketId = 'other-socket';
  otherPlayer.isBot = false;
  gameState.currentPhase = 2;

  const proposal = gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'FREE_TRADE'
  });
  assert.equal(proposal.ok, true);

  const offerId = gameState.treatyOffers[0].id;
  assert.equal(gameState.cancelTreatyOffer(otherPlayer.socketId, offerId).ok, false);
  assert.equal(gameState.treatyOffers.length, 1);
  assert.equal(gameState.cancelTreatyOffer(player.socketId, offerId).ok, true);
  assert.equal(gameState.treatyOffers.length, 0);
  assert.match(gameState.eventHistory.at(-1).message, /canceló la propuesta/);

  gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'NON_AGGRESSION_PACT'
  });
  const response = gameState.respondToTreaty(
    recipient.socketId,
    gameState.treatyOffers[0].id,
    true
  );
  assert.equal(response.ok, true);
  assert.equal(gameState.nonAggressionPacts.length, 1);
  assert.match(gameState.eventHistory.at(-1).message, /firmaron el Pacto de No Agresión/);
});

test('treaties expire at the end of their fifth round and are logged', () => {
  const { gameState, player } = createHumanGame();
  gameState.players.get('nation-1').name = 'Nación Roja';
  gameState.nonAggressionPacts.push({
    playerIds: [player.id, 'nation-1'],
    expiresAfterRound: 5
  });
  gameState.freeTradeTreaties.push({
    playerIds: [player.id, 'nation-1'],
    expiresAfterRound: 5
  });

  gameState.expireTreatiesAfterRound(5);

  assert.equal(gameState.nonAggressionPacts.length, 0);
  assert.equal(gameState.freeTradeTreaties.length, 0);
  assert.equal(gameState.eventHistory.length, 2);
  assert.match(gameState.eventHistory[0].message, /Pacto de No Agresión entre .* expiró/);
  assert.match(gameState.eventHistory[1].message, /Tratado de Libre Comercio entre .* expiró/);
});

test('free-trade treaties are active for five rounds', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  recipient.socketId = 'recipient-socket';
  recipient.isBot = false;

  gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'FREE_TRADE'
  });
  const result = gameState.respondToTreaty(
    recipient.socketId,
    gameState.treatyOffers[0].id,
    true
  );

  assert.equal(result.ok, true);
  assert.equal(gameState.freeTradeTreaties.length, 1);
  assert.equal(gameState.freeTradeTreaties[0].expiresAfterRound, 5);
});

test('the global market buys and sells materials at the fixed prices', () => {
  const { gameState, player } = createHumanGame();
  gameState.currentPhase = 2;
  player.resources.SILVER = 100;
  player.resources.MATERIALS = 10;

  assert.equal(gameState.performFinancialAction(player.socketId, {
    type: 'BUY_MATERIALS',
    quantity: 2
  }).ok, true);
  assert.equal(player.resources.SILVER, 94);
  assert.equal(player.resources.MATERIALS, 12);
  assert.equal(gameState.bankFund.SILVER, 6);

  assert.equal(gameState.performFinancialAction(player.socketId, {
    type: 'SELL_MATERIALS',
    quantity: 3
  }).ok, true);
  assert.equal(player.resources.SILVER, 97);
  assert.equal(player.resources.MATERIALS, 9);
  assert.equal(gameState.bankFund.MATERIALS, 3);
});

test('direct transfers charge the 20 percent tariff and TLC transfers are exempt', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  player.resources.SILVER = 20;
  recipient.resources.SILVER = 0;

  const taxed = gameState.performFinancialAction(player.socketId, {
    type: 'TRANSFER_RESOURCE',
    recipientId: recipient.id,
    resource: 'SILVER',
    amount: 10
  });
  assert.equal(taxed.ok, true);
  assert.equal(player.resources.SILVER, 10);
  assert.equal(recipient.resources.SILVER, 8);
  assert.equal(gameState.bankFund.SILVER, 2);

  gameState.freeTradeTreaties.push({
    playerIds: [player.id, recipient.id].sort(),
    expiresAfterRound: 5
  });
  const exempt = gameState.performFinancialAction(player.socketId, {
    type: 'TRANSFER_RESOURCE',
    recipientId: recipient.id,
    resource: 'SILVER',
    amount: 5
  });
  assert.equal(exempt.ok, true);
  assert.equal(player.resources.SILVER, 5);
  assert.equal(recipient.resources.SILVER, 13);
  assert.equal(gameState.bankFund.SILVER, 2);

  gameState.registerMilitaryConflict(player, recipient.id);
  const afterWar = gameState.performFinancialAction(player.socketId, {
    type: 'TRANSFER_RESOURCE',
    recipientId: recipient.id,
    resource: 'MATERIALS',
    amount: 5
  });
  assert.equal(afterWar.ok, true);
  assert.equal(recipient.resources.MATERIALS, 14);
  assert.equal(gameState.bankFund.MATERIALS, 1);
  assert.equal(gameState.freeTradeTreaties.length, 0);
});

test('direct transfers round the tariff upward and financial actions pause during the OI meeting', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  player.resources.SILVER = 10;
  recipient.resources.SILVER = 0;

  const transfer = gameState.performFinancialAction(player.socketId, {
    type: 'TRANSFER_RESOURCE',
    recipientId: recipient.id,
    resource: 'SILVER',
    amount: 1
  });

  assert.equal(transfer.ok, true);
  assert.equal(player.resources.SILVER, 9);
  assert.equal(recipient.resources.SILVER, 0);
  assert.equal(gameState.worldBankFund.SILVER, 1);

  gameState.currentPhase = 6;
  const rejected = gameState.performFinancialAction(player.socketId, {
    type: 'BUY_MATERIALS',
    quantity: 1
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /reunión de la OI/);
});

test('players can donate 15 silver to gain one influence from the World Bank', () => {
  const { gameState, player } = createHumanGame();
  player.resources.SILVER = 20;
  player.resources.INFLUENCE = 4;

  const result = gameState.performFinancialAction(player.socketId, {
    type: 'DONATE_TO_WORLD_BANK'
  });

  assert.equal(result.ok, true);
  assert.equal(player.resources.SILVER, 5);
  assert.equal(player.resources.INFLUENCE, 5);
  assert.equal(gameState.worldBankFund.SILVER, 15);
});

test('donation to the World Bank requires 15 silver', () => {
  const { gameState, player } = createHumanGame();
  player.resources.SILVER = 14;

  const result = gameState.performFinancialAction(player.socketId, {
    type: 'DONATE_TO_WORLD_BANK'
  });

  assert.equal(result.ok, false);
  assert.equal(player.resources.INFLUENCE, 20);
  assert.equal(gameState.worldBankFund.SILVER, 0);
});

test('bonds default at maturity, lose influence, accrue one interest per round, and accept partial payment', () => {
  const { gameState, player } = createHumanGame();
  player.resources.SILVER = 100;
  const issued = gameState.performFinancialAction(player.socketId, { type: 'ISSUE_BOND' });
  assert.equal(issued.ok, true);
  assert.equal(player.resources.SILVER, 120);
  assert.equal(gameState.bonds[0].dueRound, 6);

  player.resources.SILVER = 24;
  gameState.processBondsAtRoundStart(6);
  assert.equal(gameState.bonds[0].defaulted, true);
  assert.equal(gameState.bonds[0].balance, 25);
  assert.equal(player.resources.INFLUENCE, 15);

  gameState.processBondsAtRoundStart(7);
  gameState.processBondsAtRoundStart(7);
  assert.equal(gameState.bonds[0].balance, 26);
  const repayment = gameState.performFinancialAction(player.socketId, {
    type: 'REPAY_BOND',
    bondId: gameState.bonds[0].id,
    amount: 10
  });
  assert.equal(repayment.ok, true);
  assert.equal(player.resources.SILVER, 14);
  assert.equal(gameState.bonds[0].balance, 16);
  assert.equal(gameState.bankFund.SILVER, 10);
  gameState.processBondsAtRoundStart(8);
  assert.equal(gameState.bonds[0].balance, 17);
});

test('a bond is automatically repaid when the player can cover its maturity balance', () => {
  const { gameState, player } = createHumanGame();
  gameState.performFinancialAction(player.socketId, { type: 'ISSUE_BOND' });
  player.resources.SILVER = 25;

  gameState.processBondsAtRoundStart(6);

  assert.equal(gameState.bonds[0].paid, true);
  assert.equal(gameState.bonds[0].balance, 0);
  assert.equal(player.resources.SILVER, 0);
  assert.equal(gameState.bankFund.SILVER, 25);
  assert.equal(player.resources.INFLUENCE, 20);
});

test('a player cannot issue a second bond while the first one is pending', () => {
  const { gameState, player } = createHumanGame();
  assert.equal(gameState.performFinancialAction(player.socketId, { type: 'ISSUE_BOND' }).ok, true);
  const rejected = gameState.performFinancialAction(player.socketId, { type: 'ISSUE_BOND' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /bono pendiente/);
});

test('a recent conflict disables new TLC proposals', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  gameState.conflicts.push({
    attackerId: player.id,
    defenderId: recipient.id,
    round: gameState.currentRound - 1
  });

  const proposal = gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'FREE_TRADE'
  });
  assert.equal(proposal.ok, false);
  assert.equal(gameState.isPlayersAtWar(player.id, recipient.id), true);

  gameState.currentRound += 3;
  assert.equal(gameState.isPlayersAtWar(player.id, recipient.id), false);
});

test('troops occupying another country’s territory block new TLC proposals', () => {
  const { gameState, player } = createHumanGame();
  const recipient = gameState.players.get('nation-1');
  const tile = gameState.grid.flat().find((entry) => entry.ownerId === recipient.id);
  tile.visitingTroops = { [player.id]: 1 };

  const proposal = gameState.proposeTreaty(player.socketId, {
    recipientId: recipient.id,
    type: 'FREE_TRADE'
  });

  assert.equal(proposal.ok, false);
  assert.equal(gameState.getState().activeConflicts.length, 1);
  assert.equal(gameState.getState().activeConflicts[0].occupied, true);
});

test('bots accept non-aggression pacts only when an adjacent country is stronger', () => {
  const { gameState, player: proposer } = createHumanGame();
  const bot = gameState.players.get('nation-1');
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId === bot.id || tile.ownerId === proposer.id) tile.troops = 0;
  }
  const botTile = gameState.grid[10][10];
  const proposerTile = gameState.grid[10][11];
  botTile.ownerId = bot.id;
  botTile.troops = 1;
  proposerTile.ownerId = proposer.id;
  proposerTile.troops = 3;

  const response = gameState.proposeTreaty(proposer.socketId, {
    recipientId: bot.id,
    type: 'NON_AGGRESSION_PACT'
  });

  assert.equal(response.ok, true);
  assert.equal(response.accepted, true);
  assert.equal(OI.arePlayersBoundByPact(gameState, bot.id, proposer.id), true);

  const rejection = gameState.proposeTreaty(proposer.socketId, {
    recipientId: bot.id,
    type: 'FREE_TRADE'
  });
  assert.equal(rejection.ok, true);
  assert.equal(rejection.accepted, false);
});

test('a solo player can pause and resume the phase clock while the other countries are bots', () => {
  const room = new Room('pause-test', () => {});
  room.gameState.gameStarted = true;
  room.gameState.currentPhase = 2;
  const player = room.gameState.players.get('nation-0');
  player.socketId = 'human-socket';
  player.isBot = false;
  room.phaseManager.running = true;
  room.phaseManager.secondsRemaining = 37;
  room.gameState.timeRemaining = 37;
  room.phaseManager.startDecisionTimer();

  assert.equal(room.setPaused(player.socketId, true).paused, true);
  assert.equal(room.phaseManager.timer, null);
  assert.equal(room.gameState.timeRemaining, 37);
  assert.equal(room.setPaused(player.socketId, false).paused, false);
  assert.notEqual(room.phaseManager.timer, null);
  room.phaseManager.stop();
});

test('a room with multiple human players cannot be paused from the menu', () => {
  const room = new Room('multiplayer-pause-test', () => {});
  room.gameState.gameStarted = true;
  room.phaseManager.running = true;
  room.gameState.players.get('nation-0').socketId = 'human-one';
  room.gameState.players.get('nation-0').isBot = false;
  room.gameState.players.get('nation-1').socketId = 'human-two';
  room.gameState.players.get('nation-1').isBot = false;

  const result = room.setPaused('human-one', true);

  assert.equal(result.eligible, false);
  assert.equal(room.gameState.isPaused, false);
  room.phaseManager.stop();
});

test('a pause preserves the closing animation transition', () => {
  const { gameState } = createHumanGame();
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;
  phaseManager.transitionToPhase(4);

  assert.notEqual(phaseManager.transitionTimer, null);
  phaseManager.setPaused(true);
  assert.equal(phaseManager.transitionTimer, null);
  assert.equal(phaseManager.pausedTransition.phase, 5);
  assert.ok(phaseManager.pausedTransition.remaining <= 2600);
  assert.ok(phaseManager.pausedTransition.remaining >= 2590);
  phaseManager.setPaused(false);
  assert.notEqual(phaseManager.transitionTimer, null);
  phaseManager.stop();
});

test('the international meeting runs before advancing round five and ends after all humans vote', () => {
  const { gameState, player } = createHumanGame();
  gameState.currentRound = 5;
  gameState.currentPhase = 4;
  gameState.oiProposals = [{
    id: 'armament',
    type: OI_RESOLUTIONS.ARMAMENT_LIMIT,
    name: 'Armament limit',
    sequence: 1
  }];
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;
  let scheduledPhase;
  phaseManager.schedulePhase = (phase, delay) => {
    scheduledPhase = { phase, delay };
  };

  phaseManager.transitionToPhase(4);
  assert.deepEqual(scheduledPhase, { phase: 6, delay: 2600 });
  assert.equal(gameState.oiSession, null);
  assert.equal(gameState.currentRound, 5);

  phaseManager.transitionToPhase(6);
  assert.equal(gameState.oiSession.phase, 'voting');
  assert.equal(gameState.oiSession.meetingAfterRound, 5);
  assert.equal(gameState.oiSession.timeRemaining, 60);
  assert.equal(Object.keys(gameState.oiSession.votes).length, 3);
  assert.ok(Object.values(gameState.oiSession.votes).every(
    (ballot) => ballot[0].choice === 'ABSTAIN'
  ));

  OI.submitVote(gameState, player.socketId, [{
    proposalId: 'armament',
    choice: 'ABSTAIN',
    wager: 0
  }]);
  assert.equal(OI.haveAllPlayersVoted(gameState), true);
  assert.equal(phaseManager.checkOIVotes(), true);
  assert.equal(gameState.oiSession.phase, 'complete');
  assert.deepEqual(scheduledPhase, { phase: 5, delay: 0 });

  phaseManager.transitionToPhase(5);
  assert.equal(gameState.currentRound, 6);
  assert.equal(
    gameState.eventHistory.at(-1).message,
    'Comienza la ronda 6.'
  );
  assert.deepEqual(scheduledPhase, { phase: 1, delay: 0 });
  phaseManager.stop();
});

test('an all-bot meeting closes immediately after recording bot abstentions', () => {
  const gameState = new GameState();
  gameState.currentRound = 5;
  gameState.oiProposals = [{
    id: 'neutral',
    type: OI_RESOLUTIONS.INDUSTRY_LIMIT,
    name: 'Industry limit',
    sequence: 1
  }];
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;
  let scheduledPhase;
  phaseManager.schedulePhase = (phase, delay) => {
    scheduledPhase = { phase, delay };
  };

  phaseManager.transitionToPhase(6);

  assert.equal(gameState.oiSession.phase, 'complete');
  assert.ok(Object.values(gameState.oiSession.votes).every(
    (ballot) => ballot[0].choice === 'ABSTAIN'
  ));
  assert.deepEqual(scheduledPhase, { phase: 5, delay: 0 });
  phaseManager.stop();
});

test('no international meeting is scheduled after a non-fifth round', () => {
  const { gameState } = createHumanGame();
  gameState.currentRound = 4;
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;
  let scheduledPhase;
  phaseManager.schedulePhase = (phase, delay) => {
    scheduledPhase = { phase, delay };
  };

  phaseManager.transitionToPhase(4);

  assert.deepEqual(scheduledPhase, { phase: 5, delay: 2600 });
  assert.equal(gameState.currentRound, 4);
  assert.equal(gameState.oiSession, null);
  assert.equal(gameState.eventHistory.length, 0);

  phaseManager.transitionToPhase(5);
  assert.deepEqual(scheduledPhase, { phase: 1, delay: 0 });
  assert.equal(gameState.currentRound, 5);
  assert.equal(gameState.eventHistory.at(-1).message, 'Comienza la ronda 5.');
  assert.equal(
    gameState.eventHistory
      .slice(0, -1)
      .filter((event) => event.message.includes('obtuvo 2 de Influencia Política'))
      .length,
    4
  );
  assert.equal(gameState.oiSession, null);
  phaseManager.stop();
});

test('the game ends after round thirty without advancing the displayed round', () => {
  const { gameState } = createHumanGame();
  gameState.currentRound = MAX_ROUNDS;
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;

  phaseManager.transitionToPhase(5);

  assert.equal(gameState.gameOver, true);
  assert.equal(gameState.getState().gameOver, true);
  assert.equal(gameState.currentRound, MAX_ROUNDS);
  assert.equal(phaseManager.running, false);
  assert.equal(phaseManager.transitionTimer, null);
  assert.equal(gameState.eventHistory.at(-1).message, `La partida terminó en la ronda ${MAX_ROUNDS}.`);
});

test('restarting a finished room preserves connected human players and starts a fresh game', () => {
  const room = new Room('restart-test', () => {});
  const player = room.gameState.players.get('nation-0');
  player.socketId = 'human-socket';
  player.boundPlayerId = 'human-player';
  player.isBot = false;
  player.name = 'Jugador';
  room.gameState.gameStarted = true;
  room.gameState.gameOver = true;
  room.gameState.currentRound = MAX_ROUNDS;

  const state = room.restart();

  assert.equal(state.gameStarted, true);
  assert.equal(state.gameOver, false);
  assert.equal(state.currentRound, 1);
  const restartedPlayer = state.players.find((entry) => entry.id === player.id);
  assert.equal(restartedPlayer.socketId, 'human-socket');
  assert.equal(restartedPlayer.boundPlayerId, 'human-player');
  assert.equal(restartedPlayer.name, 'Jugador');
  room.phaseManager.stop();
});

test('bots plan troop movements that claim adjacent neutral land', () => {
  const { gameState } = createHumanGame();
  const bot = gameState.players.get('nation-1');
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === bot.id && tile.x < gameState.gridWidth - 1
  ));
  assert.ok(source);
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId === bot.id) tile.troops = 0;
  }
  source.troops = 4;
  const target = gameState.grid[source.y][source.x + 1];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const neighbor = gameState.grid[source.y + dy]?.[source.x + dx];
    if (neighbor) neighbor.ownerId = bot.id;
  }
  target.ownerId = null;
  target.nationId = null;
  target.type = TERRAIN_TYPES.TR;
  target.building = null;
  target.troops = 0;

  gameState.runBotDecisions();
  const movement = bot.plannedActions.find((action) => action?.type === 'MOVE_TROOPS');

  assert.deepEqual(
    [movement.x, movement.y, movement.targetX, movement.targetY, movement.troops],
    [source.x, source.y, target.x, target.y, 2]
  );
  gameState.resolvePlannedActions();
  assert.equal(target.ownerId, bot.id);
  assert.equal(target.troops, 2);
});

test('bots fill all three action slots with beneficial actions and are ready for planning', () => {
  const { gameState, player } = createHumanGame();

  gameState.runBotDecisions();

  assert.equal(player.phaseReady, false);
  for (const bot of gameState.players.values()) {
    if (!bot.isBot) continue;
    assert.equal(bot.phaseReady, true);
    assert.ok(bot.plannedActions.every((action) => action !== null));
  }
});

test('bots build cities when military and factory actions are unavailable', () => {
  const { gameState } = createHumanGame();
  const bot = gameState.players.get('nation-1');
  const buildTiles = gameState.grid.flat().filter((tile) => tile.ownerId === bot.id).slice(0, 3);
  assert.equal(buildTiles.length, 3);

  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId !== bot.id) continue;
    tile.type = TERRAIN_TYPES.CIU;
    tile.building = 'CITY';
    tile.troops = 0;
  }
  buildTiles.forEach((tile) => {
    tile.type = TERRAIN_TYPES.TR;
    tile.building = null;
  });
  bot.resources.SILVER = 150;
  bot.resources.MATERIALS = 0;
  gameState.oiPolicies.industryLimit = OI.countFactories(gameState, bot.id);

  gameState.runBotDecisions();

  assert.ok(bot.plannedActions.every((action) => action?.type === 'BUILD_CITY'));
  assert.deepEqual(
    bot.plannedActions.map(({ x, y }) => [x, y]),
    buildTiles.map(({ x, y }) => [x, y])
  );
});

test('bots attack a weaker enemy when no neutral land can be claimed', () => {
  const { gameState } = createHumanGame();
  const bot = gameState.players.get('nation-1');
  for (const tile of gameState.grid.flat()) {
    if (tile.ownerId == null || tile.ownerId !== bot.id) {
      tile.ownerId = bot.id;
      tile.nationId = bot.nationId;
    }
    tile.troops = 0;
  }

  const source = gameState.grid[10][10];
  const target = gameState.grid[10][11];
  source.ownerId = bot.id;
  source.nationId = bot.nationId;
  source.type = TERRAIN_TYPES.TR;
  source.troops = 4;
  target.ownerId = 'nation-0';
  target.nationId = 0;
  target.type = TERRAIN_TYPES.TR;
  target.troops = 1;
  bot.resources.SILVER = 0;
  bot.resources.MATERIALS = 0;

  gameState.runBotDecisions();

  const attack = bot.plannedActions.find((action) => (
    action?.type === 'MOVE_TROOPS' && action.targetX === target.x && action.targetY === target.y
  ));
  assert.ok(attack);
  assert.equal(attack.troops, 2);
  assert.equal(gameState.validatePlannedAction(bot, attack, bot.plannedActions.indexOf(attack)).ok, true);
});

test('bots leave unavailable slots empty and legacy hold orders do not appear in the log', () => {
  const { gameState } = createHumanGame();
  for (const bot of gameState.players.values()) {
    if (!bot.isBot) continue;
    bot.resources.SILVER = 0;
    bot.resources.MATERIALS = 0;
    for (const tile of gameState.grid.flat()) {
      if (tile.ownerId === bot.id) tile.troops = 0;
    }
  }

  gameState.runBotDecisions();

  for (const bot of gameState.players.values()) {
    if (!bot.isBot) continue;
    assert.ok(bot.plannedActions.every((action) => action === null));
  }

  const bot = gameState.players.get('nation-1');
  const tile = gameState.grid.flat().find((entry) => entry.ownerId === bot.id);
  bot.plannedActions[0] = { type: 'HOLD_POSITION', x: tile.x, y: tile.y };
  gameState.resolvePlannedActions();
  assert.equal(gameState.eventHistory.length, 0);
});

test('players can plan a third action but not a fourth', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.troops > 0 && tile.x < gameState.gridWidth - 1
  ));
  const destination = gameState.grid[source.y][source.x + 1];
  source.troops = 2;
  destination.type = TERRAIN_TYPES.TR;
  destination.ownerId = null;
  destination.troops = 0;
  const action = {
    type: 'MOVE_TROOPS',
    x: source.x,
    y: source.y,
    targetX: destination.x,
    targetY: destination.y,
    troops: 1
  };

  const thirdAction = gameState.performPlayerAction(player.socketId, {
    type: 'PLAN_ACTION',
    slot: 2,
    plannedAction: action
  });
  const fourthSlot = gameState.performPlayerAction(player.socketId, {
    type: 'PLAN_ACTION',
    slot: 3,
    plannedAction: action
  });

  assert.equal(thirdAction.ok, true);
  assert.deepEqual(player.plannedActions, [null, null, action]);
  assert.equal(fourthSlot.ok, false);
});

test('game event history is retained in the public state without truncation', () => {
  const { gameState } = createHumanGame();
  for (let index = 0; index < 24; index += 1) {
    gameState.recordEvent(`Evento ${index + 1}`);
  }

  const history = gameState.getState().eventHistory;

  assert.equal(history.length, 24);
  assert.deepEqual(history.map((event) => event.id), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(history[0].message, 'Evento 1');
  assert.equal(history[23].message, 'Evento 24');
});

test('planning an action does not add it to the performed event history', () => {
  const { gameState, player } = createHumanGame();
  const tile = gameState.grid.flat().find((entry) => entry.ownerId === player.id);
  tile.troops = 1;
  const destination = gameState.grid[tile.y][tile.x + 1];
  destination.type = TERRAIN_TYPES.TR;
  destination.ownerId = null;

  const result = gameState.performPlayerAction(player.socketId, {
    type: 'PLAN_ACTION',
    slot: 0,
    plannedAction: {
      type: 'MOVE_TROOPS',
      x: tile.x,
      y: tile.y,
      targetX: destination.x,
      targetY: tile.y,
      troops: 1
    }
  });

  assert.equal(result.ok, true);
  assert.equal(gameState.eventHistory.length, 0);
});

test('resolved action logs show only the country and action', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1
  ));
  const destination = gameState.grid[source.y][source.x + 1];
  source.troops = 2;
  destination.type = TERRAIN_TYPES.TR;
  destination.ownerId = null;
  destination.troops = 0;
  const planned = gameState.performPlayerAction(player.socketId, {
    type: 'PLAN_ACTION',
    slot: 0,
    plannedAction: {
      type: 'MOVE_TROOPS',
      x: source.x,
      y: source.y,
      targetX: destination.x,
      targetY: destination.y,
      troops: 1
    }
  });
  assert.equal(planned.ok, true);

  gameState.resolvePlannedActions();

  assert.deepEqual(gameState.eventHistory.map((event) => event.message), [
    `${player.name}: Mover tropas desde (${source.x}, ${source.y}) hasta (${destination.x}, ${destination.y}).`
  ]);
});

test('a stronger attack captures enemy territory and preserves the defeated garrison as visitors', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1 && tile.troops > 0
  ));
  source.troops = 4;
  const destination = gameState.grid[source.y][source.x + 1];
  destination.ownerId = 'nation-1';
  destination.nationId = 1;
  destination.type = TERRAIN_TYPES.CIU;
  destination.troops = 2;

  const attack = {
    type: 'MOVE_TROOPS',
    x: source.x,
    y: source.y,
    targetX: destination.x,
    targetY: destination.y,
    troops: 4
  };
  assert.equal(gameState.validatePlannedAction(player, attack, 0).ok, true);
  const result = gameState.resolveTroopMovement(player, attack);
  assert.equal(result.combat.winnerId, player.id);
  assert.equal(result.combat.defenderSurvivors, 1);
  assert.equal(destination.ownerId, player.id);
  assert.equal(destination.troops, 5);
  assert.equal(destination.visitingTroops['nation-1'], 1);

  const withdraw = {
    type: 'MOVE_TROOPS',
    x: destination.x, y: destination.y,
    targetX: source.x, targetY: source.y,
    troops: 4
  };
  assert.equal(gameState.validatePlannedAction(player, withdraw, 0).ok, true);
  assert.equal(gameState.resolveTroopMovement(player, withdraw).ok, true);
  assert.equal(destination.ownerId, player.id);
  assert.equal(destination.troops, 1);
  assert.equal(destination.visitingTroops['nation-1'], 1);
});

test('troop movement accepts every land terrain and rejects water', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1 && tile.troops > 0
  ));
  source.troops = 5;
  const destination = gameState.grid[source.y][source.x + 1];
  destination.ownerId = null;
  destination.nationId = null;
  destination.building = null;
  destination.troops = 0;

  for (const type of [
    TERRAIN_TYPES.TR,
    TERRAIN_TYPES.MPT,
    TERRAIN_TYPES.FT,
    TERRAIN_TYPES.CIU,
    TERRAIN_TYPES.CAP
  ]) {
    destination.type = type;
    const action = {
      type: 'MOVE_TROOPS',
      x: source.x,
      y: source.y,
      targetX: destination.x,
      targetY: destination.y,
      troops: 1
    };
    assert.equal(gameState.validatePlannedAction(player, action, 0).ok, true, type);
  }

  destination.ownerId = 'nation-1';
  destination.nationId = 1;
  destination.troops = 1;
  for (const type of [
    TERRAIN_TYPES.TR,
    TERRAIN_TYPES.MPT,
    TERRAIN_TYPES.FT,
    TERRAIN_TYPES.CIU,
    TERRAIN_TYPES.CAP
  ]) {
    destination.type = type;
    const attack = {
      type: 'MOVE_TROOPS',
      x: source.x,
      y: source.y,
      targetX: destination.x,
      targetY: destination.y,
      troops: 2
    };
    assert.equal(gameState.validatePlannedAction(player, attack, 0).ok, true, `enemy ${type}`);
  }

  destination.type = TERRAIN_TYPES.AG;
  destination.ownerId = null;
  destination.nationId = null;
  destination.troops = 0;
  assert.equal(gameState.validatePlannedAction(player, {
    type: 'MOVE_TROOPS',
    x: source.x,
    y: source.y,
    targetX: destination.x,
    targetY: destination.y,
    troops: 1
  }, 0).ok, false);
});

test('a tie favors the defender and the attacking force loses half its troops', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1 && tile.troops > 0
  ));
  source.troops = 4;
  const destination = gameState.grid[source.y][source.x + 1];
  destination.ownerId = 'nation-1';
  destination.nationId = 1;
  destination.type = TERRAIN_TYPES.TR;
  destination.troops = 3;
  const attack = {
    type: 'MOVE_TROOPS',
    x: source.x, y: source.y,
    targetX: destination.x, targetY: destination.y,
    troops: 3
  };

  const result = gameState.resolveTroopMovement(player, attack);

  assert.equal(result.combat.winnerId, 'nation-1');
  assert.equal(result.combat.attackerSurvivors, 1);
  assert.equal(source.troops, 2);
  assert.equal(destination.ownerId, 'nation-1');
  assert.equal(destination.troops, 3);
});

test('attacking a PNA signatory breaks the pact and applies the influence penalty', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1 && tile.troops > 0
  ));
  const destination = gameState.grid[source.y][source.x + 1];
  destination.ownerId = 'nation-1';
  destination.nationId = 1;
  destination.type = TERRAIN_TYPES.TR;
  gameState.nonAggressionPacts.push({
    playerIds: [player.id, 'nation-1'].sort(),
    expiresAfterRound: 5
  });
  gameState.nonAggressionPacts.push({
    playerIds: [player.id, 'nation-1'].sort(),
    expiresAfterRound: 7
  });
  const attack = {
    type: 'MOVE_TROOPS',
    x: source.x, y: source.y,
    targetX: destination.x, targetY: destination.y,
    troops: 1
  };

  player.resources.INFLUENCE = 6;
  const validation = gameState.validatePlannedAction(player, attack, 0);
  assert.equal(validation.ok, true);

  const result = gameState.resolveTroopMovement(player, attack);
  assert.equal(result.ok, true);
  assert.equal(result.combat.defenderId, 'nation-1');
  assert.equal(player.resources.INFLUENCE, 0);
  assert.equal(gameState.nonAggressionPacts.length, 0);
  assert.match(gameState.eventHistory.at(-1).message, /traicionó el Pacto de No Agresión/);
});

test('moving into a TLC signatory’s territory breaks the treaty and records the conflict', () => {
  const { gameState, player } = createHumanGame();
  const source = gameState.grid.flat().find((tile) => (
    tile.ownerId === player.id && tile.x < gameState.gridWidth - 1 && tile.troops > 0
  ));
  const destination = gameState.grid[source.y][source.x + 1];
  const defender = gameState.players.get('nation-1');
  destination.ownerId = defender.id;
  destination.nationId = defender.nationId;
  destination.type = TERRAIN_TYPES.TR;
  destination.troops = 0;
  gameState.freeTradeTreaties.push({
    playerIds: [player.id, defender.id].sort(),
    expiresAfterRound: 5
  });

  const result = gameState.resolveTroopMovement(player, {
    type: 'MOVE_TROOPS',
    x: source.x,
    y: source.y,
    targetX: destination.x,
    targetY: destination.y,
    troops: 1
  });

  assert.equal(result.ok, true);
  assert.equal(gameState.freeTradeTreaties.length, 0);
  assert.equal(gameState.isPlayersAtWar(player.id, defender.id), true);
  assert.ok(gameState.eventHistory.some((event) => /rompió el Tratado de Libre Comercio/.test(event.message)));
});

test('the phase ends as soon as every human is ready because bots are already ready', () => {
  const { gameState, player } = createHumanGame();
  const phaseManager = new PhaseManager(gameState, () => {});
  phaseManager.running = true;

  phaseManager.transitionToPhase(2);
  const ready = gameState.markPlayerReady(player.socketId, true);

  assert.equal(ready.requiredCount, 4);
  assert.equal(ready.readyCount, 4);
  assert.equal(ready.allReady, true);
  assert.equal(phaseManager.checkDecisionReadiness(), true);
  assert.equal(gameState.currentPhase, 3);
  assert.equal(phaseManager.timer, null);
  phaseManager.stop();
});

test('a disconnected human is replaced by a ready bot during planning', () => {
  const { gameState, player } = createHumanGame();
  gameState.runBotDecisions();

  assert.equal(gameState.removePlayer(player.socketId), true);
  gameState.runBotDecisions({ resetReadiness: false });

  assert.equal(player.isBot, true);
  assert.equal(player.phaseReady, true);
  assert.equal(gameState.allPlayersReady(), true);
});
