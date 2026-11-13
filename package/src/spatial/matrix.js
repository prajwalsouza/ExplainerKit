import { assert, number, options } from '../core/validate.js';

const LIMIT = 1e100;
export const identity3D = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function matrix3D(value) {
  assert(
    Array.isArray(value) && value.length === 16,
    'INVALID_TRANSFORM',
    'A spatial matrix needs 16 column-major entries.',
  );
  return Array.from({ length: 16 }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(value, i);
    assert(d && 'value' in d, 'INVALID_TRANSFORM', 'Matrix entries must be dense values.');
    return number(d.value, `matrix[${i}]`, -LIMIT, LIMIT);
  });
}
function output(entries) {
  for (const v of entries) number(v, 'matrix result', -LIMIT, LIMIT);
  return Object.freeze(entries);
}
/** Column-major multiplication. A*B applies B before A. */
export function multiply3D(left, right) {
  const a = matrix3D(left),
    b = matrix3D(right),
    out = Array(16).fill(0);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  return output(out);
}
/** Pivoted Gauss–Jordan inverse; rejects a singular transform explicitly. */
export function inverse3D(value) {
  const a = matrix3D(value),
    rows = Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 8 }, (local_1, c) => (c < 4 ? a[c * 4 + r] : +(c - 4 === r))),
    );
  for (let i = 0; i < 4; i++) {
    let pivot = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(rows[r][i]) > Math.abs(rows[pivot][i])) pivot = r;
    assert(
      rows[pivot][i] !== 0 && Number.isFinite(rows[pivot][i]),
      'SINGULAR_TRANSFORM',
      'The spatial transform cannot be inverted at supported precision.',
    );
    [rows[i], rows[pivot]] = [rows[pivot], rows[i]];
    const divisor = rows[i][i];
    for (let c = 0; c < 8; c++) rows[i][c] /= divisor;
    for (let r = 0; r < 4; r++)
      if (r !== i) {
        const factor = rows[r][i];
        for (let c = 0; c < 8; c++) rows[r][c] -= factor * rows[i][c];
      }
  }
  return output(Array.from({ length: 16 }, (_, i) => rows[i % 4][4 + Math.floor(i / 4)]));
}
export function point3D(input, label = 'point') {
  options(input, ['x', 'y', 'z'], label);
  return {
    x: number(input.x ?? 0, `${label} x`, -LIMIT, LIMIT),
    y: number(input.y ?? 0, `${label} y`, -LIMIT, LIMIT),
    z: number(input.z ?? 0, `${label} z`, -LIMIT, LIMIT),
  };
}
/** Apply a full projective matrix, including homogeneous division. */
export function transform3D(matrix, position) {
  const m = matrix3D(matrix),
    p = point3D(position),
    w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  assert(Number.isFinite(w) && w !== 0, 'PROJECTION_AT_INFINITY', 'The point lies on a projective plane at infinity.');
  return Object.freeze({
    x: number((m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) / w, 'transformed x', -LIMIT, LIMIT),
    y: number((m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) / w, 'transformed y', -LIMIT, LIMIT),
    z: number((m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) / w, 'transformed z', -LIMIT, LIMIT),
  });
}
/** T * Rx * Ry * Rz * S, matching Three's intrinsic XYZ Euler convention. */
export function compose3D(spec = {}) {
  options(spec, ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation', 'scaleX', 'scaleY', 'scaleZ'], '3D transform');
  const x = number(spec.x ?? 0, 'x'),
    y = number(spec.y ?? 0, 'y'),
    z = number(spec.z ?? 0, 'z'),
    rx = number(spec.rotationX ?? 0, 'rotationX'),
    ry = number(spec.rotationY ?? 0, 'rotationY'),
    rz = number(spec.rotation ?? 0, 'rotation');
  const sx = number(spec.scaleX ?? 1, 'scaleX'),
    sy = number(spec.scaleY ?? 1, 'scaleY'),
    sz = number(spec.scaleZ ?? 1, 'scaleZ'),
    a = Math.cos(rx),
    b = Math.sin(rx),
    c = Math.cos(ry),
    d = Math.sin(ry),
    e = Math.cos(rz),
    f = Math.sin(rz);
  return output([
    c * e * sx,
    (a * f + b * d * e) * sx,
    (b * f - a * d * e) * sx,
    0,
    -c * f * sy,
    (a * e - b * d * f) * sy,
    (b * e + a * d * f) * sy,
    0,
    d * sz,
    -b * c * sz,
    a * c * sz,
    0,
    x,
    y,
    z,
    1,
  ]);
}
export function direction3D(value) {
  const p = point3D(value, 'direction'),
    length = Math.hypot(p.x, p.y, p.z);
  assert(length > 0, 'SINGULAR_TRANSFORM', 'A direction cannot be zero.');
  return Object.freeze({ x: p.x / length, y: p.y / length, z: p.z / length });
}
export function lookAt3D(eye, target, up = { x: 0, y: 1, z: 0 }) {
  const p = point3D(eye, 'eye'),
    t = point3D(target, 'target'),
    u = direction3D(up),
    z = direction3D({ x: p.x - t.x, y: p.y - t.y, z: p.z - t.z }),
    x = direction3D({ x: u.y * z.z - u.z * z.y, y: u.z * z.x - u.x * z.z, z: u.x * z.y - u.y * z.x }),
    y = { x: z.y * x.z - z.z * x.y, y: z.z * x.x - z.x * x.z, z: z.x * x.y - z.y * x.x };
  return output([x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, p.x, p.y, p.z, 1]);
}

/** Resolve a raw scene node's composed model transform without a renderer. */
export function worldMatrix3D(frame, id) {
  assert(frame && Array.isArray(frame.children), 'INVALID_FRAME', 'A spatial frame needs children.');
  assert(typeof id === 'string' && id.length > 0, 'INVALID_ID', 'Use a nonempty node ID.');
  const seen = new Set();
  let result = null;
  function visit(node, parent, depth) {
    assert(depth <= 64 && seen.size < 10000, 'RESOURCE_LIMIT', 'Spatial hierarchy exceeds its supported budget.');
    options(node, ['id', 'type', 'props', 'children'], 'spatial node');
    assert(typeof node.id === 'string' && node.id && !seen.has(node.id), 'DUPLICATE_ID', 'Spatial IDs must be unique.');
    seen.add(node.id);
    const p = node.props ?? {};
    options(p, Object.keys(p), 'spatial properties');
    if (
      (p.pivot !== undefined &&
        p.pivot !== null &&
        p.pivot !== 'origin' &&
        !(Array.isArray(p.pivot) && p.pivot.length === 2 && p.pivot.every((v) => v === 0))) ||
      (p.skewX ?? 0) !== 0 ||
      (p.skewY ?? 0) !== 0
    ) {
      const error = new Error('Spatial world matrices do not support geometry pivots or 2D skew.');
      error.code = 'UNSUPPORTED_TRANSFORM';
      error.capability = (p.skewX ?? 0) !== 0 || (p.skewY ?? 0) !== 0 ? 'transform.skew' : 'transform.pivot';
      throw error;
    }
    const spec = Object.fromEntries(
      ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation', 'scaleX', 'scaleY', 'scaleZ']
        .filter((k) => p[k] !== undefined)
        .map((k) => [k, p[k]]),
    );
    const world = multiply3D(parent, compose3D(spec));
    if (node.id === id) result = world;
    const children = node.children ?? [];
    assert(Array.isArray(children), 'INVALID_FRAME', 'Node children must be arrays.');
    for (const child of children) visit(child, world, depth + 1);
  }
  for (const node of frame.children) visit(node, identity3D, 0);
  assert(result, 'UNKNOWN_NODE', 'The spatial node is absent from this frame.');
  return result;
}
