import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProjectTotals } from '../src/calc.js';
import { getChip } from '../src/chips.js';

const stripA = { chipId: 'ws2815', lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' };
const stripB = { chipId: 'ws2812b', lengthMode: 'meters', length: 2, density: 60, runs: 1, brightness: 255, colorMode: 'white' };

test('project totals sum power across strips', () => {
  // A: 300 LEDs × 17 mA × 12V = 61.2 W
  // B: 120 LEDs × 36 mA × 5V  = 21.6 W
  const r = computeProjectTotals([stripA, stripB], getChip);
  assert.ok(Math.abs(r.totalPower_W - 82.8) < 0.05);
  assert.equal(r.totalLeds, 420);
});

test('PSU recommendation adds 20% headroom', () => {
  const r = computeProjectTotals([stripA], getChip);
  // 61.2 / 0.8 = 76.5
  assert.ok(Math.abs(r.psuRec_W - 76.5) < 0.05);
});

test('empty project totals are zero', () => {
  const r = computeProjectTotals([], getChip);
  assert.equal(r.totalPower_W, 0);
  assert.equal(r.psuRec_W, 0);
  assert.equal(r.totalLeds, 0);
});
