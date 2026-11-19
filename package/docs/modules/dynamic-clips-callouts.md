# Moving clips, groups and callouts

A live clip uses another scene object’s outline to hide part of a drawing. A callout follows a target with a ring, line and panel. The examples assume `s` is an existing scene and show how these relationships keep working as objects move.

```demo design-new-ewe
Drag the sheep across the swatches, or use the arrow keys, for a whole new ewe. The pattern stays put while the sheep’s outline moves the clip.
```

```js
const subject = s.circle({x:250,y:250,r:80});
const pattern = s.rect({width:800,height:500,fill:'#ef6655',clip:subject});
const group = s.group({x:20}, [pattern]);
pattern.set({clip:subject});
```

Use a scene handle as a clip to keep the clip shape synchronized with a moving object. The clip samples the target's current geometry, including ancestor transforms, and converts that outline into the clipped node's coordinates. Sampling a later frame and seeking backward produces the same clip. It does not use the target's opacity as a mask. The target must belong to this scene and remain attached. Authored rectangle/circle/path descriptors retain their existing behavior. `reset('clip')` restores the initially authored handle clip. Invalid sets, cross-scene references, reference cycles and adoption that would introduce a cycle refuse before mutation.

A circle can remain an exact native circle when its relative scale is uniform. More general transforms on circles and rounded rectangles are approximated with cubic circular arcs, targeting at most .01 units of error in both clipped-local and scene coordinates. Each arc allows at most 128 segments before `CLIP_PRECISION` is reported. Camera zoom may still magnify the scene-unit error.

A visible object with a collapsed transform reports `CLIP_SINGULAR`, while an object with zero opacity may emit an empty clip. For a group target, child circles, rectangles and paths form a compound clip using the group’s fill rule rather than a Boolean union. Text and cloud targets report `CLIP_UNSUPPORTED`, so supply a path outline if those shapes must define the clip.

`scene.group(props, children)` accepts existing ordinary root handles, preserves their identities and local coordinates, and adopts them in the given order. Duplicate handles, other scenes, collection-owned instances, depth layers and excessive depth refuse before any group is created. Group transforms then apply to all children. Existing `group.add(handle)` also checks dynamic clip cycles.

```js
import {callout} from 'explainerkit/layout';
const hud = callout(s, {
  target:subject,
  anchor:[35,-25],
  ring:20,
  panel:{width:230,height:110,side:'auto',content:panelArt},
  route:'elbow',
  at:2,
});
```

`callout` returns `{ring,line,panel}` handles. The anchor uses target-local coordinates transformed with the target’s complete sampled matrix. Ring radius, panel size, gap and stroke width use scene units, so sizes stay fixed in scene space while positions follow the target.

Supply panel content as a component or top-level handle that can join the panel group, with its local origin at the panel’s center. An ancestor of the target cannot become that content. The panel supplies a solid background, but you must ensure the artwork fits its declared dimensions.

The reveal draws the ring for .25 seconds, the leader line for .5 seconds and the panel for .3 seconds. Change these durations with `timing:{ring,line,panel}`. Choose an `elbow` or `straight` route, with `hud` as the supported style.

As the ring and panel grow, the leader follows their displayed edges rather than the final unscaled outline. Its full path runs from the ring boundary to the nearest panel edge, and animated trimming reveals that path progressively. The panel background stays clear of the target’s sampled bounds.

`panel.side` accepts `right`, `left`, `above`, `below`, or `auto`. Auto uses the existing `place()` planner to choose an initial side, then evaluates four target-relative candidates per frame to reduce viewport overflow without recursively sampling the scene. Candidates remain clear of the target; a crowded viewport can still require overflow. It does not promise avoidance of every other moving object or seamless side switches. The complete motion is deterministic under seeking.

Tests in `tests/core/dynamic-clip-callout.test.js` cover coordinate conversion, seeking, cycles, failures that leave the scene unchanged, identity preservation and leader edges within .5 units. The browser checks in `tests/browser/compose-api-checks.html` compare live clips with authored descriptors in SVG and Canvas and inspect moving callouts. The synthetic screenshot at `artifacts/compose/callout-1280.png` uses no reference-film assets.