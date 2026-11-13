# Fit a fixed skeleton at every measured frame

Use `skeletonFromPoseTrack` when a measured pose track needs a fixed-length skeleton at every frame. Before fitting, prepare named limb observations and a camera mapping from world coordinates to the measured image. The helper uses ExplainerKit's `skeleton()` and analytical two-bone solver to fit those observations. It does not extract a skeleton from pixels. Use `keysFromPoseTrack` instead when you want a smaller set of keys for authoring rather than a fit at every measured frame.

```js
import {skeletonFromPoseTrack} from 'explainerkit/characters';
const fitted = skeletonFromPoseTrack(nativePoseTrack, {
  camera: time => worldToMeasuredImageMatrix(time),
  confidence: .6,
  maxGapFrames: 3,
  bendThreshold: .03,
  bendFrames: 2,
});
const firstNativePose = fitted.frames[0].pose;
const socket = fitted.skeleton.socket(firstNativePose, 'armRightLower');
const seekablePose = fitted.sample(.75);
```

Supply an `explainerkit.pose/2` track containing ordered native-frame `{t,pose}` records, including records where observations are missing. By default, output preserves every supplied frame and timestamp without thinning the track or guessing its native rate. Setting `fps` within 1–240 explicitly resamples the fit. Samples between source frames are labeled interpolated rather than measured. Calling `sample(seconds)` evaluates the captured angle and root-position curves at any supported time without depending on earlier samples.

## Data, calibration and topology

The fit converts head centers, neck and hip points, and labeled limb chains from the image into world coordinates through the inverse of your supplied affine camera. It shares the camera adapter described by [the pose bridge](character-rotoscoping.md), accepting static matrices, measured camera samples or trusted pure callbacks. A frame becomes unavailable when its camera translation is missing or explicitly unidentifiable. The helper does not invent a stale camera pan. Its gap policy then determines how missing world-pose observations are represented.

The measured head center becomes the skeleton root. A fixed neck bone connects it to the measured neck, and a fixed torso connects neck to hip. The four two-link branches are `armLeft`, `armRight`, `legLeft` and `legRight`. Small fixed shoulder or hip bones preserve measured offsets from those branch roots. An offset of zero omits that anchor bone, so inspect `fitted.skeleton.bones` for the actual drawable IDs rather than assuming every possible bone exists.

The default endpoint labels are `handLeft`, `handRight`, `footLeft` and `footRight` under `pose.labelled.limbs`. Use `labels` to map a branch to another stable label. A chain must contain 3–128 ordered path points describing its root, bend and endpoint. For longer chains, the point farthest from the root-to-end chord determines the bend. A short terminal toe is excluded from two-link leg calibration. Explicit `pose.neck` and `pose.hip` values take precedence, with limb branch starts used as fallback estimates. This describes a measured biped stick skeleton rather than automatic recognition of arbitrary animal structure.

Calibration uses median measured distances for the neck, torso and anchor offsets. For a limb, it takes median reach from nearly straight observations and divides that length using the median observed segment ratio. The default `split:'median'` uses a 99.5% reach-to-segment-sum threshold, recorded in `diagnostics.straightThreshold`, including paired calibration and numeric splits. When no straight reach is available, segment medians provide a reported fallback. Each branch still needs at least one usable measured chain.

Use `lengths` to override named bones such as `neck`, `torso` or `armLeftUpper` before compilation. Read `diagnostics.calibration` to inspect the method, evidence count and final fixed length. The skeleton's length, root and total-work limits still apply.

Output poses belong to the returned `SkeletonModel` and can be used with its sockets, rendering and forward kinematics. Forward kinematics computes positions from bone lengths and joint angles. Each fitted bone keeps scale one and its compiled length at every sample. Stretch in a reference cartoon therefore remains an error between measured and fitted positions rather than silently changing body proportions. Other skeleton APIs support stretch when the author explicitly chooses it.

## Bend evidence and missing frames

The sign of a limb's normalized bend area identifies which side the joint bends toward. Initial selection uses the first clear observation in the clip. A completely straight chain records a default side because the geometry cannot distinguish one there. Changing side later requires `bendFrames` consecutive clear observations above `bendThreshold`. Missing or weak evidence resets the pending change and keeps the current side, which suppresses one-frame noise without inventing confidence. When equal-length links are fully folded, the measured bend joint supplies the upper-bone direction that the endpoint alone cannot identify.

A missing run of at most `maxGapFrames` frames interpolates the shortest unwrapped angular difference. A longer run holds the last usable angles until measurement returns, including the interval immediately before recovery. Leading gaps hold the first usable value and remain labeled held. Head positions follow the same policy with linear interpolation for short gaps and fixed positions for long ones. Collapsed body segments and zero-length limb chains are invalid observations rather than zero-angle measurements.

