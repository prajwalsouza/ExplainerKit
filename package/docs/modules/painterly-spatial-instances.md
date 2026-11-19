# Spatial billboards, painterly fills and nature masses

Use these helpers to draw repeated camera-facing shapes, textured fills and groups of grass or foliage. They reuse procedural points, the spatial camera, native texture resources and scene ambient inputs. Prepare a scene and a point field before installing the artwork so the scene can own its handles and sampled state. No separate animation engine or clock is created. For repeated shapes along a path, use `points({along:...})` with `instance`.

## Camera-facing shape instances

A billboard is a flat shape that always faces the camera. Use billboards for leaves or similar marks that need depth and perspective without becoming oriented 3D meshes.

A billboard is a flat shape that always faces the camera. Use billboards for leaves or similar marks that need depth and perspective without becoming oriented 3D meshes.

```js
import {points, attribute, instance} from 'explainerkit/procedural';
import {perspectiveCamera} from 'explainerkit/spatial';
const field = attribute(points({count:1000, seed:8,
  in:{rect:[-400,-250,800,500]}}), 'z', p => p.rand2*1200-600);
const camera = scene.derive([], c => perspectiveCamera({z:800-c.time*80},
  {width:scene.width,height:scene.height}));
const leaves = instance(scene, field,
  {type:'tongue',width:5,height:13,fill:'#547c49',alpha:1}, {camera});
// Or share an existing space's camera and setCamera ownership:
// const leaves = space.instance(field, localShapeOrCallback, {tag:'leaf-tunnel'});
```

`instance(scene,field,shape,{camera,batch,tag,maxBatches})` installs a field in a scene. If you already have a spatial region, use `space.instance(field,shape,{batch,tag,maxBatches})` to share its camera and `setCamera` control. Each field has a fixed count of 0–4096 points with finite x, y and z values. Supply a procedural field with a z attribute, a captured array of point records, a pure function of scene time, or a derived or data input owned by the scene. A camera can be a prepared spatial camera, a derived camera owned by the scene, or a pure provider. Its viewport dimensions must match the authored scene.

A static shape is captured when the field is constructed. A `(point,time) => shape` callback is instead checked on each sample, even if it reuses a mutable scratch array. Shapes use the procedural descriptors or local path commands. In-plane rotation uses radians. Perspective scales local units by focal length divided by depth, while orthographic projection keeps scale independent of depth.

The renderer sorts billboards from back to front using camera-space depth and the original index to resolve ties. It discards center planes behind the camera or outside near and far clipping limits before dividing by depth. Conservative screen bounds keep partially visible shapes. This ordering does not solve triangle intersections or the occlusion of arbitrarily oriented meshes. Billboard `type:'glow'` cannot supply native soft-glow falloff and is rejected. Use soft-light geometry or a separate layer for that effect.

One derived plan assigns shapes to fixed slots in draw order. Uniform opaque built-in shapes with explicit `alpha:1` are batched automatically within the 10000-command limit for each path. Custom, transparent or mixed callback shapes reserve one slot per point by default so batching does not change their appearance. Set `maxBatches` to reserve a smaller capacity or `batch:false` for individual slots. If later samples exceed capacity, `PROCEDURAL_TOPOLOGY` is raised instead of dropping marks. Total sampled path work cannot exceed 100000 commands. Invalid initial data is rejected before nodes are installed, while invalid later callback results fail the sample. Callback errors retain their cause under `PROCEDURAL_CALLBACK`.

The result has `handle`, `count`, `nodeCount` and `sample(time)`, whose frozen
rank summaries expose original `indices` and camera `depths`. The result owns
no separate player. Repeated arbitrary seeks reproduce ordering and geometry.
Changing cardinality requires constructing a new instance field.

## Painterly fills on the existing texture pipeline

```demo design-wood-grain
Go against the grain. Drag the brush or use the arrow keys to change the direction of the strokes inside this wooden tabletop.
```

```js
import {paint} from 'explainerkit/graphics';
scene.rect({width:1920,height:1080,fill:paint({
  kind:'brush', colors:['#32515a','#97ac83'], seed:9,
  direction:.6, frequency:3, scale:4, amount:1,
})});
```

`paint` creates a `{type:'texture',...}` resource that fills, strokes, texture overlays, SVG, Canvas and the SVG filter-image path can share. Choose `'noise'` or `'brush'` for `kind`, with noise as the default, and supply 2–8 supported colors. Each 32×32 tile maps smoothly varying noise and directional variation through the palette. Brush mode adds short bands resembling directional strokes, while an amount of zero returns the palette midpoint as a flat color.

Set `direction` in radians, `frequency` within .1–16, `scale` within .25–16, and `amount` within 0–1. The seed is an unsigned 32-bit integer, and `space` is `'shape'` or `'screen'`. Defaults are direction 0, frequency 2, scale 1, amount 1, seed 1 and shape space. These are artistic settings for limited tile resources rather than a simulation of real paint or an inference of a photographed style.

