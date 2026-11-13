---
name: explainerkit-characters-machines
description: "Use when adding characters that walk, talk and emote, gears and linkages, particle effects, skeletal rigs, or generated textures, foliage and point fields with the ExplainerKit JavaScript library. Covers explainerkit/characters, explainerkit/mechanisms, explainerkit/particles, explainerkit/rigs, explainerkit/procedural, with tested recipes and the exact option vocabularies."
---

# Characters, machines, particles and procedural art

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/characters`: Character runtime, faces, poses, walking and acting. Read `docs/modules/characters.md`, `docs/modules/biped-motion.md`, `docs/modules/character-profiles.md`, `docs/modules/coordinated-motion.md`, `docs/modules/keyed-poses-follow.md`.
  Exports: `BEAN_PALETTES`, `BIPED_POSES`, `BIRD_PALETTES`, `BUILDERS`, `FAMILY_PRESETS`, `FISH_PALETTES`, `HAIR`, `MICROBE_PALETTES`, `MOODS`, `MOTION_STYLES`, `MOUTH_SHAPES`, `SKIN`, `STARTERS`, `STICK_BUILDS`, `STICK_STYLES`, `add`, `appendage`, `appendageShapes`, `auditCharacter`, `bean`, `bipedActions`, `bipedDefaults`, `bipedMotion`, `bipedRig`, `bird`, `blend`, `blinkAt`, `browPath`, `character`, `characterFromSVG`, `characterPoseFromSkeleton`, `compileCharacter`, `contactSheet`, `contactTiming`, `cow`, `crowd`, `dampedStep`, `dragonfly`, `egg`, `ellipse` and 44 more.
- `explainerkit/mechanisms`: Connect 2D movement in gears, rolling objects, cranks and belts. Read `docs/modules/particles-mechanisms.md`.
  Exports: `beltGeometry`, `gearPath`, `mechanism`, `meshPhase`, `sliderCrank`.
- `explainerkit/particles`: Seeded emitters sampled by time. Read `docs/modules/particles-mechanisms.md`.
  Exports: `emitter`, `noise2`, `noise3`, `noiseField`.
- `explainerkit/rigs`: Calculate joint positions and deform artwork with skeletons and skins. Read `docs/modules/advanced-rigs.md`.
  Exports: `bindSkin`, `fkTwoBone`, `skeleton`, `skeletonRig`, `solveRigGoals`, `solveTwoBone`, `solveTwoBone3D`, `splineRig`, `twoBoneRig`.
- `explainerkit/procedural`: Points, density fields, network spacing, instances and generated masses. Read `docs/modules/procedural.md`, `docs/modules/procedural-fields-networks.md`.
  Exports: `attribute`, `distribution`, `foliageCluster`, `glowLight`, `grassMass`, `instance`, `noiseField`, `noiseGrid`, `points`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Add a character who walks, waves and speaks

Place a ready-made character in a scene and direct it to walk, wave, talk and show emotion on a timeline.

```js
import {scene} from 'explainerkit/core';
import {character, starter} from 'explainerkit/characters';

const drawing = scene({width: 960, height: 540, duration: 8, label: 'A scientist walks in, waves and speaks'});
const ada = character(drawing, starter('bean-scientist'), {x: 160, y: 460, seed: 4});
ada.act('walk', {at: 0.5, duration: 3})
  .act('wave', {at: 4})
  .say('Every invention starts as one point.', {at: 5})
  .emote('happy', {at: 5, duration: 3});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Turn meshing gears and a crank from one angle

Build a mechanism of meshing gears and a crank linkage, sample it from a driving angle and draw it.

```js
import {scene} from 'explainerkit/core';
import {mechanism} from 'explainerkit/mechanisms';

const engine = mechanism();
const driver = engine.gear({id: 'driver', teeth: 20, module: 4});
engine.gear({id: 'driven', x: 100, teeth: 30, module: 4}).meshWith(driver);

const drawing = scene({width: 640, height: 360, duration: 6, label: 'A small gear drives a larger one'});
const angle = drawing.parameter(0, {min: 0, max: 4 * Math.PI});
angle.animate({from: 0, to: 4 * Math.PI, duration: 6, ease: 'linear'});
const state = drawing.derive([angle], (a) => engine.sample(a));

const spokes = (group, r) => { for (let k = 0; k < 6; k++) group.line({x1: 0, y1: 0, x2: r * Math.cos(k * Math.PI / 3), y2: r * Math.sin(k * Math.PI / 3), stroke: '#262d2b', strokeWidth: 3}); };
const small = drawing.group({x: 240, y: 180});
small.circle({r: 40, fill: '#d9a441'});
spokes(small, 40);
small.bind('rotation', {inputs: [state], map: (s) => s.driver.rotation});
const large = drawing.group({x: 340, y: 180});
large.circle({r: 60, fill: '#34766b'});
spokes(large, 60);
large.bind('rotation', {inputs: [state], map: (s) => s.driven.rotation});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Emit seeded particles that can be seeked

Create a deterministic particle emitter and draw its particles at the scene time as a point cloud.

```js
import {scene} from 'explainerkit/core';
import {emitter} from 'explainerkit/particles';

const sparks = emitter({seed: 3, rate: 300, life: 1.6, origin: {x: 320, y: 300}, velocity: {y: -120}, spread: {x: 60, y: 20, z: 0}, acceleration: {y: 40}});
const drawing = scene({width: 640, height: 360, duration: 4, label: 'Sparks rise from a point'});
const t = drawing.parameter(0, {min: 0, max: 4});
t.animate({from: 0, to: 4, duration: 4, ease: 'linear'});
const points = drawing.derive([t], (time) => sparks.cloud(time, {radius: (p) => 6 * (1 - p.progress) + 1, color: (p) => [1, 0.6, 0.2, 1 - p.progress]}));
drawing.rect({x: 0, y: 0, width: 640, height: 360, fill: '#1c2023'});
drawing.cloud({pointShape: 'glow', pointBlend: 'add'}).bind('points', {inputs: [points], map: (v) => v});

export const player = await drawing.mount(document.querySelector('#stage'), {renderer: 'canvas'});
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
