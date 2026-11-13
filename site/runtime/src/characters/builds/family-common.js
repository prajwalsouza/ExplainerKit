import { skeleton } from '../../rigs/skeleton.js';
import { radialReach } from '../../rigs/reach.js';
import { assert, number, options, safeCopy } from '../../core/validate.js';
import { rgbaOf } from '../../graphics/cloud.js';
import { ellipse, rounded } from '../shapes.js';
import { tone } from './common.js';

export const frozen = (value) => Object.freeze(value);
export const unit = (value) => Math.max(0, Math.min(1, value));
export const ease = (value) => {
  const t = unit(value);
  return t * t * (3 - 2 * t);
};
export function record(value, keys, label) {
  const result = safeCopy(value ?? {});
  options(result, keys, label);
  return result;
}
export function pigment(value, fallback) {
  const color = value ?? fallback;
  rgbaOf(color);
  return color;
}
export function bodySpec(value, defaults) {
  const b = record(value, ['width', 'length', 'height', 'color', 'pattern'], 'family body');
  assert(
    b.width === undefined || b.length === undefined,
    'INVALID_CHARACTER_FAMILY',
    'Use body width or length, not both.',
  );
  const pattern = b.pattern ?? 'plain';
  assert(
    ['plain', 'spots', 'stripe'].includes(pattern),
    'INVALID_CHARACTER_FAMILY',
    'Body pattern is plain, spots or stripe.',
  );
  return frozen({
    width: number(b.width ?? b.length ?? defaults.width, 'body width', 20, 160),
    height: number(b.height ?? defaults.height, 'body height', 12, 60),
    color: pigment(b.color, defaults.color),
    pattern,
  });
}
export function basicPalette(color) {
  return {
    body: tone(color, color, color),
    ink: tone('#20332e', '#20332e', '#20332e'),
    mark: tone('#44524a', '#44524a', '#44524a'),
    eye: tone('#fffdf2', '#fffdf2', '#fffdf2'),
  };
}
export function bodyParts(body, center, { round = false } = {}) {
  const commands = round
    ? rounded(
        [
          [-body.width / 2, center - body.height / 2],
          [body.width / 2, center - body.height / 2],
          [body.width / 2, center + body.height / 2],
          [-body.width / 2, center + body.height / 2],
        ],
        Math.min(body.height * 0.22, body.width * 0.15),
      )
    : ellipse(0, center, body.width / 2, body.height / 2);
  const parts = [{ id: 'body', bone: 'body', slot: 'body', commands, shade: false, encloses: true, z: 10 }];
  if (body.pattern !== 'plain')
    for (let i = 0; i < 3; i++)
      parts.push({
        id: 'mark' + i,
        bone: 'body',
        slot: 'mark',
        commands: ellipse(
          (i - 1) * body.width * 0.22,
          center + (i % 2 ? 1 : -1) * body.height * 0.08,
          body.width * (body.pattern === 'stripe' ? 0.03 : 0.075),
          body.height * 0.22,
        ),
        shade: false,
        z: 11,
      });
  return parts;
}
export function eyes(headX, headY, radius, bone = 'head') {
  return [
    { id: 'eye', bone, slot: 'eye', commands: ellipse(headX, headY, radius), shade: false, z: 40 },
    {
      id: 'pupil',
      bone,
      slot: 'ink',
      commands: ellipse(headX + radius * 0.3, headY, radius * 0.43),
      shade: false,
      z: 41,
    },
  ];
}
const legModels = new Map(),
  legFrames = new WeakMap();
