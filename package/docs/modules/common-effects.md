# Add a familiar animation effect

Use `commonEffect` to bring an object into view, reveal text, or briefly draw attention to a shape. Import it with `bindCommonEffect` from `explainerkit/motion/effects`. The same functions are also exported by `explainerkit/motion`.

For fade, rise, pop, cut and reveal entrances or exits, use the existing handle `enter` and `exit` methods described in the [runtime API](../runtime-api.md).

Each preset converts a time in seconds into scene properties. Bind those properties to an ordinary handle, then use the existing scene player or sample the scene directly. An effect owns no clock, renderer or browser resource.

## Bring a shape into view

Create the scene and shape before attaching the effect. Supply the shape's destination explicitly. The preset's defaults are independent of the handle's current properties.

```js
import {scene} from 'explainerkit/core';
import {commonEffect, bindCommonEffect} from 'explainerkit/motion/effects';
import {hsla} from 'explainerkit/color';

const drawing = scene({width: 640, height: 360, duration: 3});
const dot = drawing.circle({x: 320, y: 180, r: 30, fill: hsla(170, 60, 40)});
const arrival = commonEffect('flyIn', {
  at: 1, duration: 1, direction: 'left', distance: 120,
  x: 320, y: 180,
});
bindCommonEffect(dot, arrival);
const halfway = drawing.sample({time: 1.5});
console.log(halfway.children[0].props.x); // 260
```

Before one second, the dot is transparent and sits 120 units to the left of its destination. It moves and fades in together, reaching its authored destination at two seconds. `direction` identifies the side it comes from. Moving time backward reproduces the same positions.

Give the scene a duration that covers the effects you attach. Binding a preset does not extend the scene's duration. Each preset exposes `at`, `end`, `channels` and `sample(time, reducedMotion = false)` for inspection or custom composition.

## Reveal text and artwork

The typewriter preset reveals complete graphemes, such as an accented letter or a joined emoji, at equally spaced intervals. Here the full label appears over two seconds. This example creates a new scene and can run independently of the first example.

```js
import {scene} from 'explainerkit/core';
import {commonEffect, bindCommonEffect} from 'explainerkit/motion/effects';

const drawing = scene({width: 640, height: 360, duration: 3});
const label = drawing.text({x: 80, y: 100, text: 'A small discovery'});
bindCommonEffect(label, commonEffect('typewriter', {
  text: 'A small discovery', duration: 2,
}));
const artwork = drawing.group({x: 80, y: 150});
artwork.rect({width: 200, height: 60, fill: '#3b8778'});
bindCommonEffect(artwork, commonEffect('wipe', {
  at: 1, duration: 1, width: 200, height: 60, direction: 'right',
}));
const frame = drawing.sample({time: 1.5});
```

A wipe changes a rectangular clip in the handle's local coordinates. Its `x` and `y` default to zero. Supply bounds that enclose the artwork, including any strokes or other ink you want to retain. The direction names the movement of the revealing edge: `right` reveals from left to right, and `up` reveals from bottom to top. The full rectangle remains as the clip after the effect finishes.

The typewriter changes the scene text itself. Its measured width can therefore change while letters appear. It does not preserve an invisible full-width layout, add a caret, or manage HTML announcements. For an HTML semantic copy and individually animated spans, use [DOM typography](dom-typography.md). For a transition between complete rendered scenes, use [layer transitions](layer-transitions-match-pairs.md).

## Emphasize a shape

Pulse, teeter and colour flash return to their supplied baseline when their duration ends. Pulse enlarges both scale channels once. Teeter rocks the rotation twice with decreasing strength. Colour flash blends toward the flash colour at the midpoint and returns to the base fill using the shared HSLA colour tools.

The following sample computes a fill without binding a handle. The same effect can be attached with `bindCommonEffect` when a shape should use it throughout playback.

```js
import {commonEffect} from 'explainerkit/motion/effects';
import {hsla} from 'explainerkit/color';

const flash = commonEffect('colorFlash', {
  at: 1, duration: 0.8,
  fill: hsla(170, 60, 40), flash: hsla(45, 90, 65),
});
const midpointFill = flash.sample(1.4).fill;
```

Choose the preset's options according to the property you want to change. Unknown options are rejected, including options intended for a different preset.

| Preset | Properties it binds | Options in addition to `at` and `duration` |
| --- | --- | --- |
| `typewriter` | `text` | Supply `text`; `locale` is optional. |
| `wipe` | `clip` | Supply `width` and `height`; `x=0`, `y=0`, `direction='right'`. |
| `flyIn` | `x`, `y`, `opacity` | `x=0`, `y=0`, `opacity=1`, `distance=80`, `direction='left'`. |
| `pulse` | `scaleX`, `scaleY` | `scaleX=1`, `scaleY=1`, `amount=0.15`. An amount of 0.15 gives a 15% increase at the midpoint. |
| `teeter` | `rotation` | `rotation=0`, `angle=0.18`. Angles are in radians. |
| `colorFlash` | `fill` | Supply `fill` and `flash` as solid colours accepted by [the colour module](color.md). |

## Own the binding and respect motion preferences

Bindings use the scene's normal channel ownership. A preset cannot take over a property that already has a track, binding or collection placement. A rejected bind leaves the handle's existing drivers intact. Presets that use disjoint channels can share a handle. To combine effects on the same channels, compose their samples in one authored binding, or put the effects on separate parent and child handles.

To release a preset, call `handle.unbind(channel)` for each entry in `effect.channels`. This restores the handle's underlying authored values. The preset itself needs no disposal. Its samples and captured options cannot be changed in place.

Pass `{reducedMotion: true}` as the third argument to `bindCommonEffect`, or `true` as the second argument to `sample`, to replace animation with its settled result at the onset. Emphasis effects stay at their baseline; entrances remain hidden before the onset. The module does not read browser preferences itself. The caller must supply the preference and rebind if it changes.

## Limits and renderer support

Onset and sample times must be finite and between 0 and 86400 seconds. Duration defaults to 0.6 seconds and must be between 0.001 and 30 seconds; the end must remain within 86400 seconds. Typewriter input is limited to 10000 UTF-16 code units and 4096 graphemes. It uses the typography module's `Intl.Segmenter` support and its bounded fallback.

Wipe width and height and fly-in distance lie between 0 and 1000000 scene units. Pulse baseline scales lie between −10000 and 10000 and its amount between 0 and 2. Teeter angle lies between 0 and π radians. Positions and baseline rotation use the scene numeric limit of ±10000000. The wipe's far edges and the fly-in starting position must also stay within that numeric limit. Opacity lies between 0 and 1. Accessor options, nonfinite values and arbitrary CSS colour expressions are rejected before a binding is installed.

These presets use ordinary scene text, transform, opacity, fill and clip properties. SVG and Canvas support these 2D workflows. A preset does not broaden the feature support of another renderer; in particular, check its clipping and text capabilities before choosing it.
