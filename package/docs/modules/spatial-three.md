# A spatial model can choose its renderer

Use `explainerkit/spatial` to define 3D coordinates, camera views and geometric picking independently of a renderer. ExplainerKit owns those calculations and the sampled model. Native SVG and Canvas can draw projected line art, while the optional Three.js adapter draws supported solid or lit geometry and externally prepared assets. Import Three.js explicitly only for that renderer, since the core does not load it or require it for line art.

One spatial model can be drawn by SVG, by Canvas or by Three.js, so you can compare representations of the same coordinates. The adapter loads only the Three.js copy that your page supplies, and there is no CDN fallback. Treat it as a way to inspect coordinates and rendering choices rather than as an augmented-reality tracker or a complete 3D authoring application.

## One coordinate contract

- Spatial coordinates are right-handed, with x pointing right and y pointing up. A camera looks along its local −z axis.
- Distances use the world units chosen by the author rather than implicitly meaning pixels or meters.
- Angles use radians, including vertical field of view `fov`. The adapter converts matrices for Three.js without making its degree-based camera constructors the model interface.
- Matrices are immutable 16-element column-major arrays. `multiply3D(A,B)` applies B before A.
- `compose3D({x,y,z,rotationX,rotationY,rotation,scaleX,scaleY,scaleZ})` computes T·Rx·Ry·Rz·S using intrinsic XYZ Euler rotations. The `rotation` field is Z rotation, and there is no second `rotationZ` field.
- Screen coordinates start at the viewport's top-left. Projected WebGL depth runs from 0 at the near plane to 1 at the far plane. Positive `cameraDepth` is forward distance along the view's −z axis.

The core's existing scene shapes can carry z, X/Y rotations, Z scale and extrusion depth. Ordinary SVG/Canvas rendering must not silently discard nondefault spatial fields. Use an explicit CPU projection for line art or select a compatible optional renderer. The spatial projection utilities do not change model positions or physical time.

## Camera, projection and rays

```js
import {
  perspectiveCamera, orthographicCamera,
  projectPoint, unprojectPoint, screenRay,
  orbitCamera, dollyCamera, zoomCamera,
} from 'explainerkit/spatial';

const view = perspectiveCamera({
  x: 0, y: 0, z: 500,
  target: {x: 0, y: 0, z: 0},
  fov: Math.PI / 3, near: 1, far: 2000,
}, {width: 900, height: 450});

const screen = projectPoint(view, {x: 40, y: 20, z: 10});
const world = unprojectPoint(view, {
  x: screen.x, y: screen.y, depth: screen.depth,
});
const ray = screenRay(view, {x: 450, y: 225});
```

Create a camera with `perspectiveCamera(spec,viewport)` when distant geometry should appear smaller, or with `orthographicCamera(spec,viewport)` when scale should not change with depth. Both return independent immutable camera values. Viewport defaults to 960×540 with dimensions in 1–8192. Supply x, y and z together with either Euler `rotationX`, `rotationY` and `rotation`, or a `target` and optional `up`. Combining the two orientation forms is rejected. The default camera is at `(0,0,1000)` looking along −z. A target at the camera's position or an up vector collinear with its view is rejected because it cannot define an orientation.

A perspective camera defaults to `fov:π/3`, aspect ratio from the viewport, `near:.1`, `far:100000` and `zoom:1`. Field of view lies within 1e-4…π−1e-4 radians, while aspect and zoom lie within 1e-4…1e4. Near must be positive and far must exceed it. An orthographic camera defaults to bounds at half the viewport width and height on either side of zero, `near:0`, `far:100000` and `zoom:1`. Explicit left, right, top and bottom bounds must produce positive dimensions. Near is limited to 1e7 and far to 1e8. These clipping limits are separate from scene geometry limits.

The prepared camera exposes `type`, `viewport`, `near`, `far`, `matrixWorld`, `viewMatrix`, `projectionMatrix`, `viewProjectionMatrix` and `inverseViewProjectionMatrix`. The public point operations accept a prepared camera from these constructors, not a forged record or serialized matrix bundle. Serialization of camera definitions remains a separate project-format concern.

