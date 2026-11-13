---
name: explainerkit
description: "Use whenever a task involves building, animating or checking an interactive explanation, explorable, scroll story, explainer film, diagram animation or data visualisation with the ExplainerKit JavaScript library. Routes to the specialised ExplainerKit skills and explains how to find capabilities and verify results."
---

# ExplainerKit

ExplainerKit builds interactive visual explanations as scenes. A scene holds shapes, text, characters and values, and every frame is a pure function of time. You describe what changes and when, and a player or a scroll story owns the clock. That design is why seeking, export, audits and narration timing work, so draw into the scene rather than straight to a canvas.

## How to work

1. Find the capability. Use the MCP tool `find_capability`, or search `llms.txt` and `agents/catalog.json`. The library covers far more than shapes and tweens, including characters, gears, particles, cameras, 3D line art, scroll stories, narrated films, sound, music analysis, labels and audits.
2. Start from the closest recipe and read the module's guide before using unfamiliar options.
3. Check names. The MCP tool `check_code` reports imports that do not exist and known mistakes, and `describe_shape` lists a shape's properties.
4. Run the result with `preview` and look at the screenshots. Fix errors before reporting success.

## Skills by task

- `explainerkit-scenes`: Scenes, shapes and interaction. Use it when drawing shapes, text and colours, mounting and playing a scene, or adding sliders and other reader controls whose values drive the picture.
- `explainerkit-motion`: Motion and effects. Use it when animating with easing, timelines, keyframes, ready-made entrances (fly in, typewriter, wipe, pulse), springs, morphing shapes or timing shapes to narration.
- `explainerkit-stories`: Scroll stories, films and playback. Use it when building a scroll-driven story, a narrated film with chapters and captions, syncing to media, or controlling playback and export.
- `explainerkit-data`: Data, layout, labels and checks. Use it when drawing charts from data, placing labels and annotations without overlap, laying out responsively, or auditing composition, contrast and motion.
- `explainerkit-camera-3d`: Camera, 3D and visual look. Use it when moving a camera through a large scene, zooming between scales, drawing 3D line art or solid Three.js scenes, parallax, grading the look of a frame, or placing a graphic on tracked footage.
- `explainerkit-characters-machines`: Characters, machines, particles and procedural art. Use it when adding characters that walk, talk and emote, gears and linkages, particle effects, skeletal rigs, or generated textures, foliage and point fields.
- `explainerkit-sound-music`: Sound and music. Use it when adding sound effects tied to motion, generating notes and phrases, composing and producing a score with instruments, effects and a mastered mix, mixing audio, or analysing a song to time visuals to its beats, bars, drops and sections.
- `explainerkit-design-*`: research, story design and scripting for an explanation, exported from `explainerkit/design` by the documentation build.

## Imports

