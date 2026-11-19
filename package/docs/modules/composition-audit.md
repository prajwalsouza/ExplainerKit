# Composition audit

Use `explainerkit/audit` while authoring to find potential layout problems in animated explanations. It can flag colliding text, marks drawn over words, low contrast, panels hiding other content, characters above their apparent floor and crowded frames. Like a linter, it points to places that need review rather than deciding whether the explanation works.

Call the audit from your own page or test with the functions shown below. Each finding includes its rule, severity, node IDs, time span, measured value and a message explaining what to inspect or change.

```demo design-cover-up-audit
Drag “Everything is fine” over the falling line or move it with the arrow keys. The audit has a rule for this particular cover-up.
```

## In code

```js
import { auditScene, auditFrame, frameMarks, RULES } from 'explainerkit/audit';

const { spans, frames, summary } = auditScene(scene, { from: 0, to: scene.duration, fps: 6, displayWidth: 1280, background: '#fbfaf7' });
for (const s of spans.filter(s => s.severity === 'error')) console.log(s.start, s.rule, s.message);
```

`auditScene(scene, spec)` samples `[from, to]` at `fps`, audits every frame, merges findings that persist into time spans, and adds the rules that need time (reading time, onset bursts, frame cost). `auditFrame(frame, spec)` checks one sampled frame. `frameMarks(frame)` flattens a frame into painted marks in frame space and paint order (text with its glyph box, fills with their outlines, strokes with their visible, trimmed polylines); the rules are written over these marks, so you can write your own.

Set `displayWidth` to the CSS width at which the stage is shown so text size is assessed at that scale. Supply the page color with `background`, adjust thresholds through `rules`, and choose ignored tags through `ignoreTags`, whose defaults are `decor` and `background`. A `measure` callback supplies text measurements instead of Node’s estimate. `exclude(mark)` and `sample(time)` let the caller control eligible marks and sampling.

## The rules

An **error** marks a problem expected to be visibly broken, while a **warning** marks something to inspect. A finding present in only one sample is downgraded to a warning and labeled `transient`, as can happen during a fade or an object passing another.

| Rule | What it catches | Threshold | Basis |
| --- | --- | --- | --- |
| `textOverlap` | Two settled texts overlap | > 8% of the smaller glyph box | Engineering |
| `strokeOverText` | A line painted **after** the words crosses them | ≥ half the box's smaller side inside the words | Engineering |
| `textOverStrokes` | Lines run **under** the words with no card between | same | Engineering |
| `coveredText` | An opaque shape painted over the words | ≥ 15% covered (error > 50%) | Engineering |
| `busyGround` | Words sit on several separate shapes (bunting, a crowd) | ≥ 3 shapes showing through | Engineering |
| `contrast` | Ink against the composited colour underneath | 4.5:1, or 3:1 for ≥ 24 px / ≥ 18.66 px bold | WCAG 2.2 SC 1.4.3 |
| `blurredText` | Focus or prop blur on words | > 0.75 px at the display | Engineering |
| `offFrame` / `safeArea` | Words cut by the frame / closer than 3.5% of the width to an edge | — | Broadcast title-safe practice |
| `smallText` | Words below a comfortable size at the display width | 12 CSS px | Engineering, WCAG 1.4.4 intent |
| `lineBreak` | A text node containing `\n` (nodes draw one line) | any | Renderer contract |
| `readingTime` | Words leave before they can be read | 0.5 s + words ÷ 3.3 per s, minimum 1 s | ~200 wpm display-text reading |
| `cardPadding` | Content closer to a card's edge than 0.6 em of its largest text | 0.6 em | Engineering |
| `cardBalance` | Opposite margins differ by more than 45% (rectangular cards only) | 45% | Engineering |
| `cardOverflow` | Content spills past its card | > 0.15 em | Engineering |
| `coverUp` | A card sits over at least 3 shapes from other objects and may be hiding a placement problem. | 3 | Engineering |
| `boxes` | More than 2 boxed labels at once | 2 | Engineering |
| `hidesData` | An opaque panel is painted over a strong line (≥ 2:1 against the panel) | 40 px hidden | Engineering |
| `orphanLabel` | A colour-coded word (chroma ≥ 0.25) is far from every mark of its hue | 16% of the width | Engineering |
| `floating` | A figure in a tagged group stands above the ground most of its group stands on | 0.5% of the height | Inferred ground |
| `clutter` | Separate units in view, after semantic and perceptual grouping | 7 | Cowan 2001 (≈ 4 chunks); 7 as a ceiling |
| `wordy` | Words on stage at once | 24 | Mayer's redundancy / coherence principles |
| `onsetBurst` | New units appearing within one second | 4 | Engineering |
| `frameCost` / `markCount` | Sampling time / painted marks per frame | 16 ms / 4000 | One 60 fps frame |

