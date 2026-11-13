# Connected constructions

Build shapes from paths, repeat them along a curve, or connect measurements to their position and appearance. These tools work with SVG and Canvas. Use the sections below to choose an operation and understand its limits.

| Task | Tools | Guide |
| --- | --- | --- |
| Move connected parts toward several targets. | Choose target priorities, endpoint angles and which way joints bend. | [Advanced rigs](advanced-rigs.md). |
| Place connected parts along a curve. | Measure positions by distance along the curve and turn each part to follow the curve’s direction. | [Advanced rigs](advanced-rigs.md). |
| Construct shapes and repeat them. | Create paths, transform them, and calculate positions for repeated shapes. | This guide. |
| Change complex shapes and add or remove objects. | Name path outlines, blend colors, and fade objects in or out. | This guide. |
| Map measurements to visual properties. | Map numbers or categories to positions, convert units, and prepare chart shapes. | [Data modeling](data-modeling.md). |
| Reveal, crop and paint layered artwork. | Define clipping regions, choose how holes are filled, and add local gradients. | [Graphics](graphics.md). |

The examples assume `drawing` is an existing scene and `progress` is a scene parameter from 0 to 1. Start with [Getting started](../getting-started.md) if you have not created a scene yet.

## Construct the form

```js
import {
  ellipsePath, starPath, roundedRectPath, regularPolygon,
  polygonPath, transformPath, measurePath,
  gridPlacements, radialPlacements, pathPlacements,
} from 'explainerkit/geometry';

const outline = drawing.path({
  commands: starPath({points: 6, outerRadius: 80, innerRadius: 45}),
});
```

Each shape function returns an array of path commands that cannot be changed in place. The commands use absolute coordinates and describe a move (M), line (L), quadratic curve (Q), cubic curve (C) or closure (Z). SVG and Canvas accept these same commands, with scene units for coordinates and radians for angles. Pass the array to `drawing.path()` to create a scene object. The geometry function prepares its outline without drawing or starting playback.

| Function | Parameters and defaults | Behavior and limits |
| --- | --- | --- |
| `polygonPath(points, options)` | `[{x,y}]`, `closed:true` | Supply 3–9999 points for a closed polygon or at least 2 for an open path. |
| `regularPolygon(options)` | `sides:6`, `radius:50`, `x:0`, `y:0`, `rotation:-π/2` | Choose 3–4096 sides and a positive radius. |
| `starPath(options)` | `points:5`, `outerRadius:60`, `innerRadius:outerRadius*.5`, center 0, rotation −π/2 | Choose 2–2048 star points. The inner radius must be positive and no larger than the outer radius. |
| `ellipsePath(options)` | `x:0`, `y:0`, `rx:50`, `ry:rx`, `rotation:0` | Four cubic quarter-arcs meet at the exact top, bottom, left and right points of the ellipse. The curve between them is an approximation. |
| `roundedRectPath(options)` | `x:0`, `y:0`, `width:100`, `height:60`, `radius:12` | The radius is clamped to half the smaller dimension. Cubic curves approximate the corners. |
| `transformPath(commands, options)` | `x:0`, `y:0`, `rotation:0`, `scaleX:1`, `scaleY:1` | Every endpoint and control point is scaled, then rotated, then translated. |

Dimensions and radii must not exceed 100,000, and final coordinates must remain within ±10,000,000. A negative scale reflects the path, while a zero scale can collapse it. Validation rejects arrays with empty slots or getters, invalid counts and outputs beyond the supported range. It does not detect self-intersections or establish that a shape is physically possible.

## Let distance drive position

```js
const route = measurePath(commands, {tolerance: .1});
const location = route.at(.4); // {x, y, rotation}
marker.bind(['x','y','rotation'], {
  inputs: [progress], map: value => route.at(value),
});
const visibleSegment = route.trim(.2, .8);
```

`measurePath(commands,{tolerance=.25,maxPoints=8192})` measures one continuous path that has nonzero length. It approximates curves with short straight segments and limits how many points that approximation can contain. The result exposes `length`, `closed`, `points`, `at(fraction)` and `trim(start,end)`.

