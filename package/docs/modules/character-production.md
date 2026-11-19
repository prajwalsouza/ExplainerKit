# Character production controls

Use these controls to align mouths with recorded audio, choose character lighting and add small follow-through movements. Scene time is measured in seconds and character geometry uses the rig’s units. Text-based speech and fixed-light shading remain available without enabling these controls.

## Audio-aligned mouth cues

```js
import {character, bean, speechFromRhubarb} from 'explainerkit/characters';

const actor = character(drawing, bean(), {x: 320, y: 420});
actor.lipSync(rhubarbJSON, {at: 2, blend: .04});
const mouth = speechFromRhubarb(rhubarbJSON, {at: 2}).sample(2.5);
```

Supply `rhubarbJSON` as parsed JSON or text from an offline audio-analysis step. It follows [Rhubarb’s JSON mouth-cue protocol](https://github.com/DanielSWolf/rhubarb-lip-sync#json-format-json), where `mouthCues` contains ordered `{start,end,value}` records using A–H or X. Each interval includes its start and excludes its end. Gaps and the end of the recording return the mouth to rest.

Set `blend` to control the transition duration. Its default of 40 ms is an animation convention. If `metadata.duration` is present, it must include every cue. `metadata.soundFile` is descriptive text that is never opened or fetched.

The importer validates, copies and freezes the cues. It rejects overlaps, unknown shapes, malformed
JSON and cues outside the recording. Limits are 4 MiB JSON text, 40,000 cues, the shared input-value
budget, and a 24-hour scene including offset and the final blend. Sampling uses binary search. Bad
input leaves the actor's prior speech and scene duration intact. The returned timeline has `at`,
`end`, `cues`, `words` (empty), `source: 'rhubarb-json'` and `sample(time)`.

The importer uses externally prepared timing without recognizing speech or checking alignment against the recording. Text-based `say()` is the default. If speech timelines overlap, later layers apply after earlier layers, so choose that order deliberately.

```demo design-silent-mouth-cues
Drag the silent film reel across the cue track. The actor changes mouth shape at each lettered cue and rests during the gap. That is lip service.
```

## Long-film blink and eye-dart schedules

`blinkAt(seed,time)` and `saccade(seed,time)` accept times from 0 through 86,400 seconds. Each seeded
schedule is the same sequential sum of events as always, extended lazily only as far as the latest time
requested and then looked up by binary search, so a late seek computes the elapsed events once and later
samples never revisit them. Early seeks, late seeks and cache eviction produce the same seeded frame.

Each cache retains up to 512 schedules and removes the least recently used when full. A cast of two dozen characters can therefore reuse its schedules between frames. Memory grows with the amount of time sampled. Run the benchmark below to measure preparation, cached lookup and process memory separately.

```sh
node --expose-gc benchmarks/character-timing.mjs
```

The benchmark also samples and validates twelve actual default characters. Its CPU measurements
exclude rendering; the browser character fixture separately measures sample plus render. Neither is
a real-phone performance claim.

## Scene-light integration

```js
drawing.light({angle: -Math.PI / 4});
const actor = character(drawing, bean(), {shade: true});
// A native shade descriptor is accepted in place of true; null renders flat base colors.
```

`shade: true` applies the native renderer contract once to the whole character silhouette. Its
shadow/light directions follow `drawing.light()`, including animated light inputs and reflected
characters. The preset's amounts and distances are artistic choices, not physical measurements.

This is explicit because native offscreen shading is substantially more expensive than the existing
fixed-light construction in the tested twelve-character scene. The default preserves the existing
appearance and cost. A wholesale default switch remains pending performance and human visual
approval. Native shading shares the renderer effect budgets and refusal behavior.

## Bounded appendage follow-through

Follow-through lets a part such as a bun or bird tail rotate slightly after the joint that drives it. These parts use the shared `jiggle` function from `explainerkit/physics`. Add the following `secondary` settings to another bone-attached part when it needs the same behavior.

```js
{id: 'bun', bone: 'head', secondary: {driver: 'head.r', amount: .35, maxAngle: .025}, /* artwork */}
```

The `driver` names an existing numeric rest-pose property. The follower samples a separate base pose so it cannot call itself recursively. It considers at most 0.18 seconds of history in 0.03-second intervals, with at most eight intervals, a frequency of 4 Hz and damping ratio 0.7. These are animation conventions. The rotation correction defaults to at most 0.025 radians and can be set within 0–0.1 radians. This approximates follow-through without simulating the part’s physical dynamics.

`character(...,{secondaryMotion:false})` disables these corrections. Sampling depends only on the requested time,
so seeking backward reproduces the same pose. Audit attachment, ground-contact and pop checks still apply. Current coverage
is buns and bird tails; other hair styles, procedural fish tails, ears and antennae remain work rather
than being approximated around an inappropriate pivot.