A frame, pose or labeled limb with numeric confidence below `confidence` is unavailable. Missing confidence remains null. Each pose channel retains `measured`, `estimated`, `interpolated` or `held` status, and a recovered `labelled.status:'estimated'` observation stays estimated even when it passes the threshold. Unknown, ambiguous or unavailable labels cannot become measured limbs. Diagnostics separate coverage, invalid observations, unavailable frames, bend-side changes and endpoint errors. Coverage always counts input native frames, even when resampling changes output count.

## Calibrate matching limbs and filter measurement errors

Calibration estimates limb lengths from the observations. Enable paired calibration when left and right limbs should share those lengths, or enable `despike` to suppress isolated measurement errors. Omitting these options calibrates each limb independently, uses median observed splits and leaves the fitted output unfiltered. The example combines these choices with a deliberate gap limit.

```js
const fitted = skeletonFromPoseTrack(track, {
  symmetry: 'pairs',
  split: .5,
  despike: {frames: 1},
  maxGapFrames: 30, // explicit: about 1.25 s at 24 native fps
});
```

With `'pairs'`, left and right arms share upper and lower lengths, and left and right legs do the same. Straight observations from either side can establish paired reach, while anchor offsets remain independently measured. The default `split:'median'` uses the pooled median ratio `upper/(upper+lower)`. A numeric split instead specifies an upper-link fraction strictly between zero and one, subject to minimum bone lengths. A paired length override applies to both sides. Conflicting left and right overrides are rejected rather than breaking symmetry silently.

`despike.frames` sets a half-window from 1 to 5. A value of one uses a centered three-frame median. It filters head x and y and unwrapped bone angles from a captured copy so one filtered value cannot alter a later input. Only complete windows of measured or estimated evidence are eligible. Held or interpolated samples, windows touching them and incomplete edge windows remain unchanged. Estimated observations also keep their status.

Read `diagnostics.despike` for the window, evidence policy and changed native indices, times and deltas. A median can remove an intentional one-frame snap as well as noise, so enable it for measurement problems rather than as an automatic artistic correction. It cannot increase confidence in raw data or turn missing frames into observations.

Set `maxGapFrames` according to the missing interval you are willing to interpolate. It defaults to 3 and accepts at most 120 native frames with the nominal-time check still applied. A longer value may suit a known temporary occlusion, as in the example, but longer gaps still hold. This setting does not recover a trajectory that was never observed.

A synthetic spike-rejection test uses equal 36-unit segments, different straight-arm visibility on each side, monotone movement separated by holds, and isolated endpoint errors of 15% of arm length during those holds. It compares paired acceleration spikes with the clean track's 99th-percentile threshold and with the unfiltered noisy fit. This checks isolated spikes rather than arbitrary continuous motion, sustained outliers or incorrect identities. It also checks native timestamps and exact rewind.

## Draw the captured poses

```js
const pose = scene.derive([], context => fitted.sample(context.time));
for (const bone of fitted.skeleton.bones) {
  scene.line({stroke: '#20332e', strokeWidth: 4}).bind(
    ['x1','y1','x2','y2'],
    {inputs: [pose], map: sample => {
      const b = sample.bones.find(part => part.id === bone.id);
      return {x1:b.start.x, y1:b.start.y, x2:b.end.x, y2:b.end.y};
    }},
  );
}
scene.circle({r: fitted.headRadius ?? 8, fill: '#e47843'}).bind(
  ['x','y'], {inputs:[pose], map:p=>({x:p.root.x,y:p.root.y})},
);
```

The drawing example samples the fit through the scene's renderer without installing another clock. Its optional `headRadius` is a median drawing measurement whose conversion from image radius to world radius assumes uniform scale with rotation. Head-center conversion uses the full affine inverse. If a target cannot be reached with the fixed lengths, the fit reports that clamping rather than promising an exact match to stretched, contradictory or occluded anatomy. Identity and camera errors in measured input still require human review.

## Bounds and evidence

Input and output are limited to 10000 frames. Capture rejects accessor properties without executing them and allows at most 200000 JSON values per input frame and two million across the clip, including unused native debug fields. Optional summaries and runs are not copied. Camera samples capture only the matrix and availability fields that are consumed. Sparse arrays, invalid protocols or counts, and missing calibration evidence produce coded errors. These limits describe an in-memory fitting helper rather than streaming reconstruction or a general vision model.

Tests project an independently authored fixed-bone animation through a known changing camera. They check head and endpoint errors, pose ownership, constant segment lengths, bend hysteresis, short and long gaps, observation status, explicit resampling, capture and rewind. Additional 3000-frame/24fps and 1440-frame cases check capture and stress behavior. The fifth check in `tests/browser/character-part-six-checks.html` measures head-center pixels, fixed lengths, native-frame error and rewind through SVG and Canvas. These synthetic checks do not establish accuracy on a reference film.