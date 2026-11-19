---
name: explainerkit-motion
description: "Use when animating with easing, timelines, keyframes, ready-made entrances (fly in, typewriter, wipe, pulse), springs, morphing shapes or timing shapes to narration with the ExplainerKit JavaScript library. Covers explainerkit/motion, explainerkit/motion/effects, explainerkit/transitions, explainerkit/morph, explainerkit/math, explainerkit/physics, explainerkit/noise, explainerkit/juicy, explainerkit/variation, explainerkit/emphasis, with tested recipes and the exact option vocabularies."
---

# Motion and effects

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/motion`: Pure timelines, easing, staggering, motion paths, springs and secondary motion. Read `docs/modules/timelines.md`, `docs/modules/motion-curves.md`, `docs/modules/native-motion.md`.
  Exports: `MOTION_STYLES`, `Timeline`, `beats`, `bindCommonEffect`, `bindMotionPath`, `commonEffect`, `createTimeline`, `cubicBezier`, `ease`, `easingCurve`, `envelope`, `idle`, `inertia`, `jiggle`, `keyed`, `lag`, `motionPath`, `motionStyle`, `readingPace`, `remap`, `smoothWindow`, `spring`, `springEasing`, `springTiming`, `squashStretch`, `stagger`.
- `explainerkit/motion/effects`: Seekable typewriter, object wipe, fly-in, pulse, teeter and colour flash presets. Read `docs/modules/common-effects.md`.
  Exports: `bindCommonEffect`, `commonEffect`.
- `explainerkit/transitions`: Capture and interpolate supported scene states. Read `docs/runtime-api.md`.
  Exports: `captureState`, `createTransition`, `interpolateStates`.
- `explainerkit/morph`: Match points and outlines, change shapes, and animate splits or merges. Read `docs/modules/morph-safety.md`.
  Exports: `colorInterpolator`, `createCompoundMorph`, `createMergeMorph`, `createMorph`, `createObjectMorph`, `createSafeMorph`, `createSceneTransition`, `createShapeKeys`, `createSplitMorph`, `flattenPath`, `matchCut`.
- `explainerkit/math`: Turn LaTeX and MathML into editable outlines for equations and morphs. Read `docs/modules/math.md`.
  Exports: `addEquation`, `createEquationMorph`, `equationFromSVG`, `typesetEquation`.
- `explainerkit/physics`: Analytic oscillator and trajectory models; no universal physics simulation. Read `docs/modules/secondary-motion.md`.
  Exports: `fall`, `inertia`, `jiggle`, `lag`, `spring`, `springEasing`, `squashStretch`, `velocityTracker`.
- `explainerkit/noise`: Scalar/vector fields, fractal/ridged noise, domain warp and deterministic grids. Read `docs/modules/procedural.md`, `docs/modules/procedural-fields-networks.md`.
  Exports: `fbm`, `gradientNoise2`, `gradientNoise3`, `noise2`, `noise3`, `noiseGrid`, `noiseScalarField`, `noiseVectorField`, `randomAt`, `ridged`, `warp`.
- `explainerkit/juicy`: Live physical feel for interactive pages: soft chains, wind fields, spring followers, squash, pop, sway, tug, shake and hit-stop. Read `docs/modules/juicy.md`.
  Exports: `chaser`, `hitstop`, `pop`, `softChain`, `squash`, `sway`, `trauma`, `tug`, `windField`.
- `explainerkit/variation`: Seeded, bounded and correlated differences between repeated things, with an audit for machine-made uniformity. Read `docs/modules/variation.md`.
  Exports: `auditVariation`, `variation`, `variationPresets`.
- `explainerkit/emphasis`: Draw the eye to a word, term or part while its context recedes, with one colour per topic. Read `docs/modules/emphasis.md`.
  Exports: `emphasis`, `emphasizeDOM`, `emphasizeScene`, `tagTokens`, `topics`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Use ready-made entrances: fly in, typewriter and wipe

Apply seekable preset effects such as flyIn, typewriter, wipe and pulse to shapes and text.

```js
import {scene} from 'explainerkit/core';
import {commonEffect, bindCommonEffect} from 'explainerkit/motion/effects';

const drawing = scene({width: 640, height: 360, duration: 4, label: 'A title types itself, a card wipes in, a dot flies in'});
const title = drawing.text({x: 60, y: 80, text: 'A small discovery', fontSize: 34, fill: '#262d2b'});
bindCommonEffect(title, commonEffect('typewriter', {text: 'A small discovery', duration: 1.5}));

const card = drawing.group({x: 60, y: 130});
card.rect({width: 260, height: 120, fill: '#3b8778'});
bindCommonEffect(card, commonEffect('wipe', {at: 1.2, duration: 1, width: 260, height: 120, direction: 'right'}));

const dot = drawing.circle({x: 480, y: 190, r: 34, fill: '#a74a2d'});
bindCommonEffect(dot, commonEffect('flyIn', {at: 2, duration: 1, direction: 'left', distance: 160, x: 480, y: 190}));

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Choreograph several moves with a timeline, labels and keyframes

Build a pure motion timeline with labels, relative positions and keyframes, then drive scene properties from it.

```js
import {scene} from 'explainerkit/core';
import {createTimeline} from 'explainerkit/motion';

const motion = createTimeline({defaults: {duration: 1, ease: 'easeInOut'}})
  .label('travel', 0.3)
  .add({'dot.x': {from: 80, to: 560}}, 'travel')
  .add({'dot.y': {keyframes: [{from: 180, to: 100, duration: 0.4}, {to: 180, duration: 0.6}]}}, 'travel')
  .add({'bar.width': {from: 0, to: 480}}, 'travel');

const drawing = scene({width: 640, height: 300, duration: 2, label: 'A dot hops along while a bar fills'});
const t = drawing.parameter(0, {min: 0, max: 2});
t.animate({from: 0, to: 2, duration: 2, ease: 'linear'});
const values = drawing.derive([t], (s) => motion.sample(s).values);
drawing.rect({x: 80, y: 240, height: 12, fill: '#d9a441'}).bind('width', {inputs: [values], map: (v) => v['bar.width'] ?? 0});
drawing.circle({r: 22, fill: '#34766b'}).bind(['x', 'y'], {inputs: [values], map: (v) => ({x: v['dot.x'] ?? 80, y: v['dot.y'] ?? 180})});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Time shapes to narration lines

Turn narration sentences into beat times, then make shapes enter, move, dim and explain themselves at those beats.

```js
import {scene, beats} from 'explainerkit/core';

const b = beats([
  'Four buses run this morning.',
  'Twelve riders, four buses. Three per bus.',
  'But ask the riders, and the answer changes.',
]);
const s = scene({width: 960, height: 540, label: 'Average riders per bus'});
s.text({text: '3', x: 480, y: 280, fontSize: 150, align: 'middle', fill: '#262d2b'})
  .enter(b.at(1), {style: 'pop'})
  .to(b.at(1.5), {x: 300})
  .dim([[b.at(2), 0.3]])
  .explain('Counting buses', 'Each bus is one vote: 12 ÷ 4 = 3.');
s.text({text: '7', x: 660, y: 280, fontSize: 150, align: 'middle', fill: '#a74a2d'}).enter(b.at(2), {style: 'pop'});

export const player = await s.mount(document.querySelector('#stage'));
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
