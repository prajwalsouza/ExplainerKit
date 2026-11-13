import { assert, number, options } from '../core/validate.js';
import { compose3D, inverse3D, multiply3D, transform3D, point3D, lookAt3D, direction3D } from './matrix.js';

const compiled = new WeakSet();
export function spatialViewport(value = { width: 960, height: 540 }) {
  options(value, ['width', 'height'], 'spatial viewport');
  return Object.freeze({
    width: number(value.width, 'viewport width', 1, 8192),
    height: number(value.height, 'viewport height', 1, 8192),
  });
}
function cameraPose(spec) {
  const pose = {
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    z: spec.z ?? 1000,
    rotationX: spec.rotationX ?? 0,
    rotationY: spec.rotationY ?? 0,
    rotation: spec.rotation ?? 0,
  };
  assert(
    spec.target === undefined ||
      (spec.rotationX === undefined && spec.rotationY === undefined && spec.rotation === undefined),
    'INVALID_CAMERA',
    'Choose Euler rotation or a look-at target, not both.',
  );
  return spec.target === undefined
    ? compose3D(pose)
    : lookAt3D({ x: pose.x, y: pose.y, z: pose.z }, spec.target, spec.up);
}
function finish(type, spec, size, projection, near, far) {
  const matrixWorld = cameraPose(spec),
    viewMatrix = inverse3D(matrixWorld),
    viewProjectionMatrix = multiply3D(projection, viewMatrix),
    inverseViewProjectionMatrix = inverse3D(viewProjectionMatrix);
  const result = Object.freeze({
    type,
    viewport: size,
    near,
    far,
    matrixWorld,
    viewMatrix,
    projectionMatrix: Object.freeze(projection),
    viewProjectionMatrix,
    inverseViewProjectionMatrix,
  });
  compiled.add(result);
  return result;
}
/** Right-handed camera looks down local -z; fov is vertical radians. */
export function perspectiveCamera(spec = {}, viewport) {
  options(
    spec,
    ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation', 'target', 'up', 'fov', 'near', 'far', 'aspect', 'zoom'],
    'perspective camera',
  );
  const size = spatialViewport(viewport),
    near = number(spec.near ?? 0.1, 'near', 1e-8, 1e7),
    far = number(spec.far ?? 1e5, 'far', 1e-8, 1e8);
  assert(far > near, 'INVALID_CAMERA', 'far must exceed near.');
  const fov = number(spec.fov ?? Math.PI / 3, 'vertical field of view', 1e-4, Math.PI - 1e-4),
    aspect = number(spec.aspect ?? size.width / size.height, 'camera aspect', 1e-4, 1e4),
    zoom = number(spec.zoom ?? 1, 'camera zoom', 1e-4, 1e4),
    f = zoom / Math.tan(fov / 2),
    range = near - far;
  return finish(
    'perspective',
    spec,
    size,
    [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / range, -1, 0, 0, (2 * far * near) / range, 0],
    near,
    far,
  );
}
/** Orthographic bounds are authored world units; depth does not change size. */
export function orthographicCamera(spec = {}, viewport) {
  options(
    spec,
    [
      'x',
      'y',
      'z',
      'rotationX',
      'rotationY',
      'rotation',
      'target',
      'up',
      'left',
      'right',
      'top',
      'bottom',
      'near',
      'far',
      'zoom',
    ],
    'orthographic camera',
  );
  const size = spatialViewport(viewport),
    near = number(spec.near ?? 0, 'near', 0, 1e7),
    far = number(spec.far ?? 1e5, 'far', 1e-8, 1e8);
  assert(far > near, 'INVALID_CAMERA', 'far must exceed near.');
  const left = number(spec.left ?? -size.width / 2, 'left'),
    right = number(spec.right ?? size.width / 2, 'right'),
    top = number(spec.top ?? size.height / 2, 'top'),
    bottom = number(spec.bottom ?? -size.height / 2, 'bottom'),
    zoom = number(spec.zoom ?? 1, 'camera zoom', 1e-4, 1e4);
  assert(right > left && top > bottom, 'INVALID_CAMERA', 'Orthographic bounds must have positive width and height.');
  const w = (right - left) / zoom,
    h = (top - bottom) / zoom,
    cx = (right + left) / 2,
    cy = (top + bottom) / 2;
  return finish(
    'orthographic',
    spec,
    size,
    [
      2 / w,
      0,
      0,
      0,
      0,
      2 / h,
      0,
      0,
      0,
      0,
      -2 / (far - near),
      0,
      (-2 * cx) / w,
      (-2 * cy) / h,
      -(far + near) / (far - near),
      1,
    ],
    near,
    far,
  );
}
export function requireCamera(camera) {
  assert(
    compiled.has(camera),
    'INVALID_CAMERA',
    'Use a prepared perspectiveCamera or orthographicCamera from this module.',
  );
  return camera;
}
/** Screen origin top-left; depth is WebGL normalized depth [0,1] in-frustum. */
export function projectPoint(camera, point) {
  requireCamera(camera);
  const p = point3D(point),
    view = transform3D(camera.viewMatrix, p),
    ndc = transform3D(camera.viewProjectionMatrix, p),
    cameraDepth = -view.z,
    depth = (ndc.z + 1) / 2;
  return Object.freeze({
    x: ((ndc.x + 1) * camera.viewport.width) / 2,
    y: ((1 - ndc.y) * camera.viewport.height) / 2,
    depth,
    cameraDepth,
    visible:
      cameraDepth >= camera.near &&
      cameraDepth <= camera.far &&
      cameraDepth >= 0 &&
      Math.abs(ndc.x) <= 1 &&
      Math.abs(ndc.y) <= 1 &&
      depth >= 0 &&
      depth <= 1,
    ndc,
  });
}
export function unprojectPoint(camera, screen) {
  requireCamera(camera);
  options(screen, ['x', 'y', 'depth'], 'screen point');
  const x = number(screen.x, 'screen x'),
    y = number(screen.y, 'screen y'),
    depth = number(screen.depth ?? 0, 'normalized depth', 0, 1);
  return transform3D(camera.inverseViewProjectionMatrix, {
    x: (x / camera.viewport.width) * 2 - 1,
    y: 1 - (y / camera.viewport.height) * 2,
    z: depth * 2 - 1,
  });
}
export function screenRay(camera, screen) {
  requireCamera(camera);
  options(screen, ['x', 'y'], 'screen ray');
  const near = unprojectPoint(camera, { ...screen, depth: 0 }),
    far = unprojectPoint(camera, { ...screen, depth: 1 }),
    origin = camera.type === 'perspective' ? transform3D(camera.matrixWorld, { x: 0, y: 0, z: 0 }) : near,
    direction = direction3D({ x: far.x - near.x, y: far.y - near.y, z: far.z - near.z });
  return Object.freeze({ origin, direction, near: camera.near, far: camera.far });
}
function withWorld(camera, matrixWorld, projection = camera.projectionMatrix) {
  requireCamera(camera);
  const viewMatrix = inverse3D(matrixWorld),
    viewProjectionMatrix = multiply3D(projection, viewMatrix),
    inverseViewProjectionMatrix = inverse3D(viewProjectionMatrix),
    result = Object.freeze({
      ...camera,
      matrixWorld,
      viewMatrix,
      projectionMatrix: Object.freeze(projection),
      viewProjectionMatrix,
      inverseViewProjectionMatrix,
    });
  compiled.add(result);
  return result;
}
/** Orbit around a world target; angles are deltas in radians, radius stays fixed. */
export function orbitCamera(camera, spec = {}) {
  requireCamera(camera);
  options(spec, ['target', 'azimuth', 'elevation'], 'camera orbit');
  const target = point3D(spec.target ?? {}),
    eye = transform3D(camera.matrixWorld, {}),
    x = eye.x - target.x,
    y = eye.y - target.y,
    z = eye.z - target.z,
    radius = Math.hypot(x, y, z);
  assert(radius > 0, 'INVALID_CAMERA', 'An orbit target cannot coincide with the camera.');
  const theta = Math.atan2(x, z) + number(spec.azimuth ?? 0, 'orbit azimuth'),
    phi = Math.max(
      -Math.PI / 2 + 1e-4,
      Math.min(Math.PI / 2 - 1e-4, Math.asin(y / radius) + number(spec.elevation ?? 0, 'orbit elevation')),
    );
  return withWorld(
    camera,
    lookAt3D(
      {
        x: target.x + radius * Math.sin(theta) * Math.cos(phi),
        y: target.y + radius * Math.sin(phi),
        z: target.z + radius * Math.cos(theta) * Math.cos(phi),
      },
      target,
    ),
  );
}
/** Positive distance moves along the camera's local forward direction (-z). */
export function dollyCamera(camera, distance) {
  requireCamera(camera);
  number(distance, 'dolly distance');
  const matrix = [...camera.matrixWorld];
  matrix[12] -= matrix[8] * distance;
  matrix[13] -= matrix[9] * distance;
  matrix[14] -= matrix[10] * distance;
  return withWorld(camera, Object.freeze(matrix));
}
/** Lens/frustum magnification, distinct from moving the camera. */
export function zoomCamera(camera, factor) {
  requireCamera(camera);
  number(factor, 'camera zoom factor', 1e-4, 1e4);
  const projection = [...camera.projectionMatrix];
  for (const i of [0, 4, 8, 12, 1, 5, 9, 13]) projection[i] *= factor;
  return withWorld(camera, camera.matrixWorld, projection);
}

