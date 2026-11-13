import { sampleJointLimb } from '../joint-pose.js';
import { ellipse, egg, rounded, smoothClosed } from '../shapes.js';
import { booleanPath } from '../../geometry/shapes/boolean.js';
import { bipedActions, bipedDefaults, bipedReach } from './biped.js';
import { tone, faceParts, faceRest, idleFace, breathe, boneToRoot } from './common.js';
import { clamp, lerp } from '../timing.js';

const f = (v) => Object.freeze(v);

export const BEAN_PALETTES = f({
  teal: {
    shirt: tone('#2f8f8a', '#1f6966', '#5fc2b9'),
    pants: tone('#253b4f', '#182736', '#3f5d78'),
    shoe: tone('#1d232b', '#11151a', '#3a4552'),
  },
  coral: {
    shirt: tone('#e2654f', '#b84634', '#f59a84'),
    pants: tone('#2d3a5c', '#1d2640', '#4a5a85'),
    shoe: tone('#2a2420', '#181412', '#4a3f38'),
  },
  mustard: {
    shirt: tone('#e3a83a', '#b9832a', '#f5cf73'),
    pants: tone('#3d4a3a', '#2a3428', '#5d6e59'),
    shoe: tone('#2b2621', '#1a1714', '#4d4339'),
  },
  lab: {
    shirt: tone('#f2f2ee', '#c9cdd0', '#ffffff'),
    pants: tone('#36475e', '#243142', '#55688a'),
    shoe: tone('#26292e', '#16181b', '#454a52'),
  },
  night: {
    shirt: tone('#5b5bd6', '#3e3ea8', '#8d8df0'),
    pants: tone('#22243a', '#151626', '#3a3d5e'),
    shoe: tone('#1b1c25', '#0f1016', '#353748'),
  },
});
export const SKIN = f({
  light: tone('#f3cfb0', '#d9a986', '#ffe6d1'),
  tan: tone('#e0a878', '#bd8357', '#f2c8a2'),
  brown: tone('#a8704b', '#835235', '#c99370'),
  deep: tone('#6b4430', '#4e2f20', '#8d6249'),
});
export const HAIR = f({
  dark: tone('#2b211c', '#1a130f', '#4a3a31'),
  brown: tone('#6b4426', '#4c2e18', '#8f633e'),
  blond: tone('#e0b55a', '#b88f3d', '#f2d58f'),
  red: tone('#b5482c', '#8a331e', '#d9714f'),
  gray: tone('#b9b6b0', '#918e89', '#dcdad6'),
});

// Rest layout, character space: ground at y = 0, facing +x. About 190 units ≈ 2.5 heads tall.
const HIP = [0, -46],
  NECK = [2, -112],
  HEAD = [5, -150],
  HEAD_R = 37;
const SHOULDER = { F: [15, -101], B: [-13, -102] },
  HIP_JOINT = { F: [8, -48], B: [-8, -48] };
const HAND_REST = { F: [23, -60], B: [-19, -62] },
  FOOT_REST = { F: [7, 0], B: [-7, 0] };
const ARM = 54,
  LEG = 45;

/**
 * The bean person: a cute 2.5-head biped with rubber-hose limbs, the explainer's everyman.
 * options: skin, palette (shirt/pants/shoe set), hair (color), hairStyle ('short' | 'bun' | 'curly' | 'none'),
 * accessory ('none' | 'glasses' | 'hardhat'), name.
 */
