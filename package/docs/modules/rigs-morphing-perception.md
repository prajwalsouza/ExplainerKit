# Form, articulation and grouping

Use a rig to move connected parts, a morph to transform one outline into another, and perceptual grouping to suggest which visible items should stay together. These modules return values or ordinary scene inputs that can share the scene's existing timing.

Start by declaring which bones, attachments or outlines are actually connected. That structural information determines what a solver may change and which parts a layout must keep together. A visual grouping suggestion can supplement those decisions, but it must not replace a known connection.

Import articulation tools such as `solveTwoBone`, `fkTwoBone` and `twoBoneRig` from `explainerkit/rigs`. A solver computes poses, while a scene adapter turns those poses into property values on drawable handles. [Library layers](library-layers.md) explains these responsibilities.

| Author's task | Working vocabulary | Module |
| --- | --- | --- |
| Pose an articulated instrument or character | A skeleton connects bones through parents and describes a resting pose, local joint angles and limits. | `explainerkit/rigs` |
| Reach for a point | Inverse kinematics solves joint angles to bring an endpoint toward a target. The remaining distance is its residual. | `explainerkit/rigs` |
| Blend authored motion with a reach | Forward kinematics computes positions from angles. A blend combines that authored pose with an inverse-kinematics solution. | `explainerkit/rigs` |
| Keep a tool in a hand | A socket defines an attachment position and orientation on a bone. | `explainerkit/rigs` |
| Bend artwork with a skeleton | A skin uses a bind pose and weights that describe how bones influence each path point. | `explainerkit/rigs` |
| Turn one outline into another | A morph matches points between contours using their direction, start and optional landmarks. | `explainerkit/morph` |
| Keep a set visually coherent | Grouping can use nearby positions, common regions, explicit connections, similarity and shared movement. | `explainerkit/perception` |

## Pose a skeleton

```js
import {skeleton} from 'explainerkit/rigs';

const body = skeleton({
  root: {x: 200, y: 200, rotation: 0},
  bones: [
    {id: 'upper', length: 100, limits: [-2.5, 2.5]},
    {id: 'lower', parent: 'upper', length: 80, limits: [0, 2.7]},
    {id: 'hand', parent: 'lower', length: 30},
    {id: 'branch', parent: 'upper', length: 40, angle: -.5},
  ],
});
const fk = body.pose({angles: {upper: -.6, lower: 1.2}});
const result = body.solve({end: 'hand', target: {x: 310, y: 230}, from: fk});
if (result.converged) show(result.pose);
else showApproximation(result.pose, result.error, result.status);
```

A child bone begins at its parent's endpoint, allowing a skeleton to form branches or have several roots. Input order need not place parents first because names identify the bones. A pose belongs to its compiled skeleton and contains the root, local angles, world-space starts and ends, and world rotations. It cannot be changed after construction. Calling `pose()` fills omitted angles from rest. A `root` override is a complete specification whose omitted coordinates default to zero.

Angles use radians measured from +x toward +y, so positive angles appear clockwise on a y-down stage. Bone lengths and targets must use the same authored coordinate unit. Local joint limits are signed intervals that default to `[-π,π]`. Blending does not silently choose a shorter turn outside those intervals. A bone's `angle` is its absolute local rest angle rather than another offset added to every pose.

Call `body.solve({end,target,from,chainRoot,iterations,tolerance,restarts,unreachable})` to find a pose that brings the end bone toward a target. It adjusts one joint at a time through cyclic coordinate descent, with a fixed work budget, deterministic restarts and analytical starting poses for extended reaches. The initial `from` pose defaults to rest. `chainRoot` restricts which ancestors may move. Other local angles stay unchanged, although a shared moving ancestor can change their world positions. The skeleton root position remains fixed.

