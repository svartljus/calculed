# CalcuLED

A trimmed-down WLED install planner. One page, no build step. Drop in the browser.

## What it does

For each LED strip in your project, calculates:

- LED count and total current draw
- Required PSU wattage (with 20% headroom)
- Power injection points and the wire gauge / fuse per feed
- Data signal recommendations (level shifter, series resistor, max wire length)
- Voltage drop visualization

Sums everything across all strips into a project total. Saves to localStorage. Prints to PDF.

## Use it

Open `index.html` in any modern browser. Add strips with the **+ Add strip** button. Numbers update as you type. Hit **Print BOM** for a clean handoff page.

## Run the tests

```bash
npm test
```

Tests are pure-Node, no install needed.

## Sources & assumptions

- mA-per-LED values are typical-white measurements from [quinled.info](https://quinled.info/), not spec-sheet maxima.
- `ohm_per_meter` per chip is from the same source.
- Voltage drop uses a continuous approximation: `V_drop = I × R / 2` per segment (current tapers along the strip).
- PSU recommendation = total power ÷ 0.8 (20% headroom).
- Wire gauge picks the smallest AWG that handles `feed_current × 1.25`.
- Fuse picks the next standard size up from `feed_current × 1.25`.

See also the [WLED knowledge base](https://kno.wled.ge/), [WLED FAQ](https://wled-faq.github.io/en/index.html), and the original [wled-calculator](https://wled-calculator.github.io/) this trims down.

## Roadmap (deferred)

- Share-link via URL hash
- Multiple PSUs per project
- GPIO / pin assignment
- Custom chip catalog entries
