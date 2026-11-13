import { sampleJointLimb } from '../joint-pose.js';
import { assert, number } from '../../core/validate.js';
import { boneToRoot } from '../runtime.js';
import { ellipse } from '../shapes.js';
import { eyePath, pupilPath, lidPath, browPath, mouthPath } from '../face.js';
import { blinkAt, saccade, noise1, clamp, smooth } from '../timing.js';

const f = (v) => Object.freeze(v);

/** Three tones per slot: base, shade (away from the light) and light (toward it). */
export function tone(base, shade, light) {
  return f({ base, shade, light });
}

/**
 * A rubber-hose limb from a to b with total length L: a single smooth curve that bends like two equal
 * segments solved by IK (the knee or elbow sits where two L/2 segments meet), on the side given by bend (±1).
 */
export function hose(a, b, L, bend, controls = {}) {
  number(L, 'hose length', 1e-6, 1e5);
  assert(bend === 1 || bend === -1, 'INVALID_RIG_INPUT', 'Hose bend must be ±1.');
  const name = controls.name ?? 'hose',
    pose = controls.pose ?? {},
    distance = Math.hypot(b[0] - a[0], b[1] - a[1]),
    legacyStretch = Math.max(1, distance / L);
  assert(legacyStretch <= 4, 'INVALID_RIG_INPUT', 'Hose targets require at most four times declared reach.');
  const input = { ...pose, [name + '.stretch']: pose[name + '.stretch'] ?? legacyStretch },
    solved = sampleJointLimb(input, name, a, [L / 2, L / 2], -bend, b);
  return hoseFromSolution(a, solved);
}

export function hoseFromSolution(a, solved) {
  return f([
    f(['M', a[0], a[1]]),
    f([
      'Q',
      2 * solved.elbow.x - (a[0] + solved.tip.x) / 2,
      2 * solved.elbow.y - (a[1] + solved.tip.y) / 2,
      solved.tip.x,
      solved.tip.y,
    ]),
  ]);
}

