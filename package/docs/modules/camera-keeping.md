# Keep moving subjects in frame

Use `camera.keep` when several moving objects must remain visible together. Supply handles from an existing scene, and the camera recalculates their combined bounds at each sampled time. The example follows an actor and cliff with padding rather than moving either object.

```demo design-wedding-keeping
Pose the giraffe and tortoise for a wedding photo. Drag either guest on the strip below the picture or use the arrow keys. The camera takes “squeeze in” very seriously.
```

```js
const camera = scene.camera();
camera.keep([actor.handle, cliff], {
  padding: 32,       // screen pixels on each edge
  ground: 'bottom', // or 'center' (default)
  at: 2,
  until: 8,
});
// camera.clearKeeping() releases camera pose ownership.
```

`camera.keep(handleOrArray,options)` adjusts the camera to include 1–128 distinct objects and their children during `[at,until)`. It measures their geometry in world coordinates, before camera projection. Start time defaults to 0, end time to 86400 and padding to 24 screen pixels. Supplying an explicit end extends scene duration to that time, while leaving the default end does not make the film last a day. A later `keep` call replaces the rule only after its inputs have been validated.

For each displayed sample, `keep` uses the current subject bounds and viewport dimensions to choose a fit. It respects the camera’s anchor and authored rotation, and includes movement, rotation, pivots, skew, reflection and unequal scaling inherited from the objects’ parents. The calculation uses the same region-fitting rules as `fitRegion`.

Targets are read from the world frame that has already been sampled. They are not sampled again through `locate`, and the camera does not accumulate movement from previous frames. A backward seek therefore calculates the same view without changing the subject geometry.

Choose `ground:'center'` to center the subjects’ combined bounds at the camera anchor. Choose `ground:'bottom'` to align the bottom of their rotated screen-space box with `viewport.height-padding`. Both choices keep every corner inside the padded viewport.

The camera fits the subjects’ visible geometric bounds rather than recognizing feet, a floor or a horizon. It includes stroke width and the extra reach of pointed stroke corners, called miter joins. Curved or rotated marks can still leave spare space because their rectangular bounds include empty corners. An invisible target also affects the fit, so remove it from the target set when it should stop influencing the camera.

While `keep` is installed it controls the camera pose, even outside `[at,until)`. Call `clearKeeping()` before using `set`, `to`, `bind`, `follow`, `frame`, `zoomTo`, `shots` or `drift`. Clear existing pose tracks, bindings, following, framing, shots and drift before installing `keep`. Outside the active interval, the authored base camera is shown. Crossing either time boundary produces a cut without an automatic eased transition.

Choose live target handles from this scene’s ordinary world-space drawing. Screen overlays and underlays are already positioned independently of the camera, while depth-layer content follows a different camera relationship. Including either would mix incompatible coordinate systems, so `keep` rejects those targets with `INVALID_CAMERA_TARGET`.

Use outlined text when words must contribute exact geometry to the fit. Native text without imported outlines, text whose size depends on the screen, and blur or glow on a target or ancestor are rejected with `CAMERA_KEEP_UNSUPPORTED`. Their final visible extent cannot be represented by this supported bounds calculation. For filtered artwork, author a fixed region with enough padding instead of asking `keep` to estimate the filtered edge.

Empty or collapsed combined bounds, impossible padding and an unsupported zoom fit report `CAMERA_FIT_FAILED`. If a target is removed during the active interval, sampling reports `CAMERA_TARGET_MISSING`. The rule rechecks later changes to a target’s coordinate ownership or representation rather than continuing with an outdated fit.

Camera-aware staging checks whether the branch it would move is also a camera target. It rejects moving that branch out of view while `keep` is trying to keep it visible. Clear keeping or choose different framing before staging the branch away. Tests in `tests/core/camera-keep.test.js` cover movement, portrait viewports, nested transforms, bottom alignment, rewind, conflicts and rejected inputs.