`projectPoint` returns `{x,y,depth,cameraDepth,visible,ndc}` for a world point. A point outside the camera's visible volume remains inspectable with `visible:false` rather than being clamped to an edge. A point on the homogeneous plane at infinity throws `PROJECTION_AT_INFINITY` instead of producing Infinity or NaN. Use `unprojectPoint` to reverse the mapping with the same camera and viewport as the displayed image. It accepts finite screen x and y and a depth in [0,1], defaulting to the near plane.

Use `screenRay` to turn a screen position into `{origin,direction,near,far}` for picking. A perspective ray begins at the camera, while an orthographic ray begins at the corresponding near-plane position and runs parallel to the other rays. Directions are unit vectors. Near and far describe clipping planes rather than universal distance bounds along an oblique ray. The picking operations below test an infinite forward ray, so filter by camera depth or visible volume when you need rendered visibility.

### Orbit, dolly and zoom

```js
const around = orbitCamera(view, {
  target: {x: 0, y: 0, z: 0}, azimuth: .2, elevation: -.1,
});
const closer = dollyCamera(around, 50);
const magnified = zoomCamera(closer, 1.2);
```

Use orbit to move around a world target, dolly to move forward or backward, and zoom to change magnification. Orbit takes angle changes in radians around a target that defaults to the origin. It keeps radius fixed, clamps elevation short of the poles and resets roll to a world-up look-at view. Dolly moves along local −z without changing the lens and can pass through a target if you request too much travel. Zoom multiplies magnification by a factor within 1e-4…1e4. Each operation returns a new camera without hidden inertia, frame history or DOM listeners.

## Quaternion orientation

A quaternion represents a 3D orientation without storing a sequence of Euler turns. Use it when you need to combine rotations or interpolate between two orientations, then convert it to a matrix for the same spatial calculations.

```js
import {
  quaternion, quaternionFromEuler, quaternionFromAxisAngle,
  multiplyQuaternion, slerpQuaternion, quaternionMatrix, rotateVector3D,
} from 'explainerkit/spatial';

const a = quaternionFromEuler({rotationX: .3, rotationY: .5});
const b = quaternionFromAxisAngle({x: 0, y: 1, z: 0}, Math.PI);
const orientation = slerpQuaternion(a, b, progress);
const direction = rotateVector3D(orientation, {x: 0, y: 0, z: -1});
```

`quaternion({x=0,y=0,z=0,w=1})` normalizes finite components and rejects a zero-magnitude input. Axis-angle construction likewise normalizes its nonzero axis. Multiplication applies b before a in `multiplyQuaternion(a,b)`. `slerpQuaternion` takes progress in [0,1] and follows the shortest orientation arc, treating opposite quaternion signs as the same rotation. Exact endpoints return normalized originals, so different signs at an equivalent endpoint do not create a visible jump. `quaternionMatrix` returns a column-major rotation matrix independent of Three.js.

## Pick declared geometry

```js
import {screenRay, rayPlane, raySphere, rayBox, pickBounds} from 'explainerkit/spatial';

const ray = screenRay(view, pointerInViewportPixels);
const hit = rayBox(ray, {
  min: {x: -80, y: -60, z: -40},
  max: {x: 80, y: 60, z: 40},
  matrix: objectWorldMatrix,
});
```

Choose `rayPlane(ray,{point,normal})`, `raySphere(ray,{center,radius})` or `rayBox(ray,{min,max,matrix})` to test the corresponding declared geometry. A miss returns null, while the nearest forward hit returns `{distance,point,normal}`. Direction is normalized so distance uses world units. A ray starting inside a sphere or box hits its forward exit. Parallel plane rays miss, and a zero-radius sphere returns null because it has no surface normal.

A box matrix can include rotation, reflection or unequal scaling. The calculation preserves world distances through its inverse and transforms normals by inverse transpose. Singular transforms are rejected, and plane normals and nonzero ray directions are normalized.

