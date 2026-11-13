import { assert, options } from '../core/validate.js';

/** Bind the shared joint pose to ordinary scene handles. No renderer/assets. */
export function bipedRig(drawing, spec = {}) {
  options(spec, ['motion', 'time', 'intent'], 'biped rig');
  options(spec.motion, ['sample', 'dimensions', 'stride', 'stance'], 'biped motion model');
  assert(typeof spec.motion.sample === 'function', 'INVALID_RIG_INPUT', 'Use a biped motion model.');
  assert(
    drawing._ownsInput(spec.time) && (spec.intent === undefined || drawing._ownsInput(spec.intent)),
    'INVALID_BINDING',
    'Time and intent must belong to this scene.',
  );
  drawing._capacity(40);
  const sampleMotion = spec.motion.sample;
  const pose =
    spec.intent === undefined
      ? drawing.derive([spec.time], (time) => sampleMotion(time))
      : drawing.derive([spec.time, spec.intent], (time, intent) => sampleMotion(time, intent));
  const actor = drawing.group(),
    parts = {};
  const bind = (handle, key, fn) => handle.bind(key, { inputs: [pose], map: fn });
  const at = (name, point) => {
    const handle = actor.group();
    for (const axis of ['x', 'y', 'z']) bind(handle, axis, (p) => point(p)[axis]);
    parts[name] = handle;
    return handle;
  };
  const bone = (name, from, to) => {
    const base = at(name + 'Base', from),
      handle = base.group();
    const delta = (p) => {
      const a = from(p),
        b = to(p);
      return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    };
    bind(base, 'rotationY', (p) => {
      const d = delta(p);
      return Math.atan2(d.x, d.z);
    });
    bind(handle, 'rotationX', (p) => {
      const d = delta(p);
      return -Math.atan2(Math.hypot(d.x, d.z), -d.y);
    });
    parts[name] = handle;
  };
  const hip = at('hip', (p) => p.pelvis),
    torsoBase = at('torsoBase', (p) => ({ ...p.pelvis, y: p.pelvis.y + 0.06 }));
  const headBase = at('headBase', (p) => p.head);
  parts.torso = torsoBase.group();
  parts.head = headBase.group();
  bind(hip, 'rotationY', (p) => p.pelvisHeading);
  bind(hip, 'rotation', (p) => p.pelvisRoll);
  bind(torsoBase, 'rotationY', (p) => p.chestHeading);
  bind(parts.torso, 'rotationX', (p) => p.lean);
  bind(headBase, 'rotationY', (p) => p.headYaw);
  bind(parts.head, 'rotationX', (p) => p.headPitch);
  for (const [index, side] of ['L', 'R'].entries()) {
    bone(
      'thigh' + side,
      (p) => p.legs[index].root,
      (p) => p.legs[index].joint,
    );
    bone(
      'shin' + side,
      (p) => p.legs[index].joint,
      (p) => p.legs[index].tip,
    );
    bone(
      'upper' + side,
      (p) => p.arms[index].root,
      (p) => p.arms[index].joint,
    );
    bone(
      'fore' + side,
      (p) => p.arms[index].joint,
      (p) => p.arms[index].tip,
    );
    at('hand' + side, (p) => p.arms[index].tip);
    const foot = at('foot' + side, (p) => p.legs[index].tip);
    bind(foot, 'rotationY', (p) => p.feet[index].heading);
  }
  return { actor, parts, pose };
}
