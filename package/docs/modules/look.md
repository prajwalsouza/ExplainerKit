# Shape the light and the surface

Use `explainerkit/look` to add blur, glow, blending, gradient masks and color grading to ordinary scene properties. These effects change how a drawable appears without changing its geometry or the values it explains. SVG and Canvas use browser drawing and filter APIs through validated ExplainerKit settings, with no shader package, external resource URL or hidden rendering loop. Create your scene and drawable handles before applying the effects shown below.

```js
import {glow, alphaMask} from 'explainerkit/look';
import {radialGradient} from 'explainerkit/graphics';

const light = drawing.circle({
  x: 240, y: 180, r: 32, fill: '#fff6c9',
  glow: glow({color: '#ffc35a', blur: 12, opacity: .8}),
  blend: 'add',
});

const fade = alphaMask(radialGradient({
  x: 0, y: 0, r: 150,
  stops: [{offset: 0, color: '#fff'}, {offset: 1, color: '#fff0'}],
}), {x: -150, y: -150, width: 300, height: 300});
construction.set({mask: fade});
```

An effect belongs to its receiving drawable or group. Bind its properties to parameters when appearance should respond to an input. The effect does not change scientific data, path geometry, rig constraints or the animation clock. A soft mask determines where the artwork is visible but does not detect or track objects in an image.

```demo look-lantern
Carry the lantern.
```

## Blur and glow

Nodes default to `blur:0`, `glow:null`, `blend:'normal'` and `mask:null`. Blur softens the source with a Gaussian whose standard deviation is measured in local authored units within [0,64]. Calling `glow({color='#ffffff',blur=8,opacity=.8})` creates a frozen description of a colored Gaussian shadow at zero offset, drawn behind the source. Glow blur also accepts [0,64] and opacity accepts [0,1]. Supply a supported solid color, including hexadecimal alpha. Glow does not accept `none`, gradients or URLs.

Glow keeps the original source visible, while blur softens the source itself. When both are present, the renderer blurs the source before deriving its glow. Glow opacity multiplies color alpha. Even an invisible zero-opacity glow consumes the conservative effect budget, so set `glow:null` when it is no longer needed.

SVG uses generated `feGaussianBlur`/`feDropShadow` filter resources. Canvas renders the node/group into bounded isolated buffers and filters a complete source image. Group opacity applies once after filtering, so overlapping children do not receive multiple independent opacity reductions. A hard clip constrains the final composite, including the glow.

Blur and glow require a composed transform with nonzero equal scale along both axes and no shear. Translation, rotation and reflection are allowed. Unequal axis scale or shear through an ancestor throws `RENDER_UNSUPPORTED`, even if the node's own scale is uniform. Gradient masks do not share this restriction. Both renderers apply the boundary because accepting a filter only in SVG would produce different Canvas artwork.

The sum of screen-space standard deviations along a filtered hierarchy path is at most 128 CSS pixels. Source buffers include a three-standard-deviation path padding plus two pixels. This preserves contributions from source geometry just outside the viewport instead of clipping it before blur. Final output is still bounded by the frame. Gaussian tails beyond that bounded support are not a claim of infinite-support filtering, and exact antialiasing can vary by platform.

## Blend an isolated construction

Choose a `blend` value according to how the completed source should combine with its backdrop. These modes operate on displayed color channels rather than simulating physical light.

| Value | SVG operation | Canvas operation | Purpose |
| --- | --- | --- | --- |
| `normal` | Normal source-over | `source-over` | It uses ordinary paint order. |
| `add` | `plus-lighter` | `lighter` | It adds light and clamps to the display range. |
| `multiply` | `multiply` | `multiply` | It darkens through channel multiplication. |
| `screen` | `screen` | `screen` | It lightens without simple arithmetic addition. |

A group's blend applies once to its composited source, rather than blending each overlapping child repeatedly against the external backdrop. The SVG root also isolates its content from the surrounding HTML. Paint order still matters. These modes do not introduce depth sorting or physical light transport and use the platform's sRGB compositing rather than a high-dynamic-range radiance buffer.

Native capability negotiation rejects unsupported non-normal SVG/CSS or Canvas composite modes before changing the last valid output. In particular, an SVG platform lacking `plus-lighter` does not silently substitute `screen` for additive light.

## A soft alpha mask

