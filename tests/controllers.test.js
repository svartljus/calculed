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

test('801 pixels: DigUno does not fit, others do', () => {
  const r = recommendControllers(801);
  assert.ok(!r.some(c => c.id === 'diguno'));
  assert.ok(r.some(c => c.id === 'digquad'));
});

test('5000 pixels: only DigOcta and PixLites fit', () => {
  const r = recommendControllers(5000);
  const ids = r.map(c => c.id);
  assert.ok(!ids.includes('diguno'));
  assert.ok(!ids.includes('digquad'));
  assert.ok(!ids.includes('pixlite-4'));
  assert.ok(ids.includes('digocta'));
  assert.ok(ids.includes('pixlite-16'));
});

test('huge pixel count returns the largest as a splitting hint', () => {
  const r = recommendControllers(99999);
  assert.equal(r.length, 1);
  // none actually fit; we hand back the biggest as "you'll need this and split"
  assert.ok(r[0].fits === false);
});
