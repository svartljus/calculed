# CalcuLED — Design

A trimmed-down, opinionated reimagining of [wled-calculator](https://wled-calculator.github.io/) for planning WLED installs across multiple LED strips. Single-page, no build step, semantic HTML.

References: [wled-calculator](https://wled-calculator.github.io/), [WLED FAQ](https://wled-faq.github.io/en/index.html), [WLED knowledge base](https://kno.wled.ge/), [quinled.info](https://quinled.info/).

## Goals

- Plan a multi-strip WLED install end to end: power, injection, wire gauge, fuses, data signal.
- "More direct" than wled-calculator: fewer chip choices, opinionated defaults, no clutter.
- Drop on GitHub Pages, no dependencies.

## Non-goals (v1)

- GPIO / pin assignment for the controller.
- Multiple PSUs per project (assume one shared PSU).
- Share-link via URL hash (deferred — localStorage only for v1).
- Custom / user-extensible chip catalog.
- mA-per-LED override per strip.
- Ambient-temperature derating for wire gauge.

## Architecture

Single-page app. Vanilla HTML/CSS/JS. No framework, no build, no deps.

```
svartljus/calculed/
├── index.html         # markup, semantic HTML5, form-driven
├── style.css          # minimal — resets, layout, print rules
├── app.js             # state, calc engine, render, localStorage sync
├── chips.js           # LED chip catalog
└── README.md          # what it is, sources, formula notes
```

State lives in one plain JS object. The whole page is a `<form>`; an `input` listener at the form level calls `recalc()`, which reads values via `FormData`, runs pure calc functions, and writes results into `<output>` elements.

## Data model

### Chip catalog (`chips.js`, static)

Five entries, ordered by frequency of use. WS2815 is the default.

```js
const CHIPS = [
  { id: 'ws2815',   name: 'WS2815',         voltage: 12, mA_per_led: 17, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire', default: true },
  { id: 'ws2812b',  name: 'WS2812B',        voltage: 5,  mA_per_led: 36, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire' },
  { id: 'sk6812',   name: 'SK6812 RGBW',    voltage: 5,  mA_per_led: 50, ohm_per_meter: 1.0, channels: 'RGBW', protocol: '1-wire' },
  { id: 'ws2811',   name: 'WS2811',         voltage: 12, mA_per_led: 14, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '1-wire' },
  { id: 'apa102',   name: 'APA102 / SK9822', voltage: 5,  mA_per_led: 60, ohm_per_meter: 1.0, channels: 'RGB',  protocol: '2-wire (SPI)' },
];
```

mA-per-LED values are typical-white from quinled.info measurements (not spec-sheet maximums). Footnoted in the README. `ohm_per_meter` values are placeholders — finalize from quinled.info during implementation.

### Strip schema

```js
{
  id: 'uuid',
  name: '',                    // optional label
  chipId: 'ws2815',            // → looks up voltage, mA/LED, ohm/m
  density: 60,                 // LEDs per meter
  lengthMode: 'meters',        // 'meters' | 'count'
  length: 5,                   // visible meters OR LED count, depending on mode
  runs: 1,                     // 1 = single, 2 = doubled (e.g. neon tube). Ignored in count mode.
  brightness: 255,             // 0–255
  colorMode: 'white',          // 'white' (worst case) | 'average' (~⅓ duty)
  feedRunMeters: 2,            // PSU → strip start, for wire gauge / drop
  dataRunMeters: 0.3,          // controller → strip data line
  maxDropPercent: 10,          // tolerance, drives injection-point calc
}
```

### Project schema

```js
{
  version: 1,                  // for future migrations
  strips: [ /* strips */ ],
}
```

PSU is computed, not stored.

## Calculation formulas

All pure functions. One per output, fed `(strip, chip)`.

**Effective current per LED**
```
mA_eff = chip.mA_per_led × (brightness/255) × colorFactor
       where colorFactor: white=1.0, average=0.33
```

**LED count & per-strip draw**
```
ledCount = density × length × runs        (meters mode)
         = countInput                     (count mode; runs ignored)
current_A = (ledCount × mA_eff) / 1000
power_W   = current_A × chip.voltage
```

**PSU sizing (project total)**
```
psuMin_W   = Σ power_W
psuRec_W   = psuMin_W / 0.8     (20% headroom)
```
Output: `Min 184 W · Recommended 230 W (20% headroom)`.

**Voltage drop & injection points** — continuous approximation; current tapers along the strip.
```
electricalLength = length × runs   (meters mode)
                 = ledCount / density   (count mode)
R_total      = chip.ohm_per_meter × electricalLength
V_drop_1feed = (current_A × R_total) / 2
maxDropV     = chip.voltage × (maxDropPercent / 100)
nFeeds       = ceil(sqrt(V_drop_1feed / maxDropV))
injectEvery  = electricalLength / nFeeds
```
Output: `Inject every 2.5 m · 3 feed points · ~0.9 V drop`.

**Wire gauge** — AWG ampacity table, pick smallest gauge handling `current_A / nFeeds × 1.25` safety factor.

| AWG | Continuous A |
|----:|-------------:|
|  18 |  7 |
|  16 | 10 |
|  14 | 15 |
|  12 | 20 |
|  10 | 30 |
|   8 | 40 |

Warn if voltage drop in the feed wire (`I × R_wire × 2`, both conductors) exceeds 3% of supply voltage.

**Fuse** — `ceil(current_per_feed × 1.25)` rounded up to standard size: 1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30 A.

**Data signal**
- Level shifter: `recommended` for 1-wire chips, `not needed` for SPI. WS2815 gets a "often works without one" footnote.
- Max data wire: warn if `dataRunMeters > 3`.
- Series resistor: always recommend 330–500 Ω at strip start.

**Voltage-drop visualization** — small inline `<svg>` per card, x = position along strip, y = voltage. Two lines: single-feed vs. recommended N-feed. Makes the improvement visible at a glance.

## UI structure

Page is one `<form>`. No `<h1>`. Native elements doing the work.

```html
<form id="project">
  <ol id="strips">
    <li>
      <article>
        <header>
          <input name="name" placeholder="Strip 1">
          <button type="button" data-action="remove">Remove</button>
        </header>

        <fieldset>
          <legend>Strip</legend>
          <label>Chip <select name="chipId">…</select></label>
          <label>Density <select name="density">30/60/96/144</select></label>
          <label>Length
            <input type="number" name="length" step="0.1">
            <select name="lengthMode"><option>meters<option>LEDs</select>
          </label>
          <label><input type="checkbox" name="runs" value="2"> Doubled (e.g. neon tube)</label>
        </fieldset>

        <fieldset>
          <legend>Brightness &amp; color</legend>
          <label>Max brightness <input type="range" name="brightness" min="0" max="255"></label>
          <label>Color assumption
            <select name="colorMode"><option>white<option>average</select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Wiring</legend>
          <label>Feed run from PSU <input type="number" name="feedRunMeters" step="0.1"> m</label>
          <label>Data run <input type="number" name="dataRunMeters" step="0.1"> m</label>
          <label>Max voltage drop <input type="number" name="maxDropPercent"> %</label>
        </fieldset>

        <section data-results>
          <dl>
            <dt>LED count</dt>   <dd><output name="ledCount"></output></dd>
            <dt>Current</dt>     <dd><output name="current"></output> A</dd>
            <dt>Power</dt>       <dd><output name="power"></output> W</dd>
            <dt>Inject every</dt><dd><output name="injectEvery"></output> m
                                   (<output name="nFeeds"></output> feeds)</dd>
            <dt>Wire gauge</dt>  <dd><output name="awg"></output></dd>
            <dt>Fuse</dt>        <dd><output name="fuse"></output> A</dd>
            <dt>Data</dt>        <dd><output name="dataNote"></output></dd>
          </dl>
          <svg data-drop-viz width="100%" height="80"></svg>
        </section>
      </article>
    </li>
  </ol>

  <button type="button" id="add-strip">+ Add strip</button>
  <button type="button" id="reset">Reset</button>
</form>

<footer id="totals">
  <dl>
    <dt>Total power</dt>    <dd><output name="totalPower"></output> W</dd>
    <dt>Recommended PSU</dt><dd><output name="psuRec"></output> W</dd>
    <dt>Total LEDs</dt>     <dd><output name="totalLeds"></output></dd>
  </dl>
  <button type="button" id="print">Print BOM</button>
</footer>
```

Notable choices:
- `<form>` wraps everything → free `FormData`, `input` event bubbles up, browser-native validation.
- `<output>` for results → semantic, no fake spans.
- `<fieldset>` / `<legend>` group inputs → screen readers and visual grouping for free.
- `<dl>` for results → term/definition is exactly the right primitive.
- `<details>` for the chip-catalog footnote at the page bottom (sources, formulas) — collapsed by default.
- `<dialog>` for reset confirmation.
- CSS Grid in two places only: strip card, totals footer.

## Persistence

- localStorage key `calculed:project`, JSON-serialized state.
- Written on every form `input`, debounced ~300 ms.
- Loaded on boot. If absent, start with one default strip (WS2815, 60/m, 5 m, defaults).
- Reset button confirms via `<dialog>`, clears localStorage, reloads with default strip.
- Schema `version: 1` on the project object — future migration hook.

## Print view

`@media print {}` block in `style.css`. No separate page template.

- Hide: `Add strip`, `Remove`, `Reset`, `Print BOM` buttons. The brightness `<input type="range">` renders its current numeric value instead.
- Show: header with project date/time and totals.
- `break-inside: avoid` on each strip `<article>` so cards don't split across pages.
- Results `<dl>` becomes a clean two-column grid.
- Black on white, no shadows or rounded corners.
- SVG drop-viz prints as-is.

## Visual style

Utility-tool, function-first. Mostly semantic HTML doing its native job; minimal CSS for layout and legibility. Few classes. No atmosphere — this is a planning tool, optimized for reading numbers fast.

## Open items deferred to later

- Share-link via URL hash (encoding, conflict with localStorage, copy-link button).
- Multiple PSUs per project.
- GPIO / pin assignment.
- Custom chip catalog entries.
- mA-per-LED per-strip override.
- Ambient-temperature derating.
