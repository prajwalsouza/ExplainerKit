import { assert, number, options, KitError } from '../core/validate.js';
import { compose3D, multiply3D, matrix3D, transform3D, identity3D } from '../spatial/matrix.js';
import { quaternionMatrix } from '../spatial/quaternion.js';

function unsupported(feature, message) {
  const e = new KitError('GLTF_UNSUPPORTED', message);
  e.capability = feature;
  throw e;
}
function integer(v, name, min, max) {
  number(v, name, min, max);
  assert(Number.isInteger(v), 'GLTF_INVALID', `${name} must be an integer.`);
  return v;
}
function bytes(input, maxBytes, label) {
  assert(
    input instanceof ArrayBuffer || (ArrayBuffer.isView(input) && input.buffer instanceof ArrayBuffer),
    'GLTF_INVALID',
    `${label} must be an ArrayBuffer or typed byte view.`,
  );
  const view =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  assert(view.byteLength <= maxBytes, 'RESOURCE_LIMIT', `${label} exceeds the byte budget.`);
  return view.slice();
}
function copyDocument(value, maxText, depth = 0, budget = { values: 0 }) {
  assert(depth <= 24 && ++budget.values <= 200000, 'RESOURCE_LIMIT', 'glTF JSON exceeds nesting/value limits.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return number(value, 'glTF JSON number', -1e100, 1e100);
  if (typeof value === 'string') {
    assert(value.length <= maxText, 'RESOURCE_LIMIT', 'glTF text exceeds the document byte envelope.');
    return value;
  }
  assert(
    value &&
      typeof value === 'object' &&
      (Array.isArray(value) ||
        Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
    'GLTF_INVALID',
    'glTF JSON must contain declarative plain data.',
  );
  const array = Array.isArray(value);
  if (array)
    assert(
      value.length <= 200000 && Reflect.ownKeys(value).length === value.length + 1,
      'GLTF_INVALID',
      'glTF arrays must be dense indexed values.',
    );
  const result = array ? [] : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    const d = Object.getOwnPropertyDescriptor(value, key);
    assert(
      typeof key === 'string' &&
        d?.enumerable &&
        'value' in d &&
        !['__proto__', 'constructor', 'prototype'].includes(key),
      'GLTF_INVALID',
      'glTF properties must be enumerable values without accessors or reserved keys.',
    );
    if (array)
      assert(
        /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length,
        'GLTF_INVALID',
        'glTF arrays need indexed values.',
      );
    result[key] = copyDocument(d.value, maxText, depth + 1, budget);
  }
  if (array)
    assert(
      result.length === value.length && Object.keys(result).length === value.length,
      'GLTF_INVALID',
      'glTF arrays cannot contain holes.',
    );
  return Object.freeze(result);
}
function json(text, maxBytes) {
  let result;
  try {
    result = JSON.parse(text);
  } catch (cause) {
    const e = new KitError('GLTF_INVALID', 'glTF JSON cannot be parsed.');
    e.cause = cause;
    throw e;
  }
  return copyDocument(result, maxBytes);
}
function decode(input) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new KitError('GLTF_INVALID', 'glTF JSON must be valid UTF-8.');
  }
}
function documentInput(input, maxBytes) {
  if (typeof input === 'string') {
    assert(input.length <= maxBytes, 'RESOURCE_LIMIT', 'glTF JSON exceeds the byte budget.');
    return { document: json(input, maxBytes), binary: null, container: 'gltf' };
  }
  if (!(input instanceof ArrayBuffer) && !ArrayBuffer.isView(input))
    return { document: copyDocument(input, maxBytes), binary: null, container: 'gltf' };
  const data = bytes(input, maxBytes, 'glTF container'),
    view = new DataView(data.buffer);
  if (data.length < 4 || view.getUint32(0, true) !== 0x46546c67)
    return { document: json(decode(data), maxBytes), binary: null, container: 'gltf' };
  assert(
    data.length >= 20 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === data.length,
    'GLTF_INVALID',
    'GLB needs version 2 and an exact declared container length.',
  );
  let offset = 12,
    document = null,
    binary = null,
    index = 0;
  while (offset < data.length) {
    assert(offset + 8 <= data.length, 'GLTF_INVALID', 'GLB chunk header is truncated.');
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    offset += 8;
    assert(
      length % 4 === 0 && offset + length <= data.length,
      'GLTF_INVALID',
      'GLB chunks must be aligned and fit the container.',
    );
    const chunk = data.subarray(offset, offset + length);
    offset += length;
    if (index === 0) assert(type === 0x4e4f534a, 'GLTF_INVALID', 'The first GLB chunk must contain JSON.');
    if (type === 0x4e4f534a) {
      assert(document === null, 'GLTF_INVALID', 'GLB accepts one JSON chunk.');
      document = json(decode(chunk), maxBytes);
    } else if (type === 0x004e4942) {
      assert(binary === null, 'GLTF_INVALID', 'GLB accepts one BIN chunk.');
      binary = chunk;
    } else unsupported('chunk', 'This importer does not interpret unknown GLB chunk types.');
    index++;
  }
  assert(document !== null, 'GLTF_INVALID', 'GLB JSON is missing.');
  return { document, binary, container: 'glb' };
}
function list(value, name, max = 10000) {
  assert(Array.isArray(value) && value.length <= max, 'RESOURCE_LIMIT', `${name} must be a bounded array.`);
  return value;
}
function record(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'GLTF_INVALID', `${label} must be a record.`);
  return value;
}
function vec(value, length, label, fallback) {
  const result = value ?? fallback;
  assert(Array.isArray(result) && result.length === length, 'GLTF_INVALID', `${label} needs ${length} values.`);
  return result.map((v) => number(v, label, -1e7, 1e7));
}
function noExtensions(value, label) {
  if (value && Object.keys(value).length)
    unsupported('extension', `${label} has an extension this geometry-only importer does not interpret.`);
}
function uriBytes(uri, provided, maxBytes) {
  assert(
    typeof uri === 'string' &&
      uri.length > 0 &&
      uri.length <= (uri.startsWith('data:') ? Math.ceil(maxBytes / 3) * 4 + 100 : 4096) &&
      !/[\u0000-\u0020\\]/.test(uri),
    'GLTF_INVALID',
    'Buffer URIs must be bounded strings without controls, spaces or backslashes.',
  );
  if (uri.startsWith('data:')) {
    const match = /^data:application\/(?:octet-stream|gltf-buffer);base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
    assert(
      match && match[1].length % 4 === 0,
      'GLTF_INVALID',
      'Only bounded base64 octet-stream/gltf-buffer data URIs are supported.',
    );
    assert((match[1].length / 4) * 3 <= maxBytes + 2, 'RESOURCE_LIMIT', 'Embedded buffer exceeds the byte budget.');
    let decoded;
    try {
      decoded = atob(match[1]);
    } catch {
      throw new KitError('GLTF_INVALID', 'Embedded buffer has malformed base64.');
    }
    return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  }
  let decoded;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    throw new KitError('GLTF_INVALID', 'Buffer URI has malformed percent encoding.');
  }
  assert(
    !/^[a-z][a-z0-9+.-]*:/i.test(decoded) &&
      !decoded.startsWith('/') &&
      !decoded.startsWith('\\') &&
      !/[\u0000-\u0020]/.test(decoded) &&
      !decoded.split('/').includes('..'),
    'GLTF_UNSAFE_URI',
    'Only explicit relative resource names are accepted; no schemes, traversal or automatic fetch.',
  );
  assert(provided.has(uri), 'GLTF_BUFFER_MISSING', `Supply bytes explicitly for buffer ${uri}.`);
  return bytes(provided.get(uri), maxBytes, 'External buffer');
}

