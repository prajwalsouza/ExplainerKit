import { assert, number, options, safeCopy } from '../core/validate.js';
import { skeleton } from '../rigs/skeleton.js';
import { bipedShoulder } from './pose-layout.js';
const names = ['armF', 'armB', 'legF', 'legB'],
  models = new Map(),
  resolved = new WeakMap();
const point = (p) => ({ x: p[0], y: p[1] });
const lerp = (a, b, t) => a + (b - a) * t;
function modelFor(lengths) {
  const key = lengths.join(':');
  if (!models.has(key)) {
    if (models.size >= 128) models.delete(models.keys().next().value);
    models.set(
      key,
      skeleton({
        bones: [
          { id: 'upper', length: lengths[0], limits: [-1e4, 1e4] },
          { id: 'lower', parent: 'upper', length: lengths[1], limits: [-1e4, 1e4] },
        ],
      }),
    );
  }
  return models.get(key);
}
export function limbOrigin(pose, name, layout) {
  const limb = layout.limbs[name],
    r = pose['body.r'] ?? 0,
    c = Math.cos(r),
    s = Math.sin(r);
  if (name.startsWith('arm')) return bipedShoulder(pose, name.at(-1), layout);
  const x = (limb.origin[0] - layout.HIP[0]) * (pose['body.sx'] ?? 1),
    y = (limb.origin[1] - layout.HIP[1]) * (pose['body.sy'] ?? 1);
  return [layout.HIP[0] + (pose['body.x'] ?? 0) + c * x - s * y, layout.HIP[1] + (pose['body.y'] ?? 0) + s * x + c * y];
}
/** All starter biped limb geometry is sampled through an owned skeleton pose. */
export function sampleJointLimb(pose, name, origin, lengths, bend, target, rotation = pose['body.r'] ?? 0) {
  const cached = resolved.get(pose)?.[name];
  if (cached) return cached;
  const model = modelFor(lengths),
    upper = pose[name + '.upper'],
    lower = pose[name + '.lower'],
    mix = number(pose[name + '.mix'] ?? 1, 'limb IK mix', 0, 1);
  let from = model.pose({
      root: { ...point(origin), rotation },
      angles: { upper: upper ?? 0, lower: lower ?? (bend * Math.PI) / 2 },
    }),
    result = null;
  if (mix > 0) {
    const goal = { end: 'lower', chainRoot: 'upper', target: point(target) };
    const stretch = pose[name + '.stretch'] ?? 1,
      compress = pose[name + '.compress'] ?? 1,
      softness = pose[name + '.softness'] ?? 0;
    Object.assign(goal, { stretch, compress, softness });
    const dx = target[0] - origin[0],
      dy = target[1] - origin[1];
    if (pose[name + '.poleEnabled'] > 0) goal.pole = { x: pose[name + '.poleX'], y: pose[name + '.poleY'] };
    else if (Math.hypot(dx, dy) > 1e-8) goal.pole = { x: origin[0] + dy * bend, y: origin[1] - dx * bend };
    result = model.solveGoals({ from, goals: [goal], iterations: 8, restarts: 1, tolerance: 1e-8 });
    from = mix === 1 ? result.pose : model.blend(from, result.pose, mix);
  }
  const [a, b] = from.bones;
  return Object.freeze({
    target: Object.freeze([...target]),
    root: a.start,
    elbow: a.end,
    tip: b.end,
    angles: Object.freeze([a.angle, b.angle]),
    scale: Object.freeze([a.scale, b.scale]),
    diagnostics: result
      ? Object.freeze({
          status: result.status,
          method: result.diagnostics.method,
          iterations: result.iterations,
          goals: result.goals,
        })
      : Object.freeze({ status: 'forward', goals: Object.freeze([]) }),
  });
}
export function materializeJointPose(pose, layout) {
  if (!layout?.limbs) return pose;
  resolved.delete(pose);
  const output = {};
  for (const name of names) {
    const limb = layout.limbs[name];
    if (!limb) continue;
    const raw = pose[name + '.targetEnabled'] > 0,
      target = [
        raw ? pose[name + '.targetX'] : pose[limb.effector + '.x'],
        (raw ? pose[name + '.targetY'] : pose[limb.effector + '.y']) - (limb.offsetY ?? 0),
      ],
      sample = sampleJointLimb(pose, name, limbOrigin(pose, name, layout), limb.lengths, limb.bend, target);
    pose[name + '.upper'] = sample.angles[0];
    pose[name + '.lower'] = sample.angles[1];
    pose[limb.effector + '.x'] = sample.tip.x;
    pose[limb.effector + '.y'] = sample.tip.y + (limb.offsetY ?? 0);
    output[name] = sample;
  }
  resolved.set(pose, output);
  return pose;
}
export function jointPoseRest(rest, layout) {
  if (!layout?.limbs) return rest;
  const pose = { ...rest };
  for (const name of names)
    if (layout.limbs[name])
      Object.assign(pose, {
        [name + '.mix']: 1,
        [name + '.stretch']: 1,
        [name + '.compress']: 1,
        [name + '.softness']: 0,
        [name + '.poleEnabled']: 0,
        [name + '.poleX']: 0,
        [name + '.poleY']: 0,
        [name + '.targetEnabled']: 0,
        [name + '.targetX']: 0,
        [name + '.targetY']: 0,
      });
  materializeJointPose(pose, layout);
  return pose;
}
/** Capture authored angles/targets into the same numeric pose channels as legacy actions. */
export function flattenJointPose(layout, input, out) {
  if (input.joints !== undefined) {
    assert(layout?.limbs, 'JOINT_POSE_UNSUPPORTED', 'Joint poses need a declared limb skeleton.');
    options(input.joints, Object.keys(layout.limbs), 'pose joints');
    for (const [name, angles] of Object.entries(input.joints)) {
      assert(
        Array.isArray(angles) && angles.length === 2,
        'INVALID_POSE',
        'A limb needs upper and relative lower angles.',
      );
      out[name + '.upper'] = number(angles[0], 'upper angle', -1e4, 1e4);
      out[name + '.lower'] = number(angles[1], 'lower angle', -1e4, 1e4);
      out[name + '.mix'] = 0;
    }
  }
  if (input.effectors !== undefined) {
    assert(layout?.limbs, 'JOINT_POSE_UNSUPPORTED', 'Effectors need a declared limb skeleton.');
    const byEffector = new Map(Object.entries(layout.limbs).map(([name, v]) => [v.effector, name]));
    options(input.effectors, [...byEffector.keys()], 'pose effectors');
    for (const [effector, value] of Object.entries(input.effectors)) {
      options(value, ['target', 'mix', 'pole', 'stretch', 'compress', 'softness'], 'pose effector');
      const name = byEffector.get(effector);
      if (value.target !== undefined) {
        assert(Array.isArray(value.target) && value.target.length === 2, 'INVALID_POSE', 'Effector targets need[x,y].');
        out[effector + '.x'] = number(value.target[0], 'effector x');
        out[effector + '.y'] = number(value.target[1], 'effector y');
        out[name + '.targetX'] = out[effector + '.x'];
        out[name + '.targetY'] = out[effector + '.y'];
        out[name + '.targetEnabled'] = 1;
      }
      out[name + '.mix'] = number(value.mix ?? 1, 'IK mix', 0, 1);
      for (const [key, min, max] of [
        ['stretch', 1, 4],
        ['compress', 0.25, 1],
        ['softness', 0, 2e6],
      ])
        if (value[key] !== undefined) out[name + '.' + key] = number(value[key], key, min, max);
      if (value.pole !== undefined) {
        assert(Array.isArray(value.pole) && value.pole.length === 2, 'INVALID_POSE', 'Pole needs[x,y].');
        out[name + '.poleX'] = number(value.pole[0], 'pole x');
        out[name + '.poleY'] = number(value.pole[1], 'pole y');
        out[name + '.poleEnabled'] = 1;
      }
    }
  }
  return out;
}
export function captureJointPose(layout, input) {
  const value = safeCopy(input),
    out = {};
  flattenJointPose(layout, value, out);
  return out;
}
export function interpolateJointAngles(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return lerp(a, a + delta, t);
}
export function jointPoseSnapshot(pose, layout) {
  if (!layout?.limbs) return null;
  const joints = {},
    effectors = {},
    diagnostics = {};
  for (const [name, limb] of Object.entries(layout.limbs)) {
    joints[name] = Object.freeze([pose[name + '.upper'], pose[name + '.lower']]);
    effectors[limb.effector] = Object.freeze({
      target: Object.freeze(
        resolved.get(pose)?.[name]?.target
          ? [resolved.get(pose)[name].target[0], resolved.get(pose)[name].target[1] + (limb.offsetY ?? 0)]
          : [pose[limb.effector + '.x'], pose[limb.effector + '.y']],
      ),
      ...(pose[name + '.poleEnabled'] > 0
        ? { pole: Object.freeze([pose[name + '.poleX'], pose[name + '.poleY']]) }
        : {}),
      mix: pose[name + '.mix'],
      stretch: pose[name + '.stretch'],
      compress: pose[name + '.compress'],
      softness: pose[name + '.softness'],
    });
    diagnostics[name] = resolved.get(pose)?.[name]?.diagnostics;
  }
  return Object.freeze({
    ...Object.fromEntries(
      ['body.r', 'body.x', 'body.y', 'body.sx', 'body.sy', 'head.r']
        .filter((key) => typeof pose[key] === 'number')
        .map((key) => [key, pose[key]]),
    ),
    joints: Object.freeze(joints),
    effectors: Object.freeze(effectors),
    diagnostics: Object.freeze(diagnostics),
  });
}
/** Lower the shared torso only as needed for declared planted IK feet. */
export function fitJointContacts(pose, layout, strict = false) {
  if (!layout?.limbs) return;
  let lower = 0;
  for (const name of ['legF', 'legB']) {
    const limb = layout.limbs[name];
    if (!limb || (pose[name + '.mix'] ?? 1) < 1) continue;
    const origin = limbOrigin(pose, name, layout),
      target = [pose[limb.effector + '.x'], pose[limb.effector + '.y'] - (limb.offsetY ?? 0)],
      reach = limb.lengths.reduce((a, b) => a + b, 0) * (pose[name + '.stretch'] ?? 1),
      dx = target[0] - origin[0];
    if (Math.abs(dx) > reach + 1e-6) {
      assert(!strict, 'FOLLOW_REACH', 'Planted foot exceeds the declared limb reach.');
      continue;
    }
    const allowed = Math.sqrt(Math.max(0, reach * reach - dx * dx));
    lower = Math.max(lower, target[1] - origin[1] - allowed);
  }
  pose['body.y'] = (pose['body.y'] ?? 0) + Math.max(0, lower);
}
/** Explicit angle retargeting from a fitted/generic skeleton pose; never infer side names or mirror. */
export function characterPoseFromSkeleton(input, spec = {}) {
  options(spec, ['limbs', 'bodyRotation'], 'skeleton character pose');
  const pose = safeCopy(input),
    mapping = safeCopy(spec.limbs);
  options(mapping, names, 'character limb mapping');
  assert(Array.isArray(pose?.bones), 'INVALID_POSE', 'Use a sampled skeleton pose.');
  const byId = new Map(pose.bones.map((b) => [b.id, b])),
    rotation = number(spec.bodyRotation ?? 0, 'body rotation', -1e4, 1e4),
    joints = {};
  for (const [name, pair] of Object.entries(mapping)) {
    assert(
      Array.isArray(pair) && pair.length === 2 && pair.every((id) => typeof id === 'string'),
      'INVALID_POSE',
      'Each mapping names upper and lower bones.',
    );
    const upper = byId.get(pair[0]),
      lower = byId.get(pair[1]);
    assert(
      upper && lower && lower.parent === upper.id,
      'INVALID_POSE',
      'Mapped bones must be an existing parent-child limb.',
    );
    joints[name] = Object.freeze([
      number(upper.rotation, 'upper rotation', -1e4, 1e4) - rotation,
      number(lower.angle, 'lower angle', -1e4, 1e4),
    ]);
  }
  assert(Object.keys(joints).length > 0, 'INVALID_POSE', 'Supply at least one explicit limb mapping.');
  return Object.freeze({ joints: Object.freeze(joints), 'body.r': rotation });
}
