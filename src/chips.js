// ohm_per_meter from typical quinled.info measurements (retrieved 2026-05-02).
// pricePerMeterUSD: rough waterproof / IP67 strip estimates — varies a lot by
// density (60 vs 144), supplier and order volume. Adjust per real quote.
export const CHIPS = [
  { id: 'ws2815',  name: 'WS2815',          voltage: 12, mA_per_led: 17, ohm_per_meter: 0.30, channels: 'RGB',  protocol: '1-wire',     pricePerMeterUSD: 12 },
  { id: 'ws2812b', name: 'WS2812B',         voltage: 5,  mA_per_led: 36, ohm_per_meter: 0.85, channels: 'RGB',  protocol: '1-wire',     pricePerMeterUSD: 8  },
  { id: 'sk6812',  name: 'SK6812 RGBW',     voltage: 5,  mA_per_led: 50, ohm_per_meter: 0.85, channels: 'RGBW', protocol: '1-wire',     pricePerMeterUSD: 14 },
  { id: 'ws2811',  name: 'WS2811',          voltage: 12, mA_per_led: 14, ohm_per_meter: 0.35, channels: 'RGB',  protocol: '1-wire',     pricePerMeterUSD: 6  },
  { id: 'apa102',  name: 'APA102 / SK9822', voltage: 5,  mA_per_led: 60, ohm_per_meter: 0.65, channels: 'RGB',  protocol: '2-wire (SPI)', pricePerMeterUSD: 18 },
];

export const DEFAULT_CHIP_ID = 'ws2815';

export function getChip(id) {
  return CHIPS.find(c => c.id === id);
}
