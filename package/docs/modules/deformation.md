# Lattice deformation

Move points on a control grid to bend a path. Nearby parts of the path move together, producing a smooth deformation.

```js
import { lattice } from 'explainerkit/geometry';
const warp = lattice(drawing, commands, { columns: 5, rows: 5 });
warp.point(2, 2).y.to(0, 80, { duration: 2 });
drawing.path({ fill: '#f2a541' })
  .bind('commands', { inputs: [warp.commands], map: value => value });
```

`lattice(scene, commands, options)` returns a frozen controller with scene-owned parameters and a scene-owned derived path. `lattice(commands, {scene, ...options})` is equivalent. A scene is required so control inputs can participate in ordinary bindings and animation.

| Member / option | Meaning |
| --- | --- |
| `controls` | Frozen row-major array of `{x: Parameter, y: Parameter, original: {x,y}}`. Positions are absolute local coordinates. |
| `point(column, row)` | Retrieve the same control by zero-based integer indices. |
| `commands` | Derived output for binding to a path's `commands` channel. |
| `sample({time,width,height})` | Convenience sampler; defaults match the scene. |
| `columns`, `rows` | Integer control counts, default `4`, range `2–32`. |
| `bounds` | `{x,y,width,height}`; defaults to the bounds of all input path coordinates, including Bézier handles. A zero extent becomes one unit. Explicit bounds must contain those coordinates and have positive extents. |
| `subdivisions` | Samples per source segment, default `8`, range `1–64`. Applies to lines, quadratic/cubic curves, and closing edges. |
| `maxPoints` | Output command cap, default `10000`, range `2–10000`; checked before creating scene parameters. |
| `pointCount` | Prepared tessellation command count, including move/close commands. |

The lattice copies and validates the input path before preparing it. As long as no controls move, sampling returns those exact commands and curve types. Once a control moves, the path is drawn as connected straight segments using M, L and Z commands. Subdividing the interiors makes them bend along with the endpoints rather than leaving each curve rigid.

The subdivision is prepared once and limits output size, but it does not guarantee a maximum pixel error at every zoom. Increase `subdivisions` for large curves or close views. Even a very small control movement switches from the exact original curves to the prepared segments, so choose enough subdivisions to make that switch visually acceptable. SVG and Canvas receive the same path geometry.

Each path point is moved by a weighted combination of nearby control displacements. The weights use uniform cubic B-splines in both grid directions, which produces the smooth local deformation described by [Rueckert et al. (1999)](https://doi.org/10.1109/42.796284), adapted here from 3D to 2D. At most 16 controls affect a point. At the edges, the nearest control index is reused rather than reading beyond the grid.

Controls supply spline coefficients rather than exact destinations for matching path points. Moving a control therefore does not necessarily move a path point at the same original position to that control’s new position. The continuous displacement changes smoothly across grid cells and affects only a local neighborhood. The displayed straight segments approximate it. Large movements can still fold or cross the path, so this is neither an invertibility-preserving warp nor a puppet solver that keeps shapes rigid.

Sampling costs `O(controls + preparedPoints*16)` regardless of elapsed time. Limits are 1024 controls, 2048 numeric scene inputs and 10000 prepared commands. Tests in `tests/modules/film-motion-deformation.test.js` cover unchanged paths, an independently calculated local weighting kernel, cell-boundary derivatives, translation, rewind, closures, bindings and preparation limits.