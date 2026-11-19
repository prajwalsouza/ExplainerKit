# Idle motion on any drawable

Add sway, turning or breathing to an existing scene handle when it should keep moving gently between authored actions. The example uses an existing `group` and its `scene`. Its time window limits the effect without requiring another animation loop.

```js
import {idle} from 'explainerkit/core';
const motion=idle(group,{
  sway:{amplitude:4,period:6,phase:0},
  turn:{amplitude:.025,period:8},
  breathe:{amplitude:.015,period:5},
  weight:scene.parameter(1,{min:0,max:1}),
}).during({at:2,duration:4,fade:.2});
// motion.dispose() removes only this effect, preserving authored animation.
```

Use `idle` to add small repeated movement without replacing a group’s existing animation. Sway offsets local x, turn adds rotation in radians, and breathe multiplies both authored scales by `1+amplitude*sin(2π*time/period+phase)`. Periods use seconds and phases use radians. Supplying a number for an oscillator sets its amplitude.

Default periods for sway, turn and breathe are 6, 8 and 5 seconds. Weight may be a number or an input from this scene and must remain in [0,1]. Invalid values are rejected instead of clamped. The absolute breathe amplitude cannot exceed 0.9, preventing this effect from reversing a scale on its own.

```demo design-penguin-portrait
Move the exposure marker across the highlighted window. The penguin sways, turns and breathes during the window, then returns to its pose as the effect fades. Please hold still-ish.
```

These pure effects run after authored bindings, tracks and collection placement,
before presence is applied. Multiple effects compose in installation order, with at most 8 on
one handle. Amplitude zero is exact identity. There is no random state or
frame-history integration, so arbitrary seeks reproduce the same frame.

`during` accepts an at/duration or from/to object, a `[from,to]` pair, or up to 64
window objects. Positive smoothstep fades at both boundaries preserve zero
weight and zero derivative there. Default fade is 0.2 s or half the window length,
whichever is smaller. Overlapping windows combine with a smooth union; the
weight never exceeds 1. Calling `during` again replaces the configured windows.
A disposed controller cannot acquire new windows.

Each time window can supply `weight` in [0,1], defaulting to 1. That weight scales the window before overlapping windows are combined, and the controller’s overall weight scales the result. `until` and `end` are also accepted as end times.

A camera shot object can be used as a window when it includes those timing fields. Only timing, fade and weight are copied, so later edits and live `zoomThrough` handles are not retained. A named destination in `to` is not an end time. Supply `duration`, `until` or `end` in that case.

Pass `effects:false` to `scene.locate(handle,{time:context,effects:false})` or `scene.sampleWorld({time:1,effects:false})` when you need geometry before sampled effects. Located results include a frozen, nonenumerable `parentMatrix` for converting displacement between screen, world and local coordinates. The internal `_sampleWorld(context,false)` applies that choice through children and keyed collections. A normal sample that recursively calls the same effect is rejected with `SAMPLE_EFFECT_CYCLE` before recursion continues.