# Keyed acting and track-driven travel

Schedule a pose when a character must arrive at a gesture at a chosen time, or supply a root track when it must travel along known positions. The example assumes an existing scene `s`, with `character` and `stick` imported from `explainerkit/characters`. Pose keys describe the gesture while `follow` supplies travel and foot planning.

```js
const fig = character(s, stick(), {x:200,y:350,idle:false});
fig.keys([
  {at:.5,pose:{handF:[15,-160],head:.12},ease:'snap',hold:.3},
  {at:1.5,pose:{lean:.2}},
  {at:2.5,pose:'flinch'},
  {at:3,facing:-1},
]);
fig.follow([[0,200],[1,1600],[1.4,1600],[2.4,400]], {
  feet:'auto',
  step:{threshold:20,duration:.13,lift:16},
  lean:v=>Math.max(-.35,Math.min(.35,v/700)),
});
```

## Poses

Use `fig.keys` to schedule poses and `fig.follow` to move the character along a path. A key’s time is the **arrival** in scene seconds. Its `duration` describes the transition leading into that pose and defaults to at most .3 seconds of available time. `hold` keeps the arrived pose still, and a later transition cannot interrupt that hold.

A partial pose carries its previous values for mentioned properties, while properties never supplied by the layer retain their action or idle behavior. The final pose remains until `settings.until`, whose default is the supported timeline end. That default does not itself extend the scene.

The point aliases `handF`, `handB`, `footF`, `footB` are `[x,y]` targets in the character's facing coordinate frame. `hip:[x,y]` offsets the body, `lean` maps to body rotation and `head` to head rotation, in radians. Raw numeric rig channels such as `body.sx` and `face.smile` also work. Explicit hand points arrive at their declared character coordinates. If only the body/lean changes, carried hands preserve their shoulder-relative offsets; intermediate transitions use the same shoulder calculation as biped actions. Unreachable hand targets retain the rig's existing IK clamping behavior.

The default `snap` easing begins with a short 5% anticipation, moves rapidly, overshoots by 4%, and settles at the target. These are authored animation choices. You can select another named core easing, and each easing reaches its key exactly.

`facing:1|-1` changes facing at the arrival time instead of blending through a flattened body. Mirroring carries elbows and knees together. A zero-weight layer contributes no facing event, while any other weight preserves the discrete facing change.

Named poses can come from `definition.poses`, or a snapshot at .35s of a non-travel rig action such as `wave`. `rest` is the rig rest pose. `flinch` is an original small recoil convention when the rig supplies no action of that name. Named moving actions are not treated as static poses. Unknown channels and names refuse with `UNKNOWN_POSE_CHANNEL` or `UNKNOWN_POSE`; invalid timing/hold overlap refuses `INVALID_POSE_KEYS` before adding a layer.

`fig.keys(keys,{weight:1,fadeIn:0,fadeOut:0,until})` blends after action clips and before gaze/live drivers. Multiple keyed layers are sorted by start time; later layers blend over earlier ones. Weights are [0,1]. Finite `until` supports fade-out. Automatic follow feet subsequently own foot placement at full follow weight; use `feet:'none'` when authored foot keys should control the feet. Auto reach correction may lower the hips to preserve leg length.

## Sampled easing data

Pose keys can use measured easing data instead of a named curve. Supply paired times and values in a JSON descriptor when a transition should follow the shape of an observed or authored motion curve.

```js
figure.keys([
  {at: 0, duration: 0, pose: {head: 0}},
  {at: 1, duration: 1, hold: .25, pose: {head: .2},
   ease: {type: 'samples', times: [10, 12, 14], values: [20, 21, 24]}},
]);
```

The shared measured-easing evaluator uses piecewise cubic Hermite interpolation (PCHIP). It normalizes the first and last sample
coordinates to progress 0 and 1. Times must strictly increase; both endpoint time
and value differences must be nonzero. Supply 2–10000 paired finite samples.
Monotone spans preserve shape; authored interior anticipation/overshoot remains
possible rather than being clamped to 0–1. Normalized values must remain within
the shared finite ±10 million output bound. Rig/channel reach and pose bounds
still apply to the resulting motion; sampled easing does not grant extra reach.

The descriptor accepts only `type`, `times` and `values`, with `type:'samples'`.
Functions, accessors, sparse arrays, invalid fields and oversized input refuse
before a key layer or duration is changed. All key data shares the existing
200000-value capture budget, so the per-curve sample cap is not multiplied into
an unbounded clip budget. Source array edits after authoring cannot change
playback. Exact arrivals, holds, explicit contacts and backward seeking retain
their existing semantics. Named easing strings, `snap` and `style` remain
available with unchanged curves.

## Root tracks and contacts

`follow` accepts absolute scene-x `[time,x]` lists (strictly increasing times, linearly interpolated with held ends), a pure `seconds=>x` function, a curve with `.sample(seconds)`, or an input owned by the scene. Give the scene a duration for functions/inputs; an array also extends it to its final key. The authored root track is sampled at 120Hz and becomes a piecewise-linear lookup. Sub-frame curve detail beyond this sampling rate is not retained.

`feet:'auto'` requires biped `poseLayout` metadata, provided by the stick and bean builders. Other rigs can use `feet:'none'`. Foot threshold, lift and maximum velocity lead are character units, scaled with the figure; duration is seconds. Velocity supplied to `lean` is scene units per second. Default lean is clamped to ±.35 radians; an explicit numeric/function lean is authored radians. Step `lead` defaults to .1s, and `maxLead` to 30 character units.

A down foot has one world-x anchor. During a step its world-x follows a smooth interpolation and its height a sine lift. Only one foot swings at a time. The next landing predicts the future root position and adds bounded velocity lead. A lookahead chooses the longest feasible step up to the requested duration on the 120Hz grid. At high speed the requested .13s can be physically impossible for an 82-unit leg, so the planner shortens it rather than sliding a support foot or stretching the rig. Impossible jumps/stride configurations refuse `FOLLOW_REACH`; rigs without metadata refuse `FOLLOW_UNSUPPORTED`.

The plan is created on first sampling, cached by scene revision/duration and rebuilt after input, key, scale or action changes. Sampling frames uses binary lookups and has no history dependence. Planning is bounded to 200000 root samples and four million reach checks, otherwise `RESOURCE_LIMIT`. A track callback depending on this character refuses `FOLLOW_CYCLE`; one that mutates the scene during planning refuses `FOLLOW_CHANGED`.

`weight` blends root travel over existing action travel and blends the planned foot/lean layer. The no-slide guarantee applies at full weight with automatic feet; partial weights deliberately blend positions. Later live drivers or author-added parent transforms can change world contacts. `standOn` retains terrain adjustments. `fig.inspect(t).follow` reports the sampled root, velocity and each foot's `{x,y,down}` in the plan's scene frame. `fig.followPlan()` exposes immutable step records and the sample rate/count for inspection. Recorded swing durations show where reach required an adjustment.

## Evidence and limits

Native checks in `tests/modules/character-keys-follow.test.js` cover pose arrivals, holds, named poses, weighted layers, mirrored joints, changed inputs, rewind, rejected impossible tracks and 1400-unit/s movement. The browser fixture in `tests/browser/character-follow-checks.html` independently measures contacts and leg lengths while rendering with SVG and Canvas. The cases use synthetic data and do not establish reference-film acting or travel similarity.

A scoped three-engine report records foot sliding, hip-to-foot distances, planned steps and backward-frame comparisons. Its selected-suite status is `partial`, so it is not a full browser-support result. Native tests also exercise shorter bean and wider heavy builds through rapid travel and a facing flip.