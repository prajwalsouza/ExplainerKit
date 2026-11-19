# Film craft helpers

Use these helpers to restyle characters, simplify distant crowd members, place speech bubbles and group visual effects. Each operation checks geometry and numeric limits, but those checks do not replace reviewing the rendered scene.

## Character costumes, lighting and proportions

```js
import {bean, restyle, character, tone, contactSheet} from 'explainerkit/characters';
const costume = restyle(bean(), {
  name: 'night-coat',
  palette: {shirt: tone('#344466', '#172233', '#7788aa')},
  remove: ['shadow'],
  add: [], // original part objects, with unique ids, bones and palette slots
});
const actor = character(scene, costume);
actor.light({ambient: .45, rim: '#aabbff', amount: .7, direction: [-.6, -.8]});
const head = scene.parameter(1, {min: .5, max: 2});
actor.proportions({headScale: head, limbWidth: 1.5});
const sheet = contactSheet([costume], {actions: ['rest', 'walk'], at: .8, audit: true});
```

`restyle` takes a raw builder definition, before `compileCharacter`. It copies
part records and palette overrides, preserves executable drawing/actions, removes
obsolete joint/contact metadata, and compiles the result before returning it.
A string palette override becomes a flat three-tone slot. Unknown removals,
duplicate additions, unknown bones and absent palette slots refuse with
`INVALID_CHARACTER`. Shared drawing callbacks remain author-owned; this does
not deep-clone closures. `tone`, `faceParts` and `hose` are public building blocks.

`light` changes palette lighting without editing the character definition. Set `ambient` in 0–1, where 1 preserves palette brightness. `rim` replaces the shaded edge color on filled cutout parts, and `amount` in 0–1 scales its brightness. Supply `direction` as a copied two-component vector with both components in [-1,1]. Ambient and amount can also come from scene inputs.

This is illustrative cutout lighting rather than physical light transport. Unshaded facial details and stroked limbs receive ambient tint instead of a directional rim shape. Do not combine this palette mode with native `shade`, because the combination is rejected with `CHARACTER_LIGHT_UNSUPPORTED`.

`proportions` layers over authored poses/actions. `headScale` (0.1–4) scales
head-bone art and its child attachment points around the head bone's origin;
`limbWidth` (0.1–8) multiplies stroke width for limbs carrying length metadata.
Both accept numbers or owned numeric inputs and rewind exactly. Unsupported
rig metadata refuses with `CHARACTER_PROPORTION_UNSUPPORTED`. Arbitrary filled
limb topology and changing skeletal length are not inferred.

`contactSheet` returns `{width,height,cells}`; every cell has its own scene,
actor, sampled frame, name, action, time and optional `auditCharacter` report in
`badge`. This is renderer-independent data, not an installed DOM gallery. Supply
1–64 definitions, up to 32 named actions per definition (`rest` is reserved),
cell dimensions 32–2048, and sample time 0–60 seconds. Default audit is off because
full rig audits are expensive. `audit:true` runs the existing quantitative rig
checks once per definition; it does not certify visual appeal.

## Crowds and speech

```js
import {crowd} from 'explainerkit/characters';
import {bubble} from 'explainerkit/layout';
const cast = crowd(scene, 20, {
  rows: 3,
  lod: {below: 48, displayWidth: 390},
});
const speech = bubble(cast.actors[0], 'There is room to explain.', {
  from: 0, to: 2, width: 240, fontSize: 24, prefer: 'above',
});
```

Crowd `lod` (level of detail) is optional and selected when the crowd is created, using each member's resting
screen height (`size × restHeight × displayWidth / scene.width`). Below the
threshold, a simplified vector character (an impostor) retains root travel, actions and core
body/head/limb parts, dropping facial details and shading. Returned `lod` entries
are `full` or `impostor`. This reduces authored geometry; it is not dynamic camera
LOD, a raster billboard, or a measured performance guarantee. Rigs without core
body/head/limb metadata refuse with `CROWD_LOD_UNSUPPORTED`.

`bubble` wraps and measures its words, then samples scene obstacles over `[from,to]` to find one stable panel position outside the speaker and other marks, including faces. It throws `NO_CLEAR_SPACE` or `NO_PLACEMENT_REGION` when none fits. The angled tail follows the speaker’s head or body origin.

