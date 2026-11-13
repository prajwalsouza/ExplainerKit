# Bring a static model into line art

`importGLTF` reads the supported subset of glTF 2.0 or its binary form, GLB. It returns vertices in world coordinates and triangle edges without a direction. It does not require Three.js, load a library, fetch a URI or create a GPU context. The format and binary layout follow the [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), especially nodes/transforms, buffers/views/accessors and GLB chunks.

This is a geometry importer for SVG/Canvas/WebGL line art. Materials, texture appearance, lighting, skeletal animation and photorealistic rendering belong to separate pipelines. A fully prepared Three/glTF scene may instead enter the [optional Three renderer](spatial-three.md#bring-an-existing-threegltf-scene) through explicit caller-owned assets.

## Import supplied bytes

```js
import {importGLTF} from 'explainerkit/import/gltf';
import {projectLines, perspectiveCamera} from 'explainerkit/spatial';

const imported = importGLTF(selectedGLBBytes, {lines: 'edges'});
const camera = perspectiveCamera({z: 5, near: .01, far: 100});
const frame = projectLines(imported.geometry, camera);
svgRenderer.render(frame);
```

The application acquires the selected file's bytes explicitly, for example with `await file.arrayBuffer()`. The importer itself performs no file picker, drag/drop, network, permissions or persistence action.

`input` can be a plain declarative glTF JSON object, a JSON string, UTF-8 JSON bytes, or GLB bytes supplied as an ArrayBuffer/typed view. Byte views honor their byteOffset/byteLength and are captured before reading. JSON inputs reject accessors, executable/custom instances, reserved prototype keys, sparse arrays, excessive nesting and excessive value counts.

For a glTF document that refers to separate buffers, supply their bytes under exactly the names used in the document. The importer looks up those names in `buffers` rather than downloading them.

```js
const imported = importGLTF(gltfJSON, {
  lines: 'edges',
  buffers: {'geometry.bin': geometryBytes},
  scene: 0,
});
```

Relative buffer URI names are looked up in `buffers`; they are never fetched. URI-less JSON buffers can be supplied by stringified buffer index, such as `buffers:{0:bytes}`. A GLB's first URI-less buffer uses its BIN chunk. Embedded `data:application/octet-stream;base64,…` and `data:application/gltf-buffer;base64,…` buffers are decoded locally within the same resource envelope.

The supported external names exclude URI schemes, absolute paths, traversal, controls, spaces and backslashes. `javascript:`, `file:`, HTTP URLs and encoded traversal reject `GLTF_UNSAFE_URI`, even if a resource was supplied under that key. This is a deliberately narrow local-resource contract, not a claim that those relative-name restrictions are required by the complete glTF specification. If an application fetches resources elsewhere, give the importer a clean local resource name in its prepared document and supply the already acquired bytes explicitly.

## Geometry and transforms

The importer accepts the geometry and transform forms listed below. A node describes where geometry sits in the scene hierarchy, while an accessor describes how a buffer’s numeric values are read.

- `asset.version:'2.0'`; a valid optional `minVersion:'2.0'`.
- Static node hierarchies with parent composition and either a column-major affine `matrix` or translation/quaternion rotation/scale. Combining matrix and TRS rejects. Node quaternions must be normalized within 1e-4; accepted rounding is normalized during matrix construction.
- Mesh primitives in TRIANGLES mode (4, also the glTF default).
- POSITION accessors of type FLOAT VEC3, including aligned interleaved/strided buffer views.
- Optional unsigned SCALAR indices may use BYTE (5121), SHORT (5123) or INT (5125). Their views must store consecutive indices without a stride. Triangle positions without indices are also supported.
- Exact byte offsets, declared lengths, component alignment, stride and count checks before reads. Binary data is little-endian.
- Multiple nodes/mesh instances and multiple selected-scene primitives, within one bounded output.

The importer preserves glTF's right-handed, y-up coordinates and supplied unit magnitudes; it does not fit the model into a viewport or silently rescale metres to pixels. World transforms are baked into output positions. Each imported node record retains its world matrix and direct primitive ranges for provenance. A grouping node can have zero direct vertices/edges even when its children contain geometry.

By default the document's scene is selected, or scene 0 when scenes exist without a default. `scene` explicitly selects another index. If the document has no scene array, all parentless nodes are selected. Cycles, multiple parents and repeated nodes inside the selected scene reject. A selected scene with no supported triangle mesh rejects `GLTF_EMPTY`.

Every triangle contributes its three undirected index edges. Shared triangle edges within a primitive are emitted once; self-index edges are skipped. This includes internal triangulation diagonals and back-side edges. It is **not** a silhouette, crease-angle, hidden-line or feature-edge extractor. Vertices are not welded by approximate coordinate equality, and distinct primitives/instances retain distinct index ranges. A model with duplicated seam vertices may therefore retain coincident lines. No source topology is guessed away.

## Result

For mesh styling or solid rendering, opt into `importGLTF(bytes, {triangles:true})`.
The result additionally contains immutable `geometry.triangles`, one `[a,b,c]`
index triple per authored triangle, referencing the same world-space vertices.
Each node then also exposes `firstTriangle` and `triangleCount` for its direct
primitives. Output is bounded by the existing aggregate `maxIndices` envelope.
The default result remains unchanged. This does not import materials, skinning,
textures, animations, compression extensions or a rendering engine.

This importer reads only the formats described above. Readers for other formats,
such as OBJ, STL or 3DS, are not part of it.

```js
{
  geometry: {vertices: [{x,y,z}, …], edges: [[a,b], …]},
  nodes: [{
    id, index, name, matrix,
    firstVertex, vertexCount, firstEdge, edgeCount,
  }, …],
  diagnostics: {
    format, scene, sourceNodes, primitives, triangles,
    vertices, edges, bufferBytes,
    lines: 'edges', materials: 'notImported', animations: false,
  },
}
```

The result is immutable and does not retain live views into supplied buffers. IDs use `gltf-node-<source index>`; names are optional metadata rather than unique identity. `geometry` is the plain vertex/edge structure consumed by first-party line renderers. The node ranges refer to that node's directly imported primitives, not a flattened count of all descendants.

## Resource limits and errors

| Option / limit | Default | Maximum |
| --- | --- | --- |
| `lines` | `edges` | Only this mode is implemented |
| `maxBytes` | 16 MiB | 64 MiB input container/document envelope and combined actual decoded/supplied buffer bytes |
| `maxVertices` | 8,192 | 65,536 output world-space vertices, counting instances |
| `maxEdges` | 10,000 | 200,000 deduplicated output edges |
| Nodes/views/accessors/meshes | Bounded arrays | 10,000 each; hierarchy depth ≤64 |
| Buffers/scenes | Bounded arrays | 128 each |
| Primitive list | Bounded array | 1,024 per mesh |
| Accessor count | According to kind | 65,536 positions; 600,000 index values |
| JSON structure | Declarative values | Depth ≤24 and 200,000 copied values |

Byte-based inputs are bounded before decoding. JSON strings are bounded in JavaScript string units before parsing; typed UTF-8 inputs provide the precise byte envelope. Embedded data URI text is included in that document envelope, so its base64 overhead reduces the available decoded payload unless a larger explicit budget is selected. Aggregate buffer accounting uses actual supplied/decoded byte lengths, not only declared lengths, to prevent many oversized buffers with small declarations bypassing the cap. GLB BIN padding is limited to three bytes beyond its declared first buffer.

Raising import geometry limits does not raise a downstream renderer's limits. The default matches the bounded CPU line-art model (8,192 vertices, 10,000 edges). Use an explicitly compatible dense renderer or reduce the model when importing more.

Malformed structure/chunks/layout produce `GLTF_INVALID` or the shared numeric/resource diagnostic. Missing explicit buffers produce `GLTF_BUFFER_MISSING`; unsafe names produce `GLTF_UNSAFE_URI`; excess resources produce `RESOURCE_LIMIT`. Required extensions, sparse/normalized/quantized accessors, compression, skins, morph targets/weights, animations, nontriangle primitives and unknown GLB chunks reject `GLTF_UNSUPPORTED`, with a named capability where applicable. This importer refuses to flatten an animated/skinned asset into an apparently equivalent static model.

Material, image, texture, sampler and camera appearance metadata are not imported by this edge-only contract; none of their resources is loaded. Unsupported geometry-affecting extensions on nodes/meshes/primitives/views/accessors reject rather than being ignored. This is a supported importer subset, not a complete glTF conformance validator or security certification for arbitrary GPU asset loaders.

## Verification

The native fixtures cover an indexed quad's five independent undirected edges, packed GLB parity, strided positions, parent quaternion/TRS composition, explicit matrices, separate mesh instances, scene selection, data URIs, supplied URI-less buffers and nonindexed triangles. Negative fixtures exercise truncated/misaligned ranges, short buffers, out-of-range indices, malformed GLB headers/chunks, hierarchy cycles/duplicates, conflicting transforms, unsupported compression/animation/skinning/morphing, unsafe URI names, actual-byte caps and getter rejection.

All calculations and decoding are first-party JavaScript and platform typed-array/TextDecoder/base64 APIs. No Three loader or other package is used. Dataset-scale import benchmarks, worker scheduling/cancellation, progressive loading, general extension decoders, materials/PBR, animated/skinned import, topology simplification and silhouette extraction remain separate work.
