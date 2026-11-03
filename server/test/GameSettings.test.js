import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_SETTINGS_PRESETS, normalizeGameSettings } from '../../shared/Constants.js';
import { GameState } from '../src/game/GameState.js';
import { PhaseManager } from '../src/game/PhaseManager.js';
import { LobbyScreen } from '../../client/src/ui/screens/LobbyScreen.js';

function settingsForm() {
  const view = Object.create(LobbyScreen.prototype);
  const fields = new Map();
  for (const prefix of ['single-settings', 'settings']) {
    for (const suffix of ['rounds', 'planning', 'actions', 'oi-frequency', 'map-size', 'seed']) {
      fields.set(`#${prefix}-${suffix}`, { value: '' });
    }
  }
  fields.set('#single-settings-preset', { value: 'normal' });
  fields.set('#lobby-settings-preset', { value: 'normal' });
  fields.set('#lobby-settings-summary', { textContent: '' });
  view.query = (selector) => fields.get(selector);
  return view;
}

for (const scope of ['single', 'lobby']) {
  test(`quick preset survives ${scope} form submission and creates a 20x20, 15-round game`, () => {
    const view = settingsForm();
    view.writeSettings(normalizeGameSettings(), scope);
    view.writeSettings({ ...view.readSettings(scope), ...GAME_SETTINGS_PRESETS.quick, preset: 'quick' }, scope);
    const settings = view.readSettings(scope);
    assert.equal(settings.preset, 'quick');
    assert.equal(settings.maxRounds, 15);
    assert.equal(settings.mapSize, 20);
    const state = new GameState({ ...settings, mapSeed: 'quick-settings' });
    assert.equal(state.grid.length, 20);
    assert.ok(state.grid.every((row) => row.length === 20));
    assert.equal(state.getState().settings.maxRounds, 15);
    assert.equal(state.settings.actionSlotCount, 3);
    view.writeSettings({ ...settings, ...GAME_SETTINGS_PRESETS.normal, preset: 'normal' }, scope);
    assert.equal(view.readSettings(scope).maxRounds, 30);
    assert.equal(view.readSettings(scope).mapSize, 30);
  });
}

test('quick games actually end at round fifteen and allow explicit custom overrides', () => {
  const state = new GameState({ preset: 'quick', mapSeed: 'quick-ending' });
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  state.currentRound = 15;
  manager.transitionToPhase(5);
  assert.equal(state.gameOver, true);
  assert.equal(state.currentRound, 15);
  assert.equal(normalizeGameSettings({ preset: 'quick', maxRounds: 18, mapSize: 24 }).maxRounds, 18);
  assert.equal(normalizeGameSettings({ preset: 'quick', maxRounds: 18, mapSize: 24 }).mapSize, 24);
});


test('every preset provides three action slots', () => {
  for (const preset of Object.keys(GAME_SETTINGS_PRESETS)) {
    assert.equal(normalizeGameSettings({ preset }).actionSlotCount, 3, preset);
  }
});
