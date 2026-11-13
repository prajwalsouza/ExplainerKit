# Production scene, text and player controls

Use these controls when an explanation needs motion while the story is paused, readable text at small display sizes, or several renderers following one player. They operate on the same scene objects and player rather than creating another timing model. All time values use seconds, and scene evaluation remains independent of browser clocks.

## Ambient life and deterministic sampling

```js
import {scene, idle} from 'explainerkit/core';
import {mount} from 'explainerkit/player';
const film = scene({duration: 90});
const ambient = film.ambient({rate: 1, offset: 0});
const figure = film.group();
idle(figure, {clock: ambient, sway: {amplitude: 3, period: 6}});
figure.bind('rotation', {inputs: [ambient], map: seconds => seconds * .01});
const player = await mount(film, container, {debug: true});
```

Use `scene.ambient({rate,offset})` for motion that should continue while story time is paused, such as idle movement during a scroll hold. It creates an input owned by the scene, with at most 64 ambient inputs. Rate is 0–16 and offset is 0–86400, and a sample equals `offset + rate * ambientTime`. The input itself does not extend scene duration or install a loop. A mounted player advances ambient seconds, freezes them while the document is hidden or reduced motion is requested, and excludes hidden elapsed time when resuming.

`player.pause()` pauses story time while leaving ambient motion active. Call `player.setAmbientPaused(true)` to freeze the independent ambient clock and stop its idle frame requests, then inspect `player.ambientPaused` to read that state. An already queued invalidation may finish, and manual parameter changes, scroll seeks or explicit refreshes still render. Authored playback continues if it is playing. Calling `setAmbientPaused(false)` resumes without adding the paused interval. The method accepts a boolean, defaults to false and rejects use after disposal. Hidden-page and reduced-motion policies still take precedence.

Pass both clocks when you need a reproducible frame. With unchanged authored data, `film.sample({time: 20, ambient: 3})` always returns the same result, and omitted ambient time is zero. A mounted player exposes `seekAmbient(3)` and `ambientTime` for the committed position. Failed rendering does not commit another ambient position, and the browser accumulator stops at 86400 seconds. During export, supply a deliberate ambient time for each frame rather than reading wall time.

Ambient inputs belong in a binding's `inputs`, and `idle` accepts one through `clock`. Its `during` windows still use story time, allowing an ambient gait to stay within one shot. A binding-only scene still needs an explicit duration, such as `scene({duration: 90})`, because an ambient input does not represent a clip.

## Bounded work and nested groups

```js
const child = figure.group({x: 10});
child.bind('x', {
  active: [10, 20], lazy: true,
  map: ({time}) => 100 * Math.sin(time),
});
```

Create a child group with `group.group(props)`, then limit expensive bindings to the interval where they matter. An `active` window includes both endpoints and uses the authored property outside it. Adding `lazy:true` also skips a binding when the node or a sampled ancestor is fully absent through presence. The binding does not retain the last visible value, so seeking backward immediately samples the correct state. Installation still validates its callback once.

This does not promise to cull every offscreen subtree, and tracks, effects and presence keep their own behavior. A skipped callback must not contain a required side effect. Keep callbacks pure so reducing sampling work cannot change application state.

Call `scene.profile({time,ambient,width,height})` to inspect the cost of sampling a frame. Its `{frame,totalMS,nodes}` result reports each node's `id`, `type`, `selfMS`, binding count and hidden-through-presence state, sorted by descending self cost. It samples author code once without retaining history. This timing covers world sampling but excludes camera projection, paint, browser layout and GPU work, so use it as a local diagnostic rather than a benchmark.

For a mounted scene, `player.profile()` uses current time and dimensions. `player.cost` reports the last sample, render and total milliseconds, while `debug:true` displays them beside the stage. Time spent submitting Canvas or GPU work does not establish when the GPU finishes.

## Text, independent paint alpha and small screens

```js
film.registerFont('Display', parsedFont);
film.text({
  text: 'A readable\nexplanation', fontFamily: 'Display', fontSize: 30,
  wrap: 240, lineHeight: 1.3, minScreenSize: 16,
  fill: '#20352e', fillOpacity: .9,
  halo: {color: '#fffaf0', width: 2},
});
```

Use `fillOpacity` and `strokeOpacity` when a shape's fill and outline should fade independently. Both accept values in [0,1], default to 1 and support bindings or tracks. Their values multiply paint alpha and node or group opacity. A group has no paint of its own, so its `opacity` fades the whole subtree. Clouds apply `fillOpacity` to point colors. SVG, Canvas and supported Three paints implement these channels.

