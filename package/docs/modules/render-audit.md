# 3D rendering audit

A shaded 3D scene can look wrong in ways that are hard to spot until someone points at them. Fine parallel stripes can cover a curved petal, the edge of a tree's shadow can come out as a staircase, or two surfaces can flicker through each other. These artefacts come from a handful of renderer settings, and `explainerkit/audit` can check those settings before anyone has to find the artefact by eye. It can also look for stripes in a rendered image, which catches the cases a settings check misses.

## Check a three.js scene

`describeThreeScene` reads a three.js scene, its camera and its renderer and returns a plain description of the meshes, the shadow-casting lights and the camera. It reads properties only and never imports three.js. `auditRender3D` checks that description and returns a status of `pass` or `warn`, a list of findings and the measurements it used. Pass the drawing size in CSS pixels as `viewport`, because the shadow checks compare shadow detail with screen pixels.

```demo design-corduroy-audit
Throw shade on the sculptures. Move the shadow-map dial from coarse to fine and look at the cast shadows on the platform. Orbit the scene to inspect it from another angle. The audit measures how many screen pixels one shadow-map texel covers at the subject.
```

```js
import {auditRender3D, describeThreeScene} from 'explainerkit/audit';

const description = describeThreeScene({
  scene, camera, renderer,
  viewport: {width: canvas.clientWidth, height: canvas.clientHeight},
});
const report = auditRender3D(description);
for (const finding of report.findings) console.warn(finding.rule, finding.message);
```

Here `scene`, `camera`, `renderer` and `canvas` are the objects your page already renders with. Each finding names its rule, its severity, the objects involved and the measured value, and its message says what to change. Objects without a name are identified by their type and position in the scene, so naming meshes makes findings easier to act on.

| Rule | What it looks for | What it means on screen |
| --- | --- | --- |
| `shadow-bias` | A light casts shadows onto objects that also cast them, and its normal bias is less than two shadow texels with no depth bias. | Surfaces shadow themselves in fine stripes, which is called shadow acne. Sharper shadow maps show the stripes more. |
| `shadow-resolution` | One texel of the shadow map covers more than three screen pixels at the distance of the subject. | Shadow edges look stair-stepped or hatched. |
| `shadow-coverage` | Objects near the subject that receive shadows lie partly outside the light's shadow camera. | Shadows are cut off at the edge of the light's view. This is reported as information. |
| `depth-precision` | The camera's far plane is more than 100,000 times its near plane and the renderer has no logarithmic depth buffer. | Distant surfaces close together flicker between each other, which is called z-fighting. |
| `coplanar-surfaces` | Two flat opaque objects overlap at almost the same depth. | They flicker through each other from any camera position. Pairs of the same colour are reported as information, because their fighting is barely visible. |

The thresholds are engineering choices, listed in `RENDER_3D`, and you can override any of them by passing a second argument to `auditRender3D`. The subject distance defaults to the centre of the objects that receive shadows. Pass `subject` as a world point to `describeThreeScene` when the camera looks somewhere else.

## Look for stripes in the pixels

A settings check cannot see everything. For example, soft shadows can hide shadow acne at one distance and show it at another. `auditStripes` looks at a rendered image instead. It divides the image into tiles, removes the smooth shading from each tile, and flags tiles whose fine detail repeats regularly in one direction, as shadow acne, moiré and aliased shadow edges do. Pass an image as `{width, height, data}` with 8-bit RGBA rows, such as the `ImageData` of a canvas.

```js
import {auditStripes} from 'explainerkit/audit';

const copy = document.createElement('canvas');
copy.width = canvas.width;
copy.height = canvas.height;
const context = copy.getContext('2d');
context.drawImage(canvas, 0, 0);
const stripes = auditStripes(context.getImageData(0, 0, copy.width, copy.height));
console.log(stripes.status, stripes.tiles);
```

A WebGL canvas usually clears its drawing after the frame is shown, so copy it inside an animation frame callback that runs after your render, or create the renderer with `preserveDrawingBuffer: true` while auditing. The image is reported as `warn` when at least three tiles are flagged. Each tile records its position, the period and direction of its stripes and their strength. A real striped texture, such as corduroy or a tiled roof, is flagged as well, so a finding says where to look rather than what caused it.

The default thresholds were set on the landing page's city. With shadow bias too small for its shadow map, the stripe check flagged 10 tiles of one frame at 32-pixel tiles. The same view with the shadow settings restored flagged 1 tile, on a bevelled edge. Different scenes may need different thresholds, which `RENDER_3D` lists.

## Audit a film or page automatically

ExplainerKit's development repository runs both checks over its own pages with a command that is not part of the package. In your own project, run the checks from a test page whenever you add or change a 3D model, a light or a camera, alongside the [composition audit](composition-audit.md) for 2D layout. When you change shadow settings, run them again after the change. The same change that sharpens one artefact can reveal another.
