import { assert, number, options, safeCopy } from '../core/validate.js';
import { compose3D, multiply3D, identity3D, matrix3D, transform3D } from './matrix.js';
import { requireCamera } from './camera.js';

/** A small immutable line-art model. Dense GPU buffers are a separate backend. */
export function wireframe(spec = {}) {
  options(spec, ['vertices', 'edges', 'normals'], 'wireframe');
  let vertices = safeCopy(spec.vertices);
  const edges = safeCopy(spec.edges);
  assert(
    Array.isArray(vertices) && vertices.length > 0 && vertices.length <= 8192,
    'RESOURCE_LIMIT',
    'Line-art supports 1–8192 vertices.',
  );
  assert(
    Array.isArray(edges) && edges.length <= 10000,
    'RESOURCE_LIMIT',
    'SVG/Canvas line-art supports at most 10000 edges.',
  );
  vertices = Object.freeze(
    vertices.map((p) => {
      options(p, ['x', 'y', 'z'], 'vertex');
      return Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((k) => [k, number(p[k] ?? 0, k)])));
    }),
  );
  edges.forEach((e) => {
    assert(
      Array.isArray(e) && e.length === 2 && e.every((v) => Number.isInteger(v) && v >= 0 && v < vertices.length),
      'INVALID_WIREFRAME',
      'Each edge needs two valid vertex indices.',
    );
  });
  if (spec.normals === undefined) return Object.freeze({ vertices, edges });
  // Optional outward surface normals, one per vertex, let projection fade or hide the far side.
  const normals = safeCopy(spec.normals);
  assert(
    Array.isArray(normals) && normals.length === vertices.length,
    'INVALID_WIREFRAME',
    'Give one normal per vertex.',
  );
  return Object.freeze({
    vertices,
    edges,
    normals: Object.freeze(
      normals.map((n) => {
        options(n, ['x', 'y', 'z'], 'normal');
        return Object.freeze({
          x: number(n.x ?? 0, 'normal x'),
          y: number(n.y ?? 0, 'normal y'),
          z: number(n.z ?? 0, 'normal z'),
        });
      }),
    ),
  });
}
export function boxLines(spec = {}) {
  options(spec, ['width', 'height', 'depth'], 'box lines');
  const w = number(spec.width ?? 100, 'box width', 1e-6, 1e5) / 2,
    h = number(spec.height ?? 100, 'box height', 1e-6, 1e5) / 2,
    d = number(spec.depth ?? 100, 'box depth', 1e-6, 1e5) / 2;
  const vertices = Array.from({ length: 8 }, (_, i) => ({ x: i & 1 ? w : -w, y: i & 2 ? h : -h, z: i & 4 ? d : -d })),
    edges = [];
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) edges.push([i, i | bit]);
  return wireframe({ vertices, edges });
}
export function sphereLines(spec = {}) {
  options(spec, ['radius', 'latitudes', 'longitudes', 'segments'], 'sphere lines');
  const radius = number(spec.radius ?? 100, 'sphere radius', 1e-6, 1e5),
    latitudes = number(spec.latitudes ?? 5, 'latitude count', 0, 32),
    longitudes = number(spec.longitudes ?? 8, 'longitude count', 1, 64),
    segments = number(spec.segments ?? 48, 'ring segments', 8, 128);
  assert(
    [latitudes, longitudes, segments].every(Number.isInteger),
    'INVALID_WIREFRAME',
    'Sphere line counts must be integers.',
  );
  assert(
    (latitudes + longitudes) * segments <= 8192,
    'RESOURCE_LIMIT',
    'Sphere line geometry exceeds the vertex budget.',
  );
  const vertices = [],
    edges = [];
  function ring(point) {
    const base = vertices.length;
    for (let i = 0; i < segments; i++) vertices.push(point((2 * Math.PI * i) / segments));
    for (let i = 0; i < segments; i++) edges.push([base + i, base + ((i + 1) % segments)]);
  }
  for (let i = 1; i <= latitudes; i++) {
    const phi = (Math.PI * i) / (latitudes + 1),
      r = radius * Math.sin(phi),
      y = radius * Math.cos(phi);
    ring((a) => ({ x: r * Math.cos(a), y, z: r * Math.sin(a) }));
  }
  for (let i = 0; i < longitudes; i++) {
    const phi = (Math.PI * i) / longitudes;
    ring((a) => ({
      x: radius * Math.sin(a) * Math.cos(phi),
      y: radius * Math.cos(a),
      z: radius * Math.sin(a) * Math.sin(phi),
    }));
  }
  return wireframe({
    vertices,
    edges,
    normals: vertices.map((p) => ({ x: p.x / radius, y: p.y / radius, z: p.z / radius })),
  });
}
const clipPoint = (m, p) => [
  m[0] * p.x + m[4] * p.y + m[8] * (p.z ?? 0) + m[12],
  m[1] * p.x + m[5] * p.y + m[9] * (p.z ?? 0) + m[13],
  m[2] * p.x + m[6] * p.y + m[10] * (p.z ?? 0) + m[14],
  m[3] * p.x + m[7] * p.y + m[11] * (p.z ?? 0) + m[15],
];
function clipSegment(left, right) {
  let a = left,
    b = right;
  for (const [axis, sign] of [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [2, 1],
    [2, -1],
  ]) {
    const fa = a[3] + sign * a[axis],
      fb = b[3] + sign * b[axis];
    if (fa < 0 && fb < 0) return null;
    if (fa < 0 || fb < 0) {
      const t = fa / (fa - fb),
        p = a.map((v, i) => v + (b[i] - v) * t);
      if (fa < 0) a = p;
      else b = p;
    }
  }
  return a[3] === 0 || b[3] === 0 ? null : [a, b];
}

