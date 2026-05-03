import { computePixels } from './calc.js';

// QuinLED-Dig-Octa powerboards. Source: quinled.info/quinled-boards/
const POWERBOARDS = [
  { id: 'power5',   name: 'Power-5',   amps: 50,  ports: 12, voltages: [5, 12, 24] },
  { id: 'power7',   name: 'Power-7',   amps: 50,  ports: 16, voltages: [5, 12, 24] },
  { id: 'power5hv', name: 'Power-5HV', amps: 30,  ports: 12, voltages: [24, 48] },
  { id: 'power7hc', name: 'Power-7HC', amps: 100, ports: 16, voltages: [5, 12, 24] },
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

function pickBrain(controllers, strips, totalPixels, getChip) {
  // Smallest single-unit controller that fits both outputs AND pixel cap
  for (const c of controllers) {
    const { outputs, chainsTotal } = outputsForController(strips, c, getChip);
    if (c.outputs >= outputs && capacityOf(c) >= totalPixels) {
      return { ...c, units: 1, outputsUsed: outputs, chainsTotal };
    }
  }
  // Multi-unit: smallest controller where we can split across N units (≤ 4)
  for (const c of controllers) {
    const { outputs, chainsTotal } = outputsForController(strips, c, getChip);
    const cap = capacityOf(c);
    const units = Math.max(
      Math.ceil(outputs / c.outputs),
      Math.ceil(totalPixels / cap),
    );
    if (units <= 4) return { ...c, units, outputsUsed: outputs, chainsTotal };
  }
  return null;
}

function pickPowerboard(currentPerBrain_A, voltage) {
  const compatible = POWERBOARDS.filter(p => p.voltages.includes(voltage));
  if (!compatible.length) return null;
  return compatible.find(p => p.amps >= currentPerBrain_A) ?? compatible.at(-1);
}

// Returns a complete project setup recommendation: brain + powerboard + PSU combo.
// Caller passes both the aggregated totals AND the raw strips array (needed for
// chain-aware output counting per candidate controller).
export function recommendSetup(strips, totals, controllers, getChip, recommendPSUs) {
  if (!totals.totalPixels || !totals.outputCount) return null;

  const brain = pickBrain(controllers, strips, totals.totalPixels, getChip);
  const needsPowerboard = brain?.id === 'digocta';
  const currentPerBrain = totals.totalCurrent_A / (brain?.units || 1);
  const powerboard = needsPowerboard ? pickPowerboard(currentPerBrain, totals.voltage) : null;
  const powerboardCount = powerboard ? (brain.units || 1) : 0;

  const psuTarget = totals.totalPower_W / 0.8;
  const psuCombo = recommendPSUs(psuTarget, totals.voltage);

  return {
    brain,
    powerboard,
    powerboardCount,
    psuCombo,
    psuTarget,
    voltage: totals.voltage,
    mixedVoltage: totals.mixedVoltage,
    needsPowerboard,
  };
}
