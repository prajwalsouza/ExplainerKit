# Acting poses and contact timing

Use these helpers to place a character in a named pose or schedule a prop reaction when its hand arrives. They use the shared rig, pose keys and prop attachments. Their poses are authored animation conventions rather than tracings from a reference film.

## Retargeted poses

```js
import {character, stick, poseVocabulary} from 'explainerkit/characters';
const figure = character(scene, stick(), {idle: false});
const pose = poseVocabulary(figure.definition, 'reach', {
  crouch: .2, armHeight: .3, lean: .4,
});
figure.keys([{at: .4, pose, hold: .25}]);
```

`poseVocabulary(definition, name, dials)` returns an immutable pose descriptor.
Its four `joints` entries (`armF`, `armB`, `legF`, `legB`) hold upper local angle
and lower relative angle in radians. Positive angles turn clockwise in the
character's right-facing, y-down coordinates. The normal character root handles
facing and scene size. Angles retarget to the receiving biped's actual segment
lengths. `lean` and `hip` use the existing body channels.

Choose from `stand`, `reach`, `brace`, `hands-on-hips`, `think`, `step-back`, `arms-up` and `hands-on-head`. `BIPED_POSES` exposes their immutable joint angles. Adjust `crouch` within 0–1, `armHeight` within −1–1 from down to up, and `lean` within −1–1. All default to zero. These controls describe acting poses rather than guaranteeing anatomy or ground contact. Use inverse-kinematics (IK) foot contacts when feet must stay planted. Custom non-biped definitions without `poseLayout` are rejected.

## Contact timing

```js
import {contactTiming, holdAtContact} from 'explainerkit/characters';
const event = contactTiming(figure, {
  hand: 'F', from: 0, to: .7,
  target: [220, 130], radius: 8,
});
if (event.at !== null) {
  prop.to(event.at, {rotation: .3}, {duration: .2});
}
// Or begin the existing reversible attachment at a verified arrival:
const attachment = holdAtContact(figure, prop, {
  hand: 'F', from: 0, to: .7, until: 1.5,
  anchor: [0, 0], radius: 8,
});
attachment.hold?.dispose();
```

`contactTiming` samples the authored world-space hand socket, finds the global
speed peak in the supplied reach window, then selects the first subsequent
local speed minimum at no more than `maxSpeedRatio` of that peak (default .2).
An optional static world `target` additionally requires spatial proximity
(`radius`, default 10 scene units). Constant-speed travel, a still hand, a
missed target or a truncated reach returns `status:'unknown'` and `at:null`.
It does not infer physical collision from a speed dip alone. Use a tight reach
window for each gesture; multiple gestures need separate windows.

The analysis defaults to 120 samples per second and accepts rates from 12 to 240 with 4–4096 intervals. `sampleStep` reports the time resolution, while `peakTime`, `peakSpeed`, `speed`, `speedRatio` and `travel` report the measured motion. The result describes the gesture at the time of analysis, so run it again after editing. It installs no playback callbacks or external events that could fire during a seek.

`holdAtContact` checks the prop's authored anchor through its actual parent
transform over the reach, requires a stationary target, then calls
`figure.hold` from the detected time until `until`. Default blend is zero so
reaction starts on arrival. Unknown contact leaves the scene unchanged. Moving
targets refuse; the existing world-space/layer/cycle rules of
[prop holds](character-props-turns.md) still apply. Push, release and glyph changes
can use the same `event.at` with their existing authoring APIs; no extra sound,
physics or typography timing system is introduced.

For a carry followed by a throw, pass `release:'authored'` to `holdAtContact`
(or `figure.hold`). At `until + blend`, existing prop tracks/bindings resume,
while earlier held frames remain seekable. Author the throw to begin at the
sampled release anchor to preserve continuity. The compatible default
`release:'freeze'` retains the release pose indefinitely.
