# Shared motion styles and still holds

Use `motionStyle` to share timing and movement choices across characters, idle motion and physics helpers. A style supplies defaults such as the duration of a move or the amount of overlap, while explicit options on an action still take precedence. Import the same function from `explainerkit/core` or `explainerkit/characters`. The style stores validated settings without creating an animation clock or a separate overlap simulation.

```js
import {motionStyle, idle} from 'explainerkit/core';
import {character, stick} from 'explainerkit/characters';
const style = motionStyle('snappy-stick');
const figure = character(scene, stick(), {motionStyle: style, seed: 7});
figure.keys([
  {at: 0, duration: 0, hold: 0, pose: 'stand'},
  {at: .5, hold: .25, pose: 'reach'},
]);
```

## Presets and compatibility

The `legacy` preset uses a .3 s key beat, fixed 5% anticipation and 4% overshoot, no implicit holds, and its defined idle and physics weights. Omitting `motionStyle` uses these timing defaults while respecting explicit authored values. An explicit `legacy` style also uses a 2 s wave and a 1 s fallback for actions with no declared duration. Keys interpolate joint angles by default. Use `space:'targets',arc:0` for a straight endpoint path. The fixed `snap` curve is available, but is deprecated as the general default for style-based authoring.

Choose `snappy-stick` for a fixed 5/24 s beat that does not depend on travel distance. Each transition separately chooses anticipation with probability .23 and size .19, overshoot with probability .28 and size .15, and a .25 s hold with probability .28. The `classic` preset uses a smoother 1/3 s beat with smaller, less frequent anticipation and overshoot, slower stepping and partial overlap. These presets are configurable authoring conventions rather than promises of expressive likeness. Aggregate study statistics do not supply hidden reference frames or establish a match to a second copyrighted film.

```js
const custom = motionStyle({
  preset: 'classic', beat: .28,
  anticipation: {probability: .2, amount: .1},
  overshoot: {probability: .25, amount: .08},
  hold: {duration: .2, probability: .3}, holdStill: true,
  idle: .5, overlap: .2,
  arcs: .12, interpolation: 'joints',
  stepping: {duration: .4, threshold: 12, lift: 12},
  physics: {lagHalfLife: .16, jiggleFrequency: 3, jiggleDamping: .8},
});
```

A resolved style is captured data that cannot be changed. Probabilities and weights lie in 0–1, anticipation and overshoot sizes cannot exceed .5, beat duration is .001–10 s, and hold duration is 0–10 s. Unknown fields, invalid preset names and accessor properties are rejected. Transition choices depend on the character seed and key index rather than the order in which frames are sampled. Anticipation, overshoot and holds are chosen independently, and reordering keys deliberately changes those choices.

## What reads the policy

- Keys use the style's beat, anticipation or overshoot curve and hold only when the corresponding field is omitted. Explicit `duration`, `ease` and `hold` take precedence. Leave room before an arrival for its transition and the preceding hold. An implicit beat is capped to fit the available gap, while overlapping explicit durations or holds are rejected rather than moving the keys.
- Default joint interpolation computes endpoint positions from joint angles through forward kinematics. In target-space mode, `arcs` adds a perpendicular sine bow expressed as a fraction of the hand's start-to-end chord. Set `arc:0` for a straight hand-target path. Foot contacts receive no artificial target bow.
- Style-based action clips use the beat, while `legacy` uses its 1 s fallback. A nonlegacy biped walk or run derives an omitted stride from speed multiplied by step duration within reach limits and uses the style's lift. Root-follow stepping uses the same duration, threshold and lift defaults. Explicit action or step parameters take precedence. A style name does not infer a destination or story action.
- When `holdStill` is true, positive-weight authored or style-generated holds disable idle motion, breathing and built-in follow-through. Outside a hold, `idle` controls idle strength and `overlap` controls secondary motion.
- `lag`, `jiggle`, `spring`, `springEasing` and `squashStretch` use `motionStyle` for their default settings. Explicit physical coefficients take precedence. Lag and jiggle mix with their driver using `overlap`, unless the effect supplies its own value. An overlap of zero returns the driver exactly. You must still call the helper to attach an effect.

An ordinary handle has no character key plan from which to discover holds. Supply its hold windows when calling `idle`, as shown below, so the same stillness policy can apply.

```js
idle(label, {
  motionStyle: style, sway: 4, breathe: .02,
  holds: [[1, 1.25], [2, 2.3]],
});
```

Hold windows include both endpoints and use scene time even when the idle oscillator reads an ambient clock. Sway, turning and breathing contribute no movement inside those windows. The hold does not cancel authored base transforms, live input, speech, root travel or separately authored actions. Those systems keep their own responsibilities, so a still hold is not a global pause.

```demo design-statue-hold
Drag the statue timer across the hold. The left statue’s style pauses its idle motion, while the right statue keeps fidgeting. Both use the same idle motion outside the hold. The freeze is in the fine print.
```

## Original measurable evidence

Run `node benchmarks/motion-wisdom.mjs` to measure 120 authored joint-pose moves per style at different target distances. The snappy test sequence has a .2083 s beat, 22.5% anticipation, 26.7% overshoot and a 25.4% hold share. Its forward-kinematics hand path measures 1.287 times its chord, and 25 sampled held poses remain identical with idle enabled. The `classic` comparison sequence has a .3333 s beat. Both sequences are checked for exact rewind.

A separate test composes the APIs in a longer action. A character reaches a static prop, verifies slow contact, tugs and carries it with `holdAtContact`, then uses `release:'authored'` to return control to inertia and fall bindings before walking to a destination. The test measures zero carry error, zero position error at release, still held poses, an exact destination x of 260 units and exact rewind. This workflow is separate from the 120-move style-frequency benchmark. To continue prop motion after release, match its authored channels to the held world pose. The default release policy keeps that pose frozen.

A numeric report records the source fingerprint and measurements. A rendered browser fixture checks still SVG and Canvas output separately from native pose statistics. These benchmarks cover the authored cases rather than reference-video likeness or all possible poses. Use [character acting](character-acting.md) for pose choices and contact-timed reactions, and [library layers](library-layers.md) to understand ownership and imports.