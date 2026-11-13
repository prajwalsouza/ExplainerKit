# One model, explicit rendering choices

Keep scene identity, inputs, animation and geometry in ExplainerKit, then choose a renderer that can draw the representation your explanation needs. SVG and Canvas draw native 2D scenes, while spatial mathematics can project 3D line art into either one. Dense points and lines have a separate WebGL2 renderer. Use the optional Three.js adapter when you need supported solid or lit geometry and prepared 3D assets. Three.js does not become the scene model or the default renderer.

| Layer | Implementation owner | Runtime boundary |
| --- | --- | --- |
| 2D scene, SVG and Canvas | ExplainerKit | Native scenes use these renderers without third-party packages. |
| Vectors, matrices, quaternions, cameras, orbit/dolly and pointer rays | ExplainerKit | These calculations run in pure JavaScript and can be tested in Node. |
| 3D line art and wireframes | ExplainerKit | CPU projection clips lines to the camera's visible volume and sorts them back to front in SVG or Canvas frames. |
| Dense GPU points and lines | ExplainerKit | The optional WebGL2 renderer accepts explicit typed buffers without a scene or material engine dependency. |
| Solid/lit 3D and caller-owned 3D assets | Optional Three.js adapter | Your application supplies Three.js explicitly. The adapter does not import, fetch or silently select it. |

A scene defaults to `svg`, with `canvas` as its other native renderer. Optional renderers are separate imports. If a renderer cannot support a feature, it reports the capability before replacing the previous valid display. A 2D renderer therefore rejects unsupported nonzero z, rotationX or rotationY, scaleZ or depth instead of silently flattening them.

## Keep transitions in ExplainerKit

When switching representations, keep the same authored objects, poses and data mappings in the model and sample them at the same time. Your application chooses the renderer without duplicating scientific state or introducing another animation clock. The scene player controls native SVG and Canvas playback. Explicit WebGL and Three.js integrations can read the same sampled inputs or player frame events.

Choose supported operations as well as a renderer. A projected wireframe does not become a shaded mesh, and the standalone WebGL buffer format does not describe a general material scene. The Three.js adapter rejects core behavior that it cannot preserve, including group opacity that requires isolated compositing, rather than promising identical SVG and Canvas pixels. Its optional alpha-multiplication policy has different documented semantics.

## CPU line art

Import `wireframe({vertices:[{x,y,z}],edges:[[index,index]]})`, `boxLines`, `sphereLines` and `projectLines` from `explainerkit/spatial` to build 3D line art. `projectLines(geometry,camera,{transform,matrix,stroke,strokeWidth,opacity,sortDepth,id})` returns an ordinary `{width,height,children}` frame for SVG or Canvas. Choose either matrix or transform, rather than both. World coordinates are right-handed with y pointing up, while screen coordinates start at the top-left with y pointing down.

Projection clips each segment against the six planes bounding the camera's visible volume before dividing by perspective depth. Fully invisible edges are omitted, and IDs retain their source edge indices. Optional back-to-front sorting uses the midpoint camera depth of each edge and resolves ties consistently. This approximates draw order without hiding lines behind surfaces or using a depth buffer, so crossing and transparent lines do not establish surface occlusion.

A projected wireframe can contain at most 8192 vertices and 10000 edges, with ordinary frame limits also applied. Sphere ring counts are checked before generation, and curve-based artwork is sampled separately. For a large point cloud, choose the dedicated GPU representation rather than constructing 100000 SVG elements.

## A spatial construction inside a normal scene

```js
const region = drawing.space({camera: perspectiveCamera({z: 600}, {
  width: drawing.width, height: drawing.height,
})});
const globe = region.sphereLines({radius: 100});
globe.to(0, {rotationY: Math.PI}, {duration: 4});

const map = region.surface({mapping: 'equirectangular', radius: 100});
map.to(1, {wrap: 1}, {duration: 3});
```

The line-art `space` holds `points`, `polyline`, `mesh`, `box`, `sphereLines`, `extrude` and `surface` constructions. Geometry is captured, while x/y/z, rotationX/rotationY/rotation, scaleX/Y/Z and `wrap` are scene parameters. Its handles expose `set`, atomic multi-property `to`, `bind`, `unbind`, `parameters`, `node` and pure `sample(time)`. Bindings use this scene's inputs and numeric validation. The player's clock handles playback and reverse seeks.

`mesh({vertices,faces})` extracts unique polygon edges without filling, shading or tessellating faces. `extrude(points,depth)` adds front, back and connecting contour edges without certifying a watertight solid. Use `surface` for a latitude-longitude grid whose named points interpolate from a flat plane at `wrap:0` to a sphere at `wrap:1`. Intermediate points move in Cartesian coordinates, so the deformation does not preserve area or rule out self-intersections. For small point sets, `points` draws zero-length strokes with round caps.

Match the spatial camera viewport to the scene's authored dimensions, then use a 2D camera or responsive composition to fit that projection into the display. Each object becomes one scene path with at most 5000 edges. `maxObjects` defaults to 128 and cannot exceed 128. Calling `region.geometry(time)` returns merged world-space wireframe data under the standalone geometry limits. A solid renderer needs the underlying geometry and transforms rather than the projected path, which is already 2D.

## GPU and optional peer

See [WebGL points/lines](webgl-points.md) for the first-party shader/buffer contract, resource limits, context loss and measured tests. See [spatial/three.js](spatial-three.md) for camera, quaternion/picking and optional solid-renderer APIs.

The locally tested Three.js version is 0.186.1. Native examples do not install or load it. Verification uses an isolated copy and records its actual revision, so support for another revision needs measurement rather than an inference from a package version range. Three.js remains separate from native scene evaluation.

Frame rate, precision and memory measurements describe particular fixtures and devices. GPU rendering alone does not guarantee a faster result. Include buffer uploads, object allocations and context restoration when measuring an adapter, because an inefficient bridge can dominate the renderer's cost.