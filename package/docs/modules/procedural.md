# Procedural fields and instances

Use `explainerkit/procedural` to generate repeated artwork from points and attributes. Start with `points` to choose positions, add properties with `attribute`, then draw them with `instance`. A `distribution` can turn measured samples into varied sizes or categories, and `noiseField` can vary a property through space and time. Every result is computed from an explicit seed, inputs and time without a separate animation loop, simulation history or runtime dependency.

```js
const field = points({seed: 3, count: 600, in: {rect: [0, 0, 960, 540]},
  method: 'poisson', minDistance: 12});
const sizes = distribution.fromSamples([1, 1, 1.5, 2, 3]);
const flicker = noiseField({seed: 7, scale: .02, speed: .8});
const stars = attribute(field, {
  size: p => sizes.sample(p.rand),
  alpha: (p, t) => .7 + .3 * flicker(p.x, p.y, t + p.rand2),
});
const artwork = instance(scene, stars, p => ({type: 'dot', r: p.size, fill: '#ffffff'}));
```

## Points

`points({seed=0,count=100,density,in,method='random',minDistance,spacing,jitter=0})` captures up to 100,000 points. Choose a count or a density measured in points per square scene unit. Supply the region through `{rect:[x,y,width,height]}`, `{circle:[x,y,radius]}` or `{polygon:commands}` for one closed contour. Polygon containment flattens curves at 0.1-unit tolerance and does not support holes or multiple contours.

You can also supply a circle, rectangle or path handle. The helper captures its world outline at time zero with parent transforms included, rather than binding to later deformation. Strokes and effects are ignored. Groups, rounded rectangles and unsupported multi-contour paths are rejected.

Choose `random`, `poisson`, `grid` or `hex` according to how points should be arranged. Random placement in circles distributes points uniformly by area. Poisson sampling checks proposals across the region before growing around active points when needed, which avoids concentrating a count-limited result near one seed. Its local growth follows [Bridson, 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf) with 30 local attempts as an implementation choice. The code is ExplainerKit's own implementation.

Spacing is checked after conversion to Float32 so returned coordinates retain the declared minimum distance. An infeasible or exhausted request throws `PROCEDURAL_SATURATED` instead of silently returning fewer points, and the 20-million candidate and geometry-operation cap throws `RESOURCE_LIMIT`. Arbitrary polygons and densities may exceed those limits. Grid and hex spacing use scene units, while grid jitter is a cell fraction from 0 through .49. Jittered grids do not guarantee a minimum distance.

Use `points({along:commands,count,spacing,jitter,seed,tolerance=.1})` to place points by distance along a path. Choose count or spacing. Open paths include the last exact spacing multiple, while closed paths omit a duplicate point at the seam. Jitter moves a point perpendicular to the path in scene units, and `rotation` records the sampled tangent. Curve spacing follows the flattened approximation rather than exact symbolic arc length.

The returned point set exposes `count`, `seed`, `x`, `y`, `diagnostics`, `rand(i,channel=0)` and `sample(time=0)` in a frozen wrapper. Its `x` and `y` getters return independent Float32Array copies whose elements you may edit locally. Those edits do not change the private field or artwork already created from it. Freezing the wrapper does not claim to freeze typed-array elements. Point indices and random channels must be integers, and channels range from 0 to 65,535.

## Attributes and noise

Call `attribute(field,columns)` or `attribute(field,name,callback)` to add properties to a captured field. A column can be one numeric value, a captured value for each point, or a trusted `(point,time)=>value` function. Values may be finite numbers, strings up to 200 characters, booleans or null, and a field supports at most 16 column operations. Functions receive a frozen point view containing `i,x,y,rand,rand2,rand3,rand4` and earlier columns. Reserved coordinates and random fields cannot be overwritten.

Columns are evaluated in declaration order. Function columns run afresh at every requested time even when the function declares only one argument. Invalid initial results are rejected before artwork is added. A later invalid result becomes a named sample error and prevents the player from committing a new frame.

