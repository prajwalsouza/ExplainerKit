# Lightweight biped motion in 2D and 3D

`bipedMotion` calculates a walking pose at a requested time, including foot support and two-segment arm reaches. Use `bipedRig` to connect that pose to scene groups that hold your artwork. Both are optional character tools and neither starts a clock, creates a renderer or mesh, fetches resources, or manages the browser. The planar characters and `solveTwoBone` keep their documented behavior.

```js
import {scene} from 'explainerkit/core';
import {bipedMotion, bipedRig} from 'explainerkit/characters';

const drawing = scene({width: 800, height: 600, duration: 10});
const time = drawing.ambient();
const motion = bipedMotion({
  stride: 1.1,
  path: t => ({x: 0.15 * t, z: 0, heading: Math.PI / 2}),
});
const shift = drawing.parameter(0, {min: -1, max: 1});
const intent = drawing.derive([shift], weightShift => ({weightShift}));
const rig = bipedRig(drawing, {motion, time, intent});
// Bind artwork to rig.parts; the player supplies scene time as usual.
```

Omit `weightShift` for automatic gait sway toward the supporting leg. Explicit
`weightShift: -1` shifts toward the left, `1` toward the right, and `0` centers
the pelvis. Animate that value smoothly; instantaneous intent changes remain
instantaneous. In the snippet, the explicit parameter intentionally overrides
automatic sway.

Partial-weight reach arcs are ambiguous when the requested direction is almost
opposite the neutral hand direction. The current sampler does not transport an
arc plane through that singularity; use intermediate targets for such movements.
Smooth input targets alone do not guarantee smooth arcs across that case.

## Pose and ownership

`motion.sample(seconds, intent?)` returns fresh `pelvis`, `chest`, `head`, two
`feet`, two `legs`, and two `arms`. Index 0 is left, 1 right. Each limb contains
`root`, `joint`, `tip`, `target`, `reachable`, `error` and `poleDegenerate`.
Feet include the planned `point`, `planted`, cycle `phase`, and `heading`.
`diagnostics` reports aggregate arm/leg residuals, reachability and excessive
horizontal path travel. Inspect these instead of assuming every request succeeds.

Choose one unit for all positions and use Y up with ground at Y=0. Heading zero faces +Z, and increasing heading turns toward +X. The path’s X/Z values describe its route along the ground, so supply a heading consistent with that route.

While a foot supports the body, its position stays anchored to a planned route point. Each sample evaluates the path at seven times, including nearby past and future contacts. Provide a finite, smooth function over that neighborhood without resource loading, random state, hidden time or side effects. Sampling keeps no history, so forward and reverse seeks agree.

`bipedRig(drawing, {motion, time, intent?})` returns `{actor, parts, pose}`.
Time and derived intent must belong to this scene. `actor` is the stable parent
handle; moving/scaling it transforms the entire rig. `parts` contains `hip`,
`torso`, `head`, `thighL/R`, `shinL/R`, `footL/R`, `upperL/R`, `foreL/R`, and
`handL/R`, plus bone base groups. Bone artwork extends along local -Y by the
configured segment length. Use `motion.dimensions` to size artwork. Logical
joint positions are solved together; renderer groups do not encode a skin or
an imported skeleton hierarchy. The scene keeps all handle identities.

## Support transfer and reaching

```js
const pose = motion.sample(0.4, {
  weightShift: -0.7,
  reach: {
    side: 'right',
    target: {x: 0.4, y: 1.05, z: 0.15},
    weight: 0.8,
  },
});
console.log(pose.diagnostics.armError);
```

Reach weight moves the hand direction from its neutral pose along an arc toward the target and blends the distance within the arm’s bent-elbow reach. The shoulder and elbow are solved together rather than delayed independently. Unreachable requests are clamped without stretching bones, and the result reports the remaining error. Smooth targets and intent in your application when continuous motion is required. For live controls, derive the intent record with `drawing.derive` and pass it to `bipedRig`.

Support sway is a pelvis-placement heuristic, not anatomical center of mass.
The pelvis lowers to retain leg reach with a 2% extension margin. It does not
compute forces, torques, momentum, a support polygon, or dynamic stability. It
does not automatically choose a supporting foot before an arbitrary reach.
Sequence an authored shift and reach when that is the intended action.

`posture: {lean, twist}` adds bounded trunk lean (±0.5 radians) and chest twist
(±0.6 radians) to small authored pelvis/chest counter-rotations. `lookAt: {x,y,z}`
directs the head with a ±1.1-radian yaw and ±0.65-radian pitch limit. These are
editable engineering bounds, not measured population limits. Smooth live targets
before sampling; the model does not install a smoothing clock.