| Control | Default / envelope | Meaning |
| --- | --- | --- |
| `iterations` | 80; integer 1–256 | It limits complete joint sweeps for each starting pose. |
| `restarts` | 2; integer 0–4 | It adds deterministic starting poses when the first attempt does not converge. |
| `tolerance` | .01; 1e-8–1e4 | It sets accepted endpoint distance in authored units. |
| `unreachable` | `report`; or `error` | It returns an approximate result or throws `IK_NOT_CONVERGED` whenever the solver does not converge. |
| Bones | 1–128; total length ≤1e6 | These limits bound the compiled skeleton forest. |
| Work budget | bones × chain length × iterations × (restarts + 1) ≤2,000,000 | A request exceeding this budget is rejected before solving. |

The result contains `{pose,target,error,converged,withinReach,status,iterations}`. Read `error` as the Euclidean distance from the solved endpoint to the target. The `withinReach` flag only checks whether the target lies within the chain's unconstrained inner and outer radii, allowing tolerance. It does not establish that joint limits permit the target. Status is `converged`, `unreachable`, `stalled` or `iterationLimit`. The returned pose is the best candidate observed, not a guaranteed global optimum. Its iteration count includes completed sweeps across attempts and excludes starting-pose evaluation. A numerical solution does not prove collision freedom or physical realism.

Use `body.pose({angles, root, scale})` to set a pose directly. Per-bone `scale` factors such as `scale: {shin: 1.1}` accept .01–100 and change bone length for squash and stretch. The scaled endpoint, child starts and sockets move together, and the pose reports both factors and actual lengths. `body.blend(a,b,mix)` interpolates signed local angles, scale factors and the root within their intervals rather than blending Cartesian endpoints.

For a two-link measured or hand-placed limb, `solveTwoBone({root, target, lengths, pole, stretch})` returns angles and stretch that can be passed into `pose`. Use `body.socket(pose,id,{along,offset,rotation})` to place an attachment along a bone, with `along` in 0–1 and offset perpendicular to the bone's +x direction. Missing names or poses from another skeleton are rejected.

The scale belongs to the pose, not the skeleton definition. Single-goal and
simultaneous solves retain `from.scale`, and reach, pole seeds and residuals use
those actual lengths. Bound skin transforms stretch along each bone's local
axis relative to its bind-pose length while retaining perpendicular thickness.
Sockets, child joints and fully weighted skin endpoints therefore agree even
with a rotated, already stretched bind pose. Sampling another pose or solving
another target does not accumulate scale into the model.

## Use the same rig in a scene

```js
import {skeletonRig} from 'explainerkit/rigs';

const rig = skeletonRig(drawing, {
  bones: [
    {id: 'upper', length: 100},
    {id: 'lower', parent: 'upper', length: 80},
    {id: 'hand', parent: 'lower', length: 30},
  ],
  root: {x: 200, y: 200},
  ik: {end: 'hand', target: {x: 310, y: 230}},
});
rig.target.x.to(0, 340, {duration: 2});
rig.mix.set(.7); // 0 = authored FK; 1 = solved IK
rig.angles.lower.to(0, .8, {duration: 2});
rig.attach(tool, 'hand', {along: 1, offset: 5});
```

The scene rig exposes `model`, `group`, `tag`, `angles`, `root`, `fk`, `pose`, `target`, `mix`, `solution`, `socket` and `attach`. Its angles and root are ordinary scene parameters that can be animated. Configure `ik` with `end`, `target`, `chainRoot`, `iterations`, `tolerance` and `restarts` when a target should be solved. A target may use numbers or parameters from the same scene. Without `ik`, `target`, `mix` and `solution` are null.

Read `solution` for the solver result before blending and `pose` for the final blended pose. `socket(id,spec)` returns a derived scene input, while `attach(handle,id,spec)` binds x, y and rotation on a top-level drawable owned by the same scene.

The rig gives itself and socket attachments a unique tag and adds that tag to the adaptive layout's `together` policy. This tells layout that a tool belongs with its hand before it considers proximity or shared-motion heuristics. Apply `.tag(rig.tag)` to separately drawn skins or labels that must travel with the rig, and retain the tag when replacing the adaptive policy. These are author-declared connections rather than inferred visual relationships.

