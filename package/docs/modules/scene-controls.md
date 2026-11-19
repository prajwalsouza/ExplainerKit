# Measured easing and windowed motion blur

Use these helpers when a measured easing curve should drive an animation or motion blur should appear only above a movement threshold. Easing maps progress to a value along a move. Motion blur samples several nearby times to represent exposure during movement. This guide describes the current calls and their supported limits.

## Easing

```js
import {scene, ease} from 'explainerkit/core';
const s = scene();
s.rect({x: 100, y: 100, width: 200, height: 80, pivot: 'center'})
  .animate('scaleY', {from: 0, to: 1, at: 1, duration: .4, ease: 'titleOpen'});
const measured = ease.fromSamples([0, .2, .5, .8, 1], [0, .7, 1.08, 1.02, 1]);
s.circle().animate('x', {from: 0, to: 200, at: 0, duration: 1, ease: measured});
```

Choose `launch` for `cubicBezier(.4, 1.2, .56, 1.02)` or `titleOpen` for `cubicBezier(.3, 1.24, .22, .97)`. Both are named animation easings and functions under `ease`. Their calculation first finds the horizontal curve position and then evaluates its vertical value, following [CSS Easing](https://www.w3.org/TR/css-easing-1/#cubic-bezier-easing-functions). Direct Bézier functions extrapolate outside [0,1], while animation tracks evaluate the interior and hold exact endpoints.

Use `ease.fromSamples(times, values)` to turn observations into an easing function. You can also supply `{times, values}` or one evenly spaced values array. Provide 2–10,000 finite, strictly increasing times and distinct endpoint values. The helper normalizes first and last time and value to 0 and 1. Its output passes through the normalized samples, retains measured overshoot and adds no new peaks or troughs between samples that keep increasing or decreasing.

The interpolation is piecewise cubic Hermite using the local harmonic slopes of [Fritsch and Butland (1984)](https://doi.org/10.1137/0905021). It interpolates supplied noise rather than removing it, so clean or reduce a measured track before choosing it as an authored easing.

`ease.fromTrack(json)` accepts `progress: {times, values}`, `progress` with optional `times`, top-level `{times, values}`, or legacy `{measure, samples}` rows with `t` and `present`. Rows absent from a legacy detection track are omitted, not treated as zero observations. Invalid or ambiguous samples raise `INVALID_EASING_SAMPLES` (general malformed data retains the data validator's code).

Presence transitions accept `ease` and `pivot`, as in `.enter(1, {style:'pop', pivot:'center', ease:'launch'})`. Choose `style:'reveal'` to scale height around the center. A pop keeps its original origin unless you supply a pivot. Opacity remains in 0–1 even when easing overshoots. Coordinate pivots work with `animate`, `to` and `keys`. Convert keyword pivot endpoints to coordinates before animating them.

```demo design-slippery-data
Making good time on slippery data. Move the clock to compare two movements. The middle of the measured example goes past the finish line because the input samples contained an overshoot.
```

## Motion blur

```js
const shutter = s.parameter(0, {min: 0, max: 1});
shutter.to(2, .5, {duration: .1});
s.motionBlur({samples: 6, shutter, fps: 60, auto: {threshold: 40}});
// Also accepted: {auto: true, threshold: 40}
```

Set shutter to the fraction of a nominal frame exposed, within 0–1, using a number, scene parameter or derived numeric input. Choose 1–16 integer `samples` and `fps` in 1–240. The automatic threshold defaults to 40 CSS pixels per nominal frame rather than pixels per second. It compares projected geometry at the requested time and one nominal frame earlier, including cameras, ancestors and leaf bounds.

This is a displacement check rather than optical-flow analysis. It can miss out-and-back motion inside the interval, texture changes, changed topology or newly appearing objects. Your application still decides whether blur helps explain that movement.

A zero shutter returns the normal frame with one scene sample and no exposure or probe work. A positive automatic shutter adds one probe sample, then creates exposures only when the movement threshold is exceeded. Active automatic blur uses the same exposure times and weights as always-on blur, with times clamped at the film's beginning. Sampling does not depend on playback history, so a backward seek uses the same calculation.

`tests/core/scene-controls.test.js` checks sample counts, exact active exposure equality, camera/rotation triggers, pivot tracks, imported fonts and focus/filter descriptor composition. `tests/browser/scene-controls-checks.html` checks actual Canvas smear equality at DPR 1/2 and reports alternating paired zero-shutter sampling costs. Timing depends on hardware. Structural equality is enforced separately so a noisy timing sample cannot hide exposure work.

## Additional exit and arrival curves

The exit and arrival helpers are `ease.anticipateOut`, `ease.linearStop` and `ease.snapIn`, also available by animation name. `anticipateOut` uses `cubicBezier(.04,-.2,.64,.22)`. Its coefficients came from aggregate controls in a local prototype with reported root-mean-square error 0.012885 over eight measurements. Raw reference samples are not included in source or CI. The numerical curve is checked independently of that empirical comparison.

`linearStop` follows linear progress and holds the endpoint. `snapIn` applies a keyed-pose convention of 5% anticipation, a rapid smooth move, 4% overshoot and settling. These deterministic curves can be used directly, but their empirical fit to the requested reference remains unverified. No reference error measurement is claimed for either curve.