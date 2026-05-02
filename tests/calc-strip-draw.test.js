import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLedCount, computeStripDraw } from '../src/calc.js';
import { getChip } from '../src/chips.js';

test('LED count: meters mode multiplies density × length × runs', () => {
  assert.equal(computeLedCount({ lengthMode: 'meters', length: 5, density: 60, runs: 1 }), 300);
  assert.equal(computeLedCount({ lengthMode: 'meters', length: 5, density: 60, runs: 2 }), 600);
});

test('LED count: count mode returns the input directly, ignoring runs', () => {
  assert.equal(computeLedCount({ lengthMode: 'count', length: 144, density: 60, runs: 2 }), 144);
});

test('strip draw: WS2815, 5m × 60/m at full white', () => {
  const chip = getChip('ws2815');               // 12V, 17 mA/LED
  const strip = { lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' };
  const r = computeStripDraw(strip, chip);
  // 300 LEDs × 17 mA = 5.1 A; × 12 V = 61.2 W
  assert.ok(Math.abs(r.ledCount - 300) < 0.01);
  assert.ok(Math.abs(r.current_A - 5.1) < 0.001);
  assert.ok(Math.abs(r.power_W - 61.2) < 0.01);
});

test('strip draw: doubled run doubles power', () => {
  const chip = getChip('ws2815');
  const single = computeStripDraw({ lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' }, chip);
  const doubled = computeStripDraw({ lengthMode: 'meters', length: 5, density: 60, runs: 2, brightness: 255, colorMode: 'white' }, chip);
  assert.ok(Math.abs(doubled.power_W - single.power_W * 2) < 0.01);
});
