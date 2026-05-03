import { CHIPS, DEFAULT_CHIP_ID, getChip } from './src/chips.js';
import { computeStripDraw, computeInjection, recommendAWG, recommendFuse, dataRecommendation, computeProjectTotals } from './src/calc.js';
import { recommendControllers } from './src/controllers.js';

const STORAGE_KEY = 'calculed:project';

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch { /* quota etc. — ignore */ }
}

function sanitizeStrip(s) {
  if (!s || typeof s !== 'object') return null;
  const def = makeDefaultStrip();
  const chipId = getChip(s.chipId) ? s.chipId : DEFAULT_CHIP_ID;
  return { ...def, ...s, chipId, id: s.id ?? crypto.randomUUID() };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.strips)) return null;
    const strips = parsed.strips.map(sanitizeStrip).filter(Boolean);
    if (strips.length === 0) return null;
    return { version: 1, strips };
  } catch {
    return null;
  }
}

let saveTimer = 0;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 300);
}

addEventListener('pagehide', () => {
  if (saveTimer) { clearTimeout(saveTimer); saveToStorage(); }
});

const stripsList = document.getElementById('strips');
const tpl = document.getElementById('strip-template');

function makeDefaultStrip() {
  return {
    id: crypto.randomUUID(),
    name: '',
    chipId: DEFAULT_CHIP_ID,
    density: 96,
    lengthMode: 'meters',
    length: 5,
    runs: 1,
    quantity: 1,
    brightness: 255,
    colorMode: 'white',
    dataRunMeters: 0,
    maxDropPercent: 20,
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
  const densityRadio = node.querySelector(`input[name="density"][value="${strip.density}"]`);
  if (densityRadio) densityRadio.checked = true;
  node.querySelector('input[name="length"]').value = strip.length;
  node.querySelector('select[name="lengthMode"]').value = strip.lengthMode;
  node.querySelector('input[name="doubled"]').checked = strip.runs === 2;
  node.querySelector('input[name="quantity"]').value = strip.quantity || 1;
  const brightnessRadio = node.querySelector(`input[name="brightness"][value="${strip.brightness}"]`);
  if (brightnessRadio) brightnessRadio.checked = true;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;

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
    name: '',
    chipId: card.querySelector('select[name="chipId"]').value,
    density: Number(card.querySelector('input[name="density"]:checked')?.value ?? 60),
    lengthMode: card.querySelector('select[name="lengthMode"]').value,
    length: Number(card.querySelector('input[name="length"]').value),
    runs: card.querySelector('input[name="doubled"]').checked ? 2 : 1,
    quantity: Math.max(1, Number(card.querySelector('input[name="quantity"]').value) || 1),
    brightness: Number(card.querySelector('input[name="brightness"]:checked')?.value ?? 255),
    colorMode: card.querySelector('select[name="colorMode"]').value,
    dataRunMeters: 0,
    maxDropPercent: 20,
  };
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return '—';
  return parseFloat(n.toFixed(digits)).toString();   // strip trailing zeros
}
const intOrDash = n => Number.isFinite(n) ? String(n) : '—';

