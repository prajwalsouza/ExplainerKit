# Measure authored motion

Use `auditMotion` from `explainerkit/audit` to check the movement you have authored. Supply a function that returns a point at a requested time, whether that point comes from a scene object, a joint socket or a mathematical trajectory. You can then ask whether it stays still, follows a target, arrives at a chosen moment or remains below a speed or acceleration limit. The audit measures those requests directly and needs no reference clip or motion-capture data.

```js
import {scene} from 'explainerkit/core';
import {auditMotion} from 'explainerkit/audit';

const drawing = scene();
const dot = drawing.circle({x: 0, y: 20, r: 4});
dot.to(0, {x: 100}, {duration: 1, ease: 'smooth'});

const report = auditMotion(time => {
  const p = drawing.locate(dot, {time});
  return [p.x, p.y];
}, {
  from: 0, to: 2, fps: 60,
  space: 'world', unit: 'scene units',
  arrivals: [{id: 'arrive', at: 1, target: [100, 20], tolerance: .01}],
  holds: [{id: 'settled', from: 1, to: 2, tolerance: .01}],
  includeSamples: true,
});
console.log(report.checks, report.metrics);
```

The sampler must return a coordinate tuple such as `[x,y]`, rather than a handle or complete scene snapshot. Return `null` when an observation is unavailable. Malformed or nonfinite coordinates are rejected. For a character, the socket already provides a point that you can return from the sampler, as shown below.

```js
const hand = time => {
  const p = figure.socket('handF', time);
  return [p.x, p.y];
};
const grip = auditMotion(hand, {
  to: 2, space: 'world',
  contacts: [{id: 'grip', from: 1, to: 2, tolerance: .5, target: time => {
    const p = drawing.locate(prop, {time});
    return [p.x, p.y];
  }}],
});
```

The prop target in this example is its local origin transformed into world coordinates. If another point on the prop should meet the hand, transform that anchor with `locate(...).matrix` instead. Choose both anchors explicitly because a socket and an object's origin need not coincide with the intended physical contact points.

```demo design-drone-landing
Move the landing pad while the drone’s path stays fixed. The audit checks the distance from the final point to the pad at exactly one second. Move the pad outside the tolerance and the verdict switches to Return to sender.
```

## Inputs and ownership

| Option | Contract |
| --- | --- |
| `from`, `to` | They define seconds within 0–86400. `from` defaults to 0 and `to` is required. Equal endpoints allow one arrival check at a single time. |
| `fps` | It requests .1–240 samples per second and defaults to 60. The regular grid includes both endpoints using `ceil(duration × fps)` equal intervals. |
| `space` | It must be `world`, `screen` or `local`. It declares the supplied coordinates without transforming them. |
| `unit` | It labels the measurements with a nonempty string of up to 80 characters and defaults to `scene units`. No unit conversion or height normalization is applied. |
| `dimensions` | It defaults to 2 and can be 3. Every point and target must have that many coordinates, each within ±10,000,000. |
| `holds` | Each `{id?, from, to, tolerance}` checks distance from the point at the start of a positive interval. |
| `contacts` | Each `{id?, from, to, target, tolerance}` checks distance to a static tuple or trusted pure target sampler throughout the interval. |
| `arrivals` | Each `{id?, at, target, tolerance}` checks distance at exactly `at`. It does not infer an arrival event. |
| `maxSpeed`, `maxAcceleration` | They set optional nonnegative limits in unit/s and unit/s². Omitting one reports its quantity without judging it. |
| `maxSamples` | It accepts an integer from 1 to 10000 and defaults to 10000. The count includes additional samples at exact constraint boundaries. |
| `includeSamples` | It defaults to false. Setting it to true includes captured `{at, point}` rows for inspection or plotting. |