/** Face parts on a head bone. eyes: [[x,y],...] in character space at rest; all in head-local after compile. */
export function faceParts({
  bone,
  origin,
  eyes,
  eyeRx,
  eyeRy,
  pupil,
  brows = true,
  browY,
  browLength = 12,
  browThickness = 3.6,
  mouth,
  mouthSize,
  cheeks = null,
  turn = 5,
  z = 30,
  lidSlot = 'skin',
}) {
  const local = ([x, y]) => [x - origin[0], y - origin[1]];
  const slide = (pose) => (pose['head.turn'] ?? 0) * turn;
  const eye = (pose, [x, y]) => {
    const s = pose['face.eyeScale'] ?? 1;
    return [x + slide(pose), y, eyeRx * s, eyeRy * s];
  };
  const parts = [];
  eyes.forEach((p, i) => {
    const [ex, ey] = local(p),
      id = i ? 'eyeB' : 'eyeF';
    parts.push({
      id: `${id}White`,
      bone,
      z: z,
      slot: 'eye',
      shade: false,
      draw: (pose) => eyePath(...eye(pose, [ex, ey])),
    });
    parts.push({
      id: `${id}Pupil`,
      bone,
      z: z + 1,
      slot: 'pupil',
      shade: false,
      draw: (pose) => {
        const [cx, cy, rx, ry] = eye(pose, [ex, ey]);
        return pupilPath(cx, cy, rx, ry, pupil, [pose['look.x'] ?? 0, pose['look.y'] ?? 0]);
      },
      clip: (pose) => eyePath(...eye(pose, [ex, ey])),
    });
    parts.push({
      id: `${id}Shine`,
      bone,
      z: z + 2,
      slot: 'eye',
      shade: false,
      draw: (pose) => {
        const [cx, cy, rx, ry] = eye(pose, [ex, ey]);
        const lx = (pose['look.x'] ?? 0) * (rx - pupil),
          ly = (pose['look.y'] ?? 0) * (ry - pupil);
        return ellipse(cx + lx - pupil * 0.35, cy + ly - pupil * 0.4, pupil * 0.32);
      },
    });
    parts.push({
      id: `${id}Lid`,
      bone,
      z: z + 3,
      slot: lidSlot,
      shade: false,
      draw: (pose) => {
        const [cx, cy, rx, ry] = eye(pose, [ex, ey]);
        return lidPath(cx, cy, rx, ry, Math.max(pose.blink ?? 0, pose['face.lid'] ?? 0), pose['face.squint'] ?? 0);
      },
      clip: (pose) => eyePath(...eye(pose, [ex, ey])),
    });
    if (brows)
      parts.push({
        id: `${id}Brow`,
        bone,
        z: z + 4,
        slot: 'hair',
        shade: false,
        draw: (pose) => {
          const [cx] = eye(pose, [ex, ey]);
          const [, by] = local([0, browY]);
          return browPath(cx, by - ((pose['face.eyeScale'] ?? 1) - 1) * eyeRy, browLength, browThickness, {
            raise: pose['face.browRaise'] ?? 0,
            tilt: pose['face.browTilt'] ?? 0,
            side: i ? 1 : -1,
          });
        },
      });
  });
  if (cheeks)
    cheeks.forEach((p, i) => {
      const [cx, cy] = local(p);
      parts.push({
        id: `cheek${i}`,
        bone,
        z: z - 1,
        slot: 'cheek',
        shade: false,
        opacity: 0.35,
        draw: (pose) => ellipse(cx + slide(pose), cy, 7, 4.5),
        alpha: (pose) => 0.6 + 0.8 * Math.max(0, pose['face.smile'] ?? 0),
      });
    });
  if (mouth) {
    const [mx, my] = local(mouth);
    const shape = (pose) =>
      mouthPath(mx + slide(pose) * 1.1, my, mouthSize, {
        open: pose['mouth.open'] ?? 0,
        width: pose['mouth.width'] ?? 0.8,
        round: pose['mouth.round'] ?? 0,
        smile: pose['face.smile'] ?? 0,
      });
    parts.push({ id: 'mouth', bone, z: z + 5, slot: 'mouth', shade: false, sharp: true, draw: shape });
    parts.push({
      id: 'teeth',
      bone,
      z: z + 6,
      slot: 'eye',
      shade: false,
      draw: (pose) => {
        const x = mx + slide(pose) * 1.1;
        return ellipse(x, my - mouthSize * 0.28, mouthSize * 0.5, mouthSize * 0.22);
      },
      clip: shape,
      alpha: (pose) => clamp((pose['mouth.teeth'] ?? 0) * smooth((pose['mouth.open'] ?? 0) / 0.12)),
    });
  }
  return parts;
}

export const faceRest = f({
  'face.smile': 0.15,
  'face.browRaise': 0,
  'face.browTilt': 0,
  'face.squint': 0,
  'face.eyeScale': 1,
  'face.lid': 0,
  'look.x': 0,
  'look.y': 0,
  'head.turn': 0,
  blink: 0,
  'mouth.open': 0,
  'mouth.width': 0.8,
  'mouth.round': 0,
  'mouth.teeth': 0,
});

/** Idle life shared by every rig: blinks, small eye darts, slow breathing. Additive, so actions sit on top. */
export function idleFace(pose, t, seed) {
  pose.blink = Math.max(pose.blink ?? 0, blinkAt(seed, t));
  const [sx, sy] = saccade(seed + 11, t);
  pose['look.x'] += sx;
  pose['look.y'] += sy;
}
export function breathe(pose, t, seed, bone = 'body', amount = 0.012, period = 3.6) {
  const b = Math.sin((2 * Math.PI * t) / period);
  pose[`${bone}.sy`] = (pose[`${bone}.sy`] ?? 1) * (1 + amount * b);
  pose[`${bone}.sx`] = (pose[`${bone}.sx`] ?? 1) * (1 - amount * 0.5 * b);
  pose[`${bone}.r`] = (pose[`${bone}.r`] ?? 0) + 0.012 * noise1(seed + 3, t * 0.35);
}
export { boneToRoot };
