import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLLERS, recommendControllers } from '../src/controllers.js';

test('catalog includes all expected models', () => {
  const ids = CONTROLLERS.map(c => c.id);
  assert.ok(ids.includes('diguno'));
  assert.ok(ids.includes('digquad'));
  assert.ok(ids.includes('digocta'));
  assert.ok(ids.includes('pixlite-4'));
  assert.ok(ids.includes('pixlite-16'));
});

test('every controller has the required fields', () => {
  for (const c of CONTROLLERS) {
    assert.ok(c.id && c.name);
    assert.equal(typeof c.outputs, 'number');
    assert.equal(typeof c.perOutputMax, 'number');
    assert.ok(Array.isArray(c.voltages));
  }
});

test('zero pixels: every controller fits', () => {
  const r = recommendControllers(0);
  assert.equal(r.length, CONTROLLERS.length);
});

test('800 pixels: DigUno still fits exactly', () => {
  const r = recommendControllers(800);
  assert.ok(r.some(c => c.id === 'diguno'));
});

test('801 pixels: DigUno needs 2 units (still listed within multi-unit cap)', () => {
  const r = recommendControllers(801);
  const diguno = r.find(c => c.id === 'diguno');
  assert.ok(diguno);
  assert.equal(diguno.unitsNeeded, 2);
  assert.equal(diguno.fits, false);
  assert.ok(r.some(c => c.id === 'digquad' && c.fits === true));
});

test('5000 pixels: PixLites fit with one unit; smaller controllers need multiple', () => {
  const r = recommendControllers(5000);
  const ids = r.map(c => c.id);
  assert.ok(ids.includes('pixlite-16'));
  // Dig-Octa (cap 2000) needs ceil(5000/2000) = 3 → still within maxUnits=3 default
  const octa = r.find(c => c.id === 'digocta');
  assert.equal(octa?.unitsNeeded, 3);
});

test('huge pixel count: nothing within 3-unit cap → empty list', () => {
  const r = recommendControllers(999_999);
  assert.equal(r.length, 0);
});
