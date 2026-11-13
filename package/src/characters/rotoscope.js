import { assert, number, options, safeCopy } from '../core/validate.js';
import { compileCharacter, solveBones } from './runtime.js';
import { localBounds } from '../core/transform.js';
const coordinate = (point, label) => {
  if (Array.isArray(point)) {
    assert(point.length === 2, 'INVALID_POSE_TRACK', `${label} needs two coordinates.`);
    return [number(point[0], label + ' x'), number(point[1], label + ' y')];
  }
  assert(point && typeof point === 'object', 'INVALID_POSE_TRACK', `${label} needs coordinates.`);
  return [number(point.x ?? point.cx, label + ' x'), number(point.y ?? point.cy, label + ' y')];
};
const inverse = (value) => {
  let m = safeCopy(value);
  if (Array.isArray(m) && m.length === 3 && m.every((row) => Array.isArray(row) && row.length === 3))
    m = [m[0][0], m[1][0], m[0][1], m[1][1], m[0][2], m[1][2]];
  assert(Array.isArray(m) && m.length === 6, 'INVALID_POSE_CAMERA', 'Use a world-to-image affine matrix.');
  m = m.map((v) => number(v, 'camera matrix'));
  const determinant = m[0] * m[3] - m[1] * m[2];
  assert(Math.abs(determinant) > 1e-10, 'INVALID_POSE_CAMERA', 'Camera matrix is singular.');
  return [
    m[3] / determinant,
    -m[1] / determinant,
    -m[2] / determinant,
    m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant,
    (m[1] * m[4] - m[0] * m[5]) / determinant,
  ];
};
const transform = (matrix, point) => [
  matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
  matrix[1] * point[0] + matrix[3] * point[1] + matrix[5],
];
function dataMember(input, key, code = 'INVALID_POSE_CAMERA') {
  if (input == null) return undefined;
  let current = input,
    depth = 0;
  while (current && depth++ < 16) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) {
      assert('value' in descriptor, code, 'Measurement configuration cannot contain accessors.');
      return descriptor.value;
    }
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}
function matrixValue(value) {
  return Array.isArray(value) ? value : (dataMember(value, 'matrix') ?? value);
}
function cameraReader(input) {
  if (input === undefined) return () => [1, 0, 0, 1, 0, 0];
  if (typeof input === 'function') return (t) => input(t);
  const view = dataMember(input, 'view');
  if (typeof view === 'function') return (t) => matrixValue(view.call(input, { time: t }));
  const sample = dataMember(input, 'sample');
  if (typeof sample === 'function') return (t) => sample.call(input, t);
  if (Array.isArray(input)) {
    const first = Object.getOwnPropertyDescriptor(input, 0);
    assert(first && 'value' in first, 'INVALID_POSE_CAMERA', 'Camera arrays must use dense data entries.');
    if (typeof first.value === 'number' || Array.isArray(first.value)) {
      const matrix = safeCopy(input);
      return () => matrix;
    }
  }
  const matrix = dataMember(input, 'matrix');
  if (matrix !== undefined) return () => matrix;
  const source = Array.isArray(input) ? input : dataMember(input, 'samples');
  assert(
    Array.isArray(source) &&
      source.length > 0 &&
      source.length <= 10000 &&
      Reflect.ownKeys(source).length === source.length + 1,
    'INVALID_POSE_CAMERA',
    'Use bounded dense camera samples.',
  );
  const rows = Array.from({ length: source.length }, (_, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(source, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_POSE_CAMERA', 'Camera rows must be data.');
    const row = descriptor.value,
      position = dataMember(row, 'cameraPosition'),
      rigid = dataMember(row, 'rigidCamera');
    return {
      t: dataMember(row, 't'),
      cameraMatrix: safeCopy(dataMember(row, 'cameraMatrix') ?? dataMember(row, 'matrix') ?? null),
      unavailable: dataMember(position, 'panIdentifiable') === false || dataMember(rigid, 'panIdentifiable') === false,
    };
  });
  let previous = -1;
  for (const row of rows) {
    number(row.t, 'camera sample time', 0, 86400);
    assert(row.t > previous, 'INVALID_POSE_CAMERA', 'Camera samples must increase.');
    previous = row.t;
  }
  return (time) => {
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].t <= time) lo = mid + 1;
      else hi = mid;
    }
    const row = rows[Math.max(0, lo - 1)];
    if (row.unavailable) return null;
    return row.cameraMatrix ?? row.matrix ?? null;
  };
}
function groundReader(input) {
  if (typeof input === 'number') {
    number(input, 'pose ground');
    return () => input;
  }
  if (typeof input === 'function') return (t, x) => number(input(t, x), 'pose ground');
  const atGround = dataMember(input, 'yAt', 'INVALID_POSE_TRACK');
  if (typeof atGround === 'function') return (t, x) => number(atGround.call(input, x), 'pose ground');
  if (Array.isArray(input)) {
    const rows = safeCopy(input);
    assert(rows.length >= 2 && rows.length <= 10000, 'INVALID_POSE_TRACK', 'Ground tracks have2–10000 samples.');
    rows.forEach((r, i) => {
      assert(Array.isArray(r) && r.length === 2, 'INVALID_POSE_TRACK', 'Ground samples are [time,y].');
      number(r[0], 'ground time', 0, 86400);
      number(r[1], 'ground y');
      assert(!i || r[0] > rows[i - 1][0], 'INVALID_POSE_TRACK', 'Ground times must increase.');
    });
    return (t) => {
      if (t <= rows[0][0]) return rows[0][1];
      for (let i = 1; i < rows.length; i++)
        if (t <= rows[i][0]) {
          const a = rows[i - 1],
            b = rows[i];
          return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]);
        }
      return rows.at(-1)[1];
    };
  }
  assert(input === undefined, 'INVALID_POSE_TRACK', 'Ground is numeric, a pure curve, a surface or [time,y] samples.');
  return null;
}
/** Convert measured image-space endpoints into partial native pose keys and a root-follow track. */
export function keysFromPoseTrack(track, spec = {}) {
  options(spec, ['camera', 'ground', 'size', 'rig', 'confidence', 'facing', 'labels'], 'pose track conversion');
  const source = safeCopy(track);
  assert(
    source?.protocol === 'explainerkit.pose/2' &&
      Array.isArray(source.samples) &&
      source.samples.length >= 2 &&
      source.samples.length <= 10000,
    'INVALID_POSE_TRACK',
    'Use2–10000 explainerkit.pose/2 samples.',
  );
  const def = spec.rig?.order ? spec.rig : compileCharacter(spec.rig),
    layout = def.poseLayout;
  assert(
    layout &&
      def.bones.head &&
      ['handF.x', 'handB.x', 'footF.x', 'footB.x'].every((key) => Object.hasOwn(def.rest, key)),
    'POSE_RIG_UNSUPPORTED',
    'Pose conversion requires declared biped layout and endpoint channels.',
  );
  const size = number(spec.size ?? 1, 'pose rig size', 0.001, 1000),
    threshold = number(spec.confidence ?? 0.6, 'pose confidence', 0, 1),
    defaultFacing = spec.facing ?? 1;
  assert(defaultFacing === 1 || defaultFacing === -1, 'INVALID_POSE_TRACK', 'Facing is1 or-1.');
  const labels = {
    handF: 'handRight',
    handB: 'handLeft',
    footF: 'footRight',
    footB: 'footLeft',
    ...safeCopy(spec.labels ?? {}),
  };
  options(labels, ['handF', 'handB', 'footF', 'footB'], 'pose labels');
  assert(
    Object.values(labels).every((v) => typeof v === 'string'),
    'INVALID_POSE_TRACK',
    'Endpoint labels must be names.',
  );
  const camera = cameraReader(spec.camera),
    ground = groundReader(spec.ground),
    headPart = def.parts.find(
      (p) => p.bone === 'head' && p.local?.length && (p.encloses || p.id === 'headFill' || p.id === 'head'),
    ),
    headBox = headPart ? localBounds({ type: 'path', props: { commands: headPart.local } }) : null,
    headCenter = headBox ? [headBox.x + headBox.width / 2, headBox.y + headBox.height / 2] : [0, 0],
    keys = [],
    rootTrack = [],
    skipped = [];
  let previous = -1,
    partials = 0;
  for (const row of source.samples) {
    const t = number(row.t, 'pose time', 0, 86400);
    assert(t > previous, 'INVALID_POSE_TRACK', 'Pose sample times must increase.');
    previous = t;
    const pose = row.pose,
      confidence = number(row.confidence ?? pose?.confidence ?? 1, 'pose sample confidence', 0, 1);
    if (!pose?.head || confidence < threshold) {
      skipped.push({ time: t, reason: pose?.head ? 'confidence' : 'head-missing' });
      continue;
    }
    let matrix;
    try {
      const value = camera(t);
      if (value == null) {
        skipped.push({ time: t, reason: 'camera-unavailable' });
        continue;
      }
      matrix = inverse(matrixValue(value));
    } catch (error) {
      if (error.code === 'INVALID_POSE_CAMERA') throw error;
      throw error;
    }
    const world = (point) => transform(matrix, coordinate(point, 'pose point')),
      head = world(pose.head),
      labelled = pose.labelled ?? {},
      ends = labelled.ends ?? {},
      limbs = labelled.limbs ?? {},
      face = row.facing ?? pose.facing ?? defaultFacing;
    assert(face === 1 || face === -1, 'INVALID_POSE_TRACK', 'Sample facing is1 or-1.');
    const limbConfidence = number(
        labelled.confidence ?? (labelled.status === 'ambiguous' ? 0.5 : 1),
        'limb confidence',
        0,
        1,
      ),
      complete = limbConfidence >= threshold && Object.values(labels).every((label) => ends[label] !== undefined),
      starts = Object.entries(labels)
        .filter(([channel]) => channel.startsWith('foot'))
        .map(([, label]) => limbs[label]?.[0])
        .filter(Boolean),
      hip = starts.length
        ? starts.map(world).reduce((a, p) => [a[0] + p[0] / starts.length, a[1] + p[1] / starts.length], [0, 0])
        : null;
    const restWorld = solveBones(def, def.rest),
      restHead = [restWorld.head.x + headCenter[0], restWorld.head.y + headCenter[1]],
      rootX = hip ? hip[0] - layout.HIP[0] * size * face : head[0] - restHead[0] * size * face,
      rootY = ground ? ground(t, rootX) : hip ? hip[1] - layout.HIP[1] * size : head[1] - restHead[1] * size;
    let bodyRotation = 0;
    const shoulders = Object.entries(labels)
      .filter(([channel]) => channel.startsWith('hand'))
      .map(([, label]) => limbs[label]?.[0])
      .filter(Boolean);
    if (hip && shoulders.length) {
      const center = shoulders
          .map(world)
          .reduce((a, p) => [a[0] + p[0] / shoulders.length, a[1] + p[1] / shoulders.length], [0, 0]),
        restShoulder = [
          (layout.SHOULDER.F[0] + layout.SHOULDER.B[0]) / 2 - layout.HIP[0],
          (layout.SHOULDER.F[1] + layout.SHOULDER.B[1]) / 2 - layout.HIP[1],
        ];
      bodyRotation =
        Math.atan2((center[1] - hip[1]) / size, (center[0] - hip[0]) / (size * face)) -
        Math.atan2(restShoulder[1], restShoulder[0]);
      bodyRotation = Math.atan2(Math.sin(bodyRotation), Math.cos(bodyRotation));
    }
    const patch = { 'body.r': bodyRotation, 'body.y': hip ? (hip[1] - rootY) / size - layout.HIP[1] : 0 };
    const solved = solveBones(def, { ...def.rest, ...patch }),
      neck = solved.head,
      observed = [(head[0] - rootX) / (size * face) - neck.x, (head[1] - rootY) / size - neck.y];
    if (Math.hypot(...headCenter) > 1e-6 && Math.hypot(...observed) > 1e-6)
      patch['head.r'] = Math.atan2(observed[1], observed[0]) - Math.atan2(headCenter[1], headCenter[0]) - neck.r;
    if (complete)
      for (const [channel, label] of Object.entries(labels)) {
        const p = world(ends[label]);
        patch[channel + '.x'] = (p[0] - rootX) / (size * face);
        patch[channel + '.y'] = (p[1] - rootY) / size;
      }
    else partials++;
    const duration = keys.length ? t - keys.at(-1).at : 0;
    keys.push(Object.freeze({ at: t, pose: Object.freeze(patch), facing: face, duration, ease: 'linear' }));
    rootTrack.push(Object.freeze([t, number(rootX, 'recovered root x'), number(rootY, 'recovered root y')]));
  }
  assert(keys.length >= 2, 'POSE_TRACK_EMPTY', 'At least two confident camera-resolved frames are required.');
  return Object.freeze({
    keys: Object.freeze(keys),
    rootTrack: Object.freeze(rootTrack),
    followOptions: Object.freeze({ feet: 'none', lean: 0 }),
    diagnostics: Object.freeze({
      accepted: keys.length,
      partial: partials,
      skipped: Object.freeze(skipped.map((row) => Object.freeze(row))),
      rootConvention: 'hip translation; body.x is absorbed into root x',
      size,
    }),
  });
}

// Shared internal measurement adapters for the additive dense fixed-skeleton fitting path.
export {
  cameraReader as poseCameraReader,
  inverse as invertPoseCamera,
  coordinate as measuredPosePoint,
  transform as transformPosePoint,
  matrixValue as poseCameraMatrix,
};