## How meaning enters: tags

The audit measures geometry rather than understanding a scene’s subject. Tags supply the information it needs about which objects belong together.

- **Units.** Roots that share a tag count as one thing (`.tag('axis')`, `.tag('calendar')`, `.tag('crowd')`). Untagged roots are grouped perceptually by `perceptualGroups` (proximity and similarity); small cards absorb what sits on them; large plain panels are ground. Roots tagged `decor` or `background` are not counted.
- **Ground.** For each tag with at least three multi-part figures, the ground is the large surface most of their feet land on. Any figure whose feet stop above that surface's top edge, while standing over it, is reported as floating. No floor has to be declared.

## What it cannot judge

- Text widths come from the browser's metrics in the browser and from an estimate in Node (about ±10%); glyph-level overlap, kerning and ligatures are not measured.
- Contrast is measured at the text box centre against flat fills and averaged gradients; textures, glows and images under the text are approximated, and APCA is not implemented.
- Grouping uses bounding boxes instead of exact ink, so a long thin mark such as a gridline can connect objects that only overlap its empty box.
- A speech bubble over other characters' faces, a label pointing at the wrong thing, poor timing or a confusing story are not detected.
- Thresholds are provisional. Tune them per project with `rules`, and look at the frames as well; the audit flags candidates, it does not certify a composition.

Tests in `tests/modules/audit.test.js` inject a fault for each rule and check that it is detected. A neighboring clean example checks that the same rule does not report a problem without that fault.

## Transform and renderer integration

`frameMarks` uses the same local affine transform as the renderers, including explicit/keyword pivots, group bounds and skew. Text measurement receives `(text,fontSize,fontWeight,fontFamily)`; registered outline advances are used when supplied in the sampled frame. Text bounds and type size remain geometric approximations, especially under nonuniform scaling.

Blur descriptors use their numeric radius and world/screen policy rather than becoming `NaN` in audit calculations. The effect-budget estimate also counts descriptor-based blur. This estimate is separate from real renderer work and is not a measured GPU or frame-time result.

To inspect measured renderer counters, render the frame first and pass its statistics to the audit as shown below. A model frame on its own cannot supply GPU or drawing measurements.

```js
renderer.render(frame);
const report = auditFrame(frame, {rendererStats: renderer.stats});
// Or inspect only the measured counters:
const costs = auditRendererStats(renderer.stats);
```

`auditRendererStats(stats,{isolatedLimit:50})` warns when `clampedFilters > 0` or `isolatedLayers > 50`. Findings carry `evidence:'measured-renderer-stats'`. Missing counters remain `null`; a static frame does not invent them. These warnings identify potential cost/appearance changes, not rendering failures.

For `auditScene`, `rendererStats` is a callback `(time,frame) => snapshot`. The host must render that same frame before returning its stats. This explicit opt-in can be expensive; it is excluded from the pure scene-sampling timer and must not be confused with a renderer benchmark. The added regressions in `tests/modules/audit-renderer-integration.test.js` cover pivot/skew bounds, blur descriptors, selected-font measurement and counter warning boundaries.