Use `pickBounds(ray,[{id,min,max,matrix},…])` to test up to 10,000 transformed boxes and return the nearest one with its stable ID. Equal-distance hits are resolved by ID. The box intersection is exact for the declared box, but that does not make it a test of arbitrary meshes, glyphs or alpha masks. A box may include empty space. Choose a closer primitive or an explicit mesh strategy when that distinction affects interaction.

`worldMatrix3D(rawFrame,id)` composes the model hierarchy before projection. Its origin and basis remain in the frame's authored coordinate system. For adapter canvas-space artwork, include the adapter's y reflection when converting those authored coordinates into right-handed world coordinates for picking. The spatial study uses world coordinates consistently for both rendering and rays.

## First-party line-art rendering

`wireframe`, `boxLines`, `sphereLines` and `projectLines` prepare and project bounded edge models through the same first-party cameras. The CPU route clips against all six frustum planes and emits an ordinary 2D frame for SVG or Canvas, with painter depth ordering. It does not import Three, create meshes or claim hidden-surface removal/solid shading. Intersecting lines can still cross visibly because painter order does not store depth at each pixel. Dense points/lines can use the separate first-party WebGL route when enabled.

## Explicitly opt into Three.js

```js
import * as THREE from 'three'; // the application chooses this optional peer
import {createThreeRenderer} from 'explainerkit/renderers/three';

const renderer = createThreeRenderer(container, {
  THREE,
  camera: view,
  coordinateSystem: 'world',
  material: 'standard',
});
renderer.render(drawing.sampleWorld({time, width: 900, height: 450}));
```

Import Three.js in the application and pass its namespace as `THREE` to the adapter. The locally tested version is 0.186.1. Missing required constructors produce `THREE_REQUIRED` rather than triggering a download or selecting another renderer. The local browser study uses `/.local/three/three.module.js`, with an explicit same-origin `?three=…` override if needed, and also serves its adjacent `three.core.js`. These ignored local files are development assets rather than a bundled release dependency.

`createThreeRenderer(container,options)` creates and owns a WebGL renderer and its canvas. Choose the coordinate system and camera before supplying frames so geometry, picking and lighting use the same interpretation. The following options control the supported solid representation.

| Option | Default | Responsibility |
| --- | --- | --- |
| `THREE` | Required | Your application supplies the imported Three.js namespace. |
| `camera` | Flat-frame orthographic camera | It uses a prepared ExplainerKit camera or a caller-owned `THREE.Camera`. |
| `coordinateSystem` | `canvas` | Canvas mode flips the content root's y axis, while world mode preserves right-handed coordinates. |
| `material` | `standard` | Standard creates rough nonmetallic MeshStandardMaterial, while basic creates unlit MeshBasicMaterial. |
| `lighting` | true | It enables ambient and directional lights with optional hemisphere sky and ground illumination. |
| `light` | `{ambient:.8, key:2.5, direction:[400,800,1000]}` | It sets ambient and key intensities within 0–20, the key-light direction, and `ambientColor` or `keyColor` as `#rrggbb`. A stronger ambient and lower warm key can keep surfaces close to their paint while sides remain shaded. |
| `groupOpacity` | `reject` | Set multiply to multiply subtree opacity into adapter-owned material alpha. This differs from applying opacity once after compositing the group. |
| `circleSegments` | 64 | It selects an integer in 3–256 for disc and cylinder tessellation and stroke approximation. |
| `materials` | [] | It supplies at most 10,000 distinct `{id, unlit?, emissive?, emissiveIntensity?}` overrides. Emissive uses `#rrggbb`, and its intensity is 0–20 with default 1. |
| `shadows` | false | It enables owned shadow-map rendering and mesh or light flags, fitting the shadow view to scene bounds. |
| `assets` | [] | It attaches caller-owned Three.js objects to named group nodes. |
| `curveTolerance` | .25 | It sets curve flattening tolerance in authored units. |
| `maxVertices` | 250000 | It limits conservative preparation and actual draw geometry to an integer in 100–1,000,000. |
| `pixelRatio` | 1 | It accepts .25–4, with raster axes at most 8192 and total output at most 8,000,000 pixels. |
| `antialias` | true | It requests antialiasing when creating the WebGL context. |
| `label` | Spatial scene | It names the canvas for accessibility. |

