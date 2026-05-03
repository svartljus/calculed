const COLOR_FACTOR = { white: 1.0, average: 0.33 };

export function effectiveMaPerLed(baseMa, brightness, colorMode) {
  const factor = COLOR_FACTOR[colorMode] ?? 1.0;
  return baseMa * (brightness / 255) * factor;
}

// Pixels = addressable units (what WLED sees). Independent of doubled mode.
// Rounded to integer — fractional LEDs make no physical sense.
export function computePixels(strip) {
  if (strip.lengthMode === 'count') return Math.round(strip.length);
  return Math.round(strip.density * strip.length);
}

// LED count = physical LEDs. Doubled mode (runs=2) doubles the count
// because two parallel strips share the same data signal.
export function computeLedCount(strip) {
  return computePixels(strip) * (strip.runs || 1);
}

export function computeStripDraw(strip, chip) {
  const pixels = computePixels(strip);
  const ledCount = computeLedCount(strip);
  const mA = effectiveMaPerLed(chip.mA_per_led, strip.brightness, strip.colorMode);
  const current_A = (ledCount * mA) / 1000;
  const power_W   = current_A * chip.voltage;
  return { pixels, ledCount, current_A, power_W };
}

export function computeProjectTotals(strips, getChip) {
  let totalPower_W = 0;
  let totalLeds = 0;
  let totalPixels = 0;
  for (const s of strips) {
    const chip = getChip(s.chipId);
    // silent skip: stale chipId from old localStorage; UI surfaces unknown chips separately
    if (!chip) continue;
    const r = computeStripDraw(s, chip);
    totalPower_W += r.power_W;
    totalLeds   += r.ledCount;
    totalPixels += r.pixels;
  }
  // Three PSU tiers — same headroom factors as wire/fuse for consistency.
  const psu = {
    min:      totalPower_W * 1.0,
    balanced: totalPower_W * 1.25,
    solid:    totalPower_W * 1.5,
  };
  return { totalPower_W, psu, totalLeds, totalPixels, psuRec_W: psu.balanced };
}

export function computeInjection(strip, chip) {
  const pixels = computePixels(strip);
  const runs = strip.runs || 1;
  const mA = effectiveMaPerLed(chip.mA_per_led, strip.brightness, strip.colorMode);
  // Per-strip current: doubled = parallel strips, each carrying current for `pixels` LEDs.
  const perStripCurrent_A = (pixels * mA) / 1000;
  const current_A = perStripCurrent_A * runs;     // total current to PSU

  // Electrical length is per strip (visible length), not multiplied by runs.
  const electricalLength_m =
    strip.lengthMode === 'count'
      ? strip.length / strip.density
      : strip.length;

  const R_total       = chip.ohm_per_meter * electricalLength_m;
  // Voltage drop is per parallel strip — uses per-strip current, not total.
  const vDrop_singleFeed_V = (perStripCurrent_A * R_total) / 2;
  const maxDrop_V     = chip.voltage * (strip.maxDropPercent / 100);

  const nFeeds = vDrop_singleFeed_V <= maxDrop_V
    ? 1
    : Math.ceil(Math.sqrt(vDrop_singleFeed_V / maxDrop_V));

  const injectEvery_m = electricalLength_m / nFeeds;
  return { nFeeds, injectEvery_m, vDrop_singleFeed_V, maxDrop_V, electricalLength_m, current_A };
}

// AWG ↔ standard European cross-section (mm²) pairing per cable industry datasheets.
const AWG_TABLE = [
  { awg: 18, ampacity: 7,  mm2: 0.75 },
  { awg: 16, ampacity: 10, mm2: 1.5 },
  { awg: 14, ampacity: 15, mm2: 2.5 },
  { awg: 12, ampacity: 20, mm2: 4 },
  { awg: 10, ampacity: 30, mm2: 6 },
  { awg: 8,  ampacity: 40, mm2: 10 },
];

function pickAWG(targetA) {
  const fit = AWG_TABLE.find(row => row.ampacity >= targetA);
  if (fit) return { awg: fit.awg, mm2: fit.mm2, overCapacity: false };
  const last = AWG_TABLE.at(-1);
  return { awg: last.awg, mm2: last.mm2, overCapacity: true };
}

// Three tiers per user choice:
//   min:      bare minimum (1.0× current — no safety factor)
//   balanced: 1.25× current — standard install practice
//   solid:    1.5× current — extra headroom for sustained max brightness / long runs
export function recommendAWG(currentA) {
  return {
    min:      pickAWG(currentA * 1.0),
    balanced: pickAWG(currentA * 1.25),
    solid:    pickAWG(currentA * 1.5),
  };
}

const FUSE_SIZES_A = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30];

function pickFuse(targetA) {
  return FUSE_SIZES_A.find(s => s >= targetA) ?? FUSE_SIZES_A.at(-1);
}

export function recommendFuse(currentA) {
  return {
    min:      pickFuse(currentA * 1.0),
    balanced: pickFuse(currentA * 1.25),
    solid:    pickFuse(currentA * 1.5),
  };
}

export function dataRecommendation(strip, chip) {
  const isSpi = chip.protocol.startsWith('2-wire');
  const out = {
    levelShifter: isSpi ? 'not needed (SPI)' : 'recommended',
    resistor: '330–500 Ω in series at strip start',
    dataRunWarning: strip.dataRunMeters > 3,
  };
  if (chip.id === 'ws2815') out.note = 'often works without a level shifter';
  return out;
}
