# Changelog

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/) and the structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- Add Paper, Midnight and Signal chart themes, a seekable radial chart and a live comparison in the data guide.
- Redraw `mountDataChart` as light: rows become hair bundles and links become silk strands with a sheen that
  follows the pointer. Radial, chord, sunburst, arc and bar views morph into one another, and a circle unrolls
  into a line. Add the Silk theme, row groups and heat, `update()`, episode-style `frames` with playback,
  drag-to-turn and keyboard focus. The data guide's demo plays through every Friends episode.
- Add `mountFlowChart`, `parseMermaidFlow` and `flowLayout`: Mermaid flowcharts drawn as silk light, with a replay
  of the messages that pass through them and each step's input and output.
- Add the Pearl theme (silk for light pages), `silkBrush` for pages that paint their own canvas, and
  `placeRadialLabels` for names around a circle. The landing page's onion, chord and sunburst views now draw in
  silk by default, with the earlier painted look kept as the Classic skin.
- Show the npm install command on the landing page.
- Add two single-file bundles for direct browser import in `dist/`, also served from the website. `explainerkit-lite.js`
  holds the core 2D modules without characters, 3D, maps, video effects or audio, and `explainerkit-full.js` holds
  every public module. `npm run bundle` builds them, and the build fails if the lite bundle grows past its budget or
  pulls in an excluded module.
- The README links point to the documentation website, so they work on npm as well as on GitHub.

- The package installs the film exporter as the `explainerkit-export-film` command, so
  the export guide's frame capture works from an installed package.
- Getting started now installs from npm and loads the modules in plain HTML from a CDN
  or a self-hosted copy.
- The npm package now includes the module guides (`docs/modules/`) and the main guides
  they link to, so `read_guide` and agents work from an installed package.
- Add agent tooling. `llms.txt` and `agents/catalog.json` index every import, guide,
  recipe and accepted option value; `agents/skills/` holds generated Agent Skills; 15
  tested recipes live in `agents/recipes/`. `agents/mcp/server.mjs` (bin `explainerkit-mcp`)
  is a dependency-free MCP server with capability search, guide and recipe reading,
  export lookup, static code checks, headless preview with screenshots and music
  analysis, and `agents/cli.mjs` offers the same tools from a shell. `agents/eval/` and
  `npm run agents:eval` measure what agents build. See docs/agents.md.
- Add `explainerkit/sound/studio` and music production. The studio module has synthesizer,
  plucked-string, struck-bar, percussion and sampled instruments, 25 effects (equalisers,
  filters, compressor, multiband, limiter, gate, reverb, delay, modulation, saturation and
  stereo tools) and loudness, true-peak and band meters. In `explainerkit/music`,
  `arrangeMusic`, `chordPitches`, `voiceLead` and `arpeggiate` write parts in bars and
  beats, and `produceMusic` mixes a score through tracks, buses, shared returns and a
  master chain to a loudness target with aligned stems. Three documentary cues in
  `examples/music-production/` are rendered by it. The music guide is split into score,
  production, studio instrument, studio effect and song-timing guides.
- Add `explainerkit/music`. `analyzeMusic` estimates loudness, onsets, tempo, beats,
  bars, tuning, chords, key, sections and staging events (drops, build-ups, breakdowns,
  pauses, climax, hits, fades, key, tempo and progression changes) from decoded PCM with
  classical signal processing. `musicGrid` snaps, pins and pulses actions on bars, beats
  and subdivisions. `retargetMusic` fits a song to a length with bar-aligned jumps, and
  `createAdaptiveScore` plans game-style adaptive music with nested loops, quantised
  transitions, intensity layers and stingers. Results are estimates without a measured
  accuracy on annotated data.
- Add bounded palette measurement and named-group drift diagnostics; palette balance
  and harmony remain configurable heuristics.
- Add seeded density-field point placement, junction-aware network spacing, and
  shared fractal/ridged noise and domain warp. Existing sampling defaults stay compatible.
- Add explicit scroll cue reverse policies and managed hover-intent inputs with
  clear clock, subscription and disposal ownership.
- Add reversible Three.js owned-material palette mapping and an optional unbranded
  `darkClay` policy; caller-owned assets, authored paint and opacity remain intact.
