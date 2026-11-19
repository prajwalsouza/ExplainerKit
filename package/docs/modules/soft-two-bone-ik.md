# Soft reach and proportional limb lengths

Use soft reach when a two-link limb should ease toward full extension instead of straightening abruptly. `solveTwoBone` and two-link `skeleton().solveGoals()` share the same planar inverse-kinematics solver, which finds joint angles for a target endpoint in 2D. Import articulation tools from `explainerkit/rigs`, then supply the root, two lengths and target in one coordinate system.

```demo design-cookie-reach
Drag the cookie toward the edge of the robots’ reach. The upper robot straightens its arm at the limit. The lower robot keeps a bend and leaves a gap. That is a soft reach for a hard cookie.
```

```js
import {solveTwoBone} from 'explainerkit/rigs';
const result = solveTwoBone({
  root: {x: 0, y: 0}, lengths: [50, 50], target: {x: 110, y: 0},
  bend: -1, stretch: 1.3, compress: .75, softness: 15,
});
```

| Control | Default | Meaning |
| --- | --- | --- |
| `stretch` | 1 | It limits the maximum proportional length factor to a value in 1–4. |
| `compress` | 1 | It limits the minimum proportional length factor to a value in .25–1. |
| `softness` | 0 | It sets the distance in authored units over which the limb starts easing toward full extension. |

The solver chooses `scale = clamp(distance / totalLength, compress, stretch)` and applies that factor to both links before softening the target near full reach. Enable compression deliberately. A minimum of .75 allows each link to shorten by at most 25%, while an intermediate target can select a factor between the limits. These controls allow length changes rather than blending their strength. Unequal links keep an inner unreachable region and may not reach their own root.

Let the scaled outer reach be `L`, inner reach `I` and soft range `s = min(softness, L - I)`. The effective target distance equals the requested distance through `L - s`. Beyond that point it follows `L - s + s * (1 - exp(-(distance - (L - s)) / s))`. Both position and its first radial derivative join continuously. Set `softness:0` for hard reach. The exponential response keeps a finite bend near extension and can intentionally leave some distance to a target that would otherwise be reachable.

Read `result.scale` for the actual length factor. `result.stretch` reports the same factor, including a value below one when compression is enabled. The `target` and `error` refer to the original request, while `effectiveTarget` is the softened target before geometric clamping. The `reachable` flag tests whether the original target lies between the scaled inner and outer reach radii. Geometry remains finite when fully folded or straight. `softness` cannot exceed 1e9 units, and invalid numeric controls are rejected.

## Shared skeleton goals

```js
const result = model.solveGoals({
  from: fkPose,
  goals: [{
    id: 'hand', end: 'forearm', chainRoot: 'upperArm',
    target: {x: 120, y: 30}, pole: {x: 50, y: -40},
    stretch: 1.3, compress: .75, softness: 12,
  }],
});
```

These goal controls require a position target over exactly two directly connected bones. Goal softness is limited to 2e6 authored units. Length factors multiply the starting pose's forward-kinematics scales and must remain within the skeleton's .01–100 pose-scale bounds. The controlled chain needs a fixed base, so another goal cannot activate its base ancestors or share its two active bones. Conflicts throw `GOAL_CONTROL_CONFLICT`. Independent limbs can work together under an authored torso, while goals without these controls use their documented solver behavior.

An independent position-only goal over two links uses an analytic solution when joint limits allow it. The result identifies `diagnostics.method:'analyticTwoBoneGoals'` and reports zero iterative sweeps. Limited or competing position and orientation constraints instead use coordinate descent within a work limit and report their remaining error. Neither method carries solver history between samples. Without a pole, the starting child-angle sign chooses bend direction. Equal links targeting their root have a deterministic folded pose without inventing a pole.

Each goal includes `target`, `effectiveTarget`, raw `error`, `effectiveError`, `scale`, `softness` and `withinReach`. With softness enabled, convergence describes the effective target, so error against the original target may remain positive. Read raw error when evaluating hand contact with an object. A target beyond hard reach without softness remains unreachable. A convergence flag alone does not establish contact accuracy or visual quality.

## Keyable scene controls

```js
const rig = skeletonRig(scene, {
  bones: [{id: 'upperArm', length: 50},
          {id: 'forearm', parent: 'upperArm', length: 50}],
  goals: [{end: 'forearm', chainRoot: 'upperArm', target: {x: 110, y: 0},
           stretch: 1, compress: 1, softness: 0}],
});
rig.goals[0].stretch.to(0, 1.3, {duration: .4});
rig.goals[0].softness.to(.4, 12, {duration: .3});
```

Stretch, compression and softness supplied to the scene rig become ordinary scene-owned parameters, or can use existing parameters from that scene. Construction validates their values at time zero before allocating rig nodes. Drawn lengths, joints and sockets all use the same solved pose, so seeking backward reproduces the corresponding frame without another clock.

Professional tools also expose soft IK, with different definitions of its controls.
[Spine's IK guide](https://en.esotericsoftware.com/spine-ik-constraints) defines
its soft-distance behavior and makes compression a one-bone-only option. The
proportional two-link compression above is an explicit ExplainerKit extension,
not a claim of Spine runtime or file compatibility.

Validation uses original analytic geometry, derivative checks, limits and
ownership refusals, keyed scene geometry, independent straight-line renderer
artwork, and SVG/Canvas comparison. It does not copy reference motion or artwork.

## Family legs

Quadruped and jumper legs use owned skeletons. Two-link legs use controlled analytic goals, while three-link quadruped legs begin from the family's seed pose and solve the endpoint through the shared goal solver. Their radial scaling and softness calculation use the helper shared by `solveTwoBone`. A goal already satisfied by the starting pose returns `diagnostics.method:'initialPose'` with zero iterative sweeps after validation.

Use the family's numeric keys to control each leg named `hindF`, `hindB`, `foreF` or `foreB`. The example changes one front leg's length allowance, softness and pole position.

```js
animal.keys([{at: 0, pose: {
  'foreF.stretch': 1.3, 'foreF.compress': .75, 'foreF.softness': 6,
  'foreF.poleEnabled': 1, 'foreF.poleX': 50, 'foreF.poleY': -80,
}}]);
```

Pole coordinates use character space. Set `poleEnabled:0` to use the seed pose's bend convention rather than a supplied pole. No invalid intermediate bend sign is interpolated. A coincident three-link endpoint is represented by a folded skeleton rather than zero-length segments. Because softness moves the solved endpoint and its foot artwork, use zero softness for a planted contact. Targets beyond the declared stretched reach throw `CHARACTER_FAMILY_REACH`.

These controls apply to articulated quadruped and jumper legs. Decorative winged-leg polylines, wings and tails are artwork rather than inverse-kinematics chains. Biped nested joint and effector poses use a separate format from these numeric family channels. The family audit's extension allowance describes fixed-length default artwork, so an intentionally stretched pose can still be reported as extended.
