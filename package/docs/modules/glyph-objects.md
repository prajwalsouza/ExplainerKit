# Glyph objects and animated reflow

`glyphs` from `explainerkit/typography` uses a parsed TrueType face from the
[font importer](font-outlines.md), not browser-dependent fallback measurements.
It measures letter placement, gives you a handle for each glyph, and lets you move glyphs between lines at chosen times. A glyph is a rendered letter, number or symbol. Generic shape/handle methods are indexed in the
[runtime API reference](../runtime-api.md#working-objects).

```js
import {glyphs} from 'explainerkit/typography';
import {loadFont} from 'explainerkit/import/font';
const font = await loadFont(selectedFontFile);
const equation = glyphs(scene, '1=1', {font, size: 120, x: 100, y: 250});
equation.handles[0].animate('rotation', {from: 0, to: .12, at: 0, duration: .2});
equation.insert(1, '+', {at: 1, duration: .3});
equation.morph(2, '+', {at: 2, duration: .4});
equation.remove(0, {at: 3, duration: .3});
```

The returned `group` moves the whole line. Its `handles` array describes the latest authored glyph order, and the same glyph objects survive insertion, rearrangement and removal. Each is a text node with a copied outline, so SVG and Canvas can deform its shape while keeping its character identity.

A private placement group controls spacing, opacity and horizontal reveal scale. Animate the returned glyph handle’s transform for additional movement without taking over that placement. Removed glyphs remain available when sampling earlier times.

`insert(index, text, options)`, `remove(index, options)`, and `morph(index, symbol, options)` schedule chronologically with non-overlapping intervals. Indexes refer to the latest authored sequence, not the current playhead. Options are `at` seconds (default 0), `duration` seconds (default .3, zero allowed), and a named or trusted `ease` (default `smooth`). Invalid timing, glyph coverage, indexes or capacity refuse before changing the line's timeline. Glyph size is 1–1,000 scene units, matching native semantic-text limits. The line supports at most 2,048 historical glyphs and 256 edits; scene/path budgets still apply.

Advances and pair kerning come from the imported face. During insertion/removal, the new/removed glyph's visible horizontal scale and occupied advance grow/shrink together, while neighboring origins interpolate between the measured layouts. Spacing is exact for those interpolated layouts; intermediate glyphs intentionally have partial advance, rather than promising a full-width inserted glyph before space has opened. Easing overshoot is clamped for this occupancy calculation. `sample(time)` exposes character, origin, effective advance, opacity and horizontal scale for all historical glyphs, plus the current target text and interpolated line width. Its results depend only on time and authored events.

```demo design-glyph-opportunity
An O-pportunity. Drag its admission ticket or move it with the arrow keys. The O takes up more space as it enters, so the right-hand A slides over to make room.
```

## Clone, carry and attach

```js
const source = glyphs(scene, 'AB', {font, size: 80, x: 80, y: 200});
const destination = glyphs(scene, 'A', {font, size: 80, x: 500, y: 200});
const copy = source.clone(1, {at: .5});
figure.hold(copy, {hand: 'F', from: .5, to: 1.2, blend: .05});
destination.attach(copy, 1, {at: 1.3, duration: .3});
```

`clone(index,{at})` creates a distinct ordinary glyph handle, invisible before
`at`, with the source's outline, solid paint, world position and rotation at that
time. The source remains in its line. `detach(index,{at,duration,ease})` returns
the **existing** handle, freezes its world placement at `at` and closes the old
layout gap over the edit interval. A free glyph retains its own transform
channels for `bind`/`animate` and [character holding](keyed-poses-follow.md).

`attach(freeHandle,index,{at,duration,ease})` opens a measured destination slot
and moves that same handle into it. The source and destination must share the
same parsed font object and size. Release a hold before the attach interval;
hold blend-out must also have ended. Earlier hold, layout and free-glyph frames
remain seekable. `handles` always describes the latest authored line order;
use `scene.locate(freeHandle,{time})` for a departed glyph's world pose rather
than its former line's layout-occupancy sample.

Transfers support plain world-space line ancestors with origin or numeric
pivots, including affine rotation/skew/scale. Screen overlays/underlays, depth
layers, region-scoped roots, collection placement, clips, filters and
geometry-dependent ancestor pivots refuse before transfer allocation. A static
authoring-time lift of the private placement wrapper lets a departed glyph
survive its source line hiding; sampled bindings retain its earlier hierarchy
appearance. No playhead-dependent structural reparenting occurs.

## Driven gaps and whole-line edits

`line.gap(index,width)` opens space before the indexed glyph, or after the line
when `index === line.handles.length`. Width is a number, an owned scalar
parameter/derived/ambient input, or `{inputs,map}` returning a finite
nonnegative width up to 100,000. Inputs/callback are captured; another scene's
inputs refuse. A data source can enter a mapping, but cannot itself be a scalar
gap. The gap follows its anchor glyph identity through edits; replacing a gap
driver is an authoring change across the timeline.

A gap can connect letter placement to a moving point. In the next example, the line starts at the origin and the second glyph’s visible edge follows the parameter `edge`.

```js
const line = glyphs(scene, 'AB', {font, size: 80});
const originalEdge = scene.locate(line.handles[1], {time: 0}).box.x;
const edge = scene.parameter(originalEdge + 80,
  {min: originalEdge, max: originalEdge + 400});
line.gap(1, {inputs: [edge], map: x => x - originalEdge});
```

This accounts for the font's side bearing as well as its advance. In this
untransformed example world and line-local units coincide; convert an external
world point to line-local units when the line has a transformed parent. Zero
gap reproduces the ordinary measured layout.

`line.to(text,{at,duration,ease,swap:'instant'|'grow'})` computes a text edit,
retaining the common prefix/suffix and eligible stroke-symbol identities.
`grow` is the default. Instant swaps replace disappearing/appearing ink at the
start while neighboring origins still reflow over the window; supported symbol
morphs also use that window. End text and
layout match a fresh measured line. As with insert/remove, author edits in
chronological, non-overlapping windows.

Choose `pivots` when an important symbol must keep its handle while text is edited on both sides. The example retains the equals sign even though more characters are inserted before it.

```js
const line = glyphs(scene, '1+20=40', {font, size: 72});
const equals = line.handles[4];
line.gap(4, 24);
line.to('1+20+20=60', {at: 1, duration: .4, pivots: ['=']});
console.assert(line.handles[7] === equals);
```

`pivots` splits both texts into segments, then applies the same prefix/suffix
edit within each segment. Each pivot retains its ordinary handle, bindings,
paint, transforms and identity-anchored gap. Its measured origin still reflows;
this option does not pin it to a world coordinate. The final layout matches a
fresh line with the same gaps. Without `pivots` (or with `[]`) the previous edit
plan is unchanged. Supply at most 256 single Unicode code points. Repeated
pivots select the next occurrence in each text, from left to right. A missing,
out-of-order, sparse or accessor-backed pivot list refuses before installing
nodes or an edit; caller mutations after scheduling cannot change the plan.

`line.remove(index,{at,style:'fadeThenClose',fade:.2,close:.3})` first fades the
glyph in place without moving neighbors, then closes the gap. An explicit
`duration` must equal `fade + close`; either phase may be zero. The default
`style:'shrink'` retains the previous simultaneous shrink/fade behavior.

## Stroke parts, morphs and bending

The `=`, `+`, Unicode `−` and `×` symbols can be built from geometric bars while retaining font-measured spacing. Their visible center may differ from the original font outline’s center, even with the same advance width. Measure their actual drawn bounds with `scene.locate` when placing camera targets or annotations.

```js
const {box} = scene.locate(line.handles[index], {time});
const centre = box && {x: box.x + box.width / 2, y: box.y + box.height / 2};
```

`box` is the world-space axis-aligned ink bound, including the glyph's current
transform. `locate().x/y` are its transformed origin, not the ink centre; a
missing box means there is no measurable ink. Named morphs include `=`↔`+`, `+`↔`×` and `−`↔`+`; bar
lengths remain constant while centers/angles change. The additional minus/plus
bar grows in thickness, so the invisible bar need not grow in length. These are
explicit stroke forms, not decomposition of arbitrary font outlines. Other
symbols refuse with `GLYPH_MORPH_UNSUPPORTED`. The semantic character switches
at the transition midpoint.

`line.parts(index)` exposes two path handles for `=`, `+` or `×`, and one for
`−`. Detach a part with `line.detach(partHandle,edit)`, then reassemble it with
`line.attach(partHandle,originalGlyphIndex,edit)`. Parts retain sampled
historical placement and can be held like other free handles. Parts require
opaque flat, unstroked source ink; translucent, gradient, stroked or filtered
source glyphs refuse rather than changing their compositing when the outline
is split. Clone retains supported solid paint alpha/strokes and is a separate
operation from exposing stroke parts.

Reassembly is exact in vector commands. Separate paths can differ from the
original compound outline at a few antialiased edge pixels; browser checks
measure that sparse raster tolerance rather than promising byte-identical
part-exposure pixels. Unsupported paint refusals preserve the existing pixels.

Use `line.deform(index,latticeOptions)` to bend a glyph’s imported outline while retaining its text identity. It connects that glyph to the [lattice deformation](deformation.md) API, so you can animate control points rather than replacing the letter.

```js
const bend = equation.deform(0, {columns: 3, rows: 2, subdivisions: 8});
const control = bend.point(2, 0);
control.y.animate({from: control.original.y, to: control.original.y + 20,
  at: 4, duration: .4});
```

Choose either a symbol morph or a lattice deformation for a glyph because both cannot drive its outline at once. Font import still does not provide automatic complex-script shaping, hinting or stroke-skeleton extraction. A missing ordinary character is rejected unless `missing:'notdef'` explicitly requests the importer’s fallback glyph.

Native and browser checks cover measured edits, random target strings, rigid
bar lengths, original outline deformation, phased removal, transfer identity,
paint and transactional refusals. The carried-glyph fixture combines skewed
parents, actor sockets, hiding the source line, reattachment and exact earlier
and backward raster frames. These original synthetic cases do not establish
reference-film likeness or universal font decomposition.

## Load font bytes in a page

To load a font into a page, configure package imports and provide a `#stage` element first. The example fetches bytes you host, parses the font, and uses it for both ordinary text and an editable glyph line.

```js
import {scene} from 'explainerkit';
import {parseFont} from 'explainerkit/import/font';
import {glyphs} from 'explainerkit/typography';
const response = await fetch('/assets/fonts/MyFont.ttf');
if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const font = parseFont(bytes);
const drawing = scene({width: 960, height: 540});
drawing.registerFont('Display', font);
drawing.text({text: 'Measured type', fontFamily: 'Display', fontSize: 40});
const line = glyphs(drawing, 'A=A', {font, size: 120, x: 100, y: 250});
const player = await drawing.mount(document.querySelector('#stage'));
```

Supply your own hosted font URL. The bundled development server serves `.ttf`,
`.otf` and `.woff` MIME types; parser support depends on the actual container
and outlines. See the [complete loading/format guide](font-outlines.md#load-a-font-from-a-page)
for plain repository import paths, WOFF1 loading and native-CSS versus
registered-outline font behavior.
