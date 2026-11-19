# Parallax for scroll stories

Parallax makes nearby layers move faster than distant ones, giving a flat scene a sense of depth. Use `explainerkit/parallax` to choose speeds from layer distance, size artwork for its travel and check for exposed edges or excessive movement. Start with a drawing and a few named layers at different depths.

```demo design-train-window
Drag the train left or right, or move it with the arrow keys. The fence posts are late for work. The hills barely move.
```

## One call

```js
import { parallaxRig } from 'explainerkit/parallax';

const rig = parallaxRig(drawing, {
  layers: [
    { name: 'sky', distance: 600 }, { name: 'ridge', distance: 140 },
    { name: 'path', distance: 10 }, { name: 'grass', distance: 5 },
  ],
  subject: 10,     // the path is the depth-1 plane
  travel: 2400,    // px the path pans over the story
});
rig.layer('sky').rect({ ...rig.bounds('sky'), fill: dusk });   // bounds are sized for you
rig.layer('path').add(walker);
console.log(formatParallax(rig.check()));                       // while authoring
```

The rig creates one depth layer per entry, farthest first, sizes each layer's bounds so no edge shows at either end of the travel, and binds each layer's offset to `−pan(t) / depth`. Depths come from distances (`depth = distance / subject`) or are given directly. A frame is computed from time alone, so scrolling backward, seeking and story holds stay exact.

The rig can compute a working layer arrangement from the distances and total travel. Add the following options when the explanation needs pauses, pointer response or control over how motion is reduced.

| Option | Default | Meaning |
| --- | --- | --- |
| `layers` | Required | It supplies 1–16 named layers with depth or distance and optional bounds. Omitted bounds are sized automatically. |
| `axis` | `'x'` | It chooses x, y or both. For both axes, supply travel as `{x,y}`. |
| `travel` | Half the frame | It sets the depth-1 plane's pixel travel over `[from,to]`. A negative value reverses direction. |
| `from`, `to` | `0`, scene duration | They define the story-time interval of travel. |
| `pins` | None | Each `{at,until?,layers?}` slows motion over ease seconds before at, holds until until and accelerates afterward. Progress is adjusted to finish travel at to. Specified layers alone stop and later catch up. |
| `ease` | `0.6` | It sets seconds spent easing into and out of a pin. Zero stops immediately and may trigger a lurch warning at high speed. |
| `drive` | `'layers'` | Layers mode binds each layer's x and y. Camera mode binds camera x and y instead, using inverse-depth projection while keeping zoom. None only creates and sizes layers. |
| `pointer` | `0` | It sets pointer amplitude in pixels at depth 1. Input is clamped to [-1,1] and scaled by depth. |
| `reducedMotion` | `false` | Setting it to true starts with reduced motion enabled. |
| `reduced` | `0` | It scales parallax while motion is reduced. Zero gives a still composition, while 0.3 caps movement at 30%. |
| `rest` | `0` | It chooses the progress in [0,1] displayed by the still composition. |
| `subject` | `1` | It supplies the depth-1 reference distance for layers described by distance. |
| `zoom` | `[1,1]` | It supplies the zoom range used to size bounds for camera or none drive modes. |
| `bleed` | `16` | It adds pixels to every side of automatic bounds for antialiasing and blur. |

Read `layers` for frozen `{name, depth, speed, bounds, handle, id}` records. The rig also exposes methods for drawing into a layer, inspecting its travel and changing interaction settings.

- `layer(name)` returns the layer group so you can draw into it or add a top-level drawing.
- `bounds(name)` and `coverage(name)` return the layer's bounds and whether they cover its travel.
- `pan(time,name?,{pointer})`, `offset(name,time)` and `progress(time,name?)` return numeric motion. To place a label at a screen point during a stop, subtract `rig.offset(name,t).x` from its desired x coordinate. The same values can compensate movement for a walker that should stay on screen.
- `setPointer(x,y)` changes pointer input, while `setReducedMotion(bool)` and `reducedMotion` control and report the reduced-motion state.
- `check(options)` runs `auditParallax` with this rig.

