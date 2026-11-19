# Native spring timing

Use `springTiming` when a move should last until a spring has settled instead of using a duration chosen in advance. The helper samples the analytic spring model and returns a finite duration and easing function that you can pass to a scene track. Its times are seconds, and it owns no scene, DOM element, player or clock.

```demo design-spring-cleaning
Spring cleaning, literally. Drag the clock across the rail to sample a dust bunny on a spring. It overshoots the rest mark before settling at the end of the duration returned by `springTiming`.
```

```js
import {scene} from 'explainerkit/core';
import {springTiming} from 'explainerkit/motion';

const drawing = scene();
const timing = springTiming({stiffness: 120, damping: 6});
drawing.circle({x: 0}).animate('x', {from: 0, to: 100, ...timing});
// The same timing works with handle.to() and parameter.animate()/to().
```

The result contains only `duration` and `ease` and cannot be changed after construction. Physical `mass`, `stiffness`, `damping` and `velocity` use the validation and defaults documented in `explainerkit/physics`. Velocity applies to a spring normalized from 0 to 1 and is measured in normalized units per second. Pass the result to a native track when you want that settling policy, or use `spring` and `springEasing` directly when you need their own controls.

The helper samples the normalized analytic response every 0.02 seconds. It considers the spring settled when `abs(1 - response) < epsilon` holds at consecutive samples spanning at least `rest` seconds, including both endpoints. Defaults are `epsilon: 0.0005`, `rest: 0.2` and `maxDuration: 60`. The returned duration is rounded to milliseconds, while the easing keeps the solver's sampling time. Its endpoints are exactly 0 and 1, and values between them retain spring overshoot.

This policy checks sampled displacement rather than every intervening instant or future motion. It does not check velocity. If the duration itself is the design constraint, use `springEasing({duration, ...})` instead. A very stiff oscillator may need another settling policy, but this helper will not increase its sampling budget silently.

| Option | Accepted range |
| --- | --- |
| `epsilon` | The accepted normalized displacement is 0.00000001–0.1. |
| `rest` | The settling window is 0.02–1 seconds and must fit within `maxDuration`. |
| `maxDuration` | The maximum search duration is 0.02–60 seconds. |

Construction evaluates the analytic response at most 3,001 times. If the spring does not settle within the declared limit, the helper throws `SPRING_NOT_SETTLED` rather than forcing a shorter duration. Playback evaluates one analytic response per easing call. Invalid descriptors, including getters, are rejected before values are read, and the returned easing accepts only finite progress in 0–1.

Spring overshoot still obeys native channel validation. For example, a scalar parameter authored from 0 to 1 needs bounds that admit its actual intermediate values, such as `{min:-2,max:2}`. The helper does not bypass clipping or ownership rules.

## Use the result with a millisecond clock

Keep seconds inside ExplainerKit. If an external animation API uses milliseconds, convert the returned duration at that boundary rather than changing the spring's physical settings or resampling it.

```js
const timing = springTiming({mass: 1, stiffness: 10, damping: 3, velocity: 0});
// Native tracks use timing directly. Only an external milliseconds-based
// authoring boundary converts its duration:
const milliseconds = timing.duration * 1000;
```

For the captured physical configurations `(stiffness, damping)` of `(100,10)`, `(10,3)`, and `(120,6)`, durations are 1.76, 5.16, and 2.68 seconds. Four sampled easing values per configuration agree with the independently captured reference calculation within 2.3e-16. This evidence covers those numeric responses. Complete visual or browser parity requires separate validation. See `artifacts/anime-parity/spring-motion.json` and `tests/modules/native-motion-timing.test.js`.
