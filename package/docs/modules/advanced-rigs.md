# Solve a rig for several targets

Use the tools in `explainerkit/rigs` when connected parts must satisfy more than one target. This guide builds on the [first rig/skin guide](rigs-morphing-perception.md) and uses the same scene parameters, derived values, player and renderers. It adds no third-party solver, animation package or clock.

Choose a skeleton when parts should turn at joints while keeping their lengths. Choose a skin when artwork should bend with those joints. A curve rig instead places objects along a path. All three can share a scene and timeline, but they control different geometric relationships.

## Reach with two hands

```demo design-double-espresso
The robot ordered a double espresso. Drag either cup or move it with the arrow keys. See how close the same rig pose gets to both cups.
```

```js
import {skeleton} from 'explainerkit/rigs';

const body = skeleton({
  bones: [
    {id: 'torso', length: 30},
    {id: 'left', parent: 'torso', length: 60},
    {id: 'right', parent: 'torso', length: 60},
  ],
});

const result = body.solveGoals({
  goals: [
    {id: 'left-hand', end: 'left', target: {x: 40, y: 55}},
    {id: 'right-hand', end: 'right', target: {x: 40, y: -55}},
  ],
});
show(result.pose);
showResiduals(result.goals);
```

`body.solveGoals(...)` and the standalone `solveRigGoals(body,...)` calculate one pose for all the supplied goals. Each candidate pose is checked against every goal, so solving one hand does not simply overwrite a pose chosen for the other. For a single target position, the faster `body.solve({end,target,...})` uses cyclic coordinate descent (CCD), which adjusts one joint at a time.

### Goal controls

| Field | Default / accepted value | Meaning |
| --- | --- | --- |
| `id` | `goal-1`, `goal-2`, … | Give each goal a unique short ID. Explicit IDs preserve solve order if you reorder the input array. |
| `end` | Required bone ID. | Choose the bone endpoint and world direction to control. |
| `target` | Optional `{x,y}`. | Set the desired endpoint in world coordinates using the skeleton’s units. |
| `rotation` | Optional radians. | Set the desired world orientation. Error is measured along the shortest angular difference. |
| `weight` | Defaults to 1 and must be positive and ≤1e6. | Set relative importance among goals at the same priority. |
| `rotationWeight` | Defaults to 1 and must be positive and ≤1e6. | Weight orientation relative to the normalized position error. |
| `priority` | Defaults to 0 and accepts integers 0–15. | Solve smaller numbers first. Priorities protect earlier results rather than merely applying larger weights. |
| `chainRoot` | Defaults to the top ancestor. | Choose the last ancestor whose local angle this goal can add to the set of movable joints. |
| `pole` | Optional `{x,y}`. | Choose which side of the root-to-target line the elbow should bend toward on a two-bone chain. |
| `poleWeight` | Defaults to 1 and must be positive and ≤1e6. | Set how strongly the solve tries to reach the elbow position selected by the pole. |

A goal must request a position, an orientation, or both. Orientation lets a hand or tool point in a chosen direction while reaching. That direction may conflict with the target position or joint limits, so neither request is assumed to be attainable just because it was supplied.

`chainRoot` helps choose which joints can move during the combined solve. It does not pin the chain’s base. Another goal may activate an ancestor and thereby move this goal’s base and descendants. Bones outside the set of movable joints keep their local angles, although an ancestor’s movement can still change their world positions.

### Solver controls

```js
const result = body.solveGoals({
  from: body.pose({angles: {torso: .2}}),
  goals,
  iterations: 100,
  restarts: 2,
  tolerance: .01,
  angleTolerance: .01,
  priorityTolerance: 1e-10,
  unreachable: 'report',
});
```

Supply `from` as a pose from this compiled skeleton, or omit it to use the rest pose. Each scene sample begins with its authored forward-kinematics (FK) pose, calculated from bone angles, rather than the previous frame’s result. Seeking backward therefore gives the same answer for the same inputs. Changing a target can still make the solver choose a different solution branch and produce a visible discontinuity.

- `iterations` limits the number of iterations for each priority and starting pose. It defaults to 100 and accepts integers from 1 to 256.
- `restarts` allows 0–4 additional starting poses and defaults to 2. The starts are repeatable and include the original FK pose, available position-based estimates and limited angle changes. A pole goal can supply an elbow-side estimate.
- `tolerance` controls acceptable position and pole error in authored units. It defaults to .01 and accepts 1e-8–1e4.
- `angleTolerance` controls acceptable orientation error in radians. It defaults to .01 and accepts 1e-8–π.
- `priorityTolerance` allows a limited increase in normalized error when optimizing a lower priority. It defaults to 1e-10 and accepts 0–.1. Earlier priorities keep reference ceilings that cannot rise with every joint adjustment, so the allowance cannot accumulate.
- `unreachable:'report'` returns the best candidate found and is the default. Choose `error` to throw `IK_NOT_CONVERGED` when any goal remains outside tolerance.

