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
