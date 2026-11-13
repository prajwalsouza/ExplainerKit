# Shaped layer transitions and several match pairs

Use `player.layer` to show scenes during selected time windows and reveal them through fades or shapes. Use `matchCut` when particular shapes should carry visual continuity between scenes. Both operate on the same scenes and clock as the rest of the player.

## Layer windows, stacking and reveals

```js
const branch = player.layer(branchScene, {
  renderer: branchRenderer, from: 9, until: 12.2, z: 3,
  enter: {kind: 'opening', shape: leafyHole, duration: .8},
  exit: {kind: 'fade', duration: .3},
});
player.layer(pondScene, {
  renderer: pondRenderer, from: 11, until: 15, z: 4,
  enter: {kind: 'wipe', direction: 'left', duration: .3},
});
```

`z` is an integer in [-10000,10000], applied to the renderer element's CSS
stacking order. Equal z values retain DOM order. It does not change scene/world
coordinates, child clocks, node identities or the element's existing positioned
layout. Static elements become relatively positioned without a positional
offset. Authors still stack renderer elements inside the export container;
this is not an automatic page-layout engine. Owned CSS properties, including
priorities, are restored on disposal.

Choose a reveal with the `kind` option on `enter` or `exit`, then set its `duration` and any kind-specific input. Exit evaluates the matching entrance backward.

| Kind | Additional input | Behavior |
| --- | --- | --- |
| `fade` | None | Linear opacity from zero to one |
| `wipe` | `direction:'left'|'right'|'up'|'down'` | A percentage inset reveal; direction names the entering edge's travel |
| `opening` | `shape` | Grow a convex outline from its interior to cover the viewport |
| `flyThrough` | `through` | A reveal through a projected foreground outline, following its authored motion |

Durations default to .4 seconds and must be positive. Enter and exit windows
cannot overlap. Exit samples the corresponding entrance backwards. Existing
`fade` remains supported as the default duration at both ends; an explicit
`enter` or `exit` replaces that end's default fade. Outside the layer window,
the layer is hidden. Shaped transitions have an exactly empty initial mask and
no final mask; the expansion is chosen conservatively so there is no final
unclipping jump for supported convex silhouettes. The same sample repeated or
visited backwards produces the same mask and opacity.

`shape` or `through` can be a circle, rectangle or path clip description, validated absolute commands, or a live circle, rectangle or path handle. Live geometry is sampled through its scene camera, ancestor transforms and registered layer clock. Reused child scenes use the active window, which includes its start and excludes its end. Overlapping source clocks are rejected as ambiguous.

A source scene without a registered clock uses parent time clamped to its duration. `flyThrough` follows the foreground geometry you authored rather than moving it or its camera automatically.

The supported reveal outline is a nondegenerate closed **convex single contour**,
flattened within .25 local projected units and bounded to 512 points. Holed,
concave, empty and open outlines refuse explicitly. The silhouette is geometric;
paint, stroke width, filter/mask appearance and ancestor clipping are not inferred
into it. Prepare an explicit convex silhouette when the visible artwork differs.
This is a deliberate boundary of the first shaped-transition extension.

Masks use CSS percentages, so backing-store DPR does not change their geometry.
The browser must support the sampled CSS clip or it refuses before child render
and style commit. A pre-existing inline or stylesheet clip is an ownership
conflict. Use a separate wrapper if another application owns the renderer clip.

To export the combined layers, set `window.explainerkitExport.element` to their **container** and await its ready promise. Capturing one child canvas cannot include DOM compositing from its siblings. The benchmark in `benchmarks/layer-transitions.mjs` compares exported and live PNGs at five times for each of four reveal kinds, totaling 20 frames. Its rewind check first warms Canvas readback because moving GPU pixels to CPU access can change antialiasing at the edges even when geometry is unchanged.

## Several pairs in one match cut

```js
import {matchCut} from 'explainerkit/morph';
const cut = matchCut({
  from: {frame: capturedFlower},
  to: {frame: capturedMountains},
  pairs: [[petalA.id, mountainA.id], [petalB.id, mountainB.id]],
  alignAt: .2, releaseAt: .8,
});
renderer.render(cut.sample(.45));
```

Omit `pairs` to retain the existing `from.shape` / `to.shape` API. With `pairs`,
`from` and `to` contain `frame` and optional affine `matrix`; per-endpoint
`shape` is excluded to avoid conflicting selections. IDs are explicit, unique
on each side, copied and limited to 64 pairs. Every pair uses the same existing
align/morph/release phases and path correspondence controls. Nonselected
backgrounds crossfade once, rather than once for every pair. Pair list order is
the matched contours' paint order. `background:'hide'` excludes those backgrounds
inside the bridge.

Endpoints equal the complete captured frames exactly. Intermediate geometry is
screen-space and includes pivot and skew transforms. Supported selected
paints remain solid; this request does not add Lab interpolation or automatic
semantic pairing. Fill/stroke paint alpha is retained. Dashed/trimmed selections,
clips, shading/textures and other effects on selections/ancestors explicitly
require prepared filled/unlit outlines. Stroked nonuniform transforms still
require filled stroke outlines. Compatible background lighting is retained;
different global lights on shaded backgrounds refuse rather than changing one
scene's lighting silently.

The aggregate output/preparation budgets apply across all pairs and backgrounds.
The align, middle and release phases are validated, including original contour
command counts near the phase boundaries. Budget or selection failure happens
before playback; sampling retains no frame history.

See `tests/core/layer-transitions.test.js`, `tests/modules/match-pairs.test.js` and `tests/browser/layer-match-checks.html` for checks of layer behavior and matched shape pairs. Recorded measurements are in `benchmarks/results/layer-transitions.json`.