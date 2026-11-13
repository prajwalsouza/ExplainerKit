import { assert, number, options } from '../core/validate.js';
import { rigPoint3D, solveTwoBone3D } from '../rigs/two-bone-3d.js';

const TAU = Math.PI * 2;
const blend = (a, b, t) => a + (b - a) * t;
const ease = (t) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u * (10 + u * (-15 + 6 * u));
};
const between = (a, b, t) => ({ x: blend(a.x, b.x, t), y: blend(a.y, b.y, t), z: blend(a.z, b.z, t) });
const moved = (p, x, y, z) => ({ x: p.x + x, y: p.y + y, z: p.z + z });
function reachArc(root, start, target, weight, maximum) {
  const a = [start.x - root.x, start.y - root.y, start.z - root.z];
  const b = [target.x - root.x, target.y - root.y, target.z - root.z];
  const la = Math.hypot(...a),
    lb = Math.hypot(...b);
  const u = a.map((v) => v / Math.max(1e-12, la)),
    v = lb < 1e-10 ? u : b.map((n) => n / lb);
  const dot = Math.max(
    -1,
    Math.min(
      1,
      u.reduce((sum, n, i) => sum + n * v[i], 0),
    ),
  );
  let tangent = v.map((n, i) => n - dot * u[i]),
    length = Math.hypot(...tangent);
  if (length < 1e-8) {
    const axis = u.map(Math.abs).indexOf(Math.min(...u.map(Math.abs)));
    tangent = u.map((n, i) => (i === axis ? 1 : 0) - u[axis] * n);
    length = Math.hypot(...tangent);
  }
  const angle = Math.acos(dot) * weight;
  const direction = u.map((n, i) => n * Math.cos(angle) + (tangent[i] / length) * Math.sin(angle));
  const point = (radius) => moved(root, direction[0] * radius, direction[1] * radius, direction[2] * radius);
  return { effective: point(blend(la, Math.min(lb, maximum), weight)), requested: point(blend(la, lb, weight)) };
}