/** Batch xyz triples into packed screen xy, normalized depth and visibility buffers.
 * @param {ReturnType<typeof perspectiveCamera>|ReturnType<typeof orthographicCamera>} camera
 * @param {Float32Array|Float64Array} coordinates
 */
export function projectPoints(camera, coordinates) {
  requireCamera(camera);
  assert(
    coordinates instanceof Float32Array || coordinates instanceof Float64Array,
    'INVALID_POINTS',
    'Use a Float32Array or Float64Array of xyz triples.',
  );
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Float32Array.prototype), 'length').get.call(
    coordinates,
  );
  assert(
    length % 3 === 0 && length <= 3_000_000,
    'RESOURCE_LIMIT',
    'Projection accepts at most one million xyz triples.',
  );
  const count = length / 3,
    input = new Float64Array(coordinates);
  for (const v of input) number(v, 'projection coordinate', -1e7, 1e7);
  const positions = new Float64Array(count * 2),
    depths = new Float64Array(count),
    cameraDepths = new Float64Array(count),
    visible = new Uint8Array(count),
    m = camera.viewProjectionMatrix,
    v = camera.viewMatrix;
  for (let i = 0; i < count; i++) {
    const x = input[3 * i],
      y = input[3 * i + 1],
      z = input[3 * i + 2],
      w = m[3] * x + m[7] * y + m[11] * z + m[15];
    assert(Number.isFinite(w) && w !== 0, 'PROJECTION_AT_INFINITY', 'A batch point lies at projective infinity.');
    const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      nz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    for (const q of [nx, ny, nz]) number(q, 'projected coordinate', -1e12, 1e12);
    const depth = (nz + 1) / 2,
      cd = -(v[2] * x + v[6] * y + v[10] * z + v[14]);
    positions[2 * i] = ((nx + 1) * camera.viewport.width) / 2;
    positions[2 * i + 1] = ((1 - ny) * camera.viewport.height) / 2;
    depths[i] = depth;
    cameraDepths[i] = cd;
    visible[i] = +(
      cd >= camera.near &&
      cd <= camera.far &&
      cd >= 0 &&
      Math.abs(nx) <= 1 &&
      Math.abs(ny) <= 1 &&
      depth >= 0 &&
      depth <= 1
    );
  }
  return Object.freeze({ count, positions, depths, cameraDepths, visible });
}
