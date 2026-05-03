import { CHIPS, DEFAULT_CHIP_ID, getChip } from './src/chips.js';
import { computeStripDraw, computeInjection, recommendAWG, recommendFuse, dataRecommendation, computeProjectTotals, recommendPSUs, formatPSUCombo, totalPSUWatts, computeFPS, totalPSUCost, priceForPSU } from './src/calc.js';
import { CONTROLLERS, recommendControllers } from './src/controllers.js';
import { recommendSetup, outputsForController, recommendPremiumSetup, assignOutputs } from './src/setup.js';
import { formatMeanWellCombo } from './src/calc.js';

const STORAGE_KEY = 'calculed:project';

// Approximate FX rates against USD (Apr 2026, hand-set; user can refine).
const FX = {
  USD: { rate: 1.00,   symbol: '$',  suffix: false },
  EUR: { rate: 0.92,   symbol: '€',  suffix: false },
  SEK: { rate: 10.50,  symbol: 'kr', suffix: true  },
  GBP: { rate: 0.79,   symbol: '£',  suffix: false },
};
function formatPrice(usd, currency = 'USD') {
  if (!Number.isFinite(usd)) return '—';
  const fx = FX[currency] || FX.USD;
  const local = Math.round(usd * fx.rate);
  return fx.suffix ? `${local} ${fx.symbol}` : `${fx.symbol}${local}`;
}

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
    const prefs = parsed.prefs && typeof parsed.prefs === 'object' ? {
      minDevices:   !!parsed.prefs.minDevices,
      centralPower: !!parsed.prefs.centralPower,
    } : { minDevices: false, centralPower: false };
    const meta = parsed.meta && typeof parsed.meta === 'object' ? {
      client: typeof parsed.meta.client === 'string' ? parsed.meta.client : '',
      venue:  typeof parsed.meta.venue  === 'string' ? parsed.meta.venue  : '',
      date:   typeof parsed.meta.date   === 'string' ? parsed.meta.date   : '',
    } : { client: '', venue: '', date: '' };
    const currency = FX[parsed.currency] ? parsed.currency : 'USD';
    const iterations = Math.max(1, Math.min(999, Number(parsed.iterations) || 1));
    return { version: 1, strips, name: typeof parsed.name === 'string' ? parsed.name : '', prefs, meta, currency, iterations };
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
    runs: 2,
    quantity: 1,
    injection: 'oneEnd',
    brightness: 255,
    colorMode: 'white',
    dataRunMeters: 0,
    maxDropPercent: 20,
    notes: '',
  };
}

function renderStrip(strip) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = strip.id;

  // Make radio-group names unique per strip so selections don't bleed across cards
  node.querySelectorAll('input[type="radio"]').forEach(r => {
    r.name = `${r.name}-${strip.id}`;
  });

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
  const densityRadio = node.querySelector(`input[name="density-${strip.id}"][value="${strip.density}"]`);
  if (densityRadio) densityRadio.checked = true;
  node.querySelector('input[name="length"]').value = strip.length;
  node.querySelector('select[name="lengthMode"]').value = strip.lengthMode;
  node.querySelector('input[name="doubled"]').checked = strip.runs === 2;
  node.querySelector('input[name="bothEnds"]').checked = strip.injection === 'bothEnds';
  node.querySelector('input[name="quantity"]').value = strip.quantity || 1;
  node.querySelector('input[name="notes"]').value = strip.notes || '';
  const brightnessRadio = node.querySelector(`input[name="brightness-${strip.id}"][value="${strip.brightness}"]`);
  if (brightnessRadio) brightnessRadio.checked = true;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;

  return node;
}

const stored = loadFromStorage();
const project = stored ?? {
  version: 1, name: '',
  meta: { client: '', venue: '', date: '' },
  currency: 'USD',
  iterations: 1,
  prefs: { minDevices: false, centralPower: false },
  strips: [makeDefaultStrip()],
};
if (!project.prefs) project.prefs = { minDevices: false, centralPower: false };
if (!project.meta) project.meta = { client: '', venue: '', date: '' };
if (!project.currency) project.currency = 'USD';
if (!project.iterations) project.iterations = 1;

