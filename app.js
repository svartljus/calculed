import { CHIPS, DEFAULT_CHIP_ID } from './src/chips.js';

const stripsList = document.getElementById('strips');
const tpl = document.getElementById('strip-template');

function makeDefaultStrip() {
  return {
    id: crypto.randomUUID(),
    name: '',
    chipId: DEFAULT_CHIP_ID,
    density: 60,
    lengthMode: 'meters',
    length: 5,
    runs: 1,
    brightness: 255,
    colorMode: 'white',
    feedRunMeters: 2,
    dataRunMeters: 0.3,
    maxDropPercent: 10,
  };
}

function renderStrip(strip) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = strip.id;

  // Populate the chip <select>
  const chipSel = node.querySelector('select[name="chipId"]');
  for (const c of CHIPS) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.voltage}V)`;
    if (c.id === strip.chipId) opt.selected = true;
    chipSel.appendChild(opt);
  }

  // Set form values from the strip object
  node.querySelector('input[name="name"]').value = strip.name;
  node.querySelector('select[name="density"]').value = strip.density;
  node.querySelector('input[name="length"]').value = strip.length;
  node.querySelector('select[name="lengthMode"]').value = strip.lengthMode;
  node.querySelector('input[name="doubled"]').checked = strip.runs === 2;
  node.querySelector('input[name="brightness"]').value = strip.brightness;
  node.querySelector('select[name="colorMode"]').value = strip.colorMode;
  node.querySelector('input[name="feedRunMeters"]').value = strip.feedRunMeters;
  node.querySelector('input[name="dataRunMeters"]').value = strip.dataRunMeters;
  node.querySelector('input[name="maxDropPercent"]').value = strip.maxDropPercent;

  return node;
}

const project = { version: 1, strips: [makeDefaultStrip()] };

function render() {
  stripsList.replaceChildren(...project.strips.map(renderStrip));
}

render();
