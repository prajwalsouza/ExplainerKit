# Characters in profile

```js
import {character, profile, profileReaction} from 'explainerkit/characters';
```

`profile(options)` creates a side-view biped definition, with an asymmetric
nose/chin outline, one visible eye, an ear, and separately articulated near/far
limbs. It shares the existing biped walk, run, pose, joint-goal and socket
contracts. It does not turn a front-facing face into a profile by sliding its eyes.

```js
const actor = character(drawing, profile({line: 2.8}), {
  x: 240, y: 380, height: 220, facing: 1, shade: false,
});
actor.walkTo(420, {at: .5});
actor.act('coverEars', {at: 4, duration: 2, intensity: 1});
```

Use `facing: -1` for the left-facing version. Ordinary travel/turnaround settings
still own facing; `look.x`, `look.y` and `head.r` can aim the visible eye and tilt
the profile. There is no inferred full anatomical turn from front to side.

Options are `name`, `line` (0.5–12 character units), `ink`, `paper`, `skin` and
`shirt`. Colors accept the shared safe color contract, including `hsla` values.
The default is a restrained flat ink figure on warm paper, 174 character units
tall, without a ground-shadow part. Hand, foot and head articulation remains the
ordinary biped rig, rather than a separate animation engine.

## A live value drives a reaction

`profileReaction(pose, amount)` is a pure mapping from an existing profile pose
and a number in 0–1 to hand/expression channels. It moves the two hands toward
head-relative ear targets and increases squint, brow tension and mouth opening.
The head may already be tilted or the body leaning; targets follow that pose.
It returns a frozen channel record and never mutates the input pose.

```js
const loudness = drawing.parameter(0, {min: 0, max: 1});
actor.drive([loudness], (level, pose) => profileReaction(pose, level), {
  mode: 'set',
});
// An explicit input adapter or an ordinary labeled range control supplies this.
// For example, a microphone's bounded RMS level can be mapped to 0–1.
loudness.set(.8);
```

Use `mode: 'set'` because `profileReaction` returns final hand and expression values rather than offsets to add. Amount zero leaves the underlying pose unchanged, allowing authored actions to resume as the input quiets. Positive amounts let the inverse-kinematics (IK) solver control the hands and disable competing raw hand targets.

A held prop can also control a hand, so combine a nonzero reaction with a hold only when that change of control is intended. Place this driver after other hand and face drivers when its values should take precedence.

The `coverEars` action uses the same reaction mapping. It accepts `intensity` from 0 to 1 and brings the hands into place over a quarter second. The action lasts two seconds by default and releases the pose through the normal end fade.

Sockets `handF`, `handB`, `footF`, `footB` and `hat` retain their biped meaning.
`earF` and `earB` add head-relative contact points for props and inspection.

Neither `profile` nor `profileReaction` captures audio, opens a device, installs
a clock, or performs analysis. Microphone acquisition belongs to the explicit
`explainerkit/inputs` adapter after a user starts it; the application owns input
mapping and disposal. The profile's expression is an authored visual reaction,
not a sound classification or emotion detector.

Native checks cover one-eye construction, mirrored sockets, head-relative hand
contacts under rotation, live release, repeat sampling, and invalid/accessor
inputs. These checks do not establish physical microphone or device behavior.