const projectNameInput = document.getElementById('project-name');
projectNameInput.value = project.name || '';
projectNameInput.addEventListener('input', () => {
  project.name = projectNameInput.value;
  scheduleSave();
});

const metaInputs = {
  client:   document.getElementById('project-client'),
  venue:    document.getElementById('project-venue'),
  date:     document.getElementById('project-date'),
};
const currencySelect = document.getElementById('project-currency');
for (const [key, el] of Object.entries(metaInputs)) {
  el.value = project.meta[key] || '';
  el.addEventListener('input', () => {
    project.meta[key] = el.value;
    scheduleSave();
  });
}
currencySelect.value = project.currency;
currencySelect.addEventListener('change', () => {
  project.currency = currencySelect.value;
  paintTotals();
  scheduleSave();
});

const iterationsInput = document.getElementById('project-iterations');
iterationsInput.value = project.iterations || 1;
iterationsInput.addEventListener('input', () => {
  project.iterations = Math.max(1, Math.min(999, Number(iterationsInput.value) || 1));
  paintTotals();
  scheduleSave();
});

const prefMinDevices   = document.getElementById('pref-min-devices');
const prefCentralPower = document.getElementById('pref-central-power');
prefMinDevices.checked   = !!project.prefs.minDevices;
prefCentralPower.checked = !!project.prefs.centralPower;
const onPrefChange = () => {
  project.prefs.minDevices   = prefMinDevices.checked;
  project.prefs.centralPower = prefCentralPower.checked;
  paintTotals();
  scheduleSave();
};
prefMinDevices.addEventListener('change', onPrefChange);
prefCentralPower.addEventListener('change', onPrefChange);

function render() {
  stripsList.replaceChildren(...project.strips.map(renderStrip));
}

