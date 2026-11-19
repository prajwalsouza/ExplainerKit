# Draw the line. Give the motion a cause.

Use stroke trimming to reveal a route, springs to give a move a settling response, inertia to continue motion after release, or a path binding to move a marker along geometry. These helpers share the scene timeline and return values that can be sampled backward. They do not install another animation engine. Create the drawing and the handles you intend to animate before applying the examples below.

## Draw a stroke

```js
const route = drawing.path({commands, fill: 'none', stroke: '#278b88',
  strokeWidth: 3, strokeLinecap: 'round', trimEnd: 0});
route.to(0, {trimEnd: 1}, {duration: 2});
```

Set `trimStart` and `trimEnd` to fractions in [0,1] to select the visible part of a stroke. Their defaults are 0 and 1. Animate them with numeric tracks or parameter bindings while leaving the fill unchanged. An empty or reversed interval where `end<=start` hides the stroke, and a full interval retains the original. `trimOffset` shifts that window cyclically in turns, defaults to zero and is limited to ±10000.

SVG and Canvas share an authored-length estimate from curve subdivision at .05 tolerance and draw a dash window on the original curve. Choose caps through `strokeLinecap:'butt'|'round'|'square'`, joins through `strokeLinejoin:'miter'|'round'|'bevel'`, and a miter limit through `strokeMiterlimit` with default 4. An offset can wrap across the start and end. On an open path, those wrapped portions appear as separate fragments.

For letters, holes or imported art with several contours, trimming follows contour order. Native dash patterns restart on each subpath, so the renderer instead cuts visible geometry flattened at .05 tolerance for these cases. A filled compound path keeps its whole fill. SVG draws the cut stroke with a companion element sharing its transform, effects and paint order, while imported assets may retain separately named paths.

Length estimates may differ from native curves at high magnification because this is not symbolic integration. SVG retains the path element, and Canvas requires native dash support. Invalid or unsupported frames leave the previous valid display intact.

SVG places a compound fill and its cut stroke in one compositing group so opacity, filters, masks and backdrop blending apply once. Hit testing keeps the authored shape ID, and bounds-relative stroke gradients keep the full geometry's coordinate frame as the visible interval changes. Flattening is limited to 32,768 points and generated strokes to 10,000 commands. A limit failure occurs before replacing the image. Split artwork into separate paths when an outline needs more capacity. Filter support still depends on the selected renderer.

## Spring motion that rewinds

```js
import {spring, springEasing} from 'explainerkit/physics';
dot.to(0, {x: 200}, {duration: 1, ease: spring({stiffness: 180, damping: 12})});

const response = spring({from: 10, to: 100, velocity: 20,
  mass: 1, stiffness: 170, damping: 26, at: 0});
response.sample(1.5);   // position at seconds1.5
response.velocity(1.5); // units/second
```

`spring` evaluates the damped oscillator analytically rather than stepping a simulation from its previous frame. Underdamped motion oscillates, critical damping returns without oscillation as quickly as the model permits, and overdamping returns more slowly without oscillation. `state(time)` reports `{value,velocity}`. Before `at`, position holds at `from` with zero velocity, then begins with the supplied velocity at activation. Zero damping is supported but never settles. Coefficients and sampled position or velocity remain subject to finite bounds.

A spring from zero to one can also act as an easing function. Other ranges are rejected in easing mode, so use `.sample(time)` for physical positions. Easing mode samples a one-second response over normalized progress and forces exact zero and one endpoints. For another physical response duration, use `springEasing({duration,mass,stiffness,damping,velocity,clamp})`, with duration 1 and clamp false by default. It also reaches the authored endpoint exactly. That finite endpoint is a deliberate animation boundary rather than an oscillator continuing indefinitely toward equilibrium.

Overshoot can exceed a channel's allowed opacity, trim or parameter range. Such a sample is rejected rather than widening validation automatically. Choose `clamp:true` for bounded properties, or keep position overshoot within its coordinate limits. Named or trusted custom easing functions work on node and parameter tracks. A nonfinite result or callback exception fails sampling and lets the player preserve the previous display.

## Throw a released object

```js
import {velocityTracker, inertia} from 'explainerkit/physics';
const tracker = velocityTracker();
tracker.add(seconds, {x, y});
const velocity = tracker.sample(seconds);
const releasedX = inertia({from: x, velocity: velocity.x, friction: 6,
  at: storyTime, min: 0, max: 800});
// Bind its sample(time) through a derived scene value or retain a release event.
```

Record pointer positions on one clock whose timestamps never move backward, after converting them into the coordinate system being measured. The tracker fits a linear velocity over a recent window that defaults to .12 seconds and holds at most 32 samples. Duplicate timestamps combine into one observation, backward timestamps are rejected, and stale samples produce zero velocity. Capture that velocity once at release to define the following motion.

`inertia({from,velocity,friction=6,at=0,min=-1e7,max=1e7})` integrates exponential velocity decay analytically. Its target is `from+velocity/friction`, clipped to the declared bounds. Contact with a bound stops outward motion without bounce. `state(time)` returns `{value,velocity,clamped}`. This is release easing, not collision dynamics or frictional contact simulation.

Once release is captured, sampling it forward or backward returns the same result. Do not estimate velocity again every frame or repeatedly mutate the model while rendering. Choose story time, a separate interaction clock or a recorded event for the throw. Pausing the story cannot rewind a physical pointer, so keep that choice explicit.

## Move along a path

```js
import {bindMotionPath, motionPath} from 'explainerkit/geometry';
const progress = drawing.parameter(0);
progress.to(0, 1, {duration: 3, ease: 'linear'});
bindMotionPath(marker, {commands, progress, offset: 8});
```

`motionPath(commands,{start=0,end=1,offset=0,rotate=true,rotation=0,wrap=false,tolerance=.25})` prepares a `sample(progress)` function returning x, y and rotation. Position follows sampled distance along the path, orientation follows its tangent, and offset moves perpendicular to that tangent. Setting start greater than end reverses movement and adds π to orientation. With `wrap:true`, progress repeats modulo one even for negative values, so an open path jumps from end to start. At a corner, the tangent follows the incoming chord.

Use `bindMotionPath(handle,{commands,progress,...options})` to apply the sampled path to x, y and rotation through an input from the same scene. It returns `{handle,path}`. Set `rotate:false` to bind only x and y and keep another authored rotation. Release an existing position driver first because competing channel owners are rejected. Animating progress produces movement along the path, but does not enforce an inextensible cable or continuous-curvature constraint.

```demo design-maple-flight
Drag the wind knot to give this flight a twist. The maple seed points along the path’s tangent at each position. Scrub back to see the same poses in reverse.
```

## Evidence

Native tests independently check the oscillator differential equation, undamped energy, all damping regimes, release displacement/velocity/bounds, fitted pointer velocity, trim distances, path tangents and reverse sampling. Browser checks compare visible/absent stroke pixels across SVG/Canvas, retain fills at empty trim, exercise actual player seeks and project first-party 3D line art through both native backends. Device-specific latency and touch gesture quality require further physical-device evaluation.
