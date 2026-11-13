import { assert, number, options } from '../../core/validate.js';
import { ellipse } from '../shapes.js';
import { boneToRoot, solveBones } from '../runtime.js';
import {
  frozen,
  unit,
  record,
  bodySpec,
  basicPalette,
  bodyParts,
  eyes,
  legChain,
  resolveFamilyLeg,
  familyLegCommands,
  cycle,
  gaitFoot,
} from './family-common.js';

function registerLeg(rest, id) {
  Object.assign(rest, {
    [id + '.stretch']: 1,
    [id + '.compress']: 1,
    [id + '.softness']: 0,
    [id + '.poleEnabled']: 0,
    [id + '.poleX']: 0,
    [id + '.poleY']: 0,
  });
}
const rootRest = () => ({
  'root.y': 0,
  'body.x': 0,
  'body.y': 0,
  'body.r': 0,
  'body.sx': 1,
  'body.sy': 1,
  'head.r': 0,
  'head.turn': 0,
  'look.x': 0,
  'look.y': 0,
  'face.smile': 0,
});
const add = (pose, key, value, w = 1) => {
  pose[key] = (pose[key] ?? 0) + value * w;
};
const peak = (u, ctx) => Math.sin(Math.PI * unit(u / ctx.clip.duration));
function definition(
  name,
  family,
  body,
  parts,
  bones,
  rest,
  actions,
  actionDefaults,
  contacts,
  joints,
  height,
  parameters,
  legs = [],
) {
  return {
    name,
    rig: family,
    height,
    post(pose, _time, context) {
      if (!legs.length) return;
      const world = solveBones(context.def, pose);
      for (const leg of legs) {
        const a = boneToRoot(world, 'body', leg.x, leg.y - leg.cy),
          b = [pose[leg.id + '.x'], pose[leg.id + '.y'] - leg.radius],
          controls = {
            stretch: pose[leg.id + '.stretch'],
            compress: pose[leg.id + '.compress'],
            softness: pose[leg.id + '.softness'],
            ...(pose[leg.id + '.poleEnabled'] > 0 ? { pole: [pose[leg.id + '.poleX'], pose[leg.id + '.poleY']] } : {}),
          },
          sample = resolveFamilyLeg(pose, leg.id, a, b, leg.length, leg.joints, leg.bend, controls),
          tip = sample.pose.bones.at(-1).end;
        pose[leg.id + '.x'] = tip.x;
        pose[leg.id + '.y'] = tip.y + leg.radius;
      }
    },
    palette: basicPalette(body.color),
    parts,
    bones,
    rest,
    actions,
    actionDefaults,
    contacts,
    joints,
    light: [-0.6, -0.8],
    sockets: { head: { part: 'head', at: [0, 0] } },
    meta: frozen({ author: 'ExplainerKit', license: 'CC0-1.0', family, parameters: Object.freeze(parameters) }),
  };
}

