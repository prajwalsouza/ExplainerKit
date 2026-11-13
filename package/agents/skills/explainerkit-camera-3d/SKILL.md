---
name: explainerkit-camera-3d
description: "Use when moving a camera through a large scene, zooming between scales, drawing 3D line art or solid Three.js scenes, parallax, grading the look of a frame, or placing a graphic on tracked footage with the ExplainerKit JavaScript library. Covers explainerkit/camera, explainerkit/spatial, explainerkit/vfx, explainerkit/zoom, explainerkit/parallax, explainerkit/look, explainerkit/renderers/three, explainerkit/renderers/webgl, with tested recipes and the exact option vocabularies."
---

# Camera, 3D and visual look

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/camera`: Camera control, transforms, framing, depth, focus and shutter math. Read `docs/modules/camera-choreography.md`, `docs/modules/depth-layers.md`.
  Exports: `Camera`, `MAX_CAMERA_ZOOM`, `MIN_CAMERA_ZOOM`, `cameraDefaults`, `cameraMatrix`, `fitRegion`, `focusBlur`, `invertMatrix`, `layerPose`, `multiplyMatrices`, `projectLayer`, `shutterTimes`, `transformPoint`, `worldPose`.
- `explainerkit/spatial`: First-party 3D transforms, projection and picking. Read `docs/modules/spatial-three.md`.
  Exports: `boxLines`, `compose3D`, `direction3D`, `dollyCamera`, `identity3D`, `inverse3D`, `lookAt3D`, `multiply3D`, `multiplyQuaternion`, `orbitCamera`, `orthographicCamera`, `perspectiveCamera`, `pickBounds`, `projectLines`, `projectPoint`, `projectPoints`, `quaternion`, `quaternionFromAxisAngle`, `quaternionFromEuler`, `quaternionMatrix`, `rayBox`, `rayPlane`, `raySphere`, `rotateVector3D`, `screenRay`, `slerpQuaternion`, `sphereLines`, `transform3D`, `unprojectPoint`, `wireframe`, `worldMatrix3D`, `zoomCamera`.
- `explainerkit/vfx`: Recorded footage analysis, camera track preparation with default stabilization, point and plane tracking, and compositing. Read `docs/modules/video-vfx.md`.
  Exports: `adjustMatte`, `analyzeFootage`, `analyzeFrame`, `applyDepthHoldout`, `compileCameraTrack`, `compileFlow`, `compileTrack`, `compositeMatte`, `flowStreaks`, `foregroundHoldout`, `measureFlow`, `projectSurface`, `sampleFlow`, `sampleTrack`, `stabilizeCameraTrack`, `stabilizeTrack`, `surfaceTransform`, `traceFlow`, `trackPlane`, `trackPoint`.
- `explainerkit/zoom`: Nested coordinate systems and detail that changes with screen size. Read `docs/modules/deep-zoom.md`.
  Exports: `bindFrame`, `convertFramePoint`, `convertFrameVector`, `detail`, `detailLevels`, `frameView`, `logZoom`, `rebaseCamera`, `referenceFrame`, `relativeRotation`, `relativeUnits`, `zoomTransition`.
- `explainerkit/parallax`: Depth-layer relationships for scroll presentation. Read `docs/modules/parallax.md`.
  Exports: `PARALLAX_RULES`, `auditParallax`, `connectParallax`, `coverage`, `depthFor`, `fitBackdrop`, `formatParallax`, `parallaxRig`, `speedFor`, `storyPins`, `storyRate`.
- `explainerkit/look`: Visual effects and color adjustments, with resource limits. Read `docs/modules/look.md`.
  Exports: `alphaMask`, `filmGrain`, `glow`, `gradeFrame`, `shadowOnPlane`, `shadowOnWall`.
- `explainerkit/renderers/three`: Explicit optional Three.js rendering with reversible owned-material palettes. Read `docs/modules/spatial-three.md`, `docs/modules/three-material-palettes.md`.
  Exports: `createThreeAdapter`, `createThreeRenderer`, `darkClay`.
- `explainerkit/renderers/webgl`: Native WebGL point/line buffers. Read `docs/modules/webgl-points.md`.
  Exports: `capturePointFrame`, `createWebGLRenderer`, `projectGPUPoint`, `screenProjection`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Move a camera between regions of a large world

Register named regions in a big scene and choreograph camera shots: frame, cut, zoom and whip pan.

```js
import {scene} from 'explainerkit/core';