- `explainerkit`: Shorter import for the same `Scene` and `scene` constructors.
- `explainerkit/core`: Scene identity, handles, components, keyed data, parameters, bindings, tracks and sampling.
- `explainerkit/scroll`: Scroll-to-time adapter.
- `explainerkit/transitions`: Capture and interpolate supported scene states.
- `explainerkit/renderers/svg`: Native SVG scene rendering.
- `explainerkit/renderers/canvas`: Native Canvas 2D scene rendering.
- `explainerkit/film`: Narrated film composition and player.
- `explainerkit/camera`: Camera control, transforms, framing, depth, focus and shutter math.
- `explainerkit/rigs`: Calculate joint positions and deform artwork with skeletons and skins.
- `explainerkit/morph`: Match points and outlines, change shapes, and animate splits or merges.
- `explainerkit/audit`: Composition, motion, continuity, contrast, measured palette and 3D rendering diagnostics.
- `explainerkit/design`: Model-assisted research, story design, scripts, fables and series, then hooks and attention, and visual design (shot plans, structure, colour, motion, feeling, sound and multimedia checks), with deterministic measures and checks.
- `explainerkit/parallax`: Depth-layer relationships for scroll presentation.
- `explainerkit/perception`: Grouping suggestions with author overrides.
- `explainerkit/graphics`: Validated paint, gradients, clipping and textures.
- `explainerkit/physics`: Analytic oscillator and trajectory models; no universal physics simulation.
- `explainerkit/typography`: Editable letters and symbols, plus animated HTML text.
- `explainerkit/spatial`: First-party 3D transforms, projection and picking.
- `explainerkit/renderers/three`: Explicit optional Three.js rendering with reversible owned-material palettes.
- `explainerkit/renderers/webgl`: Native WebGL point/line buffers.
- `explainerkit/import/svg`: Inert supported SVG geometry.
- `explainerkit/import/font`: Bounded TrueType/WOFF outlines.
- `explainerkit/zoom`: Nested coordinate systems and detail that changes with screen size.
- `explainerkit/particles`: Seeded emitters sampled by time.
- `explainerkit/mechanisms`: Connect 2D movement in gears, rolling objects, cranks and belts.
- `explainerkit/import/gltf`: Bounded static glTF/GLB geometry.
- `explainerkit/story`: Scroll acts, holds, controls and reversible cue policies.
- `explainerkit/assets/preload`: Explicit bounded resource loading.
- `explainerkit/look`: Visual effects and color adjustments, with resource limits.
- `explainerkit/characters`: Character runtime, faces, poses, walking and acting.
- `explainerkit/player`: Browser mounting, clock, interaction lifecycle and disposal.
- `explainerkit/media`: Media-clock synchronization.
- `explainerkit/project`: Bounded project recipes and history.
- `explainerkit/layout/labels`: Focused measured-label API.
- `explainerkit/layout/annotations`: Focused annotation policy.
- `explainerkit/sound`: Sound generation and explicit playback.
- `explainerkit/procedural`: Points, density fields, network spacing, instances and generated masses.
- `explainerkit/data`: Scales, units, transformations and plot/axis blueprints.
- `explainerkit/geometry`: Path construction, placements, measurement, deformation, polyhedra and drawing tools.
- `explainerkit/geometry/shapes`: Combine, intersect, subtract or split polygons and outlines.
- `explainerkit/layout`: Placement, text wrapping, callouts, measured labels and responsive planning.
- `explainerkit/color`: Procedural HSLA, safe conversions, hue-aware mixing and explicit RGB interpolation.
- `explainerkit/motion`: Pure timelines, easing, staggering, motion paths, springs and secondary motion.
- `explainerkit/motion/effects`: Seekable typewriter, object wipe, fly-in, pulse, teeter and colour flash presets.
- `explainerkit/noise`: Scalar/vector fields, fractal/ridged noise, domain warp and deterministic grids.
- `explainerkit/editor/timeline`: Optional keyframe/timeline editing.
- `explainerkit/adapters/dom`: Connect authored values to HTML.
- `explainerkit/adapters/waapi`: Explicit native browser animation.
- `explainerkit/inputs`: Live observations, settled hover intent and reactive parameter/data bindings.
- `explainerkit/sound/mix`: PCM mixing and WAV encoding.
- `explainerkit/sound/studio`: Synthesizer, plucked, struck, percussion and sampled instruments, an effect rack with equalisers, dynamics, reverbs and delays, and loudness meters.
- `explainerkit/music`: Score composition and variations, MIDI exchange, arrangement in bars and beats, produced mixes with buses, returns, loudness targets and stems, song analysis, beat grids, retargeting and adaptive scores.
- `explainerkit/vfx`: Recorded footage analysis, camera track preparation with default stabilization, point and plane tracking, and compositing.

## Common mistakes

- For new VFX shots, prepare fitted camera poses with compileCameraTrack. Its standard level repairs isolated pose spikes by default. Choose strong for smaller spikes or none to inspect the original poses.
- Text alignment is the `align` property with the values start, middle and end. `textAnchor` is SVG vocabulary and is rejected.
- That easing name does not exist. Named easings are listed in vocabularies.easings, for example easeOut, easeInOut, smooth or linear, or pass a trusted progress function.
- Text `align` takes start, middle or end, not center, left or right.
- Path commands are absolute M, L, C, Q and Z only. Convert relative, smooth (S, T), arc (A) and horizontal or vertical (H, V) commands, or build paths with explainerkit/geometry.
- The `glow` property is an object, not a number. See docs/modules/graphics.md.
- A cloud takes `points: {positions: [x0, y0, x1, y1, …], radii?, colors?}`, not an array of {x, y} objects.
- A band scale exposes `bandwidth` and `step` as numbers, not methods. Write `x.bandwidth`.
- Create scenes with `scene({width, height})` from explainerkit/core. There is no global ExplainerKit object.
- You rarely need your own animation loop. Animate with `to`, parameters or timelines and let `scene.mount()` return a player that owns the clock, so seeking and export keep working.
- ExplainerKit has its own scales, timelines and effects. Check find_capability before adding another animation or charting library. Three.js is supplied to explainerkit/renderers/three, not imported by ExplainerKit.
- Drawing directly to SVG or Canvas bypasses the scene, so seeking, export and audits cannot see it. Add shapes to a scene and mount it, or use a renderer from explainerkit/renderers/svg or explainerkit/renderers/canvas.