export function bean(spec = {}) {
  const set = BEAN_PALETTES[spec.palette ?? 'teal'] ?? BEAN_PALETTES.teal;
  const palette = {
    skin: SKIN[spec.skin ?? 'tan'] ?? SKIN.tan,
    hair: HAIR[spec.hair ?? 'dark'] ?? HAIR.dark,
    ...set,
    eye: tone('#ffffff', '#e6e6e6', '#ffffff'),
    pupil: tone('#1c1d22', '#000000', '#3a3c44'),
    mouth: tone('#5a2324', '#3d1617', '#7a3536'),
    cheek: tone('#f08a7e', '#d86b60', '#ffb0a6'),
    shadow: tone('#000000', '#000000', '#000000'),
    accessory: tone('#f2b632', '#c48e1f', '#ffd979'),
    glass: tone('#2b2f36', '#1a1d22', '#4a505c'),
  };
  const body = egg(0, -76, 27, 38, 34);
  const pants = booleanPath('intersect', body, [
    ['M', -40, -58],
    ['L', 40, -58],
    ['L', 40, -30],
    ['L', -40, -30],
    ['Z'],
  ]).commands;
  const head = ellipse(HEAD[0], HEAD[1], HEAD_R, HEAD_R * 0.98);
  const hairStyle = spec.hairStyle ?? 'short',
    accessory = spec.accessory ?? 'none';
  const hairParts = [];
  if (hairStyle !== 'none') {
    // Hair is the head circle grown slightly and cut by a brow line, so it hugs the skull at any size.
    const cap = booleanPath('intersect', ellipse(HEAD[0] - 2, HEAD[1] - 3, HEAD_R + 3, HEAD_R + 2), [
      ['M', -60, -240],
      ['L', 70, -240],
      ['L', 70, -168],
      ['Q', 30, -158, 8, -170],
      ['Q', -20, -150, -40, -150],
      ['L', -60, -150],
      ['Z'],
    ]).commands;
    hairParts.push({ id: 'hair', bone: 'head', z: 25, slot: 'hair', commands: cap });
    if (hairStyle === 'bun')
      hairParts.push({
        id: 'bun',
        bone: 'head',
        z: 19,
        slot: 'hair',
        secondary: { driver: 'head.r' },
        commands: ellipse(HEAD[0] - 22, HEAD[1] - 32, 15),
      });
    if (hairStyle === 'curly')
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.05 + i * 0.15);
        hairParts.push({
          id: `curl${i}`,
          bone: 'head',
          z: 26,
          slot: 'hair',
          commands: ellipse(HEAD[0] - 2 + Math.cos(a) * (HEAD_R + 1), HEAD[1] - 3 + Math.sin(a) * (HEAD_R + 1), 9.5),
        });
      }
  }
  const accessoryParts = [];
  if (accessory === 'hardhat') {
    accessoryParts.push({
      id: 'hatDome',
      bone: 'head',
      z: 40,
      slot: 'accessory',
      commands: booleanPath('intersect', ellipse(HEAD[0], HEAD[1] - 6, HEAD_R + 3, HEAD_R + 1), [
        ['M', -60, -230],
        ['L', 70, -230],
        ['L', 70, -160],
        ['L', -60, -160],
        ['Z'],
      ]).commands,
    });
    accessoryParts.push({
      id: 'hatBrim',
      bone: 'head',
      z: 41,
      slot: 'accessory',
      commands: rounded(
        [
          [HEAD[0] - HEAD_R - 6, -164],
          [HEAD[0] + HEAD_R + 12, -164],
          [HEAD[0] + HEAD_R + 12, -158],
          [HEAD[0] - HEAD_R - 6, -158],
        ],
        3,
      ),
    });
  }
  if (accessory === 'glasses') {
    const ring = (cx, cy) => [...ellipse(cx, cy, 10.5, 10).slice(0, -1)];
    accessoryParts.push({
      id: 'glasses',
      bone: 'head',
      z: 37,
      slot: 'glass',
      stroke: 2.4,
      draw: (pose) => {
        const s = (pose['head.turn'] ?? 0) * 5 - NECK[0];
        const o = -NECK[1];
        return f([
          ...ring(-9 + s, -152 + o),
          ...ring(18 + s, -152 + o),
          f(['M', 1 + s, -153 + o]),
          f(['L', 7.5 + s, -153 + o]),
        ]);
      },
    });
  }
  const limb = (side, which) => {
    const from = which === 'arm' ? SHOULDER[side] : HIP_JOINT[side],
      key = which === 'arm' ? `hand${side}` : `foot${side}`;
    return (pose, world) => {
      const a = boneToRoot(world, 'body', from[0] - HIP[0], from[1] - HIP[1]);
      const end = which === 'arm' ? [pose[`${key}.x`], pose[`${key}.y`]] : [pose[`${key}.x`], pose[`${key}.y`] - 5];
      const length = which === 'arm' ? ARM : LEG,
        r = sampleJointLimb(
          pose,
          which + side,
          a,
          [length / 2, length / 2],
          which === 'arm' ? -1 : 1,
          end,
          world.body.r,
        );
      return f([
        f(['M', a[0], a[1]]),
        f(['Q', 2 * r.elbow.x - (a[0] + r.tip.x) / 2, 2 * r.elbow.y - (a[1] + r.tip.y) / 2, r.tip.x, r.tip.y]),
      ]);
    };
  };
  const parts = [
    {
      id: 'shadow',
      bone: null,
      z: 0,
      slot: 'shadow',
      shade: false,
      opacity: 0.16,
      draw: (pose) => {
        const h = clamp(-(pose['root.y'] ?? 0) / 120);
        return ellipse(0, -(pose['root.y'] ?? 0), 34 * (1 - 0.4 * h), 5.5 * (1 - 0.4 * h));
      },
    },
    { id: 'legB', bone: null, z: 1, slot: 'pants', stroke: 12, length: LEG, stretch: 0.15, draw: limb('B', 'leg') },
    {
      id: 'footB',
      bone: null,
      z: 2,
      slot: 'shoe',
      draw: (pose) => egg(pose['footB.x'] + 4, pose['footB.y'] - 5, 10, 6, 5),
    },
    { id: 'armB', bone: null, z: 3, slot: 'shirt', stroke: 10, length: ARM, stretch: 0.15, draw: limb('B', 'arm') },
    { id: 'handB', bone: null, z: 4, slot: 'skin', draw: (pose) => ellipse(pose['handB.x'], pose['handB.y'], 7) },
    { id: 'legF', bone: null, z: 5, slot: 'pants', stroke: 12, length: LEG, stretch: 0.15, draw: limb('F', 'leg') },
    {
      id: 'footF',
      bone: null,
      z: 6,
      slot: 'shoe',
      draw: (pose) => egg(pose['footF.x'] + 4, pose['footF.y'] - 5, 10, 6, 5),
    },
    { id: 'body', bone: 'body', z: 10, slot: 'shirt', commands: body },
    { id: 'pants', bone: 'body', z: 11, slot: 'pants', commands: pants },
    { id: 'head', bone: 'head', z: 20, slot: 'skin', commands: head },
    ...hairParts,
    ...faceParts({
      bone: 'head',
      origin: NECK,
      eyes: [
        [17, -152],
        [-8, -152],
      ],
      eyeRx: 6.5,
      eyeRy: 8.2,
      pupil: 3.7,
      browY: -165,
      mouth: [6, -131],
      mouthSize: 15,
      cheeks: [
        [-15, -137],
        [27, -137],
      ],
      z: 30,
    }),
    ...accessoryParts,
    { id: 'armF', bone: null, z: 50, slot: 'shirt', stroke: 10, length: ARM, stretch: 0.15, draw: limb('F', 'arm') },
    { id: 'handF', bone: null, z: 51, slot: 'skin', draw: (pose) => ellipse(pose['handF.x'], pose['handF.y'], 7) },
  ];
  const rest = {
    ...faceRest,
    'root.y': 0,
    'body.r': 0,
    'body.x': 0,
    'body.y': 0,
    'body.sx': 1,
    'body.sy': 1,
    'head.r': 0,
  };
  for (const s of ['F', 'B']) {
    rest[`hand${s}.x`] = HAND_REST[s][0];
    rest[`hand${s}.y`] = HAND_REST[s][1];
    rest[`foot${s}.x`] = FOOT_REST[s][0];
    rest[`foot${s}.y`] = FOOT_REST[s][1];
  }

  const layout = {
    HIP,
    SHOULDER,
    FOOT_REST,
    arm: ARM / 54,
    stride: 58,
    runStride: 76,
    chin: [16, -122],
    leg: LEG,
    ankle: 5,
    hipX: { F: HIP_JOINT.F[0], B: HIP_JOINT.B[0] },
  };
  const actions = bipedActions(layout);
  return {
    reach: bipedReach(layout),
    poseLayout: {
      ...layout,
      limbs: Object.fromEntries(
        ['F', 'B'].flatMap((side) => [
          ['arm' + side, { effector: 'hand' + side, lengths: [ARM / 2, ARM / 2], origin: SHOULDER[side], bend: -1 }],
          [
            'leg' + side,
            { effector: 'foot' + side, lengths: [LEG / 2, LEG / 2], origin: HIP_JOINT[side], bend: 1, offsetY: 5 },
          ],
        ]),
      ),
    },
    name: spec.name ?? 'bean',
    rig: 'biped',
    height: 190,
    palette,
    bones: { body: { parent: null, at: HIP }, head: { parent: 'body', at: NECK } },
    parts,
    rest,
    contacts: ['footF', 'footB'],
    joints: [
      ...['F', 'B'].map((s) => ({ part: `leg${s}`, end: 'start', to: ['body', 'pants'] })),
      ...['F', 'B'].map((s) => ({ part: `leg${s}`, end: 'end', to: [`foot${s}`] })),
      ...['F', 'B'].map((s) => ({ part: `arm${s}`, end: 'start', to: ['body'] })),
      ...['F', 'B'].map((s) => ({ part: `arm${s}`, end: 'end', to: [`hand${s}`] })),
      { part: 'head', to: ['body'] },
    ],
    idle(pose, t, ctx) {
      breathe(pose, t, ctx.seed);
      idleFace(pose, t, ctx.seed);
      // Hands drift with the breath; weight shifts slowly between feet.
      const b = Math.sin((2 * Math.PI * t) / 3.6);
      pose['handF.y'] += 1.2 * b;
      pose['handB.y'] += 1.2 * b;
      pose['body.x'] += 1.5 * Math.sin((2 * Math.PI * t) / 7.3 + ctx.seed);
    },
    actions,
    actionDefaults: bipedDefaults({ speed: 70, runSpeed: 140, hop: 46 }),
    sockets: {
      handF: { channel: 'handF', direction: { part: 'armF' } },
      handB: { channel: 'handB', direction: { part: 'armB' } },
      footF: { channel: 'footF' },
      footB: { channel: 'footB' },
      hat: { part: 'head', at: [HEAD[0] - NECK[0], HEAD[1] - NECK[1] - HEAD_R] },
    },
    meta: f({ author: 'ExplainerKit', license: 'CC0-1.0', style: 'cute rubber-hose biped, 2.5 heads tall' }),
  };
}
export { smoothClosed, lerp };