/** Parametric four-legged cutout rig, with four-beat walk and diagonal trot. */
export function quadruped(spec = {}) {
  options(spec, ['name', 'body', 'neck', 'legs', 'tail', 'head', 'ears'], 'quadruped');
  const body = bodySpec(spec.body, { width: 90, height: 38, color: '#9b8c72' }),
    l = record(spec.legs, ['length', 'joints', 'width'], 'quadruped legs'),
    length = number(l.length ?? 40, 'leg length', 12, 100),
    joints = l.joints ?? 2,
    width = number(l.width ?? 5, 'leg width', 1, Math.min(12, length * 0.5));
  assert(joints === 2 || joints === 3, 'INVALID_CHARACTER_FAMILY', 'Legs use two or three links.');
  const n = record(spec.neck, ['length', 'rise', 'width'], 'quadruped neck'),
    neck = frozen({
      length: number(n.length ?? 18, 'neck length', 4, 60),
      rise: number(n.rise ?? 10, 'neck rise', 0, 40),
      width: number(n.width ?? 10, 'neck width', 2, 24),
    });
  const h = record(spec.head, ['width', 'height'], 'quadruped head'),
    head = frozen({
      width: number(h.width ?? 30, 'head width', 12, 60),
      height: number(h.height ?? 24, 'head height', 12, 48),
    });
  const e = record(spec.ears, ['length', 'width'], 'quadruped ears'),
    ears = frozen({
      length: number(e.length ?? 12, 'ear length', 0, 30),
      width: number(e.width ?? 6, 'ear width', 2, 20),
    });
  const t = record(spec.tail, ['length', 'width'], 'quadruped tail'),
    tail = frozen({
      length: number(t.length ?? 28, 'tail length', 0, 100),
      width: number(t.width ?? 3, 'tail width', 1, 10),
    });
  const cy = -0.8 * length - body.height / 2,
    front = body.width * 0.28,
    footRadius = width * 0.65,
    hy = cy - neck.rise - head.height * 0.25,
    hx = body.width * 0.4 + neck.length;
  const bones = {
      body: { parent: null, at: [0, cy] },
      neck: { parent: 'body', at: [body.width * 0.35, cy] },
      head: { parent: 'neck', at: [hx, hy] },
      tail: { parent: 'body', at: [-body.width * 0.4, cy] },
    },
    rest = { ...rootRest(), 'neck.r': 0, 'tail.r': 0 };
  const parts = bodyParts(body, cy, { round: true }),
    contacts = [],
    auditJoints = [],
    legSpecs = [];
  for (const id of ['hindB', 'foreB', 'hindF', 'foreF']) {
    const x =
      (id.startsWith('fore') ? 1 : -1) * front + (id.endsWith('B') ? -1 : 1) * Math.min(width * 0.5, body.width * 0.02);
    rest[id + '.x'] = x;
    rest[id + '.y'] = 0;
    const hip = [x, -0.8 * length - 1],
      z = id.endsWith('B') ? 2 : 20;
    legSpecs.push({ id, x, y: hip[1], cy, length, joints, bend: id.startsWith('fore') ? -1 : 1, radius: footRadius });
    registerLeg(rest, id);
    parts.push({
      id: 'leg-' + id,
      bone: null,
      slot: 'body',
      stroke: width,
      length,
      stretch: 0.00001,
      stretchChannel: id + '.stretch',
      z,
      draw: (pose, world) =>
        familyLegCommands(pose, id) ??
        legChain(
          boneToRoot(world, 'body', hip[0], hip[1] - cy),
          [pose[id + '.x'], pose[id + '.y'] - footRadius],
          length,
          joints,
          id.startsWith('fore') ? -1 : 1,
        ),
    });
    parts.push({
      id: 'foot-' + id,
      bone: null,
      slot: 'ink',
      shade: false,
      z: z + 1,
      draw: (pose) => ellipse(pose[id + '.x'], pose[id + '.y'] - footRadius, footRadius, footRadius),
    });
    contacts.push('foot-' + id);
    auditJoints.push(
      { part: 'leg-' + id, end: 'start', to: ['body'] },
      { part: 'leg-' + id, end: 'end', to: ['foot-' + id] },
    );
  }
  parts.push(
    {
      id: 'neck',
      bone: 'neck',
      slot: 'body',
      stroke: neck.width,
      z: 12,
      draw: () => [
        ['M', 0, 0],
        ['L', hx - body.width * 0.35, hy - cy],
      ],
    },
    {
      id: 'head',
      bone: 'head',
      slot: 'body',
      shade: false,
      encloses: true,
      z: 30,
      commands: ellipse(hx, hy, head.width / 2, head.height / 2),
    },
    ...eyes(hx + head.width * 0.12, hy - head.height * 0.08, Math.min(head.width, head.height) * 0.1),
  );
  if (ears.length > 0)
    parts.push({
      id: 'ears',
      bone: 'head',
      slot: 'body',
      shade: false,
      z: 32,
      commands: ellipse(
        hx - head.width * 0.2,
        hy - head.height * 0.3 - ears.length * 0.28,
        ears.width / 2,
        ears.length / 2,
      ),
    });
  if (tail.length > 0)
    parts.push({
      id: 'tail',
      bone: 'tail',
      slot: 'body',
      stroke: tail.width,
      z: 1,
      draw: () => [
        ['M', 0, 0],
        ['Q', -tail.length * 0.6, -tail.length * 0.32, -tail.length, -tail.length * 0.18],
      ],
    });
  const gait =
    (trot = false) =>
    (pose, u, p, c, w) => {
      const d = c.clip.distance(u),
        total = c.clip.distance(c.clip.duration),
        lift = number(p.lift ?? length * 0.15, 'gait lift', 0, length * 0.3),
        phases = trot ? [0, 0.5, 0.5, 0] : [0, 0.5, 0.25, 0.75];
      for (const [i, id] of ['hindB', 'foreB', 'hindF', 'foreF'].entries()) {
        const foot = gaitFoot(d, total, length, phases[i], lift);
        pose[id + '.x'] = rest[id + '.x'] + foot.x;
        pose[id + '.y'] = foot.y;
      }
      add(pose, 'tail.r', Math.sin(2 * Math.PI * cycle(d / Math.max(length, 1), 1)) * 0.06, w);
    };
  const actions = {
    walk: gait(),
    trot: gait(true),
    graze(pose, u, p, c, w) {
      add(pose, 'head.r', 0.55 * peak(u, c), w);
      add(pose, 'neck.r', Math.min(0.16, (length / (neck.length + 1)) * 0.1) * peak(u, c), w);
    },
    look(pose, u, p, c, w) {
      add(pose, 'head.r', -0.22 * peak(u, c), w);
    },
    sit(pose, u, p, c, w) {
      add(pose, 'body.y', length * 0.12 * peak(u, c), w);
    },
  };
  auditJoints.push({ part: 'neck', end: 'start', to: ['body'] }, { part: 'neck', end: 'end', to: ['head'] });
  const params = frozen({ body, neck, legs: frozen({ length, joints, width }), head, ears, tail });
  return definition(
    spec.name ?? 'quadruped',
    'quadruped',
    body,
    parts,
    bones,
    rest,
    actions,
    {
      walk: { speed: length * 0.8, lift: length * 0.15 },
      trot: { speed: length * 1.4, lift: length * 0.2 },
      graze: { duration: 1.6 },
      look: { duration: 1.2 },
      sit: { duration: 1.4 },
    },
    contacts,
    auditJoints,
    Math.max(-cy + body.height / 2, -hy + head.height / 2 + ears.length),
    params,
    legSpecs,
  );
}