Palette cells hold validated colors, while grain, paper, hatch and halftone cells use the monochrome path. SVG and Canvas may resample cell boundaries differently when a tile is scaled. The synthetic visual fixture shares exact tile data and seeds and checks mean absolute RGBA error below 2 out of 255 across the full composition, including soft light and foliage. The optional solid renderer rejects unsupported texture paints rather than discarding them.

## Grass, foliage and soft lights

```js
import {grassMass, foliageCluster, glowLight} from 'explainerkit/procedural';
const ambient = scene.ambient();
grassMass(scene,{x:0,y:800,width:1920,height:280},{
  density:.001, colors:['#254c3f','#527a46','#a0b56c'],
  wind:{ambient,amplitude:.2,period:5}, seed:7,
});
foliageCluster(scene,{x:100,y:150,width:1650,height:400},{
  leaves:350,depth:.5,wind:{ambient,period:5},seed:4,
});
glowLight(scene,{x:1200,y:50,width:600,height:500},{
  color:'#fff4b0',opacity:.3,
});
```

Pass the scene explicitly so it can own the generated handles, validate them and manage ambient inputs. Bounds use `{x?,y?,width,height}` in scene units. Grass generates `floor(width*height*density)` blades with density .001 by default. Foliage generates 200 leaves by default, and `depth` in [0,1] controls size across fixed depth bands. Both accept 1–8 colors and cap output at 5000 blades or leaves. Their result includes `{handle,count,nodeCount,ambient,bounds,period,...}`.

The helpers distribute seeded points, sort them by vertical depth and batch contiguous opaque color bands. Grass uses quadratic blade paths and foliage uses curved tongue silhouettes. These constructions make groups of scene artwork rather than botanical species models, collision solvers or occlusion solvers.

Wind reads ambient time so it can move independently of scroll-controlled story time. Its amplitude is in [0,1] and its period is .1–86400 seconds, with defaults .2 and 5. Omit the ambient input to create `scene.ambient()`, or supply one owned by the scene. For a repeatable sample, pass both times explicitly, as in `scene.sample({time:0,ambient:1})`. The mounted player manages live scheduling and freezes it when reduced motion or a hidden page requires that. The sine wind repeats without advancing random state, and fixture pixels at zero and one full period are identical. Sampled clock values must remain within [0,86400].

`glowLight` returns a circle handle scaled to the supplied ellipse and filled
with a soft radial gradient. It defaults to warm light at opacity .6, supports
an optional tag, and does not allocate blur-filter scratch surfaces. Existing
presence/tracks can animate that handle.

## Field-coordinate warnings

If shapes appear far outside their intended field, run `auditFrame` or `auditScene`. Generated instances retain private information about their source field and geometry. The audit reports `instanceGeometry` when more than 75% of a shape's conservative bounding area lies outside its field box, which can reveal scene coordinates accidentally supplied as local commands. A finding includes the field tag, IDs, outside fraction and both bounds. Set `rules.instanceOutside` within [0,1] to change the threshold, or use 1 to disable it. Rectangular bounds are captured at generation, while other fields use sampled point extents when a positive-area box exists.

Treat that warning as a reason to inspect the artwork rather than proof of an error, because intentionally large shapes can also trigger it. The check does not find arbitrary handwritten duplicate geometry or establish transformed screen-space overflow. Its private source information follows live generated identities and is not serialized into snapshots. Contrast checks mark painterly fills as textured and approximate their palette color, without proving contrast at every pixel of a varying material.

## Reproducible evidence and remaining acceptance gates

Run `tests/modules/part5-procedural.test.js` and the browser fixture
`tests/browser/nature-procedural-checks.html`. It checks actual SVG/Canvas output,
depth/culling, backward seeks, ambient periodicity and tagged audit findings.
The fixture also measures 1000 opaque shape billboards and a 1920×1080 frame
with 537 grass blades, 350 foliage leaves, painterly background and soft light.
Each timing includes scene sampling, Canvas rendering and synchronous 1-pixel
readback, after four warmups over twenty frames. `budgetMet` is the measured
95th-percentile frame-time condition (`p95 <16 ms`). The report retains timings and maxima even when that condition fails. Browser-fixture correctness passing does not turn a slow run green.

Performance depends on shape complexity and device capabilities. Custom paths keep individual paint order and may cost more than opaque built-in billboards. Correctness and timing are separate outcomes, so a visual pass cannot make a slow run meet the frame budget. Reference-video structural similarity and style likeness remain unverified by these synthetic cases.

A timestamped three-engine report records 15 correctness checks together with all timing rows. Its Firefox nature-frame p95 of 16 ms does not meet the strict `<16 ms` target, and the report retains that failure. Use the report for the exact measured source and workload rather than treating a timing from one machine as a guarantee.

The current nature-procedural report and its timestamped counterpart retain the results of the measured run, including maxima. A p95 pass can still include frames above the target, so these reports do not establish an all-frame or universal-device guarantee.