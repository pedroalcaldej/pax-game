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
  fields.set('#single-settings-preset', { value: 'short' });
  fields.set('#lobby-settings-preset', { value: 'short' });
  fields.set('#lobby-settings-summary', { textContent: '' });
  view.query = (selector) => fields.get(selector);
  return view;
}

for (const scope of ['single', 'lobby']) {
  test(`short preset survives ${scope} form submission and creates a 20x20, 15-round game`, () => {
    const view = settingsForm();
    view.writeSettings(normalizeGameSettings(), scope);
    view.writeSettings({ ...view.readSettings(scope), ...GAME_SETTINGS_PRESETS.short, preset: 'short' }, scope);
    const settings = view.readSettings(scope);
    assert.equal(settings.preset, 'short');
    assert.equal(settings.maxRounds, 15);
    assert.equal(settings.mapSize, 20);
    const state = new GameState({ ...settings, mapSeed: 'short-settings' });
    assert.equal(state.grid.length, 20);
    assert.ok(state.grid.every((row) => row.length === 20));
    assert.equal(state.getState().settings.maxRounds, 15);
    assert.equal(state.settings.actionSlotCount, 3);
    assert.equal(view.query(`#${scope === 'single' ? 'single-settings' : 'settings'}-rounds`).disabled, true);
    view.writeSettings({ ...settings, preset: 'custom', maxRounds: 22, planningDuration: 90, mapSize: 24 }, scope);
    assert.equal(view.query(`#${scope === 'single' ? 'single-settings' : 'settings'}-rounds`).disabled, false);
    assert.equal(view.readSettings(scope).maxRounds, 22);
    view.writeSettings({ ...settings, ...GAME_SETTINGS_PRESETS.long, preset: 'long' }, scope);
    assert.equal(view.readSettings(scope).maxRounds, 30);
    assert.equal(view.readSettings(scope).mapSize, 30);
  });
}

test('short games actually end at round fifteen and allow explicit custom overrides', () => {
  const state = new GameState({ preset: 'short', mapSeed: 'short-ending' });
  const manager = new PhaseManager(state, () => {});
  manager.running = true;
  state.currentRound = 15;
  manager.transitionToPhase(5);
  assert.equal(state.gameOver, true);
  assert.equal(state.currentRound, 15);
  assert.equal(normalizeGameSettings({ preset: 'short', maxRounds: 18, mapSize: 24 }).maxRounds, 18);
  assert.equal(normalizeGameSettings({ preset: 'short', maxRounds: 18, mapSize: 24 }).mapSize, 24);
});


test('every preset provides three action slots', () => {
  assert.deepEqual(Object.keys(GAME_SETTINGS_PRESETS), ['short', 'long', 'custom']);
  for (const preset of Object.keys(GAME_SETTINGS_PRESETS)) {
    assert.equal(normalizeGameSettings({ preset }).actionSlotCount, 3, preset);
  }
});

test('short is the default preset and legacy names normalize without exposing removed modes', () => {
  const defaults = normalizeGameSettings();
  assert.equal(defaults.preset, 'short');
  assert.equal(defaults.maxRounds, 15);
  assert.equal(defaults.mapSize, 20);
  assert.equal(normalizeGameSettings({ preset: 'quick' }).preset, 'short');
  assert.equal(normalizeGameSettings({ preset: 'normal' }).preset, 'long');
  assert.equal(normalizeGameSettings({ preset: 'strategic' }).preset, 'long');
  assert.equal(normalizeGameSettings({ preset: 'custom', maxRounds: 22, planningDuration: 90, mapSize: 24 }).preset, 'custom');
  assert.equal(normalizeGameSettings({ preset: 'custom', maxRounds: 22, planningDuration: 90, mapSize: 24 }).maxRounds, 22);
});
