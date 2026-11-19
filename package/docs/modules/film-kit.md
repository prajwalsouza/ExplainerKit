# Film kit: light, depth, machines and type

These modules combine point clouds, 3D line art, mechanisms and type for scroll-driven films. Tests in `tests/modules/film-features.test.js` and `tests/browser/cloud-checks.html` cover the supported operations.

Each operation computes its frame from the requested time and inputs so backward seeking reproduces the same result. Inputs are copied and validated, and unsupported values report errors rather than being guessed. The sections below introduce the individual tools and their renderer limits.

## Draw a hundred thousand points

```js
const sparks = emitter({ seed: 3, rate: 900, life: 1.6, origin: { x: 440, y: 420 }, velocity: { y: -90 } });
const flame = drawing.derive([time], t => sparks.cloud(t, {
  radius: p => 9 * (1 - p.progress) + 1,
  color: p => [1, .7, .2, 1 - p.progress],
}));
drawing.cloud({ pointShape: 'glow', pointBlend: 'add' }).bind('points', { inputs: [flame], map: v => v });
```

`drawing.cloud(props)` is a scene node that holds many points and counts as one node toward the 10,000-node cap.

| Property | Default | Meaning |
| --- | --- | --- |
| `points` | empty | `{positions, radii?, colors?}`. Positions are x,y pairs; radii one per point; colors straight-alpha RGBA in 0–1. Arrays or `Float32Array`; always copied. At most 200,000 points per node and 1,000,000 per frame. |
| `pointSize` | 2 | Radius for every point when `radii` is absent. |
| `pointShape` | `circle` | `circle`, `square` or `glow` (soft falloff to the edge). |
| `pointBlend` | `normal` | `add` adds each point's light to whatever lies beneath it. |
| `fill` | `#132d3c` | Point color when `colors` is absent. Solid colors only. |

Choose a renderer according to the cloud size and the platform capabilities described below.

- **Canvas** draws clouds of 1,500 points or more through one WebGL2 rasterizer and composites them in place, so clips, opacity, blend modes and draw order still apply. Smaller clouds, and platforms without WebGL2, draw as 2D paths. `createCanvasRenderer(el, {points: 'auto' | 'gpu' | 'cpu', gpuThreshold})` overrides the choice; `gpu` reports `RENDER_UNSUPPORTED` instead of falling back.
- **SVG** draws one element per point and refuses clouds over 5,000 points (`capability: 'cloud.svgPoints'`) before changing its last frame.
- **Three.js** reports clouds as unsupported.

Equal-count clouds interpolate point by point in `createTransition`; different counts switch like other categorical values. `gradeFrame` grades per-point colors.

`emitter.cloud(time,{radius,color})` writes point data directly into typed arrays using the same calculations as `particle()`. Each radius or color callback receives `{id,age,progress,life,x,y}` for one particle. A recorded Chrome measurement sampled and drew 100,000 particles in about 12 ms. This describes that local workload rather than a frame-rate guarantee.

## Depth: far sides, order and a rolling map

```js
const space = drawing.space({ camera, order: 'depth', backfaces: 'fade', backOpacity: .2 });
const grid = space.surface({ radius: 130, columns: 36, rows: 18 });
const land = space.mapLines(coastlines, { radius: 130, stroke: '#e9dcc0' });
for (const o of [grid, land]) o.bind('wrap', { inputs: [roll], map: v => v });
space.cloud(time => cityLights(time), { radius: 2, center: { x: 0, y: 0, z: 0 }, backfaces: 'hide', pointBlend: 'add' });
```

