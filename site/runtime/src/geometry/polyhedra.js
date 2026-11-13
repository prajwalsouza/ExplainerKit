import { assert, number, options, safeCopy } from '../core/validate.js';
import { Derived } from '../core/scene.js';
import { rgbaOf } from '../graphics/cloud.js';
const data = new WeakMap(),
  splitSources = new WeakSet(),
  EPS = 1e-9;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0),
  sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const length = Math.hypot(...v);
  assert(length > EPS, 'INVALID_POLYHEDRON', 'A direction must be nonzero.');
  return v.map((x) => x / length);
};
const vector = (v, label) => {
  assert(Array.isArray(v) && v.length === 3, 'INVALID_POLYHEDRON', `${label} needs three coordinates.`);
  return v.map((x) => number(x, label, -1e6, 1e6));
};
const center = (points) => [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length);
const areaNormal = (points) => {
  for (let i = 1; i < points.length - 1; i++) {
    const value = cross(sub(points[i], points[0]), sub(points[i + 1], points[0]));
    if (Math.hypot(...value) > EPS) return value;
  }
  return null;
};
const normal = (points) => unit(areaNormal(points) ?? [0, 0, 0]);
function mesh(kind) {
  let vertices, indices;
  if (kind === 'cube') {
    vertices = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
    indices = [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ];
  } else {
    assert(kind === 'icosahedron', 'INVALID_POLYHEDRON', 'Supported polyhedra are cube and icosahedron.');
    const g = (1 + Math.sqrt(5)) / 2;
    vertices = [];
    for (const a of [-1, 1]) for (const b of [-g, g]) vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
    indices = [];
    for (let a = 0; a < 12; a++)
      for (let b = a + 1; b < 12; b++)
        for (let c = b + 1; c < 12; c++)
          if (
            [sub(vertices[a], vertices[b]), sub(vertices[b], vertices[c]), sub(vertices[c], vertices[a])].every(
              (v) => Math.abs(Math.hypot(...v) - 2) < EPS,
            )
          )
            indices.push([a, b, c]);
  }
  const span = Math.max(...vertices.map((v) => v[0])) - Math.min(...vertices.map((v) => v[0]));
  vertices = vertices.map((v) => v.map((x) => x / span));
  return indices.map((ids, id) => {
    let points = ids.map((i) => vertices[i]);
    if (dot(normal(points), center(points)) < 0) points = points.toReversed();
    return { id: `face${id}`, points };
  });
}
function rotation(yaw, pitch, roll) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  return (p) => {
    const x = cy * p[0] + sy * p[2],
      z = -sy * p[0] + cy * p[2],
      y = cp * p[1] - sp * z,
      w = sp * p[1] + cp * z;
    return [cr * x - sr * y, sr * x + cr * y, w];
  };
}
function paint(ramp, brightness) {
  const scaled = Math.max(0, Math.min(1, brightness)) * (ramp.length - 1),
    i = Math.min(ramp.length - 2, Math.floor(scaled)),
    k = scaled - i;
  return (
    '#' +
    ramp[i]
      .slice(0, 3)
      .map((v, j) =>
        Math.round((v + (ramp[i + 1][j] - v) * k) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function project(faces, values, config, pieces) {
  const [width, yaw, pitch, roll, ...offsets] = values;
  number(width, 'polyhedron width', 1e-6, 1e6);
  [yaw, pitch, roll].forEach((v) => number(v, 'polyhedron angle', -1e6, 1e6));
  const rotate = rotation(yaw, pitch, roll),
    planeZ = pieces ? rotate(config.plane.normal)[2] : 0;
  const result = faces.map((face) => {
    const amount = pieces ? number(offsets[face.piece], 'piece separation', 0, 1e6) : 0,
      shift = pieces ? config.plane.normal.map((v) => v * amount * (face.piece === 0 ? -1 : 1)) : [0, 0, 0];
    const world = face.points.map((p) => rotate(p.map((v, i) => v + shift[i]))),
      n = normal(world),
      brightness = 0.2 + 0.8 * Math.max(0, dot(n, config.light)),
      visible = n[2] > EPS;
    return Object.freeze({
      id: face.id,
      piece: face.piece ?? null,
      interior: !!face.interior,
      visible,
      normal: Object.freeze(n),
      depth: center(world)[2],
      points: Object.freeze(world.map((p) => Object.freeze([p[0] * width, p[1] * width, p[2] * width]))),
      fill: face.interior ? config.interior : paint(config.ramp, brightness),
    });
  });
  return Object.freeze(
    result.sort((a, b) =>
      pieces && a.piece !== b.piece && Math.abs(planeZ) > EPS
        ? (a.piece - b.piece) * Math.sign(planeZ)
        : a.depth - b.depth || a.id.localeCompare(b.id),
    ),
  );
}
function create(scene, faces, config, inputs, pieces = false) {
  // One stable path per depth slot. Slots deliberately do not identify anatomical faces.
  const initial = project(
      faces,
      inputs.map((input) => (input instanceof Derived ? input.sample(scene._sampleContext()) : input.sample(0))),
      config,
      pieces,
    ),
    component = scene.component({
      type: 'group',
      children: Object.fromEntries(
        initial.map((_, i) => [`slot${i}`, { type: 'path', props: { commands: [], fill: '#000000' } }]),
      ),
    });
  const handle = scene.instance(component),
    sampled = scene.derive(inputs, (...args) => project(faces, args.slice(0, -1), config, pieces));
  initial.forEach((_, i) =>
    handle.part(`slot${i}`).bind(['commands', 'fill'], {
      inputs: [sampled],
      map: (frame) => ({
        commands: frame[i].visible
          ? [
              ['M', ...frame[i].points[0].slice(0, 2)],
              ...frame[i].points.slice(1).map((p) => ['L', ...p.slice(0, 2)]),
              ['Z'],
            ]
          : [],
        fill: frame[i].fill,
      }),
    }),
  );
  const result = Object.freeze({
    handle,
    inputs: Object.freeze({ width: inputs[0], yaw: inputs[1], pitch: inputs[2], roll: inputs[3] }),
    faceCount: faces.length,
    facesAt(spec = {}) {
      return sampled.sample(scene._sampleContext(spec));
    },
    ...(pieces
      ? {
          pieces: Object.freeze(
            [0, 1].map((i) =>
              Object.freeze({
                side: i ? 'positive' : 'negative',
                offset: inputs[4 + i],
                facesAt(spec = {}) {
                  return sampled.sample(scene._sampleContext(spec)).filter((face) => face.piece === i);
                },
              }),
            ),
          ),
        }
      : {}),
  });
  data.set(result, { scene, faces, config, inputs });
  return result;
}
/**
 * Orthographic convex mesh. Numeric dimensions/angles become animatable scene parameters.
 * @param {import('../core/scene.js').Scene} scene
 * @param {{kind?:'cube'|'icosahedron',width?:number|import('../core/data.js').Parameter|Derived,yaw?:number|import('../core/data.js').Parameter|Derived,pitch?:number|import('../core/data.js').Parameter|Derived,roll?:number|import('../core/data.js').Parameter|Derived,light?:number[],ramp?:string[]}} [spec]
 */
export function polyhedron(scene, spec = {}) {
  options(spec, ['kind', 'width', 'yaw', 'pitch', 'roll', 'light', 'ramp'], 'polyhedron');
  assert(scene && typeof scene._ownsInput === 'function', 'INVALID_POLYHEDRON', 'Supply an ExplainerKit scene.');
  const faces = mesh(spec.kind ?? 'icosahedron'),
    light = unit(vector(safeCopy(spec.light ?? [-0.4, -0.6, 1]), 'light')),
    colors = safeCopy(spec.ramp ?? ['#19384c', '#63b9c4']);
  assert(
    Array.isArray(colors) && colors.length >= 2 && colors.length <= 32,
    'INVALID_POLYHEDRON',
    'A ramp needs2–32 opaque solid colors.',
  );
  const ramp = colors.map((color) => {
    const rgba = rgbaOf(color);
    assert(rgba[3] === 1, 'INVALID_POLYHEDRON', 'Polyhedron ramps must be opaque.');
    return rgba;
  });
  const values = ['width', 'yaw', 'pitch', 'roll'].map((key, i) => {
    const value = spec[key] ?? (i === 0 ? 100 : 0);
    assert(
      typeof value === 'number' || (scene._ownsInput(value) && typeof value.sample === 'function'),
      'INVALID_BINDING',
      'Use numeric values or inputs owned by this scene.',
    );
    if (typeof value === 'number') number(value, key, i === 0 ? 1e-6 : -1e6, 1e6);
    return value;
  });
  project(
    faces,
    values.map((value) =>
      typeof value === 'number'
        ? value
        : value instanceof Derived
          ? value.sample(scene._sampleContext())
          : value.sample(0),
    ),
    { light, ramp },
    false,
  );
  scene._capacity(faces.length + 1);
  return scene._batch(() => {
    const inputs = values.map((value, i) =>
      typeof value === 'number' ? scene.parameter(value, { min: i === 0 ? 1e-6 : -1e6, max: 1e6 }) : value,
    );
    return create(scene, faces, { light, ramp }, inputs);
  });
}
function clipped(points, n, offset, sign, cuts) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      da = (dot(n, a) - offset) * sign,
      db = (dot(n, b) - offset) * sign;
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const k = da / (da - db),
        p = a.map((v, j) => v + (b[j] - v) * k);
      out.push(p);
      cuts.push(p);
    } else if (Math.abs(da) <= EPS) cuts.push(a);
  }
  return out.filter((p, i) => Math.hypot(...sub(p, out[(i + out.length - 1) % out.length])) > EPS);
}
/**
 * Split a convex mesh in local width-normalized units; offsets move pieces apart along its normal.
 * @param {ReturnType<typeof polyhedron>} source
 * @param {{plane?:{normal?:number[],offset?:number},interior?:string}} [spec]
 */
export function split(source, spec = {}) {
  options(spec, ['plane', 'interior'], 'polyhedron split');
  const original = data.get(source);
  assert(
    original && !original.config.plane && !splitSources.has(source),
    'INVALID_POLYHEDRON',
    'Split an unsplit polyhedron handle once.',
  );
  source.handle._live();
  const { scene, faces, config, inputs } = original,
    plane = safeCopy(spec.plane ?? { normal: [1, 0, 0], offset: 0 });
  options(plane, ['normal', 'offset'], 'split plane');
  const n = unit(vector(plane.normal ?? [1, 0, 0], 'plane normal')),
    offset = number(plane.offset ?? 0, 'plane offset', -1e6, 1e6),
    interior = spec.interior ?? '#102633';
  assert(rgbaOf(interior)[3] === 1, 'INVALID_POLYHEDRON', 'Interior paint must be opaque.');
  const distances = faces.flatMap((face) => face.points.map((p) => dot(n, p) - offset));
  assert(
    Math.min(...distances) < -EPS && Math.max(...distances) > EPS,
    'INVALID_POLYHEDRON',
    'The plane must pass through the solid interior.',
  );
  const output = [];
  for (let piece = 0; piece < 2; piece++) {
    const sign = piece ? 1 : -1,
      cuts = [];
    for (const face of faces) {
      const points = clipped(face.points, n, offset, sign, cuts);
      if (points.length >= 3 && areaNormal(points)) output.push({ ...face, id: `${piece}-${face.id}`, points, piece });
    }
    const unique = [];
    for (const p of cuts) if (!unique.some((q) => Math.hypot(...sub(p, q)) < EPS)) unique.push(p);
    const centroid = center(unique),
      axis = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])),
      second = cross(n, axis);
    unique.sort(
      (a, b) =>
        Math.atan2(dot(sub(a, centroid), second), dot(sub(a, centroid), axis)) -
        Math.atan2(dot(sub(b, centroid), second), dot(sub(b, centroid), axis)),
    );
    if (dot(normal(unique), n) * sign > 0) unique.reverse();
    output.push({ id: `${piece}-cap`, points: unique, piece, interior: true });
  }
  scene._capacity(output.length + 1);
  assert(scene._recordDepth(source.handle._record) + 2 <= 24, 'RESOURCE_LIMIT', 'Split hierarchy exceeds24 levels.');
  const context = scene._sampleContext();
  project(
    output,
    [...inputs.map((input) => (input instanceof Derived ? input.sample(context) : input.sample(0))), 0, 0],
    { ...config, plane: { normal: n, offset }, interior },
    true,
  );
  return scene._batch(() => {
    const result = create(
      scene,
      output,
      { ...config, plane: { normal: n, offset }, interior },
      [...inputs, scene.parameter(0, { min: 0, max: 1e6 }), scene.parameter(0, { min: 0, max: 1e6 })],
      true,
    );
    for (let i = 0; i < faces.length; i++) source.handle.part(`slot${i}`).set({ opacity: 0 });
    source.handle.add(result.handle);
    splitSources.add(source);
    return result;
  });
}
