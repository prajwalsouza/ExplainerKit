import { assert, number, options } from '../core/validate.js';
import { colorInterpolator } from '../color/interpolate.js';
import { color } from './index.js';

/** One drawable node can hold this many points. Renderers may set narrower limits. */
export const MAX_CLOUD_POINTS = 200000;
export const POINT_SHAPES = Object.freeze(['circle', 'square', 'glow']);
export const EMPTY_CLOUD = Object.freeze({ count: 0, positions: new Float32Array(0), radii: null, colors: null });
const clouds = new WeakSet([EMPTY_CLOUD]);

function floats(value, label, length, min, max) {
  const typed = value instanceof Float32Array || value instanceof Float64Array;
  assert(
    typed || Array.isArray(value),
    'INVALID_CLOUD',
    `${label} must be a Float32Array, Float64Array or number array.`,
  );
  assert(value.length === length, 'INVALID_CLOUD', `${label} needs ${length} values.`);
  const out = new Float32Array(length);
  const fail = () => assert(false, 'INVALID_CLOUD', `${label} values must be finite and between ${min} and ${max}.`);
  if (typed) {
    // A typed array holds only numbers; NaN fails both comparisons. Check the source values, then copy them.
    for (let i = 0; i < length; i++) {
      const v = value[i];
      if (!(v >= min && v <= max)) fail();
    }
    out.set(value);
    return out;
  }
  for (let i = 0; i < length; i++) {
    const v = Object.getOwnPropertyDescriptor(value, i)?.value;
    if (!(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max)) fail();
    out[i] = v;
  }
  return out;
}

/**
 * Capture a point cloud: xy positions, optional per-point radii and optional RGBA colors in [0,1].
 * The result owns copies of every buffer, so later edits to the caller's arrays never leak into a frame.
 */
export function cloudPoints(value) {
  if (clouds.has(value)) return value;
  options(value, ['positions', 'radii', 'colors', 'count'], 'cloud points');
  const source = value.positions;
  assert(source && typeof source.length === 'number', 'INVALID_CLOUD', 'Cloud positions are required.');
  assert(source.length % 2 === 0, 'INVALID_CLOUD', 'Cloud positions are x,y pairs.');
  const count = source.length / 2;
  assert(count <= MAX_CLOUD_POINTS, 'RESOURCE_LIMIT', `A cloud holds at most ${MAX_CLOUD_POINTS} points.`);
  if (value.count !== undefined)
    assert(value.count === count, 'INVALID_CLOUD', 'count must match the number of positions.');
  const cloud = Object.freeze({
    count,
    positions: floats(source, 'cloud positions', count * 2, -1e7, 1e7),
    radii: value.radii == null ? null : floats(value.radii, 'cloud radii', count, 0, 1e4),
    colors: value.colors == null ? null : floats(value.colors, 'cloud colors', count * 4, 0, 1),
  });
  clouds.add(cloud);
  return cloud;
}

export function pointShape(value) {
  assert(POINT_SHAPES.includes(value), 'INVALID_CLOUD', 'pointShape must be circle, square or glow.');
  return value;
}
export function pointBlend(value) {
  assert(value === 'normal' || value === 'add', 'INVALID_CLOUD', 'pointBlend must be normal or add.');
  return value;
}

/** A solid paint as straight-alpha [r,g,b,a] in [0,1]. Gradients are not point colors. */
export function rgbaOf(value) {
  assert(typeof value === 'string', 'INVALID_CLOUD', 'A cloud fill must be a solid color.');
  if (value.toLowerCase() === 'none' || value.toLowerCase() === 'transparent') return [0, 0, 0, 0];
  const solid = color(value);
  let hex = solid.startsWith('#') ? solid : colorInterpolator(solid, solid)(0.5);
  if (hex.length === 4 || hex.length === 5) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('');
  return [1, 3, 5, 7].map((i) => (i < hex.length ? parseInt(hex.slice(i, i + 2), 16) / 255 : 1));
}

/** Local bounding box of the drawn points, including radii. Empty clouds have no bounds. */
export function cloudBounds(cloud, fallbackRadius) {
  if (!cloud.count) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < cloud.count; i++) {
    const r = cloud.radii ? cloud.radii[i] : fallbackRadius,
      x = cloud.positions[i * 2],
      y = cloud.positions[i * 2 + 1];
    if (x - r < x0) x0 = x - r;
    if (y - r < y0) y0 = y - r;
    if (x + r > x1) x1 = x + r;
    if (y + r > y1) y1 = y + r;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Recolor every point through a color function on straight-alpha channels. */
export function mapCloudColors(cloud, map) {
  if (!cloud.colors) return cloud;
  const colors = new Float32Array(cloud.colors.length);
  for (let i = 0; i < cloud.count; i++) {
    const [r, g, b, a] = map(
      cloud.colors[i * 4],
      cloud.colors[i * 4 + 1],
      cloud.colors[i * 4 + 2],
      cloud.colors[i * 4 + 3],
    );
    colors.set([r, g, b, a], i * 4);
  }
  return cloudPoints({ positions: cloud.positions, radii: cloud.radii, colors });
}

/** Validate a renderer-side cloud without copying again when it is already captured. */
export function inspectCloud(value) {
  if (clouds.has(value)) return value;
  return cloudPoints(value);
}

export function cloudRadius(value) {
  return number(value, 'pointSize', 0, 1e4);
}
