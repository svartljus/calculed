// Kagora export — converts a CalcuLED project into Kagora's "Import spec" shape.
//
// Kagora (the spatial LED design tool) has an "Import spec…" feature that
// consumes a parametric JSON of `strips[]` and builds StripTypes + repeat-
// configured instances. See kagora/reference/kagora-spec.json and
// kagora/src/spec.js (specToImport) for the consuming side.
//
// CalcuLED's project shape and Kagora's spec shape are nearly identical — both
// describe strip families with chip/density/length/quantity/iterations. This
// builder maps CalcuLED → the exact spec shape Kagora already reads, so no
// Kagora-side change is required.
//
// Field mapping (CalcuLED → Kagora spec strip):
//   chipId        → chipId        (1:1; chip electrical resolved from catalog)
//   density       → density       (1:1, px/m)
//   length        → length        (1:1; meters or pixel-count per lengthMode)
//   lengthMode    → lengthMode     ('meters' | 'count')
//   runs          → runs           (1 | 2; doubled = 2 parallel strips)
//   injection     → injection      ('oneEnd' | 'bothEnds'; Kagora maps bothEnds→both, else→start)
//   quantity      → quantity       (physical copies per family)
//   iterations    → iterations     (rotational repeat count per copy)
//   brightness    → brightness     (0–255, passthrough)
//   colorMode     → colorMode      ('white' | 'average', passthrough)
//   maxDropPercent→ maxDropPercent (drop tolerance → vdrop_min_v in Kagora settings)
//   dataRunMeters → dataRunMeters  (passthrough)
//   name / notes  → name / notes   (name preferred for the StripType label)
//
// Top-level passthrough: name, meta {client,venue,date}, currency, stock, prefs.

const SPEC_VERSION = 1;

// Map one CalcuLED strip to one Kagora spec strip entry. Pure; no DOM.
export function stripToSpecStrip(s) {
  return {
    // name drives the Kagora StripType label; fall back to empty so Kagora
    // synthesizes "<CHIP> <len>m". CalcuLED's per-strip name is unused in the
    // UI today, so prefer notes only as a label when there's no name.
    name: typeof s.name === "string" ? s.name : "",
    chipId: s.chipId,
    density: Number(s.density),
    lengthMode: s.lengthMode === "count" ? "count" : "meters",
    length: Number(s.length),
    runs: s.runs === 2 ? 2 : 1,
    // Keep CalcuLED's vocabulary ('oneEnd' | 'bothEnds'). Kagora's specToImport
    // treats 'bothEnds' as far-end injection and everything else as start-fed,
    // so 'oneEnd' lands correctly without translation.
    injection: s.injection === "bothEnds" ? "bothEnds" : "oneEnd",
    quantity: Math.max(1, Math.round(Number(s.quantity) || 1)),
    iterations: Math.max(1, Math.round(Number(s.iterations) || 1)),
    notes: typeof s.notes === "string" ? s.notes : "",
    brightness: Number.isFinite(Number(s.brightness)) ? Number(s.brightness) : 255,
    colorMode: s.colorMode === "average" ? "average" : "white",
    dataRunMeters: Number(s.dataRunMeters) || 0,
    maxDropPercent: Number.isFinite(Number(s.maxDropPercent)) ? Number(s.maxDropPercent) : 20,
  };
}

// Build a complete Kagora spec object from a CalcuLED project. Pure; no DOM.
export function projectToKagoraSpec(project) {
  const strips = Array.isArray(project?.strips) ? project.strips : [];
  const spec = {
    version: SPEC_VERSION,
    strips: strips.map(stripToSpecStrip),
    name: typeof project?.name === "string" ? project.name : "",
    prefs: {
      // Kagora's spec example carries these; pass through what CalcuLED knows.
      minDevices: !!project?.prefs?.minDevices,
      centralPower: !!project?.prefs?.centralPower,
    },
    meta: {
      client: project?.meta?.client || "",
      venue: project?.meta?.venue || "",
      date: project?.meta?.date || "",
    },
    currency: project?.currency || "USD",
  };
  // Pass stock through unchanged. CalcuLED's stock keys are `strip-<chip>-<density>`,
  // which matches the key format in Kagora's spec example.
  if (project?.stock && typeof project.stock === "object") {
    spec.stock = { ...project.stock };
  }
  return spec;
}
