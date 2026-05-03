import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInjection } from '../src/calc.js';
import { getChip } from '../src/chips.js';

test('short low-current strip needs only 1 feed', () => {
  // WS2815, 1m, 60 LEDs, full white: 60 × 17 mA = 1.02 A
  // R = 0.45 × 1 = 0.45 Ω; V_drop = 1.02 × 0.45 / 2 = 0.2295 V
  // maxDrop = 12 × 10% = 1.2 V → 0.2295 < 1.2 → 1 feed
  const chip = getChip('ws2815');
  const strip = { lengthMode: 'meters', length: 1, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 };
  const r = computeInjection(strip, chip);
  assert.equal(r.nFeeds, 1);
  assert.ok(Math.abs(r.injectEvery_m - 1) < 0.001);
  assert.ok(r.vDrop_singleFeed_V < r.maxDrop_V);
});

test('long high-current strip needs multiple feeds', () => {
  // WS2812B, 5m, 60/m: 300 × 36 mA = 10.8 A
  // R_total = 0.85 × 5 = 4.25 Ω; V_drop_1feed = 10.8 × 4.25 / 2 = 22.95 V (way past budget)
  // maxDrop = 5 × 10% = 0.5 V → nFeeds = ceil(sqrt(22.95/0.5)) = ceil(6.78) = 7
  const chip = getChip('ws2812b');
  const strip = { lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 };
  const r = computeInjection(strip, chip);
  assert.equal(r.nFeeds, 7);
  assert.ok(Math.abs(r.injectEvery_m - (5 / 7)) < 0.001);
});

test('doubled = parallel strips: same per-strip current, same length, same nFeeds', () => {
  // WS2815 (12V, 17 mA/LED, 0.30 Ω/m), 5m × 60/m, full white, maxDropPercent=10
  // single (runs=1): per-strip current = 300 × 17 / 1000 = 5.1 A; R = 0.30 × 5 = 1.5 Ω
  //   vDrop_1feed = 5.1 × 1.5 / 2 = 3.825 V; maxDrop = 1.2 V
  //   nFeeds = ceil(sqrt(3.825 / 1.2)) = ceil(1.785) = 2
  // doubled: per-strip current = 5.1 A (parallel) → same nFeeds = 2
  const chip = getChip('ws2815');
  const single = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  const doubled = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 2, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  assert.equal(single.nFeeds, 2);
  assert.equal(doubled.nFeeds, 2);
  assert.equal(doubled.electricalLength_m, 5);
  assert.ok(Math.abs(doubled.current_A - single.current_A * 2) < 0.01);
});

test('count mode: electrical length = pixels / density, independent of runs', () => {
  const chip = getChip('ws2812b');
  const r = computeInjection({ lengthMode: 'count', length: 144, density: 60, runs: 2, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  assert.equal(r.electricalLength_m, 2.4);  // 144 pixels / 60 = 2.4 m per strip
});
