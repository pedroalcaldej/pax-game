import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { ECONOMY } from '../../shared/Constants.js';
import { Inspector } from '../../client/src/ui/components/Inspector.js';
import { FinancePanel } from '../../client/src/ui/components/FinancePanel.js';

function fixture() {
  const state = new GameState({ mapSeed: 'trade-rules' });
  state.gameStarted = true;
  state.currentPhase = 2;
  const [buyer, seller] = [...state.players.values()];
  buyer.resources = { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 };
  seller.resources = { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 };
  buyer.isBot = false;
  buyer.socketId = 'buyer';
  seller.isBot = false;
  seller.socketId = 'seller';
  return { state, buyer, seller };
}

for (const selling of [false, true]) {
  test(`neutral trades deliver all materials and split silver between seller and bank (selling=${selling})`, () => {
    const { state, buyer, seller } = fixture();
    const proposer = selling ? seller : buyer;
    const recipient = selling ? buyer : seller;
    const before = structuredClone([buyer.resources, seller.resources]);
    const action = { type: 'PROPOSE_TRADE', recipientId: recipient.id,
      offerResource: selling ? 'MATERIALS' : 'SILVER', offerAmount: selling ? 1 : 2,
      requestResource: selling ? 'SILVER' : 'MATERIALS', requestAmount: selling ? 2 : 1 };
    assert.equal(state.performFinancialAction(proposer.socketId, action).ok, true);
    const offerId = state.tradeOffers[0].id;
    assert.equal(state.performFinancialAction(recipient.socketId, { type: 'RESPOND_TO_TRADE', offerId, accepted: true }).ok, true);
    assert.equal(buyer.resources.SILVER, before[0].SILVER - 2);
    assert.equal(buyer.resources.MATERIALS, before[0].MATERIALS + 1);
    assert.equal(seller.resources.SILVER, before[1].SILVER + 1);
    assert.equal(seller.resources.MATERIALS, before[1].MATERIALS - 1);
    assert.deepEqual(state.bankFund, { SILVER: 1, MATERIALS: 0 });
    assert.equal(state.performFinancialAction(recipient.socketId, { type: 'RESPOND_TO_TRADE', offerId, accepted: true }).ok, false);
  });
}

test('TLC requires a 1:1 trade and conflict blocks proposals, pending acceptance and direct transfers', () => {
  const { state, buyer, seller } = fixture();
  const offer = { type: 'PROPOSE_TRADE', recipientId: seller.id,
    offerResource: 'SILVER', offerAmount: 1, requestResource: 'MATERIALS', requestAmount: 1 };
  assert.equal(state.performFinancialAction(buyer.socketId, offer).ok, false);
  state.freeTradeTreaties.push({ playerIds: [buyer.id, seller.id], expiresAfterRound: 5 });
  assert.equal(state.performFinancialAction(buyer.socketId, { ...offer, offerAmount: 2 }).ok, false);
  assert.equal(state.performFinancialAction(buyer.socketId, offer).ok, true);
  const pendingId = state.tradeOffers[0].id;
  const before = structuredClone([buyer.resources, seller.resources, state.bankFund]);
  state.conflicts.push({ attackerId: buyer.id, defenderId: seller.id, round: state.currentRound });
  assert.equal(state.performFinancialAction(buyer.socketId, offer).ok, false);
  assert.equal(state.performFinancialAction(seller.socketId, { type: 'RESPOND_TO_TRADE', offerId: pendingId, accepted: true }).ok, false);
  assert.equal(state.performFinancialAction(buyer.socketId, { type: 'TRANSFER_RESOURCE', recipientId: seller.id, resource: 'SILVER', amount: 10 }).ok, false);
  assert.deepEqual([buyer.resources, seller.resources, state.bankFund], before);
  assert.equal(state.performFinancialAction(seller.socketId, { type: 'RESPOND_TO_TRADE', offerId: pendingId, accepted: false }).ok, true);
});

test('accepting rechecks treaty expiry and both countries balances without partial payments', () => {
  const { state, buyer, seller } = fixture();
  state.freeTradeTreaties.push({ playerIds: [buyer.id, seller.id], expiresAfterRound: 1 });
  assert.equal(state.performFinancialAction(buyer.socketId, { type: 'PROPOSE_TRADE', recipientId: seller.id,
    offerResource: 'SILVER', offerAmount: 1, requestResource: 'MATERIALS', requestAmount: 1 }).ok, true);
  state.currentRound = 2;
  const before = structuredClone([buyer.resources, seller.resources]);
  assert.equal(state.performFinancialAction(seller.socketId, { type: 'RESPOND_TO_TRADE', offerId: state.tradeOffers[0].id, accepted: true }).ok, false);
  assert.deepEqual([buyer.resources, seller.resources], before);
  assert.equal(state.performFinancialAction(buyer.socketId, { type: 'PROPOSE_TRADE', recipientId: seller.id,
    offerResource: 'SILVER', offerAmount: 2, requestResource: 'MATERIALS', requestAmount: 1 }).ok, true);
  seller.resources.MATERIALS = 0;
  assert.equal(state.performFinancialAction(seller.socketId, { type: 'RESPOND_TO_TRADE', offerId: state.tradeOffers[1].id, accepted: true }).ok, false);
  assert.equal(buyer.resources.SILVER, before[0].SILVER);
  assert.deepEqual(state.bankFund, { SILVER: 0, MATERIALS: 0 });
});

