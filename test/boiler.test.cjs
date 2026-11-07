const test = require('node:test');
const assert = require('node:assert/strict');
const { boilerCandidates, chooseBoilerEntity, lastOnFromState, lastOnFromHistory } = require('../src/boiler.ts');

const states = [
  { entity_id: 'switch.boiler', state: 'off', attributes: { friendly_name: 'Boiler' } },
  { entity_id: 'scene.warmwasser_an', state: '2026-11-07T06:40:00+00:00', attributes: { friendly_name: 'Warmwasser an' } },
  { entity_id: 'light.kueche', state: 'on', attributes: { friendly_name: 'Küche' } },
  { entity_id: 'sensor.boiler_temp', state: '55', attributes: { friendly_name: 'Boiler Temperatur' } },
];

test('boiler: candidates prefer scenes, ignore sensors', () => {
  assert.deepEqual(boilerCandidates(states).map((e) => e.entityId), ['scene.warmwasser_an', 'switch.boiler']);
});

test('boiler: configured entity wins, otherwise auto', () => {
  assert.equal(chooseBoilerEntity(states, 'switch.boiler').entityId, 'switch.boiler');
  assert.equal(chooseBoilerEntity(states, '').entityId, 'scene.warmwasser_an');
  assert.equal(chooseBoilerEntity(states, 'switch.gibtsnicht').entityId, 'scene.warmwasser_an');
  assert.equal(chooseBoilerEntity([], ''), null);
});

test('boiler: last on from state', () => {
  assert.equal(lastOnFromState(states[1]), '2026-11-07T06:40:00.000Z');
  assert.equal(lastOnFromState({ entity_id: 'script.boiler', state: 'off', attributes: { last_triggered: '2026-11-06T18:00:00Z' } }), '2026-11-06T18:00:00.000Z');
  assert.equal(lastOnFromState({ entity_id: 'switch.boiler', state: 'on', last_changed: '2026-11-07T08:00:00Z' }), '2026-11-07T08:00:00.000Z');
  assert.equal(lastOnFromState(states[0]), null);
  assert.equal(lastOnFromState({ entity_id: 'scene.boiler', state: 'unknown' }), null);
});

test('boiler: last on from history', () => {
  const history = [
    { state: 'on', last_changed: '2026-11-06T07:00:00Z' },
    { state: 'off', last_changed: '2026-11-06T07:10:00Z' },
    { state: 'active', last_changed: '2026-11-07T06:30:00Z' },
    { state: 'idle', last_changed: '2026-11-07T06:40:00Z' },
  ];
  assert.equal(lastOnFromHistory(history), '2026-11-07T06:30:00.000Z');
  assert.equal(lastOnFromHistory([]), null);
  assert.equal(lastOnFromHistory(null), null);
});
