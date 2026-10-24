import test from 'node:test';
import assert from 'node:assert/strict';
import { OI_RESOLUTIONS } from '../../shared/Constants.js';
import { GameState } from '../src/game/GameState.js';
import { InternationalOrganizationEngine as OI } from '../src/game/InternationalOrganizationEngine.js';
import { PhaseManager } from '../src/game/PhaseManager.js';

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
  gameState.currentRound = 6;
  gameState.aggressions = [{ attackerId: player.id }];
  gameState.casusBelli = [{ holderId: player.id }];
  gameState.activeDmzZones = [
    { x: 1, y: 1, expiresAfterRound: 5 },
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
  beneficiary.gdiPoints = 10;
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

test('the international meeting runs as a 60-second extra round after round five', () => {
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
  assert.equal(gameState.oiSession, null);
  phaseManager.transitionToPhase(5);
  assert.deepEqual(scheduledPhase, { phase: 6, delay: 3000 });
  assert.equal(gameState.currentRound, 6);

  phaseManager.transitionToPhase(6);
  assert.equal(gameState.oiSession.phase, 'voting');
  assert.equal(gameState.oiSession.meetingAfterRound, 5);
  assert.equal(gameState.oiSession.timeRemaining, 60);

  OI.submitVote(gameState, player.socketId, [{
    proposalId: 'armament',
    choice: 'ABSTAIN',
    wager: 0
  }]);
  assert.equal(OI.haveAllPlayersVoted(gameState), true);
  assert.equal(gameState.oiSession.phase, 'voting');
  assert.equal(gameState.oiSession.timeRemaining, 60);
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

  phaseManager.transitionToPhase(5);

  assert.deepEqual(scheduledPhase, { phase: 1, delay: 3000 });
  assert.equal(gameState.currentRound, 5);
  assert.equal(gameState.oiSession, null);
  phaseManager.stop();
});

test('bots plan beneficial actions and are ready when a planning phase begins', () => {
  const { gameState, player } = createHumanGame();

  gameState.runBotDecisions();

  assert.equal(player.phaseReady, false);
  for (const bot of gameState.players.values()) {
    if (!bot.isBot) continue;
    assert.equal(bot.phaseReady, true);
    assert.ok(bot.plannedActions.some((action) => action !== null));
  }
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
