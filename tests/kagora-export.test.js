import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectToKagoraSpec, stripToSpecStrip } from '../src/kagora-export.js';

const sampleStrip = {
  id: 'abc',
  name: '',
  chipId: 'ws2815',
  density: 60,
  lengthMode: 'meters',
  length: 5,
  runs: 2,
  quantity: 3,
  iterations: 4,
  injection: 'oneEnd',
  brightness: 255,
  colorMode: 'white',
  dataRunMeters: 0,
  maxDropPercent: 20,
  notes: 'north wall',
};

const sampleProject = {
  version: 1,
  name: 'Borderland Dome',
  meta: { client: 'Annie', venue: 'Borderland', date: '2026-06-01' },
  currency: 'SEK',
  prefs: { minDevices: true, centralPower: false },
  stock: { 'strip-ws2815-60': 10 },
  strips: [sampleStrip],
};

test('stripToSpecStrip maps CalcuLED fields 1:1 to Kagora spec strip', () => {
  const s = stripToSpecStrip(sampleStrip);
  assert.equal(s.chipId, 'ws2815');
  assert.equal(s.density, 60);
  assert.equal(s.lengthMode, 'meters');
  assert.equal(s.length, 5);
  assert.equal(s.runs, 2);
  assert.equal(s.injection, 'oneEnd');     // CalcuLED vocabulary preserved
  assert.equal(s.quantity, 3);
  assert.equal(s.iterations, 4);
  assert.equal(s.brightness, 255);
  assert.equal(s.colorMode, 'white');
  assert.equal(s.dataRunMeters, 0);
  assert.equal(s.maxDropPercent, 20);
  assert.equal(s.notes, 'north wall');
});

test('stripToSpecStrip normalizes bothEnds and clamps qty/iterations', () => {
  const s = stripToSpecStrip({ ...sampleStrip, injection: 'bothEnds', quantity: 0, iterations: 0 });
  assert.equal(s.injection, 'bothEnds');
  assert.equal(s.quantity, 1);     // clamped to >= 1
  assert.equal(s.iterations, 1);
});

test('stripToSpecStrip handles count lengthMode and average color', () => {
  const s = stripToSpecStrip({ ...sampleStrip, lengthMode: 'count', length: 300, colorMode: 'average' });
  assert.equal(s.lengthMode, 'count');
  assert.equal(s.length, 300);
  assert.equal(s.colorMode, 'average');
});

test('projectToKagoraSpec produces a complete version-1 spec', () => {
  const spec = projectToKagoraSpec(sampleProject);
  assert.equal(spec.version, 1);
  assert.equal(spec.name, 'Borderland Dome');
  assert.equal(spec.currency, 'SEK');
  assert.deepEqual(spec.meta, { client: 'Annie', venue: 'Borderland', date: '2026-06-01' });
  assert.deepEqual(spec.prefs, { minDevices: true, centralPower: false });
  assert.deepEqual(spec.stock, { 'strip-ws2815-60': 10 });
  assert.equal(spec.strips.length, 1);
  assert.equal(spec.strips[0].chipId, 'ws2815');
});

test('projectToKagoraSpec tolerates a minimal project (no meta/stock/prefs)', () => {
  const spec = projectToKagoraSpec({ strips: [{ chipId: 'ws2812b', density: 30, length: 2 }] });
  assert.equal(spec.version, 1);
  assert.equal(spec.strips.length, 1);
  assert.equal(spec.strips[0].chipId, 'ws2812b');
  assert.equal(spec.strips[0].lengthMode, 'meters');  // defaulted
  assert.equal(spec.strips[0].runs, 1);
  assert.equal(spec.strips[0].injection, 'oneEnd');
  assert.equal(spec.currency, 'USD');                 // defaulted
  assert.equal(spec.stock, undefined);                // omitted when absent
});

test('projectToKagoraSpec is empty-safe', () => {
  const spec = projectToKagoraSpec({});
  assert.deepEqual(spec.strips, []);
  assert.equal(spec.version, 1);
});