`noiseField({seed=0,scale=1,speed=1})` returns `noise(x,y,time=0)`, a numeric field in [-1,1] that varies smoothly between nearby coordinates. Scale controls spatial frequency in inverse scene units, and speed scales its time coordinate. It uses ExplainerKit's value-noise implementation. Use the result to vary flicker or deformation, without treating it as a measured model of fire or physiology.

## Instances and batching

Call `instance(scene,field,shapeOrFunction,{batch='auto',tag})` after preparing the positions and attributes. It returns `{handle,count,nodeCount,batches}` so you can control the resulting artwork and inspect its node count. Supply a shape descriptor, a `(point,time)=>descriptor` function or local M/L/Q/C/Z path commands. The table below lists the supported built-in shapes.

| Type | Size inputs | Rendering |
| --- | --- | --- |
| dot, glow | `r` or `size` sets the radius. | The result is a point cloud. |
| square | `r` or `size` sets half the side length. | It uses a cloud when unrotated and a path otherwise. |
| sparkle | `r` or `size` sets the outer radius. | It draws a four-tip star path. |
| ring | `r` sets radius and `thickness` defaults to `.2r`. | It draws outer and inner contours with opposing winding. |
| tongue | `width`, `height` and `wobble` in [-1,1] set its shape. | It draws a closed flame-tongue path. |
| path | `commands` supplies the geometry. | It captures a local path. |

Every shape supports a solid `fill`, `alpha` and rotation in radians, with defaults taken from point `size`, `alpha` and `rotation` where applicable. Coordinates use scene units. Cloud colors retain per-point alpha and index order. Contiguous cloud runs of the same kind can share a node even when their colors differ. Opaque built-in paths of the same color can also combine because their nonzero-winding interiors represent the same geometric union, with raster antialiasing checked within a pixel tolerance.

Custom paths and translucent shapes stay separate to preserve draw order and compositing. Mixed runs are not reordered just to reduce node count. Paths are split into chunks of 10,000 commands, while the component's total command and node budgets still apply. Set `batch:false` when each point needs its own node.

Time-varying attributes and shape properties use the scene's `derive` mechanism. If a shape or style change would alter the reserved batch boundaries, sampling throws `PROCEDURAL_TOPOLOGY`. Keep boundaries stable or choose `batch:false` for that artwork. Callback code runs synchronously as trusted application code. The module limits the number of calls and the returned geometry, but cannot interrupt an infinite loop inside a callback.

## Measured distributions and evidence

Use `distribution.fromSamples(values)` to select quantiles directly from measured samples without smoothing. This is the empirical inverse cumulative distribution function. `distribution.fromHistogram(edges,counts)` instead interpolates uniformly within weighted bins and skips bins with zero count. Use `distribution.pick({category:weight,...},u)` for categories with nonnegative weights. All three accept `u` in [0,1], and the right endpoint selects the last supported value or category.

A report using `explainerkit.distribution/1` can feed these helpers directly through `fromHistogram(stats.size.bins,stats.size.counts)`, `pick(stats.colorShares,u)` or `pick(stats.kinds,u)`. Convert measured pixel radii to scene units if those units differ. Quantiles from tiny or discrete samples are not unique, and a finite number of random draws does not guarantee a fixed percentage error for every distribution.

`tests/modules/procedural.test.js` uses original fixtures to check exact spacing, independent
quantile/category targets, capture safety, bounded failures and backward seeking. The browser
fixture compares batches, alpha/order and SVG/Canvas pixels. Run `node benchmarks/procedural.mjs`
to benchmark 5,000 live dots. Each measurement includes sampling, rendering, and synchronous readback of one pixel. The command starts its own server and isolated Chrome.
The saved report is under `benchmarks/results/procedural/latest.json`. Local desktop results are
not physical-device, cross-browser or real-clip scores. Recreating reference videos remains separate
local work and is not included in these fixtures.

A stored procedural benchmark records the measured source and workload together with both passing and failing runs. Its isolated Chrome run measured a p95 of 15.3 ms against a 16 ms target, while a concurrent-browser run measured 16.4 ms and remains a failure. These machine-specific results do not guarantee that every frame takes less than 16 ms or establish physical-device, cross-browser or reference-video performance.