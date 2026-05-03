// ohm_per_meter from typical quinled.info measurements (retrieved 2026-05-02).
// pricePerMeterUSD: density-tiered estimates from AliExpress IP67 listings (May 2026).
// Real prices vary by supplier, IP rating, copper grade and order volume — adjust per quote.
export const CHIPS = [
  { id: 'ws2815',  name: 'WS2815',          voltage: 12, mA_per_led: 17, ohm_per_meter: 0.30, channels: 'RGB',  protocol: '1-wire',       pricePerMeterUSD: { 30: 3,  60: 4,  96: 5.5, 144: 7  } },
  { id: 'ws2812b', name: 'WS2812B',         voltage: 5,  mA_per_led: 36, ohm_per_meter: 0.85, channels: 'RGB',  protocol: '1-wire',       pricePerMeterUSD: { 30: 2,  60: 3,  96: 5,   144: 7  } },
  { id: 'sk6812',  name: 'SK6812 RGBW',     voltage: 5,  mA_per_led: 50, ohm_per_meter: 0.85, channels: 'RGBW', protocol: '1-wire',       pricePerMeterUSD: { 30: 4,  60: 6,  96: 9,   144: 11 } },
  { id: 'ws2811',  name: 'WS2811',          voltage: 12, mA_per_led: 14, ohm_per_meter: 0.35, channels: 'RGB',  protocol: '1-wire',       pricePerMeterUSD: { 30: 2,  60: 3,  96: 4,   144: 6  } },
  { id: 'apa102',  name: 'APA102 / SK9822', voltage: 5,  mA_per_led: 60, ohm_per_meter: 0.65, channels: 'RGB',  protocol: '2-wire (SPI)', pricePerMeterUSD: { 30: 5,  60: 8,  96: 12,  144: 18 } },
];

export function priceForStripMeter(chip, density) {
  const p = chip?.pricePerMeterUSD;
  if (!p) return null;
  if (typeof p === 'number') return p;
  return p[density] ?? null;
}

export const DEFAULT_CHIP_ID = 'ws2815';

export function getChip(id) {
  return CHIPS.find(c => c.id === id);
}