The solve supports 1–16 goals and a forest of 1–128 bones. Before starting, it checks `bones × active joints × goals × priority tiers × iterations × (restarts + 1) ≤4,000,000`. This limits computational work without guaranteeing a running time. Validation, preparation of starting poses and evaluation of candidates also take time. Small supported examples cost much less than the maximum, so measure frame cost before repeatedly using the largest permitted solve.

### Read the outcome

The result is immutable. Inspect its pose, convergence status and individual goal errors before deciding whether the compromise is suitable for your scene.

```js
{
  pose, converged, status, iterations,
  goals: [{id, end, priority, weight,
    error, rotationError, poleError, converged, withinReach}],
  priorityCosts: [{priority, cost}],
  diagnostics: {method, priorityTolerance, priorities,
    activeJoints, tolerance, angleTolerance},
}
```

A residual is the error remaining after a solve. A goal that did not request position, orientation or a pole has null for that corresponding error. `error` measures straight-line endpoint distance, `rotationError` measures the shortest angular difference, and `poleError` measures distance from the selected analytical elbow position.

`withinReach` checks whether a positional target lies within the distance reachable from the current chain base when joint limits are ignored. It is null for orientation-only goals. This distance check does not prove that hinge limits or competing goals allow the target to be reached.

`converged` means **every** requested channel is within its declared tolerance, including lower priorities. A useful compromise can have `converged:false`. Status is `converged`, `unreachable` when any positional target lies outside its unconstrained envelope, `iterationLimit` when a bounded attempt exhausts its sweeps, or `stalled`. Inspect individual goal residuals instead of reducing the result to a green status light.

Within one priority, the solver combines weighted error scores. Position and pole scores use squared error divided by the chain’s squared total length so that differently sized limbs can be compared. Orientation uses `rotationWeight × 2 × (1 − cos(angle error))`. These weights control optimization rather than expressing probabilities or confidence.

The implementation performs coordinate descent with candidates derived from weighted rotational correlation, interval boundaries and bounded local steps. It solves priorities in stages and gates lower-stage candidates against earlier costs. It preserves bone lengths and signed local hinge intervals. It does not implement a global constrained optimizer, null-space task-priority projection or a proof of optimality. A locally blocked lower-priority task can remain unsolved even when a coordinated multi-joint solution exists. Residuals and hard work bounds are part of the contract.

## Choose the elbow's side

```js
const arm = skeleton({bones: [
  {id: 'upper', length: 100},
  {id: 'lower', parent: 'upper', length: 80},
]});
const result = arm.solveGoals({goals: [{
  id: 'hand', end: 'lower', target: {x: 100, y: 0},
  pole: {x: 0, y: 100},
}]});
```

A two-bone chain can usually reach a point with the elbow bent on either side. The pole selects one of those choices rather than pulling the elbow to the pole point or stretching the bones. The analytical elbow position is first limited to the chain’s reachable area, and the constrained solve then tries to reach it. If a joint limit prevents that bend, the result reports the remaining error instead of bypassing the limit.

Use `chainRoot` to select a two-bone section within a larger skeleton. Place the pole off the line from the starting base to the target. A target at the base or a pole on that line leaves the bend preference undefined and is rejected with `INVALID_POLE`. The solve uses this starting reference to choose a side. It does not define a 3D bend plane or control an arbitrary chain of more than two bones. Other goals remain active and can conflict with the preferred elbow side.

## Drive the same goals in a scene

```js
import {skeletonRig} from 'explainerkit/rigs';

const rig = skeletonRig(drawing, {
  bones: [
    {id: 'upper', length: 100},
    {id: 'lower', parent: 'upper', length: 80},
  ],
  goals: [{
    id: 'hand', end: 'lower', target: {x: 100, y: 0},
    pole: {x: 0, y: 100},
  }],
  solver: {iterations: 80, tolerance: .01},
});

rig.goals[0].target.x.to(0, 120, {duration: 2});
rig.goals[0].pole.y.set(-100);
rig.mix.set(.8);
rig.attach(tool, 'lower');
```

Choose either `ik` for a single target or `goals` for several targets. A multi-goal rig returns an immutable `goals` array in the order you authored it. Each controller exposes scene parameters for target x/y, pole x/y and optional rotation, and can reuse existing parameters from the same scene. IDs, endpoint names, chains, weights and priorities are copied when the rig is created.

Put the numerical controls described above in `solver`. The `solution` is one shared derived solve, while `pose` blends its answer with the authored forward-kinematics pose according to `mix`. A multi-goal rig has `target:null`, so use its individual goal controllers to change targets.

