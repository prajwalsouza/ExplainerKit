import { ellipse } from '../shapes.js';
import { sampleJointLimb } from '../joint-pose.js';
import { tone, faceParts, faceRest, idleFace, breathe, boneToRoot } from './common.js';
import { bipedActions, bipedDefaults, bipedReach } from './biped.js';
import { assert, number, options } from '../../core/validate.js';

const f = (v) => Object.freeze(v);

/**
 * Stick-figure styles. Proportions follow common stick-figure drawing guides, at the readable end:
 * about 5 heads tall, arms reaching mid-thigh, legs about half the height, joints at the halfway points.
 */
export const STICK_STYLES = f({
  classic: f({ line: 4, head: 'outline', face: 'dots', hands: false, feet: true }),
  xkcd: f({ line: 2.6, head: 'outline', face: 'none', hands: false, feet: false }),
  heavy: f({ line: 8.5, head: 'outline', face: 'none', hands: false, feet: false, build: 'chunky' }),
  bold: f({ line: 9, head: 'solid', face: 'none', hands: false, feet: true }),
  pill: f({ line: 12, head: 'skin', face: 'full', hands: true, feet: true }),
});

/**
 * Stick-figure proportions, on a figure 174 units tall. `standard` is about 5 heads tall with the hip just above
 * half height; `chunky` is the big-headed build of hand-animated stick fights, measured from reference frames:
 * about 3.2 heads tall (head radius 0.13 of the height at the stroke centre, stroke 0.05), hip at 40 % from the
 * ground, almost no neck and arms hanging to the hip. (Reference stances are wider still, about 0.3 of the height;
 * the shared run cycle sinks a foot that wide, so the build keeps 0.18.)
 * Pass `build: {...}` to override any number: headR, head (centre y), neck, shoulder, hip, upper, fore, thigh, shin.
 */
export const STICK_BUILDS = f({
  standard: f({
    headR: 18,
    head: -156,
    neck: -136,
    shoulder: -128,
    hip: -80,
    upper: 30,
    fore: 30,
    thigh: 42,
    shin: 40,
    hand: [12, -76],
    foot: 7,
  }),
  chunky: f({
    headR: 23,
    head: -147,
    neck: -124,
    shoulder: -115,
    hip: -70,
    upper: 25,
    fore: 25,
    thigh: 36,
    shin: 34,
    hand: [24, -72],
    foot: 26,
  }),
});

/**
 * A stick person on a real two-bone IK rig: elbows bend back, knees bend forward, hands and feet are
 * targets. Shares the biped action library with the bean person, so every walk and pose works.
 * options: style ('classic' | 'xkcd' | 'bold' | 'pill' | 'heavy'), build ('standard' | 'chunky' | numbers), line,
 * ink, paper, skin, shirt, pants, face override.
 */
