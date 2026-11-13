# Choose a module

Start with a scene, connect values to visual properties, then choose how people
experience it. You do not need to learn every module before making an explanation.

```js
import {scene} from 'explainerkit/core';
import {hsla} from 'explainerkit/color';
const drawing = scene({width: 640, height: 360});
drawing.circle({x: 320, y: 180, r: 40, fill: hsla(170, 60, 40)});
```

The tables list implemented modules, with links to their examples and supported limits. Start with [Getting started](../getting-started.md) for a complete scene, then use this page to choose the next capability. The API is in alpha, and architecture proposals may describe features outside the implemented modules.

## Build and connect

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/core` | Scene identity, handles, components, keyed data, parameters, bindings, tracks and sampling | [Runtime API](../runtime-api.md) |
| `explainerkit` | Shorter import for the same `Scene` and `scene` constructors | [Library layers](library-layers.md) |
| `explainerkit/data` | Scales, units, transformations and plot/axis blueprints | [Data](data-modeling.md) |
| `explainerkit/geometry` | Path construction, placements, measurement, deformation, polyhedra and drawing tools | [Constructions](advanced-constructions.md), [drawing](drawing-batches.md), [polyhedra](polyhedra.md) |
| `explainerkit/geometry/shapes` | Combine, intersect, subtract or split polygons and outlines | [Shape operations](shape-operations.md) |
| `explainerkit/graphics` | Validated paint, gradients, clipping and textures | [Graphics](graphics.md) |
| `explainerkit/color` | Procedural HSLA, safe conversions, hue-aware mixing and explicit RGB interpolation | [Color](color.md) |
| `explainerkit/typography` | Editable letters and symbols, plus animated HTML text | [Glyphs](glyph-objects.md), [DOM text](dom-typography.md) |

## Move and transform

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/motion` | Pure timelines, easing, staggering, motion paths, springs and secondary motion | [Timelines](timelines.md), [curves/stagger](motion-curves.md), [springs](native-motion.md) |
| `explainerkit/motion/effects` | Seekable typewriter, object wipe, fly-in, pulse, teeter and colour flash presets | [Common effects](common-effects.md) |
| `explainerkit/inputs` | Live observations, settled hover intent and reactive parameter/data bindings | [Live inputs](live-inputs.md), [hover intent](story-cues-hover-intent.md) |
| `explainerkit/physics` | Analytic oscillator and trajectory models; no universal physics simulation | [Secondary motion](secondary-motion.md) |
| `explainerkit/morph` | Match points and outlines, change shapes, and animate splits or merges | [Morph safety](morph-safety.md) |
| `explainerkit/transitions` | Capture and interpolate supported scene states | [Runtime API](../runtime-api.md) |
| `explainerkit/rigs` | Calculate joint positions and deform artwork with skeletons and skins | [Rigs](advanced-rigs.md) |
| `explainerkit/noise` | Scalar/vector fields, fractal/ridged noise, domain warp and deterministic grids | [Procedural](procedural.md), [fractal fields](procedural-fields-networks.md) |

