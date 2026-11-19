# Reveal, fill and frame

Define clips and paint with `explainerkit/graphics` and render them with SVG or Canvas. Every effect uses the owning node's local coordinate system; the existing scene camera and ancestor transforms then move it with the artwork. These descriptors accept no network assets, markup or paint URLs. The separate [SVG importer](svg-import.md) captures supported supplied markup into scene geometry.

```js
import {clipCircle, linearGradient} from 'explainerkit/graphics';

const globe = drawing.circle({
  x: 300, y: 200, r: 100,
  fill: linearGradient({
    x1: -100, y1: 0, x2: 100, y2: 0,
    stops: [
      {offset: 0, color: '#278b88'},
      {offset: 1, color: '#b4e1ba'},
    ],
  }),
  clip: clipCircle({r: 90}),
});
```

## Clip a construction

A `clip` is a declarative region, not a second scene node. It hides everything outside the region. A clip on a group affects all its descendants. Nested clips intersect; they do not merge into one larger region. A clip is applied after the node's local transform and before the clipped result is composited into its parent. Group opacity still applies once to the complete clipped group.

The clipping helpers validate and copy all nested values, then return descriptions you can use in shape and component properties, `set` calls or bindings. Choose the helper according to the region you need to keep visible.

```demo design-crop-circle
This crop circle belongs in a vegetable patch. Drag the round window or move it with the arrow keys. The crops show through only where the two clips overlap.
```

| Helper | Parameters | Result |
| --- | --- | --- |
| `clipRect` | `{x=0,y=0,width,height,rx=0}` | Axis-aligned local rectangle; radius clamps to half width/height at rendering |
| `clipCircle` | `{x=0,y=0,r}` | Local disk; nonuniform node scaling produces an ellipse |
| `clipPath` | `{commands,fillRule='nonzero',units='user'}` | M/L/Q/C/Z path in local coordinates, or normalized shape bounds with `units:'bounds'` |

Widths, heights and radii must be nonnegative, at most 100,000 authored units. Zero-sized clips are empty visible regions. Positions/path coordinates are finite within ±10,000,000. A clip path accepts at most 10,000 commands; it must start with M. Reserved keys, sparse arrays, accessors and executable values reject during capture. Unknown descriptors and paint URLs never resolve to external resources.

Use `clipPath({units:'bounds',commands:...})` when the clipping outline should follow the shape’s geometric bounds. In those coordinates, `(0,0)` is the upper-left corner and `(1,1)` is the lower-right. Stroke width is excluded from the bounds, and coordinates outside 0–1 are allowed within the usual finite limits. SVG uses `objectBoundingBox` while Canvas applies the equivalent local transform, preserving the imported clip’s coordinate meaning.

Bounds clips require explicit shape geometry or outlined text. Groups, point
clouds and browser-measured text refuse with capability `clip.bounds.geometry`
before changing the displayed frame; use ordinary local clip coordinates for
those objects. Existing descriptors keep local coordinates by default.

Set `clip:null` to remove a clip. A clip description cannot be changed in place, so animate its dimensions by creating a new description from a scene parameter in a binding. The next example changes the rectangle’s width while keeping its height fixed.

```js
import {clipRect} from 'explainerkit/graphics';
const reveal = drawing.parameter(0);
const construction = drawing.instance(component);
construction.bind('clip', {
  inputs: [reveal],
  map: progress => clipRect({width: 500 * progress, height: 300}),
});
reveal.to(1, 1, {duration: 2});
```

Here time remains ordinary story time. Seeking directly to any timestamp reproduces the clip without replaying an imperative effect. A reusable component owns its default clip; local instance property overrides and reset use the same core ownership rules as other properties. Raw clip descriptors such as `{type:'circle',x:0,y:0,r:90}` are accepted through property validation, but helpers make the signature clear.

Clipping is a hard geometric boundary, not an alpha/luminance mask, blur, feather or boolean path operation. It does not change layout bounds or physically cut/split the model. Current adaptive layout measures the underlying artwork rather than using a clip as proof that its contents fit. A clipped text label still exists in the semantic scene; do not rely on clipping as the sole accessibility visibility state.

## Fill a contour with holes

All drawable properties accept `fillRule:'nonzero'` (default) or `'evenodd'`. A compound path may use either rule. With evenodd, each additional crossing toggles whether the interior is filled, so an inner contour can create a hole regardless of its winding direction. Nonzero uses the accumulated signed winding; consistent direction matters.

```js
const ring = drawing.path({
  commands: [
    ['M', 0, 0], ['L', 100, 0], ['L', 100, 100], ['L', 0, 100], ['Z'],
    ['M', 30, 30], ['L', 70, 30], ['L', 70, 70], ['L', 30, 70], ['Z'],
  ],
  fill: '#278b88', fillRule: 'evenodd',
});
```