The interval controls placement measurements rather than visibility, so author when the panel and tail appear separately. The planner inspects at most 48 frames and can miss fast motion between them. Recreate the bubble after staging changes that affect its position. Its avoidance uses supplied geometry rather than recognizing every face semantically.

## Falls and ink-aware grouping

```demo design-spill-the-bean
Spill the bean. Drag the film tab or use the arrow keys to sample its fall. The bean approaches its terminal speed and stops when it lands.
```

```js
import {fall} from 'explainerkit/physics';
const drop = fall({from: 0, to: 800, terminal: 300, ramp: .4, at: 1});
const y = drop.sample(2); // seconds; arbitrary seeking is exact
const speed = drop.velocity(2);
```

Before start the object remains at `from`. During flight, velocity approaches
terminal speed exponentially; `ramp` is the time constant, in seconds. A bounded
inverse solve determines `duration` and `end`; landing clamps exactly to `to`,
with zero velocity. Upward coordinates work too. `state(t)` includes `landed`.
No collisions, bounce or fluid simulation are implied.

`perceptualGroups` accepts optional `ink: [[x,y], ...]` on an item. Distances use
actual polyline segments when either item supplies ink, retaining box distance
for other pairs. Each polyline has 2–128 finite points, with a total comparison
budget. This prevents empty portions of long marks' boxes from bridging groups;
explicit together/apart rules still win. Supply actual flattened geometry in the
same coordinate system as the boxes. Holes and filled compound geometry require
an authored representation; the helper does not extract scene ink automatically.

## Audit additions

`auditScene` checks display widths `[1280,390]` by default. Pass one width or an
array of 1–8 widths to change this. Findings retain `displayWidth`; identical
findings across widths are deduplicated. Sampling cost is measured once per frame,
not once per viewport. These checks predict text size at each width; they do not
rebuild responsive layouts at each width.

`effectTransform` reports nonuniform scale/skew inherited by a filtered node,
before renderer execution. The existing `effectBudget` reports viewport-pass
cost. Put the effect on a uniformly scaled ancestor; combining effects remains
an authored choice because changing filter boundaries changes compositing.

The original synthetic checks in `tests/modules/film-craft-gaps.test.js` cover
analytic derivatives/landing, validation, captured costumes, sampled proportions,
lighting, LOD selection, speech placement, ink gaps and audit findings.
`tests/browser/film-craft-checks.html` verifies visible lighting/proportion ink,
exact rewind pixels, speech visibility/placement and impostor geometry through
both SVG and Canvas in the installed desktop browser engines. This is synthetic
acceptance, not a reference-film likeness score or physical-device certification.

## Explicit union effect batching

```js
import {effectBatch} from 'explainerkit/layout';
const filtered = effectBatch(scene, [flameA, flameB]);
// Or apply one new group effect to previously unfiltered roots:
const glowGroup = effectBatch(scene, [dotA, dotB], {glow: {color: '#ffeebb'}});
```

`effectBatch` takes 1–1000 distinct, contiguous world roots in existing paint
order. It validates every branch before mutation, inserts one identity group at
the first root's slot, clears matching static child blur/glow, and applies that
filter once to the union. Child transforms remain intact, so a stretched flame
can sit below a uniformly transformed filter group. This is the nearest safe
uniform boundary for the supported root-only case. Group opacity, blur and glow
remain explicitly author-controlled afterwards.

Filtering the group combines its children before applying blur or glow, so overlapping glows merge. This differs from filtering each object separately. World-space radii are interpreted in the new untransformed group rather than each child’s scaled coordinates, while screen-space settings retain their meaning. Choose grouping deliberately because the images can differ.

Existing root effects must match. Clips, masks, other effects, non-normal blending, nested effects, animated effect properties, screen-space roots, region scopes, interrupted paint order and excessive depth or capacity are rejected before any change. Use separately authored groups for those cases. An expensive result can still trigger `effectBudget`, and the library does not merge arbitrary effects automatically.

The composition audit supplies ink automatically for units represented by one
single-contour stroke mark (up to 128 flattened points), including long diagonal
lines. Stroke width is included in the distance. Multi-mark semantic groups,
compound contours, or geometry beyond the bounded comparison budget retain the
conservative box fallback. Native multiline text is measured with its full block height and is supported by the audit.
