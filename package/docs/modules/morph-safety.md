# Refusing unsafe polygon samples and applying shape keys

Use `createSafeMorph` from `explainerkit/morph` when each sampled polygon must pass geometry checks before it is drawn. Use `createShapeKeys` from the same module to blend named coordinate changes into a resting outline. Both operations work on path commands, so prepare the source and target paths before creating the sampler.

`createSafeMorph(from,to,options)` matches points by distance along two outlines and checks the path at every requested sample. It accepts one closed straight-edged polygon with at most 512 vertices. An endpoint or sample with collapsed edges, backtracking overlaps, nonadjacent touches or intersections, or collapsed area throws `MORPH_UNSAFE_SAMPLE`. Curved paths, open paths and multiple contours throw `MORPH_SAFETY_UNSUPPORTED`.

```demo design-collapsing-cracker
Cracker versus geometry. Drag the clock through the red mark at halfway. The two outlines share a shape but match opposite corners, which makes the halfway sample collapse. The sampler refuses that frame.
```

These checks establish validity at the times you sample, but do not prove that the outline stays valid between those times. Relative tolerances are defined in `src/morph/safe.js`. The sampler cannot determine whether two shapes have the intended meaning or whether their motion looks appealing. The permissive `createMorph` sampler remains available when these checks are not wanted. If a bound sampler rejects a frame, the player retains the previous valid display.

`createShapeKeys(base,{smile:targetCommands,...})` captures up to 64 named paths with the same command types and coordinate counts. Calling `sample({smile:.5})` adds half the named coordinate change to the resting outline. Each weight is in [0,1], and their total cannot exceed one. Unknown names or incompatible command structures are rejected. Even a convex blend of coordinates does not prove that the resulting outline avoids self-intersection.

Apply shape keys before skinning by passing their commands to `skin.sample(pose,{commands:keys.sample(weights)})`. The skin checks that these commands preserve the resting path's structure before transforming coordinates, and it keeps its bound weights and rest pose. Omitting the second argument uses its captured resting commands. Matching many source features to many targets, changing command topology, checking multiple contours or holes, and proving safety at every possible time remain unsupported.
Use `createObjectMorph` to match compatible filled outlines across scene objects. It can carry shapes between equations, groups and characters. See [Animate equations](math.md) for a complete example and the matching limits.
