import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendAWG } from '../src/calc.js';

test('returns three tiers: min, balanced, solid', () => {
  const r = recommendAWG(2);
  assert.ok(r.min && r.balanced && r.solid);
  assert.ok('awg' in r.balanced && 'overCapacity' in r.balanced);
});

test('balanced tier matches industry-standard 1.25× rule', () => {
  // 8 A × 1.25 = 10 A → 16 AWG (10 A) is the smallest that works
  assert.equal(recommendAWG(8).balanced.awg, 16);
  // 20 A × 1.25 = 25 A → 10 AWG (30 A)
  assert.equal(recommendAWG(20).balanced.awg, 10);
});

test('min tier uses raw current (no safety factor)', () => {
  // 8 A → 16 AWG (10 A) suffices; same as balanced here
  assert.equal(recommendAWG(8).min.awg, 16);
  // 14 A → 14 AWG (15 A) suffices for min, but balanced needs 12 AWG (14×1.25=17.5)
  assert.equal(recommendAWG(14).min.awg, 14);
  assert.equal(recommendAWG(14).balanced.awg, 12);
});

test('solid tier uses 1.5× current — more headroom than balanced', () => {
  // 14 A × 1.5 = 21 A → 10 AWG (30 A)
  assert.equal(recommendAWG(14).solid.awg, 10);
});

test('current beyond table returns largest gauge with overCapacity flag', () => {
  const r = recommendAWG(100);
  assert.equal(r.balanced.awg, 8);
  assert.ok(r.balanced.overCapacity === true);
});
