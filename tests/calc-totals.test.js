import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProjectTotals } from '../src/calc.js';
import { getChip } from '../src/chips.js';

const stripA = { chipId: 'ws2815', lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white' };
const stripB = { chipId: 'ws2812b', lengthMode: 'meters', length: 2, density: 60, runs: 1, brightness: 255, colorMode: 'white' };

test('project totals sum power, LEDs, and pixels across strips', () => {
  // A: 300 LEDs × 17 mA × 12V = 61.2 W
  // B: 120 LEDs × 36 mA × 5V  = 21.6 W
  const r = computeProjectTotals([stripA, stripB], getChip);
  assert.ok(Math.abs(r.totalPower_W - 82.8) < 0.05);
  assert.equal(r.totalLeds, 420);
  assert.equal(r.totalPixels, 420);
});

test('totals: doubled strip pixels stay constant; LEDs reflect physical doubling', () => {
  const doubled = { ...stripA, runs: 2 };  // 300 pixels, 600 LEDs
  const r = computeProjectTotals([doubled], getChip);
  assert.equal(r.totalPixels, 300);
  assert.equal(r.totalLeds, 600);
});

test('PSU returns three tiers; balanced is alias for psuRec_W', () => {
  const r = computeProjectTotals([stripA], getChip);
  // 61.2 W: min=61.2, balanced=76.5, solid=91.8
  assert.ok(Math.abs(r.psu.min - 61.2) < 0.05);
  assert.ok(Math.abs(r.psu.balanced - 76.5) < 0.05);
  assert.ok(Math.abs(r.psu.solid - 91.8) < 0.05);
  assert.equal(r.psuRec_W, r.psu.balanced);
});

test('empty project totals are zero', () => {
  const r = computeProjectTotals([], getChip);
  assert.equal(r.totalPower_W, 0);
  assert.equal(r.psu.balanced, 0);
  assert.equal(r.totalLeds, 0);
});
