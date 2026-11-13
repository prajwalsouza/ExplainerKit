# Secondary motion

Use secondary motion when an object should trail a driver, wobble after it changes, or compress as it moves. `explainerkit/physics` exports `lag`, `jiggle` and `squashStretch` for those tasks. Start with a numeric scene input or a pure function of time as the driver. The helpers return ordinary scene inputs or scale values so SVG and Canvas draw the same sampled geometry.

```js
import { lag, jiggle, squashStretch } from 'explainerkit/physics';
const driver = drawing.derive([], context => 100 * Math.sin(context.time * 2));
const trailing = lag(drawing, driver, { halfLife: .12 });
const wobble = jiggle(drawing, driver, { frequency: 4, damping: .3 });
dot.bind('x', { inputs: [trailing], map: value => value });
const compression = drawing.derive([], context => Math.sin(context.time * 5));
squashStretch(dot, { input: compression, amount: .2 });
```

`lag(scene, driver, options)` creates a derived numeric input owned by the scene. Supply a driver from that same scene or a trusted pure `(seconds, context) => number` function. When evaluating past driver values, the context keeps the current width and height but substitutes the requested historical time. A live parameter override applies across the sampled history rather than recording interactive changes as another timeline.

| Option | Default | Meaning |
| --- | --- | --- |
| `halfLife` | `.12` seconds | It sets the half-life of the critically damped spring's decay envelope within `.001–10`. The mapping is `omega = ln(2) / halfLife`, so a step does not necessarily reach half its target at that time. |
| `initial` | Driver at time zero | It sets output at time zero with zero velocity. Use `initial: 0` for a driver that steps to one at zero. |
| `history` | 16 envelope half-lives, capped at 60 seconds | It limits how much driver history is sampled. |
| `step` | `max(min(1/120, 1/(32*omega)), history/(maxSteps-2))` | It sets the fixed sampling-grid interval in seconds. |
| `maxSteps` | `2048` | It limits intervals to an integer in `4–4096`. A longer requested window throws `RESOURCE_LIMIT`. |

Use `jiggle(scene, driver, options)` for an oscillating response. Instead of half-life, it accepts undamped `frequency` in Hz with default 4 and range .01–100, and `damping` with default .3 and range .01–10. Damping below one oscillates, one is critical, and values above one are overdamped. For overdamping, the slower exponential decay rate determines history length. Zero damping is rejected because its response never decays into a finite history window. The other options are shared with `lag`.

Each sample rebuilds the response from the beginning of the history window. It reads the driver at the midpoint of each fixed-grid interval and solves the spring exactly while holding that target constant over the interval. The first and last intervals may be partial. This approximates the response to a continuously changing driver rather than computing its exact convolution with the spring response.

Before time zero, output uses the chosen initial value. Once the window starts after zero, the calculation begins at that boundary's driver value with zero velocity, discarding older transients. A step at zero matches `1-(1+omega*t)*exp(-omega*t)` within floating-point error while zero remains in the window. A step aligned with a grid boundary also matches the analytic response, while an unaligned change has substep timing error. Reduce `step` and increase `history` when that approximation affects the explanation.

Seeking and playback use the same calculation without retaining integration state or reading wall time. Work therefore does not grow with elapsed film duration, and each sample calls the driver at most `maxSteps + 1` times. With the default critical window, a unit step's discarded residual is about `(1+16*ln(2))/65536 = .000185`. This is a numerical budget choice rather than a measured animation constant. Very slow springs can lose a larger residual when history reaches the 60-second cap.

`squashStretch(handle, {input, amount: .2, axis: 'y'})` binds both scale channels together and returns the handle. The input must belong to that handle's scene. Values clamp to [-1,1], giving the selected axis a multiplier `m = 1 + amount*input` and the other axis `1/m` relative to authored scale. Amount lies in 0–.95 so multipliers stay positive. This preserves signed scale area even for mirrored artwork. Release any existing scale drivers explicitly before binding, and remember that the pivot remains the handle's local origin.

The calculation follows the damped oscillator in Daniel Holden's [Spring-It-On](https://theorangeduck.com/page/spring-roll-call), but defines half-life through the decay envelope rather than using his practical conversion. Squash, stretch and follow-through are animation principles discussed by [Lasseter (1987)](https://history.siggraph.org/?p=116057). Their defaults here are authoring conventions rather than measurements of human movement. The tests in `tests/modules/film-motion-secondary.test.js` check the documented behavior.