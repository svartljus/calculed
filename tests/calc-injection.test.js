import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInjection } from '../src/calc.js';
import { getChip } from '../src/chips.js';

test('short low-current strip needs only 1 feed', () => {
  // WS2815, 1m, 60 LEDs, full white: 60 × 17 mA = 1.02 A
  // R = 1.0 × 1 = 1 Ω; V_drop = 1.02 × 1 / 2 = 0.51 V
  // maxDrop = 12 × 10% = 1.2 V → 0.51 < 1.2 → 1 feed
  const chip = getChip('ws2815');
  const strip = { lengthMode: 'meters', length: 1, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 };
  const r = computeInjection(strip, chip);
  assert.equal(r.nFeeds, 1);
  assert.ok(Math.abs(r.injectEvery_m - 1) < 0.001);
  assert.ok(r.vDrop_singleFeed_V < r.maxDrop_V);
});

test('long high-current strip needs multiple feeds', () => {
  // WS2812B, 5m, 60/m: 300 × 36 mA = 10.8 A
  // R_total = 1.0 × 5 = 5 Ω; V_drop_1feed = 10.8 × 5 / 2 = 27 V (way past 0.5V budget)
  // maxDrop = 5 × 10% = 0.5 V → nFeeds = ceil(sqrt(27/0.5)) = ceil(7.35) = 8
  const chip = getChip('ws2812b');
  const strip = { lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 };
  const r = computeInjection(strip, chip);
  assert.equal(r.nFeeds, 8);
  assert.ok(Math.abs(r.injectEvery_m - (5 / 8)) < 0.001);
});

test('runs=2 doubles the electrical length', () => {
  const chip = getChip('ws2815');
  const single = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  const doubled = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 2, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  // doubled has 2x current AND 2x length → V_drop_1feed grows 4x → nFeeds grows 2x at minimum
  assert.ok(doubled.nFeeds >= single.nFeeds);
  assert.ok(doubled.electricalLength_m === 10);
});