`crouch` lowers the pelvis by 0–0.5 × legLength while preserving ankle targets.
`lift` translates the complete lower body by 0–10 units, then solves the upper
body in that space. Any positive lift explicitly releases both planted flags.
This supports authored jump trajectories; it does not integrate gravity,
detect landing surfaces, or solve impact forces. Reach/look targets remain
absolute in the authored coordinate system during flight.

## Shared flat and spatial representations

Retain the complete pose in both views. A side-view 2D renderer can draw each
limb from `(root.x, -root.y)` through `(joint.x, -joint.y)` to `(tip.x, -tip.y)`;
scale and offset into its viewport. Depth stays in the model even when the view
does not display it. The side-view route above advances along +X. Front views
use the appropriate projection rather than silently reinterpreting joint axes.

A 3D renderer consumes those same XYZ joints or the native rig handles. Change
the camera continuously from frontal orthographic to an oblique/spatial view to
reveal depth. Keep the same pose, time, contact anchors and handles throughout.
This avoids replacing the skeleton or resetting a walk cycle. It does not infer
missing depth from an arbitrary external 2D drawing, retarget another skeleton,
or preserve apparent 2D lengths under every projection. SVG artwork does not
automatically become a skinned mesh.

## Controls and bounds

| Option | Default | Bound / meaning |
| --- | --- | --- |
| `stride` | 1.1 | 0.3–4 seconds; same-foot cycle, not one step |
| `stance` | 0.62 | 0.55–0.8 of a cycle; staggered feet provide double support |
| `legLength` | 0.4 | 0.01–10; each of the two equal leg segments |
| `armLength` | 0.32 | 0.01–10; each equal arm segment |
| `hipWidth` | 0.26 | 0.01–legLength |
| `hipHeight` | 1.88 × legLength | legLength–1.98 × legLength |
| `stepHeight` | 0.16 × legLength | 0–0.5 × legLength |
| `footHeight` | 0.15 × legLength | 0–0.3 × legLength; ankle clearance |
| `spineLength` | 0.58 | 0.01–10 |
| `shoulderWidth` | 0.54 | 0.01–10 |
| `sway` | 0.55 | 0–1; automatic support-shift amplitude |
| `armSwing` | 0.18 | 0–0.6 radians; a small shoulder swing around a stable neutral elbow bend |

Sample time is bounded to ±86400 seconds; callback X/Z to ±1000 units,
heading to ±1e6 radians. Callback evaluation extends slightly outside the sample
interval for planned anchors. Each sample makes seven path calls and four
closed-form limb solves. Caller callback cost is not sandboxed or bounded by the
library. Options, points and link arrays reject accessors before reading data.

The lower-level `solveTwoBone3D({root, target, lengths, pole?})` is available from
`explainerkit/rigs`. Pole is a **direction vector**, not a world point. It selects
the bend plane through projection perpendicular to the target direction. A
collinear/zero hint chooses a deterministic fallback and reports
`poleDegenerate: true`; animate a suitable pole to avoid plane discontinuities.
Coordinates are bounded to ±10000 and link lengths to 0.0001–100. Missing Z is
zero. Optional `reachMargin` reserves 0–min(link lengths) distance from full
extension (default 0); biped arms use a small margin to reduce extension pops.
The result preserves both lengths and reports clamping error. It does not
enforce anatomical joint limits or avoid collisions.

## Evidence and limits

The contact/extension design is informed by
[Kovar, Schreiner and Gleicher (2002)](https://graphics.cs.wisc.edu/Papers/2002/KSG02/cleanup.pdf).
The separation of support and swing planning follows the useful design distinction
in [Coros, Beaudoin and van de Panne (2010)](https://www.cs.ubc.ca/~van/papers/2010-TOG-gbwc/paper.pdf).
This helper implements neither paper's full algorithm or physical controller.

Defaults are authored engineering choices, not population parameters fitted from
a small pilot with CMU motion-capture recordings. That pilot supports
comparison and editable coordination, not universal cadence, blink frequency,
lag or joint limits. Eye movement, blinks, imported skinning, terrain adaptation,
self-collision and automatic balance recovery are outside this helper.

The playground companion uses this API instead of its earlier branch-switching
planar leg adapter. Continuous time replaces its old 18 Hz pose quantization to
make gait defects visible rather than disguise them. Geometry/continuity checks
do not establish perceptual realism; review the playback too.

The example has click-to-walk, jump and nudge commands, cursor attention,
and a depth-view slider under More. Its director is application-owned and bounded
to 32 action commands. Walks finish committed foot planning before changing
course; that anticipation delay is visible. A nudge is an authored surprised
lean. Moods map to example posture, not a universal emotion classifier. The
jointed visual is the active character. The experimental dough mesh remains
example artwork outside core and is not loaded by the live page.

Existing learned controllers are also relevant. The evidence review compares
AI4AnimationPy, MimicKit and PFNN. None is integrated into this demo. A separate
pose/contact adapter, retargeting layer and artifact license review are needed
before claiming that output is learned human or animal motion.