Three.js requires WebGL 2 for this renderer. If context creation fails, `createThreeRenderer` throws `THREE_WEBGL_UNAVAILABLE` with an alternative rather than silently switching to SVG. See the [official WebGLRenderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html) for the platform interface.

The renderer exposes `element`, `scene`, `camera`, `frame`, `capabilities`, `render(frame,{camera})`, `setCamera`, `setAssets` and `dispose`. Render a sampled frame explicitly or connect it to the existing player clock, because construction installs no animation loop. Frames produced by the scene's own `sampleWorld` are inspected without a deep copy. Static outlines are flattened and checked once for reuse, reducing repeated preparation work. The adapter owns generated geometry and materials, while supplied assets and cameras remain application-owned. Disposal releases owned resources, prevents reuse and is safe to repeat.

### Existing 2D frames and extrusions

Canvas coordinates start at the top-left with y pointing down. The default `coordinateSystem:'canvas'` reflects the content root and uses an orthographic camera over the flat frame to preserve that layout. Reflection changes handedness, so choose world mode for right-handed 3D constructions and geometric picking. A supplied camera describes the resulting Three.js world rather than the original unconverted canvas coordinates.

The adapter turns rectangles into planes or boxes and circles into discs or capped cylinders. Supported simple or compound contours become planar ShapeGeometry or ExtrudeGeometry with holes. Positive depth extends from local z=0 to z=depth. Rectangles keep a top-left local origin and circles keep their center. Curved paths and rounded rectangles are finite approximations. Nested position, XYZ Euler rotation and three-axis scale are retained, while extrusion has one depth step and no bevel. See the [official extrusion contract](https://threejs.org/docs/pages/ExtrudeGeometry.html).

Adapter materials use solid paints, including hexadecimal alpha, multiplied separately by `fillOpacity` and `strokeOpacity`. Standard materials support lighting through a small preset rather than a general material editor. External assets keep their own materials, textures and lights. Lighting, transparency sorting, depth buffers and line rasterization can differ from SVG or Canvas, so identical pixels are not promised.

Group opacity is rejected by default because multiplying it into children differs from compositing a group and fading it once. Set `groupOpacity:'multiply'` explicitly to choose that material-alpha behavior through nested groups. It multiplies shape and hexadecimal paint alpha and disables depth writes for transparent materials. Overlapping transparent surfaces can therefore accumulate alpha. An external asset inside such a fractional group throws `asset.opacity` instead of having its materials modified.

Native strokes support basic one-pixel Three.js lines with default caps and joins. Their raster width does not guarantee one authored world unit under every transform. Wider strokes or custom caps and joins throw `THREE_UNSUPPORTED`. Use a mesh stroke or a 2D renderer when those are needed. A combined fill and stroke with fractional shape opacity is also rejected because preserving it requires isolated compositing.

### Compound solids, sky lighting and paper materials

```js
const adapter = createThreeAdapter({
  THREE,
  circleSegments: 12,
  groupOpacity: 'multiply',
  light: {hemisphere: .8, sky: '#ffffff', ground: '#c6b79b'},
  materials: [
    {id: paper.id, unlit: true},
    {id: lantern.id, emissive: '#ff8800', emissiveIntensity: 2},
  ],
});
```

Set `light.hemisphere` within 0–20 to add sky and ground illumination, with zero disabling it by default. `sky` and `ground` default to white and dark grey, and `light.direction` determines the hemisphere's up direction. Set `lighting:false` to omit adapter lights. With shadows enabled, `light.shadowRadius` controls directional shadow filtering within 0–16 and defaults to 1. It does not provide physically based area-light or contact shadows.

The key light's shadow map covers the whole scene by default, so a large scene gets coarse shadows. `light.shadowMapSize` sets the map's width and height in texels, within 256–8192, and defaults to 1024. A larger map gives sharper shadows and uses more GPU memory. `light.shadowBias` and `light.shadowNormalBias` move the depth comparison slightly so that a surface does not shadow itself in fine stripes. The first is a depth offset within −0.01 to 0.01, and the second is a distance along the surface normal in world units, within 0–1000. Both default to 0, which is three.js's own default.

Call `adapter.setShadowFocus(center, radius)` to spend the whole shadow map on the part of the scene the camera is looking at. The centre is a world point `{x, y, z}` and the radius is in world units. The key light's shadow then frames that sphere, so shadows inside it are sharper and shadows outside it are not drawn. Call it again as the camera moves, or pass `null` to frame the whole scene from the next update. Sharper shadows show self-shadowing stripes more readily than coarse ones, so raise the biases when you focus or enlarge the map, and check the result with the [3D rendering audit](render-audit.md).

A material override with `unlit` uses Basic material for that fill. Emissive color and intensity affect Standard fills, while strokes remain basic native lines. Overrides are captured and leave external assets unchanged.

Call `adapter.setLight(partial)` when a theme or time-of-day control changes lighting. It accepts the same keys as `light`, validates their merged values and updates committed lights together. Read `adapter.light` for the current settings used by later rebuilds. An invalid update leaves them intact. Whether a hemisphere light exists is determined at construction. If created, it can be dimmed to zero and raised again, but an adapter created without one cannot add it through this update.

```js
const day = adapter.light;
adapter.setLight({ ambient: .4, hemisphere: .6, sky: '#a8a29a', ground: '#141210' }); // dark page
adapter.setLight(day);                                                                // and back
```

Compound paths follow `fillRule`. Evenodd alternates filled and hollow regions at each nesting level, while nonzero follows contour winding. Both flat and extruded forms can contain separate outer rings, holes and islands. Each contour must remain simple and nondegenerate after flattening at `curveTolerance`. Touching or intersecting contours are rejected before triangulation.

This triangulates supported contours within limits rather than performing general 3D constructive solid geometry. Preparation allows at most 4,000,000 topology operations and 2,048 flattened points per contour. Vertex estimates count all contours including holes, and actual Three.js vertices are checked again.

### Bring an existing Three/glTF scene

```js
// The application loads/parses the glTF explicitly, with its chosen loader,
// transport, resource paths and permissions. ExplainerKit does not fetch it.
const holder = drawing.instance(drawing.component({type: 'group'}));
const renderer = createThreeRenderer(container, {
  THREE, camera: view, coordinateSystem: 'world',
  assets: [{id: holder.id, object: loadedGLTF.scene}],
});
holder.to(0, {rotationY: 1}, {duration: 3});
```

Attach external assets only to explicit group IDs. The adapter clones the object hierarchy but shares your geometry, materials and textures. It does not move the original object to a new parent or dispose those resources. Your application owns loading, cancellation, animation mixers, textures, environment maps, cleanup and file or network security. A target group missing from a candidate frame throws `ASSET_TARGET_MISSING`. Update the asset list with `setAssets` when scene structure changes.

The asset interface accepts a glTF scene already loaded by Three.js. It is not a built-in loader, material inspector or animation retargeter. The list is limited to 1,000 targets and 10,000 combined hierarchy nodes at depth no greater than 64. Actual draw vertices count toward the adapter's geometry budget. Features in trusted external Three.js objects remain the responsibility of the application and backend rather than being silently converted by ExplainerKit.

For a first-party static edge model without Three, use the separate [glTF/GLB edge importer](gltf-import.md). Its supported binary/transform subset deliberately differs from rendering an already loaded physically based rendering (PBR) asset.

### Use your own renderer

```js
import {createThreeAdapter} from 'explainerkit/renderers/three';
const adapter = createThreeAdapter({THREE, coordinateSystem: 'world', camera: view});
adapter.update(frame);
yourRenderer.render(adapter.scene, adapter.camera);
```

Use `createThreeAdapter` when your application already owns the WebGL renderer. It accepts the same model, material and asset options without DOM or pixel-ratio options. Calling `update(frame,{camera})` prepares and adopts a Three.js scene without creating a GPU context. Supplying a renderer enables `adapter.render(frame,{camera})`, and that renderer must provide `render(scene,camera)`. Your application still owns its pixel ratio, shadow map, environment and output policy. A supplied `THREE.Camera` is also application-owned and needs aspect and projection updates on resize.

Call `adapter.object(id)` to find the current Three.js group for an ExplainerKit node. Successful updates retain node groups and mesh or line identities by ExplainerKit ID and drawable position while updating transforms and resources. Geometry and materials are cached by their descriptors, and candidate resources are prepared before committed objects change. External asset hierarchies are cloned on each preparation. The Three.js Scene and generated camera may be replaced, so ExplainerKit ID remains the stable identity to use.

Removed or changed adapter resources are disposed after a successful update. Disposing the adapter releases its resources and rejects further updates without disposing supplied renderers, cameras or assets.

## Unsupported means unsupported

Text, clipping paths, gradient paints, self-intersecting/touching filled paths, implicit path trimming, fractional group opacity without explicit multiplication, group extrusion, line extrusion and unsupported strokes fail before replacing the last valid scene. Each `THREE_UNSUPPORTED` error names its `capability`. Curve preflight caps each contour at 2,048 flattened points and bounds intersection-check work. Malformed frames and resource excesses have separate diagnostics.

Preparation happens before a scene update is committed. An unsupported frame leaves the last scene and owned renderer image intact. A renderer exception also preserves committed model and scene references and releases candidate resources. GPU context loss or failure after a canvas resize cannot guarantee restoration of previous framebuffer pixels. Your application and backend must recreate resources after actual context loss.

## Evidence and limits

Native spatial tests check analytic axes, 200 matrix/inverse round trips, nested transforms, 400 project/unproject round trips, frustum metadata, quaternion equivalence and shortest arcs, orbit/dolly/zoom separation and ray intersections under rotated/nonuniform bounds. Actual optional-peer tests compare the first-party matrices and projection against Three 0.186.1 and exercise real Three geometry/materials, resource reuse/disposal, unsupported atomicity, external assets and renderer/camera ownership. Set `THREE_TEST_MODULE=/absolute/path/to/three/build/three.module.js` to execute those tests. Tests that need a missing peer are explicitly skipped and do not count as rendering passes.

`tests/browser/three-checks.html` dynamically imports the explicit local peer and checks actual WebGL 2 pixels, backward-seek raster determinism, unsupported-raster preservation and perspective agreement. If the local peer or WebGL 2 is unavailable, the result is `unsupported`, not a pass. The recorded local headless Chrome fixture passed all four checks. Those checks do not establish physical-device GPU performance, browser parity, context-loss recovery, shadow quality, photorealism, glTF asset security, or augmented-reality registration accuracy.

The scene/graph API, a full typed spatial document format, native 3D rigs, mesh CSG/booleans, general material editing, skeletal/glTF animation playback, physically based environment authoring, production shadows and AR tracking remain separate work. This module is an optional solid renderer over ExplainerKit-owned math and sampled models, not a replacement for the core.

## Far sides, depth order, map lines and 3D clouds

Use `order:'depth'` to order spatial objects, and choose `backfaces:'show'|'fade'|'hide'` with `backOpacity` to control far sides. A surface curls into a globe by default through `bend:'curl'`. `mapLines` wraps supplied longitude and latitude polylines with it, while `space.cloud` projects 3D points into a GPU cloud node. See the [film kit](film-kit.md#depth-far-sides-order-and-a-rolling-map) for the connected example.

Flat-art lighting through `frame.light`, node `shade` or `texture`, and temporal `motionBlur` belong to native 2D composition. This adapter rejects them before changing its scene. Use the solid renderer's supported lighting and material options instead, keeping the same core source of time and geometry.