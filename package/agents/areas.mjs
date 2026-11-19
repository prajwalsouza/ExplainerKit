// Hand-written inputs for the agent catalog: how capabilities group into
// skills, and mistakes that agents make with ExplainerKit. Everything else in the
// catalog is generated from the package, its guides and its recipes by
// scripts/agents/build.mjs.

export const AREAS = [
  {
    id: 'scenes',
    title: 'Scenes, shapes and interaction',
    when: 'drawing shapes, text and colours, mounting and playing a scene, or adding sliders and other reader controls whose values drive the picture',
    imports: ['explainerkit/core', 'explainerkit/color', 'explainerkit/graphics', 'explainerkit/typography', 'explainerkit/typography/source', 'explainerkit/inputs', 'explainerkit/geometry', 'explainerkit/geometry/shapes'],
    recipes: ['scene-and-player', 'slider-parameter', 'animate-parameter'],
  },
  {
    id: 'motion',
    title: 'Motion and effects',
    when: 'animating with easing, timelines, keyframes, ready-made entrances (fly in, typewriter, wipe, pulse), springs, morphing shapes or timing shapes to narration',
    imports: ['explainerkit/motion', 'explainerkit/motion/effects', 'explainerkit/transitions', 'explainerkit/morph', 'explainerkit/math', 'explainerkit/physics', 'explainerkit/noise', 'explainerkit/juicy', 'explainerkit/variation', 'explainerkit/emphasis'],
    recipes: ['common-effects', 'timeline-motion', 'narrated-beats'],
  },
  {
    id: 'stories',
    title: 'Scroll stories, films and playback',
    when: 'building a scroll-driven story, a narrated film with chapters and captions, syncing to media, or controlling playback and export',
    imports: ['explainerkit/story', 'explainerkit/scroll', 'explainerkit/film', 'explainerkit/player', 'explainerkit/media', 'explainerkit/project'],
    recipes: ['scroll-story', 'narrated-beats'],
  },
  {
    id: 'data',
    title: 'Data, layout, labels and checks',
    when: 'drawing charts from data, placing labels and annotations without overlap, laying out responsively, or auditing composition, contrast and motion',
    imports: ['explainerkit/data', 'explainerkit/layout', 'explainerkit/layout/labels', 'explainerkit/layout/annotations', 'explainerkit/audit', 'explainerkit/perception'],
    recipes: ['data-chart'],
  },
  {
    id: 'camera-3d',
    title: 'Camera, 3D and visual look',
    when: 'moving a camera through a large scene, zooming between scales, drawing 3D line art or solid Three.js scenes, parallax, grading the look of a frame, or placing a graphic on tracked footage',
    imports: ['explainerkit/camera', 'explainerkit/spatial', 'explainerkit/vfx', 'explainerkit/zoom', 'explainerkit/parallax', 'explainerkit/look', 'explainerkit/vfx/post', 'explainerkit/maps', 'explainerkit/maps/fetch', 'explainerkit/maps/osm', 'explainerkit/import/geotiff', 'explainerkit/renderers/three/cinematic', 'explainerkit/procedural/city', 'explainerkit/renderers/three/city', 'explainerkit/renderers/three', 'explainerkit/renderers/webgl'],
    recipes: ['camera-shots', 'space-3d', 'video-vfx'],
  },
  {
    id: 'characters-machines',
    title: 'Characters, machines, particles and procedural art',
    when: 'adding characters that walk, talk and emote, gears and linkages, particle effects, skeletal rigs, or generated textures, foliage and point fields',
    imports: ['explainerkit/characters', 'explainerkit/mechanisms', 'explainerkit/particles', 'explainerkit/rigs', 'explainerkit/procedural'],
    recipes: ['characters', 'gears', 'particles'],
  },
  {
    id: 'sound-music',
    title: 'Sound and music',
    when: 'adding sound effects tied to motion, generating notes and phrases, composing and producing a score with instruments, effects and a mastered mix, mixing audio, or analysing a song to time visuals to its beats, bars, drops and sections',
    imports: ['explainerkit/sound', 'explainerkit/sound/mix', 'explainerkit/sound/studio', 'explainerkit/music'],
    recipes: ['sound-cues', 'music-grid', 'score-variation', 'produce-score'],
  },
];

