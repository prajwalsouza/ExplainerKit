# Density fields, network spacing and fractal noise

Use a density field to vary spacing across an area, a network to place points along connected paths, or layered noise to generate a repeatable scalar field. Each tool computes from explicit inputs and a seed. None installs a clock, fetches assets, reads the DOM or changes scene ownership. Choose the construction that matches your geometry before converting its points into scene artwork.

## Density-driven Poisson points

```js
import {points} from 'explainerkit/procedural';

const lamps = points({
  seed: 23,
  in: {rect: [0, 0, 1000, 1000]},
  method: 'poisson',
  count: 4000,
  density: (x, y) => x < 500 ? 1 : 0.5,
  minDistance: 15,
  maxDistance: 30,
});
```

For density-driven Poisson sampling, supply a `density(x,y)` function returning a finite value in [0,1]. A value of zero excludes points. A positive value selects the local exclusion radius through `minDistance + (1-density)*(maxDistance-minDistance)`. Points with lower density therefore need more space. Every pair must be separated by at least the larger radius, with that check applied to the returned Float32 coordinates. Each sampled row reports its radius as `spacing`.

In callback-density mode, `count` is an upper limit that defaults to 100 and cannot exceed 100,000. Crowding or exhausted candidate positions may produce fewer points. An all-zero field is empty, and a count of zero invokes no callbacks. Read diagnostics to inspect attempts, work and whether the requested count was reached. Only `method:'poisson'` accepts the density callback. `maxDistance` defaults to `minDistance`, and their ratio cannot exceed 64 to 1. Numeric density instead specifies points per square scene unit and cannot be combined with count.

Sampling combines candidate positions across the whole region with local growth around accepted points and a spatial index for neighbor checks. The total budget of 20 million candidate, geometry and neighbor operations includes comparisons within occupied index buckets. Global proposals stop after one million attempts. A difficult density contrast or polygon can exceed the budget and throw `RESOURCE_LIMIT`, while a tiny disconnected positive region may be missed. A general callback cannot be exhaustively searched, so keep it pure, deterministic, fast and free of resource access. Invalid returned values or thrown errors reject the request explicitly.

The two-zone synthetic fixture measures independent interior nearest-neighbor
means of 16.144 and 24.151 against exclusion radii 15 and 22.5, both within 10%.
Their ratio is 1.49599 against 1.5. These are fixture results, not guarantees for
every field, boundary, unsaturated count or seed.

## Paths and explicit networks

```js
const roads = points({
  seed: 5,
  along: {
    nodes: [[0,0], [100,0], [100,100], [200,0]],
    edges: [[0,1], [1,2], [1,3]],
  },
  spacing: 20,
  junctions: true,
  offset: 3.2,
  alternate: true,
});
```

Define network nodes with `[x,y]` or `{x,y}` coordinates and edges with integer pairs indexing those nodes. Graph edges are straight. For curved edges, supply `along:[pathA,pathB,...]`, where each entry is one command-path contour. Exact shared Float32 endpoints become a single anchor. Crossings inside edges are not inferred, so split the paths or add graph nodes when those intersections should become junctions.

Supply `spacing` for every network. With `junctions:true`, the default, each distinct edge endpoint becomes one anchor, including dead ends. Anchors stay on the path. Offset and seeded jitter instead move interior samples perpendicular to it. Set `alternate:true` to switch the offset sign between successive retained interior points on each edge. Jitter may exceed the requested offset, and each output row records `rotation`, its input `edge` index and a `junction` flag.

Every pair of output points stays at least `spacing/2` apart, even when they come from different edges. Interior candidates too close to earlier points are omitted. Required anchors that conflict throw `PROCEDURAL_NETWORK_SPACING` rather than silently dropping a junction. Crowded or curved edges may therefore return fewer points than regular spacing alone suggests. Duplicate graph edges and zero-length captured edges are rejected.

Network count is a ceiling, default and maximum 100,000. If a smaller ceiling
cannot fit required anchors, sampling refuses. Zero returns an empty result after
validating the network. Limits are 10,000 graph nodes, 10,000 graph edges, 2,048
paths, 8,192 flattened points per contour, and 65,536 total flattened path points.
Candidate and proximity loops retain the shared aggregate work budget.
Before copying input, a network-specific preflight permits only numeric coordinates,
integer edge indices, short field names and single-letter path opcodes. It bounds
the estimated numeric/key/container payload to two MiB and validation visits to
400,000. The shared data copier additionally caps captured values at 200,000.
Accessor fields and malformed long text/keys refuse before capture or flattening.

A command path without network options uses its count or spacing as a single-path placement request. Setting `junctions`, `offset` or `alternate` selects network mode for that path. Distances remain in scene units, while arc lengths and tangents follow the flattened curve approximation within its point and work limits.

Use `PointOptions` for numeric density, `DensityPointOptions` for a density callback and `NetworkPointOptions` for graphs or path arrays. TypeScript overloads reject incompatible method, region and network choices, and runtime validation checks the same distinctions when JavaScript supplies the request.

## Shared scalar fractals and domain warping

```js
import {fbm, ridged, warp} from 'explainerkit/noise';

const height = fbm(0.1, 0.2, {seed: 9});
const ridge = ridged(0.1, 0.2, {seed: 9, octaves: 4});
const displaced = warp(0.1, 0.2, {seed: 9, amount: 0.4});
const bent = fbm(displaced.x, displaced.y, {seed: 9});
```

`fbm`, short for fractal Brownian motion, combines several layers of noise into one scalar field. `ridged` combines `1-abs(noise)` to emphasize ridges. Each layer is called an octave. Lacunarity multiplies frequency between octaves, while gain multiplies amplitude. Defaults are three octaves, `lacunarity:2.03`, `gain:0.55`, initial rotation 0.5 radians and a rotation step of 1.2 radians per octave. All octaves use the same seed and start from frequency one.

The default weights are normalized to sum to one. This keeps `fbm` in [-1,1] and `ridged` in [0,1] before multiplying by `amplitude`, which defaults to one. `offsetX` and `offsetY` default to zero and shift each octave after rotation and frequency scaling.

Supply a positive `normalization` when you need a particular scale instead of normalization by the weight sum. The resulting absolute bound is `amplitude * sum(gain**i) / normalization`, so the result is not necessarily in [-1,1]. Values outside the finite ±10-million numeric range are rejected. Choosing this denominator lets artwork use a deliberate amplitude without changing the general defaults.

Choose an integer octave count from one to eight, lacunarity in [1,8] and gain in [0,1]. Every octave's lattice coordinates must remain within ±10 million, and seeds are unsigned 32-bit integers. These limits bound evaluation work. To bend a field before sampling it, call `warp(x,y,{seed,amount=1})`. It returns frozen coordinates displaced by at most `amount` on each axis. You must then choose and evaluate the final height or color field at those coordinates.

### Preserve an existing authored field

For a field that starts with amplitude 0.55, uses a seed-based x offset and divides the weighted sum by 0.8, supply all three settings explicitly. The following call shows those authoring choices without changing normalized defaults for other users.

```js
fbm(x, y, {seed, amplitude: 0.55, normalization: 0.8, offsetX: seed * 0.37});
```

A regression checks exact numerical equality for 891 seed and coordinate cases using those explicit settings. The normalized defaults have a different amplitude, so choose the settings that describe the artwork you intend to generate.