import { CHIPS, DEFAULT_CHIP_ID, getChip } from './src/chips.js';
import { computeStripDraw, computeInjection, recommendAWG, recommendFuse, dataRecommendation, computeProjectTotals } from './src/calc.js';

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
    density: 60,
    lengthMode: 'meters',
    length: 5,
    runs: 1,
    brightness: 255,
    colorMode: 'white',
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
  const densityRadio = node.querySelector(`input[name="density"][value="${strip.density}"]`);
  if (densityRadio) densityRadio.checked = true;
  node.querySelector('input[name="length"]').value = strip.length;
  node.querySelector('select[name="lengthMode"]').value = strip.lengthMode;
  node.querySelector('input[name="doubled"]').checked = strip.runs === 2;
  node.querySelector('input[name="brightness"]').value = strip.brightness;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;
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
    name: '',
    chipId: card.querySelector('select[name="chipId"]').value,
    density: Number(card.querySelector('input[name="density"]:checked')?.value ?? 60),
    lengthMode: card.querySelector('select[name="lengthMode"]').value,
    length: Number(card.querySelector('input[name="length"]').value),
    runs: card.querySelector('input[name="doubled"]').checked ? 2 : 1,
    brightness: Number(card.querySelector('input[name="brightness"]').value),
    colorMode: card.querySelector('select[name="colorMode"]').value,
    dataRunMeters: Number(card.querySelector('input[name="dataRunMeters"]').value),
    maxDropPercent: Number(card.querySelector('input[name="maxDropPercent"]').value),
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

  const $ = name => card.querySelector(`output[name="${name}"]`);
  $('pixels').value   = intOrDash(draw.pixels);
  $('ledCount').value = intOrDash(draw.ledCount);
  $('current').value  = fmt(draw.current_A);
  $('power').value    = fmt(draw.power_W, 1);

  // Inject summary
  const dropPerSeg = inj.vDrop_singleFeed_V / (inj.nFeeds * inj.nFeeds);
  const dropStr = Number.isFinite(dropPerSeg) ? `~${fmt(dropPerSeg)} V drop` : '';
  let summary;
  if (inj.nFeeds === 1) {
    summary = `single feed${dropStr ? ` · ${dropStr}` : ''}`;
  } else if (Number.isFinite(inj.injectEvery_m)) {
    summary = `every ${fmt(inj.injectEvery_m)} m · ${inj.nFeeds} feeds${dropStr ? ` · ${dropStr}` : ''}`;
  } else {
    summary = '—';
  }
  $('injectionSummary').value = summary;

  // Three tiers for AWG and fuse
  const awgStr = t => `${t.awg}${t.overCapacity ? '!' : ''}`;
  $('awgMin').value      = awgStr(awg.min);
  $('awgBalanced').value = awgStr(awg.balanced);
  $('awgSolid').value    = awgStr(awg.solid);
  $('fuseMin').value      = fmt(fuse.min);
  $('fuseBalanced').value = fmt(fuse.balanced);
  $('fuseSolid').value    = fmt(fuse.solid);

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

  const brightLabel = card.querySelector('label:has(> input[name="brightness"])');
  if (brightLabel) brightLabel.dataset.printValue = `value: ${strip.brightness}/255`;
}

function paintTotals() {
  const totals = computeProjectTotals(project.strips, getChip);
  document.querySelector('output[name="totalPower"]').value  = fmt(totals.totalPower_W);
  document.querySelector('output[name="psuRec"]').value      = fmt(totals.psu.balanced, 0);
  document.querySelector('output[name="psuMin"]').value      = fmt(totals.psu.min, 0);
  document.querySelector('output[name="psuSolid"]').value    = fmt(totals.psu.solid, 0);
  document.querySelector('output[name="totalPixels"]').value = intOrDash(totals.totalPixels);
  document.querySelector('output[name="totalLeds"]').value   = intOrDash(totals.totalLeds);
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