function paintCard(card, strip) {
  const chip = getChip(strip.chipId);
  if (!chip) return;
  const draw = computeStripDraw(strip, chip);
  const inj  = computeInjection(strip, chip);
  const perFeedCurrent = inj.current_A / inj.nFeeds;
  const awg  = recommendAWG(perFeedCurrent);
  const fuse = recommendFuse(perFeedCurrent);
  const data = dataRecommendation(strip, chip);

  const q = strip.quantity || 1;
  const $ = name => card.querySelector(`output[name="${name}"]`);
  $('pixels').value   = intOrDash(draw.pixels * q);
  $('ledCount').value = intOrDash(draw.ledCount * q);
  $('current').value  = fmt(draw.current_A * q);
  $('power').value    = fmt(draw.power_W * q, 1);

  // Drop summary — lead with what happens with no power injection,
  // then offer the optional injection plan to reduce drop.
  const oneFeedDropPct = (inj.vDrop_singleFeed_V / chip.voltage) * 100;
  const tolerancePct = strip.maxDropPercent;
  let summary;
  if (!Number.isFinite(oneFeedDropPct)) {
    summary = '—';
  } else if (inj.nFeeds === 1) {
    summary = `${fmt(oneFeedDropPct)}% drop end-to-end with one feed — no injection needed`;
  } else {
    summary = `${fmt(oneFeedDropPct)}% drop with one feed · ${inj.nFeeds} feeds every ${fmt(inj.injectEvery_m)} m for ≤${tolerancePct}%`;
  }
  if (q > 1) summary += ` · per strip (× ${q})`;
  $('injectionSummary').value = summary;

  // Three tiers for AWG and fuse
  const awgStr = t => `${t.awg}${t.overCapacity ? '!' : ''}`;
  $('awgMin').value      = awgStr(awg.min);
  $('awgBalanced').value = awgStr(awg.balanced);
  $('awgSolid').value    = awgStr(awg.solid);
  $('mm2Min').value      = fmt(awg.min.mm2);
  $('mm2Balanced').value = fmt(awg.balanced.mm2);
  $('mm2Solid').value    = fmt(awg.solid.mm2);
  $('fuseMin').value      = fmt(fuse.min);
  $('fuseBalanced').value = fmt(fuse.balanced);
  $('fuseSolid').value    = fmt(fuse.solid);

  // Collapse tiered display when all three tiers produce the same value.
  const setCollapsed = (sel, on) => {
    const el = card.querySelector(sel);
    if (!el) return;
    if (on) el.dataset.collapsed = '';
    else delete el.dataset.collapsed;
  };
  const wireSame = awg.min.awg === awg.balanced.awg && awg.balanced.awg === awg.solid.awg;
  const fuseSame = fuse.min === fuse.balanced && fuse.balanced === fuse.solid;
  setCollapsed('[data-tiered="wire"]', wireSame);
  setCollapsed('[data-tiered="fuse"]', fuseSame);

  // "each" suffix on per-strip recommendations when quantity > 1
  const eachLabel = q > 1 ? `each (× ${q})` : '';
  card.querySelectorAll('.each-suffix').forEach(el => el.textContent = eachLabel);

  // Data — short label + tooltip
  const shortLabel = chip.protocol + (data.dataRunWarning ? ' ⚠' : '');
  const tooltip = [
    `Protocol: ${chip.protocol}`,
    `Level shifter: ${data.levelShifter}` + (data.note ? ` (${data.note})` : ''),
    `Series resistor: ${data.resistor}`,
    data.dataRunWarning ? `⚠ data wire > 3 m — keep it short or buffer the signal` : '',
  ].filter(Boolean).join('\n');
  $('dataShort').value = shortLabel;
  card.querySelector('[data-info]').title = tooltip;
}

function paintTotals() {
  const totals = computeProjectTotals(project.strips, getChip);
  document.querySelector('output[name="totalPower"]').value  = fmt(totals.totalPower_W);
  document.querySelector('output[name="psuRec"]').value      = fmt(totals.psu.balanced, 0);
  document.querySelector('output[name="psuMin"]').value      = fmt(totals.psu.min, 0);
  document.querySelector('output[name="psuSolid"]').value    = fmt(totals.psu.solid, 0);
  document.querySelector('output[name="totalPixels"]').value = intOrDash(totals.totalPixels);
  document.querySelector('output[name="totalLeds"]').value   = intOrDash(totals.totalLeds);

  const ctrls = recommendControllers(totals.totalPixels);
  const ctrlText = ctrls
    .map(c => `${c.name} (${c.outputs}×${c.perOutputMax})${c.fits ? '' : ' — needs splitting'}`)
    .join(' · ');
  document.querySelector('output[name="controllers"]').value = ctrlText || '—';
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
  clearTimeout(saveTimer);
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

document.getElementById('print').addEventListener('click', () => window.print());
