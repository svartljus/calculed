import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendFuse } from '../src/calc.js';

test('returns three tiers: min, balanced, solid', () => {
  const r = recommendFuse(4);
  assert.ok('min' in r && 'balanced' in r && 'solid' in r);
});

test('balanced tier rounds to next standard size at 1.25×', () => {
  // 4 A × 1.25 = 5 A exactly → 5 A
  assert.equal(recommendFuse(4).balanced, 5);
  // 5 A × 1.25 = 6.25 → 7.5 A
  assert.equal(recommendFuse(5).balanced, 7.5);
});

test('min tier uses raw current', () => {
  // 4 A → 5 A (smallest standard ≥ 4)
  assert.equal(recommendFuse(4).min, 5);
  // 3 A → 3 A
  assert.equal(recommendFuse(3).min, 3);
});

test('solid tier uses 1.5× current', () => {
  // 4 A × 1.5 = 6 → 7.5 A
  assert.equal(recommendFuse(4).solid, 7.5);
});

test('current near the table cap is clamped to 30 A', () => {
  // 25 A × 1.25 = 31.25 → caps at 30
  assert.equal(recommendFuse(25).balanced, 30);
});
