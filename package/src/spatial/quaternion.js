import { assert, number, options } from '../core/validate.js';
import { direction3D, transform3D } from './matrix.js';

/** A normalized right-handed quaternion. Invalid or zero orientations reject. */
export function quaternion(spec = {}) {
  options(spec, ['x', 'y', 'z', 'w'], 'quaternion');
  const q = {
      x: number(spec.x ?? 0, 'quaternion x', -1e100, 1e100),
      y: number(spec.y ?? 0, 'quaternion y', -1e100, 1e100),
      z: number(spec.z ?? 0, 'quaternion z', -1e100, 1e100),
      w: number(spec.w ?? 1, 'quaternion w', -1e100, 1e100),
    },
    length = Math.hypot(q.x, q.y, q.z, q.w);
  assert(length > 0, 'INVALID_QUATERNION', 'A quaternion needs nonzero magnitude.');
  return Object.freeze({ x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length });
}
export function quaternionFromEuler(spec = {}) {
  options(spec, ['rotationX', 'rotationY', 'rotation'], 'Euler angles');
  const x = number(spec.rotationX ?? 0, 'rotationX') / 2,
    y = number(spec.rotationY ?? 0, 'rotationY') / 2,
    z = number(spec.rotation ?? 0, 'rotation') / 2,
    c1 = Math.cos(x),
    c2 = Math.cos(y),
    c3 = Math.cos(z),
    s1 = Math.sin(x),
    s2 = Math.sin(y),
    s3 = Math.sin(z);
  return quaternion({
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  });
}
export function quaternionFromAxisAngle(axis, angle) {
  const n = direction3D(axis),
    half = number(angle, 'axis angle') / 2,
    s = Math.sin(half);
  return quaternion({ x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(half) });
}
export function multiplyQuaternion(left, right) {
  const a = quaternion(left),
    b = quaternion(right);
  return quaternion({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}
/** Shortest-arc spherical interpolation; t is deterministic, not frame history. */
export function slerpQuaternion(from, to, t) {
  const a = quaternion(from),
    original = quaternion(to);
  number(t, 'quaternion progress', 0, 1);
  if (t === 0) return a;
  if (t === 1) return original;
  let b = original,
    dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  if (dot < 0) {
    dot = -dot;
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
  }
  let f = 1 - t,
    g = t;
  if (dot < 0.9995) {
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))),
      s = Math.sin(angle);
    f = Math.sin((1 - t) * angle) / s;
    g = Math.sin(t * angle) / s;
  }
  return quaternion({ x: a.x * f + b.x * g, y: a.y * f + b.y * g, z: a.z * f + b.z * g, w: a.w * f + b.w * g });
}
export function quaternionMatrix(input) {
  const q = quaternion(input),
    x = q.x,
    y = q.y,
    z = q.z,
    w = q.w;
  return Object.freeze([
    1 - 2 * (y * y + z * z),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    0,
    2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    0,
    2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
    0,
    0,
    0,
    0,
    1,
  ]);
}
export function rotateVector3D(orientation, vector) {
  return transform3D(quaternionMatrix(orientation), vector);
}
