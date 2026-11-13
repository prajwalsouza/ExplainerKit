# Isolate, explode and restore

Use `stage` from `explainerkit/layout` to move parts out of the frame and bring them back while preserving their authored motion. Create the scene and the handles to stage before constructing the controller.

```js
import {stage} from 'explainerkit/layout';
const staging = stage(scene);
staging.isolate(head, {drop: [body, tail], direction: 'down',
  at: 2, duration: .6, returnAt: 5});
// Or author a separate return:
staging.explode([leftPart, rightPart], {at: 7, duration: .5});
staging.restore([leftPart, rightPart], {at: 9, duration: .5});
```

The controller adds offsets sampled from time to existing handles rather than replacing their positions, tracks or bindings. Restoring a handle therefore lands on its authored position at that time, including motion that continued while it was absent. Seeking backward reproduces the same staging state. Disposal removes the controller's effects and prevents further use.

Use `isolate(keep,{drop,...})` to retain one branch while moving the listed branches away. Use `explode(parts,options)` to move several parts outward from their shared arrangement. Both accept `up`, `down`, `left`, `right` or a numeric `[x,y]` direction, and explosion defaults to radial screen-space directions. `restore` uses the original outgoing direction, margin and group of radial parts, even when you obtain a handle again with `part()`.

Times use seconds. Defaults are .6 s duration, `smooth` easing and a 16-pixel extra margin. Set `returnAt` on an outgoing move to schedule a return of the same duration, or call `restore` with its own `at`, `duration` and `ease`.

Staging measures the requested viewport and sampled camera framing, including nested rotation and scale, camera tracks, named-region shots, depth layers, overlays and underlays. It includes idle effects and keyed collection placement while suppressing its own offsets during measurement, which prevents recursive self-measurement. The resulting screen-space movement is converted back through the projected parent transform. Filter padding and conservative miter-stroke extents are included. Supported 2D geometry is therefore offscreen at full departure progress within coordinate and rendering budgets, rather than being moved by an arbitrary fixed world-space distance.

A camera cannot keep following a dropped branch while also letting it leave the view. Such a dependency throws `STAGE_CAMERA_DEPENDENCY`, as do arbitrary camera pose bindings whose dependencies cannot be established. Use explicit camera tracks or region shots. Text without an imported or registered outline throws `STAGE_UNSUPPORTED` with `text.metrics`, because estimated browser-font widths cannot guarantee that all lettering leaves the viewport.

A controller accepts at most 128 handles and 128 chronological, non-overlapping events per handle. Two controllers cannot own the same branch or nested branches, even through separate calls. Disposal releases that ownership, and ancestor changes that create nesting conflicts are rejected during sampling. Different handles for one internal record count as the same object. A dropped branch cannot contain a retained handle. For radial pieces created by the convex-polyhedron API, animate their documented offset inputs because they share depth-sorted rendering rather than independent transform groups.

`tests/modules/staging-effects.test.js` checks exact restoration by independently projecting geometric corners through 36 camera, direction and viewport combinations. Adversarial tests cover ownership, margins, depth and alias handles. The browser fixture in `tests/browser/staging-checks.html` checks actual SVG and Canvas artwork leaving the frame and returning byte-identically, including sharp miters. Unsupported native text must produce the explicit refusal.