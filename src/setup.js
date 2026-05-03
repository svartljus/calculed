import { computePixels, recommendMeanWellPSUs, priceForMeanWellHLG, formatMeanWellCombo } from './calc.js';

// Premium tier — PixLite Mk3 controllers, kept separate from the main catalog
// so they don't pollute the default cheap recommendation.
// Prices: Advatek RRP USD (E16-S verified 2026-05; A4-S derived from Moss LED CAD listing).
const PIXLITE_CONTROLLERS = [
  { id: 'pixlite-4',  name: 'PixLite A4-S Mk3',  outputs: 4,  perOutputMax: 1020, totalMax: 4080,  voltages: [5, 12, 24], priceUSD: 670  },
  { id: 'pixlite-16', name: 'PixLite E16-S Mk3', outputs: 16, perOutputMax: 1020, totalMax: 16320, voltages: [5, 12, 24], priceUSD: 1099 },
];

// Premium recommendation: PixLite controller + Mean Well HLG IP67 PSU(s).
export function recommendPremiumSetup(strips, totals, getChip) {
  if (!totals.totalPixels || !totals.outputCount) return null;
  const brain = pickFewestUnitsBrain(PIXLITE_CONTROLLERS, strips, totals.totalPixels, getChip);
  const psuTarget = totals.totalPower_W / 0.8;
  const psuCombo = recommendMeanWellPSUs(psuTarget);
  const psuCost = psuCombo.reduce((sum, p) => sum + (priceForMeanWellHLG(p.size) || 0) * p.count, 0);
  const brainCost = brain ? brain.priceUSD * brain.units : 0;
  return {
    brain,
    psuCombo,
    psuCost,
    brainCost,
    totalCost: brainCost + psuCost,
  };
}

// QuinLED-Dig-Octa powerboards. Source: quinled.info/quinled-boards/
// priceUSD approximate retail (Quinled shop).
const POWERBOARDS = [
  { id: 'power5',   name: 'Power-5',   amps: 50,  ports: 12, voltages: [5, 12, 24], priceUSD: 45 },
  { id: 'power7',   name: 'Power-7',   amps: 50,  ports: 16, voltages: [5, 12, 24], priceUSD: 50 },
  { id: 'power5hv', name: 'Power-5HV', amps: 30,  ports: 12, voltages: [24, 48],    priceUSD: 50 },
  { id: 'power7hc', name: 'Power-7HC', amps: 100, ports: 16, voltages: [5, 12, 24], priceUSD: 65 },
];

const capacityOf = c => Math.min(c.outputs * c.perOutputMax, c.totalMax ?? Infinity);

// Compute outputs needed across all strips for a given controller, allowing
// chaining of identical strips on one output up to the controller's per-output
// pixel cap. e.g. 315 px/strip on a 1020 px/output controller → 3 per chain.
export function outputsForController(strips, controller, getChip) {
  const cap = controller.perOutputMax;
  let outputs = 0;
  let chainsTotal = 0;     // for diagnostics
  for (const s of strips) {
    const q = s.quantity || 1;
    const chip = getChip ? getChip(s.chipId) : null;
    const px = computePixels(s);
    if (!Number.isFinite(px) || px <= 0) continue;
    if (px > cap) {
      // A single strip alone exceeds the per-output cap — can't fit on one output.
      outputs += q * Math.ceil(px / cap);
    } else {
      const chainable = Math.max(1, Math.floor(cap / px));
      outputs += Math.ceil(q / chainable);
      chainsTotal += chainable > 1 ? Math.floor(q / chainable) : 0;
    }
  }
  return { outputs, chainsTotal };
}

function tryBrain(c, strips, totalPixels, getChip) {
  const { outputs, chainsTotal } = outputsForController(strips, c, getChip);
  const cap = capacityOf(c);
  const units = Math.max(
    Math.ceil(outputs / c.outputs),
    Math.ceil(totalPixels / cap),
  );
  return { ...c, units, outputsUsed: outputs, chainsTotal };
}

