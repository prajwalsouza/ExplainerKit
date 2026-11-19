# Quadruped gaits

A four-legged animal changes the order of its feet as it speeds up. It walks one foot at a time, trots with diagonal pairs and gallops with a moment when the feet are off the ground. `quadrupedGait` from `explainerkit/characters` plans those footfalls for a side view. It keeps each planted foot fixed on the ground, swings it on an arc to the next footfall and solves each leg as two bones. The plan is a pure function of time, so a scrubbed film and a live preview show the same pose.

```demo design-four-foot-mail
Drag the envelope along the route to make a four-foot delivery. When a pair of paws lands, look at the marks under them. The dog moves forward while those paws stay at the same ground positions.
```

## Make a dog trot

Choose a gait, a speed and a stride, then describe where the legs attach to the body and how long their bones are. Positions use the scene's units with y pointing down.

```js
import {quadrupedGait} from 'explainerkit/characters';

const dog = quadrupedGait({
  gait: 'trot', speed: 120, stride: 90, ground: 400,
  hip: {x: -50, y: 0}, shoulder: {x: 50, y: 0},
  legs: {upper: 32, lower: 32},
});
const pose = dog.pose(time);
// pose.body: {x, y, pitch}; pose.roots: {hind, fore}
// pose.feet.LF: {x, y, planted}; pose.knees.LF: {x, y}
```

`stride` is the distance the body moves in one full cycle, so the cycle lasts `stride / speed` seconds, which `dog.period` reports. `pose(time)` returns the body's position and pitch, the hip and shoulder roots, and for each foot (`LH`, `RH`, `LF`, `RF`) its position and whether it is planted. It also returns the knee of each leg. Draw each leg as two segments from root to knee to foot.

## Choose a gait

Each gait sets the moment in the cycle at which each foot lands and its duty factor, the fraction of the cycle a foot spends on the ground. The patterns follow the descriptions of Hildebrand (1965, 1977) and are rounded, representative values rather than measurements of one species.

| Gait | Footfall pattern | Duty factor |
| --- | --- | --- |
| `walk` | One foot at a time, in the order left hind, left fore, right hind, right fore | 0.7 |
| `trot` | Diagonal pairs land together | 0.5 |
| `pace` | Feet on the same side land together | 0.5 |
| `canter` | Three beats, with one diagonal pair landing together | 0.4 |
| `gallop` | Four close beats with a suspended moment | 0.3 |

A lower duty factor means more time in the air, so faster gaits look lighter. The body dips slightly as feet swing and pitches when the front and back legs are doing different things.

## Planted feet do not slide

A foot lands ahead of its root and stays at that world position until it lifts. Because the body moves at a steady speed, the foot lifts exactly behind its root by the same amount, and it lands one stride further on at its next footfall. A sliding foot is the most common flaw in procedural walks, and this plan rules it out.

`bend` sets which way the joints point. The fore legs bend with `-1` and the hind legs with `1` by default, which suits most mammals in side view. When a foot is out of reach, the leg straightens toward it, and the knee reports `reached: false`.

## Limits

The planner covers steady motion on flat ground in side view. It does not turn, accelerate between gaits, climb slopes or animate the spine, head and tail. A speed of 0 stands the animal still with all four feet planted. For a ready-made cutout animal with walk and trot clips, use the `quadruped` builder from the same module, described in the [character families guide](character-families.md).
