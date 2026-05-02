export const CHIPS = [
  { id: 'ws2815',  name: 'WS2815',          voltage: 12, mA_per_led: 17, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire' },
  { id: 'ws2812b', name: 'WS2812B',         voltage: 5,  mA_per_led: 36, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire' },
  { id: 'sk6812',  name: 'SK6812 RGBW',     voltage: 5,  mA_per_led: 50, ohm_per_meter: 1.0, channels: 'RGBW', protocol: '1-wire' },
  { id: 'ws2811',  name: 'WS2811',          voltage: 12, mA_per_led: 14, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire' },
  { id: 'apa102',  name: 'APA102 / SK9822', voltage: 5,  mA_per_led: 60, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '2-wire (SPI)' },
];

export const DEFAULT_CHIP_ID = 'ws2815';

export function getChip(id) {
  return CHIPS.find(c => c.id === id);
}
