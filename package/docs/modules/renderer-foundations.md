# Choose pivots, filters and text outlines

A shape can rotate around its center, hinge from an edge, or stay readable while the camera zooms. These choices affect both the geometry the renderer draws and the space it must reserve around that drawing. This guide explains how pivots, skew, blur and font outlines behave so you can choose those settings deliberately.

## Rotate around a chosen point

A pivot is the point that stays fixed while an object rotates or scales. The default `pivot:null` uses the object's original origin. Supply `[x,y]` to choose a point in its local geometry, or use `origin`, `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left` or `bottom-right` to choose from its bounds.

The following example assumes `s` is an existing scene. Its rectangle turns around the middle of its bottom edge because `pivot:'bottom'` chooses that point before applying rotation.

```js
const card = s.rect({x:100,y:80,width:120,height:60,pivot:'bottom',skewX:.15});
card.animate('rotation',{from:0,to:.2,duration:1});
```

The transform applies the object's position, moves to its pivot, applies rotation and skew, then scales and moves back from the pivot. This order matters because changing a pivot changes where a turn is centered without changing the underlying path.

Keyword pivots use geometry bounds, meaning the enclosing rectangle before strokes and effects extend the drawing. Path bounds include the furthest points of quadratic and cubic curves rather than only their endpoints. Group bounds include the current transforms of their children, so a group's pivot can follow animated geometry. Registered outline fonts supply measured advance widths, while ordinary browser fonts use estimated bounds. Bounds for point clouds also include their point radii.

```demo design-door-pivot
The blue door has a hinge. The red one is going through a revolving phase. Drag the handle and compare where each door stays pinned while it rotates.
```

## Skew and scale a shape

`skewX` and `skewY` slant geometry along its axes. Their values are angles in radians between -1.4 and 1.4, and both default to zero. An object without filters may also have zero scale, which collapses one or both dimensions. Following the orientation of a collapsed target is rejected because that orientation is no longer defined.

Filters need a more restricted transform. Their combined transform, including parent groups, must preserve angles and scale both axes equally without collapsing them. A skewed or unequally stretched filtered object therefore throws `RENDER_UNSUPPORTED` before replacing the previous valid image. Check the parent transforms as well as the object's own scale when diagnosing that error.

## Choose how blur follows the view

Blur softens an edge by spreading its color into neighboring pixels. A numeric `blur` gives the Gaussian standard deviation in scene units, which measures how widely the filter spreads the image. The composed transform scales that value, so the same authored blur can occupy more screen pixels when you zoom in.

Supply `{radius, space:'world'|'screen', maxScreen, strict}` when you need to control that relationship. A world-space filter follows zoom until it reaches the screen cap. A screen-space filter instead keeps its standard deviation fixed in CSS pixels. Glow accepts the same policy settings together with `{color,blur,opacity}`.

The default `space` is world and the default `maxScreen` is 32 CSS pixels, with 128 as its maximum. Device pixel ratio changes how many raster pixels represent each CSS pixel rather than changing those limits. This keeps a high-density display from silently changing the intended blur size.

Use `strict:true` when exceeding a cap should reject the frame instead of reducing the blur. Nested blur and glow passes also share a 128-pixel standard-deviation budget along the chain of parent groups. A strict pass rejects a reduction imposed by that shared budget too. Pixel-allocation limits and checks for unsupported browser features still apply independently of the chosen radius.

## Inspect the work used to draw a frame

After rendering, `renderer.stats.clampedFilters` reports how many filter settings were reduced in that frame, including reductions caused by nesting. The renderer passes the adjusted local radii to its drawing backend without changing the scene's authored frame, so inspecting the scene still shows the values you supplied.

Canvas also reports `stats.isolatedLayers`, the number of temporary content images it drew before combining them into the output. Groups, overlapping fill and stroke, point clouds and objects with effects keep separate images so opacity applies to their combined artwork. A shape with only a fill or only a stroke can apply opacity directly because it has no internal overlap to combine first.

These two ways of applying opacity are mathematically equivalent for eligible shapes, but intermediate browser rounding can produce small pixel differences. Tests allow at most two color levels of difference on an opaque background. At nearly transparent edges, color channels weighted by opacity can differ more after they are divided by a very small alpha value. This is why exact unweighted RGBA bytes are not promised there, and why overlapping groups and combined fill-and-stroke shapes continue to require separate content images.

## Choose browser text or registered outlines

Use a CSS font-family list such as `fontFamily:'Display, sans-serif'` for native browser text. Your page loads the font, and the export runner waits for `document.fonts.ready` before capturing a frame. This lets the browser finish loading the selected face before an image is recorded.

Register a font returned by `parseFont` or `loadFont` with `scene.registerFont('Display', face)` when both renderers need the same letter outlines and measurements. The scene keeps the text itself while drawing the imported letter shapes using their advance widths, which describe how far the next letter is placed along the line.

Imported outlines do not perform text shaping, which selects and positions letter forms for a writing system, or hinting, which adjusts outlines for a particular pixel size. A missing letter uses the font's `.notdef` missing-character glyph. Read the [font outline guide](font-outlines.md) when deciding whether the supported import format and text behavior fit your content.

## Reproducible evidence

The native tests in `tests/core/renderer-foundations.test.js`, `tests/modules/look.test.js` and `tests/renderers.test.js` check transform, filter and compositing rules. The browser fixture in `tests/browser/renderer-foundations-checks.html` checks actual SVG and Canvas pixels, alpha differences at device pixel ratios one and two, zooming, filter stability and preservation of the previous image after a rejected frame.

Recorded focused browser results contain the source revision, local timings and measured filter frames. They include 1,000-circle timing checks and 400 zoom renderings. The recorded WebKit build refused unsupported filter work explicitly instead of rendering it, so that result establishes the refusal behavior rather than filter support. A focused report is not evidence that every suite, device or artwork has been checked.

These fixtures use original synthetic content and font bytes. Comparing an explanation with a reference video requires the separate local reference workflow, because numerical filter checks do not measure likeness to that video.

## Optional 3D adapters

The Three.js adapter rejects a non-origin pivot with `THREE_UNSUPPORTED` and capability `transform.pivot`, and nonzero skew with capability `transform.skew`, before changing its committed scene. Positive descriptor blur uses its named `look` refusal. A raw `worldMatrix3D` request similarly reports `UNSUPPORTED_TRANSFORM` instead of dropping a pivot or skew silently.

Null, origin and `[0,0]` pivots and zero skew use the supported spatial transform behavior. Choose a renderer that supports the transform and filter combination your explanation needs rather than assuming that an effect available in SVG or Canvas is also available in a solid 3D view.
