import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIPS, getChip, DEFAULT_CHIP_ID } from '../src/chips.js';

test('catalog has 5 entries', () => {
  assert.equal(CHIPS.length, 5);
});

test('default chip is WS2815', () => {
  assert.equal(DEFAULT_CHIP_ID, 'ws2815');
  assert.equal(getChip('ws2815').voltage, 12);
});

test('every chip has the required fields', () => {
  for (const c of CHIPS) {
    assert.ok(c.id && c.name && c.protocol && c.channels);
    assert.equal(typeof c.voltage, 'number');
    assert.equal(typeof c.mA_per_led, 'number');
    assert.equal(typeof c.ohm_per_meter, 'number');
  }
});

test('getChip returns undefined for unknown id', () => {
  assert.equal(getChip('nope'), undefined);
});

test('ohm_per_meter values look plausible (0.1–2.0 Ω/m)', () => {
  for (const c of CHIPS) {
    assert.ok(c.ohm_per_meter >= 0.1 && c.ohm_per_meter <= 2.0, `${c.id} has implausible ohm_per_meter`);
  }
});
