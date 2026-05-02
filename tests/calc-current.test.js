import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveMaPerLed } from '../src/calc.js';

test('white at full brightness equals base mA', () => {
  assert.equal(effectiveMaPerLed(36, 255, 'white'), 36);
});

test('half brightness halves the current', () => {
  // 36 * (128/255) ≈ 18.07
  const result = effectiveMaPerLed(36, 128, 'white');
  assert.ok(Math.abs(result - 18.07) < 0.05);
});

test('average color uses ~1/3 duty cycle', () => {
  // 36 * 1.0 * 0.33 = 11.88
  assert.equal(effectiveMaPerLed(36, 255, 'average'), 36 * 0.33);
});

test('zero brightness = zero current', () => {
  assert.equal(effectiveMaPerLed(36, 0, 'white'), 0);
});
