# Cinematic maps in 3D

A cinematic map shows a region as a miniature landscape on a table, with exaggerated relief lit by a low sun, rivers and lakes that read as water, and a lens that keeps one band sharp. `explainerkit/renderers/three/cinematic` builds that scene in Three.js from the geography in [`explainerkit/maps`](relief-maps.md), marks the subject of each beat with highlights, and finishes each frame for film or for live play.

Three.js is never imported by the library. Pass the Three module namespace as the first argument, as with the [Three adapter](spatial-three.md). Textures such as the water halftone and the cloud atlas are also passed in, so nothing here fetches files. Every function that creates GPU objects returns a `dispose()` that releases them.

```demo design-map-shot-switch
It was a long shot. Drag the film marker or use the arrow keys to fly over a 3D miniature valley and get close to its lake and river. Reduced motion replaces the flight with a cut.
```

## Build a map of a region

Start from a heightfield and the asset packs: a map style, a light rig, a grade and a lens. The example assumes `THREE` is the Three module, `renderer` is a `THREE.WebGLRenderer`, `values` holds elevations in metres, and the four packs are already parsed from `assets/cinematic-maps/` and `assets/cinematic-look/`.

```js
import {heightfield, flow, rivers} from 'explainerkit/maps';
import {reliefMap} from 'explainerkit/renderers/three/cinematic';

const land = heightfield({columns: 448, rows: 312, values, bounds: {x0: -280000, y0: -195000, x1: 280000, y1: 195000}});
const traced = rivers(land, flow(land), {threshold: 900, maxRivers: 18});
const map = reliefMap(THREE, {
  field: land, style, rig, width: 2, exaggeration: 24,
  rivers: traced.map((r, k) => ({id: `r${k}`, points: r.points, drainageAlong: r.drainageAlong})),
  lakes: [{outline: lakeOutline, elevation: 1788}],
  labels: [{text: 'Highlands', x: -150000, y: -60000, size: 0.07, font}],
  textures: {halftone, cloudAtlas},
});
scene.add(map.group);
scene.fog = map.fog(6);
```

The map spans `width` scene units from west to east, with x pointing east, y up and z south. `exaggeration` multiplies heights. The style's own value of 3 suits a small area, and a region a few hundred kilometres across needs roughly 15 to 30 to read as a tabletop model rather than a flat sheet. Use `map.toScene(x, y)` to turn region metres into scene positions and `map.groundAt(sceneX, sceneZ)` to find the ground, including carved valleys.

## Rivers and lakes are drawn as water

Drawing a river and highlighting it are different jobs. `reliefMap` draws every river as part of the land, and highlights are added separately for the subject of a beat.

A river is a strip of water whose width follows the water it carries. Pass `drainageAlong` from `rivers()`, which counts how much land drains through each point, and the width grows with that count from about a third of `riverWidth` at the source to the full width downstream. The strip is coloured from a muddy bank through grey-teal shallows to a deep channel. Lower rivers carry more silt and turn browner, and shoals vary the colour along the length. Its banks fade into the land instead of ending in a hard line.

Each river also cuts a channel into the terrain with a gentler valley around it, and a darker band of vegetation follows its banks. The water surface never runs uphill, because it follows the lowest ground reached so far downstream. A lake cuts a basin below its surface, gets a ring of sand at its shore, and is coloured from light shallows at the edge to deep water in the middle.

The water reflects a small sky made from the rig, which gives it a gradient with the viewing angle, and a ripple texture breaks the sun's reflection into sparkle. Both are generated in the library. The work of carving is capped, and a request that would exceed the cap is refused with `RESOURCE_LIMIT`, so reduce the number of rivers or `riverWidth` if that happens.

## Highlight the subject of a beat

`mapHighlights` adds an editorial layer on top of the map. Each highlight has a kind, a start time `at`, a `duration` for its entrance, and optionally an `out` time and `outDuration` for its exit. Call `setTime(time)` every frame. The result depends only on time, so a scrubbed film shows the same frame.

```js
import {mapHighlights} from 'explainerkit/renderers/three/cinematic';
const highlights = mapHighlights(THREE, map, {style});
highlights
  .path('blue-nile', 'r0', {kind: 'glow', at: 1, duration: 2.6, out: 4.6})
  .area('basin', basinOutline, {kind: 'raise', at: 4.2})
  .place('lake', {x: -95000, y: 40000}, {kind: 'ring', at: 5.2});
// each frame:
map.setTime(time);
highlights.setTime(time);
```