/** Parametric insect/bird family; periodic wing projection, optional two or four wings. */
export function winged(spec = {}) {
  options(spec, ['name', 'body', 'wings', 'legs'], 'winged');
  const body = bodySpec(spec.body, { width: 48, height: 18, color: '#659d8b' }),
    w = record(spec.wings, ['pairs', 'shape', 'frequency', 'span', 'chord'], 'wings'),
    pairs = w.pairs ?? 1,
    shape = w.shape ?? 'leaf',
    frequency = number(w.frequency ?? 4, 'wing frequency', 0.5, 8),
    span = number(w.span ?? 48, 'wing span', 12, 100),
    chord = number(w.chord ?? 0.2, 'wing chord', 0.12, 0.3);
  assert(pairs === 1 || pairs === 2, 'INVALID_CHARACTER_FAMILY', 'Use one or two wing pairs.');
  assert(
    ['ellipse', 'leaf', 'feather'].includes(shape),
    'INVALID_CHARACTER_FAMILY',
    'Wing shape is ellipse, leaf or feather.',
  );
  const l =
      typeof spec.legs === 'number'
        ? { count: spec.legs }
        : record(spec.legs, ['count', 'length', 'width'], 'winged legs'),
    count = l.count ?? 2,
    legLength = number(l.length ?? 14, 'wing leg length', 0, 40),
    legWidth = number(l.width ?? 2, 'wing leg width', 1, 5);
  assert([0, 2, 4, 6].includes(count), 'INVALID_CHARACTER_FAMILY', 'Winged legs number0,2,4 or6.');
  const cy = 0,
    hx = body.width * 0.42,
    hy = -body.height * 0.08,
    headRadius = Math.min(body.height * 0.46, body.width * 0.18),
    parts = bodyParts(body, cy),
    bones = { body: { parent: null, at: [0, 0] }, head: { parent: 'body', at: [hx, hy] } },
    rest = rootRest();
  for (let pair = 0; pair < pairs; pair++)
    for (const side of [-1, 1]) {
      const id = 'wing' + pair + (side < 0 ? 'B' : 'F'),
        x = (pair - (pairs - 1) / 2) * body.width * 0.25,
        y = 0;
      bones[id] = { parent: 'body', at: [x, y] };
      rest[id + '.sy'] = 1;
      const vertical = span * chord,
        commands =
          shape === 'feather'
            ? [
                ['M', 0, 0],
                ['Q', side * span * 0.4, -vertical * 0.8, side * span, 0],
                ['Q', side * span * 0.45, vertical * 0.9, 0, 0],
                ['Z'],
              ]
            : ellipse(side * span * 0.45, 0, span * 0.45, vertical * (shape === 'leaf' ? 0.75 : 0.5));
      parts.push({
        id,
        bone: id,
        slot: 'body',
        shade: false,
        z: side < 0 ? 2 : 20,
        sharp: shape === 'feather',
        opacity: side < 0 ? 0.7 : 0.9,
        commands: commands.map((command) => command.map((value, i) => (i === 0 ? value : value + (i % 2 ? x : y)))),
      });
    }
  for (let i = 0; i < count; i++) {
    const x = (i / Math.max(1, count - 1) - 0.5) * body.width * 0.5,
      bend = i % 2 ? 1 : -1;
    parts.push({
      id: 'leg' + i,
      bone: null,
      slot: 'ink',
      stroke: legWidth,
      z: 3,
      draw: (pose, world) => {
        const a = boneToRoot(world, 'body', x, body.height * 0.2);
        return [
          ['M', ...a],
          ['L', a[0] + bend * legLength * 0.5, a[1] + legLength * 0.5],
          ['L', a[0] + bend * legLength * 0.7, a[1] + legLength],
        ];
      },
    });
  }
  parts.push(
    {
      id: 'head',
      bone: 'head',
      slot: 'body',
      shade: false,
      encloses: true,
      z: 30,
      commands: ellipse(hx, hy, headRadius),
    },
    ...eyes(hx + headRadius * 0.3, hy - headRadius * 0.1, Math.max(1, headRadius * 0.22)),
  );
  const flap = (pose, u, p, c, weight) => {
    const f = number(p.frequency ?? frequency, 'flap frequency', 0.5, 8),
      value = 0.6 + 0.4 * Math.cos(2 * Math.PI * cycle(u, f));
    for (let pair = 0; pair < pairs; pair++)
      for (const side of ['B', 'F']) pose['wing' + pair + side + '.sy'] = 1 + (value - 1) * weight;
  };
  const actions = {
    flap,
    hover(pose, u, p, c, weight) {
      flap(pose, u, p, c, weight);
      add(pose, 'root.y', body.height * 0.18 * Math.sin(2 * Math.PI * cycle(u, 1)), weight);
    },
    glide(pose, u, p, c, weight) {
      for (let pair = 0; pair < pairs; pair++)
        for (const side of ['B', 'F']) pose['wing' + pair + side + '.sy'] = 1 - 0.15 * peak(u, c) * weight;
    },
    bob(pose, u, p, c, weight) {
      add(pose, 'root.y', body.height * 0.3 * Math.sin(2 * Math.PI * cycle(u, 1)), weight);
    },
  };
  return definition(
    spec.name ?? 'winged',
    'winged',
    body,
    parts,
    bones,
    rest,
    actions,
    {
      hover: { duration: 2, frequency },
      glide: { duration: 2 },
      flap: { duration: 2, frequency },
      bob: { duration: 2 },
    },
    [],
    [],
    Math.max(body.height, span * chord * 1.5, body.height * 0.2 + legLength) + headRadius,
    {
      body,
      wings: frozen({ pairs, shape, frequency, span, chord }),
      legs: frozen({ count, length: legLength, width: legWidth }),
    },
  );
}