- The Three adapter gains `setLight(partial)` and a `light` getter: change colours, intensities and direction of its light rig at runtime (for themes), applied to the committed scene at once and to later rebuilds.
- `attachStory` and `attachScroll` take `arrival` (`'jump'` default, `'travel'`, `'chapter'`, `'top'`) for stories opened part-way by a reload, back/forward or link, with `ready(act)` to hold a replay until the act can play. They also report scroll pace (`onPace`, `.pace`: velocity, speed, direction, and still/reading/skimming/rushing) without changing which time is shown. New pure helpers: `scrollPace`, `arrivalPlan`, `arrivalTime`.
- `microphoneInput({ bands, bandRange })` adds a coarse log-spaced spectrum (0–1 per band) to each observation, for letting voice shape a form, and `waveform` adds the window as a peak-preserving downsampled line.
- Add explicit ambient pause control to mounted scene players and wire the main
  About page's Pause motion control to stop idle scene redraws. Manual input,
  authored/scroll seeking and resume remain available.

- Specialize prepared numeric tracks, share provably equivalent library easing
  calculations, resolve native evaluator types during compilation, and keep nested
  prepared projection positional. Preserve validation and custom callback semantics.

- Add immutable captured timeline preparation and optional positional player
  projection. Renderer mappings can be prepared once; named inspection snapshots
  remain available without repeating callbacks. The experimental hero uses it.

- Reduce native timeline allocation with prepared channel traversal and single-track
  sampling; retain frozen snapshots, numeric bounds, callback effects and errors.

- Add optional `bipedMotion` and `bipedRig` support-transfer, gait and reach helpers,
  plus `solveTwoBone3D`, with shared XYZ poses for flat and spatial views. The
  Little Things companion now uses continuous pole-guided motion instead of
  its previous quantized, branch-switching leg rig. Existing planar APIs retain
  their behavior. See `docs/modules/biped-motion.md` for limits and migration.
- Add pure native motion timelines with labels, relative positions, repeated and
  alternating keyframes, captured child plans, immutable seeking and bounded
  event queries. Add standard easing curves and index/grid staggering.
- Add native timeline playback on the shared player clock, with driver ownership,
  ordered event delivery, reduced-motion handling and shared frame scheduling.
  The experimental hero now delegates orchestration to these public APIs.

- Improve native scene sampling by skipping unused dynamic-clip indexing and
  redundant traversal arrays while retaining validation and mutation boundaries.
- Add `springTiming` for bounded analytic settling and `createProjectionPlayer`
  for native scenes projected into application-owned renderers using the shared
  player clock. Six experimental About features now use native scenes/players.
- Fix SVG object-bounds clipping and circle/ellipse approximation precision.
  The migration guide records the changed circle command budget.
- Prepare the experimental adapter's color interpolation once per channel and
  correct normalized browser-RGB conversion instead of throwing during playback.

- Add a flat side-profile character build with mirrored facing, head-relative ear
  sockets and reactive hands-to-ears poses. The About landing page now demonstrates
  shaded terrain/wireframes, geographic projections, motion paths and live audio
  input with explicit capture controls, local test tone and manual fallback.

- Add optional `explainerkit/inputs`: explicit pointer, resize, file, camera,
  microphone and device-sensor sources, caller-fed phone/application observations,
  bounded data capture, freshness-aware mapping/smoothing/hysteresis, and reactive
  bindings to existing scene parameters and data rows. Acquisition and disposal
  remain explicit; the interactive input example includes a sound-reactive character.

- Authored motion: sampled easing data for character pose keys reuses the shared
  curve evaluator; optional pose-layer channel masks preserve independently timed
  joints and contacts. `auditMotion` adds bounded hold/contact/arrival and motion-rate
  measurements for ordinary objects or rig sockets, without reference assets.

- Add a reproducible CMU ASF/AMC human-motion pilot: pinned source downloads, native 3D forward kinematics, analytic parser controls, per-clip timing/arcs/coordination statistics, sensitivity reporting and aggregate plots. Raw capture files remain outside the runtime package and Git.

- Motion-wisdom consolidation adds shared seeded timing styles, still holds, declared biped joint poses/FK keys, canonical soft/compressible IK, an eight-pose vocabulary and contact-timed prop reactions. Explicit author controls and older rig imports remain available; cutout and decorative non-IK representations retain documented boundaries.

- Motion-pass fidelity adds pivot-preserving glyph edits, optional paired skeleton calibration/despiking, direct soundtrack-render WAV encoding, topology-aware pose recovery, authored moving-anchor camera analysis, native text-state timing, continuous prop ink tracks and a raw per-frame figure/timing score layer. Evidence and limits are in `docs/handoff/codex-batch7-fidelity.md`; no private-reference rerun is claimed.
- Library layer documentation separates core, optional domains, adapters and applications. `explainerkit/rigs` is canonical; older `rig` and `rigging` paths preserve the same function identities.

