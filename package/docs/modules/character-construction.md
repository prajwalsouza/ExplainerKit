# Building a character that holds together

Use this guide to create a character for `explainerkit/characters` and check it with the automatic audit. Start from the closest rig in `src/characters/rigs/`. Change one thing at a time and run the audit after each change so that a failed check can be traced to the edit that caused it.

## The audit

```js
import { auditCharacter, formatAudit } from 'explainerkit/characters';
const report = auditCharacter(myCharacter());     // plays every action, sampled at 30 fps
console.log(formatAudit(report));                   // one line per check, with the worst example
if (!report.ok) throw new Error('rig is broken');
```

| Check | When it fails | Typical cause |
| --- | --- | --- |
| `connected` | Visible parts no longer form one connected piece. | A limb may start outside the body, or a pivot may sit far from the shape it rotates. |
| `joints` | A declared joint endpoint does not meet its target part. | The limb may start outside the torso or end away from its foot. |
| `depth` | An attachment overlaps its parent by less than its declared `depth`. | A fin or tail may begin on the outline instead of extending into the body. |
| `slivers` | A filled outline has a corner sharper than 22° without `sharp:true`. | A body may taper to a point, or a smoothing curve may extend too far through a turn. |
| `folds` | A filled outline crosses itself. | Catmull-Rom smoothing may bend across points that double back. |
| `limbs` | A drawn limb exceeds its declared length by more than its `stretch` allowance. | A raised hip or distant target may require more reach than the limb permits. |
| `ground` | A grounded character sinks below the floor or has no contact on it while not airborne. | Thick strokes may extend beneath their endpoints, or both feet may have been lifted without an airborne pose. |
| `sliding` | A foot or other declared contact moves while resting on the floor. | Blending poses may move a planted foot, or body bob may lift it beyond reach. |
| `pops` | A part moves faster than 12 character heights per second between frames. | An abrupt pose change may lack a transition that connects the positions. |
| `flips` | A bent limb suddenly bends toward the opposite side. | The target may cross the limb root, causing the solver to choose the other elbow or knee position. |
| `rewind` | Sampling backward gives a different pose from sampling forward. | An action may depend on stored state instead of calculating its result from time. |

A connected outline does not necessarily look like a convincing attachment. A tail can touch the body at one point and still appear detached as it turns. Review the character at a large scale after it passes the audit, checking that the intended joints and overlap remain visually clear.

The audit scales geometric tolerances with the declared `height`, using 1.5% by default. Set that height accurately so a small character is not judged with a tolerance intended for a much larger one. Tests cover every starter and include a detached-leg bird to check that a broken construction is detected.

## Declare what must stay connected

```js
return {
  ...,
  contacts: ['footF', 'footB'],                        // parts that rest on the ground
  joints: [
    { part: 'legF', end: 'start', to: ['body', 'pants'] },   // limb start inside the torso
    { part: 'legF', end: 'end', to: ['footF'] },             // limb end on its foot
    { part: 'head', to: ['body'] },                          // no end: the two parts must overlap
    { part: 'tail', to: ['body'], depth: 3.5 },              // and sink at least 3.5 units in
  ],
  parts: [
    { id: 'legF', stroke: 12, length: 45, stretch: .15, draw: ... },  // limbs carry their length
    { id: 'hat', detachable: true, ... },                              // allowed to fly off
  ],
};
```

Set `detachable:true` on parts intended to separate from the character, such as a thrown hat, floating ball or speech bubble. Other visible parts are expected to stay connected. Declaring this intent lets the audit distinguish a deliberate separation from a broken joint.

## Construction helpers

Use construction helpers to give parts enough thickness and overlap before adding motion. The example prepares a body around a spine and places fins partly inside it.

```js
import { taper, tube, frameAlong, surfaceFrame, appendage, appendageShapes } from 'explainerkit/characters';
const width = taper({ max: 25, nose: 12, end: 5.5 });              // never zero at the tail stalk
const body = tube(spinePoints, width, { endCap: 'round' });          // explicit caps, no overshoot
const tail = appendage(appendageShapes.forkedFin(), frameAlong(spinePoints, 1), { overlap: 10 });
const dorsal = appendage(appendageShapes.pointedFin(), surfaceFrame(spinePoints, width, .5, 1), { overlap: 6, angle: Math.PI / 2 });
```