Construction checks goals, styles, input ownership and scene capacity before creating controls or artwork. It samples existing parameters at time zero, so an invalid animation already scheduled there cannot be hidden by a valid stored base value. Scene notifications are batched until the rig is complete.

The rig’s unique adaptive `tag` keeps it together with attached tools and explicitly tagged skins during layout. Change its root or model parameters to articulate it. Moving only the display group does not update the world-space attachment points used by the solver.

## Follow a spline

```js
import {splineRig} from 'explainerkit/rigs';

const beads = splineRig(drawing, {
  commands: [['M', 40, 180], ['C', 160, 20, 340, 340, 460, 180]],
  count: 8,
  start: 0,
  end: 1,
  offset: 0,
});
beads.phase.to(0, .2, {duration: 3});
beads.attach(marker, 3, {offset: 10, rotation: .2});
```

A spline rig creates attachment positions, called stations, along a curved path. Their spacing uses an approximation of distance along that path. Changing `phase` shifts every station along the contour, while `offset` moves them perpendicular to the local path direction. Each station supplies x, y and rotation for attached labels, instruments, beads or repeated parts.

It uses the shared `measurePath` model utility rather than a second curve implementation. The input is one finite, non-degenerate M/L/Q/C/Z contour. `tolerance` defaults .25 authored units and controls curve flattening. Tangents follow sampled chord segments, so corners and subdivision boundaries can change direction abruptly.

| Control | Default / limit | Meaning |
| --- | --- | --- |
| `count` | Defaults to 8 and accepts integers 1–128. | Choose a fixed number of stations. |
| `start`, `end` | Default to 0 and 1 and must be ordered within [0,1]. | Choose the interval along the contour that receives stations. |
| `phase` | Defaults to 0 and accepts a number or parameter from this scene in ±1000. | Shift stations by a fraction of the measured path length. |
| `offset` | Defaults to 0 and accepts a number or parameter from this scene in ±1e5. | Move stations perpendicular to the path in authored units. |
| `outside` | Defaults to `wrap` for closed paths and `clamp` for open paths. | Choose `error` to reject stations outside the interval. Wrapping requires a closed path. |
| `stroke`, `strokeWidth` | Use supported scene paint and a default width of 2. | Style the station graphics used for debugging. |

Open curves and partial intervals on closed curves include both endpoints. A full closed curve omits the duplicated final station and wraps phase modulo one. With clamping, several stations can collect at the same open endpoint rather than extending beyond the curve. Choose `outside:'error'` to reject a phase that moves a station outside the path. If an animated value causes that failure during sampling, the player keeps its last valid display.

The result exposes `path`, `group`, `tag`, `phase`, `offset`, `pose`, `count`, `station(index)`, `attach(handle,index,{offset,rotation})` and `diagnostics`. `pose` is a derived frozen station array. `station(index)` returns a scene-derived station pose for bindings. Attachments take x/y/rotation channel ownership and join the rig's adaptive `together` tag.

Distance measured along a bend is longer than the straight line between its ends. The curve rig therefore does **not** keep neighboring stations a fixed straight-line distance apart. It is not a cable simulation or a spline-IK constraint that preserves length. The path is copied at construction, so measuring a path that morphs first would require a separate update API with explicit work limits. Report `diagnostics.rigidLengths:false` accordingly.

## Tests and remaining boundaries

Native tests include a weighted compromise with a closed-form angular answer, priority conflict preservation, position-plus-orientation goals, opposite pole branches, constrained failures, reordered goal IDs, independent branched FK targets, exact lengths, scene input ownership, construction failure atomicity and forward/reverse sampling. Spline fixtures check exact line positions, normal offsets, closed wrapping, endpoint policies, attachment transforms, capacity and foreign parameters. These are numerical/runtime checks, not a physical-feasibility certificate.

This implementation does not support 3D joints, simultaneous contact and collision constraints, closed mechanical loops, arbitrary multi-bone pole planes, or a spline that cannot stretch. It also does not provide anatomical models, retargeting, motion capture, automatic weight painting or volume-preserving deformation. The existing weighted skinning module remains available with its linear-blend limitations.

The [CMU Technical Animation inverse-kinematics notes](https://www.cs.cmu.edu/~15464-s13/lectures/lecture6/IK.pdf) explain local and world hierarchies and the iterative IK problem. [Kenwright’s inverse-kinematics workshop](https://xbdev.net/physics/workshops/Workshop_09_Inverse_Kinematics.pdf) describes analytical and coordinate-descent approaches. Weighted candidate calculations, priority checks, repeatable starting poses and work limits are decisions made by this implementation. No source code from those references is copied or imported.