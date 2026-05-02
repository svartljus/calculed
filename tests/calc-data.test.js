import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataRecommendation } from '../src/calc.js';
import { getChip } from '../src/chips.js';

test('1-wire chips get a level-shifter recommendation', () => {
  const r = dataRecommendation({ dataRunMeters: 0.3 }, getChip('ws2812b'));
  assert.match(r.levelShifter, /recommended/i);
});

test('SPI chips do not need a level shifter', () => {
  const r = dataRecommendation({ dataRunMeters: 0.3 }, getChip('apa102'));
  assert.match(r.levelShifter, /not needed/i);
});

test('WS2815 gets the "often works" footnote', () => {
  const r = dataRecommendation({ dataRunMeters: 0.3 }, getChip('ws2815'));
  assert.match(r.note ?? '', /often works/i);
});

test('long data run triggers a warning', () => {
  const r = dataRecommendation({ dataRunMeters: 5 }, getChip('ws2812b'));
  assert.equal(r.dataRunWarning, true);
});

test('series resistor is always recommended', () => {
  const r = dataRecommendation({ dataRunMeters: 0.3 }, getChip('ws2812b'));
  assert.match(r.resistor, /330.{0,4}500/);   // "330–500 Ω"
});