Every constraint needs a finite nonnegative tolerance in the point's declared unit. IDs must be unique, and omitted IDs are generated from the constraint kind and index. The audit accepts at most 128 constraints whose intervals and times lie inside the audit window. If an arrival or interval boundary falls between regular grid points, the audit samples that exact time as well. It captures the source point once per unique time so several checks do not obtain different observations at the same instant.

Choose coordinates that match the question you want to test. A planted foot normally needs a world-space check, or coordinates relative to a moving support. Screen coordinates include camera motion, so a fixed world point may still move on screen. When declaring `space:'screen'`, apply the intended projection in both point and target samplers. Use `scene.locate` to resolve parent transforms before returning coordinates.

Input descriptors are captured and validated before sampling, with accessors,
sparse arrays and unknown fields refused. Functions are explicitly trusted pure
callbacks, not executable content inside a data descriptor. They must do bounded
work and must not mutate the scene or other inputs. The audit installs no bindings,
callbacks on playback, clocks or repairs. Re-run it after editing the motion.

## Measurements and judgments

`metrics` contains the observed path length and maximum sampled speed and vector
acceleration. Maxima include the time, supporting interval, unit and observation
count. Raw measurements remain available even when they pass a limit.

The audit estimates velocity from position differences on each regular-grid interval and reports its magnitude as speed. It estimates acceleration from the change between consecutive interval velocities divided by the time between their midpoints, which includes changes in direction. This is not jerk, the rate of change of acceleration, and cannot reveal every discontinuity between samples. Additional samples used for constraints do not change these derivatives. Sampling is rejected before callbacks run if the chosen time intervals are too short for finite bounded arithmetic.

Floating-point rounding can make a mathematically constant speed appear slightly uneven. To account for that arithmetic, each raw maximum includes `roundoffAllowance`, calculated from coordinate magnitudes and propagated through the position differences. A judgment compares the author's limit with `lowerBound`, the largest nonnegative measurement after subtracting that observation's own allowance. Its location is reported as `lowerBoundAt`, which may differ from the raw maximum's location. Applying allowances separately prevents one large-coordinate observation from hiding an error at smaller coordinates. This allowance is separate from the authored tolerance and does not describe capture noise or physically acceptable movement.

Each constraint reports its observed `error`, its `coverage` and a `status`. Read coverage alongside the result so missing observations are not mistaken for a successful check.

- A `pass` means every required sampled observation is available and within tolerance.
- A `fail` means at least one observed violation is established, even if other observations are missing.
- An `unknown` result means no violation was established but required observations are unavailable.

Requested speed and acceleration limits use the same statuses. If you supplied no constraints or limits, the overall status is `measured` whenever observations exist. That status records measurement rather than certifying good animation. An established failure takes precedence over uncertainty, while otherwise the requested checks determine the overall status. Overall coverage still records missing observations outside their intervals.

If the point is unavailable at the start of a hold, the entire hold remains unknown rather than using a later point as its baseline. Path length and derivatives never bridge missing observations, so `observedPathLength` excludes gaps and an undersampled speed or acceleration limit remains unknown. A target sampler returning `null` preserves the same uncertainty. An exception from a trusted sampler propagates to the caller.

The report is immutable. Sampling and aggregate work are bounded to 10000 source
times and `sampleCount × (constraintCount + 1) <= 200000`. Target callbacks are
called at most once per available source point in their constraint. This bounds
invocation counts, not the internals of a caller's callback. Returned samples are
optional and bounded by the same budget.

## Relation to other checks

The existing character audit still tests the rig's named actions, including
sliding, pops, joints and ground geometry. `auditMotion` evaluates the author's
actual composed motion with generic point constraints. It does not infer a foot,
floor, collision shape or semantic gesture. Point-distance contact error cannot
establish body penetration or physical collision.

[Composition auditing](composition-audit.md) checks visual/readability problems.
[Independent character timing](coordinated-motion.md) explains scoped pose layers.
[keyed poses](keyed-poses-follow.md) includes reusable sampled timing curves. These
capabilities share existing scene time, poses and articulation rather than creating
another animation system.
