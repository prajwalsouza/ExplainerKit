# Animate existing page elements

Use the Web Animations adapter when an existing HTML or SVG element needs to move or fade with browser animation. The Web Animations API, usually abbreviated WAAPI, is the browser's built-in system for describing these effects. ExplainerKit calls `Element.animate()` through `animateWAAPI` or `waapi.animate` from `explainerkit/adapters/waapi`.

The adapter changes CSS transform and opacity on elements your application already created. It does not redraw Canvas geometry, which remains the renderer's responsibility. In the example, a caption moves upward while fading in, and the returned controller lets your application seek or play that effect.

```demo design-curtain-pause
Time for a curtain pause. Drag the gold tassel, or focus it and use the arrow keys, to seek through the curtain's entrance. Its HTML panels hold their pose wherever you stop.
```

```js
import {animateWAAPI} from 'explainerkit/adapters/waapi';

const effect = animateWAAPI(document.querySelector('.caption'), [
  {transform: 'translateY(12px)', opacity: 0},
  {transform: 'translateY(0px)', opacity: 1},
], {duration: .4, easing: 'ease-out'});

effect.seek(.2); // seconds, deterministic and paused
effect.play();   // explicit native document-clock playback
effect.pause();
effect.finish();
effect.dispose(); // cancels only this adapter's effects
```

## Supply elements and keyframes

Pass the actual target elements rather than selector strings. Every keyframe must declare the same chosen channels, which may be transform, opacity or both, so the browser has a consistent sequence to animate. Keyframe arrays cannot contain missing entries, and they are copied before native effects are created. Executable value callbacks are not accepted as keyframe data.

Opacity stays between zero and one. Transforms use supported CSS functions with bounded numeric values, and the browser must support every transform supplied. CSS variables and resource expressions are excluded. For easing, use standard browser keywords or bounded `steps(...)` and `cubic-bezier(...)` values. An ExplainerKit easing function is JavaScript code rather than native easing data, so convert it deliberately instead of passing the function directly.

## Choose when playback starts

All options use seconds. `duration` defaults to one second, while `at` adds a start delay. `repeat` counts additional whole iterations and defaults to zero, with a maximum of 1,000. The complete ending time must stay within 86,400 seconds. Native fill mode is `both` and iteration direction is normal.

Effects are created paused because `autoplay` defaults to false. A standalone `play()` explicitly starts the browser's document clock, while `seek()` and `finish()` leave the effect paused at the chosen position. The adapter does not install a JavaScript animation loop. Call `dispose()` to cancel its effects and release ownership and media or player subscriptions. A disposed controller cannot be reused.

## Follow a scene player

Pass `player` in the options when the element should follow a mounted ExplainerKit player instead of a separate running clock. The adapter keeps the browser effect paused and sets its `currentTime` from player frame events, including backward seeks and scene refreshes. The scene and caption can therefore display the same moment without two clocks drifting apart.

In this mode, controller play, pause and seek requests are delegated to that player. Calling `finish()` seeks to this effect's ending time within the player's own bounds. The browser effect's `playState` remains `paused` even while the player advances it frame by frame. Disposing the player automatically disposes the bound effect.

## Respect motion preferences

The default `reducedMotion:'respect'` setting displays the final pose and blocks native playback when the document requests reduced motion. If that preference changes, the adapter samples the current logical time again and stays paused until playback is explicitly requested. Use `reducedMotion:'allow'` only when your application intentionally chooses that policy. A controlling player can still enforce its own motion preference independently.

## Share elements and recover from errors

An element can have only one active ExplainerKit DOM or WAAPI adapter, even when two adapters would change different properties. `bindDOM` and `animateWAAPI` share an ownership registry, so overlapping owners throw `DOM_OWNED` before an effect is created. Browser animations created by other application code remain that code's responsibility.

The adapter does not write inline style text, commit effects into style declarations or cancel every animation on an element. Its cleanup cancels only effects created by that call, revealing the underlying inline styles and any other animation. If construction fails partway through, already-created effects from that attempt are cancelled and their ownership is released.

Unsupported native animation throws `WAAPI_UNSUPPORTED` before any target is animated, while other native construction failures report `WAAPI_FAILED`. Invalid input is rejected before making native calls. A manual seek or playback failure also reports `WAAPI_FAILED` and attempts to restore every owned effect's previous time and state before changing the controller's logical time.

A browser can refuse that restoration too, so inspect `rollbackErrors` when recovery fails rather than assuming the old pixels survived. Errors while following a player appear through the controller's `error` property, the captured `onError` callback and player error reporting.

The browser timing and effect model is described in the [W3C Web Animations specification](https://www.w3.org/TR/web-animations-1/). [Anime.js's WAAPI documentation](https://animejs.com/documentation/web-animation-api/) provides another use of this native browser API, but its millisecond settings and property shortcuts do not describe ExplainerKit's seconds-based options. Browser compositing may help transform and opacity animation, but the adapter does not guarantee hardware acceleration or a performance improvement.

The controlled tests in `tests/modules/waapi-adapter.test.js` cover validation, copied inputs, cleanup, player ownership, restoration and reduced motion. The fixture in `tests/browser/waapi-checks.html` checks actual HTML and SVG styles, seeking, native playback, repeats, cleanup and competing effects in the installed Chromium, Firefox and WebKit engines. Those desktop checks do not establish physical mobile-browser support.
