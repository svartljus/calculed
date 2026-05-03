// QuinLED-Dig-Octa powerboards. Source: quinled.info/quinled-boards/
const POWERBOARDS = [
  { id: 'power5',   name: 'Power-5',   amps: 50,  ports: 12, voltages: [5, 12, 24] },
  { id: 'power7',   name: 'Power-7',   amps: 50,  ports: 16, voltages: [5, 12, 24] },
  { id: 'power5hv', name: 'Power-5HV', amps: 30,  ports: 12, voltages: [24, 48] },
  { id: 'power7hc', name: 'Power-7HC', amps: 100, ports: 16, voltages: [5, 12, 24] },
];

const capacityOf = c => Math.min(c.outputs * c.perOutputMax, c.totalMax ?? Infinity);

function pickBrain(controllers, outputCount, totalPixels) {
  // Smallest single-unit controller that fits both outputs AND pixel cap
  for (const c of controllers) {
    if (c.outputs >= outputCount && capacityOf(c) >= totalPixels) {
      return { ...c, units: 1 };
    }
  }
  // Multi-unit: smallest controller where we can split across N units (≤ 4)
  for (const c of controllers) {
    const cap = capacityOf(c);
    const units = Math.max(
      Math.ceil(outputCount / c.outputs),
      Math.ceil(totalPixels / cap),
    );
    if (units <= 4) return { ...c, units };
  }
  return null;
}

function pickPowerboard(currentPerBrain_A, voltage) {
  const compatible = POWERBOARDS.filter(p => p.voltages.includes(voltage));
  if (!compatible.length) return null;
  return compatible.find(p => p.amps >= currentPerBrain_A) ?? compatible.at(-1);
}

// Returns a complete project setup recommendation: brain + powerboard (when applicable) + PSU combo.
// Inputs are pre-aggregated project totals (see computeProjectTotals).
export function recommendSetup({ totalPixels, totalCurrent_A, totalPower_W, outputCount, voltage, mixedVoltage }, controllers, recommendPSUs) {
  if (!totalPixels || !outputCount) return null;

  const brain = pickBrain(controllers, outputCount, totalPixels);
  const needsPowerboard = brain?.id === 'digocta';
  const currentPerBrain = totalCurrent_A / (brain?.units || 1);
  const powerboard = needsPowerboard ? pickPowerboard(currentPerBrain, voltage) : null;
  const powerboardCount = powerboard ? (brain.units || 1) : 0;

  const psuTarget = totalPower_W / 0.8;
  const psuCombo = recommendPSUs(psuTarget, voltage);

  return {
    brain,
    powerboard,
    powerboardCount,
    psuCombo,
    psuTarget,
    voltage,
    mixedVoltage,
    needsPowerboard,
  };
}
