# Cut a shape. Keep track of the pieces.

Use `explainerkit/geometry/shapes` to combine polygons, cut one from another or partition a source into pieces. Use `explainerkit/morph` to animate supported split, merge and match-cut transitions. They return ordinary paths or frames for SVG and Canvas and keep scene timing and application identities separate from geometric construction.

For outlines with concavity or holes, such as chipping a stone, use `booleanPath` ([film kit](film-kit.md#cut-any-outline)). The convex operations below remain the basis for partitions.

A fracture piece contains only its portion of the source geometry. This lets you separate real pieces instead of duplicating the complete silhouette and fading several copies. Start with a supported polygon and inspect the generated pieces before adding motion.

```demo design-cookie-cutter
Take a byte out of a cookie. Drag the round cutter, or focus it and use the arrow keys. Union keeps both shapes, subtraction takes a bite out of the cookie, and intersection keeps only where the shapes overlap.
```

## Polygon set operations

```js
import {polygon, union, subtract, intersect, centroid} from 'explainerkit/geometry/shapes';

const plate = polygon([
  {x: 0, y: 0}, {x: 100, y: 0},
  {x: 100, y: 80}, {x: 0, y: 80},
]);
const opening = polygon([
  {x: 30, y: 20}, {x: 70, y: 20},
  {x: 70, y: 60}, {x: 30, y: 60},
]);
const frame = subtract(plate, opening);
drawing.path({commands: frame.commands, fill: '#278b88', stroke: 'none'});
```

`polygon(points)` accepts 3–256 ordered vertices describing one simple convex polygon. Simple means the boundary does not cross itself, and convex means it has no inward corners. Coordinates must stay within ±1,000,000. Construction captures and freezes input, removes adjacent duplicates and collinear boundary vertices, accepts an optional closing vertex and normalizes winding. Repeated nonadjacent vertices or repeated laps are rejected before area is accumulated. Concave, self-crossing or degenerate input is rejected rather than approximated. Even a star with consistent turn signs must pass the stronger check that every vertex lies inside every edge's half-plane.

The returned compiled shape cannot be changed and contains the polygons, path commands, area and diagnostics shown below. Use that object as input to further operations rather than reconstructing an outline from its visible stroke.

```js
{polygons: [convexPoints, ...], commands, area,
 diagnostics: {method: 'convexHalfPlanes', partitionSeams}}
```

`union(a,b)`, `subtract(a,b)` and `intersect(a,b)` accept convex point arrays or compiled shapes, so results can be reused in later operations. Output polygons partition the filled region into non-overlapping convex pieces. Subtraction can therefore represent a hole without inventing a self-crossing contour. An empty result has zero area and no commands. `centroid(shape)` returns the filled region's area-weighted center and rejects an empty shape. Use `polygonArea(points)` for signed area about a local origin when the input vertices are already valid.

Clipping tests points against the directed half-plane on each side of a boundary edge. Subtraction retains outside fragments while removing the intersection, and union combines `A minus B` with B. This supports the declared convex partitions rather than arbitrary SVG curves. Output may retain internal partition edges, so filling works but stroking all commands can reveal seams. Read `diagnostics.partitionSeams` before choosing that stroke. Removing every interior edge to create a minimal stroked outline is not implemented.

Each boolean call is limited to 256 output convex polygons, 8192 vertices and 2,000,000 clipping-vertex operations. Floating-point clipping uses a scale-dependent tolerance rather than exact geometric predicates. Local-origin cross products reduce cancellation when a shape has a large shared translation. Features close to tolerance may collapse, be rejected or disappear as zero-area fragments, so correctness below supported precision is not guaranteed.

## Fracture actual geometry

```js
import {fracture} from 'explainerkit/geometry/shapes';
const cut = fracture(plate, {pieces: 12, seed: 892});
for (const piece of cut.pieces) {
  drawing.path({commands: piece.commands, fill: '#278b88'});
}
```

Call `fracture(shape,{pieces=8,seed=1,sites})` to divide the actual source into regions nearest to generated sites, known as Voronoi cells. The same seed and inputs return the same immutable result. `pieces` is an integer in 1–64 and seed is an integer in 0–2³²−1. To control placement yourself, supply exactly one distinct `sites:[{x,y}]` point inside the source for every requested cell.

The result records `{pieces,source,seed,area,diagnostics}`. Each piece has a stable ID, compiled shape, commands, polygons, area and generating site. If the source is disconnected, one Voronoi cell can contain several disconnected polygons. The pieces' interiors are disjoint and their union covers the source within floating-point tolerance. Fracture therefore supplies a geometric partition without simulating shatter physics.

```demo design-ice-fracture
This ice has separation issues. Drag the orange site to redraw the cracks, then slide the pieces apart with the lower handle. The pieces keep the same total area as the starting slab.
```

The sites determine the cells. Sliding the pieces apart only changes where the demo draws them. Compare the total reported area before and after you move the orange site.

Site generation tries at most 100,000 candidates. Supply sites explicitly when a source is too thin or disconnected for reliable random sampling. The fracture shares clipping-work and total output-vertex budgets across all pieces. Collapsed cells throw `NUMERIC_DEGENERACY` instead of being returned as useful geometry. Outside sites, duplicates, unknown options, accessors and sparse data are rejected.

## Split and merge

```js
import {createSplitMorph, createMergeMorph} from 'explainerkit/morph';

const targets = [leftPolygon, middlePolygon, rightPolygon];
const split = createSplitMorph(plate, targets, {
  seed: 12, assign: 'nearest', stagger: .1, samples: 96,
});
const merge = createMergeMorph(targets, plate, {seed: 12});

const pieces = split.sample(progress); // [{id, from, to, commands, progress, opacity}]
const frame = split.frame(progress, {width: 960, height: 540, fill: '#278b88'});
```

A split first partitions the source into as many pieces as there are targets. Pass a `fracture(...)` result when you want to control that partition. A merge partitions the target and brings source pieces into those regions. Either endpoint list can contain compiled polygons, convex point arrays or `{id,shape}` records. Both ends must contain the same number of pieces within 1–64.

```demo design-split-decision
Give the crew some space. Drag the shuttle right to split the capsule into three craft, then dock them in a new silhouette. Follow each colour through both moves.
```

Pieces at either endpoint must have disjoint interiors within numerical tolerance. Overlaps throw `OVERLAPPING_PIECES`, and pairwise validation is limited by a total squared-vertex budget of 8,000,000. Every morph piece must have one convex contour. A disconnected or multi-polygon cell throws `MORPH_TOPOLOGY` because matching its separate boundaries would require an author decision. Decompose a concave outline or a letter with holes into explicit convex pieces before using this operation. It does not replace arbitrary lettering with a convex hull.

Choose `assign:'nearest'` to match each piece once by squared distance between area centroids, resolving ties by source and target index. This deterministic greedy match is not the globally optimal Hungarian assignment. Choose `assign:'index'` to keep your supplied pairing. `stagger` accepts [0,1] relative to one piece's normalized duration. The schedule spans `1 + stagger*(count−1)` before mapping to overall progress [0,1], so all pieces still reach their exact source at zero and target at one. The `samples`, `tolerance`, `align` and `reverse` options follow the single-contour morph rules.

The sampler returns immutable results without accumulating history. The `frame` method also accepts `stroke` and `strokeWidth`. Filled pieces may show antialias seams where their edges meet, while a stroke intentionally reveals the cuts. A merge assembles target pieces without erasing their identities or claiming that several application entities became one. Diagnostics make that distinction through `partitionedEndpoints:true` and `semanticIdentityMerge:false`. Intermediate contours can still fold or overlap, because valid endpoint partitions do not prove valid topology throughout a transition.

## Match a cut across scenes

```js
import {matchCut} from 'explainerkit/morph';
const cut = matchCut({
  from: {frame: firstScene.sample(), shape: firstShape.id},
  to: {frame: nextScene.sample(), shape: nextShape.id},
  anchor: {x: 480, y: 270},
  alignAt: .2, releaseAt: .8,
});
const display = cut.sample(progress);
```

A match cut needs two captured display frames with the same viewport and a selected path, circle or rectangle ID at each end. Use display frames to match the view the reader actually sees. Ancestor translation, rotation and scale are combined with the projected 2D camera wrapper before matching. An optional `matrix` transforms only the chosen contour rather than the complete background frame.

The transition uses three phases to bring the chosen shapes through a shared screen anchor. This staging gives you control of the visual match without changing either scene's model or duration.

1. From progress 0 to `alignAt`, the source contour moves and scales to the common screen anchor.
2. From `alignAt` to `releaseAt`, it morphs into the aligned target while other content crossfades.
3. From `releaseAt` to 1, the target moves and scales back to its authored screen location.

```demo design-pizza-time-cut
It’s pizza time. Drag the film tab or use the arrow keys. The pizza outline moves to the shared anchor, becomes the clock face as the backgrounds crossfade, then moves into the clock shot.
```

Defaults are `alignAt:.2`, `releaseAt:.8`, `anchor:viewport center`, `scale:1` and `background:'crossfade'`. Choose `background:'hide'` to suppress other content inside the transition. At progress 0 and 1, sampling returns the exact captured full endpoint frames without changing duration, narration or model. Keep `0 < alignAt < releaseAt < 1` when choosing other staging times. The selected shape is excluded from the background copies to avoid drawing it twice.

Alignment centers the conservative bounds of control points and keeps outline size multiplied by `scale`. It does not identify equivalent semantic features or equalize filled area. The optional `samples`, `tolerance`, `align` and `reverse` settings prepare point correspondence. Solid paints switch halfway through unless you supply an explicit solid `fill`. The selected shape keeps opacity inherited from its ancestors.

The match cut keeps stroke caps, joins, miter limit and fill rule. Uniform screen scaling, including reflection and the optional extra matrix, scales stroke width with geometry during alignment and release. A visible stroke needs a nonsingular uniform transform. Prepare a filled screen-space outline yourself when a stroke has nonuniform scaling or shear.

Unsupported selections are rejected before playback. They include clipped outlines, partially trimmed strokes, unprojected 3D nodes, groups or text, gradients on selected strokes and implicit local paint transforms. Blur, glow, masks or non-normal blending on the selection or its ancestors are also rejected rather than disappearing. A path must satisfy the single-contour morph rules. Filled outlines may have nonuniform transforms flattened into coordinates.

Background IDs are renamed inside the transition so the two frames do not collide. Construction validates each endpoint and the combined transition against limits of 10,000 nodes, 100,000 path and clip commands, and 100,000 gradient or mask stops. Both background trees count during a crossfade even when one has zero opacity. The crossfade wrapper adds one hierarchy level, so a retained branch must fit within 63 existing levels and 64 including the wrapper. A transition that exceeds these limits is rejected even if each endpoint is valid alone.

With `background:'hide'`, no background wrapper or background paint stops are needed, although exact endpoint frames must still be renderable. Sampling stays deterministic in reverse. Your application chooses the visual match because this helper does not search footage automatically or retime recorded video.

## Evidence and provenance

Native tests check independent rectangle area formulas,100 seeded translated rectangle identities, area conservation and pairwise disjointness of fracture cells, exact half-rectangle Voronoi cells, real split/merge endpoint partitions, deterministic staggered reverse sampling, composed match-cut transforms, inherited opacity, screen stroke attributes, rejected unsupported effects/transforms, depth boundaries and exact endpoint scenes. Browser fixtures render subtraction holes, split/merge samples, staged match cuts and scaled-stroke bridge continuity through both SVG and Canvas.

The clipping construction follows the mathematical half-plane approach introduced by Sutherland and Hodgman, [Reentrant Polygon Clipping,1974](https://doi.org/10.1145/360767.360802). Voronoi cells are built directly from pairwise perpendicular-bisector half-planes. No external polygon, triangulation, Voronoi or morph implementation is imported. These tests establish the supported finite2D cases, not a general CAD boolean/precision guarantee.