Pointer and reduced-motion settings are scene parameters that the rig re-applies after `scene.reset()`, so a story's `reset: true` seeks keep them.

### Scroll stories

```js
import { attachStory } from 'explainerkit/story';
import { parallaxRig, storyPins, storyRate, connectParallax } from 'explainerkit/parallax';

const rig = parallaxRig(drawing, { layers, travel: 2400, pins: storyPins(acts), ease: .8, pointer: 20 });
const story = attachStory(player, { acts, element, sticky });
const off = connectParallax(rig, { element: stage });   // prefers-reduced-motion + smoothed pointer
rig.check({ rate: storyRate(story.timeline, { viewportHeight: innerHeight }) });
```

- A story hold freezes time, but an abrupt stop may be visually harsh. `storyPins(acts)` supplies pins at act boundaries and holds so layers decelerate into pauses and accelerate out. Supply your own pins when only selected boundaries need a stop.
- `{at,until,layers:['title']}` keeps the named layer still while others move, which lets a layer carrying text wait while it is read.
- `connectParallax(rig,{element})` maps stage pointer coordinates to [-1,1], smooths them over `smoothing` with default .25 s, and returns to center on leave. It ignores pointer movement under reduced motion and follows `prefers-reduced-motion`. Call its returned disposer when the interaction ends.
- `reduced:0` keeps parallax still at rest while other scene content continues. This follows Apple's Reduce Motion approach and WCAG 2.3.3 Animation from Interactions, which calls for a way to disable interaction-driven motion. Use `reduced:.2` when a limited depth effect is intended, and retain a visible control as the demo does.
- Keep a walking character in its path layer. To hold its wrapper at screen position X0, bind x to `X0 + rig.pan(t,'path',{pointer:false}).x − travel × rig.progress(t,'path')`. The world moves under it in full motion, and it walks in place when parallax is off.

## Perspective and coverage

```js
depthFor(140, { subject: 10 });           // 14: fourteen times farther than the subject
speedFor(14);                             // 1/14 of the subject's screen speed
coverage(bounds, 4, { width: 1600, height: 900, x: [0, 800] });
// {required: {x, y, width, height}, covered, missing: {left, right, top, bottom}}
fitBackdrop(4, { width: 1600, height: 900, x: [0, 800], zoom: [.8, 1] }, { bleed: 16 });
```

A translating camera moves nearby objects farther across the image than distant ones. A translation `T` moves a point at distance `Z` by `f·T/Z`. Relative to a subject at `Z₀`, a layer moves at `Z₀/Z` of the subject speed, so depth is `Z/Z₀` and speed is `1/depth`. The scene camera uses the same layer rule through `center O + (C − O)/d`, described in [depth layers](depth-layers.md). Layer drive and camera drive therefore give the same screen offsets, which a test checks. Choosing depths from distances makes their relative speeds follow the same geometry.

Use `coverage` to check supplied bounds or `fitBackdrop` to generate bounds for the depth-1 pan extremes and zoom range. The visible window in a layer is centered at `frame centre + pan/depth`, with half-size `frame/2 ÷ zoom^(1/depth)`. A layer therefore needs `frame + travel/depth` width, and foreground layers with depth below one need extra travel coverage. If the required layer exceeds 8192 pixels, `fitBackdrop` throws `PARALLAX_COVERAGE`. Reduce travel or increase depth to fit. Camera rotation and off-center anchors are not modeled.

## Checks while authoring

Run `rig.check(options)` or `auditParallax(scene,{rig?,from,to,fps,rate,rules,displayWidth,reducedMotion})` while authoring to inspect layer motion. The audit samples at 10 fps by default and returns `{spans,summary}`. Each span identifies its rule, kind, severity, affected IDs, interval and measured value, together with a suggested fix. Its message begins with the time and ends with the action to take, as the example below shows.

