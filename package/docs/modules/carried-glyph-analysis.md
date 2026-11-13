# Track the visible ink of carried glyphs

`scripts/reference/glyphs.py --props` adds stable prop tracks to the existing
component and event report for frames at their original resolution. A template taken from a starting frame follows moving ink
without assigning a new identity every time another stroke obscures part of a glyph.
The tool tracks pixels; it does not perform optical character recognition (OCR) or interpret an equation.

```sh
python3 scripts/reference/glyphs.py original-film.mp4 --from 0 --to 5 \
  --props --prop-seeds seeds.json --states states.json --font original.ttf \
  --size 72 --x 40 --y 150 --camera camera.json --out glyph-tracks.json
```

The examples refer to your own footage and font. Reference films, crops and
tracks derived from them stay local under the benchmark's existing policy.
The checked-in validation uses only original synthetic ink and a first-party
fixture font.

Give `seeds.json` up to 32 time windows. Each window chooses a starting box around the glyph to track.

```json
[{"id":"carried-term","from":0,"to":5,"seed":[20,55,20,29]}]
```

Times are clip-local seconds after `--ref-offset`/`--rec-offset`; windows are
half-open and must lie inside `--from`/`--to`. The seed is a screen-pixel
`[x,y,width,height]` box at the first decoded native frame in that window.
Use a clean, unoccluded initial glyph. IDs are unique strings of 1–128
characters. Seed dimensions are 2–512 px with at most 131,072 pixels.
The tracker crops to actual seed ink and retains that template; it cannot
reconstruct a portion already missing from the seed.

Without `--prop-seeds`, existing `carried` events supply candidates. Candidates
need independently moving ink over at least three supported frames; stationary
controls are rejected. A supplied camera converts the motion check to world
coordinates. Otherwise, a median shift from at least three recurring component
identities removes common line translation. This fallback does not solve an
unknown zoom or rotation. Overlapping continuous candidates merge their source
component IDs under the earlier prop ID.

`--states` and `--font` must be supplied together. States are increasing
`[[time,text],...]` or `[{"t":time,"text":text},...]`. Expected line ink uses
the library's actual imported-font advances, kerning and stroke-built symbols
through `line_layout.py`, then a 2 px dilation excludes that ink before tracking.
Set `--size`, `--x`, `--y` and `--letter-spacing` to the authored line's world
layout. States change at their authored times. This is an expected-line mask,
so inaccurate states/layout/camera may erase valid prop ink; unsupported frames
remain gaps rather than being declared successful tracks.

Supply `--camera` as a camera-track list or an object with a `samples` array. Each row records time, zoom and pan as shown below.

```json
[{"t":0,"zoom":1,"panX":0,"panY":0},
 {"t":5,"zoom":1,"panX":20,"panY":0}]
```

Standard analyzer `textCamera`/`cameraPosition` samples are also accepted.
Screen coordinates equal `zoom * world + pan`. The shared `CameraTrack`
interpolates only adjacent known samples, does not extrapolate, and preserves
unknown pan as a gap. Positive uniform zoom and translation are supported;
rotation, skew and reflection refuse. A window whose first frame has unknown
camera cannot acquire a seed later using stale seed coordinates.

The `explainerkit.glyph-events/1` report remains intact. Its additional `propTracks` field uses `explainerkit.glyph-props/1` and contains `tracks`, `rejected`, `fps` and `sourceOffset`. Each track records one stable `id`, its time window, source component IDs, independent displacement and the frame measurements described below.

| Field | Meaning |
| --- | --- |
| `time`, `frame` | Clip-local seconds and original source-frame index |
| `status: "observed"` | Unclipped seed-template extent with at least 98% ink support |
| `status: "estimated"` | Template extent supported by partial ink, including clipping/occlusion |
| `status: "gap"` | Unsupported continuity; boxes are null |
| `screenBox` | Full template extent; estimated rows explicitly include inferred hidden extent |
| `observedBox` | Bounds of visible matching ink only |
| `worldBox` | Inverse camera transform of `screenBox`; null without a camera |
| `support`, `reason` | Visible-template support fraction and the evidence/refusal reason |

`--prop-search` sets the local prediction search radius, an integer 2–128 px
(default 32). After more than 12 unsupported frames the tracker stops
reacquiring that prop, avoiding a later unrelated glyph taking its identity.
A new explicit window can start a new evidence interval. Camera jumps, large
rotations, changing glyph shape and long total occlusion can exceed this
translation/scale tracker; it does not invent a successful observation there.

Calls are bounded to 20,000 decoded frames, 200,000 output rows and 16 million
pixels per frame (each side at most 8192). Rescaled templates are at most
1024 px per side and 262,144 pixels. Excess work refuses rather than silently
truncating the reported evidence.

Run `node --test tests/reference/props.test.mjs`. The synthetic acceptance counts
**all visible truth frames**, including gaps and wrong positions, in its
within-3-px denominator. It tests a moving glyph across actual line ink,
fragmenting occlusion, off-screen exit, stationary controls, duplicate source
fragments, camera gaps and full CLI/event compatibility. Passing this test is
not a claim about a local reference film's likeness or extraction accuracy.
