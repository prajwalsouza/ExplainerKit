# Shared joint poses and contacts

Stick and bean bipeds share the public skeleton solver for limb sampling. A pose
has local joint angles and optional targets for its hands and feet, called effectors. Legacy point/numeric pose
channels, existing action names and imported SVG characters remain accepted.

```js
import {character, stick} from 'explainerkit/characters';
const actor = character(scene, stick(), {idle: false});
actor.keys([
  {at: 0, pose: {joints: {armF: [0, 0]}}},
  {at: 1, duration: 1, ease: 'linear', pose: {
    joints: {armF: [Math.PI / 2, 0]},
    effectors: {footF: {target: [7, 0], mix: 1}},
  }},
]);
```

`armF`, `armB`, `legF` and `legB` name the front/back drawn limbs. Each pair is
`[upperAngle, lowerRelativeAngle]` in radians. Upper angles are relative to the
current body rotation; lower angles are relative to the upper link. Positive
angles turn toward positive y in the stage's coordinate system. The canonical
skeleton pose remains immutable and seekable.

For declared biped limbs, keys interpolate joint angles by default, including
legacy hand/foot point keys converted when captured. Forward kinematics (FK) computes positions from joint angles while keeping bone lengths fixed, producing
arcs between poses. Use `space: 'targets'` on a key for the earlier target-space
path; `arc: 0` keeps a straight hand chord. A nonzero key `arc` or style `arcs`
bows target-mode hands perpendicular to the chord. Feet do not receive this bow.
Imported cutout rigs without declared limb skeletons keep their existing numeric
channel interpolation. Bird hoses and family leg chains also use cached canonical
skeleton sampling, preserving their authored quadratic or two/three-link shape.
Their existing named numeric limb channels expose stretch/compression/softness
and pole controls; the four-limb `joints` descriptor applies to declared bipeds.

```demo design-joint-chord
Drag the gesture clock. Both hands reach the same two poses in their own lanes. The left hand arcs between joint angles. The right hand travels straight between targets. One of them strikes a chord.
```

Use an effector target when a hand or foot must reach a point rather than simply turn through a joint angle. A key can set `effectors.handF`, `handB`, `footF` or `footB` with the fields below.

| Field | Meaning |
| --- | --- |
| `target: [x,y]` | Desired point in character coordinates, using existing hand/foot channel conventions |
| `mix` | Blends from the joint-angle pose (FK) at 0 to the target-position solve (inverse kinematics, IK) at 1; defaults to 1 for an explicit effector |
| `pole: [x,y]` | Explicit bend side in character coordinates |
| `stretch` | Maximum bone-length multiplier, 1–4; default 1 |
| `compress` | Minimum bone-length multiplier, .25–1; default 1 |
| `softness` | Soft reach distance in character units; default 0 |

Joint-only keys use `mix: 0`. Explicit contacts remain IK targets when a later key
moves the body. Ground and automatic root-follow feet own their contact targets
after keyed layers. The torso lowers when necessary to keep reachable planted
feet at their authored points, accounting for the actual transformed hip
attachments. Authoring FK feet does not install an automatic contact.

`actor.inspect(t).jointPose` reports the sampled body/head channels, joints,
effector requests and solver diagnostics. Desired targets are kept separately
from softened/clamped rendered tips, so sampling or using a sampled joint pose
as another key does not apply softness repeatedly. `inspect(t).pose` retains
the legacy numeric channels; its hand/foot positions match rendered limb tips
and sockets. Error diagnostics distinguish the requested and effective soft
constraint. Neither numerical IK nor these controls detect collisions.

# Rotoscoping and fitted skeletons

`keysFromPoseTrack(...)` produces point keys that enter the same joint-pose calculation. A fitted skeleton may instead have different bone names and calibration, so map its angles explicitly with `characterPoseFromSkeleton`. This transfers the pose into the character’s joint representation without installing another playback solver.

```js
import {characterPoseFromSkeleton} from 'explainerkit/characters';
const pose = fitted.sample(time);
const bodyRotation = pose.bones.find(b => b.id === 'torso').rotation - Math.PI / 2;
const authored = characterPoseFromSkeleton(pose, {
  bodyRotation,
  limbs: {
    armF: ['armRightUpper', 'armRightLower'],
    armB: ['armLeftUpper', 'armLeftLower'],
    legF: ['legRightUpper', 'legRightLower'],
    legB: ['legLeftUpper', 'legLeftLower'],
  },
});
actor.keys([{at: time, pose: authored}]);
```

The adapter takes absolute upper-bone rotation minus the supplied body rotation
and the lower bone's relative angle. It validates parent-child mappings, does
not infer anatomical sides, mirror, transfer fitted lengths or change the actor's
root track. Choose the mapping, facing, root motion and retarget proportions
explicitly. Generic skeleton poses remain useful for standalone rigs; the
adapter gives them the same authored joint representation used by characters.

Focused native regressions cover FK arcs, legacy straight targets, contacts,
opposite poles, stretch/compression/softness, snapshot reuse, bounded blends,
input ownership, deterministic rewind and explicit fitted-pose mapping. Physical
device and real-reference artistic fidelity remain separate validation.
