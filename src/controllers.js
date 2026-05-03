// Per-output pixel limits are practical WLED / firmware-stable limits,
// not theoretical maxes. Sources: quinled.info build pages, Advatek datasheets.
export const CONTROLLERS = [
  { id: 'diguno',     name: 'DigUno',         outputs: 1,  perOutputMax: 800,  voltages: [5, 12] },
  { id: 'digquad',    name: 'DigQuad',        outputs: 4,  perOutputMax: 800,  voltages: [5, 12] },
  { id: 'digocta',    name: 'DigOcta',        outputs: 8,  perOutputMax: 800,  voltages: [5, 12] },
  { id: 'pixlite-4',  name: 'PixLite Mk3 4',  outputs: 4,  perOutputMax: 1020, voltages: [5, 12, 24] },
  { id: 'pixlite-16', name: 'PixLite Mk3 16', outputs: 16, perOutputMax: 1020, voltages: [5, 12, 24] },
  { id: 'pixlite-lr', name: 'PixLite Mk3 LR', outputs: 16, perOutputMax: 1020, voltages: [5, 12, 24] },
];

// Returns controllers with capacity ≥ total pixels, in order of smallest first.
// If nothing fits, returns the largest as a "needs splitting" hint.
export function recommendControllers(totalPixels) {
  const annotated = CONTROLLERS.map(c => ({
    ...c,
    capacity: c.outputs * c.perOutputMax,
    fits: totalPixels <= c.outputs * c.perOutputMax,
  }));
  const fitting = annotated.filter(c => c.fits);
  return fitting.length ? fitting : [annotated.at(-1)];
}
