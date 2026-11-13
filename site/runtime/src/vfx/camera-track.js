import { assert, number, options, safeCopy } from '../core/validate.js';

const axes = [0, 1, 2];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const length = Math.hypot(...a);
  return a.map((value) => value / length);
};
const interpolate = (a, b, t) => a.map((value, i) => value + t * (b[i] - value));

function pose(value, index) {
  options(value, ['time', 'rotation', 'translation'], 'camera pose');
  const { rotation, translation } = value;
  assert(
    Array.isArray(rotation) &&
      rotation.length === 9 &&
      rotation.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.01) &&
      Array.isArray(translation) &&
      translation.length === 3 &&
      translation.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e5),
    'INVALID_DATA',
    'A camera pose needs a rotation matrix and translation vector.',
  );
  const [x, y, z] = axes.map((i) => rotation.slice(i * 3, i * 3 + 3));
  assert(
    distance(cross(x, y), z) <= 0.01 &&
      [x, y, z].every((row) => Math.abs(Math.hypot(...row) - 1) <= 0.01) &&
      Math.abs(dot(x, y)) <= 0.01,
    'INVALID_DATA',
    'Camera rotations must be orthonormal and right-handed.',
  );
  return {
    value,
    time: value.time === undefined ? index : number(value.time, 'pose time', 0, 86400),
    center: axes.map((i) => -dot([x[i], y[i], z[i]], translation)),
  };
}

function spike(poses, field, edges, i, floor, speedFactor) {
  const get = (p) => (field === 'center' ? p.center : p.value.rotation);
  const [a, b, c] = poses.slice(i - 1, i + 2);
  const before = b.time - a.time;
  const after = c.time - b.time;
  const typical = edges
    .slice(Math.max(0, i - 5), i - 1)
    .concat(edges.slice(i + 1, i + 5))
    .sort((left, right) => left - right);
  const speed = typical[Math.floor(typical.length / 2)] ?? 0;
  const excursion = distance(get(b), interpolate(get(a), get(c), before / (before + after)));
  return (
    excursion > Math.max(floor, speedFactor * speed * Math.max(before, after), 0.9 * distance(get(a), get(c))) &&
    Math.min(edges[i - 1] * before, edges[i] * after) > 0.72 * excursion
  );
}

/** Repair isolated out-and-back errors in a sampled world-to-camera pose track. */
export function stabilizeCameraTrack(input) {
  return compileCameraTrack(input);
}

/** Validate a measured camera track and repair isolated pose spikes by default. */
export function compileCameraTrack(input, spec = {}) {
  options(spec, ['stabilization'], 'camera track options');
  const stabilization = spec.stabilization === undefined ? 'standard' : spec.stabilization;
  assert(
    stabilization === 'standard' || stabilization === 'strong' || stabilization === 'none',
    'INVALID_OPTIONS',
    'Camera track stabilization must be standard, strong or none.',
  );
  assert(
    Array.isArray(input) && input.length >= 3 && input.length <= 300,
    'RESOURCE_LIMIT',
    'Stabilize between 3 and 300 camera poses.',
  );
  const poses = safeCopy(input).map(pose);
  assert(
    poses.every((p, i) => i === 0 || p.time > poses[i - 1].time),
    'INVALID_DATA',
    'Camera pose times must increase.',
  );
  assert(
    poses.every((p) => (p.value.time === undefined) === (poses[0].value.time === undefined)),
    'INVALID_DATA',
    'Supply a timestamp for every camera pose or omit them all.',
  );
  if (stabilization === 'none') {
    return Object.freeze({ samples: Object.freeze(poses.map(({ value }) => value)), repaired: Object.freeze([]) });
  }
  const strong = stabilization === 'strong';
  const speedFactor = strong ? 2.5 : 3.25;
  const stepRates = (get) => poses.slice(1).map((p, i) => distance(get(p), get(poses[i])) / (p.time - poses[i].time));
  const translation = stepRates((p) => p.center);
  const rotation = stepRates((p) => p.value.rotation);
  const suspect = poses.map(
    (_, i) =>
      i > 0 &&
      i < poses.length - 1 &&
      (spike(poses, 'center', translation, i, strong ? 0.006 : 0.012, speedFactor) ||
        spike(poses, 'rotation', rotation, i, strong ? 0.0035 : 0.008, speedFactor)),
  );
  const repaired = [];
  const samples = poses.map((p, i) => {
    if (!suspect[i] || suspect[i - 1] || suspect[i + 1]) return p.value;
    const a = poses[i - 1];
    const b = poses[i + 1];
    const t = (p.time - a.time) / (b.time - a.time);
    if (distance(a.value.rotation, b.value.rotation) > 0.45) return p.value;
    const blended = interpolate(a.value.rotation, b.value.rotation, t);
    const x = unit(blended.slice(0, 3));
    const row = blended.slice(3, 6);
    const y = unit(row.map((value, j) => value - dot(row, x) * x[j]));
    const rows = [x, y, cross(x, y)];
    const center = interpolate(a.center, b.center, t);
    repaired.push(i);
    return Object.freeze({
      ...p.value,
      rotation: Object.freeze(rows.flat()),
      translation: Object.freeze(rows.map((axis) => -dot(axis, center))),
    });
  });
  return Object.freeze({ samples: Object.freeze(samples), repaired: Object.freeze(repaired) });
}
