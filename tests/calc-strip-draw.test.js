import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLedCount, computeStripDraw, computePixels } from '../src/calc.js';
import { getChip } from '../src/chips.js';

test('pixels: meters mode = density × length, independent of runs', () => {
  assert.equal(computePixels({ lengthMode: 'meters', length: 5, density: 60, runs: 1 }), 300);
  assert.equal(computePixels({ lengthMode: 'meters', length: 5, density: 60, runs: 2 }), 300);
});

test('pixels: count mode returns the input directly', () => {
  assert.equal(computePixels({ lengthMode: 'count', length: 144, density: 60, runs: 2 }), 144);
});

test('LED count: meters mode multiplies density × length × runs', () => {
  assert.equal(computeLedCount({ lengthMode: 'meters', length: 5, density: 60, runs: 1 }), 300);
  assert.equal(computeLedCount({ lengthMode: 'meters', length: 5, density: 60, runs: 2 }), 600);
});

test('LED count: count mode treats input as pixels; doubled doubles physical count', () => {
  assert.equal(computeLedCount({ lengthMode: 'count', length: 144, density: 60, runs: 1 }), 144);
  assert.equal(computeLedCount({ lengthMode: 'count', length: 144, density: 60, runs: 2 }), 288);
});

test('strip draw: WS2815, 5m × 60/m at full white', () => {
  const chip = getChip('ws2815');               // 12V, 17 mA/LED
  const strip = { lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' };
  const r = computeStripDraw(strip, chip);
  // 300 LEDs × 17 mA = 5.1 A; × 12 V = 61.2 W
  assert.equal(r.pixels, 300);
  assert.ok(Math.abs(r.ledCount - 300) < 0.01);
  assert.ok(Math.abs(r.current_A - 5.1) < 0.001);
  assert.ok(Math.abs(r.power_W - 61.2) < 0.01);
});

test('strip draw: doubled = pixels constant, LEDs and power double', () => {
  const chip = getChip('ws2815');
  const single = computeStripDraw({ lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' }, chip);
  const doubled = computeStripDraw({ lengthMode: 'meters', length: 5, density: 60, runs: 2, brightness: 255, colorMode: 'white' }, chip);
  assert.equal(doubled.pixels, single.pixels);
  assert.ok(Math.abs(doubled.ledCount - single.ledCount * 2) < 0.01);
  assert.ok(Math.abs(doubled.power_W - single.power_W * 2) < 0.01);
});