- **Back faces.** A normal describes which way a surface faces. Geometry that supplies normals through `sphereLines`, `surface`, `mapLines` or `wireframe({normals})` can classify edges as facing toward or away from the camera. Choose `backfaces:'show'|'fade'|'hide'` and `backOpacity` for a space or object. This works as a facing test for approximately convex surfaces, but it does not remove every hidden line. Interleaving objects can still draw over one another’s front edges.
- **Order.** `order:'depth'` sorts front and back layers by mean camera depth on every frame, with the farthest first. Handles then have `node:null` because their drawing moves between slots. The default `order:'authored'` keeps a fixed node per layer.
- **Curl.** The default `surface({bend:'curl'})` rolls a flat longitude/latitude map onto a sphere of radius `radius / wrap`. The sphere touches the starting plane at longitude 0 and latitude 0. Distances along the equator and central meridian stay unchanged so the map rolls up instead of shrinking through the globe. Select `bend:'linear'` for a straight interpolation or call `wrapPoint(lon,lat,radius,wrap,bend)` for individual positions.
- **Map lines.** `mapLines(polylines,{radius,step})` accepts `{lon,lat}` points in degrees. It subdivides segments longer than `step`, defaulting to 2 degrees, so they follow the surface, and uses the same `wrap` parameter.
- **3D clouds.** `space.cloud(source,{radius,center,backfaces,attenuate,pointShape,pointBlend,fill})` projects `[{x,y,z,radius?,color?}]` or xyz `Float32Array` data into one cloud node. The source may be a time function or derived input. In perspective, radius decreases with distance unless `attenuate:false` is set. With `center`, points on its far side may fade or hide.

## Gears that mesh

```js
const m = mechanism();
const a = m.gear({ id: 'a', x: 380, y: 270, teeth: 36, module: 6 });
const b = m.gear({ id: 'b', x: 542, y: 270, teeth: 18, module: 6 });
b.meshWith(a, { phase: 'interlock' });
const pose = m.derive(drawing, angle);
drawing.path({ fill: 'none', stroke: '#f2a541' })
  .bind('commands', { inputs: [pose], map: p => gearPath({ teeth: 36, module: 6, x: 380, y: 270, rotation: p.a.rotation, bore: 20 }) });
```

`gearPath({teeth,module,pressureAngle=20°,x,y,rotation,samples,bore})` draws a closed gear using involute tooth curves. Its pitch radius is `teeth × module / 2`. The tooth extends one module above that radius and 1.25 modules below it, called addendum and dedendum respectively. Before rotation, one tooth is centered on +x. Supply `bore` for a center hole and use `fillRule:'evenodd'` when filling it. The accepted tooth count is 6–400. Gears with fewer than 17 teeth are drawn without undercut correction.

`meshWith(other,{phase:'interlock'})` rotates the driven gear so its gap faces the driver’s tooth along the line between their centers. Use `meshPhase(driverSpec,drivenSpec)` when calculating that angle yourself. A full-revolution test measured a deepest overlap of 0.0003 units at module 2, representing tangent contact in that fixture.

## Cut any outline

```demo design-pretzel-logic
Twist the plot. Move the right pretzel ring into the left. Joining their outlines recomputes the boundary and the holes, so the stroke can follow the new outline.
```

```js
import { booleanPath } from 'explainerkit/geometry/shapes';
const chipped = booleanPath('subtract', flintCommands, flakeCommands);
stone.set({ commands: chipped.commands });
```

Use `booleanPath('union'|'intersect'|'subtract',a,b,{tolerance})` to combine, intersect or subtract outlines that may contain concave sections and holes. Inputs are path commands or arrays of `{x,y}` loops. Curves are approximated with straight segments within `tolerance`, which defaults to .25.

Nested loops determine filled regions using the even-odd rule. The result orients outer boundaries counterclockwise and holes clockwise so either fill rule can draw it and strokes follow the remaining boundaries. It returns `{commands,loops,area}`. `unionPaths`, `intersectPaths`, `subtractPaths` and `pathLoops` provide shortcuts. Each operand is limited to 20,000 vertices.

The convex `union`/`subtract`/`intersect` remain for partitions (`fracture`, split and merge), whose pieces must be convex.

## Look: grade and firelight shadows

```js
drawing.grade({ saturation: lightsOn, exposure: -.5, shadows: '#102040', highlights: '#ffe0a0', duotone: dusk });
const { commands, scale } = shadowOnWall(figure, { light: { x: 440, y: 410, z: 0 }, depth: 1, wall: 1.9 });
```

`gradeFrame` and `drawing.grade` take `saturation` (0–4), `exposure` (stops, −8–8), `contrast` (0–4, around mid-gray), `tint` color with `tintAmount` (0–1), and `shadows`/`highlights` colors with `duotone` (0–1) for a luminance map. Numeric controls accept numbers or this scene's inputs. They apply in that order to fills, strokes, gradient stops, glow colors and cloud point colors, before compositing.