// Default: pick the smallest controller that fits within `maxUnits` units.
function pickCheapestBrain(controllers, strips, totalPixels, getChip, maxUnits = 4) {
  for (const c of controllers) {
    const r = tryBrain(c, strips, totalPixels, getChip);
    if (r.units <= maxUnits) return r;
  }
  return null;
}

// "Fewer devices" mode: pick the option with the smallest unit count;
// tie-break by cheapest total.
function pickFewestUnitsBrain(controllers, strips, totalPixels, getChip) {
  let best = null;
  for (const c of controllers) {
    const r = tryBrain(c, strips, totalPixels, getChip);
    if (r.units > 4) continue;
    const cost = (r.priceUSD || 0) * r.units;
    if (!best
        || r.units < best.units
        || (r.units === best.units && cost < (best.priceUSD || 0) * best.units)) {
      best = r;
    }
  }
  return best;
}

function pickPowerboard(currentNeeded_A, voltage) {
  const compatible = POWERBOARDS.filter(p => p.voltages.includes(voltage));
  if (!compatible.length) return null;
  return compatible.find(p => p.amps >= currentNeeded_A) ?? compatible.at(-1);
}

// Power distribution / fusing layer between PSUs and the controller.
// Returns one of:
//   { kind: 'paired',  board, count }   - Dig-Octa Brain ↔ matching Power-x board (always)
//   { kind: 'central', board, count }   - centralized PDU between PSUs and brains (multi-brain or forced)
//   { kind: 'builtin' }                 - controller's onboard fusing is enough; connect PSU directly
function pickDistribution(brain, totalCurrent_A, voltage, units, forceCentral = false) {
  if (brain?.id === 'digocta') {
    // Dig-Octa stacks ~2 brains per Power-7-class powerboard (16 ports / 8 outputs/brain).
    // The Quinled "disco" example pairs 4 brains with 2 powerboards.
    const boardsNeeded = Math.ceil(units / 2);
    const board = pickPowerboard(totalCurrent_A / boardsNeeded, voltage);
    return { kind: 'paired', board, count: boardsNeeded };
  }
  if (forceCentral || units > 1) {
    const board = pickPowerboard(totalCurrent_A, voltage);
    return board ? { kind: 'central', board, count: 1 } : { kind: 'builtin' };
  }
  return { kind: 'builtin' };
}

// Returns a complete project setup recommendation: brain + powerboard + PSU combo.
// `prefs` controls topology choices:
//   prefs.minDevices    — pick fewest units (may shift to PixLite over multi-Quinled)
//   prefs.centralPower  — always include a centralized PDU even for single-brain setups
export function recommendSetup(strips, totals, controllers, getChip, recommendPSUs, prefs = {}) {
  if (!totals.totalPixels || !totals.outputCount) return null;

  const brain = prefs.minDevices
    ? pickFewestUnitsBrain(controllers, strips, totals.totalPixels, getChip)
    : pickCheapestBrain(controllers, strips, totals.totalPixels, getChip);
  const distribution = brain
    ? pickDistribution(brain, totals.totalCurrent_A, totals.voltage, brain.units, !!prefs.centralPower)
    : null;

  const psuTarget = totals.totalPower_W / 0.8;
  const psuCombo = recommendPSUs(psuTarget, totals.voltage);

  // Cost roll-up
  const brainCost = (brain?.priceUSD ?? 0) * (brain?.units ?? 0);
  const distCost = distribution?.board?.priceUSD ? distribution.board.priceUSD * (distribution.count || 1) : 0;
  const totalCost = brainCost + distCost;   // PSU cost added in caller (knows priceForPSU)

  return {
    brain,
    distribution,
    psuCombo,
    psuTarget,
    voltage: totals.voltage,
    mixedVoltage: totals.mixedVoltage,
    cost: { brain: brainCost, dist: distCost, controllerSubtotal: totalCost },
  };
}