Pass a fraction from 0 to 1 to `at` to choose a position by distance along the path. This differs from passing a Bézier curve’s own parameter, which need not move at a constant speed. Rotation follows the direction of the selected straight segment, called its tangent. At an exact corner the incoming segment supplies that direction. On a closed path, fraction 1 gives the final point and the closing segment’s direction rather than wrapping to fraction 0.

`trim(start,end)` returns the part of the approximation between the two fractions as an open path of move and line commands, including any vertices in between. The end fraction must follow the start fraction. Equal fractions return a single move command.

The result is a measured path segment rather than a dash effect or an exact Bézier subcurve. Its length and direction are approximate, with error controlled by `tolerance`. Zooming in also magnifies that error. Measure separate contours individually when a shape contains more than one continuous path.

## Repeat a construction

```js
const placements = radialPlacements({count: 12, radius: 100});
const source = drawing.data(placements, {key: 'index'});
const marks = drawing.repeat(markComponent, {data: source});
marks.bind('x', {field: 'x'});
marks.bind('y', {field: 'y'});
marks.bind('rotation', {field: 'rotation'});
```

Each placement is an immutable `{index,x,y,rotation}` record. Its integer index identifies a position in the arrangement rather than a real-world object. Use your own data key when an object must retain its identity after the arrangement changes.

- `gridPlacements({count,columns=count||1,cellWidth=20,cellHeight=20,gap=0,x=0,y=0})` fills a grid row by row. It returns fixed positions and does not rearrange them when the display size changes.
- `radialPlacements({count,radius=100,x=0,y=0,start=0,sweep=2π,orient='tangent'})` spaces positions at equal angles. A full circle omits the duplicated endpoint, while a partial arc includes both ends. Use `orient:'radial'` to face outward or `orient:'none'` to leave rotation at zero. The default tangent orientation follows the direction of travel, including the sign of `sweep`.
- `pathPlacements(commands,{count,start=0,end=1,offset=0,rotate=true,tolerance=.25})` spaces positions by measured distance along a path. The `offset` moves them perpendicular to the path’s direction. A full closed traversal omits the duplicate endpoint, while open paths and partial intervals include both ends. Use `splineRig` when those positions need live scene parameters or attached artwork.

Counts must be integers from 0 to 10,000. A count of zero returns an empty array. These functions calculate positions without simulating particles, automatically rebuilding scene objects when the count changes, or dividing shapes.

## Morph the outside and the opening

A contour is one continuous path. A compound shape can have an outer contour and inner contours for openings. Give each contour an ID so the morph knows which source and target paths correspond.

```js
import {createCompoundMorph} from 'explainerkit/morph';
const form = createCompoundMorph([
  {id: 'outline', commands: ellipsePath({rx: 100})},
  {id: 'opening', commands: ellipsePath({rx: 30})},
], [
  {id: 'opening', commands: regularPolygon({sides: 3, radius: 25})},
  {id: 'outline', commands: starPath({outerRadius: 120})},
]);
const artwork = drawing.path({fillRule: 'evenodd'});
artwork.bind('commands', {inputs: [progress], map: form.sample});
```

Each end of a compound morph contains 1–32 `{id,commands}` contours. IDs tell the morph which outline or opening corresponds to which target, even when the target array uses a different order. Every source contour needs exactly one target with the same open or closed status. You supply that correspondence because the function does not infer which contours are openings.