Use `alphaMask(gradient,bounds)` to reveal artwork gradually through a local linear or radial gradient. Supply bounds as `{x=0,y=0,width,height}`. The helper captures its inputs and returns `{type:'alpha',gradient,bounds}`, which you can assign to `mask` directly or return from a trusted binding.

Mask visibility comes from gradient alpha rather than brightness or hue. Opaque black keeps artwork visible just as opaque white does, while transparent white hides it. The rectangle limits the mask, and alpha is zero outside it. Width and height must be positive and at most 100,000 units, with finite coordinates within ±10,000,000. A radial mask can create a soft reveal or shadow-edge treatment without estimating real-world occlusion.

A mask uses coordinates local to its owning node and follows the complete artwork transform, including unequal scaling. You can combine it with a hard clip. The renderer applies those effects in the following order so the mask, clipping and blending operate on the intended completed source.

1. Composite the node's artwork/children.
2. Apply blur, then glow when requested.
3. Multiply by the local gradient alpha mask.
4. Constrain by the hard clip and apply the node's opacity.
5. Blend the completed source into its parent.

The renderer applies masking across the whole temporary buffer, removing pixels outside mask bounds rather than leaving the rest of the source visible. It owns gradient and mask resources, assigns checked unique SVG IDs, and releases them on reset, removal or disposal.

This API does not implement image or luminance masks, arbitrary mask subtrees, automatic segmentation, feathering of arbitrary paths or depth-aware occlusion. Add supported hard clips or gradient masks explicitly after importing artwork. Resource-based SVG mask import remains unsupported.

## Grade the palette without changing the model

```js
import {gradeFrame} from 'explainerkit/look';
const monochrome = gradeFrame(frame, {saturation: 0});
```

`gradeFrame(frame,{saturation=1})` validates and captures a displayed frame, then returns an independent frozen frame with graded paints. Saturation accepts [0,4]. The operation changes supported fill and stroke colors, gradient stops and glow colors while preserving geometry, IDs, hierarchy and paint alpha. It uses encoded-sRGB luminance weights .2126, .7152 and .0722 and clamps to supported color values. The source frame, data and authored defaults are left intact.

Grading occurs before compositing. It is not a camera RAW workflow, a color matrix applied to the final image, an ICC profile transform or HDR color management. RGB values in an alpha mask do not control visibility, so grading leaves them alone. A nonlinear blend may produce a different result if colors are graded before rather than after it. Saturation one keeps the captured paints without an invented visual change.

