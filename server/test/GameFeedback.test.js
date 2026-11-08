import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { InternationalOrganizationEngine as OI } from '../src/game/InternationalOrganizationEngine.js';
import { OI_RESOLUTIONS } from '../../shared/Constants.js';
import { EventLog } from '../../client/src/ui/components/EventLog.js';

function fixture() {
  const state = new GameState({ mapSeed: 'feedback', maxRounds: 5 });
  state.gameStarted = true;
  state.currentPhase = 2;
  const [human, bot] = [...state.players.values()];
  human.isBot = false;
  human.socketId = 'human';
  for (const player of state.players.values()) player.resources = { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 };
  return { state, human, bot };
}

test('neutral bot trades charge silver only and complete exactly once', () => {
  const { state, human, bot } = fixture();
  const result = state.performFinancialAction(human.socketId, {
    type: 'PROPOSE_TRADE', recipientId: bot.id,
    offerResource: 'SILVER', offerAmount: 10, requestResource: 'MATERIALS', requestAmount: 5
  });
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  assert.equal(human.resources.SILVER, 90);
  assert.equal(human.resources.MATERIALS, 105);
  assert.equal(bot.resources.SILVER, 105);
  assert.equal(bot.resources.MATERIALS, 95);
  assert.deepEqual(state.bankFund, { SILVER: 5, MATERIALS: 0 });
  assert.equal(state.tradeOffers.length, 0);
  const tradeProposal = state.eventHistory.find((event) => event.category === 'trade-offer');
  assert.equal(tradeProposal.recipientId, bot.id);
  assert.ok(state.eventHistory.some((event) => event.message.includes(`${bot.name} aceptó el intercambio`)));
});

test('invalid trade ratios are rejected without charging either country', () => {
  const { state, human, bot } = fixture();
  const before = structuredClone([human.resources, bot.resources, state.bankFund]);
  const result = state.performFinancialAction(human.socketId, {
    type: 'PROPOSE_TRADE', recipientId: bot.id,
    offerResource: 'SILVER', offerAmount: 5, requestResource: 'MATERIALS', requestAmount: 10
  });
  assert.equal(result.ok, false);
  assert.deepEqual([human.resources, bot.resources, state.bankFund], before);
  assert.equal(state.tradeOffers.length, 0);
  assert.match(result.message, /2 de Plata por 1 Material/);
});

test('bot trades respect free-trade exemptions and human proposals remain pending', () => {
  const { state, human, bot } = fixture();
  state.freeTradeTreaties.push({ playerIds: [human.id, bot.id], expiresAfterRound: 5 });
  const action = { type: 'PROPOSE_TRADE', recipientId: bot.id,
    offerResource: 'MATERIALS', offerAmount: 10, requestResource: 'SILVER', requestAmount: 10 };
  assert.equal(state.performFinancialAction(human.socketId, action).accepted, true);
  assert.deepEqual(state.bankFund, { SILVER: 0, MATERIALS: 0 });
  bot.isBot = false;
  assert.equal(state.performFinancialAction(human.socketId, action).ok, true);
  assert.equal(state.tradeOffers.length, 1);
  const pendingProposal = state.eventHistory.find((event) => event.category === 'trade-offer');
  assert.equal(pendingProposal.recipientId, bot.id);
  assert.equal(pendingProposal.proposerId, human.id);
});

test('subsidy voting names its beneficiary and payment honors that country after GDI changes', () => {
  const { state, human, bot } = fixture();
  for (const tile of state.grid.flat()) tile.population = 0;
  bot.resources = { SILVER: 0, MATERIALS: 0, INFLUENCE: 0 };
  assert.equal(OI.propose(state, human.socketId, { type: OI_RESOLUTIONS.CONDITIONAL_SUBSIDY }).ok, true);
  const session = OI.startSession(state);
  const proposal = session.proposals[0];
  assert.equal(proposal.beneficiaryId, bot.id);
  assert.ok(proposal.name.includes(bot.name));
  assert.ok(state.getState().oiSession.proposals[0].name.includes(bot.name));
  bot.resources.SILVER = 5000;
  session.votes = { [human.id]: [{ proposalId: proposal.id, choice: 'FOR', wager: 1 }] };
  OI.finishSession(state);
  assert.equal(bot.resources.SILVER, 5025);
  assert.ok(session.results[0].name.includes(bot.name));
  assert.ok(state.eventHistory.some((event) => event.message.includes(`${bot.name} recibió un Subsidio Condicionado de 25`)));
});

test('bot treaty breaches survive action resolution, state serialization and log rendering', () => {
  const { state, human, bot } = fixture();
  const source = state.grid[10][10];
  const target = state.grid[10][11];
  Object.assign(source, { ownerId: bot.id, type: 'TR', troops: 5 });
  Object.assign(target, { ownerId: human.id, type: 'TR', troops: 1 });
  state.nonAggressionPacts.push({ playerIds: [human.id, bot.id], expiresAfterRound: 5 });
  state.freeTradeTreaties.push({ playerIds: [human.id, bot.id], expiresAfterRound: 5 });
  bot.plannedActions = [{ type: 'MOVE_TROOPS', x: 10, y: 10, targetX: 11, targetY: 10, troops: 3 }];
  state.resolvePlannedActions();
  const history = state.getState().eventHistory;
  const breaches = history.filter((event) => event.category === 'treaty-breach');
  assert.equal(breaches.length, 2);
  assert.ok(breaches.every((event) => event.attackerId === bot.id && event.defenderId === human.id));
  assert.ok(history.some((event) => event.message.includes('Mover tropas (3 tropas)')));
  const element = { addEventListener() {}, innerHTML: '', scrollTop: 0 };
  new EventLog(element).render(history, [...state.players.values()]);
  assert.match(element.innerHTML, /Tratado incumplido/);
  assert.match(element.innerHTML, /traicionó el Pacto/);
  assert.match(element.innerHTML, /rompió el Tratado de Libre Comercio/);
});

test('local log notifications survive server updates, in chronological order with breach metadata', async () => {
  const { mergeGameEvents } = await import('../../client/src/ui/components/GameEventHistory.js');
  const local = [{ timestamp: 20, message: 'Aviso local' }];
  const breach = { id: 2, timestamp: 30, message: 'Un bot rompió un tratado', category: 'treaty-breach' };
  const history = [{ id: 1, timestamp: 10, message: 'Anterior' }, breach];
  const merged = mergeGameEvents(history, local);
  assert.deepEqual(merged.map((e) => e.message), [breach.message, 'Aviso local', 'Anterior']);
  assert.equal(merged[0].category, 'treaty-breach');
  assert.equal(history[0].id, 1);
  assert.equal(local.length, 1);
  assert.ok(mergeGameEvents([...history, { timestamp: 40, message: 'Siguiente' }], local)
    .some((e) => e.message === 'Aviso local'));
});

test('treaty notifications reach both affected countries, including neutral combat', async () => {
  const { getGameEventNotifications } = await import('../../client/src/ui/components/GameEventHistory.js');
  const history = [
    { id: 1, category: 'treaty-breach', playerIds: ['a', 'b'], attackerId: null },
    { id: 2, category: 'treaty-breach', attackerId: 'a', defenderId: 'b' },
    { id: 3, category: 'treaty-expired', playerIds: ['a', 'b'] },
    { id: 4, category: 'treaty-breach', playerIds: ['c', 'd'] }
  ];
  for (const playerId of ['a', 'b']) {
    assert.deepEqual(getGameEventNotifications(history, playerId).map(event => event.id), [1, 2, 3]);
  }
});