const drawing = scene({width: 960, height: 540, duration: 7, label: 'The camera visits a small detail and returns'});
for (let i = 0; i < 40; i++) drawing.circle({x: 60 + (i % 10) * 200, y: 60 + Math.floor(i / 10) * 260, r: 18, fill: '#cfd8d2'});
const star = drawing.circle({x: 1560, y: 860, r: 30, fill: '#a74a2d'});
drawing.text({x: 1500, y: 930, text: 'the detail', fontSize: 28, fill: '#262d2b'});

drawing.region('overview', {x: 0, y: 0, width: 2000, height: 1125});
drawing.region('detail', {x: 1360, y: 720, width: 480, height: 270});
drawing.camera().shots([
  {at: 0, frame: 'overview'},
  {at: 1, frame: 'detail', duration: 1.6, ease: 'easeInOut'},
  {at: 4.5, whipPan: 'overview', duration: 0.9},
]);
void star;

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Draw rotating 3D line art inside a 2D scene

Add a perspective space to a scene and animate a wireframe sphere and box without Three.js.

```js
import {scene} from 'explainerkit/core';
import {perspectiveCamera} from 'explainerkit/spatial';

const drawing = scene({width: 640, height: 400, duration: 6, label: 'A wireframe globe turns beside a box'});
const space = drawing.space({camera: perspectiveCamera({z: 600}, {width: 640, height: 400})});
const globe = space.sphereLines({radius: 110});
globe.set({x: -110});
globe.to(0, {rotationY: 2 * Math.PI}, {duration: 6, ease: 'linear'});
const box = space.box({width: 90, height: 90, depth: 90});
box.set({x: 150});
box.to(0, {rotationX: Math.PI, rotationY: Math.PI}, {duration: 6, ease: 'linear'});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

### Place an annotation on a tracked surface

Sample a saved planar track and pin an ExplainerKit annotation to the surface.

```js
// For a 3D insert, prepare the fitted poses with compileCameraTrack before projection.
// Camera track compilation repairs isolated pose spikes by default.
import {scene} from 'explainerkit/core';
import {compileTrack, projectSurface, sampleTrack} from 'explainerkit/vfx';

const drawing = scene({width: 640, height: 360, duration: 2, label: 'Follow a recorded surface'});
const track = compileTrack({kind: 'plane', samples: [
  {time: 0, value: [{x: 85, y: 92}, {x: 410, y: 88}, {x: 405, y: 255}, {x: 72, y: 252}]},
  {time: 2, value: [{x: 211, y: 105}, {x: 553, y: 74}, {x: 565, y: 230}, {x: 213, y: 263}]},
]});
const initial = projectSurface(sampleTrack(track, 0), 0.65, 0.5);
drawing.rect({x: 0, y: 0, width: 640, height: 360, fill: '#182321'});
const marker = drawing.circle({x: initial.x, y: initial.y, r: 11, fill: '#76e4ba'});
const label = drawing.text({x: initial.x + 20, y: initial.y, text: 'Signal path', fill: '#eff8f4', fontSize: 24});
const player = await drawing.mount(document.querySelector('#stage'), {controls: false});

// Call this with the presented clip time when composing over a video.
export function seek(seconds) {
  const surface = sampleTrack(track, seconds);
  if (!surface) return;
  const anchor = projectSurface(surface, 0.65, 0.5);
  marker.set({x: anchor.x, y: anchor.y});
  label.set({x: anchor.x + 20, y: anchor.y});
  player.seek(seconds);
}
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