A path is a river id or a list of region points. An area is an outline in region points, and a place is a single point. The kinds differ in what they say about the subject.

| Kind | What the viewer sees |
| --- | --- |
| Path `glow` | A line of light draws along the path with a brighter leading head. |
| Path `trace` | A crisp ink line draws along it, like a pen on the map. |
| Path `dash` | Dashes march along it, for routes and borders. |
| Path `pulse` | Packets of light travel along it, showing the direction of flow. |
| Path `ribbon` | A glowing curtain rises from the ground along the path. |
| Area `outline` | A band of light draws around the edge. |
| Area `wash` | A colour sweeps across the area. |
| Area `spotlight` | Everything outside the area dims. |
| Area `hatch` | Drifting diagonal stripes fill the area. |
| Area `contours` | Lines of equal height appear inside the area. |
| Area `wall` | Glowing walls rise along the edge. |
| Area `raise` | The land inside the area, with its rivers and lake, lifts out of the map, tilts toward the viewer and casts a shadow into the dark socket it leaves. |
| Place `ring` | Ripples spread out from the point. |
| Place `pin` | A pin drops in and settles. |
| Place `beacon` | A beam of light rises from the point. |

Options set `color`, `width`, `height`, `intensity`, `feather`, `interval` (for contours), `lift` and `tilt` (for a raise) and `ease`. `remove(id)` takes one highlight away, and `dispose()` releases all of them.

## Finish frames for film or live play

`cinematicPost` applies the look in the pack's order: the lens blur with a sharp band, bloom from bright areas, filmic tone mapping, the split-tone grade, the vignette, colour fringing only where the image is sharp, and grain.

```js
import {cinematicPost} from 'explainerkit/renderers/three/cinematic';
const post = cinematicPost(THREE, renderer, {width, height, lens, grade, rig, mode: 'film'});
post.render(scene, camera, {frame: frameNumber});
```

The default mode, `film`, renders each frame 64 times with sub-pixel camera offsets and averages them, which smooths edges and shadows. It is meant for frame-by-frame export, where time per frame does not matter. `mode: 'interactive'` renders once per frame. Pass `still: true` while the camera and the story clock are stopped, and the chain keeps adding samples, up to 16, so a paused view sharpens toward film quality. Any frame with `still: false` starts again.

`qualityGovernor(quality)` chooses interactive settings from measured frame times, following `quality.json`. Give it each frame time with `record(ms)`. When the slower quarter of frames stays more than 15 % over budget for 30 frames, it drops one setting in the pack's order, starting with the pixel ratio. When frames stay well under budget for 120 frames, it raises one back. `record` returns `'drop'` or `'raise'` when the settings change, so you can resize the renderer and call `post.setTaps(governor.settings.dofTaps)`.

## Move the camera between shots

`cameraShots(shots, {reducedMotion, move})` turns a list of shots into a camera pose for any time. Each shot gives `at`, `position`, `target` and `fov`, and the camera eases into the next shot over the last `move` seconds before it. With `reducedMotion: true` the camera never flies. It holds each shot and cuts halfway through the move, as the quality pack specifies for readers who ask for reduced motion.

## Record a shot

A map shot at film quality is recorded one frame at a time, because each frame averages many renders. Give the page a `window.explainerkitExport` hook whose `seek(time)` sets the camera from `cameraShots`, renders the frame with `post.render` in `film` mode and returns once the frame is drawn. Serve the page over HTTP and run the exporter from your project. The [film export guide](export-film.md) describes the hook and every option of the command.

```bash
npx explainerkit-export-film --url http://localhost:8080/map-shot/ --out ./renders/map-shot --width 1920 --height 1080 --fps 30 --from 0 --duration 6
```

The frames land in `./renders/map-shot`. A shot built from real elevation and waterways needs a region prepared first, with its source credits shown beside the render, which [Prepare a region from real data](map-data.md) explains.

The same scene can [lift a phrase from a source document](source-text.md#mark-the-phrase-then-lift-it). The `liftChip` handle releases its Three.js geometry and materials through `dispose()`, and the caller keeps ownership of the texture it supplied.

## Limits

The terrain mesh has at most 2,048 cells along its longer side, the post chain supports frames up to 3840 × 2160, and film mode averages up to 256 samples. Rivers are limited to 500 and lakes to 200 per map. Lighting is rasterised, with shadow maps and a generated sky. The path-traced film look, volumetric clouds, cloud shadows on the ground and carved label normals described in the design packs are not implemented. Real elevation data has to be prepared separately, with its sources and licences recorded.
