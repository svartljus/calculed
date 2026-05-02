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
  // R_total = 1.0 × 5 = 5 Ω; V_drop_1feed = 10.8 × 5 / 2 = 27 V (way past 0.5V budget)
  // maxDrop = 5 × 10% = 0.5 V → nFeeds = ceil(sqrt(27/0.5)) = ceil(7.35) = 8
  const chip = getChip('ws2812b');
  const strip = { lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 };
  const r = computeInjection(strip, chip);
  assert.equal(r.nFeeds, 8);
  assert.ok(Math.abs(r.injectEvery_m - (5 / 8)) < 0.001);
});

test('runs=2 doubles the electrical length', () => {
  // WS2815 (12V, 17 mA/LED, 0.45 Ω/m), 5m × 60/m, full white, maxDropPercent=10
  // single (runs=1): 300 LEDs × 17 mA = 5.1 A; R = 0.45 × 5 = 2.25 Ω
  //   vDrop_1feed = 5.1 × 2.25 / 2 = 5.7375 V; maxDrop = 1.2 V
  //   nFeeds = ceil(sqrt(5.7375 / 1.2)) = ceil(2.187) = 3
  // doubled (runs=2): 600 LEDs × 17 mA = 10.2 A; R = 0.45 × 10 = 4.5 Ω
  //   vDrop_1feed = 10.2 × 4.5 / 2 = 22.95 V; maxDrop = 1.2 V
  //   nFeeds = ceil(sqrt(22.95 / 1.2)) = ceil(4.373) = 5
  // doubled has 2x current AND 2x length → V_drop_1feed grows 4x → nFeeds grows
  const chip = getChip('ws2815');
  const single = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 1, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  const doubled = computeInjection({ lengthMode: 'meters', length: 5, density: 60, runs: 2, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  assert.equal(single.nFeeds, 3);
  assert.equal(doubled.nFeeds, 5);
  assert.ok(doubled.nFeeds >= single.nFeeds);
  assert.ok(doubled.electricalLength_m === 10);
});

test('count mode uses ledCount/density for electrical length and ignores runs', () => {
  const chip = getChip('ws2812b');
  const r = computeInjection({ lengthMode: 'count', length: 144, density: 60, runs: 2, brightness: 255, colorMode: 'white', maxDropPercent: 10 }, chip);
  assert.equal(r.electricalLength_m, 2.4);  // 144 / 60, runs ignored per design
});