- Typography adds seekable glyph cloning/detachment/reattachment, driven gaps, whole-line edits, exposed geometric stroke parts, more symbol morphs and staged fade-then-close removal. Character sockets expose world orientation; sampled prop holding, edge turns, measured-pose conversion and vertical root tracks reuse the existing runtime. Unsupported coordinate/ownership combinations refuse explicitly.
- Reference tools add native-frame glyph events/review strips and text-line camera estimates. Pose extraction uses bounded-resolution analysis with source-pixel output and separately marked, bounded occlusion estimates. Rectangular assignment now handles fewer recreation events; tied optimal assignments retain explicit ambiguity.
- The canonical core API tables now include generic handle methods, group constructors, stroke, pivot and live clip controls. Font guides show page loading, registration and parser/server format boundaries; documentation checks guard method-table coverage.
- Stretch extends the existing two-bone solver and skeleton poses: proportional bounded reach, pole hints, per-bone pose scales, scale-aware CCD/simultaneous goals and bind-skin length transforms. Default kinematics retain authored lengths; skin endpoints follow sockets without widening the limb.
- Shared compound-path stroke drawing retains full fills, one SVG compositing/interaction owner and stable bounds-gradient mapping, with aggregate subdivision/output budgets. Kerning construction/query work and WOFF expansion receive bounded, adversarially tested limits. Documentation link checks ignore literal API calls in code spans/blocks.

- Revised fourth-study requests extend existing player layers with stacking and shaped reveals, `matchCut` with several pairs, and spatial/procedural instancing with shape billboards, painterly materials, grass/foliage masses and local-geometry diagnostics. Parametric quadruped/winged/jumper families share the existing runtime and ship example presets. R29 adds no API because it was withdrawn as already supported.
- Reference analysis adds bounded temporal dissolve/continuous-motion evidence and confidence-aware titles, event-count timing and histogram scoring (analysis/3, score/4). Earlier scores retain their original calibration.
- New optional `explainerkit/sound` provides semantic effects, designed note/chord voices, caller sample banks, PCM processing, cue timelines, offline RMS/spectral features and an owned media-clock playback adapter. Original audition outputs are supplied for listening review; no commercial audio-library assets are bundled. `explainerkit/player` now exposes the existing mount/builder and layer helpers directly.

- Production lessons: compound outline drawing and ink strokes, point correspondence, batch projection/noise and inert Node SVG import; live camera keeping; ambient clock inputs, lazy/windowed bindings, text wrapping/halos/minimum display size and independent paint alpha; shared-clock scene layers, SVG native-channel leases, visible construction errors, inverse story seeking and sampled node/player profiling.
- Film craft adds costume/lighting/proportion helpers, contact sheets, crowd impostors, measured speech placement, analytic terminal-speed falls, ink-aware grouping, phone audit widths, filter preflight and explicit union effect batching. Three adds retained object identities, compound extrusion, hemisphere/unlit/emissive lighting, tessellation controls and opt-in subtree alpha. Supported boundaries remain explicit in the module guides.

- Three renderer: a `light` option tunes the ambient/key rig (intensity, colour, direction). Frames from a scene's own `sampleWorld` are inspected instead of deep-copied, and static path outlines are flattened, checked and meshed once; a 1,800-node frame drops from 70 ms to about 16 ms.
- Third-study APIs: clipped label callouts, live convex meshes and capped splits, scoped idle motion, camera-aware offscreen staging, region-owned content, captured animated dashes, bounded ellipse/arc paths, property-name hints and three additional easing names. Reference-fit limits remain explicit.
- Optional native Web Animations adapter (`explainerkit/waapi`) with deterministic player binding, standalone native playback, reduced motion, shared DOM ownership and rollback on partial native failures.
- Analysis adds anchor-checked camera estimates, colour-family unions and equivalent source-time offsets; shorthand-alpha/named point colour decoding is repaired.

- Benchmark-driven APIs: seeded procedural point fields and batching, geometry pivots/skew, zoom-safe filter policies and renderer diagnostics, imported font registration, named camera shots/drift/underlays, bounds-relative linear gradients, measured glyph objects/reflow/bar morphs, measured easing adapters, input-controlled automatic motion blur, live handle clipping and quick groups, and moving HUD callouts. Synthetic acceptance and pending reference-run scores are recorded in `docs/handoff/codex-benchmark-api.md`.
- Development-only reference tools now separate camera/object motion, score sparse edges, retain blob identities, measure motion layers/asset distributions, classify transitions, and append reproducible run records. CI uses original generated fixtures only.

