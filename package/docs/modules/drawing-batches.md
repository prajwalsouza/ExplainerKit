# Drawing, correspondence and batch sampling

Use `Line` to measure or trim a path, `samplePath` to place points along its visible length, `pairPoints` to match two point sets, and `inkStroke` to turn a centerline into a filled ribbon. Import them from `explainerkit/geometry`. They prepare geometry and data without creating a player, changing scene nodes or guessing the intended transition.

```js
import {Line, outlineDraw, samplePath, pairPoints, inkStroke} from 'explainerkit/geometry';
const path = [['M',0,0],['L',100,0],['M',150,0],['L',200,50]];
const line = new Line(path, {tolerance: .1});
const position = line.at(.4); // {x,y,rotation,contour}; radians
const revealed = outlineDraw(path, {progress: .6, mode: 'length'});
const samples = samplePath(path, 100);
const pairs = pairPoints(samples, targetSamples, {by: 'nearest'});
const ink = inkStroke(path, {width: u => 2 + 3*Math.sin(Math.PI*u), taper: .1,
  tremor: .2, seed: 7, samples: 256});
```

`Line` copies M/L/Q/C/Z commands and measures each continuous contour separately. Its total `length` includes drawn segments but excludes jumps between contours. `at(u)` selects a fraction from [0,1] and chooses the earlier contour at an exact boundary.

`trim(start,end)` returns move and line commands for the selected intervals without joining gaps. Equal endpoints return no commands, so hide or omit the node when there is no visible ink. `outlineDraw` is a convenience for `trim(0,progress)`, while `mode:'each'` reveals each contour by its own fraction. A complete reveal closes closed contours with a final line. Keep compound fills separate from these strokes so holes retain their fill rule.

```demo design-snail-signature
Drag the ink nib or use the arrow keys to trace a snail’s two-stroke signature. When the ink takes a pen lift, the snail takes a leap.
```

Curves are measured by approximating them with shorter straight segments. The default `tolerance` is .25 local units, and `maxPoints` defaults to 8192 per contour with a maximum of 32768. The whole path can contain 1–1024 contours with nonzero length and no more than 32768 prepared points. Generated output must also fit the 10000-command path limit. These are limits on an approximation rather than exact symbolic curve lengths.

Use `samplePath(path,n,options)` to obtain 1–8192 immutable `{x,y}` positions spaced by distance over the total drawn length. A single closed contour omits its duplicated endpoint, and requesting one point returns the start. This gives the point samples that `pairPoints` can match to another path.

`pairPoints(from,to,{by})` matches two equal-sized arrays of 0–8192 points. Each point needs finite x and y coordinates and may include z. The function copies the inputs and returns `{from,to,fromIndex,toIndex}` records in source order. Every source point has one target and every target is used once, but the function does not infer which points represent the same real object.

Choose `by:'arc'` to pair the existing order, using `samplePath` first when that order should follow distance along an outline. Choose `by:'x'` to sort each set by x, then y, then original index. The default `nearest` takes each source point in order and selects its closest unused target, resolving ties by the lowest target index. That mode accepts at most 2048 points. It is repeatable, but making each choice greedily does not guarantee the smallest total distance across all pairs.

`inkStroke` turns each contour’s centerline into a closed ribbon that you can draw as a filled path with `stroke:'none'`. Set `width` to a nonnegative local-unit number for a constant width, or supply a function that receives progress measured over the total drawn length. The width function must finish synchronously, return a finite nonnegative number and give the same result for the same input. It must not depend on changing random state, a hidden clock or other side effects. Invalid returned widths are rejected.

Use `taper` in [0,.5] to narrow each contour’s ends. `tremor` adds a limited, repeatable displacement perpendicular to the line, measured in local units. Its `seed` is an unsigned 32-bit integer. The `samples` option defaults to 256 and accepts 2–2048 centerline samples, distributed in proportion to contour length with at least two per contour.

The ribbon closes with flat butt caps rather than rounded caps, and the sampled edges form its joins. Wide ribbons or sharp turns can cross themselves. The function does not merge overlapping ribbon regions, read a pressure device, create round joins or guarantee a crossing-free outline. Those limits still apply even though sampling the same inputs at different times reproduces the same ribbon.

## Batched spatial projection

```js
import {perspectiveCamera, projectPoints} from 'explainerkit/spatial';
const camera = perspectiveCamera({}, {width:960,height:540});
const result = projectPoints(camera, new Float32Array([0,0,0, 10,20,30]));
// result: {count, positions: Float64Array(xy...), depths: Float64Array,
//          cameraDepths: Float64Array, visible: Uint8Array}
```

`projectPoints` converts many 3D positions into screen positions using one prepared camera. Supply up to one million points as x/y/z triples in a `Float32Array` or `Float64Array`, with coordinates within ±10,000,000. The function copies and validates the inputs before reusing the camera’s matrices for the projection loop. It prepares data without creating a renderer or uploading anything to the GPU.

The result’s `positions` measure x and y from the screen’s upper-left corner. `depths` run from 0 to 1 within the camera’s visible volume, called its frustum. `cameraDepths` measure distance along the camera’s depth axis and are positive in front of it. Points outside the view or behind the camera remain in the arrays with `visible[i] === 0` rather than being removed or clamped. A point whose projection would require division by zero reports `PROJECTION_AT_INFINITY`.

The returned record cannot be changed, but its new numeric buffers belong to you and may be edited. Changing them does not alter the source positions that were supplied for projection.

## Batched coherent noise

```js
import {noiseGrid} from 'explainerkit/procedural';
const values = noiseGrid({columns:160, rows:80, x:0, y:0,
  stepX:.1, stepY:.1, scale:1, time:2, seed:7});
```

Use `noiseGrid` when you need many neighboring samples of the same noise field. It returns a new `Float64Array` in row order, with scalar values in [-1,1]. Each entry equals `noiseField({seed,scale})(x,y,time)` at that grid position, so batched and individual sampling describe the same field.

`stepX` and `stepY` default to 1 and may be zero or negative. The x, y and time origins default to 0, scale defaults to 1, and seed defaults to 0. Rows and columns must be positive integers with at most one million samples in total. Coordinates, including the grid’s farthest scaled positions, are validated before noise is evaluated. There is no advancing random generator or previous-frame state, so returning to the same time and coordinates returns the same values.

Tests in `tests/modules/drawing-batch.test.js` check that separate contours stay separate and that measured positions agree with known path lengths. They also verify one-to-one point matching, ribbon width and taper, repeatable noise and tremor, agreement between batch and individual projection, and SVG import behavior in Node. These check geometry and data handling rather than the visual quality of a complete film transition.

Run `node benchmarks/drawing-batches.mjs` to compare batching with individual calls on the current machine. The synthetic workload uses 3300 projections and 13000 noise samples with four warmups and 20 measurements. Projection timing includes input copying and output allocation. The results describe that Node workload and do not guarantee a browser frame rate.