Configure the morph with `samples`, `tolerance`, `align` and `reverse`. To change one contour independently, put its options under `contours:{id: options}`, where `offset` and `landmarks` are also available. Each contour follows the [single-contour morph contract](rigs-morphing-perception.md#morph-an-outline). The combined output cannot exceed 10,000 path commands. Sampling an exact endpoint returns its original command order, while intermediate samples follow the source contour order.

`sample(progress)` returns the combined path commands, and `inspect(progress)` reports diagnostics for each contour. Check intermediate frames because contours can cross or collapse even when both endpoints look correct. With `evenodd`, each boundary crossing switches between a filled and an empty region. The `nonzero` rule also considers the direction in which each contour was drawn, called its winding. Neither rule proves that openings remain inside an outer boundary throughout the morph. The API does not create or destroy contours, infer semantic splits or merges, or optimize deformation of a mesh.

## Interpolate paint deliberately

```js
import {colorInterpolator} from 'explainerkit/morph';
const paint = colorInterpolator('#278b88', '#db684500', {space: 'linearRGB'});
artwork.bind('fill', {inputs: [progress], map: paint});
```

`colorInterpolator` returns a function that calculates a color from progress without changing either endpoint. It accepts hexadecimal RGB/RGBA values and the core’s supported simple color names. The default `space:'srgb'` interpolates in sRGB. Choose `linearRGB` to decode sRGB into linear-light values before interpolation and encode the result afterward.

Both modes multiply color channels by alpha before interpolation and divide by the resulting alpha afterward. This premultiplied-alpha calculation avoids treating a transparent color as opaque paint. The result is eight-digit hex, with intermediate components clipped to the supported display range and rounded to bytes. Exact endpoints preserve their original spelling.

`none` and gradient descriptors describe different kinds of paint rather than transparent colors, so this function does not interpolate them. It also does not parse arbitrary CSS, interpolate in Oklab or optimize out-of-gamut colors. Its alpha calculation follows [CSS Color 4 §13](https://www.w3.org/TR/css-color/#interpolation). The available color spaces and default behavior are choices made by this library.

## Transition an identified scene

`createTransition` requires matching path commands by default. The options below allow it to morph path outlines or interpolate colors when you explicitly request that behavior.

```js
createTransition(before, after, {
  paths: 'morph',                 // default 'strict'
  pathOptions: {samples: 96},     // only with paths:'morph'
  colors: 'linearRGB',            // default 'discrete'; also 'srgb'
});
```

With `paths:'morph'`, the transition resamples each single-contour path so that different outlines can be interpolated. Use `createCompoundMorph` bindings for compound paths instead. Object IDs, types and parent relationships must still match. Clips and gradients are copied values that switch at the point selected by `discrete:'start'|'end'` rather than being morphed.

Transition preparation also bounds aggregate intermediate output at 100,000 path/clip commands and the conservative per-path alignment work at 8,000,000 sample-pair comparisons. Even when both endpoint frames are valid, a high-resolution morph can exceed these limits and be rejected before playback. Reduce the sample count or transition fewer paths.

Use `createSceneTransition` when objects must enter or leave between the two frames.

```js
import {createSceneTransition} from 'explainerkit/morph';
const change = createSceneTransition(before, after, {
  unmatched: 'fade', colors: 'srgb',
});
```

The default `unmatched:'error'` rejects objects that appear at only one endpoint. With `unmatched:'fade'`, the transition includes IDs from both frames and fades the root of each entering or leaving subtree. Its descendants do not receive an additional repeated fade. Objects present at both endpoints interpolate normally.

During the transition, existing siblings keep their source stacking order and new target-only siblings are appended. At progress 1 the target order is restored. Exact endpoint samples omit objects absent from that endpoint. The combined frame must still fit the snapshot and renderer limits.

You declare which objects enter and leave by supplying the endpoint frames. The function does not infer semantic matches or decide how an object should split or merge. An object present at both endpoints cannot change type or parent. Its endpoint geometry determines its movement, without automatic layout or collision avoidance. Samples are immutable and reproduce the same result when seeking forward or backward.

## Integration boundaries

Pass a trusted data-scale function as `scale` in a keyed collection binding to map row values onto properties. Replacement data is validated before the collection changes, and processing it does not change story time. Rig goals use the scene’s existing parameters and derived values. Path rigs and their attachments share a `together` tag so layout treats them as one unit. Clips and gradients remain available in captured frames for either renderer.

The demo combines five constructions with controls for seeking and switching between SVG and Canvas. Native tests compare geometry and numeric results against independent calculations. Browser tests inspect pixels for clips and paint, along with attached rig positions. See [status](../foundation-status.md) for recorded results and unfinished modules. These tests establish the behavior of the measured examples rather than equivalence to every feature of professional animation software.