```demo design-bagel-hole
Find the bagel loophole. Press the bagel to switch its fill rule. The same two contours leave a hole with `evenodd` and fill the center with `nonzero`.
```

A `clipPath` has a fill rule independent of its artwork’s rule. Changing either selects a different rule immediately rather than interpolating an undefined intermediate winding. Strokes follow contour boundaries without filling holes. Use [compound morphs](advanced-constructions.md) with explicitly named contours when a holed shape must change outline because the single-contour morph API rejects holes.

## Local gradient paint

Use a gradient as either a `fill` or a `stroke` when color should vary across the object. Its coordinates belong to the shape’s local space, so moving the shape also moves the paint.

```js
import {linearGradient, radialGradient} from 'explainerkit/graphics';
const light = radialGradient({
  x: 0, y: 0, r: 100,
  stops: [{offset: 0, color: '#fff8'}, {offset: 1, color: 'transparent'}],
});
```

`linearGradient({x1=0,y1=0,x2,y2=0,stops})` blends along the line between distinct endpoints. `radialGradient({x=0,y=0,r,stops})` blends outward from radius zero to a positive radius in [1e-6,100000]. Both use the shape’s local units.

Supply 2–64 `{offset,color}` stops with nondecreasing offsets in [0,1]. Supported named colors and hex values include alpha-bearing hex and `transparent`. Names are case-insensitive and copied in lowercase. `none` removes paint and cannot be a stop color. Equal offsets make a hard color change, and positions beyond the stop interval keep its nearest endpoint color.

SVG uses local `userSpaceOnUse` resources, and Canvas constructs native gradients under the same local-to-view transform. The chosen interpolation space is native sRGB. Very small samples near anti-aliased boundaries may differ across rendering engines; the browser fixtures compare interior pixels with explicit tolerances. For linear gradients relative to shape bounds, use `units:'bounds'`; see [camera choreography](camera-choreography.md#bounds-relative-linear-gradients). Repeating/reflecting spread, arbitrary focal circles, image/pattern fills and external paint resources are unsupported by these gradient helpers.

Gradients are paint values rather than standalone scene entities. Shape keys and components retain identity when a gradient changes. Bind a trusted pure mapping to `fill`/`stroke` to drive gradient coordinates/stops parametrically. Cross-gradient interpolation is not implicitly supplied by this module; whole-object updates follow the core transition's categorical policy unless a separate transition option explicitly supports the paint.

```demo design-disco-gradients
The disco ball has a point. Drag the light across its mirrored tiles. The center of the gradient moves in the ball’s local coordinates, and the clip stays in place.
```

## Resource ownership and failure behavior

SVG stores generated clip/gradient definitions inside its own `<defs>`, with renderer-unique IDs unrelated to author-supplied markup. Allocation checks existing document IDs, including resources created by a separately loaded copy of the renderer. Stable node/property pairs retain resource IDs while definitions change. Removing a clip/paint/node removes unreferenced resources; disposing the renderer removes its entire owned subtree. A gradient update does not replace the keyed SVG artwork element.

Canvas reuses the bounded opacity-isolation layers. A clip is applied once at its compositing destination, so opacity isolation does not double-apply clip-edge alpha. Ancestor clips still intersect every descendant's final composite. Unsupported clip/gradient methods report `RENDER_UNSUPPORTED` before clearing/resizing the previous frame. Malformed descriptors, invalid fills and exceeded command/stop budgets also reject before either renderer commits visible changes.

Existing node/depth/raster limits remain. All drawable and clip path commands together are limited to 100,000 per display frame. All gradient stops together are limited to 100,000 per frame. Each descriptor's own limits apply even when the drawing has opacity zero; hidden invalid input is not a route around validation. Native platforms can still fail after successful capability validation; these checks do not constitute a transactional guarantee against hardware/browser failure.

## Evidence and source boundary

The implementation follows the coordinate, clipping and winding concepts in [CSS Masking Level 1](https://www.w3.org/TR/css-masking-1/), [SVG 2 painting](https://www.w3.org/TR/SVG2/painting.html) and the [HTML Canvas 2D specification](https://html.spec.whatwg.org/multipage/canvas.html). These are platform contracts; no implementation library was imported.

The native tests cover immutable capture, unsafe/accessor inputs, bounds, stops, descriptor validation and scene snapshot bindings. Browser checks in the test suite compare actual SVG-raster and Canvas pixels for transformed nested clipping with group opacity at DPR 1 and 2, compound holes, nonuniform circle clipping, gradients/alpha, resource identity/cleanup, failure preservation and backward seeking. These local Chrome fixtures do not establish every browser/device's behavior. Separate modules implement [gradient alpha masks and blur/glow](look.md), [convex polygon booleans](shape-operations.md), and [SVG geometry import](svg-import.md); arbitrary feathered path masks, generalized picking and image/video assets are outside this clipping contract.