Use the same grading operation for exposure, contrast, tint and tint amount, shadows, highlights, duotone and cloud point colors. The scene-level `grade({...})` applies it to the displayed sample and can use a scene-owned input for repeatable parameter-driven grading. Sampling, reverse seeking and reset use the same scene-time rules without another animation loop. `shadowOnWall` supplies a separate front-view firelight construction described in the [film kit](film-kit.md#look-grade-and-firelight-shadows).

## Project a simple shadow

```js
import {shadowOnPlane} from 'explainerkit/look';
const footprint = shadowOnPlane([
  {x: 10, y: 20, z: 50},
  {x: 30, y: 20, z: 50},
  {x: 20, y: 40, z: 50},
], {light: {x: 0, y: 0, z: 100}, planeZ: 0});
// Pass only x/y to a 2D polygon helper; z records the receiving plane.
const polygon = footprint.map(({x,y}) => ({x,y}));
// Draw polygon as an ordinary translucent path.
```

`shadowOnPlane(points,{light,planeZ=0})` projects 1–10,000 supplied 3D vertices from a point light onto a horizontal plane. The light must sit strictly above that plane, and vertices must be on or above the plane but strictly below the light. Projection magnification cannot exceed 10,000. The result is frozen `{x,y,z}` points within core coordinate bounds, ready for conversion into a 2D drawing.

This is analytical point-light projection of supplied geometry. It does not infer an object's silhouette, solve intersections, account for blockers, or add a shadow to a node automatically. The caller supplies the polygon, drawing order, color, opacity and any chosen blur/mask. It provides a useful diagram construction without advertising a physical renderer.

## Performance and failure envelope

A frame may contain at most 64 nodes with blur, glow, masks or non-normal blending. The conservative total of padded viewport-pass pixel work cannot exceed 64 million. Each affected node uses one isolated content layer, another filtering layer for blur or glow, and another layer for a mask. Nested effects add to the requirement, while siblings may reuse buffers.

Canvas limits output to eight million pixels and scratch allocation to sixteen million pixels, with padded scratch axes no larger than 8192. More device pixels, filter padding, masks or nesting can therefore exceed limits even when a smaller rendering succeeds. Validation, mode checks and allocation checks run before clearing or resizing the previous image. Missing native filters, excessive radii, unsupported transforms or invalid data produce diagnostics rather than silent approximations. Platform or hardware failure after preparation cannot guarantee rollback of visible pixels.

The browser fixture checks actual SVG-raster/Canvas pixels for blur at DPR 1/2, colored outer glow, viewport-crossing sources, alpha-vs-luminance masks, transformed radial masks, analytic blend colors, combined filter/mask/clip order, grayscale alpha, resource reset and last-valid-frame preservation. Native tests check descriptor capture, work/layer budgets, composed-transform restrictions, grade independence and analytic shadow geometry. These local Chrome fixtures cover the listed cases. They do not establish every engine's output or universal real-time performance.

Seeded grain can be supplied as explicit bounded geometry in the scene. The look module does not silently allocate a per-frame noise texture or claim photographic film emulation. Arbitrary lighting/materials, depth shadows, automatic tone mapping and higher-order filter graphs remain separate work.

## Add a little grain

```js
import {filmGrain} from 'explainerkit/look';

const grain = filmGrain({
  width: 320, height: 180, size: 4,
  intensity: .12, rate: 24, seed: 42,
});

// One ordinary, editable component at a chosen story time.
const overlay = drawing.instance(drawing.component(grain.blueprint(1.5)));

// Or paint a dedicated transparent Canvas layer at that same time.
const {width, height, data} = grain.pixels(1.5);
layerContext.putImageData(new ImageData(data, width, height), 0, 0);
```

Use `filmGrain({width=320,height=180,size=4,intensity=.12,rate=24,seed=0,maxPixels=1048576,maxNodes=4096})` to sample a repeatable grain overlay. It captures settings and provides `pixels(time=0)`, `blueprint(time=0)` and `frameAt(time)`. Width, height and square block `size` are integers in [1,8192], with edge blocks cropped to the requested dimensions. Intensity accepts [0,1], and rate accepts [0,240] frames per second. A zero rate produces a static texture. Seeds are unsigned 32-bit integers.

Each time in [0,86400] seconds selects `floor(time*rate)` together with the seed and cell index. It does not advance a random generator, so repeated samples and backward or distant seeks return identical bytes. `frameAt` exposes the selected frame index, including floating-point behavior at boundaries. Every cell chooses a black or white source-over mark whose alpha is proportional to the magnitude of uniform signed noise. Intensity limits alpha before eight-bit rounding. This creates a digital overlay rather than a calibrated photographic grain process or a zero-mean additive change to the final image.

`pixels(time)` returns a frozen `{width,height,frame,data}` wrapper around a fresh RGBA `Uint8ClampedArray`. You own and may edit its bytes without changing other samples or the captured settings. Work is checked before allocation. The default pixel cap is 1,048,576 and can be raised to eight million, allowing at most 32 million RGBA bytes per call. No hidden cache or rendering loop retains that allocation. Because `putImageData` replaces pixels in its target, put the overlay on a separate Canvas layer and composite that layer over the artwork.

`blueprint(time)` returns a frozen group of ordinary rectangles named `cell0`, `cell1`, and so on in row-major order. Its fills and opacity match the RGBA helper. SVG and Canvas can render it through the component API, and its parts remain editable. The node cap includes the group, defaults to 4,096 and cannot exceed 10,000. Blueprint generation rejects before creating rectangles if `1 + ceil(width/size)*ceil(height/size)` exceeds the declared cap. Increasing block size reduces node count. The surrounding scene's remaining node capacity still applies when an instance is added, so reserve room for the explanation itself.

Choose either pixel output or a blueprint according to how the scene will draw the overlay. Sampling alone does not install it, update a previous component, attach a renderer postprocess or change playback. A blueprint instance remains at its chosen time until you update its ordinary properties. Use the application's existing clock and keep part identity when applying later samples. Native renderers may antialias transparent edges and noninteger transforms differently, so node geometry does not promise identical photographic pixels under arbitrary transforms.

Native tests cover byte ownership, exact rewind, frame holds, seed variation, cropped edge cells, matching geometry/bytes, polarity distribution, zero intensity, immutable settings, component capacity and resource rejection. The browser fixture compares actual SVG/Canvas cell pixels with the RGBA helper and checks raster identity after a forward-and-backward time jump.