// Mistakes observed or likely when an agent writes ExplainerKit code from
// general knowledge. Each one is checked by check_code where a pattern exists.
export const PITFALLS = [
  {
    pattern: /\bstabilizeCameraTrack\s*\(/,
    message: 'For new VFX shots, prepare fitted camera poses with compileCameraTrack. Its standard level repairs isolated pose spikes by default. Choose strong for smaller spikes or none to inspect the original poses.',
  },
  {
    pattern: /\btextAnchor\s*:/,
    message: 'Text alignment is the `align` property with the values start, middle and end. `textAnchor` is SVG vocabulary and is rejected.',
  },
  {
    pattern: /ease\s*:\s*['"](easeIn|ease-in|ease|ease-out|ease-in-out|easeOutCubic|easeInOutCubic|cubic|bounce|elastic)['"]/,
    message: 'That easing name does not exist. Named easings are listed in vocabularies.easings, for example easeOut, easeInOut, smooth or linear, or pass a trusted progress function.',
  },
  {
    pattern: /align\s*:\s*['"](center|left|right)['"]/,
    message: 'Text `align` takes start, middle or end, not center, left or right.',
  },
  {
    pattern: /commands\s*:\s*\[[^\]]*\[\s*['"][a-zSHVTA]['"]/,
    message: 'Path commands are absolute M, L, C, Q and Z only. Convert relative, smooth (S, T), arc (A) and horizontal or vertical (H, V) commands, or build paths with explainerkit/geometry.',
  },
  {
    pattern: /glow\s*:\s*[\d.]/,
    message: 'The `glow` property is an object, not a number. See docs/modules/graphics.md.',
  },
  {
    pattern: /points\s*:\s*\[\s*\{\s*x\s*:/,
    message: 'A cloud takes `points: {positions: [x0, y0, x1, y1, …], radii?, colors?}`, not an array of {x, y} objects.',
  },
  {
    pattern: /\.bandwidth\(\)/,
    message: 'A band scale exposes `bandwidth` and `step` as numbers, not methods. Write `x.bandwidth`.',
  },
  {
    pattern: /new\s+Scene\s*\(|ExplainerKit\.\w+/,
    message: 'Create scenes with `scene({width, height})` from explainerkit/core. There is no global ExplainerKit object.',
  },
  {
    pattern: /requestAnimationFrame\s*\(/,
    message: 'You rarely need your own animation loop. Animate with `to`, parameters or timelines and let `scene.mount()` return a player that owns the clock, so seeking and export keep working.',
  },
  {
    pattern: /from\s+['"](d3|gsap|anime|three)['"]/,
    message: 'ExplainerKit has its own scales, timelines and effects. Check find_capability before adding another animation or charting library. Three.js is supplied to explainerkit/renderers/three, not imported by ExplainerKit.',
  },
  {
    pattern: /document\.createElementNS\(|getContext\(['"]2d['"]\)/,
    message: 'Drawing directly to SVG or Canvas bypasses the scene, so seeking, export and audits cannot see it. Add shapes to a scene and mount it, or use a renderer from explainerkit/renderers/svg or explainerkit/renderers/canvas.',
  },
];

// Plain-language phrases for search, written the way people describe the
// result they want rather than the way the module names it.
export const MODULE_KEYWORDS = {
  explainerkit: 'scene, start, first scene, shortcut import',
  'explainerkit/core': 'scene, shapes, circle, rectangle, line, text, group, animate property, move, fade, bind, parameter, slider, control, derive, mount, play, pause, seek, beats, narration timing, enter, dim, explain, components, instances, keyed data',
  'explainerkit/scroll': 'scroll progress, scroll position to time, scroll speed, reading pace, scrubbing by scroll',
  'explainerkit/transitions': 'transition between states, interpolate two scene states, crossfade layouts, before and after',
  'explainerkit/renderers/svg': 'svg output, vector rendering, crisp drawing, accessible svg',
  'explainerkit/renderers/canvas': 'canvas rendering, many points, fast drawing, raster',
  'explainerkit/film': 'narrated film, video explainer, chapters, captions, subtitles, read aloud, cinematic, stage colours, film player',
  'explainerkit/camera': 'camera, pan, zoom in, zoom out, close-up, follow a subject, frame a region, whip pan, cut, depth of field, focus, shake, dolly',
  'explainerkit/rigs': 'skeleton, bones, joints, inverse kinematics, arm reaching, puppet, skinning, rigging, limb',
  'explainerkit/morph': 'morph, shape change, one shape turns into another, blend outlines, tween between shapes, shape keys, split and merge shapes, metamorphosis',
  'explainerkit/math': 'LaTeX, MathML, MathJax, animate an equation, math glyphs, matching symbols, equation to character, algebra transition, Manim',
  'explainerkit/audit': 'check quality, audit, contrast, readability, overlapping shapes, motion too fast, continuity errors, palette check, accessibility check',
  'explainerkit/design': 'story design, script writing, research an explanation, hooks, attention, shot plan, narrative structure, explainer outline',
  'explainerkit/parallax': 'parallax, depth layers, background moves slower, layered scrolling',
  'explainerkit/perception': 'grouping, gestalt, which shapes look related, visual groups',
  'explainerkit/graphics': 'gradient, texture, pattern, clip, mask, glow, blur, shadow, paint, lighting, shading',
  'explainerkit/physics': 'spring, oscillation, pendulum, projectile, trajectory, bounce, damping, physics',
  'explainerkit/typography': 'letters, glyphs, animate letters, equation, math symbols, kinetic typography, text outline, html text animation',
  'explainerkit/spatial': '3d, three dimensional, perspective, projection, rotate in 3d, orbit camera, picking in 3d, wireframe, globe, cube',
  'explainerkit/renderers/three': 'three.js, solid 3d, lit 3d models, meshes, materials, webgl 3d',
  'explainerkit/renderers/webgl': 'gpu points, millions of points, webgl lines, point cloud',
  'explainerkit/import/svg': 'import svg, use an illustration, svg file, artwork from illustrator or figma',
  'explainerkit/import/font': 'load a font, font outlines, letter shapes from a font file, woff, ttf',
  'explainerkit/zoom': 'deep zoom, powers of ten, nested scales, infinite zoom, level of detail, zoomable map',
  'explainerkit/particles': 'particles, sparks, smoke, fire, snow, rain, confetti, dust, emitter, swarm',
  'explainerkit/mechanisms': 'gears, cogs, crank, piston, linkage, belt, pulley, machine, engine, rolling wheel, clockwork',
  'explainerkit/import/gltf': 'import 3d model, glb, gltf, 3d asset',
  'explainerkit/story': 'scrollytelling, scroll story, sticky stage, acts, holds, pause while scrolling, chapters by scroll',
  'explainerkit/assets/preload': 'preload images, load assets, loading screen',
  'explainerkit/look': 'visual style, colour grading, vignette, film grain, bloom, retro look, post processing',
  'explainerkit/characters': 'character, person, presenter, mascot, avatar, walk, wave, talk, speech bubble, lip sync, emotions, crowd, animals, bird, fish, horse, dog, quadruped, trot, canter, gallop, gait',
  'explainerkit/player': 'player, playback controls, play pause, seek bar, clock, reduced motion',
  'explainerkit/vfx': 'video VFX, footage analysis, matchmove, point tracking, planar tracking, corner pin, annotation on video, tracking region, camera stabilization, camera jitter',
  'explainerkit/media': 'video sync, audio sync, follow a video clock, media element',
  'explainerkit/project': 'save project, undo redo, project file, history',
  'explainerkit/layout/labels': 'labels, label placement, measured text labels, collision avoidance',
  'explainerkit/layout/annotations': 'annotations, callouts, leader lines, essential labels, readable annotations',
  'explainerkit/sound': 'sound effects, whoosh, impact, click, chime, notes, chords, melody, soundtrack, audio cues synced to motion',
  'explainerkit/procedural': 'procedural, generative, scatter points, stars, grass, foliage, forest, random placement, poisson',
  'explainerkit/data': 'chart, graph, plot, axis, scale, bar chart, line chart, radial chart, chord diagram, interactive chart, chart themes, units, statistics, summarise data',
  'explainerkit/geometry': 'paths, curves, bezier, arc, polygon, measure path length, arrows, place along a path, polyhedra',
  'explainerkit/geometry/shapes': 'boolean shapes, union, intersection, subtract, cut a shape, split polygon, shatter',
  'explainerkit/layout': 'layout, arrange in a grid, align, distribute, wrap text, responsive, fit to screen, callouts',
  'explainerkit/color': 'colour, palette, hue, mix colours, hsl, contrast, colour scale',
  'explainerkit/motion': 'easing, timeline, keyframes, smoothstep, scroll window, remap, envelope, keyed values, stagger, sequence, motion path, follow a path, spring, overshoot, wiggle, idle motion',
  'explainerkit/motion/effects': 'typewriter, fly in, wipe, pulse, teeter, flash, entrance effects, title animation',
  'explainerkit/variation': 'randomness, natural variation, organic, jitter, not uniform, looks hand made, vary sizes, vary colours, correlated traits, clustered placement, humanize timing, too regular, robotic',
  'explainerkit/emphasis': 'emphasis, highlight a word, draw attention, focus on a term, dim the rest, topic colour, accent colour, spotlight part of a diagram',
  'explainerkit/juicy': 'juicy, game feel, rope, stem, cable, verlet chain, wind field, air stirred by the pointer, spring follower, hover spring, squash and stretch, pop, sway, tug, screen shake, trauma, hit stop, freeze frame',
  'explainerkit/maps': 'map, relief map, terrain, heightfield, elevation, hillshade, rivers, watershed, flow accumulation, contour lines, drape a line on terrain, latitude longitude projection, clouds over mountains, river reveal',
  'explainerkit/renderers/three/cinematic': 'cinematic map, 3d relief map, tabletop miniature map, rivers and lakes in 3d, highlight a river, highlight a region, raise a region out of the map, spotlight an area, map pin, beacon, contour highlight, tilt shift render, film quality render, quality tiers, camera shots, lift a quote off a newspaper in 3d',
  'explainerkit/procedural/city': 'city, street, neighbourhood, town, procedural buildings, facades, roofs, street lamps, street lights, trees, parked cars, bicycles, benches, street furniture, grass and flowers, people walking, pedestrians, regional style, dutch, nordic, british, mediterranean, american, weather conditions, rain, snow, fog, dusk, night, golden hour, openstreetmap city model',
  'explainerkit/renderers/three/city': 'cinematic street, 3d city, render a real street, wet road reflections, puddles, lit windows at night, lamp glow, falling rain, falling snow, snow cover, canal water, level of detail, quality tiers, film quality frames, soft shadows, depth of field, motion blur, production render, time of day',
  'explainerkit/maps/fetch': 'download elevation, real terrain, dem, copernicus, natural earth rivers and lakes, openstreetmap, overpass, streets and buildings data, real map data on demand, cache map tiles',
  'explainerkit/import/geotiff': 'geotiff, tiff elevation, dem tile, read elevation file',
  'explainerkit/maps/osm': 'openstreetmap, osm, overpass json, parse streets, buildings from map data, building footprints, building heights and levels, roof shapes, roads with lanes and widths, sidewalks, street trees, street lamps, zebra crossings, city blocks from real data',
  'explainerkit/typography/source': 'newspaper, book, letter, tablet, document on a desk, highlight a phrase, lift a quote off the page, paper chip, text layout in millimetres, find a phrase',
  'explainerkit/vfx/post': 'tilt shift, miniature look, depth of field, bokeh, bloom, halation, god rays, light rays, motion blur, lens distortion, chromatic aberration, split tone, colour grade a frame, film grain, finish film frames',
  'explainerkit/noise': 'noise, perlin, simplex, gradient noise, turbulence, flow field, organic wobble, terrain',
  'explainerkit/editor/timeline': 'timeline editor, keyframe editor, edit animation visually',
  'explainerkit/adapters/dom': 'html elements, animate dom, css properties, html overlay',
  'explainerkit/adapters/waapi': 'web animations api, native browser animation, css animation',
  'explainerkit/inputs': 'mouse, pointer, hover, drag, microphone, webcam, live input, reactive data, hover intent',
  'explainerkit/sound/mix': 'mix audio, ducking under narration, wav export, combine tracks',
  'explainerkit/sound/studio': 'synthesizer, synth patch, pad, bass, strings, harp, bells, drums, percussion, sampler, instrument from recordings, equaliser, EQ, filter, compressor, limiter, reverb, delay, chorus, saturation, effects chain, loudness, LUFS, true peak, mastering',
  'explainerkit/music': 'music, score, compose, arrange, chords, voice leading, arpeggio, produce, mix, bus, send, reverb return, master, soundtrack, documentary score, background music, MIDI, stem, song, beat, bar, tempo, bpm, drop, build up, chorus, sync to music, rhythm, mp3, game music, adaptive music, loop music, fit song to length',
};
