import { localMatrix } from '../core/transform.js';
import { assert, number, options, text } from '../core/validate.js';

// Affine convention shared with SVG/Canvas: [a,b,c,d,e,f] means
// x' = a*x + c*y + e; y' = b*x + d*y + f. Products apply the right
// transform first. See https://www.w3.org/TR/SVG2/coords.html.
const MATRIX_LIMIT = 1e100;
const COORDINATE_LIMIT = 1e7;
export const MIN_CAMERA_ZOOM = 1e-4;
export const MAX_CAMERA_ZOOM = 1e4;
const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

function matrix(value) {
  assert(
    Array.isArray(value) && value.length === 6,
    'INVALID_TRANSFORM',
    'An affine matrix needs six numeric entries.',
  );
  const result = [];
  for (let i = 0; i < 6; i++) {
    const entry = Object.getOwnPropertyDescriptor(value, i);
    assert(
      entry && 'value' in entry,
      'INVALID_TRANSFORM',
      'Matrix entries must be dense numeric values, not accessors.',
    );
    result.push(number(entry.value, `matrix[${i}]`, -MATRIX_LIMIT, MATRIX_LIMIT));
  }
  return result;
}
function resultMatrix(value) {
  for (let i = 0; i < 6; i++) number(value[i], `result matrix[${i}]`, -MATRIX_LIMIT, MATRIX_LIMIT);
  return Object.freeze(value);
}
function point(value, label = 'point') {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_TRANSFORM', `${label} needs x and y.`);
  const x = Object.getOwnPropertyDescriptor(value, 'x'),
    y = Object.getOwnPropertyDescriptor(value, 'y');
  assert(
    x && 'value' in x && y && 'value' in y,
    'INVALID_TRANSFORM',
    `${label} coordinates must be values, not accessors.`,
  );
  return {
    x: number(x.value, `${label}.x`, -MATRIX_LIMIT, MATRIX_LIMIT),
    y: number(y.value, `${label}.y`, -MATRIX_LIMIT, MATRIX_LIMIT),
  };
}
function viewport(value) {
  options(value, ['width', 'height'], 'camera viewport');
  return {
    width: number(value.width, 'viewport width', 1, 8192),
    height: number(value.height, 'viewport height', 1, 8192),
  };
}
function pose(spec) {
  options(spec, ['x', 'y', 'zoom', 'rotation', 'anchorX', 'anchorY'], 'camera pose');
  return {
    x: number(spec.x, 'camera x', -COORDINATE_LIMIT, COORDINATE_LIMIT),
    y: number(spec.y, 'camera y', -COORDINATE_LIMIT, COORDINATE_LIMIT),
    zoom: number(spec.zoom ?? 1, 'camera zoom', MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
    rotation: number(spec.rotation ?? 0, 'camera rotation'),
    anchorX: number(spec.anchorX ?? 0.5, 'camera anchorX', 0, 1),
    anchorY: number(spec.anchorY ?? 0.5, 'camera anchorY', 0, 1),
  };
}

/**
 * World to screen: anchor*viewport + zoom*R(-rotation)*(world - center).
 * The camera's positive angle rotates the view in the opposite direction.
 * No model geometry is changed. Return values are independent and immutable.
 */
export function cameraMatrix(spec, size) {
  const p = pose(spec),
    v = viewport(size);
  const c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  const a = p.zoom * c,
    b = -p.zoom * s,
    cc = p.zoom * s,
    d = p.zoom * c;
  return resultMatrix([
    a,
    b,
    cc,
    d,
    p.anchorX * v.width - a * p.x - cc * p.y,
    p.anchorY * v.height - b * p.x - d * p.y,
  ]);
}

/** Compose affine transforms; multiplyMatrices(A,B) applies B before A. */
export function multiplyMatrices(left, right) {
  const [a, b, c, d, e, f] = matrix(left),
    [g, h, i, j, k, l] = matrix(right);
  return resultMatrix([
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]);
}

/** Invert a finite nonsingular affine transform, including its translation. */
export function invertMatrix(value) {
  const [a, b, c, d, e, f] = matrix(value),
    determinant = a * d - b * c;
  assert(
    Number.isFinite(determinant) && determinant !== 0,
    'SINGULAR_TRANSFORM',
    'The transform is singular at the supported numerical precision.',
  );
  return resultMatrix([
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ]);
}

/** Transform a position; a pose object with an extra rotation field is also valid. */
export function transformPoint(value, position) {
  const [a, b, c, d, e, f] = matrix(value),
    p = point(position);
  return Object.freeze({
    x: number(a * p.x + c * p.y + e, 'transformed x', -MATRIX_LIMIT, MATRIX_LIMIT),
    y: number(b * p.x + d * p.y + f, 'transformed y', -MATRIX_LIMIT, MATRIX_LIMIT),
  });
}

/**
 * Resolve a sampled node's origin and local +x direction in world coordinates.
 * Nested translation, rotation, reflection and nonuniform scaling are composed.
 * Under shear/nonuniform scale, rotation is the angle of the transformed +x axis,
 * not a claim that the whole basis remains orthogonal. Singular targets reject.
 */
export function worldPose(frame, nodeId) {
  text(nodeId, 'camera target ID', 300);
  assert(nodeId.length > 0, 'INVALID_CAMERA_TARGET', 'Camera target ID must be nonempty.');
  assert(frame && Array.isArray(frame.children), 'INVALID_FRAME', 'A sampled frame needs children.');
  const seen = new Set();
  let found = null;
  function visit(node, parent, depth) {
    assert(depth <= 24 && seen.size < 10000, 'RESOURCE_LIMIT', 'Target lookup exceeds the hierarchy or node limit.');
    assert(node && typeof node === 'object', 'INVALID_FRAME', 'A sampled node must be an object.');
    const id = text(node.id, 'node ID', 300);
    assert(id.length > 0 && !seen.has(id), 'DUPLICATE_ID', 'Sampled node IDs must be nonempty and unique.');
    seen.add(id);
    const world = multiplyMatrices(parent, localMatrix(node.props ?? {}, node));
    if (id === nodeId) {
      const determinant = world[0] * world[3] - world[1] * world[2];
      assert(
        Number.isFinite(determinant) && determinant !== 0 && Math.hypot(world[0], world[1]) > 0,
        'SINGULAR_TRANSFORM',
        'A camera cannot follow the orientation of a collapsed target.',
      );
      found = Object.freeze({ x: world[4], y: world[5], rotation: Math.atan2(world[1], world[0]) });
    }
    const children = node.children ?? [];
    assert(Array.isArray(children), 'INVALID_FRAME', 'Node children must be an array.');
    for (const child of children) visit(child, world, depth + 1);
  }
  for (const child of frame.children) visit(child, IDENTITY, 0);
  assert(found, 'CAMERA_TARGET_MISSING', `Camera target ${nodeId} is not present in this sampled frame.`);
  return found;
}

/**
 * Frame a world-space rectangle without cropping any corner after camera rotation.
 * Its center lands on the requested viewport anchor. Noncentral anchors therefore
 * use the smaller available space on either side; padding is uniform screen px.
 * At most MAX_CAMERA_ZOOM is used. A required zoom below MIN_CAMERA_ZOOM rejects.
 */
export function fitRegion(region, size, spec = {}) {
  options(region, ['x', 'y', 'width', 'height'], 'camera region');
  options(spec, ['padding', 'rotation', 'anchorX', 'anchorY'], 'camera fit options');
  const v = viewport(size);
  const x = number(region.x, 'region x'),
    y = number(region.y, 'region y');
  const width = number(region.width, 'region width', Number.MIN_VALUE, COORDINATE_LIMIT);
  const height = number(region.height, 'region height', Number.MIN_VALUE, COORDINATE_LIMIT);
  const rotation = number(spec.rotation ?? 0, 'fit rotation');
  const anchorX = number(spec.anchorX ?? 0.5, 'fit anchorX', 0, 1);
  const anchorY = number(spec.anchorY ?? 0.5, 'fit anchorY', 0, 1);
  const padding = number(spec.padding ?? 0, 'fit padding', 0, 8192);
  const roomX = Math.min(anchorX * v.width, (1 - anchorX) * v.width) - padding;
  const roomY = Math.min(anchorY * v.height, (1 - anchorY) * v.height) - padding;
  assert(roomX > 0 && roomY > 0, 'CAMERA_FIT_FAILED', 'Padding and anchor leave no room for a positive-size region.');
  const c = Math.abs(Math.cos(rotation)),
    s = Math.abs(Math.sin(rotation));
  const halfWidth = (c * width + s * height) / 2,
    halfHeight = (s * width + c * height) / 2;
  const zoom = Math.min(MAX_CAMERA_ZOOM, roomX / halfWidth, roomY / halfHeight);
  assert(zoom >= MIN_CAMERA_ZOOM, 'CAMERA_FIT_FAILED', 'The region needs a zoom below the supported camera minimum.');
  return Object.freeze(pose({ x: x + width / 2, y: y + height / 2, zoom, rotation, anchorX, anchorY }));
}
