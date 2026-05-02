import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendAWG } from '../src/calc.js';

test('low current → small gauge', () => {
  // 2 A × 1.25 = 2.5 A required → 18 AWG (7 A) suffices
  assert.equal(recommendAWG(2).awg, 18);
});

test('mid current picks smallest sufficient gauge', () => {
  // 8 A × 1.25 = 10 A → 16 AWG (10 A) is the smallest that works
  assert.equal(recommendAWG(8).awg, 16);
});

test('high current picks heavier gauge', () => {
  // 20 A × 1.25 = 25 A → 12 AWG handles 20 A, no — needs 10 AWG (30 A)
  assert.equal(recommendAWG(20).awg, 10);
});

test('current beyond table returns largest gauge with a warning', () => {
  const r = recommendAWG(100);
  assert.equal(r.awg, 8);
  assert.ok(r.overCapacity === true);
});
