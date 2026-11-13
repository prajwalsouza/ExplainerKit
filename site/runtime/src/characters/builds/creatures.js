import { ellipse, egg, rounded, smoothClosed, smoothOpen, mapCommands } from '../shapes.js';
import { sampleJointLimb } from '../joint-pose.js';
import { blend, add, solveBones } from '../runtime.js';
import { tone, hose, hoseFromSolution, faceParts, faceRest, idleFace, breathe, boneToRoot } from './common.js';
import { clamp, smooth, noise1 } from '../timing.js';
import { taper, tube, frameAlong, surfaceFrame, appendage, shapes } from '../construct.js';

const f = (v) => Object.freeze(v);
const frac = (x) => x - Math.floor(x);
const rotateAbout = (commands, cx, cy, a) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return mapCommands(commands, (x, y) => [cx + c * (x - cx) - s * (y - cy), cy + s * (x - cx) + c * (y - cy)]);
};
const eyesAndMouth = {
  eye: tone('#ffffff', '#e8e8e8', '#ffffff'),
  pupil: tone('#1c1d22', '#000000', '#3a3c44'),
  mouth: tone('#5a2324', '#3d1617', '#7a3536'),
  cheek: tone('#f08a7e', '#d86b60', '#ffb0a6'),
  shadow: tone('#000000', '#000000', '#000000'),
};

export const BIRD_PALETTES = f({
  robin: {
    feather: tone('#5b6f86', '#43546a', '#8197b0'),
    belly: tone('#ef8a4f', '#cf6b35', '#ffb27f'),
    beak: tone('#f2b632', '#c98f1d', '#ffd774'),
    leg: tone('#e39a3a', '#b8782a', '#f5bf6d'),
  },
  bluebird: {
    feather: tone('#3f8fd6', '#2c6aa6', '#79b8ee'),
    belly: tone('#f4e6c8', '#d8c5a0', '#fff6e2'),
    beak: tone('#f2b632', '#c98f1d', '#ffd774'),
    leg: tone('#e39a3a', '#b8782a', '#f5bf6d'),
  },
  canary: {
    feather: tone('#f2cf3a', '#cfa823', '#fde683'),
    belly: tone('#fff1b0', '#e8d58a', '#fffbe0'),
    beak: tone('#ef8a3a', '#c76c25', '#ffb072'),
    leg: tone('#d98a5a', '#b06a42', '#f0ad86'),
  },
});