Joint controls use shared scene inputs rather than another animation loop. Every sample starts from the authored forward-kinematics pose, so a previous solve is never carried into a backward seek. Repeated samples are deterministic, although nearby targets can still select different constrained solutions. Choose rest angles and blending when you need control over that appearance. The single-goal wrapper does not promise continuous bend-side selection. Use `solveGoals` for simultaneous position or orientation goals, priorities and pole targets, and read [soft reach controls](soft-two-bone-ik.md) for its two-link options.

Move the model with `rig.root`. The scene adapter draws world-space poses inside a group whose transform starts as the identity. Independently transforming that display group does not move sockets or change the solver's coordinates. An attachment owns x, y and rotation while active, so a competing driver for those channels is rejected.

## Bind a deformable outline

```js
import {bindSkin} from 'explainerkit/rigs';
const skin = bindSkin(rig.model, {
  commands: [['M', 200, 190], ['L', 300, 190], ['L', 380, 190]],
  weights: [
    [{bone: 'upper', weight: 1}],
    [{bone: 'upper', weight: .5}, {bone: 'lower', weight: .5}],
    [{bone: 'lower', weight: 1}],
  ],
});
outline.bind('commands', {inputs: [rig.pose], map: skin.sample}).tag(rig.tag);
```

Skinning needs a bind pose that describes where the artwork lies before the bones move. Supply `rest` to choose another pose from the same skeleton, or omit it to use rest. Provide one influence list for every coordinate pair, including Bézier control points. Each list contains 1–4 distinct bone names and nonnegative weights summing to one. Set `normalize:true` to normalize a positive total explicitly. The captured weights cannot be changed by later edits to your input arrays. The result provides frozen `weights`, `rest` and `diagnostics` plus `sample(pose)`.

Linear blend skinning moves path and control points according to their bone weights. It does not optimize a mesh or preserve volume, and opposing rotations can pinch or collapse an outline. A Bézier curve's interior has no separately painted weights. The limit is 10,000 coordinate pairs. To apply shape keys or morphing before skinning, supply resting-path commands with stable point correspondence to `skin.sample(pose,{commands})`, following [shape-key safety](morph-safety.md). Use sockets for rigid attachments and skins for deformable artwork so both remain attached to the same bone identities.

## Morph an outline

```js
import {createMorph} from 'explainerkit/morph';
const morph = createMorph(sourceCommands, targetCommands);
outline.bind('commands', {inputs: [progress], map: morph.sample});
```

`createMorph(from,to,{samples=128,tolerance=.25,align,reverse,offset,landmarks})` prepares a sampler for one nondegenerate contour using absolute M/L/Q/C/Z command arrays. Both endpoints must be open or both closed. Holes, multiple contours and conversion between open and closed paths are rejected. Choose source and target outlines that represent the intended transformation because the sampler does not infer a relationship between unrelated objects.

Preparation subdivides curves, measures distance along them and resamples both paths to establish matching points. Intermediate samples are M/L/Z polygons. Progress 0 and 1 return the exact captured endpoint commands, while values between them are approximations. `diagnostics.approximationBound` combines curve tolerance with half the largest resampling interval to bound endpoint approximation. This does not prove valid topology between points or a fixed screen-pixel error under zoom.

- Set `samples` to an integer in 2–512 for open paths or 3–512 for closed paths.
- Set `tolerance` within 1e-5–1e4 authored units to control chord approximation. Subdivision also has point and depth limits.
- `align:'auto'` searches a closed contour's start point to minimize summed squared distances. Choose `none` to keep sampled starts.
- `reverse:'auto'` aligns opposing closed winding when automatic alignment is enabled. A boolean can override that choice.
- `offset` rotates the target's sample indices for a closed contour and disables automatic start search.
- Supply `landmarks:[{from,to}]` as strictly ordered interior fractions of flattened arc length in (0,1). Each pair becomes a shared sample. Landmarks default alignment to `none` and retain authored direction, so reversal and nonzero offsets cannot be combined with them.