/** Lightweight authored gait, support transfer and reach; no clock or physics. */
export function bipedMotion(spec = {}) {
  options(
    spec,
    [
      'path',
      'stride',
      'stance',
      'legLength',
      'armLength',
      'hipWidth',
      'hipHeight',
      'stepHeight',
      'footHeight',
      'spineLength',
      'shoulderWidth',
      'sway',
      'armSwing',
    ],
    'biped motion',
  );
  assert(typeof spec.path === 'function', 'INVALID_RIG_INPUT', 'Provide a pure path(time) callback.');
  // Copy the callback identity. Later edits to the caller's descriptor do not change the model.
  const path = spec.path;
  const stride = number(spec.stride ?? 1.1, 'stride seconds', 0.3, 4);
  const stance = number(spec.stance ?? 0.62, 'stance fraction', 0.55, 0.8);
  const legLength = number(spec.legLength ?? 0.4, 'leg segment', 0.01, 10);
  const armLength = number(spec.armLength ?? 0.32, 'arm segment', 0.01, 10);
  const hipWidth = number(spec.hipWidth ?? 0.26, 'hip width', 0.01, legLength);
  const hipHeight = number(spec.hipHeight ?? legLength * 1.88, 'hip height', legLength, legLength * 1.98);
  const stepHeight = number(spec.stepHeight ?? legLength * 0.16, 'step height', 0, legLength * 0.5);
  const footHeight = number(spec.footHeight ?? legLength * 0.15, 'ankle height', 0, legLength * 0.3);
  const spineLength = number(spec.spineLength ?? 0.58, 'spine length', 0.01, 10);
  const shoulderWidth = number(spec.shoulderWidth ?? 0.54, 'shoulder width', 0.01, 10);
  const sway = number(spec.sway ?? 0.55, 'support sway', 0, 1);
  const armSwing = number(spec.armSwing ?? 0.18, 'arm swing radians', 0, 0.6);
  const dimensions = Object.freeze({ legLength, armLength, hipWidth, spineLength, shoulderWidth, footHeight });
  function route(time) {
    const row = path(time);
    options(row, ['x', 'z', 'heading'], 'biped path sample');
    return {
      x: number(row.x, 'path x', -1000, 1000),
      z: number(row.z ?? 0, 'path z', -1000, 1000),
      heading: number(row.heading, 'path heading', -1e6, 1e6),
    };
  }
  function sample(time, intent = {}) {
    number(time, 'motion time', -86400, 86400);
    options(intent, ['weightShift', 'reach', 'posture', 'lookAt', 'lift', 'crouch'], 'biped intent');
    const posture = intent.posture ?? {};
    options(posture, ['lean', 'twist'], 'posture');
    const leanIntent = number(posture.lean ?? 0, 'posture lean', -0.5, 0.5);
    const twist = number(posture.twist ?? 0, 'posture twist', -0.6, 0.6);
    const lift = number(intent.lift ?? 0, 'authored lift', 0, 10);
    const crouch = number(intent.crouch ?? 0, 'authored crouch', 0, legLength * 0.5);
    const base = route(time),
      forward = { x: Math.sin(base.heading), z: Math.cos(base.heading) };
    const right = { x: Math.cos(base.heading), z: -Math.sin(base.heading) };
    const phase = time / stride,
      cycle = phase - Math.floor(phase);
    const feet = [0, 0.5].map((offset, index) => {
      const local = phase + offset,
        step = Math.floor(local),
        u = local - step;
      const anchor = (k) => {
        const p = route((k - offset + stance / 2) * stride),
          side = ((index ? 1 : -1) * hipWidth) / 2;
        return {
          x: p.x + Math.cos(p.heading) * side,
          y: footHeight,
          z: p.z - Math.sin(p.heading) * side,
          heading: p.heading,
        };
      };
      const a = anchor(step),
        b = anchor(step + 1),
        swing = u <= stance ? 0 : (u - stance) / (1 - stance);
      const moving = Math.min(1, Math.hypot(b.x - a.x, b.z - a.z) / (legLength * 0.2));
      const point = between(a, b, ease(swing));
      point.y += 16 * swing * swing * (1 - swing) * (1 - swing) * stepHeight * moving;
      return {
        point,
        planted: u <= stance,
        phase: u,
        heading: a.heading + Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)) * ease(swing),
        moving,
      };
    });
    // Transfer toward the stance leg. This is an authored support heuristic,
    // not a force/torque solver or an estimate of anatomical centre of mass.
    const before = route(time - stride * 0.02),
      after = route(time + stride * 0.02);
    const walking = Math.min(1, Math.hypot(after.x - before.x, after.z - before.z) / (0.04 * legLength * 0.2));
    const support =
      intent.weightShift === undefined
        ? -Math.sin(TAU * (cycle - 0.06)) * sway * walking
        : number(intent.weightShift, 'weight shift', -1, 1);
    const pelvis = {
      x: base.x + (right.x * support * hipWidth) / 2,
      y: hipHeight + footHeight - legLength * 0.025 * (1 - Math.cos(TAU * cycle * 2)) * walking - crouch,
      z: base.z + (right.z * support * hipWidth) / 2,
    };
    const pelvisHeading = base.heading + Math.sin(TAU * cycle) * 0.045 * walking;
    const pelvisRoll = Math.sin(TAU * cycle) * 0.025 * walking;
    const hips = [-1, 1].map((side) =>
      moved(
        pelvis,
        (Math.cos(pelvisHeading) * side * hipWidth) / 2,
        (side * Math.sin(pelvisRoll) * hipWidth) / 2,
        (-Math.sin(pelvisHeading) * side * hipWidth) / 2,
      ),
    );
    const hipOffsets = hips.map((hip) => hip.y - pelvis.y);
    const maximumLegReach = legLength * 1.98;
    const reachExcess = [];
    hips.forEach((hip, index) => {
      const foot = feet[index].point,
        horizontal = Math.hypot(foot.x - hip.x, foot.z - hip.z);
      reachExcess.push(Math.max(0, horizontal - maximumLegReach));
      pelvis.y = Math.min(
        pelvis.y,
        foot.y + Math.sqrt(Math.max(0, maximumLegReach ** 2 - horizontal ** 2)) - hipOffsets[index],
      );
    });
    hips.forEach((hip, index) => {
      hip.y = pelvis.y + hipOffsets[index];
    });
    const legs = hips.map((hip, index) =>
      solveTwoBone3D({
        root: hip,
        target: feet[index].point,
        lengths: [legLength, legLength],
        pole: { x: forward.x, y: 0, z: forward.z },
      }),
    );
    pelvis.y += lift;
    legs.forEach((leg, index) => {
      // Root objects are also the hip records. Lift exactly once per point.
      for (const point of [leg.root, leg.joint, leg.tip, leg.target]) point.y += lift;
      feet[index].point.y += lift;
      if (lift > 0) feet[index].planted = false;
    });
    const lean = 0.055 * walking + leanIntent;
    const chestHeading = base.heading - Math.sin(TAU * cycle) * 0.075 * walking + twist;
    const shoulderRight = { x: Math.cos(chestHeading), z: -Math.sin(chestHeading) };
    const chest = moved(
      pelvis,
      forward.x * Math.sin(lean) * spineLength * 0.78,
      Math.cos(lean) * spineLength * 0.78,
      forward.z * Math.sin(lean) * spineLength * 0.78,
    );
    const head = moved(
      chest,
      forward.x * Math.sin(lean) * spineLength * 0.2,
      spineLength * 0.38,
      forward.z * Math.sin(lean) * spineLength * 0.2,
    );
    let headYaw = chestHeading,
      headPitch = 0;
    if (intent.lookAt !== undefined) {
      const target = rigPoint3D(intent.lookAt, 'look target');
      const dx = target.x - head.x,
        dz = target.z - head.z;
      const yaw = Math.atan2(dx, dz) - chestHeading;
      headYaw += Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(yaw), Math.cos(yaw))));
      headPitch = -Math.max(-0.65, Math.min(0.65, Math.atan2(target.y - head.y, Math.hypot(dx, dz))));
    }
    let request = null;
    if (intent.reach !== undefined) {
      options(intent.reach, ['side', 'target', 'weight'], 'reach intent');
      assert(['left', 'right'].includes(intent.reach.side), 'INVALID_RIG_INPUT', 'Reach with left or right.');
      request = {
        side: intent.reach.side,
        target: rigPoint3D(intent.reach.target),
        weight: number(intent.reach.weight ?? 1, 'reach weight', 0, 1),
      };
    }
    const arms = [-1, 1].map((side, index) => {
      const shoulder = moved(
        chest,
        (shoulderRight.x * side * shoulderWidth) / 2,
        0,
        (shoulderRight.z * side * shoulderWidth) / 2,
      );
      const swing = -0.2 + side * Math.sin(TAU * cycle) * armSwing * walking;
      const direction = (angle) => ({
        x: forward.x * Math.sin(angle) * Math.cos(0.1) + shoulderRight.x * side * Math.sin(0.1),
        y: -Math.cos(angle) * Math.cos(0.1),
        z: forward.z * Math.sin(angle) * Math.cos(0.1) + shoulderRight.z * side * Math.sin(0.1),
      });
      const upper = direction(swing),
        lower = direction(swing + 0.5);
      const neutralElbow = moved(shoulder, upper.x * armLength, upper.y * armLength, upper.z * armLength);
      let target = moved(neutralElbow, lower.x * armLength, lower.y * armLength, lower.z * armLength);
      let requested = target;
      if (request?.side === (index ? 'right' : 'left')) {
        const arc = reachArc(shoulder, target, request.target, request.weight, armLength * 1.95);
        target = arc.effective;
        requested = arc.requested;
      }
      const result = solveTwoBone3D({
        root: shoulder,
        target,
        lengths: [armLength, armLength],
        reachMargin: armLength * 0.05,
        pole: { x: -forward.x, y: 0, z: -forward.z },
      });
      const error = Math.hypot(result.tip.x - requested.x, result.tip.y - requested.y, result.tip.z - requested.z);
      return { ...result, target: requested, error, reachable: error < 1e-9 };
    });
    return {
      time,
      heading: base.heading,
      pelvisHeading,
      pelvisRoll,
      chestHeading,
      headYaw,
      headPitch,
      lean,
      pelvis,
      chest,
      head,
      feet,
      legs,
      arms,
      support,
      dimensions,
      diagnostics: {
        reachable: [...legs, ...arms].every((limb) => limb.reachable),
        legError: Math.max(...legs.map((limb) => limb.error)),
        armError: Math.max(...arms.map((limb) => limb.error)),
        pathTooFast: reachExcess.some((v) => v > 0),
      },
    };
  }
  sample(0); // Validate the first callback result before a scene can be bound.
  return Object.freeze({ sample, dimensions, stride, stance });
}