/** A round songbird in the explainer style: big eye, small beak, hops rather than walks. */
export function bird(spec = {}) {
  const palette = {
    ...eyesAndMouth,
    lid: (BIRD_PALETTES[spec.palette ?? 'robin'] ?? BIRD_PALETTES.robin).feather,
    ...(BIRD_PALETTES[spec.palette ?? 'robin'] ?? BIRD_PALETTES.robin),
  };
  const HEAD = [16, -74],
    NECK = [10, -60],
    SHOULDER = [-4, -52],
    HINGE = [34, -71];
  const wing = smoothClosed([
    [-2, -55],
    [-22, -54],
    [-38, -40],
    [-30, -33],
    [-12, -38],
  ]);
  const lowerBeak = rounded(
    [
      [33, -71.5],
      [44, -70],
      [33, -65.5],
    ],
    2,
  );
  const legSamples = new WeakMap(),
    leg = (side) => (pose, world) => {
      const a = boneToRoot(world, 'body', side === 'F' ? 5 : -7, side === 'F' ? -4 : -5),
        sample = legSamples.get(pose)?.[side];
      return sample
        ? hoseFromSolution(a, sample)
        : hose(a, [pose[`foot${side}.x`], pose[`foot${side}.y`] - 1], 32, 1, { pose, name: 'leg' + side });
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
        return ellipse(0, -(pose['root.y'] ?? 0), 26 * (1 - 0.5 * h), 4.5 * (1 - 0.5 * h));
      },
    },
    { id: 'wingB', bone: 'wingB', z: 1, slot: 'feather', opacity: 0.85, commands: wing },
    {
      id: 'tail',
      bone: 'tail',
      z: 2,
      slot: 'feather',
      secondary: { driver: 'body.r' },
      commands: rounded(
        [
          [-24, -42],
          [-50, -56],
          [-54, -40],
        ],
        5,
      ),
    },
    { id: 'legB', bone: null, z: 3, slot: 'leg', stroke: 3, draw: leg('B'), length: 32 },
    { id: 'legF', bone: null, z: 4, slot: 'leg', stroke: 3, draw: leg('F'), length: 32 },
    {
      id: 'toes',
      bone: null,
      z: 5,
      slot: 'leg',
      stroke: 2.4,
      draw: (pose) =>
        f(
          ['F', 'B'].flatMap((s) => {
            const x = pose[`foot${s}.x`],
              y = pose[`foot${s}.y`];
            return [f(['M', x - 3, y]), f(['L', x + 7, y]), f(['M', x, y]), f(['L', x + 4, y - 3])];
          }),
        ),
    },
    { id: 'body', bone: 'body', z: 10, slot: 'feather', commands: egg(0, -46, 31, 28, 22) },
    { id: 'belly', bone: 'body', z: 11, slot: 'belly', commands: egg(9, -40, 18, 15, 14) },
    { id: 'head', bone: 'head', z: 20, slot: 'feather', commands: ellipse(HEAD[0], HEAD[1], 22) },
    {
      id: 'beakLow',
      bone: 'head',
      z: 21,
      slot: 'beak',
      draw: (pose) =>
        rotateAbout(
          mapCommands(lowerBeak, (x, y) => [x - NECK[0], y - NECK[1]]),
          HINGE[0] - NECK[0],
          HINGE[1] - NECK[1],
          0.5 * (pose['mouth.open'] ?? 0),
        ),
    },
    {
      id: 'beakUp',
      bone: 'head',
      z: 22,
      slot: 'beak',
      commands: rounded(
        [
          [33, -79],
          [49, -72.5],
          [33, -70],
        ],
        2.5,
      ),
    },
    ...faceParts({
      bone: 'head',
      origin: NECK,
      eyes: [[24, -79]],
      eyeRx: 7.5,
      eyeRy: 8.6,
      pupil: 4.6,
      brows: false,
      mouth: null,
      cheeks: [[28, -67]],
      turn: 2.5,
      z: 30,
      lidSlot: 'lid',
    }),
    { id: 'wingF', bone: 'wingF', z: 40, slot: 'feather', commands: wing },
  ];
  const rest = {
    ...faceRest,
    'face.smile': 0,
    'root.y': 0,
    'body.r': 0,
    'body.x': 0,
    'body.y': 0,
    'body.sx': 1,
    'body.sy': 1,
    'head.r': 0,
    'wingF.r': 0,
    'wingB.r': 0,
    'tail.r': 0,
    'footF.x': 5,
    'footF.y': 0,
    'footB.x': -6,
    'footB.y': 0,
  };
  for (const side of ['F', 'B'])
    Object.assign(rest, {
      [`leg${side}.upper`]: 0,
      [`leg${side}.lower`]: -Math.PI / 2,
      [`leg${side}.mix`]: 1,
      [`leg${side}.stretch`]: 4,
      [`leg${side}.compress`]: 1,
      [`leg${side}.softness`]: 0,
      [`leg${side}.poleEnabled`]: 0,
      [`leg${side}.poleX`]: 0,
      [`leg${side}.poleY`]: 0,
    });
  const flapAt = (pose, t, rate, amount, w) => {
    const s = Math.sin(2 * Math.PI * rate * t);
    add(pose, 'wingF.r', -amount * (0.5 + 0.5 * s), w);
    add(pose, 'wingB.r', -amount * (0.5 + 0.5 * s) * 0.9, w);
  };
  const hopAt = (pose, k, h, w) => {
    const crouch =
        k < 0.2
          ? smooth(k / 0.2) * (1 - smooth((k - 0.15) / 0.05))
          : k > 0.8
            ? smooth((k - 0.8) / 0.1) * (1 - smooth((k - 0.9) / 0.1))
            : 0,
      air = k > 0.2 && k < 0.82 ? Math.sin((Math.PI * (k - 0.2)) / 0.62) : 0;
    add(pose, 'root.y', -h * air, w);
    add(pose, 'body.y', 5 * crouch, w);
    pose['body.sy'] *= 1 - 0.1 * crouch * w + 0.06 * air * w;
    pose['body.sx'] *= 1 + 0.08 * crouch * w;
    add(pose, 'tail.r', -0.25 * air, w);
    add(pose, 'wingF.r', -0.4 * air, w);
    add(pose, 'footF.y', -4 * air, w);
    add(pose, 'footB.y', -4 * air, w);
  };
  const actions = {
    // Hopping travel: one hop per hopLength of ground, feet together, wings flick at takeoff.
    walk(pose, u, params, c, w) {
      const L = params.hopLength ?? 26,
        d = c.clip.distance(u);
      hopAt(pose, frac(d / L), params.height ?? 10, w * Math.min(1, c.clip.speed / 30));
    },
    hop(pose, u, params, c, w) {
      hopAt(pose, u / c.clip.duration, params.height ?? 30, w);
    },
    flap(pose, u, params, c, w) {
      flapAt(pose, u, params.rate ?? 6, params.amount ?? 1.2, w);
      add(pose, 'root.y', -(params.lift ?? 0) * smooth(u / 0.4), w);
    },
    fly(pose, u, params, c, w) {
      flapAt(pose, u, params.rate ?? 7, 1.3, w);
      add(
        pose,
        'root.y',
        -(params.height ?? 90) * Math.min(smooth(u / 0.5), smooth((c.clip.duration - u) / 0.5)) +
          4 * Math.sin(2 * Math.PI * 7 * u),
        w,
      );
      add(pose, 'body.r', -0.12, w);
      add(pose, 'footF.x', -8, w);
      add(pose, 'footB.x', -6, w);
      add(pose, 'footF.y', -6, w);
      add(pose, 'footB.y', -6, w);
    },
    peck(pose, u, params, c, w) {
      const k = Math.max(0, Math.sin((Math.PI * 3 * u) / c.clip.duration));
      add(pose, 'body.r', 0.35 * k, w);
      add(pose, 'head.r', 0.3 * k, w);
      add(pose, 'tail.r', -0.3 * k, w);
    },
    sing(pose, u, params, c, w) {
      const k = Math.sin(Math.PI * clamp(u / c.clip.duration));
      add(pose, 'head.r', -0.35 * k, w);
      blend(pose, 'mouth.open', 0.6 + 0.3 * Math.sin(2 * Math.PI * 5 * u), w * k);
      blend(pose, 'face.squint', 0.7, w * k);
    },
  };
  return {
    name: spec.name ?? 'bird',
    rig: 'bird',
    height: 100,
    palette,
    contacts: ['toes'],
    joints: [
      { part: 'legF', end: 'start', to: ['body', 'belly'] },
      { part: 'legB', end: 'start', to: ['body', 'belly'] },
      { part: 'legF', end: 'end', to: ['toes'] },
      { part: 'legB', end: 'end', to: ['toes'] },
      { part: 'head', to: ['body'] },
    ],
    bones: {
      body: { parent: null, at: [0, -26] },
      head: { parent: 'body', at: NECK },
      wingF: { parent: 'body', at: SHOULDER },
      wingB: { parent: 'body', at: [SHOULDER[0] - 6, SHOULDER[1] - 2] },
      tail: { parent: 'body', at: [-24, -42] },
    },
    parts,
    rest,
    post(pose, _time, context) {
      const world = solveBones(context.def, pose),
        samples = {};
      for (const side of ['F', 'B']) {
        const a = boneToRoot(world, 'body', side === 'F' ? 5 : -7, side === 'F' ? -4 : -5),
          name = 'leg' + side,
          sample = sampleJointLimb(pose, name, a, [16, 16], -1, [pose[`foot${side}.x`], pose[`foot${side}.y`] - 1]);
        samples[side] = sample;
        pose[`foot${side}.x`] = sample.tip.x;
        pose[`foot${side}.y`] = sample.tip.y + 1;
      }
      legSamples.set(pose, samples);
    },
    idle(pose, t, ctx) {
      breathe(pose, t, ctx.seed, 'body', 0.02, 1.6);
      idleFace(pose, t, ctx.seed);
      // Birds move their heads in quick holds, not smooth drifts.
      const k = Math.floor(t / 1.3 + noise1(ctx.seed, t * 0.2));
      pose['head.r'] += 0.08 * noise1(ctx.seed + 5, k) * 1.5;
      pose['tail.r'] += 0.05 * Math.sin((2 * Math.PI * t) / 2.1);
    },
    actions,
    // Hop-walking: the body only travels while airborne, so planted feet never skate.
    travelWarp: {
      walk: (d, p) => {
        const L = p.hopLength ?? 26,
          n = Math.floor(d / L),
          k = d / L - n;
        return L * (n + smooth(clamp((k - 0.2) / 0.62)));
      },
    },
    actionDefaults: {
      walk: { speed: 40, hopLength: 26, height: 10 },
      hop: { duration: 0.55, height: 30 },
      flap: { duration: 1.2, rate: 6, amount: 1.2, lift: 0 },
      fly: { duration: 3, height: 90, rate: 7 },
      peck: { duration: 0.9 },
      sing: { duration: 1.6 },
    },
    sockets: { head: { part: 'head', at: [HEAD[0] - NECK[0], HEAD[1] - NECK[1] - 22] } },
    meta: f({ author: 'ExplainerKit', license: 'CC0-1.0', style: 'round songbird, hops' }),
  };
}

