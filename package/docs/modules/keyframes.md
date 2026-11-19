# Keyframes and custom easing

A keyframe gives a property a value at a chosen time. Use several keys when an object must pass through more than one position, and choose easing to control how it moves between them. The example animates the x position of an existing `dot` handle.

```js
import { cubicBezier } from 'explainerkit/core';
const ease = cubicBezier(.42, 0, .58, 1);
dot.keys('x', [
  { at: 0, value: 40, ease },
  { at: 1.2, value: 320, ease: 'linear' },
  { at: 2, value: 180 },
]);
```

Use `cubicBezier(x1,y1,x2,y2)` to describe how progress changes within a keyframe segment. The resulting function starts at `(0,0)` and ends at `(1,1)`. Following [CSS Easing Functions Level 1](https://www.w3.org/TR/css-easing-1/#cubic-bezier-easing-functions), input progress selects the curve’s x coordinate before its y value is evaluated. Both x controls must be in [0,1], while y controls may overshoot.

The solver uses eight bracketed Newton steps with a bisection fallback, followed by up to 64 refinements. This supports flat x tangents and returns exact values at progress zero and one. Inputs outside [0,1] follow the CSS endpoint-tangent extension within the runtime’s finite-number limits.

`handle.keys(property,keys)` and `parameter.keys(keys)` schedule a numeric animation through several values. A key’s `ease` controls the segment **leaving** that key. The last key’s easing is validated even though there is no following segment. Omitted easing uses `smooth`.

```demo design-pigeon-waypoints
Move the middle breadcrumb up or down, then scrub the route clock. The pigeon reaches that breadcrumb at one second. The easing shapes its flight between crumbs. Try it as the crow curves.
```

Supply 2–10000 keys in strictly increasing time order with at least one microsecond between them, within 0–86400 seconds. The authored baseline applies before the first key and the final value holds after the last. Property limits and exclusive control by a track or binding still apply.

All keys and proposed segments are checked before a channel changes or scene duration extends. If validation fails, the previous animation remains intact. An overlap with any existing segment refuses with `CHANNEL_OWNED`; insertion that would invalidate a later chronological `to()` continuation refuses with `AMBIGUOUS_CONTINUATION`. Bindings and collection ownership also prevent taking over the channel. Clear animation explicitly to replace it. Keys are captured so later changes to their source array or records cannot change the animation.

`handle.replaceKeys(property, keys)` and `parameter.replaceKeys(keys)` replace the entire channel atomically, retaining its old tracks if validation fails. The internal `prepareKeyframes(tracks, property, keys, baseline)` helper returns a frozen, sorted complete candidate track array and leaves the original untouched. Callers validate all endpoints against their property's bounds before committing it. Sampling reuses ordinary `trackValue`; there is no additional playback state.

Tests in `tests/modules/film-motion-keys.test.js` compare CSS curves against an independent Bernstein-plus-bisection oracle over more than 8000 samples with tolerance `1e-6`, including flat endpoint and middle tangents. They also exercise extrapolation, outgoing easing, captured inputs, exact rewind and failure atomicity.