`shadowOnWall(commands,{light:{x,y,z},depth,wall})` projects a figure’s outline from a light onto a wall behind it. Each point follows the ray from the light, giving a scale of `(wall − light.z) / (depth − light.z)` around the light’s position. This transform preserves curves exactly. Scale the returned blur with `scale` when a larger shadow should also be softer.

## Type: WOFF, kerning and variable axes

- `loadFont` decodes **WOFF 1.0** through zlib using the platform’s `DecompressionStream`. Use it for WOFF rather than synchronous `parseFont`. **WOFF2** and **CFF/OTF** outlines report `FONT_FORMAT_UNSUPPORTED` and must be converted to supported TrueType outlines first.
- `textOutline(font,text,{kerning:true})` adjusts spacing between letter pairs. It reads GPOS PairPos formats 1 and 2 through the `kern` feature, including extension lookups, or the older `kern` table. `diagnostics.kernedPairs` counts adjustments.
- `textOutline(font,text,{axes:{wght:700}})` changes a variable TrueType font’s outline using `avar` remapping and `gvar` variation data. Supported forms include shared and embedded peaks, intermediate regions, private and shared point numbers, IUP interpolation for unchanged points, composite offsets and advance widths through phantom points. Checks against fontTools 4.60 on New York and SF Pro found identical bounds and advances at tested weights and optical sizes.
- These operations do not provide a complete shaping engine. GSUB substitutions, mark positioning, bidirectional layout, hinting and kerning device-table variation deltas remain unsupported.

## Story acts

`attachStory(player,{onAct,reset})` can notify your application when scrolling reaches another act. Its `onAct(id,index)` callback can call `preload(...).updateAct(id)`, while `story.act` reports the current act. By default `reset:true` restores authored parameters on each scroll seek. A hold does not seek, so slider changes made during it survive until scrolling resumes. Set `reset:false` to keep those changes across scrolling.

`attachStory` also lays out sticky step cards per act (`steps`, with `active`, a phone layout and `onProgress(id, u)`), and renders a hold's `controls` as range inputs that `override()` an animated parameter until the reader leaves the hold. See [story delivery](story-delivery.md#step-cards).

## Scene prebuild

By default, `film({...,prebuild:1})` prepares the next scene in a hidden layer before it is needed. It builds, lays out and renders during idle time through `requestIdleCallback`, or `setTimeout` when unavailable, and in any case 4 seconds of playback before the boundary. Crossing into that scene can then swap layers instead of building it at the boundary.

Seeking into the prepared scene reuses it, while seeking elsewhere builds on demand. The prepared scene is discarded when it is no longer next and released by `dispose()`. Read its index through `film.prebuilt`, which is null when none is waiting. Set `prebuild:0` to build only when needed.

A build function can run up to one scene before it becomes visible. Reassign a top-level store key, such as `film.store.pens = [...]`, when its value changes. A change after preparation discards the waiting scene so it can be rebuilt at the boundary, whereas modifying a stored object in place is not tracked. If early preparation throws, that copy is discarded and the build at the boundary reports the error.

Prebuilding moves construction cost away from the scene boundary rather than removing it. A local headless Chrome check at 1280×800 on a birthday film study measured boundary frames of 467, 517 and 150 ms without preparation and 33–50 ms with it. If playback never idles, preparation still costs one frame at least 4 seconds before the boundary.

## Optional three.js tests

Run `npm run setup:three` to place the optional Three.js module in `.local/three` before running its test suites. `npm test` and `npm run test:browser` include those suites when that module is present. Use `--no-three` to skip the browser suite or `THREE_TEST_MODULE` to select a different copy.

## Film craft modules

The film kit works with [light/textures/motion blur](film-rendering.md), [depth/focus](depth-layers.md), [follow-through](secondary-motion.md), [lattice controls](deformation.md), [keyframes](keyframes.md), and the [timeline editor](timeline.md). A local audio file can drive playback through the [media adapter](media-clock.md). Its explicit export hook supports the [PNG/video exporter](export-film.md). [Design SVG import](svg-design-import.md) documents representative-file fidelity and precise refusals.