/** Static glTF2/GLB geometry. Edges by default; optional triangle indices. Never fetches. */
export function importGLTF(input, spec = {}) {
  options(
    spec,
    ['lines', 'triangles', 'buffers', 'scene', 'maxBytes', 'maxVertices', 'maxEdges', 'maxIndices'],
    'glTF import',
  );
  assert((spec.lines ?? 'edges') === 'edges', 'GLTF_UNSUPPORTED', 'This importer produces triangle edges only.');
  assert(
    spec.triangles === undefined || typeof spec.triangles === 'boolean',
    'GLTF_INVALID',
    'triangles must be boolean.',
  );
  const maxBytes = integer(spec.maxBytes ?? 16 * 1024 * 1024, 'byte budget', 1, 64 * 1024 * 1024),
    maxVertices = integer(spec.maxVertices ?? 8192, 'vertex budget', 1, 65536),
    maxEdges = integer(spec.maxEdges ?? 10000, 'edge budget', 1, 200000),
    provided = new Map();
  const maxIndices = integer(spec.maxIndices ?? 600000, 'index work budget', 3, 6000000);
  let indexWork = 0;
  if (spec.buffers !== undefined) {
    options(spec.buffers, Object.keys(spec.buffers), 'provided buffers');
    for (const key of Object.keys(spec.buffers)) provided.set(key, spec.buffers[key]);
  }
  const parsed = documentInput(input, maxBytes),
    doc = parsed.document;
  assert(doc && typeof doc === 'object' && !Array.isArray(doc), 'GLTF_INVALID', 'glTF needs a JSON object.');
  record(doc.asset, 'asset');
  assert(doc.asset.version === '2.0', 'GLTF_INVALID', 'This importer requires asset.version 2.0.');
  if (doc.asset.minVersion && doc.asset.minVersion !== '2.0')
    unsupported('version', 'This asset requires a newer glTF version.');
  if ((doc.extensionsRequired ?? []).length)
    unsupported('requiredExtension', 'Required glTF extensions need a dedicated decoder.');
  if (list(doc.animations ?? [], 'animations', 1024).length)
    unsupported('animation', 'Animated glTF needs an explicit animation pipeline; this import is static.');
  if (list(doc.skins ?? [], 'skins', 1024).length)
    unsupported('skin', 'Skinned glTF requires skin/joint evaluation, not a static edge approximation.');
  const buffers = list(doc.buffers ?? [], 'buffers', 128),
    bufferViews = list(doc.bufferViews ?? [], 'buffer views'),
    accessors = list(doc.accessors ?? [], 'accessors'),
    meshes = list(doc.meshes ?? [], 'meshes'),
    nodes = list(doc.nodes ?? [], 'nodes'),
    scenes = list(doc.scenes ?? [], 'scenes', 128);
  let byteTotal = 0;
  const loaded = buffers.map((b, i) => {
    record(b, 'buffer');
    const size = integer(b.byteLength, 'buffer byteLength', 1, maxBytes);
    noExtensions(b.extensions, 'Buffer');
    let data;
    if (b.uri !== undefined) data = uriBytes(b.uri, provided, maxBytes - byteTotal);
    else if (i === 0 && parsed.binary) {
      data = parsed.binary;
      assert(data.length - size <= 3, 'GLTF_INVALID', 'GLB BIN padding exceeds three bytes.');
    } else {
      assert(provided.has(String(i)), 'GLTF_BUFFER_MISSING', `Supply bytes for URI-less buffer index ${i}.`);
      data = bytes(provided.get(String(i)), maxBytes - byteTotal, 'Indexed buffer');
    }
    assert(data.length >= size, 'GLTF_INVALID', 'Buffer is shorter than its declared byteLength.');
    byteTotal += data.length;
    assert(byteTotal <= maxBytes, 'RESOURCE_LIMIT', 'Combined buffer data exceeds the byte budget.');
    return data.subarray(0, size);
  });
  const cache = new Map();
  function accessor(index, kind) {
    integer(index, 'accessor index', 0, accessors.length - 1);
    const key = `${index}:${kind}`;
    if (cache.has(key)) return cache.get(key);
    const a = record(accessors[index], 'accessor');
    if (a.sparse !== undefined)
      unsupported('sparseAccessor', 'Sparse accessors require a dedicated materialization step.');
    noExtensions(a.extensions, 'Accessor');
    assert(
      a.normalized === undefined || a.normalized === false,
      'GLTF_UNSUPPORTED',
      'Normalized/quantized accessors are not supported.',
    );
    const components = kind === 'position' ? 3 : 1,
      types = kind === 'position' ? [5126] : [5121, 5123, 5125];
    assert(
      a.type === (kind === 'position' ? 'VEC3' : 'SCALAR') && types.includes(a.componentType),
      'GLTF_UNSUPPORTED',
      'Positions require FLOAT VEC3; triangle indices require unsigned SCALAR.',
    );
    const count = integer(a.count, 'accessor count', 1, kind === 'position' ? 65536 : 600000),
      viewIndex = integer(a.bufferView, 'bufferView index', 0, bufferViews.length - 1),
      b = record(bufferViews[viewIndex], 'buffer view');
    noExtensions(b.extensions, 'Buffer view');
    const buffer = loaded[integer(b.buffer, 'buffer index', 0, loaded.length - 1)],
      componentBytes = a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4,
      elementBytes = components * componentBytes,
      viewOffset = integer(b.byteOffset ?? 0, 'bufferView offset', 0, buffer.length),
      viewLength = integer(b.byteLength, 'bufferView length', 0, buffer.length),
      offset = integer(a.byteOffset ?? 0, 'accessor offset', 0, viewLength),
      stride = b.byteStride === undefined ? elementBytes : integer(b.byteStride, 'bufferView stride', 4, 252);
    assert(
      viewOffset + viewLength <= buffer.length &&
        stride >= elementBytes &&
        stride % componentBytes === 0 &&
        (viewOffset + offset) % componentBytes === 0 &&
        offset % componentBytes === 0 &&
        offset + (count - 1) * stride + elementBytes <= viewLength,
      'GLTF_INVALID',
      'Accessor offsets/stride/count exceed or misalign their declared buffer view.',
    );
    if (kind === 'index') assert(b.byteStride === undefined, 'GLTF_INVALID', 'Index buffers cannot have byteStride.');
    if (b.target !== undefined)
      assert(
        b.target === (kind === 'position' ? 34962 : 34963),
        'GLTF_INVALID',
        'Buffer view target does not match its accessor usage.',
      );
    const data = new DataView(buffer.buffer, buffer.byteOffset + viewOffset, viewLength),
      read =
        a.componentType === 5126
          ? 'getFloat32'
          : a.componentType === 5121
            ? 'getUint8'
            : a.componentType === 5123
              ? 'getUint16'
              : 'getUint32';
    const output = Array.from({ length: count }, (_, i) => {
      const values = Array.from({ length: components }, (local_1, j) =>
        data[read](offset + i * stride + j * componentBytes, true),
      );
      if (kind === 'position') {
        values.forEach((v) => number(v, 'glTF position', -1e7, 1e7));
        return Object.freeze({ x: values[0], y: values[1], z: values[2] });
      }
      return values[0];
    });
    cache.set(key, Object.freeze(output));
    return cache.get(key);
  }
  const parents = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    assert(node && typeof node === 'object' && !Array.isArray(node), 'GLTF_INVALID', 'A node must be a record.');
    noExtensions(node.extensions, 'Node');
    if (node.skin !== undefined) unsupported('skin', 'Node skin references require skeletal evaluation.');
    if (node.weights !== undefined) unsupported('morph', 'Node morph weights require morph evaluation.');
    for (const child of list(node.children ?? [], 'node children')) {
      integer(child, 'child node index', 0, nodes.length - 1);
      assert(!parents.has(child), 'GLTF_INVALID', 'A glTF node cannot have multiple parents.');
      parents.set(child, i);
    }
  }
  const graphSeen = new Set(),
    visiting = new Set();
  function graph(index, depth) {
    assert(depth <= 64, 'RESOURCE_LIMIT', 'glTF hierarchy exceeds 64 levels.');
    assert(!visiting.has(index), 'GLTF_INVALID', 'glTF node hierarchy contains a cycle.');
    if (graphSeen.has(index)) return;
    visiting.add(index);
    for (const child of nodes[index].children ?? []) graph(child, depth + 1);
    visiting.delete(index);
    graphSeen.add(index);
  }
  nodes.forEach((_, i) => graph(i, 0));
  function nodeMatrix(node) {
    assert(
      node.matrix === undefined ||
        (node.translation === undefined && node.rotation === undefined && node.scale === undefined),
      'GLTF_INVALID',
      'A node must choose matrix or TRS.',
    );
    if (node.matrix !== undefined) {
      const m = matrix3D(node.matrix);
      assert(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'GLTF_INVALID', 'Node matrices must be affine.');
      return Object.freeze(m);
    }
    const t = vec(node.translation, 3, 'translation', [0, 0, 0]),
      r = vec(node.rotation, 4, 'rotation', [0, 0, 0, 1]),
      s = vec(node.scale, 3, 'scale', [1, 1, 1]);
    assert(Math.abs(Math.hypot(...r) - 1) <= 1e-4, 'GLTF_INVALID', 'glTF node quaternions must be normalized.');
    return multiply3D(
      multiply3D(compose3D({ x: t[0], y: t[1], z: t[2] }), quaternionMatrix({ x: r[0], y: r[1], z: r[2], w: r[3] })),
      compose3D({ scaleX: s[0], scaleY: s[1], scaleZ: s[2] }),
    );
  }
  let selected = null,
    roots;
  if (scenes.length) {
    selected = integer(spec.scene ?? doc.scene ?? 0, 'scene index', 0, scenes.length - 1);
    roots = list(record(scenes[selected], 'scene').nodes ?? [], 'scene roots');
  } else {
    assert(spec.scene === undefined, 'GLTF_INVALID', 'This document has no indexed scenes.');
    roots = nodes.map((_, i) => i).filter((i) => !parents.has(i));
  }
  const vertices = [],
    faces = [],
    edges = [],
    edgeKeys = new Set(),
    importedNodes = [],
    visited = new Set();
  let triangles = 0,
    primitives = 0;
  function visit(index, parent, depth) {
    integer(index, 'scene node index', 0, nodes.length - 1);
    assert(
      !visited.has(index) && depth <= 64,
      'GLTF_INVALID',
      'Selected scene repeats a node or exceeds hierarchy limits.',
    );
    visited.add(index);
    const node = nodes[index],
      matrix = multiply3D(parent, nodeMatrix(node)),
      firstVertex = vertices.length,
      firstEdge = edges.length,
      firstTriangle = faces.length;
    if (node.mesh !== undefined) {
      const mesh = record(meshes[integer(node.mesh, 'mesh index', 0, meshes.length - 1)], 'mesh');
      noExtensions(mesh.extensions, 'Mesh');
      if (mesh.weights !== undefined) unsupported('morph', 'Mesh morph weights require morph evaluation.');
      for (const primitive of list(mesh.primitives, 'mesh primitives', 1024)) {
        record(primitive, 'primitive');
        noExtensions(primitive.extensions, 'Mesh primitive');
        if (primitive.targets !== undefined)
          unsupported('morph', 'Morph targets require a dedicated deformation pipeline.');
        assert(
          (primitive.mode ?? 4) === 4,
          'GLTF_UNSUPPORTED',
          'This edge importer accepts TRIANGLES primitives only.',
        );
        assert(
          primitive.attributes && Object.hasOwn(primitive.attributes, 'POSITION'),
          'GLTF_INVALID',
          'Triangle geometry needs POSITION.',
        );
        const positions = accessor(primitive.attributes.POSITION, 'position');
        assert(
          vertices.length + positions.length <= maxVertices,
          'RESOURCE_LIMIT',
          'Imported instances exceed the vertex budget.',
        );
        const base = vertices.length;
        for (const p of positions) {
          const q = transform3D(matrix, p);
          for (const v of Object.values(q)) number(v, 'transformed import position', -1e7, 1e7);
          vertices.push(q);
        }
        const indices =
          primitive.indices === undefined
            ? Array.from({ length: positions.length }, (_, i) => i)
            : accessor(primitive.indices, 'index');
        assert(indices.length % 3 === 0, 'GLTF_INVALID', 'Triangle index/vertex count must be a multiple of three.');
        indexWork += indices.length;
        assert(
          indexWork <= maxIndices,
          'RESOURCE_LIMIT',
          'Imported triangle indices exceed the aggregate work budget.',
        );
        for (const i of indices) integer(i, 'triangle vertex index', 0, positions.length - 1);
        for (let i = 0; i < indices.length; i += 3) {
          triangles++;
          if (spec.triangles)
            faces.push(Object.freeze([base + indices[i], base + indices[i + 1], base + indices[i + 2]]));
          for (const [a, b] of [
            [indices[i], indices[i + 1]],
            [indices[i + 1], indices[i + 2]],
            [indices[i + 2], indices[i]],
          ]) {
            if (a === b) continue;
            const x = base + Math.min(a, b),
              y = base + Math.max(a, b),
              key = `${x}:${y}`;
            if (edgeKeys.has(key)) continue;
            assert(edges.length < maxEdges, 'RESOURCE_LIMIT', 'Imported triangle edges exceed the edge budget.');
            edgeKeys.add(key);
            edges.push(Object.freeze([x, y]));
          }
        }
        primitives++;
      }
    }
    importedNodes.push(
      Object.freeze({
        id: `gltf-node-${index}`,
        index,
        name: typeof node.name === 'string' ? node.name : null,
        matrix,
        firstVertex,
        vertexCount: vertices.length - firstVertex,
        firstEdge,
        edgeCount: edges.length - firstEdge,
        ...(spec.triangles ? { firstTriangle, triangleCount: faces.length - firstTriangle } : {}),
      }),
    );
    for (const child of node.children ?? []) visit(child, matrix, depth + 1);
  }
  for (const root of roots) visit(root, identity3D, 0);
  assert(primitives > 0, 'GLTF_EMPTY', 'The selected scene contains no supported triangle mesh.');
  return Object.freeze({
    geometry: Object.freeze({
      vertices: Object.freeze(vertices),
      edges: Object.freeze(edges),
      ...(spec.triangles ? { triangles: Object.freeze(faces) } : {}),
    }),
    nodes: Object.freeze(importedNodes),
    diagnostics: Object.freeze({
      format: parsed.container,
      scene: selected,
      sourceNodes: visited.size,
      primitives,
      triangles,
      vertices: vertices.length,
      edges: edges.length,
      bufferBytes: byteTotal,
      lines: 'edges',
      materials: 'notImported',
      animations: false,
    }),
  });
}
