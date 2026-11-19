# Change the scale. Keep the place.

Import from `explainerkit/zoom` to use nested 2D coordinate systems and choose detail based on an object’s screen size. It works with existing scene parameters, time-based sampling, SVG and Canvas. It does not replace the scene camera or silently add a global camera, clock, device capture or three.js dependency.

A city and a cell can each use convenient local numbers even when the camera moves between their vastly different scales. Define a coordinate system for each level and describe how its units relate to its parent. The view can then convert between nearby systems before drawing, which avoids needlessly large world coordinates.

```demo design-flea-market-zoom
This café has a flea market on a crumb. Drag the magnifier or move it with the arrow keys to zoom in. See which details appear as the crumb grows on screen.
```

## Give each level its own units

```js
import {referenceFrame} from 'explainerkit/zoom';

const earth = referenceFrame({id: 'earth'});
const city = earth.frame({id: 'city', x: 500, y: 100, unit: 1e-3});
const skin = city.frame({id: 'skin', x: 20, y: 10, unit: 1e-3});
const cell = skin.frame({id: 'cell', x: 5, y: 8, unit: 1e-3});

const p = cell.pointTo({x: 2, y: 3}, skin);
// {x: 5.002, y: 8.003}, in skin's local units
```

`referenceFrame({id,unit=1,x=0,y=0,rotation=0})` creates a root coordinate system, and `.frame(spec)` creates a child. A child point maps to its parent as `origin + unit × rotate(localPoint)`. The origin uses parent units, while `unit` gives **parent units per child unit** rather than camera zoom. Rotation uses radians from +x toward +y. This combination of uniform positive scale, rotation and translation is called a similarity transform. It does not include reflection or skew.

Frame handles cannot be changed after construction. They expose `id`, `unit`, `x`, `y`, `rotation` and `parent`, together with methods for converting points, directions and scales.

| Method | Purpose |
| --- | --- |
| `frame.pointTo(point,targetFrame)` | Convert a local `{x,y}` position |
| `frame.vectorTo(vector,targetFrame)` | Convert a direction/displacement without translating it |
| `frame.scaleTo(targetFrame)` | Target units occupied by one local unit |
| `frame.rotationTo(targetFrame)` | Local-axis orientation relative to target axes |
| `frame.find(id)` | Look up a frame within the same tree; unknown names reject |

You can also call `convertFramePoint`, `convertFrameVector`, `relativeUnits` and `relativeRotation` without changing a frame. Point and vector functions take `(value,fromFrame,toFrame)`, while unit and rotation functions take `(fromFrame,toFrame)`.

IDs are unique within a tree. Parents are immutable existing handles, so a cycle cannot be constructed. Foreign trees reject rather than inventing a registration between them. The root establishes the tree's external unit convention; its shared `unit`, origin and rotation cancel in conversions inside that tree. No hidden external/global frame is implied.

A tree can contain up to 2,048 frames and 64 parent levels. Origins must stay within ±1e12 and local rotations within ±1e6 radians. Positive relative units must lie in [1e-150,1e150], with conversion coordinates within ±1e150. Every unit ratio along a conversion path must also stay in [1e-150,1e150] or the operation fails with `ZOOM_PRECISION_LIMIT`. A rejected child does not reserve its ID or consume a place in the tree.

## Rebase instead of flattening the world

To convert a point, the implementation walks up to the nearest ancestor shared by the source and target frames, then down to the target. It does not first calculate an absolute coordinate in the root system. A camera and artwork inside the same cell can therefore retain small relative numbers even if their shared ancestor has a very large origin.

This avoids one important source of cancellation; it does **not** create unlimited precision. Numbers already rounded on input cannot be recovered. Moving tiny geometry all the way into a distant coarse frame can still lose its sub-unit offset when added to a large origin. Distant or unneeded artwork should be culled or replaced with a coarser representation. Ratio, coordinate, hierarchy and renderer limits remain explicit.

