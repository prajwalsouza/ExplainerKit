# Reusable easing and staggering

Use staggering to decide when each object starts moving and easing to decide how it moves after it starts. A ripple provides one example of the difference. Points near the center start before points farther away, while every point can rise slowly, accelerate or overshoot its destination according to its easing curve. Changing either choice produces different motion without changing the objects themselves.

Import `easingCurve` and `stagger` from `explainerkit/motion` and create their functions while authoring. An easing function converts progress into motion, while a stagger function calculates a value such as a delay for each object index. Reuse the functions when sampling rather than rebuilding them for every frame. They do not create objects, scenes, clocks or browser resources.

```js
import {easingCurve, stagger} from 'explainerkit/motion';
const ease = easingCurve({family: 'expo', mode: 'inOut'});
const delay = stagger(.05, {from: 'center', grid: [13, 13]});
// Native timelines use numeric seconds: delay(index, 169).
```

```demo curves-ripple
Click a bead to spread a change outward from it. Each delay equals the grid distance from that bead multiplied by the step. Hover a stone to change the easing family, then click it again to choose the next mode.
```

## Curves

An easing curve receives progress from 0 to 1 and returns how far the motion should have advanced. Choose a family from `power`, `sine`, `expo`, `circ`, `back`, `elastic` and `bounce`, then choose the direction of easing with `in`, `out`, `inOut` or `outIn`. Defaults are `power`, `inOut` and power 2. Only the power family accepts fractional powers from 0.01 to 100.

Progress must be finite and within 0–1. The `back` and `elastic` families can return values outside that range, which lets an object pass its destination before settling. Their output is deliberately not clamped. These functions use fixed conventional curves and do not promise to match every library's parameterized variants. Named easing functions and spring timing have their own documented behavior.

## Staggers

`stagger(step, options)` returns a function that accepts an object index and the total count. A numeric `step` multiplies distance from the chosen origin, making it useful for delays measured in seconds. A two-number range instead maps the nearest and farthest distances to the range endpoints. The range therefore stays fixed as the object count changes.

| Option | Meaning |
| --- | --- |
| `from` | It chooses the origin as `first`, `center`, `last` or an existing integer index. The default is `first`. |
| `start` | It adds a numeric offset to every returned value. |
| `reverse` | It reverses distances so the far end moves first. |
| `ease` | It applies a trusted normalized easing curve to distance. |
| `modifier` | It passes the computed numeric value through a trusted function. |
| `grid` | It supplies `[columns, rows]` so distance is measured radially from the origin. |
| `axis` | It selects `'x'` or `'y'` within a grid and makes distances signed along that axis. |

Choose units that match the value you are calculating. A stagger used as a delay supplies seconds, while one used for geometric spacing supplies scene units. The helper accepts numeric values rather than strings or DOM selectors.

With a grid, radial distance creates the rings shown in the interactive example. Selecting an axis instead preserves the sign of the distance, so objects on one side of a centered origin can receive negative offsets. Normalization uses the full declared grid even when it is only partly populated. Counts and grid sizes cannot exceed 10,000, and the index, count and dimensions must be integers. Accessor properties are rejected without execution. Your application is responsible for converting its own labels or target objects into those indices.