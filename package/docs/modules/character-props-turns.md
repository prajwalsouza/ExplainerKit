# Held props and edge turnarounds

Attach a prop to a character's hand and turn a character at a chosen time. Both use the solved pose and sampled handle effects, without a separate attachment animation loop.

## Socket orientation and prop holding

```js
const hand = figure.socket('handF', 1); // {x, y, rotation}, world coordinates
const grip = figure.hold(prop, {
  hand: 'F', from: .4, to: 1.8, blend: .08,
  offset: [0, 0], anchor: [0, 0], align: 'hand',
});
// grip.dispose() removes this hold and exposes the prop's authored motion.
```

Sockets provide world position and rotation. Fixed part sockets follow that part's local
x direction. Hand sockets in the bean/stick rigs declare a direction part; the
last forearm segment or curve tangent supplies their orientation. Custom rigs
can declare `sockets.name.direction:{part:'armPart'}` rather than depending on a
specific limb name. Parent transforms, facing and the character's animated root
are included. A socket describes the authored named endpoint; it does not infer
an undeclared anatomical grip.

`hold` takes a live prop from the same scene. Its local `anchor` (default origin)
lands on the socket plus `offset`. `align:'hand'` rotates both the prop direction
and offset with the socket; `upright` keeps world rotation zero and interprets
offset in world axes. The helper inverts the prop's actual parent matrix, so
independently moving, reflected, skewed or scaled prop parents are supported.
Its own scale/skew/pivot and non-transform style remain authored.

`from` defaults to zero. Omitted `to` uses the existing scene duration only when
that leaves a positive window; otherwise `INVALID_HOLD` requests an explicit end.
No implicit day-long scene is authored. The scene extends through the short
release blend when necessary.

`release:'freeze'` (default) retains the release pose after `to` and its blend.
Use `release:'authored'` to end the hold's transform ownership at `to + blend`
and resume the prop's existing tracks or bindings. Earlier attachment history
remains seekable. For a seamless throw, author the resumed path to start at
the sampled hand/anchor release pose; the hold does not infer a trajectory or
rewrite authored tracks. `dispose()` still removes the entire hold.

The short entry blend begins at `from`; after `from+blend` and through `to`, the
anchor follows the socket exactly. The optional release blend ends at `to+blend`,
then the prop stays at the socket's world pose sampled at `to`, including when its
parent later moves. This frozen pose is a sampled effect, preserving arbitrary
backward seeks. Blend defaults to at most .08 seconds, bounded by half the window
and the timeline end. Zero blend is an exact immediate grip/release. Disposing
the controller explicitly restores underlying authored transforms.

A prop can have up to 128 nonoverlapping hold windows. Front and back hands can hold it in sequence once the previous release blend has ended. Attaching a held glyph to a line is checked against those windows before allocation. An overlap is rejected with `CHANNEL_OWNED`, while a later attachment ends a completed frozen hold at its arrival start without changing earlier seeks.

Dependencies that would form a hold cycle, including ancestor/descendant holds and geometry-dependent ancestor pivots, report `HOLD_CYCLE`. A parent transform that cannot be inverted reports `HOLD_SINGULAR`. Screen overlays, underlays and depth layers are outside the world-space hold model and report `HOLD_SPACE_UNSUPPORTED`, including when their assignment changes after installation. The helper does not guess a conversion between world and screen coordinates.

## Authored edge turnarounds

```js
figure.keys([
  {at: 0, facing: 1},
  {at: 1, facing: -1, turn: {duration: .12, style: 'edge'}},
]);
```

A pose key’s `at` time is its **arrival**, so the turn in the example runs from .88 to 1 second. The character narrows horizontally, changes facing halfway through, and widens into the mirrored pose. Its horizontal scale stays at least .001 of its authored width so that coordinate conversion remains possible.

At the narrowest point, limb details not attached to the root bone fade behind the central silhouette. This prevents front and back details from crossing visibly through the torso. Their displayed sides exchange as facing changes. The method turns a cutout rather than reconstructing a body in 3D or creating profile artwork. Its endpoints match an instantaneous facing flip.

A turn requires a facing key, a positive duration fitting before its arrival,
`style:'edge'`, and no overlapping edge windows. Existing keys without `turn`
retain their instantaneous behavior. The 120 Hz automatic biped planted-foot
solver cannot keep world-fixed feet while horizontal body scale approaches zero;
combining it with an edge turn explicitly refuses `TURN_FOLLOW_UNSUPPORTED`.
Use `follow(...,{feet:'none'})` plus authored foot targets for that sequence.
Ordinary gait clips and existing instant-facing automatic-foot tracks remain
available; a believable turning walk still requires authored choreography.

Original native checks exercise grips throughout every biped action, transformed
prop parents, both hands, release/rewind, attachment ownership and every starter's
edge endpoints. `tests/browser/character-part-six-checks.html` measures rendered
marker centers and turnaround ink in SVG and Canvas; it reports numerical error
and the number of starter/renderer pairs. These are synthetic correctness checks,
not a claim that every turnaround is artistically convincing.
