# Place readable annotations around scene objects

Import `planAnnotations` from `explainerkit/layout/annotations`. It chooses label positions from measured rectangles in **CSS pixels**, after scene coordinates have been projected onto the screen. It does not alter scientific marks, narration, media time or a player's clock.

```js
const plan = planAnnotations([
  {id: 'result', text: 'Energy is conserved', anchor: {x: 180, y: 100}, essential: true},
  {id: 'point-1', text: 'P1', anchor: {x: 185, y: 110}, priority: 1},
], {
  bounds: {x: 0, y: 0, width: 390, height: 240},
  obstacles: visibleMarkBoxes,
  measure: measureInkAfterFontsReady,
  background: '#efeee5',
  phase: 'inspect', inspectionAge: .4,
  previous: previousPlan?.next,
});
```

The planner moves text into clear nearby positions, places essential explanations before optional identifiers, and defers optional text when motion, contrast or limited space makes it hard to read. You can adjust its thresholds for your scene.

## Priority, space and time

```demo design-crab-inspection
Read the fine claws. Drag the clock from motion into inspection. The essential claw label stays eligible throughout, and the other names can appear once the inspection has settled.
```

- Labels default to optional. Declare text needed for the current explanatory claim `essential:true`; it is considered before every optional label, then by numeric priority and stable ID. An impossible essential label produces `status:'needsAttention'` with an explicit diagnostic and incomplete essential coverage. The host must reflow, allocate an inspection interval, offer an allowed larger view, or report the problem. Accessible hidden text alone does not satisfy visual-required coverage.
- Optional `when:'auto'`/`'inspect'` labels defer during `phase:'motion'` and for the first `settleDelay` seconds of inspection. `when:'always'` is an explicit override. Essential auto labels remain eligible during motion. Declare only currently active cues as required; the planner does not invent a narration schedule.
- Supply `inspectionDuration` for a bounded authored hold. If its usable duration after settling is less than `minDwell` (default1s), eligible labels defer with `shortInspection`, so an entire too-short hold cannot produce a brief annotation flash. Without a supplied duration, dwell is explicitly unverified (`metrics.dwellWindowVerified:false`). This is a schedule-eligibility check, not a claim that a particular viewer read the text or observed a full dwell after seeking into the middle.
- An inspection phase can be a paused interaction **or a visually settled, authored section of a playing film**. For example, sample `phase:'inspect'` and `inspectionAge:time-4` during a hold you have authored from 4–6 seconds, and `phase:'motion'` outside it. The policy never pauses narration automatically, stretches model time or separates a protected simultaneous comparison.
- Placement checks up to five candidate rings around an anchor, eight directions each, with a bounded maximum distance. Previously chosen direction/ring is preferred while it remains safe. History is explicit input (`previous:plan.next`), not hidden global state. Seek/export callers must replay the same declared history or use stateless planning; do not infer path-independent pixels from an interactive hysteresis policy.
- For attached identifiers, supply the complete `subjects:[{id,x,y}]` anchor map, including unlabelled competing objects. A nearest-association placement must be closer to its own object than every competitor by `associationMargin` (default2CSSpx), otherwise it defers with `association`. Declared ID/anchor mismatches reject. With no subject map, association is explicitly `unverified`. A deliberately focused view may use `association:'highlighted'`, which records an author-declared highlight; the renderer must actually provide that cue. It is not automatically proved by a flag. This addresses a visually tidy label that still points to the wrong object.
- No output box overlaps a supplied obstacle or earlier placed label by the declared gap, and every output fits the content bounds. Include protected marks, their stroke/effect bounds, captions, controls and safe areas as obstacles. A transparent group enclosure is not a solid obstacle; supply its border segments if they must stay clear. The planner cannot infer occlusion from arbitrary images or undisclosed geometry.

Defaults are a 14 CSS-pixel minimum font size, a 4-pixel gap, an 80-pixel maximum ring distance, six visible labels and a 150 ms settling delay for optional inspection labels. Adjust these for your scene; they are not universal perceptual or cognitive limits. The planner supports up to 256 labels, 512 obstacles, 64 background regions and eight approved alternative text colors.

## Actual measurement and contrast

Supply `measure(text,{fontSize})` as a synchronous callback that returns `{width,height,offsetX?,baseline?}`. Wait until fonts are ready and measure the visible letter shapes, including overhang, ascent and descent. Canvas `actualBoundingBox*` and `fontBoundingBox*` values can supply those measurements. The returned plan includes `textX` and `textY` so the renderer can place the correct origin and baseline.

The planner raises fonts to the configured minimum instead of shrinking them to fit. Its decisions are only as accurate as the supplied bounds. Pass browser text zoom and camera projection explicitly because world coordinates alone do not describe the displayed text.

Supply an opaque hex `background`, or leave it unknown with `null` or omission. For several background layers, `backdrops` accepts ordered opaque rectangles described by `{bounds,color}`. The planner checks every supplied color that intersects a proposed label box rather than accepting an average image or gradient color. Unknown colors defer optional text and produce a diagnostic for essential text.

Use `contrastColors` to list approved alternative foreground colors. The planner does not replace a meaningful color with an arbitrary one or cover a protected mark with a badge just to pass contrast.

The default 4.5:1 ratio follows [WCAG's normal-text contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). This local foreground/background check does not establish overall WCAG conformance or readability on every display. Shape/line contrast, text weight, anti-aliasing, gradients, photos, blur and perceptual grouping need their own evidence.

## Observable outcomes and evaluation

Read `visible` for labels that can be drawn and `deferred` for labels withheld with reasons. The result also includes `diagnostics`, `metrics` and the next placement preferences in `next`. Metrics report essential coverage separately from optional retention and unverified associations. `ready` means every current essential annotation has been resolved. It does not rate visual quality. Optional IDs may reasonably be hidden, but hiding a required explanation must remain a reported failure.

The visual benchmark gallery in the development repository defaults point IDs off, offers safe paused labels or a single selected ID, hides optional IDs during playback, and retains native accessible object titles. Its labels use this shared policy and real measured ink, not per-point offsets.

Run `node benchmarks/annotations.mjs` to check original adversarial scenes at viewport widths of 1280 and 390 CSS pixels. Measurements include rendered glyph bounds, collisions, readable size, contrast, essential coverage, optional retention and placement stability, with negative controls. These numerical checks are separate from human review. The results apply to the tested cases and do not establish optimal layout for every film.