### Added

- MIT license for code; starter character artwork retains its separate CC0 licenses.
- Explicit publishable ESM package allowlist, repository metadata and declaration resolution. No package publication is performed by these changes.
- Generated public API and coded-error inventories, drift checks, package-content verification and local documentation-target checks.
- Experimental inferred TypeScript declarations and a strict consumer import fixture covering every JavaScript entry point. Precise authored option/result types remain a release gate.
- Pinned development-only TypeScript, Playwright, axe, ESLint and Prettier tools.
- Visual benchmark pilot for character gait, rig continuity, morph correspondence and perceptual grouping, with graded diagnostics and independent visual review.
- Versioned declarative project recipes and transactional history; bounded measured-label placement with explicit overflow; captured-PCM audio mixing and aligned export muxing. These supported slices do not serialize arbitrary callbacks, edit arbitrary audio files or establish a universal layout guarantee.
- A generated static documentation site with runnable examples and a verbatim getting-started package-consumer check.
- Native LCOV coverage reporting and reproducible declaration generation that ignores stale adjacent `.d.ts` snapshots. Per-module coverage targets remain explicit release gates.
- Composition audit (`explainerkit/audit`, `npm run audit:films`): 25 sensitivity-tested heuristics over sampled frames, covering text collisions, lines and shapes over words, WCAG contrast against what is painted underneath, busy grounds, card padding/balance/overflow, cover-up cards, panels over data, figures floating above their group's inferred ground, orphaned colour labels, title-safe margins, clutter by semantic and perceptual units, reading time, onset bursts and frame cost.
- Text-safe palette variants for films (`accentInk`, `blueInk`, `greenInk`, `violetInk`).
- *Why there are no giants*, a scroll-story example of the square–cube law with character rigs, an interactive hold and a size-driven camera.

### Changed

- Data, geometry, layout, motion, noise, color, editor and adapter code now have canonical
  imports. The older import paths still work and forward the same exported values.
- `explainerkit/color` generates, adjusts and mixes procedural colours in HSLA and converts
  them safely. Existing RGB interpolation is unchanged, so earlier animations look the same.
- Importers bound the work they do, and the local development server is hardened.
- A separate, verified build produces the runtime, the npm package and the public
  documentation. It never publishes anything.
- Architecture, migration, colour policy and compatibility tests guard these boundaries.
- Character sampling with large casts is about three times faster: validated paths and clips are not re-validated, and blink/eye-dart schedules extend lazily with a larger cache (identical seeded values).
- Package bundling metadata treats JavaScript imports as side-effect-free while preserving the explicitly imported film stylesheet as a side-effectful asset.

### Fixed

- Film captions no longer throw when a coloured term contains its own capture group.
- *23 Strangers* layout: guests stand on the floor, words sit in clear space instead of on patches, labels sit by what they name, and coloured words meet WCAG contrast.

## [0.1.0-alpha.1] - 2026-10-25

### Added

- Scene construction, components, keyed data, bindings, parameters, derived values, sampled motion and immutable display frames.
- SVG and Canvas renderers, shared playback lifecycle, captions, chaptered films, scrolling, adaptive layout and inverse camera interaction.
- Articulated/curve rigs, IK/FK and weighted skins; single/compound/partition morphs and staged graphic match cuts.
- Quantitative scales, transformations and units; path/shape construction, boolean outlines, stroke trimming and motion paths.
- Deterministic springs, secondary motion, particles, coherent noise and directed kinematic mechanisms.
- First-party spatial projection/picking, deep zoom and LOD, WebGL point/line buffers and an explicit optional Three.js solid renderer.
- Safe SVG/design-SVG, TrueType/WOFF outline and static glTF imports; DOM typography and appearance helpers.
- Scene lighting/shading, depth/parallax/focus, seeded textures, lattice deformation and Canvas temporal motion blur.
- Cubic easing and editable keyframes, native media-clock synchronization, deterministic PNG/video export and a bounded timeline/curve editor.
- Rigged starter characters, face/mouth controls, authored actions, editable SVG packs and construction audits.
- Executable runtime/browser fixtures, local performance measurements and example films/studies.

### Known limits

- This is an alpha release. Cross-browser/device/accessibility and sustained production-film gates remain separate from local correctness checks.
- Public naming is experimental. No export rename or removal is introduced by the release-engineering changes; therefore no migration alias is required yet.
- See [foundation status](docs/foundation-status.md), [API inventory](docs/api-inventory.md) and [type scope](docs/types.md) for supported boundaries.