Inspect a proposed transition with `morph.inspect(progress)`, which reports area and proper line-segment crossings at that sample. It does not count touching or collinear overlaps and is not a validity certificate. Automatic matching can fold, collapse or pair the wrong feature, so adjust contour direction, start points or landmarks when needed. Semantic splitting and merging and as-rigid-as-possible mesh interpolation are not provided here. Use `flattenPath(commands,{tolerance,maxPoints})` to inspect the flattened geometry separately.

## Suggest a perceptual group

```demo design-birds-of-a-cluster
Birds of a feather cluster together. Move the middle bird to join a group. Bring both flocks within reach of a chain of nearby birds and see the grouping rule connect them.
```

```js
import {perceptualGroups, groupStagger} from 'explainerkit/perception';
const plan = perceptualGroups([
  {id: 'left', bounds: {x: 10, y: 20, width: 20, height: 20}, velocity: {x: 1, y: 0}},
  {id: 'right', bounds: {x: 50, y: 20, width: 20, height: 20}, velocity: {x: 1, y: 0}},
], {distance: 12, motionDistance: 80});
const onsets = groupStagger(plan, {at: 1, interval: .2});
left.enter(onsets.left);
right.enter(onsets.right);
```

Before suggesting groups, supply each item's stable `id` and screen-space `bounds`. Optional velocity must use one shared coordinate and time system. You may also declare string `similarity` or `region` keys. Matching similarity remains limited by distance, while matching motion must be nonstationary and within `motionDistance`. The helper does not infer similarity from color names or interpret coincident stationary items as meaningful shared movement.

The policy accepts `distance=24`, `similarityDistance=2*distance`, `motionDistance=4*distance`, `velocityTolerance=.1` and `minSpeed=.001`, together with explicit `connections`, `together` groups and `apart` pairs. Supply bounds and velocities for the intended view yourself. The grouping operation does not estimate motion from pixels.

A `together` rule requires members to share a group, while `apart` prevents their complete groups from joining even through another item. Contradictory rules are rejected before suggestions are made. Softer evidence is considered in order of shared region or explicit connection, movement together, similarity, proximity, gap and stable IDs. This order and its numerical defaults are project heuristics rather than psychological laws.

The frozen result contains `groups`, accepted and rejected `edges` with `reasons`, `gap` and `blockedBy`, plus captured author rules and policy values. Scores are not probabilities. Reordering the same input items does not change the result.

Grouping joins connected components, so a chain of short nearby connections can span a large distance. A returned group does not prove shared meaning or a maximum diameter. Inspect its evidence and use `apart` when a comparison must stay separate. The operation accepts at most 512 items, 4,096 explicit pairs per list and 512 together groups, with work bounded by `n² × max(1, exclusions) ≤8,000,000`.

Use `groupStagger(plan,{at=0,interval=.15})` to give members of each accepted group a common start time. It returns times without changing tracks, narration order or physical time. Your adaptive layout remains an authored policy. Promote reviewed suggestions to tags or `together` rules when they express the intended connection, and keep rig structure and landmark correspondence ahead of a perceptual guess.

## Verification and remaining work

Native module tests cover independent FK/length/residual oracles, 120 seeded known-reachable targets, constrained failures, restarts, immutable skins, signed blending, sockets, exact morph endpoints, subdivision error against independent curve evaluation, winding/start normalization, landmarks and transitive exclusion conflicts. Browser fixtures combine rigs, skinning, attachment, morphing and onset groups in both renderers and check an attached tool's actual pixels. The workshop is exercised at desktop and phone widths.

These APIs do not solve closed mechanical loops, contact or collision, and do not morph arbitrary meshes or compound paths. Use `solveGoals` for simultaneous goals, priorities, poles or orientation targets and `splineRig` for articulation along a curve. Their own limits are described by [soft reach controls](soft-two-bone-ik.md), while [sound](sound.md), [project recipes](projects.md) and the [current exports](../api-inventory.md) document related supported features. Broader browser and device validation is still required before claiming production readiness.