```
error   edgeReveal   0:10.7–0:20 ‘hills’ shows its right edge (a 100 px gap); widen its bounds width to ≥ 1816 px or scale its travel to ×0.5.
```

`formatParallax(result)` prints one line per finding or `parallax: clean` when none are found. Without a rig, the checker inspects any scene's `scene.layer()` layers and identifies them by node ID. Check runtime on your authored scene because audit cost depends on sampling rate and layer complexity.

The audit judges speed per real second rather than per story second. Set rate as a number or use `storyRate(timeline,{viewportsPerSecond=1,viewportHeight})` to model scrolling at one screen per second. The default `rate:1` instead treats a scroll story as a film, which may understate its real motion. Setting `reducedMotion:true` checks the reduced path with a near-zero differential-motion cap.

The artwork check starts with fills whose alpha multiplied by opacity is at least .5. It clips their boxes to layer bounds and merges boxes that touch. The largest merged on-stage piece represents the layer, preventing sparse props such as grass tufts or lamp posts from being treated as a full backdrop with gaps.

| Rule | Catches | Threshold | Source |
| --- | --- | --- | --- |
| `edgeReveal` | It finds a backdrop that leaves an edge covered at its widest or tallest frame and suggests larger bounds, artwork or less travel. | Gaps above 1 frame pixel warn, and gaps above 1% of frame width are errors. | The 1-pixel allowance is an engineering choice for antialiasing. |
| `depthOrder` | It finds nearer layers painted under farther ones where artwork overlaps. | It checks overlap above 1% of the frame. | Occlusion should agree with motion parallax. Cutting and Vishton 1995 rank both among strong near-field depth cues. |
| `differentialMotion` | It finds two layers each covering at least 20% of the frame that separate too quickly and suggests depth or travel changes. | The cap is .35 frame widths per real second, with errors above twice that. This is about 11°/s for a 1280-pixel stage viewed at 60 cm. Reduced-motion checking uses .02. | This is an engineering cap. Large-field motion can cause vection, a feeling of self-motion, as studied by Brandt, Dichgans and Koenig 1973. WCAG 2.3.3 supplies no numeric threshold. |
| `movingText` | It finds settled text moving too quickly relative to the stage and suggests fixed HTML, an overlay, a pin or more depth. | The cap is 120 CSS pixels per real second at display width, with errors above twice that. | This engineering cap is below speeds associated with declining dynamic visual acuity in Ludvigh and Miller 1958. |
| `depthSeparation` | It finds adjacent layers moving too similarly, or a construction with more than eight layers, and suggests changing depth or merging them. | It uses 15% speed separation and eight layers. | McKee 1981 reports laboratory speed-discrimination fractions around 5–10%. The 15% allowance and layer count are engineering choices. |
| `continuity` | A seam is a gap between ground bands that meet elsewhere. A lurch is a sudden speed change from a pin or stepped binding. | A seam above 1 pixel is an error. A lurch of .2 frame widths/s within one sample is a warning. | These thresholds are engineering choices. |

Thresholds are declared in `PARALLAX_RULES`. Pass rules to tighten or relax them for your application, keeping the measured values visible. Run the general composition audit as well to check text contrast, overlap and reading time in the same scene.

## Limits

- Coverage does not account for camera rotation or off-center anchors.
- Artwork is measured by bounding boxes rather than precise outlines. A ridge counts its entire box, and a hole in one merged piece is not detected.
- `edgeReveal` checks only layers spanning a frame dimension at some sampled time. A layer that never covers an edge is not treated as a backdrop.
- `differentialMotion` measures each layer beneath the frame center rather than modeling reader gaze or field of view.
- The audit does not check sliding feet in another ground layer or infer object-level depth from movement. Keep a standing figure in the layer containing its ground.
- Per-layer pins require `drive:'layers'` because camera movement affects all layers.
- `INVALID_PARALLAX`, `UNKNOWN_PARALLAX_LAYER` and `PARALLAX_COVERAGE` are documented in [the error-code catalog](../error-codes.md).