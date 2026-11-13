import { assert, number, options } from '../core/validate.js';

/** Validated Y-up or arbitrary-axis Cartesian point; units are caller-defined. */
export function rigPoint3D(value, label = 'point') {
  options(value, ['x', 'y', 'z'], label);
  return {
    x: number(value.x, label + '.x', -1e4, 1e4),
    y: number(value.y, label + '.y', -1e4, 1e4),
    z: number(value.z ?? 0, label + '.z', -1e4, 1e4),
  };
}
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const along = (p, a, d) => ({ x: p.x + a[0] * d, y: p.y + a[1] * d, z: p.z + a[2] * d });

/** Constant-work analytical 3D IK. Pole is a direction, not a point. */
export function solveTwoBone3D(spec = {}) {
  options(spec, ['root', 'target', 'lengths', 'pole', 'reachMargin'], '3D two-bone solve');
  const root = rigPoint3D(spec.root),
    target = rigPoint3D(spec.target);
  return solve(root, target, spec.lengths, spec.pole, spec.reachMargin);
}

function solve(root, target, lengths, pole, reachMargin) {
  assert(Array.isArray(lengths) && lengths.length === 2, 'INVALID_RIG_INPUT', 'Use two link lengths.');
  for (const index of ['0', '1'])
    assert(
      Object.getOwnPropertyDescriptor(lengths, index) && 'value' in Object.getOwnPropertyDescriptor(lengths, index),
      'INVALID_RIG_INPUT',
      'Use two data lengths.',
    );
  for (const key of Reflect.ownKeys(lengths)) {
    assert(
      ['0', '1', 'length'].includes(key) && 'value' in Object.getOwnPropertyDescriptor(lengths, key),
      'INVALID_RIG_INPUT',
      'Use ordinary link lengths.',
    );
  }
  const a = number(lengths[0], 'upper length', 1e-4, 100),
    b = number(lengths[1], 'lower length', 1e-4, 100);
  const margin = number(reachMargin ?? 0, 'reach margin', 0, Math.min(a, b));
  const delta = sub(target, root),
    distance = Math.hypot(...delta);
  const direction = distance > 1e-12 ? delta.map((v) => v / distance) : [0, -1, 0];
  const hint = rigPoint3D(pole ?? { x: 0, y: 0, z: 1 }, 'pole');
  let perpendicular = sub(hint, { x: 0, y: 0, z: 0 });
  const projection = dot(perpendicular, direction);
  perpendicular = perpendicular.map((v, i) => v - projection * direction[i]);
  let magnitude = Math.hypot(...perpendicular);
  const poleDegenerate = magnitude < 1e-8;
  if (poleDegenerate) {
    // Least aligned Cartesian axis; deterministic fallback is reported.
    const axis = direction.map(Math.abs).indexOf(Math.min(...direction.map(Math.abs)));
    perpendicular = direction.map((v, i) => (i === axis ? 1 : 0) - direction[axis] * v);
    magnitude = Math.hypot(...perpendicular);
  }
  perpendicular = perpendicular.map((v) => v / magnitude);
  const d = Math.max(Math.abs(a - b), Math.min(a + b - margin, distance));
  const axial = d < 1e-12 ? 0 : (a * a - b * b + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, a * a - axial * axial));
  const joint = along(along(root, direction, axial), perpendicular, height),
    tip = along(root, direction, d);
  return {
    root,
    joint,
    tip,
    target,
    reachable: Math.abs(d - distance) < 1e-9,
    error: Math.abs(d - distance),
    poleDegenerate,
  };
}