export const FISH_PALETTES = f({
  clown: {
    scales: tone('#f28a2e', '#cc6a17', '#ffb16b'),
    belly: tone('#fff2e0', '#eedcc4', '#ffffff'),
    fin: tone('#f6a24f', '#d47f2c', '#ffc790'),
    stripe: tone('#ffffff', '#e8e8e8', '#ffffff'),
  },
  teal: {
    scales: tone('#2fa69a', '#1f7d74', '#6fd1c4'),
    belly: tone('#e2f4ef', '#c7e3dc', '#ffffff'),
    fin: tone('#4cc0b3', '#2f9489', '#8be0d6'),
    stripe: tone('#1f6f68', '#164f4a', '#2f8f86'),
  },
});

/**
 * A fish on a spine rig: a travelling wave whose amplitude grows toward the tail (carangiform swimming)
 * shapes the whole body each frame. The root sits at the body's centre, not on the ground.
 */
export function fish(spec = {}) {
  const palette = {
    ...eyesAndMouth,
    lid: (FISH_PALETTES[spec.palette ?? 'clown'] ?? FISH_PALETTES.clown).scales,
    ...(FISH_PALETTES[spec.palette ?? 'clown'] ?? FISH_PALETTES.clown),
  };
  const N = 18,
    HEADX = 44,
    TAILX = -40;
  // Half-thickness: round nose, thickest a third back, narrowing to a tail stalk that never reaches zero.
  const width = taper({ max: 25, nose: 12, end: 5.5, peak: 0.32 });
  const wave = (pose, s) =>
    (pose['swim.amp'] ?? 0) * (0.08 + 0.92 * s * s) * Math.sin(2 * Math.PI * ((pose['swim.phase'] ?? 0) - s * 0.8));
  const spine = (pose) =>
    Array.from({ length: N }, (_, i) => {
      const s = i / (N - 1);
      return [HEADX + (TAILX - HEADX) * s, wave(pose, s)];
    });
  const outline = (pose) => tube(spine(pose), width, { startCap: 'round', endCap: 'round' });
  const flap = (pose, k = 1.5, o = 0) => Math.sin(2 * Math.PI * (pose['swim.phase'] ?? 0) * k + o);
  const parts = [
    // Pectoral fin on the far side, behind the body.
    {
      id: 'finBack',
      bone: null,
      z: 1,
      slot: 'fin',
      opacity: 0.8,
      draw: (pose) =>
        appendage(shapes.leaf({ length: 17, width: 6.5 }), surfaceFrame(spine(pose), width, 0.36, -0.2), {
          overlap: 3,
          angle: -0.7 + 0.25 * flap(pose, 1.5, 1),
        }),
    },
    // Forked tail fin grows from the stalk and is sunk into it, so the seam hides behind the body.
    {
      id: 'tail',
      bone: null,
      z: 2,
      slot: 'fin',
      draw: (pose) =>
        appendage(shapes.forkedFin({ length: 26, spread: 21, root: 6, fork: 0.42 }), frameAlong(spine(pose), 1), {
          overlap: 10,
          angle: 0.35 * flap(pose, 1, -1.2),
        }),
    },
    {
      id: 'dorsal',
      bone: null,
      z: 3,
      slot: 'fin',
      draw: (pose) =>
        appendage(
          shapes.pointedFin({ length: 16, spread: 14, root: 8, sweep: 0.2 }),
          surfaceFrame(spine(pose), width, 0.5, 1),
          { overlap: 6, angle: Math.PI / 2 + 0.55 },
        ),
    },
    { id: 'body', bone: null, z: 10, slot: 'scales', draw: outline },
    // Belly: a soft lower curve, clipped to the body outline.
    {
      id: 'belly',
      bone: null,
      z: 11,
      slot: 'belly',
      shade: false,
      opacity: 0.9,
      draw: (pose) => {
        const fr = frameAlong(spine(pose), 0.34);
        return ellipse(fr.point[0] + 2, fr.point[1] + width(0.34) * 1.05, 36, 17);
      },
      clip: outline,
    },
    // Stripe: a band across the body, perpendicular to the spine.
    {
      id: 'stripe',
      bone: null,
      z: 12,
      slot: 'stripe',
      shade: false,
      opacity: 0.9,
      draw: (pose) => {
        const fr = frameAlong(spine(pose), 0.3),
          t = fr.tangent,
          n = fr.normal,
          at = (u, v) => [fr.point[0] + t[0] * u + n[0] * v, fr.point[1] + t[1] * u + n[1] * v];
        return rounded([at(-3.5, -40), at(3.5, -40), at(3.5, 40), at(-3.5, 40)], 2);
      },
      clip: outline,
    },
    {
      id: 'finFront',
      bone: null,
      z: 13,
      slot: 'fin',
      draw: (pose) =>
        appendage(shapes.leaf({ length: 19, width: 7 }), surfaceFrame(spine(pose), width, 0.38, -0.35), {
          overlap: 3,
          angle: -0.55 + 0.3 * flap(pose),
        }),
    },
    ...faceParts({
      bone: 'head',
      origin: [26, 0],
      eyes: [[30, -7]],
      eyeRx: 7.5,
      eyeRy: 8.5,
      pupil: 4.6,
      brows: false,
      mouth: [47, 5],
      mouthSize: 8,
      cheeks: null,
      turn: 1.5,
      z: 30,
      lidSlot: 'lid',
    }),
  ];
  const rest = {
    ...faceRest,
    'face.smile': 0.2,
    'root.y': 0,
    'head.r': 0,
    'head.y': 0,
    'swim.phase': 0,
    'swim.amp': 2.5,
  };
  return {
    name: spec.name ?? 'fish',
    rig: 'spine',
    height: 60,
    palette,
    bones: { head: { parent: null, at: [26, 0] } },
    parts,
    rest,
    joints: [
      { part: 'tail', to: ['body'], depth: 3.5 },
      { part: 'dorsal', to: ['body'], depth: 3 },
      { part: 'finFront', to: ['body'], depth: 2 },
      { part: 'finBack', to: ['body'], depth: 2 },
    ],
    // The face rides the head of the wave, after actions have set its phase and amplitude.
    post(pose) {
      pose['head.y'] = wave(pose, 0.2);
      pose['head.r'] = Math.atan2(wave(pose, 0.1) - wave(pose, 0.3), (HEADX - TAILX) * 0.2);
    },
    idle(pose, t, ctx) {
      idleFace(pose, t, ctx.seed);
      pose['swim.phase'] += t * 0.9;
      pose['root.y'] += 3 * Math.sin((2 * Math.PI * t) / 3.1);
    },
    actions: {
      // Tail-beat frequency grows with speed; distance comes from the eased move clip.
      swim(pose, u, params, c, w) {
        const d = c.clip.distance(u);
        add(pose, 'swim.phase', d / (params.waveLength ?? 60), w);
        blend(pose, 'swim.amp', params.amplitude ?? 9, w * Math.min(1, c.clip.speed / 60));
      },
      dart(pose, u, params, c, w) {
        const k = Math.sin(Math.PI * clamp(u / c.clip.duration));
        add(pose, 'swim.phase', u * 3.5, w);
        blend(pose, 'swim.amp', 12, w * k);
        blend(pose, 'face.eyeScale', 1.15, w * k);
      },
      gulp(pose, u, params, c, w) {
        const k = Math.sin(Math.PI * clamp(u / c.clip.duration));
        blend(pose, 'mouth.open', 0.8 * Math.abs(Math.sin(2 * Math.PI * 2 * u)), w * k);
        blend(pose, 'mouth.round', 1, w * k);
      },
    },
    actionDefaults: {
      swim: { speed: 70, waveLength: 60, amplitude: 9 },
      dart: { duration: 0.6 },
      gulp: { duration: 1 },
    },
    sockets: {},
    meta: f({ author: 'ExplainerKit', license: 'CC0-1.0', style: 'round reef fish on a spine wave' }),
  };
}