function readStripFromCard(card) {
  return {
    id: card.dataset.id,
    name: '',
    chipId: card.querySelector('select[name="chipId"]').value,
    density: Number(card.querySelector('input[name^="density-"]:checked')?.value ?? 96),
    lengthMode: card.querySelector('select[name="lengthMode"]').value,
    length: Number(card.querySelector('input[name="length"]').value),
    runs: card.querySelector('input[name="doubled"]').checked ? 2 : 1,
    injection: card.querySelector('input[name="bothEnds"]').checked ? 'bothEnds' : 'oneEnd',
    quantity: Math.max(1, Number(card.querySelector('input[name="quantity"]').value) || 1),
    notes: card.querySelector('input[name="notes"]').value,
    brightness: Number(card.querySelector('input[name^="brightness-"]:checked')?.value ?? 255),
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
  // Size wire/fuse for the user's actual planned feed count, not the recommendation.
  const plannedFeedCount = strip.injection === 'bothEnds' ? 2 : 1;
  const perFeedCurrent = inj.current_A / plannedFeedCount;
  const awg  = recommendAWG(perFeedCurrent);
  const fuse = recommendFuse(perFeedCurrent);
  const data = dataRecommendation(strip, chip);

  const q = strip.quantity || 1;
  const eachNote = q > 1 ? ` (per strip, × ${q})` : '';
  const $ = name => card.querySelector(`output[name="${name}"]`);
  $('pixels').value   = intOrDash(draw.pixels * q);
  $('ledCount').value = intOrDash(draw.ledCount * q);
  $('current').value  = fmt(draw.current_A * q);
  const actualPower = draw.power_W * q;
  $('power').value = Number.isFinite(actualPower) ? `~${Math.ceil(actualPower)}` : '—';
  card.querySelector('[data-info-power]').title =
    Number.isFinite(actualPower) ? `Actual: ${fmt(actualPower, 2)} W` : '';

  // FPS — per single output (one strip's pixel count)
  // Quinled-recommended target: 42 FPS. Below 30 = visible flicker, below 20 = severe.
  const fps = computeFPS(draw.pixels, chip);
  const fpsBelowGoal = fps < 42;
  const fpsLow = fps < 30;
  $('fps').value = Number.isFinite(fps) ? `${fpsBelowGoal ? '⚠ ' : ''}${fps}` : '∞';
  card.querySelector('[data-info-fps]').title = Number.isFinite(fps)
    ? `${fps} FPS at ${draw.pixels} pixels per output (~${chip.protocol.startsWith('2-wire') ? 4 : 30} µs/pixel)\nQuinled-recommended target: 42 FPS. Flicker becomes visible below ~30 FPS, severe below 20.`
    : `${chip.protocol} — effectively no FPS limit at typical pixel counts`;

  // PSU — snap to chip-voltage-appropriate standard sizes
  const psuTarget = actualPower / 0.8;     // 25% headroom (balanced)
  const combo = recommendPSUs(psuTarget, chip.voltage);
  $('psu').value = combo.length ? formatPSUCombo(combo).replace(/ W$/, '') : '—';
  const totalCombo = totalPSUWatts(combo);
  let psuTip = Number.isFinite(actualPower) && combo.length
    ? `Power draw: ${fmt(actualPower, 1)} W\nTarget (25% headroom): ${Math.ceil(psuTarget)} W\nBuy: ${formatPSUCombo(combo)} = ${totalCombo} W (at ${chip.voltage}V)`
    : '';
  if (strip.injection === 'bothEnds' && Number.isFinite(actualPower)) {
    const halfCombo = recommendPSUs(psuTarget / 2, chip.voltage);
    const halfTotal = totalPSUWatts(halfCombo);
    psuTip += `\n\nOr split: 2 × (${formatPSUCombo(halfCombo)}) at each injection end = ${halfTotal * 2} W total — eliminates long heavy power wiring`;
  }
  card.querySelector('[data-info-psu]').title = psuTip;

  // Drop — show planned drop (oneEnd or bothEnds) with ✓/⚠ indicator
  const plannedDropPct = (inj.vDrop_planned_V / chip.voltage) * 100;
  const oneFeedDropPct = (inj.vDrop_singleFeed_V / chip.voltage) * 100;
  const bothEndsDropPct = (inj.vDrop_bothEnds_V / chip.voltage) * 100;
  const tolerancePct = strip.maxDropPercent;
  const planLabel = inj.planned === 'bothEnds' ? 'both ends' : 'one end';
  const indicator = inj.planned_OK ? '✓' : '⚠';
  $('dropShort').value = Number.isFinite(plannedDropPct) ? `${indicator} ${fmt(plannedDropPct)}%` : '—';

  let dropTip;
  if (!Number.isFinite(plannedDropPct)) {
    dropTip = '—';
  } else if (inj.planned_OK) {
    dropTip = `${fmt(plannedDropPct)}% drop with ${planLabel} feed — within ${tolerancePct}% tolerance ✓`;
  } else {
    const onePct = `${fmt(oneFeedDropPct)}%`;
    const bothPct = `${fmt(bothEndsDropPct)}%`;
    dropTip = `${fmt(plannedDropPct)}% drop with ${planLabel} — exceeds ${tolerancePct}% tolerance ⚠\nOne end: ${onePct} · Both ends: ${bothPct}\nFor ≤${tolerancePct}%: ${inj.nFeeds} feeds every ${fmt(inj.injectEvery_m)} m`;
  }
  dropTip += eachNote;
  card.querySelector('[data-info-drop]').title = dropTip;

  // Wire — show min AWG inline; tooltip with all three tiers + mm²
  const wireFmt = t => `${t.awg} AWG (${fmt(t.mm2)} mm²)${t.overCapacity ? ' — over capacity!' : ''}`;
  $('wireShort').value = wireFmt(awg.min);
  card.querySelector('[data-info-wire]').title =
    `Min:      ${wireFmt(awg.min)}\nBalanced: ${wireFmt(awg.balanced)}\nSolid:    ${wireFmt(awg.solid)}` + eachNote;

  // Fuse — show min inline; tooltip with all three tiers
  $('fuseShort').value = fmt(fuse.min);
  card.querySelector('[data-info-fuse]').title =
    `Min:      ${fmt(fuse.min)} A\nBalanced: ${fmt(fuse.balanced)} A\nSolid:    ${fmt(fuse.solid)} A` + eachNote;

  // Data — short label + tooltip
  const shortLabel = chip.protocol + (data.dataRunWarning ? ' ⚠' : '');
  const dataTip = [
    `Protocol: ${chip.protocol}`,
    `Level shifter: ${data.levelShifter}` + (data.note ? ` (${data.note})` : ''),
    `Series resistor: ${data.resistor}`,
    data.dataRunWarning ? `⚠ data wire > 3 m — keep it short or buffer the signal` : '',
  ].filter(Boolean).join('\n');
  $('dataShort').value = shortLabel;
  card.querySelector('[data-info]').title = dataTip;

  // Overall strip status — green if planned drop is within tolerance, wire isn't
  // over capacity, AND FPS isn't critically low.
  card.dataset.status = inj.planned_OK && !awg.balanced.overCapacity && !fpsLow ? 'ok' : 'warn';
}

function paintTotals() {
  const totals = computeProjectTotals(project.strips, getChip);
  const iter = Math.max(1, project.iterations || 1);
  const iterSuffix = iter > 1 ? ` × ${iter}` : '';

  document.querySelector('output[name="totalPower"]').value   = Number.isFinite(totals.totalPower_W)
    ? `~${Math.ceil(totals.totalPower_W * iter)}${iterSuffix && ` (${Math.ceil(totals.totalPower_W)}${iterSuffix})`}`
    : '—';
  document.querySelector('output[name="totalCurrent"]').value = fmt(totals.totalCurrent_A * iter) + (iter > 1 ? iterSuffix : '');
  document.querySelector('output[name="totalPixels"]').value  = intOrDash(totals.totalPixels * iter);
  document.querySelector('output[name="totalLeds"]').value    = intOrDash(totals.totalLeds * iter);

  // AC draw at the wall: account for ~88% PSU efficiency at 230V single-phase.
  // Per-iteration value (each install pulls from its own circuit).
  const PSU_EFF = 0.88;
  const acDraw_W = totals.totalPower_W / PSU_EFF;
  const acDraw_A = acDraw_W / 230;
  let acIndicator = '';
  if (acDraw_A > 12) acIndicator = '⚠ ';
  document.querySelector('output[name="acDraw"]').value =
    Number.isFinite(acDraw_A) ? `${acIndicator}${fmt(acDraw_A)}` : '—';
  document.querySelector('[data-info-ac]').title = Number.isFinite(acDraw_A) ? [
    `~${Math.ceil(acDraw_W)} W from the wall (${Math.round(PSU_EFF * 100)}% PSU efficiency)`,
    `${fmt(acDraw_A)} A @ 230V single-phase`,
    acDraw_A > 24 ? '⚠ exceeds 16A circuit — split across two circuits or use 32A' :
      acDraw_A > 12 ? '⚠ near 16A circuit limit — comfortable on a 16A circuit; split if uncertain' :
      acDraw_A > 7  ? 'Fits a 10A circuit with margin' :
      'Comfortably fits any standard circuit',
  ].join('\n') : '';

  const setup = recommendSetup(project.strips, totals, CONTROLLERS, getChip, recommendPSUs, project.prefs);
  const $rec = name => document.querySelector(`output[name="${name}"]`);
  const bomBody = document.querySelector('#bom tbody');

  if (!setup || totals.totalPixels === 0) {
    bomBody.replaceChildren();
    $rec('bomTotal').value = '—';
    $rec('recAlts').value = '—';
    $rec('recNote').textContent = totals.totalPixels === 0 ? 'Add at least one strip.' : '';
    return;
  }

  // Build BOM rows
  const rows = [];
  const fmtUSD = n => formatPrice(n, project.currency);

  // Controller — qty × iterations
  if (setup.brain) {
    const usedOuts = setup.brain.outputsUsed ?? totals.outputCount;
    const chained = usedOuts < totals.outputCount;
    const chainNote = chained ? ` (chained from ${totals.outputCount} strips)` : '';
    const totalQty = setup.brain.units * iter;
    rows.push({
      item: setup.brain.name,
      notes: `${setup.brain.outputs} outputs each, ${usedOuts} used${chainNote}${iter > 1 ? ` × ${iter} iterations` : ''}`,
      qty: totalQty,
      unit: setup.brain.priceUSD,
      subtotal: setup.brain.priceUSD * totalQty,
    });
  }

  // Power board / distribution
  const dist = setup.distribution;
  if (dist?.kind === 'paired' && dist.board) {
    const totalQty = dist.count * iter;
    rows.push({
      item: dist.board.name,
      notes: `paired with brain — ${dist.board.amps} A, ${dist.board.ports} fused ports${iter > 1 ? ` × ${iter} iterations` : ''}`,
      qty: totalQty,
      unit: dist.board.priceUSD,
      subtotal: dist.board.priceUSD * totalQty,
    });
  } else if (dist?.kind === 'central' && dist.board) {
    const totalQty = 1 * iter;
    rows.push({
      item: `${dist.board.name} (standalone PDU)`,
      notes: `${dist.board.amps} A, ${dist.board.ports} fused ports${iter > 1 ? ` × ${iter} iterations` : ''}`,
      qty: totalQty,
      unit: dist.board.priceUSD,
      subtotal: dist.board.priceUSD * totalQty,
    });
  }

  // PSUs — one row per size, qty × iterations
  for (const { size, count } of setup.psuCombo) {
    const unit = priceForPSU(size, setup.voltage);
    const totalQty = count * iter;
    rows.push({
      item: `${size} W ${setup.voltage}V PSU`,
      notes: (setup.voltage <= 24 ? 'Kingneonlux IP67 (waterproof)' : '') + (iter > 1 ? ` × ${iter} iterations` : ''),
      qty: totalQty,
      unit,
      subtotal: unit != null ? unit * totalQty : null,
    });
  }

  // Optional split-PSU alternative note when bothEnds is in use
  const anyBothEnds = project.strips.some(s => s.injection === 'bothEnds');
  if (anyBothEnds && setup.psuCombo.length) {
    const halfCombo = recommendPSUs(setup.psuTarget / 2, setup.voltage);
    rows.push({
      item: '— or split for both-ends injection —',
      notes: `${formatPSUCombo(halfCombo)} at each injection end (no long heavy wiring)`,
      qty: '',
      unit: '',
      subtotal: '',
      muted: true,
    });
  }

  // Render rows
  bomBody.replaceChildren(...rows.map(r => {
    const tr = document.createElement('tr');
    if (r.muted) tr.classList.add('muted');
    tr.innerHTML = `
      <td>${r.item}</td>
      <td>${r.notes || ''}</td>
      <td class="num">${r.qty === '' ? '' : r.qty}</td>
      <td class="num">${r.unit === '' ? '' : (r.unit != null ? fmtUSD(r.unit) : '—')}</td>
      <td class="num">${r.subtotal === '' ? '' : (r.subtotal != null ? fmtUSD(r.subtotal) : '—')}</td>
    `;
    return tr;
  }));

  const grandTotal = rows.reduce((sum, r) => sum + (typeof r.subtotal === 'number' ? r.subtotal : 0), 0);
  $rec('bomTotal').value = grandTotal > 0 ? `${fmtUSD(grandTotal)} (list, ex. shipping)` : '—';

  // Alternatives — other viable Quinled controllers (chain-aware output count)
  const outputsByCtrl = c => outputsForController(project.strips, c, getChip).outputs;
  const alts = recommendControllers(totals.totalPixels, 4, outputsByCtrl)
    .filter(c => c.id !== setup.brain?.id)
    .map(c => `${c.name}${c.unitsNeeded > 1 ? ` × ${c.unitsNeeded}` : ''}`)
    .slice(0, 5)
    .join(' · ');
  $rec('recAlts').value = alts || 'none';

  // Premium alternative — PixLite + Mean Well HLG IP67
  const premium = recommendPremiumSetup(project.strips, totals, getChip);
  if (premium && premium.brain) {
    const brainStr = `${premium.brain.units > 1 ? `${premium.brain.units} × ` : ''}${premium.brain.name}`;
    const psuStr = formatMeanWellCombo(premium.psuCombo);
    $rec('recPremium').value = `${brainStr} + ${psuStr} ≈ ${formatPrice(premium.totalCost, project.currency)}`;
  } else {
    $rec('recPremium').value = 'n/a (project too large for PixLite within 4 units)';
  }

  $rec('recNote').textContent = totals.mixedVoltage
    ? '⚠ Mixed voltages across strips — recommendation assumes a single supply rail; you may need separate PSU rails per voltage.'
    : '';

  // Output assignment table — chain-aware wiring map
  const outBody = document.querySelector('#output-table tbody');
  const brains = setup.brain ? assignOutputs(project.strips, setup.brain, getChip) : [];
  if (brains.length === 0) {
    outBody.replaceChildren();
  } else {
    const trs = [];
    brains.forEach((outs, brainIdx) => {
      outs.forEach((out, outIdx) => {
        const stripList = out.strips.map(s => `Strip ${s.stripIdx}.${s.copy}`).join(' + ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${outIdx === 0 ? `${setup.brain.name} #${brainIdx + 1}` : ''}</td>
          <td>Out ${outIdx + 1}</td>
          <td>${stripList}${out.strips.length > 1 ? ' (chained)' : ''}</td>
          <td class="num">${out.totalPixels}</td>
        `;
        trs.push(tr);
      });
    });
    outBody.replaceChildren(...trs);
  }
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

document.getElementById('print').addEventListener('click', () => window.print());

document.getElementById('export-json').addEventListener('click', () => {
  const filename = `${(project.name || 'calculed').toLowerCase().replace(/\s+/g, '-')}.json`;
  downloadFile(filename, JSON.stringify(project, null, 2), 'application/json');
});

document.getElementById('export-csv').addEventListener('click', () => {
  const filename = `${(project.name || 'calculed').toLowerCase().replace(/\s+/g, '-')}.csv`;
  downloadFile(filename, projectAsCSV(), 'text/csv');
});

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(...cells) { return cells.map(csvCell).join(',') + '\n'; }

function projectAsCSV() {
  const totals = computeProjectTotals(project.strips, getChip);
  const setup = recommendSetup(project.strips, totals, CONTROLLERS, getChip, recommendPSUs, project.prefs);
  let out = '';

  // Header
  out += csvRow('# Project', project.name || '');
  if (project.meta?.client) out += csvRow('# Client', project.meta.client);
  if (project.meta?.venue)  out += csvRow('# Venue',  project.meta.venue);
  if (project.meta?.date)   out += csvRow('# Date',   project.meta.date);
  if ((project.iterations || 1) > 1) out += csvRow('# Iterations', project.iterations);
  out += '\n';

  // Strips
  out += '# Strips\n';
  out += csvRow('Idx', 'Chip', 'Voltage', 'Density', 'Length', 'Unit', 'Doubled', 'BothEnds', 'Brightness', 'Color', 'Qty', 'Pixels/strip', 'LEDs/strip', 'Current/strip (A)', 'Power/strip (W)', 'FPS', 'Drop %', 'OK', 'Notes');
  project.strips.forEach((s, i) => {
    const chip = getChip(s.chipId);
    if (!chip) return;
    const draw = computeStripDraw(s, chip);
    const inj  = computeInjection(s, chip);
    out += csvRow(
      i + 1,
      chip.name,
      chip.voltage,
      s.density,
      s.length,
      s.lengthMode === 'meters' ? 'm' : 'px',
      s.runs === 2 ? 'Y' : '',
      s.injection === 'bothEnds' ? 'Y' : '',
      `${Math.round(s.brightness/255*100)}%`,
      s.colorMode,
      s.quantity || 1,
      draw.pixels,
      draw.ledCount,
      draw.current_A.toFixed(2),
      draw.power_W.toFixed(0),
      computeFPS(draw.pixels, chip),
      (inj.vDrop_planned_V / chip.voltage * 100).toFixed(1),
      inj.planned_OK ? 'Y' : '',
      s.notes || '',
    );
  });
  out += '\n';

  // Totals
  out += '# Totals\n';
  out += csvRow('Total power (W)', Math.ceil(totals.totalPower_W));
  out += csvRow('Total current (A)', totals.totalCurrent_A.toFixed(1));
  out += csvRow('Total pixels', totals.totalPixels);
  out += csvRow('Total LEDs', totals.totalLeds);
  out += csvRow('Voltage', totals.voltage);
  out += '\n';

  // BOM — quantities multiplied by iterations
  if (setup) {
    const iter = Math.max(1, project.iterations || 1);
    out += '# BOM\n';
    out += csvRow('Item', 'Notes', 'Qty', `Unit (${project.currency})`, `Subtotal (${project.currency})`);
    let total = 0;
    const fxRate = FX[project.currency]?.rate || 1;
    if (setup.brain) {
      const fx = (setup.brain.priceUSD || 0) * fxRate;
      const qty = setup.brain.units * iter;
      const sub = fx * qty;
      total += sub;
      out += csvRow(setup.brain.name, `${setup.brain.outputs} outputs each, ${setup.brain.outputsUsed} used`, qty, fx.toFixed(0), sub.toFixed(0));
    }
    const dist = setup.distribution;
    if (dist?.kind === 'paired' && dist.board) {
      const fx = (dist.board.priceUSD || 0) * fxRate;
      const qty = dist.count * iter;
      const sub = fx * qty;
      total += sub;
      out += csvRow(dist.board.name, `paired, ${dist.board.amps} A, ${dist.board.ports} ports`, qty, fx.toFixed(0), sub.toFixed(0));
    } else if (dist?.kind === 'central' && dist.board) {
      const fx = (dist.board.priceUSD || 0) * fxRate;
      const qty = 1 * iter;
      const sub = fx * qty;
      total += sub;
      out += csvRow(`${dist.board.name} (PDU)`, `${dist.board.amps} A, ${dist.board.ports} ports`, qty, fx.toFixed(0), sub.toFixed(0));
    }
    for (const { size, count } of setup.psuCombo) {
      const usd = priceForPSU(size, setup.voltage) || 0;
      const fx = usd * fxRate;
      const qty = count * iter;
      const sub = fx * qty;
      total += sub;
      out += csvRow(`${size} W ${setup.voltage}V PSU`, 'Kingneonlux IP67', qty, fx.toFixed(0), sub.toFixed(0));
    }
    out += csvRow('TOTAL', '', '', '', total.toFixed(0));
  }

  return out;
}

document.getElementById('copy-prompt').addEventListener('click', async () => {
  const text = projectAsPrompt();
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-prompt');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  } catch {
    // Fallback: open a textarea so user can copy manually
    prompt('Copy this:', text);
  }
});

function projectAsPrompt() {
  const totals = computeProjectTotals(project.strips, getChip);
  const setup = recommendSetup(project.strips, totals, CONTROLLERS, getChip, recommendPSUs);
  const lines = [];
  lines.push(`# WLED install plan: ${project.name || 'untitled'}`);
  const metaBits = [
    project.meta?.client && `Client: ${project.meta.client}`,
    project.meta?.venue  && `Venue: ${project.meta.venue}`,
    project.meta?.date   && `Date: ${project.meta.date}`,
  ].filter(Boolean);
  if (metaBits.length) lines.push(metaBits.join(' · '));
  if ((project.iterations || 1) > 1) lines.push(`Iterations: × ${project.iterations}`);
  lines.push('');
  lines.push('## Strips');
  for (const s of project.strips) {
    const chip = getChip(s.chipId);
    if (!chip) continue;
    const draw = computeStripDraw(s, chip);
    const inj  = computeInjection(s, chip);
    const q = s.quantity || 1;
    const planLabel = s.injection === 'bothEnds' ? 'feed both ends' : 'feed one end';
    lines.push(`- **Strip × ${q}**: ${chip.name} (${chip.voltage}V), ${s.density}/m, ${s.length}${s.lengthMode === 'meters' ? ' m' : ' px'}${s.runs === 2 ? ', doubled' : ''}, ${planLabel}, brightness ${Math.round(s.brightness/255*100)}% ${s.colorMode}`);
    lines.push(`  - ${draw.pixels} pixels, ${draw.ledCount} LEDs, ${draw.current_A.toFixed(2)} A, ${draw.power_W.toFixed(0)} W per strip`);
    lines.push(`  - drop ${(inj.vDrop_planned_V/chip.voltage*100).toFixed(1)}% (${inj.planned_OK ? 'OK' : 'OVER'}), ${computeFPS(draw.pixels, chip)} FPS`);
    if (s.notes) lines.push(`  - Notes: ${s.notes}`);
  }
  lines.push('');
  lines.push('## Project totals');
  lines.push(`- ${totals.totalPixels} pixels · ${totals.totalLeds} LEDs · ${totals.totalCurrent_A.toFixed(1)} A · ${Math.ceil(totals.totalPower_W)} W`);
  lines.push(`- ${totals.outputCount} outputs needed · ${totals.voltage}V${totals.mixedVoltage ? ' (mixed!)' : ''}`);
  lines.push('');
  if (setup) {
    lines.push('## Calculator recommendation');
    if (setup.brain) {
      const usedOuts = setup.brain.outputsUsed ?? totals.outputCount;
      const chained = usedOuts < totals.outputCount;
      const chainNote = chained ? ` (chained ${totals.outputCount} strips into ${usedOuts} outputs)` : '';
      lines.push(`- Controller: ${setup.brain.name}${setup.brain.units > 1 ? ` × ${setup.brain.units}` : ''} — ${setup.brain.outputs} outputs each, ${usedOuts} used${chainNote}`);
    }
    const dist = setup.distribution;
    if (dist?.kind === 'paired' && dist.board) {
      lines.push(`- Power board: ${dist.board.name} × ${dist.count} (${dist.board.amps} A, ${dist.board.ports} fused ports — paired with brain)`);
    } else if (dist?.kind === 'central' && dist.board) {
      lines.push(`- Power distribution: ${dist.board.name} standalone (${dist.board.amps} A, ${dist.board.ports} fused ports) — or 1 PSU per brain`);
    } else if (dist?.kind === 'builtin') {
      lines.push(`- Power distribution: built-in to controller, connect PSU directly`);
    }
    if (setup.psuCombo.length) lines.push(`- PSUs: ${formatPSUCombo(setup.psuCombo)} (${setup.voltage}V)`);

    // Cost rollup
    const psuCost = totalPSUCost(setup.psuCombo, setup.voltage);
    const totalCost = (setup.cost?.controllerSubtotal ?? 0) + psuCost.total;
    if (totalCost > 0) lines.push(`- Estimated cost: ${formatPrice(totalCost, project.currency)} (list, ex. shipping)`);

    // Alternatives — other viable controllers, chain-aware
    const outputsByCtrl = c => outputsForController(project.strips, c, getChip).outputs;
    const alts = recommendControllers(totals.totalPixels, 4, outputsByCtrl)
      .filter(c => c.id !== setup.brain?.id)
      .map(c => `${c.name}${c.unitsNeeded > 1 ? ` × ${c.unitsNeeded}` : ''}`)
      .join(', ');
    if (alts) lines.push(`- Alternatives: ${alts}`);
  }
  lines.push('');
  lines.push('Please sanity-check this setup and suggest any optimisations or things I might be missing.');
  return lines.join('\n');
}