Text supports newlines with native SVG or Canvas text and with registered outline fonts. Set `lineHeight` to a multiple of font size within .8–4. The `wrap` value is a local width or null. Automatic word wrapping requires a registered outline font so measurements agree between Node and browser. Without one, wrapping throws `TEXT_METRICS_REQUIRED`. A word wider than the available width throws `TEXT_OVERFLOW`.

Registered text preserves its semantic text while drawing a combined outline within 256 lines and the path-command budget. See [font limits](font-outlines.md) before choosing fonts that need shaping or other unsupported features. Native unwrapped text can use supported CSS font-family lists, but your page must load those fonts.

A `halo` paints a solid color around a word before its fill, with local width in 0–32. It helps separate text from the background without changing the lettering itself. A separately authored text stroke cannot be combined with a halo directly. Use an outline or group construction when two independent strokes are needed. SVG and Canvas draw the same stroke-before-fill order.

Set `minScreenSize` when text needs a minimum font-em size after camera projection. The value uses display pixels in 0–200, with zero disabling the feature. Sampling accounts for ancestor transforms and `displayWidth` and enlarges only that text around its current origin. It does not move neighboring labels or prevent overlap. Enlargement beyond 64 times is rejected with `TEXT_SIZE_LIMIT`, so use a closer view or an HTML caption when the required change is too large.

Mounted players use the measured container width even when the scene retains authored dimensions. For an audit or export, pass a display width explicitly, as in `scene.sample({displayWidth:390})`. `locate` remains a world-geometry query, while the final frame contains screen-dependent text enlargement.

## A shared clock across renderers

```js
const layer = player.layer(solidScene, {
  renderer: dedicatedThreeRenderer, from: 58, until: 80, offset: 0, fade: .5,
});
// layer.dispose(); // also runs on parent disposal
```

Use `player.layer`, or `attachSceneLayer` from `explainerkit/player`, to attach a separately constructed renderer to the same clock. The renderer must expose `element`, `render` and `dispose`. On each parent frame, child time is `clamp(parentTime-from+offset,0,childDuration)` and ambient seconds are shared. A child with ambient inputs keeps frame scheduling active even if the parent has none. Inactive or fully faded layers skip child sampling. The fade is linear at both ends and cannot exceed half the window length.

The child uses the parent's frame dimensions. Your page positions and stacks its renderer element, and your application supplies any optional rendering dependency. The layer helper does not download or select one.

A player accepts at most 64 layers. Each renderer and element can have only one layer owner at a time. Disposal removes subscriptions and restores the original display and opacity styles. It disposes the renderer unless you set `ownRenderer:false`. A failed sample or render does not commit visibility changes, while pixel preservation follows the renderer's own guarantees. Audio, input hit routing and scene construction remain application responsibilities.

## Native SVG channels and visible failures

```js
const native = player.nativeLayer(group, [
  {transform: 'translateX(0px)', opacity: 0},
  {transform: 'translateX(20px)', opacity: 1},
], {duration: .5});
// native.effect.seek(.25); native.dispose();
```

Use `nativeLayer` to let the browser's Web Animations API temporarily control a rendered SVG group's transform and opacity through the [adapter](waapi.md). The player clock still chooses its time. The renderer continues updating geometry and paint while leaving those two root attributes to the effect. A keyframe transform replaces the root transform, so include the authored base transform when it is needed.

Ownership cannot overlap an ancestor or descendant, refer to another scene's handle, or survive removing or changing the group's type. A player accepts at most 64 native layers, and Canvas rejects this capability. Dispose the returned wrapper rather than only its inner effect so the renderer restores sampled attributes immediately.

For standalone compositor playback between samples, a directly owned SVG
renderer also exposes `renderer.nativeLayer(group.id)` returning `{element,
dispose}`. Pass that element to `animateWAAPI` without a player and explicitly
play it. Dispose the effect and lease before resuming authored transform
ownership. Such standalone wall-clock playback is not deterministic film export.

Pass `mount` a scene or a synchronous or asynchronous builder. A builder lets the player display construction failures as a text-only `role="alert"` message as well as rejecting its promise. Render failures also display messages, and the next successful render clears them. Set `{errorOverlay:false}` to handle these messages yourself. Your page still handles failures before `mount`, including a failed module import, because the player does not intercept unrelated global exceptions.

Call `story.seekTime(t,{hold:'start'|'center'|'end'})` to move the scroll controller to the position for a story time. It respects scroll ownership and chooses the start of a hold by default. For a calculation without changing the page, use `story.timeline.positionAt`. Browser layout may clamp a requested scroll position that cannot physically be reached. Smoothing and reduced-motion policies still apply to the resulting sample.

The native tests in `tests/core/scene-production-gaps.test.js` and `tests/core/production-player.test.js` cover these controls. The rendered fixtures `production-gaps-checks.html` and `text-production-checks.html` check their browser output.