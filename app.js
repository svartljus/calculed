import { CHIPS, DEFAULT_CHIP_ID, getChip } from './src/chips.js';
import { computeStripDraw, computeInjection, recommendAWG, recommendFuse, dataRecommendation, computeProjectTotals, recommendPSUs, formatPSUCombo, totalPSUWatts, computeFPS, totalPSUCost, priceForPSU } from './src/calc.js';
import { CONTROLLERS, recommendControllers } from './src/controllers.js';
import { recommendSetup, outputsForController } from './src/setup.js';

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
    const prefs = parsed.prefs && typeof parsed.prefs === 'object' ? {
      minDevices:   !!parsed.prefs.minDevices,
      centralPower: !!parsed.prefs.centralPower,
    } : { minDevices: false, centralPower: false };
    return { version: 1, strips, name: typeof parsed.name === 'string' ? parsed.name : '', prefs };
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
  const brightnessRadio = node.querySelector(`input[name="brightness-${strip.id}"][value="${strip.brightness}"]`);
  if (brightnessRadio) brightnessRadio.checked = true;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;

  return node;
}

const stored = loadFromStorage();
const project = stored ?? { version: 1, name: '', prefs: { minDevices: false, centralPower: false }, strips: [makeDefaultStrip()] };
if (!project.prefs) project.prefs = { minDevices: false, centralPower: false };

const projectNameInput = document.getElementById('project-name');
projectNameInput.value = project.name || '';
projectNameInput.addEventListener('input', () => {
  project.name = projectNameInput.value;
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
  document.querySelector('output[name="totalPower"]').value   = Number.isFinite(totals.totalPower_W)
    ? `~${Math.ceil(totals.totalPower_W)}` : '—';
  document.querySelector('output[name="totalCurrent"]').value = fmt(totals.totalCurrent_A);
  document.querySelector('output[name="totalPixels"]').value  = intOrDash(totals.totalPixels);
  document.querySelector('output[name="totalLeds"]').value    = intOrDash(totals.totalLeds);

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
  const fmtUSD = n => Number.isFinite(n) ? `$${Math.round(n)}` : '—';

  // Controller
  if (setup.brain) {
    const usedOuts = setup.brain.outputsUsed ?? totals.outputCount;
    const chained = usedOuts < totals.outputCount;
    const chainNote = chained ? ` (chained from ${totals.outputCount} strips)` : '';
    rows.push({
      item: setup.brain.name,
      notes: `${setup.brain.outputs} outputs each, ${usedOuts} used${chainNote}`,
      qty: setup.brain.units,
      unit: setup.brain.priceUSD,
      subtotal: setup.brain.priceUSD * setup.brain.units,
    });
  }

  // Power board / distribution
  const dist = setup.distribution;
  if (dist?.kind === 'paired' && dist.board) {
    rows.push({
      item: dist.board.name,
      notes: `paired with brain — ${dist.board.amps} A, ${dist.board.ports} fused ports`,
      qty: dist.count,
      unit: dist.board.priceUSD,
      subtotal: dist.board.priceUSD * dist.count,
    });
  } else if (dist?.kind === 'central' && dist.board) {
    rows.push({
      item: `${dist.board.name} (standalone PDU)`,
      notes: `${dist.board.amps} A, ${dist.board.ports} fused ports`,
      qty: 1,
      unit: dist.board.priceUSD,
      subtotal: dist.board.priceUSD,
    });
  }

  // PSUs — one row per size
  for (const { size, count } of setup.psuCombo) {
    const unit = priceForPSU(size, setup.voltage);
    rows.push({
      item: `${size} W ${setup.voltage}V PSU`,
      notes: setup.voltage <= 24 ? 'Kingneonlux IP67 (waterproof)' : '',
      qty: count,
      unit,
      subtotal: unit != null ? unit * count : null,
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

  // Fuses count (project-wide) — one per feed
  const totalFeeds = project.strips.reduce((sum, s) => {
    const feedsPerStrip = s.injection === 'bothEnds' ? 2 : 1;
    return sum + (s.quantity || 1) * feedsPerStrip;
  }, 0);
  if (totalFeeds > 0) {
    rows.push({
      item: 'Inline glass fuses',
      notes: 'one per power-feed wire',
      qty: totalFeeds,
      unit: null,
      subtotal: null,
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

  // Alternatives — other viable controllers (chain-aware output count)
  const outputsByCtrl = c => outputsForController(project.strips, c, getChip).outputs;
  const alts = recommendControllers(totals.totalPixels, 4, outputsByCtrl)
    .filter(c => c.id !== setup.brain?.id)
    .map(c => `${c.name}${c.unitsNeeded > 1 ? ` × ${c.unitsNeeded}` : ''}`)
    .slice(0, 5)
    .join(' · ');
  $rec('recAlts').value = alts || 'none';

  $rec('recNote').textContent = totals.mixedVoltage
    ? '⚠ Mixed voltages across strips — recommendation assumes a single supply rail; you may need separate PSU rails per voltage.'
    : '';
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
  lines.push('');
  lines.push('## Strips');
  for (const s of project.strips) {
    const chip = getChip(s.chipId);
    if (!chip) continue;
    const draw = computeStripDraw(s, chip);
    const inj  = computeInjection(s, chip);
    const q = s.quantity || 1;
    const planLabel = s.injection === 'bothEnds' ? 'feed both ends' : 'feed one end';
    lines.push(`- **${s.name || 'unnamed'}** × ${q}: ${chip.name} (${chip.voltage}V), ${s.density}/m, ${s.length}${s.lengthMode === 'meters' ? ' m' : ' px'}${s.runs === 2 ? ', doubled' : ''}, ${planLabel}, brightness ${Math.round(s.brightness/255*100)}% ${s.colorMode}`);
    lines.push(`  - ${draw.pixels} pixels, ${draw.ledCount} LEDs, ${draw.current_A.toFixed(2)} A, ${draw.power_W.toFixed(0)} W per strip`);
    lines.push(`  - drop ${(inj.vDrop_planned_V/chip.voltage*100).toFixed(1)}% (${inj.planned_OK ? 'OK' : 'OVER'}), ${computeFPS(draw.pixels, chip)} FPS`);
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
    if (totalCost > 0) lines.push(`- Estimated cost: ~$${totalCost.toFixed(0)} (list, ex. shipping)`);

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
