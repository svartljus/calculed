import { CHIPS, DEFAULT_CHIP_ID, getChip } from './src/chips.js';
import { computeStripDraw, computeInjection, recommendAWG, recommendFuse, dataRecommendation, computeProjectTotals } from './src/calc.js';

const STORAGE_KEY = 'calculed:project';

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch { /* quota etc. — ignore */ }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

let saveTimer = 0;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 300);
}

const stripsList = document.getElementById('strips');
const tpl = document.getElementById('strip-template');

function makeDefaultStrip() {
  return {
    id: crypto.randomUUID(),
    name: '',
    chipId: DEFAULT_CHIP_ID,
    density: 60,
    lengthMode: 'meters',
    length: 5,
    runs: 1,
    brightness: 255,
    colorMode: 'white',
    feedRunMeters: 2,
    dataRunMeters: 0.3,
    maxDropPercent: 10,
  };
}

function renderStrip(strip) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = strip.id;

  // Populate the chip <select>
  const chipSel = node.querySelector('select[name="chipId"]');
  for (const c of CHIPS) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.voltage}V)`;
    if (c.id === strip.chipId) opt.selected = true;
    chipSel.appendChild(opt);
  }

  // Set form values from the strip object
  node.querySelector('input[name="name"]').value = strip.name;
  node.querySelector('select[name="density"]').value = strip.density;
  node.querySelector('input[name="length"]').value = strip.length;
  node.querySelector('select[name="lengthMode"]').value = strip.lengthMode;
  node.querySelector('input[name="doubled"]').checked = strip.runs === 2;
  node.querySelector('input[name="brightness"]').value = strip.brightness;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;
  node.querySelector('input[name="feedRunMeters"]').value = strip.feedRunMeters;
  node.querySelector('input[name="dataRunMeters"]').value = strip.dataRunMeters;
  node.querySelector('input[name="maxDropPercent"]').value = strip.maxDropPercent;

  return node;
}

const stored = loadFromStorage();
const project = stored ?? { version: 1, strips: [makeDefaultStrip()] };

function render() {
  stripsList.replaceChildren(...project.strips.map(renderStrip));
}

function readStripFromCard(card) {
  return {
    id: card.dataset.id,
    name: card.querySelector('input[name="name"]').value,
    chipId: card.querySelector('select[name="chipId"]').value,
    density: Number(card.querySelector('select[name="density"]').value),
    lengthMode: card.querySelector('select[name="lengthMode"]').value,
    length: Number(card.querySelector('input[name="length"]').value),
    runs: card.querySelector('input[name="doubled"]').checked ? 2 : 1,
    brightness: Number(card.querySelector('input[name="brightness"]').value),
    colorMode: card.querySelector('select[name="colorMode"]').value,
    feedRunMeters: Number(card.querySelector('input[name="feedRunMeters"]').value),
    dataRunMeters: Number(card.querySelector('input[name="dataRunMeters"]').value),
    maxDropPercent: Number(card.querySelector('input[name="maxDropPercent"]').value),
  };
}

function fmt(n, digits = 1) { return Number.isFinite(n) ? n.toFixed(digits) : '—'; }
const intOrDash = n => Number.isFinite(n) ? String(n) : '—';

function paintCard(card, strip) {
  const chip = getChip(strip.chipId);
  if (!chip) return;
  const draw = computeStripDraw(strip, chip);
  const inj  = computeInjection(strip, chip);
  const awg  = recommendAWG(inj.current_A / inj.nFeeds);
  const fuse = recommendFuse(inj.current_A / inj.nFeeds);
  const data = dataRecommendation(strip, chip);

  const $ = name => card.querySelector(`output[name="${name}"]`);
  $('ledCount').value    = intOrDash(draw.ledCount);
  $('current').value     = fmt(draw.current_A, 2);
  $('power').value       = fmt(draw.power_W, 1);
  $('injectEvery').value = fmt(inj.injectEvery_m, 2);
  $('nFeeds').value      = intOrDash(inj.nFeeds);
  $('awg').value         = `${awg.awg} AWG${awg.overCapacity ? ' (over capacity!)' : ''}`;
  $('fuse').value        = fuse;

  const dataLine = [
    `Level shifter: ${data.levelShifter}`,
    data.note ? `(${data.note})` : '',
    `Series resistor: ${data.resistor}`,
    data.dataRunWarning ? '⚠ data run > 3 m — keep it short or buffer the signal' : '',
  ].filter(Boolean).join(' · ');
  $('dataNote').value = dataLine;

  const svg = card.querySelector('[data-drop-viz]');
  drawDropViz(svg, strip, chip, inj);
}

function paintTotals() {
  const totals = computeProjectTotals(project.strips, getChip);
  document.querySelector('output[name="totalPower"]').value = fmt(totals.totalPower_W, 1);
  document.querySelector('output[name="psuRec"]').value    = fmt(totals.psuRec_W, 0);
  document.querySelector('output[name="totalLeds"]').value = intOrDash(totals.totalLeds);
}

function syncFromDom() {
  project.strips = [...stripsList.children].map(li => readStripFromCard(li.querySelector('article')));
  for (const li of stripsList.children) {
    const card = li.querySelector('article');
    const strip = project.strips.find(s => s.id === card.dataset.id);
    paintCard(card, strip);
  }
  paintTotals();
}

document.getElementById('project').addEventListener('input', () => {
  syncFromDom();
  scheduleSave();
});
render();
syncFromDom();

document.getElementById('add-strip').addEventListener('click', () => {
  const strip = makeDefaultStrip();
  project.strips.push(strip);
  stripsList.appendChild(renderStrip(strip));
  syncFromDom();
  scheduleSave();
});

stripsList.addEventListener('click', (e) => {
  if (e.target.matches('button[data-action="remove"]')) {
    const li = e.target.closest('li');
    const id = li.querySelector('article').dataset.id;
    project.strips = project.strips.filter(s => s.id !== id);
    li.remove();
    paintTotals();
    scheduleSave();
  }
});

const resetDialog = document.getElementById('reset-confirm');
document.getElementById('reset').addEventListener('click', () => resetDialog.showModal());
resetDialog.addEventListener('close', () => {
  if (resetDialog.returnValue !== 'confirm') return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

function drawDropViz(svg, strip, chip, inj) {
  const W = 200, H = 80, PAD = 10;
  const xs = i => PAD + (W - 2 * PAD) * (i / 100);
  const ys = v => H - PAD - (H - 2 * PAD) * v;     // v: 0..1 = full drop

  // Single-feed curve: V_drop at position p along strip = current_at_p * R remaining / 2
  // Simpler representation: triangular drop, peak at the far end, normalized to maxDrop_V
  function curve(nFeeds) {
    const segLen = 100 / nFeeds;
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const segIdx = Math.min(Math.floor(i / segLen), nFeeds - 1);
      const intoSeg = (i - segIdx * segLen) / segLen;   // 0..1, hits 1 at segment end
      // drop within a segment grows like x * (1 - x/2) * vDrop_singleFeed/(nFeeds^2) — approximate as parabola
      const norm = (intoSeg * (2 - intoSeg)) / 2;
      const dropFrac = norm * (inj.vDrop_singleFeed_V / (nFeeds * nFeeds)) / inj.maxDrop_V;
      pts.push(`${xs(i).toFixed(1)},${ys(Math.min(dropFrac, 1)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  svg.innerHTML = `
    <title>Voltage drop along strip: faded line is single feed, solid line is ${inj.nFeeds}-feed</title>
    <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="currentColor" stroke-width="0.5"/>
    <line x1="${PAD}" y1="${PAD}"     x2="${PAD}"     y2="${H - PAD}" stroke="currentColor" stroke-width="0.5"/>
    <polyline fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" points="${curve(1)}"/>
    <polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${curve(inj.nFeeds)}"/>
    <text x="${W - PAD}" y="${H - 1}" text-anchor="end" font-size="8" fill="currentColor" opacity="0.6">faded = 1 feed · solid = ${inj.nFeeds}</text>
  `;
}
