import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { BotDecisionTable } from '../src/game/bots/BotDecisionTable.js';
import { cloneForSearch, directedVariants, rewardRound, searchAction, strategicPotential } from '../src/game/bots/BotLearning.js';
import { evaluate } from '../src/training/BotTrainer.js';
import { NATIONS } from '../../shared/Constants.js';

function fixture() {
  const state = new GameState({ mapSeed: 'learning', maxRounds: 5 });
  const player = state.players.values().next().value;
  state.botRandom = () => 0.9;
  player.resources.SILVER = 1000;
  player.resources.MATERIALS = 1000;
  player.plannedActions = [null, null, null];
  return { state, player, table: state.botDecisionTables.get(player.id) };
}

test('directed exploration mutates the best learned quantity and validates neighbors', () => {
  const { state, player, table } = fixture();
  const source = state.grid.flat().find((tile) => tile.ownerId === player.id && ['CAP', 'CIU'].includes(tile.type));
  const action = { type: 'RECRUIT_TROOP', x: source.x, y: source.y, count: 5 };
  BotDecisionTable.rememberFinalResult(table, [{ contextKey: 'context', actionType: BotDecisionTable.getActionKey(action) }], 1);
  const variants = directedVariants(state, player, 0, [action], table, 'context');
  assert.ok(variants.some((a) => a.count === 4));
  assert.ok(variants.some((a) => a.count === 6));
  assert.ok(variants.every((a) => state.validatePlannedAction(player, a, 0).ok));
});

test('rollouts use independent state and never expose opponent planned orders', () => {
  const { state, player, table } = fixture();
  const opponent = [...state.players.values()][1];
  opponent.plannedActions = [{ type: 'BUILD_FACTORY', x: 0, y: 0 }, null, null];
  const before = structuredClone({ grid: state.grid, players: state.players, table, events: state.eventHistory });
  const clone = cloneForSearch(state);
  assert.ok(clone.players.get(opponent.id).plannedActions.every((a) => a === null));
  clone.players.get(player.id).resources.SILVER = 0;
  assert.equal(player.resources.SILVER, 1000);
  const candidates = state.findBotCandidates(player, 0);
  const selected = searchAction(state, player, 0, candidates, table, 'context', candidates[0]);
  assert.ok(candidates.includes(selected));
  assert.deepEqual({ grid: state.grid, players: state.players, table, events: state.eventHistory }, before);
});

test('intermediate rewards credit only this round and remain bounded; evaluation cannot learn', () => {
  const { state, player, table } = fixture();
  const before = new Map([...state.players.keys()].map((id) => [id, strategicPotential(state, id)]));
  player.botDecisionHistory = [{ contextKey: 'old', actionType: 'BUILD_CITY' }];
  const starts = new Map([[player.id, 1]]);
  player.botDecisionHistory.push({ contextKey: 'new', actionType: 'BUILD_FACTORY' });
  const tile = state.grid.flat().find((tile) => tile.ownerId === player.id);
  tile.building = 'FACTORY';
  rewardRound(state, before, starts);
  assert.equal(table.size, 0);
  state.trainingMode = true;
  rewardRound(state, before, starts);
  assert.equal(table.has('old|BUILD_CITY'), false);
  assert.ok(table.get('new|BUILD_FACTORY').reward > 0);
  assert.ok(table.get('new|BUILD_FACTORY').reward < 10);
});

test('search can override a preferred losing move using actual combat outcomes', () => {
  const { state, player, table } = fixture();
  const source = state.grid.flat().find((tile) => tile.ownerId === player.id && tile.x < state.gridWidth - 1);
  source.troops = 6;
  const target = state.grid[source.y][source.x + 1];
  target.type = 'TR';
  target.ownerId = [...state.players.keys()][1];
  target.troops = 4;
  target.defense = 0;
  const losing = { type: 'MOVE_TROOPS', x: source.x, y: source.y, targetX: target.x, targetY: target.y, troops: 1 };
  const winning = { ...losing, troops: 5 };
  // Same destination quantities must also be compared within the search budget.
  assert.equal(searchAction(state, player, 0, [losing, winning], table, 'c', losing), winning);
});

test('evaluation stops real fixture scheduling when a candidate cannot catch the champion', async () => {
  let calls = 0;
  const pool = { run: async () => {
    calls += 1;
    return { ranking: NATIONS.map((n) => ({ playerId: n.id, rank: 4, gdiPoints: 0 })), roundRankings: [], rewards: [] };
  } };
  const tables = new Map(NATIONS.map((n) => [n.id, new Map()]));
  const result = await evaluate(pool, tables, [{ name: 'champion', table: new Map() }], {}, [1],
    { baseline: { points: 10 }, batchSize: 1 });
  assert.equal(calls, 1);
  assert.equal(result.pruned, true);
});