test('only owned cities and capitals permit recruitment in planning, execution and bot candidates', () => {
  const { state, buyer } = fixture();
  const tile = state.grid[8][8];
  for (const type of ['TR', 'MPT', 'FT', 'AG', 'MPA', 'FA', 'CIU', 'CAP']) {
    Object.assign(tile, { type, ownerId: buyer.id, troops: 1, building: null });
    buyer.resources = { SILVER: 100, MATERIALS: 100, INFLUENCE: 100 };
    const action = { type: 'RECRUIT_TROOP', x: 8, y: 8, count: 1 };
    const allowed = ['CIU', 'CAP'].includes(type);
    assert.equal(state.validatePlannedAction(buyer, action, 0).ok, allowed, type);
    assert.equal(state.applyPlayerAction(buyer, tile, action.type, action).ok, allowed, type);
    assert.equal(tile.troops, allowed ? 2 : 1);
    assert.equal(buyer.resources.MATERIALS, allowed ? 90 : 100);
  }
  tile.ownerId = [...state.players.keys()][1];
  assert.equal(state.validatePlannedAction(buyer, { type: 'RECRUIT_TROOP', x: 8, y: 8, count: 1 }, 0).ok, false);
  const recruits = state.findBotCandidates(buyer, 0).filter((action) => action.type === 'RECRUIT_TROOP');
  assert.ok(recruits.length);
  assert.ok(recruits.every((action) => ['CIU', 'CAP'].includes(state.grid[action.y][action.x].type)));
});

test('disabled inspector actions show prices while insufficiency remains in tooltips', () => {
  const { state, buyer } = fixture();
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const inspector = new Inspector(container);
  buyer.resources = { SILVER: 0, MATERIALS: 0 };
  inspector.setContext(buyer, 2, () => {}, 0, state.grid);
  inspector.render({ x: 8, y: 8, type: 'TR', ownerId: buyer.id });
  assert.match(container.innerHTML, new RegExp(`<strong>Construir ciudad</strong>\\s*<small>${ECONOMY.COSTS.BUILD_CITY_SILVER} plata · ${ECONOMY.COSTS.BUILD_CITY_MATERIALS} materiales</small>`));
  assert.match(container.innerHTML, /data-tooltip="Recursos insuficientes o reservados"/);
  assert.doesNotMatch(container.innerHTML, /<small>[^<]*(?:insuficiente|Solo se puede)/i);
  buyer.resources = { SILVER: 100, MATERIALS: 100 };
  assert.equal(inspector.getActions({ type: 'TR', ownerId: buyer.id }).find((a) => a.type === 'RECRUIT_TROOP').enabled, false);
  assert.equal(inspector.getActions({ type: 'CAP', ownerId: buyer.id }).find((a) => a.type === 'RECRUIT_TROOP').enabled, true);
});

test('the trade form quotes the same gross and net amounts as the server', () => {
  const { state, buyer, seller } = fixture();
  const elements = Object.fromEntries(Object.entries({ recipientId: seller.id, offerResource: 'SILVER',
    requestResource: 'MATERIALS', offerAmount: '1', requestAmount: '3' }).map(([key, value]) => [key, { value }]));
  const controls = { '[data-trade-proposal]': { elements }, '#trade-propose-button': { dataset: {} },
    '#trade-quote': {}, '#trade-offer-list': {} };
  const panel = Object.assign(Object.create(FinancePanel.prototype), {
    root: { querySelector: (selector) => controls[selector] }, canTrade: true,
    gameState: state.getState(), localPlayerId: buyer.id, localPlayer: buyer
  });
  panel.syncTradeAmounts();
  assert.equal(elements.offerAmount.value, 6);
  assert.equal(controls['#trade-propose-button'].disabled, false);
  state.tradeOffers.push({ id: 'test', proposerId: seller.id, recipientId: buyer.id,
    offerResource: 'MATERIALS', offerAmount: 3, requestResource: 'SILVER', requestAmount: 6 });
  panel.renderTradeOffers(state.getState(), buyer.id, [seller], true);
  assert.match(controls['#trade-offer-list'].innerHTML, /Recibes 3 Materiales · entregas 6 Plata/);
  assert.match(controls['#trade-offer-list'].innerHTML, /Banco: 3 de Plata/);
  state.freeTradeTreaties.push({ playerIds: [buyer.id, seller.id], expiresAfterRound: 5 });
  panel.gameState = state.getState();
  panel.syncTradeAmounts();
  assert.equal(elements.offerAmount.value, 3);
  state.conflicts.push({ attackerId: buyer.id, defenderId: seller.id, round: state.currentRound });
  panel.gameState = state.getState();
  panel.updateTradeQuote();
  assert.equal(controls['#trade-propose-button'].disabled, true);
  assert.match(controls['#trade-propose-button'].dataset.tooltip, /conflicto/);
});

test('market buttons retain their price when resources are insufficient', () => {
  const controls = { '#market-quantity-input': { value: '3' }, '#market-quantity': {},
    '[data-market-action="BUY_MATERIALS"]': { dataset: {} }, '[data-market-action="SELL_MATERIALS"]': { dataset: {} } };
  const panel = Object.assign(Object.create(FinancePanel.prototype), {
    root: { querySelector: (selector) => controls[selector] },
    container: { querySelector: (selector) => controls[selector] },
    canTrade: true, localPlayer: { resources: { SILVER: 0, MATERIALS: 0 } }
  });
  panel.updateMarketQuantity();
  const buy = controls['[data-market-action="BUY_MATERIALS"]'];
  assert.equal(buy.disabled, true);
  assert.equal(buy.textContent, `Comprar (${3 * ECONOMY.COSTS.MARKET_BUY_MATERIAL_SILVER} plata)`);
  assert.equal(buy.dataset.tooltip, 'Plata insuficiente');
  assert.doesNotMatch(buy.textContent, /insuficiente/i);
  const sell = controls['[data-market-action="SELL_MATERIALS"]'];
  assert.equal(sell.disabled, true);
  assert.equal(sell.dataset.tooltip, 'Materiales insuficientes');
});
