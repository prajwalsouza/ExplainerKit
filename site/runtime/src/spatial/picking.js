import { assert, number, options, safeCopy } from '../core/validate.js';
import { point3D, direction3D, identity3D, matrix3D, inverse3D, transform3D } from './matrix.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
function raySpec(value) {
  options(value, ['origin', 'direction', 'near', 'far'], 'ray');
  return { origin: point3D(value.origin, 'ray origin'), direction: direction3D(value.direction) };
}
function hit(ray, distance, normal) {
  return Object.freeze({
    distance,
    point: Object.freeze({
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: ray.origin.z + ray.direction.z * distance,
    }),
    normal,
  });
}
export function rayPlane(input, spec = {}) {
  options(spec, ['point', 'normal'], 'plane');
  const ray = raySpec(input),
    p = point3D(spec.point ?? {}),
    normal = direction3D(spec.normal ?? { x: 0, y: 0, z: 1 }),
    denominator = dot(normal, ray.direction);
  if (Math.abs(denominator) < 1e-12) return null;
  const distance = dot(sub(p, ray.origin), normal) / denominator;
  return distance < 0 ? null : hit(ray, distance, normal);
}
export function raySphere(input, spec = {}) {
  options(spec, ['center', 'radius'], 'sphere');
  const ray = raySpec(input),
    center = point3D(spec.center ?? {}),
    radius = number(spec.radius, 'sphere radius', 0, 1e7),
    offset = sub(ray.origin, center),
    along = -dot(offset, ray.direction),
    perpendicular = {
      x: offset.x + along * ray.direction.x,
      y: offset.y + along * ray.direction.y,
      z: offset.z + along * ray.direction.z,
    },
    discriminant = radius * radius - dot(perpendicular, perpendicular);
  if (discriminant < 0) return null;
  const near = along - Math.sqrt(discriminant),
    far = along + Math.sqrt(discriminant),
    distance = near >= 0 ? near : far;
  if (distance < 0) return null;
  const result = hit(ray, distance, null),
    normal = radius === 0 ? null : direction3D(sub(result.point, center));
  return Object.freeze({ ...result, normal });
}
/** Exact ray against a transformed local box, including nested nonuniform scale. */
export function rayBox(input, spec = {}) {
  options(spec, ['min', 'max', 'matrix'], 'box');
  const ray = raySpec(input),
    min = point3D(spec.min),
    max = point3D(spec.max);
  for (const axis of ['x', 'y', 'z'])
    assert(max[axis] >= min[axis], 'INVALID_BOUNDS', 'Box maxima must follow minima.');
  const matrix = matrix3D(spec.matrix ?? identity3D);
  assert(
    matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1,
    'INVALID_TRANSFORM',
    'Box picking needs an affine model matrix, not a projection matrix.',
  );
  const inverse = inverse3D(matrix),
    origin = transform3D(inverse, ray.origin),
    d = ray.direction,
    direction = {
      x: inverse[0] * d.x + inverse[4] * d.y + inverse[8] * d.z,
      y: inverse[1] * d.x + inverse[5] * d.y + inverse[9] * d.z,
      z: inverse[2] * d.x + inverse[6] * d.y + inverse[10] * d.z,
    };
  let near = -Infinity,
    far = Infinity,
    nearNormal = null,
    farNormal = null;
  for (const axis of ['x', 'y', 'z']) {
    if (direction[axis] === 0) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    let a = (min[axis] - origin[axis]) / direction[axis],
      b = (max[axis] - origin[axis]) / direction[axis],
      na = { x: 0, y: 0, z: 0, [axis]: -1 },
      nb = { x: 0, y: 0, z: 0, [axis]: 1 };
    if (a > b) {
      [a, b] = [b, a];
      [na, nb] = [nb, na];
    }
    if (a > near) {
      near = a;
      nearNormal = na;
    }
    if (b < far) {
      far = b;
      farNormal = nb;
    }
    if (near > far) return null;
  }
  const distance = near >= 0 ? near : far,
    localNormal = near >= 0 ? nearNormal : farNormal;
  if (distance < 0 || !Number.isFinite(distance)) return null;
  const normal = localNormal
    ? direction3D({
        x: inverse[0] * localNormal.x + inverse[1] * localNormal.y + inverse[2] * localNormal.z,
        y: inverse[4] * localNormal.x + inverse[5] * localNormal.y + inverse[6] * localNormal.z,
        z: inverse[8] * localNormal.x + inverse[9] * localNormal.y + inverse[10] * localNormal.z,
      })
    : null;
  return hit(ray, distance, normal);
}
/** Nearest declared bound, not a claim of exact arbitrary-mesh picking. */
export function pickBounds(input, items) {
  const ray = raySpec(input),
    captured = safeCopy(items);
  assert(Array.isArray(captured) && captured.length <= 10000, 'RESOURCE_LIMIT', 'Pick at most 10000 declared bounds.');
  const ids = new Set();
  let nearest = null;
  for (const item of captured) {
    options(item, ['id', 'min', 'max', 'matrix'], 'pick bound');
    assert(
      typeof item.id === 'string' && item.id && !ids.has(item.id),
      'INVALID_ID',
      'Pick bounds need distinct nonempty IDs.',
    );
    ids.add(item.id);
    const result = rayBox(ray, { min: item.min, max: item.max, ...(item.matrix ? { matrix: item.matrix } : {}) });
    if (
      result &&
      (!nearest || result.distance < nearest.distance || (result.distance === nearest.distance && item.id < nearest.id))
    )
      nearest = Object.freeze({ id: item.id, ...result });
  }
  return nearest;
}