/** Which side of a surface faces the camera: eye position for perspective, view direction for orthographic. */
function facing(camera, world) {
  const c = camera.matrixWorld,
    m = world;
  // Cofactor matrix of the model's linear part: normals stay perpendicular under nonuniform scale.
  const a = [m[0], m[1], m[2]],
    b = [m[4], m[5], m[6]],
    d = [m[8], m[9], m[10]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
    rows = [cross(b, d), cross(d, a), cross(a, b)];
  const det = a[0] * rows[0][0] + a[1] * rows[0][1] + a[2] * rows[0][2],
    sign = det < 0 ? -1 : 1;
  return (point, normal) => {
    const n = [0, 1, 2].map((i) => sign * (rows[0][i] * normal.x + rows[1][i] * normal.y + rows[2][i] * normal.z));
    const v = camera.type === 'perspective' ? [c[12] - point.x, c[13] - point.y, c[14] - point.z] : [c[8], c[9], c[10]];
    return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] >= 0;
  };
}

/**
 * Clip, project and classify every edge. With normals, an edge is on the back when the averaged
 * normal at its midpoint points away from the camera. Depth is distance along the view direction.
 */
export function projectSegments(geometry, camera, spec = {}) {
  options(spec, ['transform', 'matrix'], 'segment projection');
  requireCamera(camera);
  assert(!(spec.matrix && spec.transform), 'INVALID_TRANSFORM', 'Use a matrix or transform, not both.');
  const model = wireframe(geometry),
    world = spec.matrix ? matrix3D(spec.matrix) : spec.transform ? compose3D(spec.transform) : identity3D,
    projection = multiply3D(camera.viewProjectionMatrix, world),
    view = multiply3D(camera.viewMatrix, world);
  const width = camera.viewport.width,
    height = camera.viewport.height,
    front = model.normals ? facing(camera, world) : null;
  const points = model.vertices.map((p) => clipPoint(projection, p)),
    depths = model.vertices.map((p) => -transform3D(view, p).z),
    segments = [];
  model.edges.forEach(([i, j], index) => {
    const clipped = clipSegment(points[i], points[j]);
    if (!clipped) return;
    const screen = clipped.map((p) => ({ x: ((p[0] / p[3] + 1) * width) / 2, y: ((1 - p[1] / p[3]) * height) / 2 }));
    let back = false;
    if (front) {
      const a = model.vertices[i],
        b = model.vertices[j],
        na = model.normals[i],
        nb = model.normals[j];
      back = !front(transform3D(world, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }), {
        x: na.x + nb.x,
        y: na.y + nb.y,
        z: na.z + nb.z,
      });
    }
    segments.push({ index, screen, depth: (depths[i] + depths[j]) / 2, back });
  });
  return segments;
}

/** CPU line-art projection, frustum clipping and painter depth order; no WebGL. */
export function projectLines(geometry, camera, spec = {}) {
  options(
    spec,
    ['transform', 'matrix', 'stroke', 'strokeWidth', 'opacity', 'sortDepth', 'id', 'backfaces', 'backOpacity'],
    'line-art projection',
  );
  requireCamera(camera);
  const id = spec.id ?? 'wire';
  assert(typeof id === 'string' && id.length > 0 && id.length <= 200, 'INVALID_ID', 'Use a short line-art ID.');
  const strokeWidth = number(spec.strokeWidth ?? 1, 'wire stroke width', 0, 1e5),
    opacity = number(spec.opacity ?? 1, 'wire opacity', 0, 1),
    sortDepth = spec.sortDepth ?? true;
  assert(typeof sortDepth === 'boolean', 'INVALID_WIREFRAME', 'sortDepth must be boolean.');
  const backfaces = backfaceMode(spec.backfaces),
    backOpacity = number(spec.backOpacity ?? 0.2, 'back opacity', 0, 1);
  const segments = projectSegments(geometry, camera, {
    ...(spec.matrix ? { matrix: spec.matrix } : {}),
    ...(spec.transform ? { transform: spec.transform } : {}),
  }).filter((s) => !(s.back && backfaces === 'hide'));
  if (sortDepth) segments.sort((a, b) => b.depth - a.depth || a.index - b.index);
  const children = segments.map((s) =>
    Object.freeze({
      id: `${id}:${s.index}`,
      type: 'line',
      props: Object.freeze({
        x1: s.screen[0].x,
        y1: s.screen[0].y,
        x2: s.screen[1].x,
        y2: s.screen[1].y,
        fill: 'none',
        stroke: spec.stroke ?? '#1b343c',
        strokeWidth,
        opacity: s.back && backfaces === 'fade' ? opacity * backOpacity : opacity,
      }),
      children: Object.freeze([]),
    }),
  );
  return Object.freeze({
    width: camera.viewport.width,
    height: camera.viewport.height,
    children: Object.freeze(children),
  });
}
export function backfaceMode(value = 'show') {
  assert(['show', 'fade', 'hide'].includes(value), 'INVALID_WIREFRAME', 'backfaces must be show, fade or hide.');
  return value;
}
