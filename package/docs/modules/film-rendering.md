# Scene lighting, texture and motion blur

Use directional shading to suggest depth on flat artwork, texture to add a repeatable surface pattern, and motion blur to combine several moments into one Canvas image. These tools can be used separately. Begin with one shaded shape, then add texture or exposure sampling when the scene needs it.

## Light a shape

```demo film-light
Move the light and change the surface. This card renders an actual ExplainerKit scene with Canvas.
```

This example draws a shaded, textured planet into an existing `<div id="stage"></div>`. Use Canvas for the combined example; SVG shading depends on the browser's filter support.

```js
import {scene} from 'explainerkit/core';
import {texture} from 'explainerkit/graphics';
import {createCanvasRenderer} from 'explainerkit/renderers/canvas';

const drawing = scene({width: 320, height: 200, label: 'A shaded planet'});
drawing.light({angle: -Math.PI / 4, color: '#fff3d6', ambient: '#1b2a4a'});
const planet = drawing.circle({x: 160, y: 100, r: 60, fill: '#6480b0'});
planet.set({
  shade: {
    shadow: {amount: .55, softness: .35},
    light: {amount: .4},
    rim: {color: '#9fd8ff', width: 3},
    highlight: {x: -12, y: -12, r: 8, amount: .4},
  },
  texture: texture({kind: 'grain', scale: 1, amount: .15, seed: 42}),
});

const renderer = createCanvasRenderer(document.querySelector('#stage'));
renderer.render(drawing.sample({time: 0}));
// When the owning view is removed:
// renderer.dispose();
```

The light angle is in radians, in world coordinates. Rotating or reflecting a parent changes the light's direction in the shape's local coordinates. The highlight is an explicitly placed local radial spot; it does not automatically follow the scene light.

`shade` works on circles, rectangles, closed paths and groups. Shadow color defaults to the scene's ambient color; light, rim and highlight colors default to the scene light color. Set `shade: null` to remove the effect.

| Part | Controls | Defaults |
| --- | --- | --- |
| `shadow`, `light` | `color`, `amount` (0–1), `distance` (0–64 local units), `softness` (0–1) | amount .4, distance 8, softness .35 |
| `rim` | `color`, `amount` (0–1), `width` (0–32 local units) | amount 1, width 2 |
| `highlight` | `color`, `amount` (0–1), local `x`, `y`, `r` (.01–64) | amount .5, x 0, y 0, radius 8 |

These defaults are artistic conventions. Shading uses inner alpha differences and a radial highlight rather than a physical lighting simulation.

## Add a repeatable surface

`texture()` returns a paint description that cannot be changed in place. Create a new description to change its settings. Use it as a `fill` or `stroke`, or put it in a shape or group's `texture` property to overlay its existing artwork.

```js
planet.set({
  texture: texture({kind: 'hatch', scale: 2, amount: .2, seed: 42}),
});
// Restore the untextured surface:
planet.set({texture: null});
```

Choose `grain`, `paper`, `halftone` or `hatch` for a single-color pattern. The `paint` and `brush` kinds instead use a palette; see [painterly fills](painterly-spatial-instances.md) for their `colors`, `direction` and `frequency` controls.

| Option | Meaning | Range or default |
| --- | --- | --- |
| `scale` | Local units per tile pixel | .25–16; default 1 |
| `amount` | Pattern strength | 0–1; default .15 |
| `seed` | Reproduce the same pattern | Integer 0–4294967295; default 1 |
| `color` | Single-color pattern ink | Default `#000000` |
| `space` | How the pattern moves | `shape` (default) or `screen` |

A shape-space texture follows the artwork. A screen-space texture stays anchored during translations and rotations. Both renderers use the same deterministic 32×32 tile data, with at most 64 tiles cached. SVG uses patterns; Canvas uses `createPattern`.

## Combine moments into an exposure

Canvas can average several moments into one image to suggest motion during an exposure. Configure that sampling on the scene, then request the time you want to render. The following example moves the planet and renders the resulting blur.

```js
planet.to(0, {x: 220}, {duration: 1, ease: 'linear'});
drawing.motionBlur({samples: 6, shutter: .5, fps: 60});
renderer.render(drawing.sample({time: .5}));
```

`samples` is an integer from 1–16. `shutter` is the fraction of one frame exposed (0–1), and `fps` defines that frame interval (1–240). The scene chooses the sample times from those settings; the renderer does not run a clock or invent motion between samples. Set `shutter: 0` to disable the exposure. Fast motion can leave visible gaps between samples.

For custom sampling, a renderer frame can carry `motionBlur: {frames, weights}` with 1–16 same-size frames. Optional nonnegative weights must match the frame count and have a positive sum; the renderer normalizes them. Nested exposures are invalid. Averaging adds premultiplied sRGB channels and alpha with `lighter`, rather than performing linear-light radiometry.

SVG refuses motion-blur metadata with `RENDER_UNSUPPORTED` and capability `motionBlur`, preserving its last valid output. Use Canvas when the exposure is part of the intended result.

## Cache a layer

Use `drawing.layer({depth: 1, bounds: {x, y, width, height}})` for artwork with a declared visible region. Add shapes to the returned group as usual. Canvas can reuse its cached image when only the camera moves. See [depth layers](depth-layers.md) for the complete scene API.

The scene places `layerCache` metadata in its sampled frame. It is not a drawable property to pass to `group()` or `set()`.

Moving the camera without rotating or zooming can reuse the cached image. Local content, blur, light, ancestor linear transforms and screen-texture placement invalidate it. Read the cumulative `renderer.stats.layerRenders` and `cacheHits` counters to inspect reuse. The cache evicts oldest entries beyond 16 million pixels; `renderer.dispose()` releases its surfaces.

## Rendering limits

Shading and texture are applied before blur, glow, masks, object opacity and blending with nearby objects. Their overlays require a transform that preserves angles and scales both axes equally, without collapsing either axis. If an effect is skewed or stretched unequally, the renderer refuses the frame and keeps the previous output. Texture fills can use more general transforms, provided no axis collapses.

SVG shading requires browser filter primitives, including Gaussian blur. A browser without the required support refuses the frame with `RENDER_UNSUPPORTED` and capability `shade`; selecting SVG does not establish support on every engine. Canvas also checks its required native capabilities before drawing.

A frame can contain at most 64 effect nodes. Rendering their intermediate images may process at most 64 million pixels, including padding around effects, and use at most 16 million temporary pixels. Combining several samples has an additional 64-million-pixel limit across viewport and effect work, and uses at most two extra images the size of the output. Output is capped at 8,294,400 raster pixels (3840×2160); expensive filters or nested isolation can still exceed the work budget at that size.

Continue with [graphics](graphics.md) or [look and compositing](look.md).