## Arrange and frame

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/layout` | Placement, text wrapping, callouts, measured labels and responsive planning | [Compose](compose.md), [annotations](annotations.md) |
| `explainerkit/layout/labels` | Focused measured-label API | [Measured labels](measured-labels.md) |
| `explainerkit/layout/annotations` | Focused annotation policy | [Annotations](annotations.md) |
| `explainerkit/camera` | Camera control, transforms, framing, depth, focus and shutter math | [Camera](camera-choreography.md), [depth](depth-layers.md) |
| `explainerkit/spatial` | First-party 3D transforms, projection and picking | [Spatial](spatial-three.md) |
| `explainerkit/zoom` | Nested coordinate systems and detail that changes with screen size | [Deep zoom](deep-zoom.md) |
| `explainerkit/look` | Visual effects and color adjustments, with resource limits | [Look](look.md) |
| `explainerkit/parallax` | Depth-layer relationships for scroll presentation | [Parallax](parallax.md) |
| `explainerkit/audit` | Composition, motion, continuity, contrast, measured palette and 3D rendering diagnostics | [Composition](composition-audit.md), [motion](motion-diagnostics.md), [continuity](continuity-audit.md), [palettes](palette-audit.md), [3D rendering](render-audit.md) |
| `explainerkit/perception` | Grouping suggestions with author overrides | [Grouping](rigs-morphing-perception.md) |

## Video VFX

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/vfx` | Recorded footage analysis, camera track preparation with default stabilization, point and plane tracking, and compositing | [Track graphics on recorded video](video-vfx.md) |
| | Text attached to recorded footage | [Text anchors](video-vfx.md#compare-text-anchors) |
| | A screen replacement behind a moving person | [Foreground mattes](video-vfx.md#replace-a-screen-behind-a-speaker) |
| | Automatic proposals and selected plane tracks | [Surface tracking](video-vfx.md#track-screens-and-surfaces) |
| | Camera movement, floor placement and depth ordering | [3D placement and occlusion](video-vfx.md#place-an-object-in-a-moving-shot) |
| | Moving foreground depth and tabletop placement | [Moving foreground](video-vfx.md#composite-behind-moving-people) |
| | Scene color and cast shadows | [Lighting and shadows](video-vfx.md#match-the-light-and-shadow) |
| | A joint rig and object contact in footage | [Rigged characters](video-vfx.md#animate-a-character-in-recorded-footage) |
| | Animated wildlife and a folding rover in a living room | [Woodland and rover](video-vfx.md#bring-a-woodland-into-a-living-room) |
| | Interactive clues in a reading room and a stone alley | [Scene text](video-vfx.md#place-clues-in-moving-footage) |
| | A live flock steers around furniture and a moving person | [Boids in footage](video-vfx.md#guide-a-flock-through-a-recorded-room) |

## Add a specialist construction

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/characters` | Character runtime, faces, poses, walking and acting | [Characters](characters.md), [shared 2D/3D biped motion](biped-motion.md), [profile rigs](character-profiles.md), [coordinated timing](coordinated-motion.md), [pose keys](keyed-poses-follow.md) |
| `explainerkit/mechanisms` | Connect 2D movement in gears, rolling objects, cranks and belts | [Mechanisms](particles-mechanisms.md) |
| `explainerkit/particles` | Seeded emitters sampled by time | [Particles](particles-mechanisms.md) |
| `explainerkit/procedural` | Points, density fields, network spacing, instances and generated masses | [Procedural](procedural.md), [fields and networks](procedural-fields-networks.md) |

These toolkits are optional. Their models connect to the same scene inputs and properties; a basic
scene does not import the character, mechanism or sound runtime. Artwork packs
are separately licensed content, not engine code.

## Write and design explanations

These are production modules. They run while you make a piece, in Node or a build step, and never inside the finished page.

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/design` | Model-assisted research, story design, scripts, fables and series, then hooks and attention, and visual design (shot plans, structure, colour, motion, feeling, sound and multimedia checks), with deterministic measures and checks | [Design explanations](design.md) |

## Present, edit and export

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/player` | Browser mounting, clock, interaction lifecycle and disposal | [Runtime API](../runtime-api.md), [timeline playback](timeline-player.md), [existing-renderer projection](projection-player.md) |
| `explainerkit/scroll` | Scroll-to-time adapter | [Story delivery](story-delivery.md) |
| `explainerkit/story` | Scroll acts, holds, controls and reversible cue policies | [Story delivery](story-delivery.md), [cue policies](story-cues-hover-intent.md) |
| `explainerkit/film` | Narrated film composition and player | [Film](film-kit.md) |
| `explainerkit/film.css` | Opt-in film UI stylesheet | [Film](film-kit.md) |
| `explainerkit/media` | Media-clock synchronization | [Media clock](media-clock.md) |
| `explainerkit/sound` | Sound generation and explicit playback | [Sound](sound.md), [playback](sound-playback.md) |
| `explainerkit/sound/mix` | PCM mixing and WAV encoding | [Mixing](audio-mixing.md) |
| `explainerkit/sound/studio` | Synthesizer, plucked, struck, percussion and sampled instruments, an effect rack with equalisers, dynamics, reverbs and delays, and loudness meters | [Studio instruments](studio-instruments.md), [studio effects and meters](studio-effects.md) |
| `explainerkit/music` | Score composition and variations, MIDI exchange, arrangement in bars and beats, produced mixes with buses, returns, loudness targets and stems, song analysis, beat grids, retargeting and adaptive scores | [Music](music.md), [produce a score](music-production.md), [time visuals to music](music-analysis.md) |
| `explainerkit/editor/timeline` | Optional keyframe/timeline editing | [Timeline](timeline.md) |
| `explainerkit/project` | Bounded project recipes and history | [Projects](projects.md) |
| `explainerkit/assets/preload` | Explicit bounded resource loading | [Delivery](story-delivery.md) |

## Render or import

| Import | Responsibility | Guide |
| --- | --- | --- |
| `explainerkit/renderers/svg` | Native SVG scene rendering | [Renderer contracts](renderer-contracts.md) |
| `explainerkit/renderers/canvas` | Native Canvas 2D scene rendering | [Renderer contracts](renderer-contracts.md) |
| `explainerkit/renderers/webgl` | Native WebGL point/line buffers | [WebGL](webgl-points.md) |
| `explainerkit/renderers/three` | Explicit optional Three.js rendering with reversible owned-material palettes | [Three](spatial-three.md), [material palettes](three-material-palettes.md) |
| `explainerkit/adapters/dom` | Connect authored values to HTML | [DOM](dom-typography.md) |
| `explainerkit/adapters/waapi` | Explicit native browser animation | [WAAPI](waapi.md) |
| `explainerkit/import/svg` | Inert supported SVG geometry | [SVG](svg-import.md) |
| `explainerkit/import/font` | Bounded TrueType/WOFF outlines | [Fonts](font-outlines.md) |
| `explainerkit/import/gltf` | Bounded static glTF/GLB geometry | [glTF](gltf-import.md) |

Renderers support different effects and resource limits. Three.js is optional and supplied
explicitly. Importing core does not fetch dependencies. Importers do not interpret
arbitrary executable files; unsupported formats fail explicitly.

## Compatibility entries

Use the imports in the tables above for new code. Additional public names include `explainerkit/model`, `explainerkit/modeling`, `explainerkit/shapes`, `explainerkit/compose`, `explainerkit/composition`, `explainerkit/adaptive`, `explainerkit/rig`, `explainerkit/rigging`, `explainerkit/dom`, `explainerkit/waapi`, `explainerkit/timeline` and `explainerkit/media/audio`. They expose the same implementations as their corresponding modules rather than separate engines. The [generated API inventory](../api-inventory.md) lists every export.

## Scope and evidence

Reliable seeking requires the same declared inputs, including seed, data, viewport, interaction and ambient time where relevant. Each module documents its supported formats and work limits. The current [live-input guide](live-inputs.md) explains the implemented observations and their device limits. A test pass does not establish physical-device, screen-reader or universal renderer behavior. See the [release process](../release-process.md), [type scope](../types.md) and [architecture](../architecture.md) for their separate checks.