export function stick(spec = {}) {
  const style = {
    ...(STICK_STYLES[spec.style ?? 'classic'] ?? STICK_STYLES.classic),
    ...(spec.face ? { face: spec.face } : {}),
    ...(spec.line ? { line: spec.line } : {}),
  };
  const namedBuild = typeof spec.build === 'string' ? spec.build : (style.build ?? 'standard');
  assert(
    Object.hasOwn(STICK_BUILDS, namedBuild),
    'INVALID_CHARACTER_BUILD',
    'Choose a known stick build or explicit build overrides.',
  );
  if (spec.build && typeof spec.build === 'object')
    options(spec.build, Object.keys(STICK_BUILDS.standard), 'stick build');
  const B = {
    ...STICK_BUILDS.standard,
    ...STICK_BUILDS[namedBuild],
    ...(typeof spec.build === 'object' ? spec.build : {}),
  };
  for (const key of ['headR', 'upper', 'fore', 'thigh', 'shin']) number(B[key], `stick ${key}`, 1e-3, 1e5);
  for (const key of ['head', 'neck', 'shoulder', 'hip']) number(B[key], `stick ${key}`, -1e5, 1e5);
  number(B.foot, 'stick foot rest', 0, 1e5);
  assert(Array.isArray(B.hand) && B.hand.length === 2, 'INVALID_CHARACTER_BUILD', 'Stick hand rest needs[x,y].');
  B.hand.forEach((value) => number(value, 'stick hand rest', -1e5, 1e5));
  const HIP = [0, B.hip],
    NECK = [0, B.neck],
    HEAD = [0, B.head],
    HEAD_R = B.headR;
  const SHOULDER = { F: [2, B.shoulder], B: [-2, B.shoulder] },
    HAND_REST = { F: B.hand, B: [-B.hand[0] + 2, B.hand[1]] },
    FOOT_REST = { F: [B.foot, 0], B: [-B.foot, 0] };
  const UPPER = B.upper,
    FORE = B.fore,
    THIGH = B.thigh,
    SHIN = B.shin;
  // Face features are placed for the standard head; follow the head when the build moves or resizes it.
  const fy = (y) => HEAD[1] + ((y + 156) * HEAD_R) / 18,
    fs = HEAD_R / 18;
  const ink = tone(spec.ink ?? '#1d1d1f', spec.ink ?? '#1d1d1f', spec.ink ?? '#1d1d1f'),
    paper = tone(spec.paper ?? '#ffffff', spec.paper ?? '#ffffff', spec.paper ?? '#ffffff');
  const pill = spec.style === 'pill';
  const skin = spec.skin ? tone(...[spec.skin, spec.skin, spec.skin]) : tone('#e0a878', '#bd8357', '#f2c8a2');
  const shirt = pill ? tone(spec.shirt ?? '#2f8f8a', spec.shirt ?? '#1f6966', spec.shirt ?? '#5fc2b9') : ink,
    pants = pill ? tone(spec.pants ?? '#253b4f', '#182736', '#3f5d78') : ink;
  const headFill =
    style.head === 'solid'
      ? ink
      : style.head === 'skin'
        ? skin
        : spec.paper !== undefined
          ? paper
          : tone('transparent', 'transparent', 'transparent');
  const palette = {
    ink,
    paper,
    shirt,
    pants,
    headFill,
    skin,
    hair: ink,
    shadow: tone('#000000', '#000000', '#000000'),
    eye: style.face === 'full' ? tone('#ffffff', '#ffffff', '#ffffff') : style.head === 'outline' ? paper : headFill,
    pupil: style.head === 'solid' ? paper : ink,
    mouth: style.head === 'solid' ? paper : tone('#3a1d1d', '#2a1414', '#5a2d2d'),
    cheek: tone('#f08a7e', '#d86b60', '#ffb0a6'),
    lid: style.head === 'outline' ? paper : headFill,
  };
  const limb = (side, which) => (pose, world) => {
    const from = which === 'arm' ? SHOULDER[side] : HIP;
    const a = boneToRoot(world, 'body', from[0] - HIP[0], from[1] - HIP[1]);
    const end =
      which === 'arm'
        ? [pose[`hand${side}.x`], pose[`hand${side}.y`]]
        : [pose[`foot${side}.x`], pose[`foot${side}.y`] - 1 - style.line / 2];
    // Elbows point back (bend −1), knees forward (bend 1), in the character's facing frame.
    const r = sampleJointLimb(
      pose,
      which + side,
      a,
      which === 'arm' ? [UPPER, FORE] : [THIGH, SHIN],
      which === 'arm' ? -1 : 1,
      end,
      world.body.r,
    );
    const out = [f(['M', a[0], a[1]]), f(['L', r.elbow.x, r.elbow.y]), f(['L', r.tip.x, r.tip.y])];
    if (which === 'leg' && style.feet) out.push(f(['L', r.tip.x + 9, r.tip.y + 1]));
    return f(out);
  };
  const faceLayer =
    style.face === 'none'
      ? []
      : faceParts({
          bone: 'head',
          origin: NECK,
          eyes:
            style.face === 'full'
              ? [
                  [8 * fs, fy(-159)],
                  [-5 * fs, fy(-159)],
                ]
              : [
                  [8 * fs, fy(-160)],
                  [-4 * fs, fy(-160)],
                ],
          eyeRx: (style.face === 'full' ? 4.6 : 2.6) * fs,
          eyeRy: (style.face === 'full' ? 5.6 : 3.2) * fs,
          pupil: (style.face === 'full' ? 2.6 : 2.4) * fs,
          brows: style.face === 'full',
          browY: fy(-168),
          browLength: 7 * fs,
          browThickness: 2.2,
          mouth: [3 * fs, fy(-146)],
          mouthSize: 10 * fs,
          cheeks: null,
          turn: 4,
          z: 30,
          lidSlot: 'lid',
        });
  const parts = [
    {
      id: 'shadow',
      bone: null,
      z: 0,
      slot: 'shadow',
      shade: false,
      opacity: 0.12,
      draw: (pose) => {
        const h = Math.max(0, Math.min(1, -(pose['root.y'] ?? 0) / 120));
        return ellipse(0, -(pose['root.y'] ?? 0), 24 * (1 - 0.4 * h), 4 * (1 - 0.4 * h));
      },
    },
    {
      id: 'legB',
      bone: null,
      z: 1,
      slot: 'pants',
      stroke: style.line,
      length: THIGH + SHIN + (style.feet ? 9 : 0),
      stretch: 0.02,
      draw: limb('B', 'leg'),
    },
    {
      id: 'armB',
      bone: null,
      z: 2,
      slot: 'shirt',
      stroke: style.line,
      length: UPPER + FORE,
      stretch: 0.02,
      draw: limb('B', 'arm'),
    },
    ...(style.hands
      ? [
          {
            id: 'handB',
            bone: null,
            z: 3,
            slot: 'skin',
            shade: false,
            draw: (pose) => ellipse(pose['handB.x'], pose['handB.y'], style.line * 0.55),
          },
        ]
      : []),
    {
      id: 'legF',
      bone: null,
      z: 4,
      slot: 'pants',
      stroke: style.line,
      length: THIGH + SHIN + (style.feet ? 9 : 0),
      stretch: 0.02,
      draw: limb('F', 'leg'),
    },
    {
      id: 'torso',
      bone: 'body',
      z: 10,
      slot: 'shirt',
      stroke: pill ? style.line * 1.6 : style.line,
      commands: [
        ['M', HIP[0], HIP[1]],
        ['L', NECK[0], NECK[1] + (pill ? 6 : 0)],
      ],
    },
    { id: 'headFill', bone: 'head', z: 20, slot: 'headFill', shade: pill, commands: ellipse(HEAD[0], HEAD[1], HEAD_R) },
    ...(style.head === 'outline'
      ? [
          {
            id: 'headLine',
            encloses: true,
            bone: 'head',
            z: 21,
            slot: 'ink',
            stroke: style.line,
            commands: ellipse(HEAD[0], HEAD[1], HEAD_R),
          },
        ]
      : []),
    ...faceLayer,
    {
      id: 'armF',
      bone: null,
      z: 50,
      slot: 'shirt',
      stroke: style.line,
      length: UPPER + FORE,
      stretch: 0.02,
      draw: limb('F', 'arm'),
    },
    ...(style.hands
      ? [
          {
            id: 'handF',
            bone: null,
            z: 51,
            slot: 'skin',
            shade: false,
            draw: (pose) => ellipse(pose['handF.x'], pose['handF.y'], style.line * 0.55),
          },
        ]
      : []),
  ];
  const rest = {
    ...faceRest,
    'face.smile': 0.1,
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
  const legScale = (THIGH + SHIN) / 82;
  const layout = {
    HIP,
    SHOULDER,
    FOOT_REST,
    handDrop: HAND_REST.F[1] - SHOULDER.F[1] + 2,
    leg: THIGH + SHIN,
    ankle: 1 + style.line / 2,
    minimumHipHeight: THIGH + 1 + style.line / 2,
    arm: (UPPER + FORE) / 54,
    stride: 70 * legScale,
    runStride: 124 * legScale,
    lift: 11 * legScale,
    runLift: 20 * legScale,
    bob: 4.5 * legScale,
    runBob: 7 * legScale,
    chin: [10 * fs, NECK[1] - 4],
  };
  return {
    name:
      spec.name ??
      `stick-${spec.style ?? 'classic'}${typeof spec.build === 'string' ? `-${spec.build}` : ''}`.replace(
        /[^\w-]/g,
        '',
      ),
    rig: 'biped-ik',
    height: 174,
    palette,
    poseLayout: {
      ...layout,
      limbs: Object.fromEntries(
        ['F', 'B'].flatMap((side) => [
          ['arm' + side, { effector: 'hand' + side, lengths: [UPPER, FORE], origin: SHOULDER[side], bend: -1 }],
          [
            'leg' + side,
            { effector: 'foot' + side, lengths: [THIGH, SHIN], origin: HIP, bend: 1, offsetY: 1 + style.line / 2 },
          ],
        ]),
      ),
    },
    bones: { body: { parent: null, at: HIP }, head: { parent: 'body', at: NECK } },
    parts,
    rest,
    contacts: ['legF', 'legB'],
    joints: ['legF', 'legB', 'armF', 'armB'].map((part) => ({ part, end: 'start', to: ['torso'] })),
    idle(pose, t, ctx) {
      breathe(pose, t, ctx.seed, 'body', 0.006, 3.6);
      idleFace(pose, t, ctx.seed);
      const b = Math.sin((2 * Math.PI * t) / 3.6);
      pose['handF.y'] += 1 * b;
      pose['handB.y'] += 1 * b;
      pose['body.x'] += 1.2 * Math.sin((2 * Math.PI * t) / 7.3 + ctx.seed);
    },
    actions: bipedActions(layout),
    reach: bipedReach(layout),
    actionDefaults: bipedDefaults({ speed: 80 * legScale, runSpeed: 220 * legScale, hop: 50 }),
    sockets: {
      handF: { channel: 'handF', direction: { part: 'armF' } },
      handB: { channel: 'handB', direction: { part: 'armB' } },
      footF: { channel: 'footF' },
      footB: { channel: 'footB' },
      hat: { part: 'headFill', at: [HEAD[0] - NECK[0], HEAD[1] - NECK[1] - HEAD_R] },
    },
    meta: f({ author: 'ExplainerKit', license: 'CC0-1.0', style: `stick figure, ${spec.style ?? 'classic'}` }),
  };
}
