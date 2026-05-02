const COLOR_FACTOR = { white: 1.0, average: 0.33 };

export function effectiveMaPerLed(baseMa, brightness, colorMode) {
  const factor = COLOR_FACTOR[colorMode] ?? 1.0;
  return baseMa * (brightness / 255) * factor;
}

export function computeLedCount(strip) {
  if (strip.lengthMode === 'count') return strip.length;
  return strip.density * strip.length * strip.runs;
}

export function computeStripDraw(strip, chip) {
  const ledCount = computeLedCount(strip);
  const mA = effectiveMaPerLed(chip.mA_per_led, strip.brightness, strip.colorMode);
  const current_A = (ledCount * mA) / 1000;
  const power_W   = current_A * chip.voltage;
  return { ledCount, current_A, power_W };
}

export function computeProjectTotals(strips, getChip) {
  let totalPower_W = 0;
  let totalLeds = 0;
  for (const s of strips) {
    const chip = getChip(s.chipId);
    if (!chip) continue;
    const r = computeStripDraw(s, chip);
    totalPower_W += r.power_W;
    totalLeds   += r.ledCount;
  }
  const psuRec_W = totalPower_W / 0.8;
  return { totalPower_W, psuRec_W, totalLeds };
}

export function computeInjection(strip, chip) {
  const ledCount = computeLedCount(strip);
  const mA = effectiveMaPerLed(chip.mA_per_led, strip.brightness, strip.colorMode);
  const current_A = (ledCount * mA) / 1000;

  const electricalLength_m =
    strip.lengthMode === 'count'
      ? strip.length / strip.density
      : strip.length * strip.runs;

  const R_total       = chip.ohm_per_meter * electricalLength_m;
  const vDrop_singleFeed_V = (current_A * R_total) / 2;
  const maxDrop_V     = chip.voltage * (strip.maxDropPercent / 100);

  const nFeeds = vDrop_singleFeed_V <= maxDrop_V
    ? 1
    : Math.ceil(Math.sqrt(vDrop_singleFeed_V / maxDrop_V));

  const injectEvery_m = electricalLength_m / nFeeds;
  return { nFeeds, injectEvery_m, vDrop_singleFeed_V, maxDrop_V, electricalLength_m, current_A };
}

const AWG_TABLE = [
  { awg: 18, ampacity: 7 },
  { awg: 16, ampacity: 10 },
  { awg: 14, ampacity: 15 },
  { awg: 12, ampacity: 20 },
  { awg: 10, ampacity: 30 },
  { awg: 8,  ampacity: 40 },
];

export function recommendAWG(currentA) {
  const required = currentA * 1.25;
  const fit = AWG_TABLE.find(row => row.ampacity >= required);
  if (fit) return { awg: fit.awg, overCapacity: false };
  return { awg: AWG_TABLE.at(-1).awg, overCapacity: true };
}
