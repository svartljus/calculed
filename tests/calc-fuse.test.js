import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendFuse } from '../src/calc.js';

test('rounds to next standard fuse size', () => {
  // 4 A × 1.25 = 5 A exactly → 5 A fuse
  assert.equal(recommendFuse(4), 5);
});

test('picks next size up when over a standard', () => {
  // 5 A × 1.25 = 6.25 A → 7.5 A
  assert.equal(recommendFuse(5), 7.5);
});

test('large current picks 30 A or returns over-range marker', () => {
  // 25 A × 1.25 = 31.25 A → over the 30 A max
  const r = recommendFuse(25);
  assert.equal(r, 30);   // we cap at table max; UI can warn separately
});
