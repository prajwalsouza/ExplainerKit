---
name: explainerkit-scenes
description: "Use when drawing shapes, text and colours, mounting and playing a scene, or adding sliders and other reader controls whose values drive the picture with the ExplainerKit JavaScript library. Covers explainerkit/core, explainerkit/color, explainerkit/graphics, explainerkit/typography, explainerkit/inputs, explainerkit/geometry, explainerkit/geometry/shapes, with tested recipes and the exact option vocabularies."
---

# Scenes, shapes and interaction

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/core`: Scene identity, handles, components, keyed data, parameters, bindings, tracks and sampling. Read `docs/runtime-api.md`.
  Exports: `KitError`, `MOTION_STYLES`, `Scene`, `beats`, `clamp`, `cubicBezier`, `ease`, `idle`, `lerp`, `linearScale`, `motionStyle`, `readingPace`, `scene`, `seeded`.
- `explainerkit/color`: Procedural HSLA, safe conversions, hue-aware mixing and explicit RGB interpolation. Read `docs/modules/color.md`.
  Exports: `adjust`, `colorInterpolator`, `fromRGBA`, `hsla`, `hslaToRGBA`, `mix`, `toCSS`, `toHSLA`, `toHex`, `toRGBA`.
- `explainerkit/graphics`: Validated paint, gradients, clipping and textures. Read `docs/modules/graphics.md`.
  Exports: `clipCircle`, `clipPath`, `clipRect`, `color`, `fillRule`, `linearGradient`, `paint`, `pathCommands`, `radialGradient`, `strokeDasharray`, `texture`, `textureTile`, `validateClip`, `validatePaint`.
- `explainerkit/typography`: Editable letters and symbols, plus animated HTML text. Read `docs/modules/glyph-objects.md`, `docs/modules/dom-typography.md`.
  Exports: `glyphs`, `kineticText`, `segmentText`, `textStagger`.
- `explainerkit/inputs`: Live observations, settled hover intent and reactive parameter/data bindings. Read `docs/modules/live-inputs.md`, `docs/modules/story-cues-hover-intent.md`.
  Exports: `bindData`, `bindInputs`, `cameraInput`, `deriveInput`, `deviceMotionInput`, `deviceOrientationInput`, `dragInput`, `fileInput`, `hoverIntent`, `inputSource`, `mapInput`, `microphoneInput`, `pointerInput`, `readInputFile`, `resizeInput`, `smoothInput`, `thresholdInput`.
- `explainerkit/geometry`: Path construction, placements, measurement, deformation, polyhedra and drawing tools. Read `docs/modules/advanced-constructions.md`, `docs/modules/drawing-batches.md`, `docs/modules/polyhedra.md`.
  Exports: `Line`, `bindMotionPath`, `ellipsePath`, `gridPlacements`, `inkStroke`, `lattice`, `measurePath`, `motionPath`, `outlineDraw`, `pairPoints`, `pathPlacements`, `polygonPath`, `polyhedron`, `radialPlacements`, `regularPolygon`, `roundedRectPath`, `samplePath`, `split`, `starPath`, `transformPath`.
- `explainerkit/geometry/shapes`: Combine, intersect, subtract or split polygons and outlines. Read `docs/modules/shape-operations.md`.
  Exports: `asShape`, `booleanPath`, `centroid`, `fracture`, `intersect`, `intersectPaths`, `pathLoops`, `polygon`, `polygonArea`, `subtract`, `subtractPaths`, `union`, `unionPaths`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Draw a scene, animate it and play it

Create a scene with shapes, schedule a move with easing, mount it in the page and play it.

```js
import {scene} from 'explainerkit/core';

const drawing = scene({width: 640, height: 360, duration: 3, label: 'A ball rolls to a box'});
drawing.rect({x: 470, y: 150, width: 120, height: 80, fill: '#e7e2d3', stroke: '#262d2b'});
const ball = drawing.circle({x: 80, y: 190, r: 28, fill: '#34766b'});
drawing.text({x: 40, y: 50, text: 'One scene, sampled at any time', fontSize: 22, fill: '#262d2b'});

// Move at time 0.5 for 1.5 seconds. Seeking to any time gives the same frame.
ball.to(0.5, {x: 530, y: 190}, {duration: 1.5, ease: 'easeInOut'});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Let the reader drag a value that drives the drawing

Add a parameter with a slider control and bind shape properties to it so the picture updates live.

```js
import {scene} from 'explainerkit/core';

const drawing = scene({width: 640, height: 300, label: 'A circle whose size follows a slider'});
const radius = drawing.parameter(40, {min: 10, max: 120});
const area = drawing.derive([radius], (r) => Math.PI * r * r);

drawing.circle({x: 220, y: 150, fill: '#a74a2d'}).bind('r', {inputs: [radius], map: (r) => r});
drawing.text({x: 400, y: 150, fontSize: 22, fill: '#262d2b'})
  .bind('text', {inputs: [area], map: (a) => `area ≈ ${Math.round(a)}`});

// A labelled slider appears with the mounted scene.
drawing.control(radius, {label: 'Radius', step: 1});
export const player = await drawing.mount(document.querySelector('#stage'));
```

### Animate a value over time and bind several properties to it

Animate one parameter from a start to an end value and derive positions, colour and labels from it.

```js
import {scene} from 'explainerkit/core';
import {hsla, mix} from 'explainerkit/color';

const drawing = scene({width: 640, height: 300, duration: 4, label: 'A dot warms as it travels'});
const progress = drawing.parameter(0, {min: 0, max: 1});
progress.animate({from: 0, to: 1, duration: 3, ease: 'smooth'});

const cool = hsla(200, 60, 45), warm = hsla(15, 70, 50);
drawing.line({x1: 60, y1: 150, x2: 580, y2: 150, stroke: '#cfcabb', strokeWidth: 4});
drawing.circle({y: 150, r: 26})
  .bind(['x', 'fill'], {inputs: [progress], map: (p) => ({x: 60 + 520 * p, fill: mix(cool, warm, p)})});
drawing.text({x: 60, y: 230, fontSize: 20, fill: '#262d2b'})
  .bind('text', {inputs: [progress], map: (p) => `${Math.round(p * 100)} % of the way`});

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
