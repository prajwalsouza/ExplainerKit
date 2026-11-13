# Measured pose keys and authored root levels

Use [`skeletonFromPoseTrack`](measured-skeleton-fitting.md) to fit fixed bone proportions to measurements from each original video frame. Use `keysFromPoseTrack`, shown below, when you want to convert measured points into the character’s pose keys and root movement. The two functions serve different fitting tasks.

## Convert a measured pose track

```js
import {keysFromPoseTrack, stick, character} from 'explainerkit/characters';
const rig = stick();
const recovered = keysFromPoseTrack(poseTrack, {
  rig, size: 1, ground: 450,
  camera: [1, 0, 0, 1, 0, 0], // world → measured image
  confidence: .6,
});
const figure = character(scene, rig, {size: 1, idle: false});
figure.keys(recovered.keys);
figure.follow(recovered.rootTrack, recovered.followOptions);
```

Input is `explainerkit.pose/2`, containing 2–10000 ordered `{t,pose}` samples.
Measured image-space head centers use `{cx,cy,r}`. Labelled endpoints are
`pose.labelled.ends.handLeft/handRight/footLeft/footRight`; labelled `limbs` carry
shoulder/hip start points when available. This is the existing reference tool's
protocol, not an input video decoder. The converter requires a rig with declared
biped pose layout and hand/foot target channels (`POSE_RIG_UNSUPPORTED` otherwise).
It reuses native numeric keys and root following rather than replaying pixels.
This compact bridge also retains the shared 200000-value whole-JSON capture
budget; the frame cap alone is not a promise to accept arbitrarily detailed
tracks. Use the dense fitter's per-frame/two-million-value capture path for full
native-rate clips with tool debug payload.

`camera` may be an affine six-number array, a 3×3 affine matrix, a pure callback,
a curve's `sample(seconds)`, an existing scene camera's `view({time})`, or
`{samples:[{t,cameraMatrix,...}]}` from analysis. Matrices map world coordinates to
the measured image; they are inverted before fitting. Sampled camera rows hold
until the next row. A missing matrix or explicitly unidentifiable pan skips that
pose frame; previous pan is not invented. Invalid/singular matrices refuse with
`INVALID_POSE_CAMERA`. Data accessors are rejected without execution; callbacks
are explicitly trusted, pure author functions.

`ground` is a world y value, pure `(seconds,x)=>y`, `surface`, or `[time,y]`
track. Without it, available hip starts calibrate root y against the rig's HIP.
`size` is the same character-local-to-world multiplier used when mounting the
figure. `facing` defaults to 1; optional per-sample facing overrides it. Default
labels map screen-initial Right to F and Left to B; use `labels` to declare
another stable semantic assignment. Facing does not guess limb identity.

The fitter estimates torso rotation from hip and shoulder starts, head rotation from the head center’s offset around its pivot, and hand and foot targets from measured coordinates. It assigns hip translation to root x and holds `body.x` at zero. **One picture cannot distinguish root movement from independent `body.x` movement without an additional assumption.** The diagnostic `rootConvention` records this choice.

The fitter does not infer arbitrary squash, perspective, hidden anatomy or another skeleton’s proportions. A partial frame with only a head center uses the rest-pose head offset to estimate the root.

Frame `confidence` (or pose confidence) below the threshold is skipped. Missing
or low-confidence labelled limbs produce partial body/head keys, without
fabricating endpoint targets. `diagnostics` records accepted/partial counts and
each skipped time/reason. At least two usable frames are required. Keys interpolate
linearly between accepted measurements; missing channels carry forward through
the existing key system. Returned `followOptions` uses `feet:'none',lean:0`, so
automatic feet and lean cannot overwrite measured targets. Review long gaps and
partial estimates before using them in a film.

The original oracle renders known native stick poses through a known changing
affine camera, then fits only their measured protocol data. Native and browser
checks report maximum root error against a 2-unit gate and endpoint error against
a 4-unit gate over 21 frames. These checks cover the stated synthetic cases and
root convention; they do not establish accuracy for arbitrary video-to-rig reconstruction.

## Root tracks that change level

```js
figure.follow([
  [0, 200, 300],
  [1, 230, 500], // descend to a lower authored floor
  [3, 230, 500], // allow the final support steps to settle
], {feet: 'auto', lean: 0});
// Or independent coordinate curves:
figure.follow({x: [[0,200],[3,230]], y: seconds => 300 + 50*seconds}, {feet:'none'});
```

Root samples accept `[seconds,x,y]`, or `{x:track,y:track}`. Coordinate tracks
can be scalar numbers, owned scene inputs, ordered `[seconds,value]` pairs, pure
callbacks or `sample(seconds)` curves. A pure point callback may return `{x,y}`.
All rows must consistently have two or three columns; existing x-only tracks
retain their old planner and behavior. Ends hold their last value.

The authored y value gives the character’s root or ground level in world coordinates. For a positive-weight 2D follow it takes precedence over `standOn`, so height can change independently of x. Automatic feet use a repeatable 120 Hz plan in which the supporting foot stays at one world x/y point while the other swings to the new level. The biped reach solver adjusts the torso to retain leg length.

Finish with a hold when both feet must settle on the new level because an abrupt last-frame change can break contact. Excessive movement, targets beyond leg reach or excessive planning work report `FOLLOW_REACH` or `RESOURCE_LIMIT`. Planning permits at most 200000 samples and four million reach checks. It does not solve collisions, terrain or quadruped gaits. Choose `feet:'none'` to follow x/y directly with authored or measured endpoints.

Original tests descend 200 units, independently verify each drawn leg endpoint
and both stationary world coordinates during contact, check final settling and
rewind, and retain the existing fast x-only foot tests. Browser measurements are
in `tests/browser/character-part-six-checks.html`.