/** Grounded jumping family with independent fore/hind reach and a seekable leap arc. */
export function jumper(spec = {}) {
  options(spec, ['name', 'body', 'legs'], 'jumper');
  const body = bodySpec(spec.body, { width: 54, height: 30, color: '#7caa69' }),
    l = record(spec.legs, ['hind', 'fore', 'width'], 'jumper legs'),
    hind = number(l.hind ?? 44, 'hind leg length', 20, 100),
    fore = number(l.fore ?? 26, 'fore leg length', 12, 80),
    width = number(l.width ?? 5, 'jumper leg width', 1, 10),
    minimum = Math.min(hind, fore),
    cy = -minimum * 0.72 - body.height / 2,
    hipY = -minimum * 0.72 - 1,
    radius = width * 0.6;
  const bones = {
      body: { parent: null, at: [0, cy] },
      head: { parent: 'body', at: [body.width * 0.22, cy - body.height * 0.2] },
    },
    rest = rootRest(),
    parts = bodyParts(body, cy, { round: true }),
    contacts = [],
    joints = [],
    legSpecs = [];
  for (const id of ['hindB', 'foreB', 'hindF', 'foreF']) {
    const length = id.startsWith('hind') ? hind : fore,
      x = (id.startsWith('hind') ? -0.28 : 0.28) * body.width + (id.endsWith('B') ? -1 : 1) * width * 0.25;
    rest[id + '.x'] = x;
    rest[id + '.y'] = 0;
    registerLeg(rest, id);
    legSpecs.push({ id, x, y: hipY, cy, length, joints: 2, bend: id.startsWith('hind') ? 1 : -1, radius });
    const z = id.endsWith('B') ? 2 : 20;
    parts.push(
      {
        id: 'leg-' + id,
        bone: null,
        slot: 'body',
        stroke: width,
        length,
        stretch: 0.00001,
        stretchChannel: id + '.stretch',
        z,
        draw: (pose, world) =>
          familyLegCommands(pose, id) ??
          legChain(
            boneToRoot(world, 'body', x, hipY - cy),
            [pose[id + '.x'], pose[id + '.y'] - radius],
            length,
            2,
            id.startsWith('hind') ? 1 : -1,
          ),
      },
      {
        id: 'foot-' + id,
        bone: null,
        slot: 'ink',
        shade: false,
        z: z + 1,
        draw: (pose) => ellipse(pose[id + '.x'], pose[id + '.y'] - radius, radius, radius),
      },
    );
    contacts.push('foot-' + id);
    joints.push(
      { part: 'leg-' + id, end: 'start', to: ['body'] },
      { part: 'leg-' + id, end: 'end', to: ['foot-' + id] },
    );
  }
  const hx = body.width * 0.22,
    hy = cy - body.height * 0.2,
    headRX = body.width * 0.32,
    headRY = body.height * 0.42;
  parts.push(
    {
      id: 'head',
      bone: 'head',
      slot: 'body',
      shade: false,
      encloses: true,
      z: 30,
      commands: ellipse(hx, hy, headRX, headRY),
    },
    ...eyes(hx + headRX * 0.25, hy - headRY * 0.35, Math.min(headRX, headRY) * 0.18),
  );
  const actions = {
    sit(pose, u, p, c, w) {
      add(pose, 'body.y', minimum * 0.08 * peak(u, c), w);
    },
    crouch(pose, u, p, c, w) {
      add(pose, 'body.y', minimum * 0.18 * peak(u, c), w);
    },
    leap(pose, u, p, c, w) {
      const k = unit(u / c.clip.duration),
        height = number(p.height ?? hind * 0.8, 'leap height', hind * 0.4, hind * 3);
      add(pose, 'root.y', -4 * height * k * (1 - k), w);
      add(pose, 'body.sy', -0.06 * Math.sin(Math.PI * k), w);
    },
    spread(pose, u, p, c, w) {
      const k = peak(u, c);
      add(pose, 'root.y', -hind * 0.8 * k, w);
      for (const id of ['hindB', 'foreB', 'hindF', 'foreF'])
        add(pose, id + '.x', (id.startsWith('hind') ? -1 : 1) * minimum * 0.15 * unit((k - 0.12) / 0.88), w);
    },
  };
  return definition(
    spec.name ?? 'jumper',
    'jumper',
    body,
    parts,
    bones,
    rest,
    actions,
    {
      sit: { duration: 1.3 },
      crouch: { duration: 1 },
      leap: { duration: 1, speed: hind * 1.6, height: hind * 0.8 },
      spread: { duration: 1.2 },
    },
    contacts,
    joints,
    -cy + Math.max(body.height / 2, body.height * 0.2 + headRY),
    { body, legs: frozen({ hind, fore, width }) },
    legSpecs,
  );
}

