# Camera choreography and screen backdrops

Name regions of a scene, schedule camera shots, and add a steady camera drift when you need it.
Existing `camera.to`, `follow`, `frame` and `zoomTo` keep their behavior and defaults.

```js
scene.region('overview', {x: 0, y: 0, width: 960, height: 540});
scene.region('detail', {x: 2000, y: 1000, width: 480, height: 270});
const camera = scene.camera().drift({pan: [-15, -8], zoom: -.015});
camera.shots([
  {at: 0, frame: 'overview'},
  {at: 3, zoomThrough: star, duration: 1, ease: 'launch'},
  {at: 4.1, cut: 'detail', start: 'bottom'},
  {at: 4.3, frame: 'detail', duration: 1.4},
  {at: 7, whipPan: 'overview', duration: .9},
]);
```

## Ownership and units

`scene.region(name,box)` registers or replaces a captured world-space rectangle. Register names
before authoring shots; references to unregistered names fail with `CAMERA_REGION`. There are at most 128
regions and 64 shots. Inline rectangles are also accepted. Frames use uniform screen-pixel padding.

`camera.shots(list)` validates the complete list and authored endpoint views before replacing the
prior choreography. Rules must be chronological and nonoverlapping. `frame`, `cut`, `whipPan` and
`zoomThrough` are the recommended shot forms. `region`/`to` and `cutTo` are also accepted names. An initial
frame at time zero takes effect immediately; other frames default to 1.1 seconds and
whip pans to 0.9 seconds. Only cuts and the initial frame have zero duration. Edge `start` values
place the camera center at that region edge, intentionally cropping the opposite half.

Shots own all pose channels. Mixing them with existing tracks, bindings, follow or legacy framing
refuses with `CHANNEL_OWNED`. `clearShots()` releases the new list; `clearFraming()` retains its
existing meaning for legacy frame/zoomTo rules. `drift()` is an explicit additive layer compatible
with manual tracks; `clearDrift()` removes it.

Drift pan is in world units/second, rotation in radians/second, and zoom is fractional change per
second. `zoom:-.015` means multiply by 0.985 each second, implemented through integrated
`log1p(-.015)`. Zoom remains subject to the existing supported camera envelope; extreme rates or
long times refuse rather than silently clamp. Per-shot drift overrides smoothly change velocity
over that shot's duration; the next shot without an override returns toward global drift.

## Continuity and covering a shape

A shot interpolates zoom logarithmically so magnification stays positive. It also smooths progress before applying the selected easing, which makes base camera velocity zero at transition boundaries while drift continues. This differs from applying a launch curve directly. Finite-difference tests check continuity of position and velocity, called C1 continuity, for supported named curves with static endpoints. Cuts deliberately jump. Custom easing functions must map 0 to 0 and 1 to 1 and preserve the required continuity between them.

Endpoint compensation removes accumulated drift before interpolation and reapplies it afterward,
so a declared frame or cover is exact at its endpoint. Live zoom targets are sampled at the current
time; earlier live targets freeze at the next shot's start. This is pure reevaluation, with no previous
frame state. A moving target may require additional model samples during evaluation of past shot
boundaries; callbacks remain trusted synchronous author code.

`zoomThrough` supports live circles and plain rectangles, including nested rotation, reflection,
skew and nonuniform scale. It maps the viewport corners through the inverse `scene.locate()`
transform into the actual local circle/rectangle and computes the required covering zoom. It does
not claim coverage from an enlarged world bounding box. Rounded rectangles, groups, paths,
collapsed/missing targets and screen-space targets refuse explicitly. Coverage is geometric; a
transparent target does not become opaque. Motion blur and lighting remain separately authored.

`camera.shotReport({width?,height?,samples=33,fps=30})` reports each rule's
`sampledPeakPxPerSecond` and `sampledPeakPxPerFrame`, measured by projecting stationary world
points initially at viewport corners. These are finite sampled diagnostics, not certified maxima or
object-motion measurements. Cuts/initial establishment report null speed. Work is bounded by the
scene/shot/sample product; the report does not run automatically during playback.

## Underlays

`camera.underlay(handle)` places a live root handle in screen space **below** the projected world.
Overlays remain above it. Model order/identity stay intact; only camera projection changes draw
layers. Underlay and overlay assignments are mutually exclusive (`CAMERA_LAYER_OWNED`); use
`removeUnderlay`/`removeOverlay` before changing the assignment. A backdrop can bind to explicit
scene inputs like any other handle. It cannot be a camera follow or zoom-through target.

Tests in `tests/core/camera-shots.test.js` independently sample actual target geometry, endpoint
poses, derivatives, ownership and backward seeking. `tests/browser/camera-shots-checks.html`
checks actual full-viewport target pixels and fixed backdrops on SVG and Canvas. Run
`node benchmarks/camera-shots.mjs` for a saved local report. These original fixtures do not include
reference pixels or establish the reference-film camera-score gate.

## Bounds-relative linear gradients

`linearGradient({units:'bounds', x1:0, y1:0, x2:1, y2:1, stops})` from `explainerkit/graphics` places coordinates in the painted shape's own geometric 0–1 box. Existing gradients retain local user-space coordinates by default (`units:'user'` is explicit). SVG uses `objectBoundingBox`; Canvas maps the gradient normal through that box, preserving diagonal gradients on non-square rectangles rather than merely scaling the two endpoints. Zero-area boxes paint no gradient, matching SVG. Positive boxes below the supported precision or mapped coordinates that collapse/nonfinite refuse before drawing (`paint.bounds.precision`), including gradient masks. Native Canvas text requires an imported/explicit outline for bounds gradients and otherwise refuses with `RENDER_UNSUPPORTED`, capability `paint.bounds.text`, before drawing. Radial gradients keep their existing user-space contract.

The checks in `tests/browser/glyphs-gradients-checks.html` compare rectangles of different sizes and positions at one viewport size, including unequal scales. The recorded local Chrome run measured interior invariance error of at most 1/255 and SVG/Canvas mean channel error of 0.040/255. Antialiasing can differ at transformed edges, so the invariance check excludes a two-pixel border while the renderer comparison includes the whole frame.

## Region-scoped content

`scene.region(name,box,{content:group,visible:'inside'})` associates a live
world-space top-level group with a world rectangle. Visibility uses exact convex
rectangle intersection with the camera viewport, including camera rotation;
touching edges count as intersection. `visible:'approach'` expands each viewport
edge by 25% of its screen width/height before intersection. This margin is in
logical viewport units and does not depend on DPR. Content is hidden outside the
region's active view by multiplying effective group opacity by zero; inside,
authored opacity and all other animation remain intact. It appears immediately
at the boundary; this API does not add an implicit fade.

Without a camera, the stage viewport is the active view. `sampleWorld()` retains
authored visibility for geometry/authoring inspection. A content group belongs to
one region, remains a top-level world group, and cannot be adopted as an overlay
or underlay. Re-registering a region without content removes its visibility
association. Region boxes are world-space metadata and do not follow the group's
own transforms. Camera target fitting uses the existing named box unchanged.
