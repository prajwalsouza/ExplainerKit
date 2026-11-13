import { assert, number, options } from '../core/validate.js';
const p = Math.PI;
const freezePose = (pose) =>
  Object.freeze(Object.fromEntries(Object.entries(pose).map(([name, pair]) => [name, Object.freeze(pair)])));
/** Original angle-space acting poses, independent of any film or character dimensions. */
export const BIPED_POSES = Object.freeze({
  stand: freezePose({ armF: [1.35, -0.2], armB: [1.8, -0.2], legF: [1.43, 0.25], legB: [1.65, -0.15] }),
  reach: freezePose({ armF: [-0.55, -0.45], armB: [1.8, -0.3], legF: [1.25, 0.4], legB: [1.8, -0.25] }),
  brace: freezePose({ armF: [0.15, -0.55], armB: [2.95, 0.55], legF: [1.1, 0.5], legB: [2.04, -0.5] }),
  'hands-on-hips': freezePose({ armF: [0.8, 2.1], armB: [2.34, -2.1], legF: [1.43, 0.25], legB: [1.65, -0.15] }),
  think: freezePose({ armF: [0.25, -2.35], armB: [1.8, -0.35], legF: [1.43, 0.25], legB: [1.65, -0.15] }),
  'step-back': freezePose({ armF: [1.05, -0.4], armB: [2.1, -0.3], legF: [1.1, 0.45], legB: [2, -0.3] }),
  'arms-up': freezePose({ armF: [-1.25, -0.35], armB: [-1.89, 0.35], legF: [1.43, 0.25], legB: [1.65, -0.15] }),
  'hands-on-head': freezePose({ armF: [-0.35, -2.1], armB: [-2.79, 2.1], legF: [1.43, 0.25], legB: [1.65, -0.15] }),
});
const angle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
/** Retarget an acting pose using local joint angles and three bounded dials.
 * @param {any} definition A biped definition with poseLayout.
 * @param {keyof typeof BIPED_POSES} name
 * @param {{crouch?:number,armHeight?:number,lean?:number}} [dials]
 */
export function poseVocabulary(definition, name, dials = {}) {
  options(dials, ['crouch', 'armHeight', 'lean'], 'pose dials');
  assert(Object.hasOwn(BIPED_POSES, name), 'UNKNOWN_POSE', 'Choose a documented biped pose.');
  const layout = definition?.poseLayout;
  assert(
    layout?.SHOULDER && layout?.HIP && Number.isFinite(layout.leg) && layout.leg > 0,
    'POSE_VOCABULARY_UNSUPPORTED',
    'Pose vocabulary needs a biped pose layout.',
  );
  const crouch = number(dials.crouch ?? 0, 'crouch', 0, 1),
    height = number(dials.armHeight ?? 0, 'arm height', -1, 1),
    lean = number(dials.lean ?? 0, 'lean', -1, 1),
    joints = Object.fromEntries(Object.entries(BIPED_POSES[name]).map(([limb, pair]) => [limb, [...pair]]));
  for (const side of ['F', 'B']) {
    const arm = joints['arm' + side];
    arm[0] = angle(arm[0], height > 0 ? -p / 2 : p / 2, Math.abs(height));
    arm[1] *= 1 - 0.7 * Math.abs(height);
    const leg = joints['leg' + side],
      sign = side === 'F' ? 1 : -1;
    leg[0] -= sign * 0.45 * crouch;
    leg[1] += sign * 0.9 * crouch;
  }
  joints.armB[0] += 0.5 * lean;
  return Object.freeze({
    joints: freezePose(joints),
    lean: (definition.rest?.['body.r'] ?? 0) - 0.35 * lean,
    hip: Object.freeze([
      definition.rest?.['body.x'] ?? 0,
      (definition.rest?.['body.y'] ?? 0) + layout.leg * 0.18 * crouch,
    ]),
  });
}