/** Presets remain parameter sets, so callers can change any family proportion. */
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
export const FAMILY_PRESETS = deepFreeze({
  cow: Object.freeze({
    family: 'quadruped',
    options: {
      body: { width: 112, height: 48, color: '#e6e4d5', pattern: 'spots' },
      neck: { length: 22, rise: 6, width: 18 },
      legs: { length: 42, joints: 2, width: 8 },
      head: { width: 38, height: 30 },
      ears: { length: 16, width: 8 },
      tail: { length: 35, width: 3 },
    },
  }),
  mouse: Object.freeze({
    family: 'quadruped',
    options: {
      body: { width: 55, height: 27, color: '#a9aaa0' },
      neck: { length: 8, rise: 5, width: 10 },
      legs: { length: 18, joints: 2, width: 3 },
      head: { width: 27, height: 25 },
      ears: { length: 22, width: 18 },
      tail: { length: 60, width: 2 },
    },
  }),
  dragonfly: Object.freeze({
    family: 'winged',
    options: {
      body: { width: 65, height: 12, color: '#609c91' },
      wings: { pairs: 2, shape: 'leaf', frequency: 6, span: 58, chord: 0.18 },
      legs: { count: 6, length: 12, width: 1.5 },
    },
  }),
  frog: Object.freeze({
    family: 'jumper',
    options: { body: { width: 54, height: 30, color: '#78a564' }, legs: { hind: 44, fore: 26, width: 5 } },
  }),
});
function preset(name, spec) {
  const base = FAMILY_PRESETS[name];
  spec = record(spec, ['name', ...Object.keys(base.options)], name + ' preset');
  const builder = { quadruped, winged, jumper }[base.family],
    settings = { ...base.options, ...spec, name: spec.name ?? name };
  for (const key of Object.keys(base.options))
    if (typeof base.options[key] === 'object') settings[key] = { ...base.options[key], ...(spec[key] ?? {}) };
  return builder(settings);
}
export const cow = (spec = {}) => preset('cow', spec);
export const mouse = (spec = {}) => preset('mouse', spec);
export const dragonfly = (spec = {}) => preset('dragonfly', spec);
export const frog = (spec = {}) => preset('frog', spec);
