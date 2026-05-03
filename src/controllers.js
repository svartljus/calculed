// Per-output pixel limits are practical WLED / firmware-stable limits.
// `totalMax` (when set) caps the brain's effective total — e.g., Dig-Octa's
// per-output is high but WLED's total addressable cap is ~2000 LEDs.
// Sources verified 2026-05: quinled.info specifications pages, advateklighting.com pixlite-product-comparison.
export const CONTROLLERS = [
  { id: 'diguno',     name: 'DigUno',           outputs: 2,  perOutputMax: 800,  voltages: [5, 12] },
  { id: 'digquad',    name: 'DigQuad',          outputs: 4,  perOutputMax: 800,  voltages: [5, 12, 24] },
  { id: 'digocta',    name: 'Dig-Octa Brain',   outputs: 8,  perOutputMax: 600,  totalMax: 2000,  voltages: [5, 12, 24] },
  { id: 'pixlite-4',  name: 'PixLite A4-S Mk3', outputs: 4,  perOutputMax: 1020, totalMax: 4080,  voltages: [5, 12, 24] },
  { id: 'pixlite-16', name: 'PixLite E16-S Mk3',outputs: 16, perOutputMax: 1020, totalMax: 16320, voltages: [5, 12, 24] },
];

const capacityOf = c => Math.min(c.outputs * c.perOutputMax, c.totalMax ?? Infinity);

// Returns viable controller options, including multi-unit configurations
// up to `maxUnits` units of the same controller.
// When `outputsByController` is provided (a fn or map keyed by controller id),
// the algorithm uses chain-aware output counts instead of treating one strip = one output.
export function recommendControllers(totalPixels, maxUnits = 3, outputsByController = null) {
  if (totalPixels <= 0) {
    return CONTROLLERS.map(c => ({ ...c, capacity: capacityOf(c), unitsNeeded: 1, fits: true }));
  }
  return CONTROLLERS
    .map(c => {
      const capacity = capacityOf(c);
      const outputs = outputsByController
        ? (typeof outputsByController === 'function' ? outputsByController(c) : outputsByController[c.id])
        : null;
      const unitsByPx = Math.ceil(totalPixels / capacity);
      const unitsByOuts = outputs ? Math.ceil(outputs / c.outputs) : 1;
      const unitsNeeded = Math.max(unitsByPx, unitsByOuts);
      return { ...c, capacity, unitsNeeded, outputsUsed: outputs, fits: unitsNeeded === 1 };
    })
    .filter(c => c.unitsNeeded <= maxUnits);
}