export const MICROBE_PALETTES = f({
  mint: {
    cell: tone('#7fd6b0', '#4fb38a', '#b4f0d4'),
    nucleus: tone('#3a9a78', '#2a7259', '#5cbf9b'),
    cilia: tone('#5fbf96', '#3f9a74', '#93e0bd'),
  },
  violet: {
    cell: tone('#b39ae8', '#8f74cf', '#d6c6f7'),
    nucleus: tone('#7a5bc4', '#5a3f9a', '#9f86dd'),
    cilia: tone('#9a80dd', '#7a60c0', '#c2affa'),
  },
  coral: {
    cell: tone('#f59a8a', '#d9776a', '#ffc2b8'),
    nucleus: tone('#d4604f', '#a8473a', '#ec8879'),
    cilia: tone('#e98676', '#c46356', '#ffb0a3'),
  },
});

/** A friendly microbe: wobbling membrane, cilia, a flagellum that beats faster when it swims. */
export function microbe(spec = {}) {
  const palette = {
    ...eyesAndMouth,
    lid: (MICROBE_PALETTES[spec.palette ?? 'mint'] ?? MICROBE_PALETTES.mint).cell,
    skin: (MICROBE_PALETTES[spec.palette ?? 'mint'] ?? MICROBE_PALETTES.mint).cell,
    ...(MICROBE_PALETTES[spec.palette ?? 'mint'] ?? MICROBE_PALETTES.mint),
  };
  const R = 38,
    M = 20;
  const membrane = (pose, grow = 0) =>
    smoothClosed(
      Array.from({ length: M }, (_, i) => {
        const a = (2 * Math.PI * i) / M,
          wob = 1 + 0.06 * noise1(7 + i, pose['wobble.t'] ?? 0) + 0.03 * Math.sin(3 * a + (pose['wobble.t'] ?? 0) * 2);
        return [
          Math.cos(a) * (R + grow) * wob * (pose['blob.sx'] ?? 1),
          Math.sin(a) * (R + grow) * wob * (pose['blob.sy'] ?? 1),
        ];
      }),
      1,
    );
  const parts = [
    {
      id: 'flagellum',
      bone: null,
      z: 1,
      slot: 'cilia',
      stroke: 3.2,
      draw: (pose) => {
        const ph = pose['flag.phase'] ?? 0,
          pts = Array.from({ length: 9 }, (_, i) => {
            const s = i / 8;
            return [-R * 0.95 - s * 46, 6 + Math.sin(2 * Math.PI * (ph - s * 1.2)) * 9 * s];
          });
        return smoothOpen(pts);
      },
    },
    {
      id: 'cilia',
      bone: null,
      z: 2,
      slot: 'cilia',
      stroke: 2.2,
      draw: (pose) => {
        const out = [];
        const t = pose['wobble.t'] ?? 0;
        for (let i = 0; i < 16; i++) {
          const a = (2 * Math.PI * (i + 0.5)) / 16,
            beat = 0.35 * Math.sin(2 * Math.PI * (t * 1.6 - i / 5)),
            r0 = R * 0.98,
            r1 = R + 10;
          const sx = pose['blob.sx'] ?? 1,
            sy = pose['blob.sy'] ?? 1;
          out.push(
            f(['M', Math.cos(a) * r0 * sx, Math.sin(a) * r0 * sy]),
            f(['L', Math.cos(a + beat * 0.25) * r1 * sx, Math.sin(a + beat * 0.25) * r1 * sy]),
          );
        }
        return f(out);
      },
    },
    { id: 'body', bone: null, z: 10, slot: 'cell', draw: (pose) => membrane(pose) },
    {
      id: 'nucleus',
      bone: null,
      z: 11,
      slot: 'nucleus',
      shade: false,
      opacity: 0.35,
      draw: (pose) => ellipse(-12 + 2 * Math.sin(pose['wobble.t'] ?? 0), 10, 11, 9),
    },
    {
      id: 'organelle',
      bone: null,
      z: 12,
      slot: 'nucleus',
      shade: false,
      opacity: 0.25,
      draw: (pose) => ellipse(16, 16 + 2 * Math.cos((pose['wobble.t'] ?? 0) * 1.3), 5, 4),
    },
    ...faceParts({
      bone: 'face',
      origin: [0, 0],
      eyes: [
        [12, -8],
        [-6, -8],
      ],
      eyeRx: 6,
      eyeRy: 7.5,
      pupil: 3.6,
      brows: false,
      mouth: [4, 8],
      mouthSize: 12,
      cheeks: [
        [-13, 3],
        [21, 3],
      ],
      turn: 6,
      z: 30,
      lidSlot: 'lid',
    }),
  ];
  const rest = {
    ...faceRest,
    'face.smile': 0.4,
    'root.y': 0,
    'face.r': 0,
    'face.x': 0,
    'face.y': 0,
    'blob.sx': 1,
    'blob.sy': 1,
    'wobble.t': 0,
    'flag.phase': 0,
  };
  return {
    name: spec.name ?? 'microbe',
    rig: 'blob',
    height: 80,
    palette,
    bones: { face: { parent: null, at: [0, 0] } },
    parts,
    rest,
    idle(pose, t, ctx) {
      idleFace(pose, t, ctx.seed);
      pose['wobble.t'] += t;
      pose['flag.phase'] += t * 0.8;
      const b = Math.sin((2 * Math.PI * t) / 2.4);
      pose['blob.sx'] *= 1 + 0.025 * b;
      pose['blob.sy'] *= 1 - 0.025 * b;
      pose['root.y'] += 4 * Math.sin((2 * Math.PI * t) / 4.3);
    },
    actions: {
      swim(pose, u, params, c, w) {
        const d = c.clip.distance(u);
        add(pose, 'flag.phase', d / 25, w);
        const k = Math.sin((2 * Math.PI * d) / 50);
        pose['blob.sx'] *= 1 + 0.06 * k * w;
        pose['blob.sy'] *= 1 - 0.06 * k * w;
      },
      pulse(pose, u, params, c, w) {
        const k = Math.sin(Math.PI * clamp(u / c.clip.duration)),
          b = Math.sin(2 * Math.PI * 3 * u);
        pose['blob.sx'] *= 1 + 0.12 * b * k * w;
        pose['blob.sy'] *= 1 - 0.12 * b * k * w;
      },
      squish(pose, u, params, c, w) {
        const k = Math.sin(Math.PI * clamp(u / c.clip.duration));
        pose['blob.sx'] *= 1 + 0.25 * k * w;
        pose['blob.sy'] *= 1 - 0.22 * k * w;
        blend(pose, 'face.squint', 0.8, w * k);
        blend(pose, 'face.smile', 1, w * k);
      },
    },
    actionDefaults: { swim: { speed: 50 }, pulse: { duration: 1.2 }, squish: { duration: 0.8 } },
    sockets: {},
    meta: f({ author: 'ExplainerKit', license: 'CC0-1.0', style: 'blob microbe with cilia' }),
  };
}