The numerical motivation is [Goldberg's explanation of floating-point rounding/cancellation](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html). The nested local-transform convention follows the same general composition idea as [SVG coordinate systems](https://www.w3.org/TR/SVG2/coords.html). The least-common-ancestor implementation, rebasing rule and limits here are ExplainerKit engineering choices, not claims of a new numerical representation.

## Describe the current view

```js
import {frameView, rebaseCamera} from 'explainerkit/zoom';

const camera = {frame: cell, x: 2, y: 3, zoom: 20, rotation: 0};
const view = frameView(camera, {width: 800, height: 450});
const screen = view.project({x: 3, y: 4}, cell);
const localAgain = view.unproject(screen, cell);

const sameCameraInSkin = rebaseCamera(camera, skin);
```

A frame camera accepts `{frame,x=0,y=0,zoom=1,rotation=0,anchorX=.5,anchorY=.5}`. `zoom` means display pixels per unit in **that camera frame**. Changing the frame name without converting the position, rotation and zoom would change the view. `rebaseCamera(pose,targetFrame)` returns those converted values while preserving the physical view; it does not mutate either frame.

`frameView(pose,{width=960,height=540})` prepares an immutable view. The supplied size object must contain only width and height; when using a scene context, pass those two fields explicitly. Sizes are 1–8192. The view exposes `pose`, `width`, `height`, `project`, `unproject`, `transform`, `screenSize` and `projectFrame`.

- `project(point,sourceFrame=pose.frame)` returns screen coordinates.
- `unproject(screenPoint,targetFrame=pose.frame)` returns target-local coordinates.
- `screenSize(length,sourceFrame=pose.frame)` computes a nonnegative authored length's projected size. This similarity view does not include perspective foreshortening.
- `transform(sourceFrame)` returns `{x,y,rotation,scaleX,scaleY}` for a construction authored in that frame.
- `projectFrame(rawFrame,sourceFrame=pose.frame,{id})` captures a model frame and adds one camera-relative group, producing a normal renderer frame at the view size. Use a raw `sampleWorld()` result, not artwork already projected through another camera.

The display wrapper must fit the core's translation and scale limits of ±1e7, have a unique nonempty ID and leave one free node in the 10,000-node frame budget. Otherwise `ZOOM_DISPLAY_LIMIT`, duplicate-ID or resource diagnostics reject before rendering. The wrapper is not a culling planner. `project` itself can return finite offscreen coordinates beyond that display envelope for inspection.

## Travel by orders of magnitude

```js
import {zoomTransition, frameView, bindFrame} from 'explainerkit/zoom';

const shot = zoomTransition(
  {frame: earth, x: 500.020005, y: 100.010008, zoom: 1},
  {frame: cell, x: 0, y: 0, zoom: 2},
  {zoom: 'log'},
);

const progress = drawing.parameter(0);
progress.to(0, 1, {duration: 10, ease: 'linear'});
const view = drawing.derive([progress], (t, context) => frameView(
  shot.sample(t), {width: context.width, height: context.height},
));
bindFrame(cellArtworkGroup, {frame: cell, view});
```

`logZoom(from,to,progress)` is a separately exported positive logarithmic interpolation. For a linear progress clock, a shot from 1 to 1e12 reaches 1e3, 1e6 and 1e9 at one-quarter, halfway and three-quarters. Neither endpoint can be zero or negative. This is scale interpolation, not an automatic narrative pacing or spatial route planner.

`zoomTransition(fromPose,toPose,{zoom='log',rebase=true})` returns `{sample(progress)}`. It converts zoom/orientation into comparable physical units before interpolation. Local centers, signed rotations and viewport anchors interpolate linearly; zoom interpolates logarithmically unless `zoom:'linear'` is chosen. Endpoints return their captured poses exactly. A custom eased progress input changes how much time is spent on each order of magnitude.

When `rebase:true`, the shot chooses among endpoint/ancestor frames to keep the representation's zoom near one. The chosen representation frame can change discontinuously while the projected view remains continuous within floating-point tolerance. `rebase:false` retains the source frame until the exact endpoint, useful for comparison or inspection. This is a deterministic rule, not a cache or history-dependent threshold. Very large physical zoom ratios outside the declared envelope reject during preparation.

`bindFrame(handle,{frame,view})` connects the x/y position, rotation and x/y scales of a top-level drawable to a `frameView` scene input. The drawable and input must belong to the same scene, and these properties follow the normal binding ownership rules. Use an untransformed wrapper group with authored positions in its children because the binding replaces the wrapper’s transform rather than adding another one. It starts no rendering loop or clock. You can instead sample and project complete raw frames directly.

`drawing.camera().to(...)` controls the scene’s 2D camera and does not accept a `frame` option. Use `zoomTransition` to animate between nested coordinate systems.

## Draw only the detail that matters

```js
import {detail, bindFrame} from 'explainerkit/zoom';

const extent = drawing.derive([view], v => v.screenSize(60, cell));
const coast = detail(drawing, {
  extent, fade: 8,
  levels: [
    {below: 40, draw: () => lowDetailBlueprint},
    {below: 120, draw: () => mediumDetailBlueprint},
    {draw: () => highDetailBlueprint},
  ],
});
bindFrame(coast.group, {frame: cell, view});
```

`detailLevels(levels,{fade=0})` selects which prepared drawing should represent an object at its current screen size. Supply 1–32 levels with increasing `below` thresholds and a final level without `below` for larger sizes. Each `draw` is a copied drawing definition or trusted factory function. Thresholds and the supplied extent use CSS or display pixels rather than physical distance or zoom alone.

`selector.sample(extent)` returns frozen `{extent,selected,weights}`. Without a fade, a threshold belongs to the next level. A positive `fade` defines a centered linear crossfade band of that width around each threshold. Bands must not overlap or extend across zero. Weights are in [0,1], sum to one and activate at most two adjacent levels. Sampling backward returns the same selection; there is no hysteresis or hidden frame history.

`detail(drawing,{levels,extent,fade=0})` compiles each `draw` factory **once** into an ordinary component blueprint. It returns `{group,choice,selector,levels}` where `choice` is the derived selection and `levels` are editable handles to the compiled artwork roots. The `extent` input must belong to the scene and yield a finite number. Wrapper opacity carries the crossfade, preserving each artwork's own opacity. Construction preflights the blueprints, extent and node capacity; failure leaves scene nodes/parameters unchanged.

All detail levels remain in memory and count toward the scene’s node limit, including hidden levels. Selection changes visibility without loading assets, evicting unused data or reducing mesh complexity. Crossfades use ordinary opacity compositing, so overlapping translucent drawings may change apparent brightness.

To morph between levels instead, define how their shapes correspond rather than expecting the selector to infer it. Factories run as trusted application code and are not sandboxed against side effects.

## Evidence and limits

Fifteen native tests check independent unit/rotation equations, huge-shared-origin rebasing, invalid tree/ratio boundaries, camera/project inverse calculations, logarithmic decade positions, cross-frame screen invariance, signed rotations, frame display limits, deterministic LOD weights, scene binding, factory call count and construction failure atomicity.

A browser fixture in the test suite checks SVG and Canvas pixels for tiny geometry under a large shared origin. It also checks forward and reverse shots and restoration of low and high detail through mounted-player seeks. These are three isolated-Chrome checks, not evidence of arbitrary precision, universal browser support or the quality of every deep-zoom film.

This module does not provide nested 3D rebasing, perspective-dependent size measurement, high/low origin expansions, automatic offscreen culling, asynchronous detail loading, automatic matching between detail levels or responsive layout over time. Use the separate spatial and optional solid-3D renderer guides for their supported calculations.