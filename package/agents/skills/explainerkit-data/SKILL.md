---
name: explainerkit-data
description: "Use when drawing charts from data, placing labels and annotations without overlap, laying out responsively, or auditing composition, contrast and motion with the ExplainerKit JavaScript library. Covers explainerkit/data, explainerkit/layout, explainerkit/layout/labels, explainerkit/layout/annotations, explainerkit/audit, explainerkit/perception, with tested recipes and the exact option vocabularies."
---

# Data, layout, labels and checks

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/data`: Scales, units, transformations and plot/axis blueprints. Read `docs/modules/data-modeling.md`.
  Exports: `areaPath`, `axisBlueprint`, `bandScale`, `bin`, `convert`, `defineUnit`, `divideUnits`, `filterRows`, `linePath`, `mapRows`, `multiplyUnits`, `ordinalScale`, `powerUnit`, `replaceMapped`, `scale`, `stack`, `summarize`, `ticks`, `units`.
- `explainerkit/layout`: Placement, text wrapping, callouts, measured labels and responsive planning. Read `docs/modules/compose.md`, `docs/modules/annotations.md`.
  Exports: `analyse`, `applyLayout`, `attach`, `bubble`, `callout`, `canvasTextMeasurer`, `effectBatch`, `estimateText`, `inkFor`, `measureNode`, `panel`, `paragraph`, `pathPoint`, `place`, `placeLabels`, `planAnnotations`, `planLayout`, `stage`, `toAuthored`, `wrapText`.
- `explainerkit/layout/labels`: Focused measured-label API. Read `docs/modules/measured-labels.md`.
  Exports: `canvasTextMeasurer`, `placeLabels`.
- `explainerkit/layout/annotations`: Focused annotation policy. Read `docs/modules/annotations.md`.
  Exports: `planAnnotations`.
- `explainerkit/audit`: Composition, motion, continuity, contrast, measured palette and 3D rendering diagnostics. Read `docs/modules/composition-audit.md`, `docs/modules/motion-diagnostics.md`, `docs/modules/continuity-audit.md`, `docs/modules/palette-audit.md`, `docs/modules/render-audit.md`.
  Exports: `CONTINUITY`, `RENDER_3D`, `RULES`, `auditFrame`, `auditHandover`, `auditHandoverWindow`, `auditMotion`, `auditPalette`, `auditRender3D`, `auditRendererStats`, `auditScene`, `auditStripes`, `auditTextOverPixels`, `colorDistance`, `comparePalettes`, `contrastRatio`, `describeThreeScene`, `fitSimilarity`, `frameMarks`, `parseColor`, `relativeLuminance`.
- `explainerkit/perception`: Grouping suggestions with author overrides. Read `docs/modules/rigs-morphing-perception.md`.
  Exports: `groupStagger`, `perceptualGroups`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Draw a bar chart from data with scales

Map numbers and categories to positions with linear and band scales and draw labelled bars with ticks.

```js
import {scene} from 'explainerkit/core';
import {scale, bandScale} from 'explainerkit/data';

const rows = [{mode: 'walk', speed: 5}, {mode: 'cycle', speed: 18}, {mode: 'bus', speed: 22}, {mode: 'car', speed: 31}];
const drawing = scene({width: 640, height: 360, label: 'Average speed by way of travel'});
const y = scale({domain: [0, 35], range: [300, 40]});
const x = bandScale({domain: rows.map((r) => r.mode), range: [80, 600], paddingInner: 0.25});

for (const tick of y.ticks(5)) {
  drawing.line({x1: 70, y1: y(tick), x2: 600, y2: y(tick), stroke: '#e3e0d6'});
  drawing.text({x: 60, y: y(tick) + 5, text: String(tick), fontSize: 13, align: 'end', fill: '#58635d'});
}
rows.forEach((row, i) => {
  const bar = drawing.rect({x: x(row.mode), y: 300, width: x.bandwidth, height: 0, fill: '#34766b'});
  bar.to(0.2 * i, {y: y(row.speed), height: 300 - y(row.speed)}, {duration: 0.8, ease: 'easeOut'});
  drawing.text({x: x(row.mode) + x.bandwidth / 2, y: 325, text: row.mode, fontSize: 15, align: 'middle', fill: '#262d2b'});
});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

## Vocabularies

- Named easings: linear, smooth, easeOut, easeInOut, launch, titleOpen, anticipateOut, linearStop, snapIn.
- Entrance styles: fade, rise, pop, cut, reveal.
- Text properties: text, fontSize, fontFamily, fontWeight, letterSpacing, align, baseline, wrap, lineHeight, minScreenSize, halo, textOutline, textAdvance.

The full lists, including every shape's properties, are in `agents/catalog.json` under `vocabularies`.

## Common mistakes

- For new VFX shots, prepare fitted camera poses with compileCameraTrack. Its standard level repairs isolated pose spikes by default. Choose strong for smaller spikes or none to inspect the original poses.
- Text alignment is the `align` property with the values start, middle and end. `textAnchor` is SVG vocabulary and is rejected.
- That easing name does not exist. Named easings are listed in vocabularies.easings, for example easeOut, easeInOut, smooth or linear, or pass a trusted progress function.
- Text `align` takes start, middle or end, not center, left or right.
- Path commands are absolute M, L, C, Q and Z only. Convert relative, smooth (S, T), arc (A) and horizontal or vertical (H, V) commands, or build paths with explainerkit/geometry.
- The `glow` property is an object, not a number. See docs/modules/graphics.md.
- A cloud takes `points: {positions: [x0, y0, x1, y1, …], radii?, colors?}`, not an array of {x, y} objects.
- A band scale exposes `bandwidth` and `step` as numbers, not methods. Write `x.bandwidth`.
- Create scenes with `scene({width, height})` from explainerkit/core. There is no global ExplainerKit object.
- You rarely need your own animation loop. Animate with `to`, parameters or timelines and let `scene.mount()` return a player that owns the clock, so seeking and export keep working.
- ExplainerKit has its own scales, timelines and effects. Check find_capability before adding another animation or charting library. Three.js is supplied to explainerkit/renderers/three, not imported by ExplainerKit.
- Drawing directly to SVG or Canvas bypasses the scene, so seeking, export and audits cannot see it. Add shapes to a scene and mount it, or use a renderer from explainerkit/renderers/svg or explainerkit/renderers/canvas.

## Check your work

Run the module and look at it before you report success. With the ExplainerKit MCP server, call `preview` with the code and the scene times to capture. Without it, run `node agents/cli.mjs preview path/to/module.js --times 0.5,2` from the ExplainerKit repository. Both return screenshots, console output and errors. Fix every error and check that the picture shows what the task asked for.