const point = (value) => ({ x: value[0], y: value[1] });
function legModel(length, joints) {
  const key = length + ':' + joints;
  if (!legModels.has(key)) {
    if (legModels.size >= 128) legModels.delete(legModels.keys().next().value);
    legModels.set(
      key,
      skeleton({
        bones: Array.from({ length: joints }, (_, i) => ({
          id: 'link' + i,
          ...(i ? { parent: 'link' + (i - 1) } : {}),
          length: length / joints,
          limits: [-1e4, 1e4],
        })),
      }),
    );
  }
  return legModels.get(key);
}
/** Shared owned skeleton poses preserve historical two/three-link family seeds. */
export function sampleLegChain(a, b, length, joints, bend = 1, controls = {}) {
  options(controls, ['stretch', 'compress', 'softness', 'pole'], 'family limb controls');
  number(length, 'leg length', 0.001, 1e5);
  assert(joints === 2 || joints === 3, 'INVALID_CHARACTER_FAMILY', 'Family legs need two or three links.');
  assert(bend === 1 || bend === -1, 'INVALID_CHARACTER_FAMILY', 'Family bend must be ±1.');
  for (const p of [a, b]) {
    assert(Array.isArray(p) && p.length === 2, 'INVALID_CHARACTER_FAMILY', 'Family leg points need[x,y].');
    p.forEach((v) => number(v, 'leg coordinate', -1e6, 1e6));
  }
  const stretch = number(controls.stretch === undefined ? 1 : controls.stretch, 'leg stretch', 1, 4),
    compress = number(controls.compress === undefined ? 1 : controls.compress, 'leg compress', 0.25, 1),
    softness = number(controls.softness === undefined ? 0 : controls.softness, 'leg softness', 0, 2e6),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    distance = Math.hypot(dx, dy),
    model = legModel(length, joints);
  assert(
    distance <= length * stretch + 1e-6,
    'CHARACTER_FAMILY_REACH',
    'Family leg target exceeds its declared reach.',
  );
  let pole = controls.pole;
  if (pole !== undefined) {
    assert(Array.isArray(pole) && pole.length === 2, 'INVALID_CHARACTER_FAMILY', 'Family pole needs[x,y].');
    pole.forEach((v) => number(v, 'leg pole', -1e6, 1e6));
    const cross = dx * (pole[1] - a[1]) - dy * (pole[0] - a[0]);
    if (Math.abs(cross) > 1e-12) bend = cross > 0 ? 1 : -1;
  }
  let from, goal;
  if (joints === 2) {
    from = model.pose({ root: point(a), angles: { link1: (-bend * Math.PI) / 2 } });
    goal = { end: 'link1', chainRoot: 'link0', target: point(b), stretch, compress, softness };
    if (distance > 1e-8) goal.pole = pole ? point(pole) : { x: a[0] - dy * bend, y: a[1] + dx * bend };
  } else {
    const reach = radialReach(length, 0, distance, stretch, compress, softness),
      d = reach.effectiveDistance,
      ux = distance > 1e-9 ? dx / distance : 1,
      uy = distance > 1e-9 ? dy / distance : 0,
      nx = -uy * bend,
      ny = ux * bend,
      link = (length * reach.scale) / 3,
      c = Math.max(-0.5, Math.min(1, (d / link - 1) / 2)),
      sn = Math.sqrt(Math.max(0, 1 - c * c)),
      target = [a[0] + ux * d, a[1] + uy * d],
      points = [
        a,
        [a[0] + ux * link * c + nx * link * sn, a[1] + uy * link * c + ny * link * sn],
        [a[0] + ux * link * (c + 1) + nx * link * sn, a[1] + uy * link * (c + 1) + ny * link * sn],
        target,
      ],
      angles = {},
      scale = {};
    let previous = 0;
    for (let i = 0; i < 3; i++) {
      const angle = Math.atan2(points[i + 1][1] - points[i][1], points[i + 1][0] - points[i][0]);
      angles['link' + i] = angle - previous;
      scale['link' + i] = reach.scale;
      previous = angle;
    }
    from = model.pose({ root: point(a), angles, scale });
    goal = { end: 'link2', chainRoot: 'link0', target: point(target) };
  }
  const solved = model.solveGoals({ from, goals: [goal], iterations: 1, restarts: 0, tolerance: 1e-7 }),
    commands = [['M', ...a], ...solved.pose.bones.map((bone) => ['L', bone.end.x, bone.end.y])];
  return Object.freeze({
    commands: Object.freeze(commands.map((c) => Object.freeze(c))),
    pose: solved.pose,
    diagnostics: solved,
  });
}
/** Compatibility geometry helper, now backed by the shared skeleton. */
export function legChain(a, b, length, joints, bend = 1, controls = {}) {
  return sampleLegChain(a, b, length, joints, bend, controls).commands;
}
/** Resolve once before all family part drawing, keeping foot artwork on the solved endpoint. */
export function resolveFamilyLeg(pose, id, a, b, length, joints, bend, controls) {
  const sample = sampleLegChain(a, b, length, joints, bend, controls);
  let cache = legFrames.get(pose);
  if (!cache) {
    cache = new Map();
    legFrames.set(pose, cache);
  }
  cache.set(id, sample);
  return sample;
}
export function familyLegCommands(pose, id) {
  return legFrames.get(pose)?.get(id)?.commands;
}
/** Quantised normalized phase avoids different floating-point reductions at t and t+n/f. */
export function cycle(time, frequency) {
  const v = time * frequency,
    phase = v - Math.floor(v);
  return (Math.round(phase * 1e8) % 1e8) / 1e8;
}
export function gaitFoot(distance, total, length, phase, lift) {
  if (total === 0) return { x: 0, y: 0 };
  const count = Math.max(1, Math.ceil(total / (length * 0.27))),
    slot = total / (count + 2);
  assert(count <= 4096, 'RESOURCE_LIMIT', 'Family gait exceeds4096 strides; split the move clip.');
  let from = 0,
    world = 0,
    y = 0;
  for (let i = 0; i <= count; i++) {
    const a = (i + phase) * slot,
      b = (i + phase + 0.45) * slot,
      to = i === count ? total : (i + 1) * slot;
    if (distance >= b) {
      from = to;
      world = to;
      continue;
    }
    if (distance > a) {
      const k = (distance - a) / (b - a);
      world = from + (to - from) * ease(k);
      y = -lift * Math.sin(Math.PI * k);
    }
    break;
  }
  return { x: world - distance, y };
}
