# Library layers and imports

A watch combines a mechanism with choices about its appearance and story. ExplainerKit keeps those responsibilities separate so you can reuse a gear model in several explanations. The mechanism calculates how the gears move. Your application chooses their placement, colors and timing, and the core scene stores the objects that draw them.

Start with `explainerkit/core` when you need to create and animate a scene. Creating a drawable returns a handle that you can use to edit that object. Inputs hold values, bindings connect those values to visual properties, and sampling returns the scene at a chosen time. Import a subject model only when your explanation needs its calculations. The main `explainerkit` entry is also available as a convenience import using the same core constructors.

```js
import {scene} from 'explainerkit/core';
import {mechanism, gearPath} from 'explainerkit/mechanisms';
const drawing = scene();
const train = mechanism();
const wheel = train.gear({teeth: 20, module: 2});
drawing.path({commands: gearPath({teeth: 20, module: 2})});
```

In this example, `mechanism()` creates the model and `gearPath()` supplies the geometry that the scene draws. A particular watch's arrangement, colors and shot sequence belong in your application rather than in the gear model. The interactive example below starts with the core alone and loads the mechanism module when you first interact with it.

```demo layers-gears
The card starts with `explainerkit/core` alone. The first touch runs a real `import('explainerkit/mechanisms')`. The call to `mechanism().gear(...).meshWith(...)` sets the ratios, and `train.derive(scene, input)` turns every gear from one parameter. The swatches change only the application.
```

## Choose by responsibility

| Layer | Entries and ownership |
| --- | --- |
| Scene foundation | `explainerkit/core` stores the scene, its parameters and bindings, and the rules for sampling time. It shares the geometry and view helpers needed to evaluate a frame. |
| Construction and composition | `graphics`, `color`, `geometry`, `geometry/shapes`, `morph`, `transitions`, `data`, `layout`, `layout/labels`, `layout/annotations`, `audit`, `adaptive`, `typography` and `perception` provide reusable geometry, data mappings and authoring rules. |
| Optional models | `rigs`, `characters`, `mechanisms`, `physics`, `particles`, `procedural`, `spatial`, `camera`, `zoom`, `look` and `parallax` provide calculations or presentation controls with their own documented limits. |
| Delivery and media | `player`, `film` with its `film.css` stylesheet, `scroll`, `story`, `editor/timeline`, `project`, `media`, `sound/mix`, `sound/studio`, `sound` and `assets/preload` manage playback, editing, persistence or media resources. |
| Adapters and assets | `renderers/svg`, `renderers/canvas`, `renderers/webgl`, `renderers/three`, `adapters/dom` and `adapters/waapi` draw or apply sampled state. The `import/svg`, `import/font` and `import/gltf` modules convert supplied assets. Your application supplies Three.js when you choose that optional renderer. |
| Application/study | In the development repository, `examples/` contains finished compositions, stories and assets. `scripts/reference/` contains development analysis and scoring. Neither is a runtime dependency or part of the npm runtime package. |

Choose the row that describes your task, then import the entry that provides it. Use `layout` to arrange objects and `rigs` to control connected parts.

The table helps you find responsibilities within the package. Its rows are not umbrella modules that import every feature listed in them. Use the [generated inventory](../api-inventory.md) to find exact package paths and the [module map](index.md) to read each module's supported behavior.

## One articulation entry

```js
import {solveTwoBone, fkTwoBone, twoBoneRig, skeleton, bindSkin}
  from 'explainerkit/rigs';
```

Import articulation tools from `rigs` when you need connected parts to move together. The two-bone solver in `src/rigs/two-bone.js` computes angles without a scene, while `two-bone-scene.js` connects those results to drawable handles. The same module also contains general skeletons, weighted skins, curve rigs and inverse kinematics for multiple targets. Inverse kinematics, usually abbreviated IK, finds joint angles that bring an endpoint toward a target.

The mathematical solver can run without a browser. Cutout characters provide offsets from a resting pose and named pose controls because those describe a different authoring task from a skeleton defined by bone lengths and angles.

## Dependency rules and change scenarios

Models compute values, adapters bind them to objects, renderers draw frames, and players advance time. Mechanical calculations therefore do not import a scene, renderer, sound system or browser lifecycle. Articulation calculations return poses that a scene adapter can bind to ordinary handles. Renderers own the platform resources used to draw those handles, while playback adapters separately own clocks and media playback.

The responsibility of a feature tells you where to change it. Changes to a gear's geometry belong in its model, while changes to the watch that uses it belong in the application.

- Change the optional mechanical model when changing a gear ratio or tooth profile.
- Change the application when changing a watch's layout, brass palette or shot timing.
- Change the recommended solver implementation when changing two-link reach mathematics. Old import paths use that same implementation.
- Change the development analysis tools and original fixtures when adding a reference-motion study. Runtime modules receive general options rather than study scripts.

Boundary tests check that the core does not import subject models and that mechanisms remain independent of scenes. Data, geometry, layout, playback, editor, color, and noise implementations have dedicated source folders. The scene shares the view, paint, and layout support needed to evaluate a frame. See [architecture](../architecture.md) for the dependencies between those parts. The alpha API is not frozen for 1.0.