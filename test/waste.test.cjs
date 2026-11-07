const test = require('node:test');
const assert = require('node:assert/strict');
const { wasteDaysUntil } = require('../src/waste.ts');

// Fester „Jetzt“-Zeitpunkt: Freitag, 7.11.2026, 10:00 Uhr deutscher Zeit (Winterzeit, UTC+1)
const now = Date.UTC(2026, 10, 7, 9, 0, 0);
const days = (state, attributes) => wasteDaysUntil({ state, attributes }, now);

test('waste days: texts from the sensors', () => {
  assert.equal(days('Heute'), 0);
  assert.equal(days('Morgen'), 1);
  assert.equal(days('Übermorgen'), 2);
  assert.equal(days('in 2 Tagen'), 2);
  assert.equal(days('in 12 Tagen'), 12);
  assert.equal(days('in 1 Tag'), 1);
  assert.equal(days('in 3 Wochen'), 21);
  assert.equal(days('5'), 5);
  assert.equal(days('unavailable'), null);
  assert.equal(days(''), null);
});

test('waste days: dates in different formats', () => {
  assert.equal(days('2026-11-09'), 2);
  assert.equal(days('24.11.2026'), 17);
  assert.equal(days('Mo, 24.11.'), 17);
  assert.equal(days('2.1.'), 56);            // Datum ohne Jahr nach Jahreswechsel
  assert.equal(days('2026-11-07T00:00:00+01:00'), 0);
});

test('waste days: attributes win over the state text', () => {
  assert.equal(days('Papier', { daysTo: 9 }), 9);
  assert.equal(days('irgendwas', { next_date: '2026-11-10' }), 3);
});

test('waste days: the later paper bin is no longer picked first', () => {
  const bins = [
    { name: 'Papiertonne', days: days('in 3 Wochen') },
    { name: 'Gelbe Tonne', days: days('in 2 Tagen') },
    { name: 'Restmüll', days: days('24.11.') }
  ].sort((a, b) => a.days - b.days);
  assert.equal(bins[0].name, 'Gelbe Tonne');
});

test('waste days: German date around midnight uses German time', () => {
  // 23:30 Uhr deutsche Zeit am 7.11. = 22:30 UTC → „heute“ ist noch der 7.11.
  assert.equal(wasteDaysUntil({ state: '2026-11-08' }, Date.UTC(2026, 10, 7, 22, 30)), 1);
  // 00:30 Uhr deutsche Zeit am 8.11. = 23:30 UTC am 7.11. → „heute“ ist schon der 8.11.
  assert.equal(wasteDaysUntil({ state: '2026-11-08' }, Date.UTC(2026, 10, 7, 23, 30)), 0);
});