- `taper` defines how thickness grows and then narrows to a stalk rather than a point.
- `tube` wraps that thickness around a spine and caps both ends.
- `frameAlong` and `surfaceFrame` find a position and local direction on the spine or body surface.
- `appendage` places a shape whose root is at the origin and grows along +x onto that local frame. Its `overlap` sinks the root into the body so the parts stay joined.
- `appendageShapes` supplies `forkedFin`, `roundFin`, `pointedFin` and `leaf` shapes.

```demo design-fish-tail-joint
Drag the tail joint to change how far the fin starts inside the fish. At zero overlap the fin starts at the edge of the capped body. Something’s fishy about that joint.
```

## What went wrong before, and the rule it broke

| Defect | Construction rule |
| --- | --- |
| Bird legs appear detached below the belly or bend forward. | Start limbs inside their parent. A bird’s visible ankle joint bends backward. |
| Feet slide at the start or end of a walk. | Keep planted feet at their planned positions and plan the walk from one standing pose to another. |
| Stick feet float at full stride. | Lower the pelvis until each foot can reach, using the compass-gait adjustment. |
| A fish body narrows to a needle beyond the tail. | Keep a nonzero attachment thickness and cap the body end. |
| A tail fin touches its body at one point. | Extend it into the parent using `appendage` overlap and the audit’s `depth` requirement. |
| Thick legs sink through the floor. | Raise their stroke endpoints by half the stroke width. |
| A shadow rises with a jump. | Draw the ground shadow at y = −`root.y` so it cancels the root’s vertical movement. |

## Construction rules

**Space and scale**

1. Character coordinates have y pointing down, ground at y = 0 and the character facing +x. Swimmers and floating characters place their center at the origin instead.
2. Set `height` to the character’s height in its own units so audit tolerances scale with it.
3. As an artistic convention, use proportions of 2–3 heads tall for mascots, about 5 for stick figures and 7–8 for realistic figures.

**Shapes and pivots**

4. Build from a few shapes with `ellipse`, `egg`, `rounded` and `smoothClosed`. Circles and capsules are useful when the intended appearance is friendly.
5. Put each bone’s pivot at the joint inside both the parent and child shape. A neck pivot belongs inside the top of the torso and the bottom of the head.
6. Overlap connected rigid parts by at least 15–25% of the smaller part’s size so rotation does not open a gap.
7. Start each limb a few units inside its parent rather than on the outline. This prevents the detached appearance caused by starting a bird’s legs below its belly.

**Limbs**

8. Use `hose(a, b, length, bend)` for a bending limb whose curve length matches two half-length segments meeting at the elbow or knee. Use `solveTwoBone` from `explainerkit/rigs` for rigid limbs with exact segment lengths.
9. Give each limb a `length`. Human knees bend forward and elbows back. The visible backward-bending joint in a bird’s leg is its ankle.
10. Raise a foot target by half its stroke width. For example, the end of a 12-unit stroke needs to sit 6 units above the floor to avoid sinking into it.

**Motion**

11. Calculate motion from time without counters or previous-frame variables. Use the clip arguments `u`, `params` and `c.clip.distance` together with seeded noise when variation is needed.
12. For walks, use `bipedActions` with `leg` and `ankle` set. Its footstep plan begins and ends standing, keeps planted feet fixed in world space, and lowers the pelvis when a foot would otherwise be out of reach. This lowering is called a compass-gait adjustment.
13. Set planted feet from the plan instead of blending them with a fade weight.
14. For a hop or another gait that moves the body only during some phases, declare a `travelWarp` so the body stays still while feet are planted.
15. Keep shadows on the floor by drawing them at y = −`root.y`.
16. Use `faceParts` for faces and leave room for pupils to move. A pupil radius should not exceed 60% of the eye radius.

**Checking**

17. Run `auditCharacter` and fix every `fail` before adding artwork detail.
18. Render each action at several times as a large contact sheet. Inspect silhouettes, joints and feet because the audit checks geometry rather than artistic quality.
19. Export with `exportCharacterSVG` and open the result to confirm that the output still looks like the intended character.

## Interaction helpers

Use `character.track(x,y)` to make the eyes and head follow a live scene point, with the seekable `lag` calculation from `explainerkit/physics` smoothing the response. `character.drive(inputs,map)` connects other pose values to live input, such as increasing a smile as the pointer approaches. `character.walkTo(x)` queues a walk or swim after the current move and returns its arrival time, which can be used to schedule the next action.