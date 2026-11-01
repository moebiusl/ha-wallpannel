const test = require('node:test');
const assert = require('node:assert/strict');
const navigation = require('../public/navigation.js');

test('room reload route retains the selected room instead of the primary room', () => {
  const route = navigation.hash('room', 'kueche');
  assert.equal(route, '#room/kueche');
  assert.deepEqual(navigation.parse(route), {view:'room', roomId:'kueche'});
});
test('room ids survive encoded separators, spaces and umlauts', () => {
  for (const id of ['küche oben', 'room/one', 'room#one', 'room%one']) {
    assert.deepEqual(navigation.parse(navigation.hash('room', id)), {view:'room', roomId:id});
  }
});
test('regular app routes survive reload without falling back to Home', () => {
  for (const view of ['apps','security','energy','scenes','cameras']) {
    assert.equal(navigation.parse(navigation.hash(view, 'room')).view, view);
  }
});
test('settings route remains available for server session verification', () => {
  assert.deepEqual(navigation.parse(navigation.hash('settings')), {view:'settings', roomId:''});
});
test('old room URLs still parse and malformed input is harmless', () => {
  assert.deepEqual(navigation.parse('#room'), {view:'room',roomId:''});
  assert.deepEqual(navigation.parse('#room/%E0%A4'), {view:'room',roomId:''});
  assert.deepEqual(navigation.parse('#unknown'), {view:'home',roomId:''});
  assert.equal(navigation.hash('unknown'), '#home');
});
