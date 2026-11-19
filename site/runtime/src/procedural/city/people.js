import { assert, number, options } from '../../core/validate.js';
import { hsla } from '../../color/space.js';
import { randomAt } from '../../noise/vector.js';
import { rgb } from './mesh.js';
import { WEATHER } from './weather.js';

// People for the city kit. A figure is one continuous skin: the trunk, arms, legs, neck and
// head are lofted as connected rings that share their vertices at every joint, and clothes are
// further rings of the same loft pushed outward, so a sleeve is the arm's own surface moved
// off the skin. Every vertex names one joint and a weight that ramps from 0 to 1 across it.
// A renderer turns the vertex about that joint by the weight times the joint's angle, on top
// of the pose of the part above, so a limb bends as a smooth tube and nothing can open.
//
// Each vertex carries eight extra numbers:
//
//   roughness, 0, 8 (the surface kind for people), 0,
//   joint      see `personJoints`
//   weight     0 where the vertex still moves with the part above the joint, 1 below it
//   colour     which of a walker's colours tints it: 0 none, 1 top, 2 bottom, 3 skin, 4 hair, 5 accent
//   parameter  arms: how far the arm swings (below 0 it holds something up); hems: how far
//              down the hanging cloth the vertex is, from 0 to 1
//
// The figure faces +x with y up, stands on y = 0 and is modelled at adult size; a walker's
// height comes from the scale it is placed with.

/** The joints a vertex can turn about. Hems hang from the hips and are pushed out by the legs. */
export const personJoints = Object.freeze({
  hips: 0,
  chest: 1,
  head: 2,
  thighLeft: 3,
  thighRight: 4,
  shinLeft: 5,
  shinRight: 6,
  footLeft: 7,
  footRight: 8,
  armLeft: 9,
  armRight: 10,
  forearmLeft: 11,
  forearmRight: 12,
  hem: 13,
});
export const personTops = Object.freeze(['tshirt', 'shirt', 'sweater', 'jacket', 'coat', 'raincoat']);
export const personBottoms = Object.freeze(['trousers', 'shorts', 'skirt', 'dress']);
export const personHair = Object.freeze(['short', 'cropped', 'bob', 'long', 'ponytail', 'bun', 'curly', 'bald']);
export const personHats = Object.freeze(['none', 'beanie', 'cap', 'brim']);
export const personHoods = Object.freeze(['none', 'down', 'up']);
export const personBags = Object.freeze(['none', 'backpack', 'shoulder', 'hand']);
export const personShoes = Object.freeze(['shoes', 'boots']);
export const personAges = Object.freeze(['child', 'adult', 'older']);
/** The most triangles one figure may hold, near the camera and far from it. */
export const personBudget = Object.freeze({ near: 3000, far: 1200 });
/** Ranges of the body numbers. Height is metres; the others are factors round 1. */
export const personRanges = Object.freeze({
  height: [0.9, 2.1],
  build: [0.75, 1.35],
  shoulders: [0.85, 1.2],
  hips: [0.85, 1.2],
  legs: [0.9, 1.08],
  head: [0.9, 1.25],
  sleeves: [0, 1],
  length: [0, 1],
});

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// A rounded-square profile: cos and sin pushed toward the corners, so trunks are not ovals.
const sp = (v) => Math.sign(v) * Math.abs(v) ** 0.86;
const c = (h, s, l) => rgb(hsla(h, s, l));
const WHITE = [1, 1, 1];
const J = personJoints;

// ---------------------------------------------------------------------------- the look

const AGE_BODY = Object.freeze({
  child: { height: 1.28, build: 0.92, shoulders: 0.92, hips: 0.92, legs: 0.93, head: 1.2 },
  adult: { height: 1.72, build: 1, shoulders: 1, hips: 1, legs: 1, head: 1 },
  older: { height: 1.66, build: 1.06, shoulders: 0.97, hips: 1.04, legs: 0.98, head: 1.02 },
});
const LOOK_KEYS = [
  'age',
  'height',
  'build',
  'shoulders',
  'hips',
  'legs',
  'head',
  'top',
  'sleeves',
  'tucked',
  'collar',
  'bottom',
  'length',
  'shoes',
  'hair',
  'hat',
  'scarf',
  'hood',
  'umbrella',
  'bag',
  'gloves',
  'colors',
];
const one = (value, list, name) => {
  assert(list.includes(value), 'INVALID_CITY', `${name} is one of ${list.join(', ')}.`);
  return value;
};
const TOP_SLEEVES = { tshirt: 0.3, shirt: 1, sweater: 1, jacket: 1, coat: 1, raincoat: 1 };
const BOTTOM_LENGTH = { trousers: 1, shorts: 0.3, skirt: 0.45, dress: 0.5 };

/**
 * A complete description of one figure from a partial one. Everything left out takes the
 * plain default: an adult in a sweater and trousers with short hair. `colors` may fix any of
 * `top`, `bottom`, `skin`, `hair` and `accent` as library colours; a colour left out is chosen
 * per walker.
 */
export function personLook(spec = {}) {
  options(spec, LOOK_KEYS, 'personLook');
  const age = one(spec.age ?? 'adult', personAges, 'age');
  const base = AGE_BODY[age];
  const body = (key) => number(spec[key] ?? base[key], key, ...personRanges[key]);
  const top = one(spec.top ?? 'sweater', personTops, 'top');
  const bottom = one(spec.bottom ?? 'trousers', personBottoms, 'bottom');
  const colors = {};
  if (spec.colors) {
    options(spec.colors, ['top', 'bottom', 'skin', 'hair', 'accent'], 'colors');
    for (const [key, value] of Object.entries(spec.colors)) colors[key] = Object.freeze([...rgb(value)]);
  }
  const umbrella = Boolean(spec.umbrella ?? false);
  const hood = one(spec.hood ?? 'none', personHoods, 'hood');
  return Object.freeze({
    age,
    height: body('height'),
    build: body('build'),
    shoulders: body('shoulders'),
    hips: body('hips'),
    legs: body('legs'),
    head: body('head'),
    top,
    sleeves: number(spec.sleeves ?? TOP_SLEEVES[top], 'sleeves', ...personRanges.sleeves),
    tucked: Boolean(spec.tucked ?? false) && (top === 'tshirt' || top === 'shirt'),
    collar: Boolean(spec.collar ?? (top === 'shirt' || top === 'jacket' || top === 'coat' || top === 'raincoat')),
    bottom,
    length: number(spec.length ?? BOTTOM_LENGTH[bottom], 'length', ...personRanges.length),
    shoes: one(spec.shoes ?? 'shoes', personShoes, 'shoes'),
    hair: one(spec.hair ?? 'short', personHair, 'hair'),
    hat: one(spec.hat ?? 'none', personHats, 'hat'),
    scarf: Boolean(spec.scarf ?? false),
    hood,
    umbrella,
    bag: one(spec.bag ?? 'none', personBags, 'bag'),
    gloves: Boolean(spec.gloves ?? false),
    colors: Object.freeze(colors),
  });
}

// ------------------------------------------------------------------------ the skeleton

const ANKLE = 0.085;
/**
 * Where a figure's joints are, in model metres, from its body numbers. `height` is how tall
 * the model stands, which a renderer divides a walker's height by to get its scale.
 */
export function personRig(look) {
  const leg = look.legs,
    torso = 1 + (look.legs - 1) * 0.3;
  const knee = ANKLE + 0.405 * leg,
    hip = knee + 0.43 * leg;
  const up = (d) => hip + d * torso;
  const shoulder = up(0.465),
    arm = (leg + torso) / 2,
    elbow = shoulder - 0.29 * arm,
    wrist = elbow - 0.255 * arm;
  const neckTop = up(0.585);
  return Object.freeze({
    ankle: ANKLE,
    knee,
    hip,
    waist: up(0.16),
    shoulder,
    elbow,
    wrist,
    neck: up(0.565),
    neckTop,
    height: neckTop + 0.005 + 0.205 * look.head,
    torso,
    legOffset: 0.088 * look.hips,
  });
}

// --------------------------------------------------------------------------- the walk
// The same sums run in the city renderer's vertex shader. A leg's cycle runs from 0 to 1 and
// starts when its heel lands. For the first part the foot is planted and slides back under
// the body at walking speed, rolling from the heel onto the ball; for the rest it swings
// forward clear of the ground. The hips ride at a height the planted leg can reach, and each
// leg is bent to put its ankle exactly where the foot needs it.

export const personGait = Object.freeze({
  stance: 0.56,
  reach: 0.38,
  heel: 0.05,
  ball: 0.14,
  toeUp: 0.3,
  heelUp: 1.3,
  lift: 0.05,
  holdArm: 0.35,
  holdElbow: 2.1,
});
const G = personGait;

function plantedFoot(s, step) {
  // A very short step is a shuffle: the foot barely rolls, so a walker who slows to a stop
  // comes to rest with both feet flat under the hips.
  const full = Math.min(1, step / 0.25);
  const r = G.reach * step - 2 * step * G.stance * s;
  if (s < 0.14) {
    const a = G.toeUp * full * (1 - s / 0.14);
    return [r - G.heel + G.heel * Math.cos(a) - ANKLE * Math.sin(a), G.heel * Math.sin(a) + ANKLE * Math.cos(a), a];
  }
  if (s < 0.5) return [r, ANKLE, 0];
  const a = -G.heelUp * full * smooth(0.5, 1, s);
  return [r + G.ball - G.ball * Math.cos(a) - ANKLE * Math.sin(a), -G.ball * Math.sin(a) + ANKLE * Math.cos(a), a];
}
/** Where a leg's ankle is, relative to the ground under the hips, and how its foot pitches. */
function footAt(u, step) {
  u -= Math.floor(u);
  if (u < G.stance) return plantedFoot(u / G.stance, step);
  const v = (u - G.stance) / (1 - G.stance),
    a = plantedFoot(1, step),
    b = plantedFoot(0, step);
  return [
    lerp(a[0], b[0], smooth(0, 1, v)),
    lerp(a[1], b[1], v) + G.lift * Math.min(1, step / 0.25) * Math.sin(Math.PI * v),
    lerp(a[2], b[2], smooth(0, 0.85, v)),
  ];
}

/**
 * The pose of a figure at `phase` radians of its stride, one step per pi. `gait` holds
 * `step` (the length of a step in model metres), `swing` (how far the arms swing, 0 to 1.5)
 * and `lean` (how far the trunk leans forward, radians). Angles turn counter-clockwise seen
 * from the figure's left, so a positive thigh angle swings the leg forward.
 *
 * `act`, which may be the result of walkerPose, adds what a person does besides walking:
 * `arms` is [leftArm, leftElbow, leftWeight, rightArm, rightElbow, rightWeight], where each
 * weight from 0 to 1 says how far that arm leaves its swing for the given angles, and `head` is
 * [yaw, nod] in radians, a positive yaw turning the head to the figure's left.
 * @param {{arms?: readonly number[], head?: readonly number[]} | null} [act]
 */
export function personPose(phase, gait = {}, rig = personRig(personLook()), act = null) {
  const step = gait.step ?? 0.72,
    swing = gait.swing ?? 1,
    lean = gait.lean ?? 0.03;
  const arms = act?.arms ?? null,
    look = act?.head ?? null;
  const L1 = rig.hip - rig.knee,
    L2 = rig.knee - ANKLE,
    reach = (L1 + L2) * 0.995;
  const drop = 0.07 * step * step * (0.835 / (L1 + L2)) + 0.008;
  const hipY = rig.hip - drop + Math.min(0.032, drop - 0.008) * 0.5 * (1 - Math.cos(2 * (phase - 0.25)));
  const legs = [0, 0.5].map((offset, sideIndex) => {
    const u = phase / TAU + offset,
      [ax, ay, pitch] = footAt(u, step);
    const dx = ax,
      dy = hipY - ay;
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 0.01, reach);
    const toward = Math.atan2(dx, dy);
    const thigh = toward + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const turn = Math.cos(TAU * u);
    const g = arms ? sideIndex * 3 : -1,
      weight = g >= 0 ? clamp(arms[g + 2], 0, 1) : 0;
    return {
      thigh,
      knee,
      foot: pitch,
      arm: lerp((-0.33 * turn * (step / 0.72) + 0.05) * swing, weight ? arms[g] : 0, weight),
      elbow: lerp(0.16 + 0.3 * (0.5 - 0.5 * turn) * Math.min(1, swing), weight ? arms[g + 1] : 0, weight),
    };
  });
  return {
    lift: hipY - rig.hip,
    chest: -lean,
    head: lean * 0.7 + (look ? look[1] : 0),
    yaw: look ? look[0] : 0,
    twist: -0.085 * Math.cos(phase) * Math.min(1, swing) * Math.min(1, step / 0.4),
    sway: 0.016 * Math.sin(phase - 0.25) * Math.min(1, step / 0.4),
    left: legs[0],
    right: legs[1],
    phase,
    step,
  };
}

const turnAbout = (p, jx, jy, a) => {
  const co = Math.cos(a),
    si = Math.sin(a),
    dx = p[0] - jx,
    dy = p[1] - jy;
  p[0] = jx + dx * co - dy * si;
  p[1] = jy + dx * si + dy * co;
};
// How far forward a leg's centre line stands at a height `below` the hip joint.
function legForward(below, leg, L1) {
  if (below <= 0) return 0;
  const knee = L1 * Math.cos(leg.thigh);
  if (below <= knee) return below * Math.tan(leg.thigh);
  return L1 * Math.sin(leg.thigh) + (below - knee) * Math.tan(clamp(leg.thigh - leg.knee, -1.2, 1.2));
}
const softMax = (a, b) => {
  const k = 0.02,
    h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return lerp(b, a, h) + k * h * (1 - h);
};

/**
 * The positions of a figure's vertices in a pose, as the renderer's vertex shader places
 * them. This is the reference for that shader and lets a figure be checked without drawing it.
 */
export function posePerson(mesh, pose, rig) {
  const out = new Float32Array(mesh.positions.length),
    e = mesh.extra,
    stride = mesh.extraStride;
  const L1 = rig.hip - rig.knee;
  const waistY = rig.waist,
    neckY = rig.neck;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const k = i * 3,
      joint = e[i * stride + 4],
      w = e[i * stride + 5],
      param = e[i * stride + 7];
    const p = [mesh.positions[k], mesh.positions[k + 1]];
    let z = mesh.positions[k + 2],
      twist = 0;
    const restY = p[1];
    const side = joint >= 3 && joint <= 12 ? ((joint - 3) % 2 === 0 ? pose.left : pose.right) : null;
    if (joint === J.chest) {
      turnAbout(p, 0, waistY, w * pose.chest);
      twist = w;
    } else if (joint === J.head) {
      turnAbout(p, -0.005, neckY, w * pose.head);
      if (pose.yaw) {
        // The head turns about the neck's upright axis.
        const a = w * pose.yaw,
          co = Math.cos(a),
          si = Math.sin(a),
          x = p[0] + 0.005;
        p[0] = x * co + z * si - 0.005;
        z = -x * si + z * co;
      }
      turnAbout(p, 0, waistY, pose.chest);
      twist = 1 - 0.7 * w;
    } else if (joint === J.thighLeft || joint === J.thighRight) {
      turnAbout(p, 0, rig.hip, w * side.thigh);
    } else if (joint === J.shinLeft || joint === J.shinRight) {
      turnAbout(p, 0, rig.knee, -w * side.knee);
      turnAbout(p, 0, rig.hip, side.thigh);
    } else if (joint === J.footLeft || joint === J.footRight) {
      turnAbout(p, 0, ANKLE, w * (side.foot - side.thigh + side.knee));
      turnAbout(p, 0, rig.knee, -side.knee);
      turnAbout(p, 0, rig.hip, side.thigh);
    } else if (joint >= J.armLeft && joint <= J.forearmRight) {
      const hold = param < 0,
        arm = hold ? G.holdArm : side.arm * param,
        elbow = hold ? G.holdElbow : lerp(0.16, side.elbow, Math.min(1, param));
      if (joint >= J.forearmLeft) {
        turnAbout(p, 0, rig.elbow, w * elbow);
        turnAbout(p, 0, rig.shoulder, arm);
      } else turnAbout(p, 0, rig.shoulder, w * arm);
      turnAbout(p, 0, waistY, pose.chest);
      twist = 1;
    } else if (joint === J.hem) {
      const rho = Math.hypot(p[0], z) || 1e-6,
        ux = p[0] / rho,
        uz = z / rho,
        below = rig.hip - p[1];
      let push = 0;
      for (const [leg, s] of [
        [pose.left, 1],
        [pose.right, -1],
      ])
        push = softMax(push, legForward(below, leg, L1) * ux - 0.16 * Math.max(0, -s * uz));
      push = Math.max(0, push - 0.004);
      p[0] += ux * push - param * param * 0.035 * Math.sin(2 * pose.phase + 0.9);
      z += uz * push;
      p[1] += push * 0.25 * param;
    }
    p[1] += pose.lift;
    if (twist > 0) {
      const a = pose.twist * twist,
        co = Math.cos(a),
        si = Math.sin(a),
        x = p[0];
      p[0] = x * co + z * si;
      z = -x * si + z * co;
    }
    z += pose.sway * smooth(0.05, rig.hip, restY);
    out[k] = p[0];
    out[k + 1] = p[1];
    out[k + 2] = z;
  }
  return out;
}

// ------------------------------------------------------------------------ mesh building

function skinBuilder() {
  const P = [],
    C = [],
    E = [],
    I = [];
  let rough = 0.85;
  const api = {
    rough(v) {
      rough = v;
      return api;
    },
    /** One vertex: position, colour (a multiplier when `slot` is above 0), joint, weight, colour slot, parameter. */
    v(x, y, z, col, joint, w, slot, param = 0) {
      P.push(x, y, z);
      C.push(col[0], col[1], col[2]);
      E.push(rough, 0, 8, 0, joint, w, slot, param);
      return P.length / 3 - 1;
    },
    pos: (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]],
    tri(a, b, d) {
      I.push(a, b, d);
    },
    /** A triangle or quad wound so that it faces along `out`. */
    face(ids, out) {
      const [a, b, d] = [api.pos(ids[0]), api.pos(ids[1]), api.pos(ids[2])];
      const n = [
        (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]),
        (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]),
        (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]),
      ];
      const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0;
      for (let k = 1; k + 1 < ids.length; k++)
        flip ? I.push(ids[0], ids[k + 1], ids[k]) : I.push(ids[0], ids[k], ids[k + 1]);
    },
    /**
     * Join two rings of the same length with quads. The faces point away from the middle of
     * the two rings, or along `out` where the rings lie in one plane.
     */
    bridge(a, b, { out = null, open = false } = {}) {
      const n = a.length;
      let mid = [0, 0, 0];
      for (const i of [...a, ...b]) {
        const p = api.pos(i);
        mid = [mid[0] + p[0], mid[1] + p[1], mid[2] + p[2]];
      }
      mid = mid.map((v) => v / (2 * n));
      for (let i = 0; i < (open ? n - 1 : n); i++) {
        const j = (i + 1) % n,
          quad = [a[i], a[j], b[j], b[i]];
        let dir = out;
        if (!dir) {
          const q = quad.map(api.pos);
          dir = [0, 1, 2].map((k) => (q[0][k] + q[1][k] + q[2][k] + q[3][k]) / 4 - mid[k]);
        }
        // A quad whose corners coincide in pairs is a seam, not a face.
        if (a[i] === b[i] && a[j] === b[j]) continue;
        if (a[i] === a[j] || (a[i] === b[i] && a[j] !== b[j])) api.face([a[j], b[j], b[i]], dir);
        else if (b[i] === b[j] || a[j] === b[j]) api.face([a[i], a[j], b[i]], dir);
        else api.face(quad, dir);
      }
    },
    /** Close a ring with a fan to one vertex. The faces point along `out`, or away from the ring's middle. */
    cap(ring, tip, out = null) {
      const t = api.pos(tip);
      let mid = [0, 0, 0];
      for (const i of ring) {
        const p = api.pos(i);
        mid = [mid[0] + p[0], mid[1] + p[1], mid[2] + p[2]];
      }
      mid = mid.map((v) => v / ring.length);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        if (ring[i] === ring[j]) continue;
        const p = api.pos(ring[i]),
          q = api.pos(ring[j]);
        api.face([ring[i], ring[j], tip], out ?? [0, 1, 2].map((k) => (p[k] + q[k]) / 2 - mid[k] + (t[k] - mid[k])));
      }
    },
    get triangles() {
      return I.length / 3;
    },
    finish() {
      // Weld vertices that coincide and are bound alike, then average the face normals.
      const n = P.length / 3,
        remap = new Uint32Array(n),
        seen = new Map(),
        keep = [];
      const q = (v) => Math.round(v * 20000);
      for (let i = 0; i < n; i++) {
        let key = `${q(P[i * 3])},${q(P[i * 3 + 1])},${q(P[i * 3 + 2])}`;
        for (let k = 0; k < 3; k++) key += `,${q(C[i * 3 + k])}`;
        for (let k = 0; k < 8; k++) key += `,${q(E[i * 8 + k])}`;
        let id = seen.get(key);
        if (id === undefined) {
          id = keep.length;
          seen.set(key, id);
          keep.push(i);
        }
        remap[i] = id;
      }
      const count = keep.length,
        positions = new Float32Array(count * 3),
        colors = new Float32Array(count * 3),
        extra = new Float32Array(count * 8),
        normals = new Float32Array(count * 3);
      keep.forEach((src, id) => {
        for (let k = 0; k < 3; k++) {
          positions[id * 3 + k] = P[src * 3 + k];
          colors[id * 3 + k] = C[src * 3 + k];
        }
        for (let k = 0; k < 8; k++) extra[id * 8 + k] = E[src * 8 + k];
      });
      let idx = [];
      for (let t = 0; t < I.length; t += 3) {
        const a = remap[I[t]],
          b = remap[I[t + 1]],
          d = remap[I[t + 2]];
        if (a === b || b === d || a === d) continue;
        const ax = positions[a * 3],
          ay = positions[a * 3 + 1],
          az = positions[a * 3 + 2];
        const ux = positions[b * 3] - ax,
          uy = positions[b * 3 + 1] - ay,
          uz = positions[b * 3 + 2] - az;
        const vx = positions[d * 3] - ax,
          vy = positions[d * 3 + 1] - ay,
          vz = positions[d * 3 + 2] - az;
        const nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        if (nx * nx + ny * ny + nz * nz < 1e-18) continue;
        idx.push(a, b, d);
        for (const v of [a, b, d]) {
          normals[v * 3] += nx;
          normals[v * 3 + 1] += ny;
          normals[v * 3 + 2] += nz;
        }
      }
      for (let i = 0; i < count; i++) {
        const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        if (l > 0) for (let k = 0; k < 3; k++) normals[i * 3 + k] /= l;
        else normals[i * 3 + 1] = 1;
      }
      // Leave out vertices that no face uses.
      const slot = new Int32Array(count).fill(-1);
      let used = 0;
      for (const v of idx) if (slot[v] < 0) slot[v] = used++;
      idx = idx.map((v) => slot[v]);
      const pack = (from, size) => {
        const to = new Float32Array(used * size);
        for (let i = 0; i < count; i++)
          if (slot[i] >= 0) for (let k = 0; k < size; k++) to[slot[i] * size + k] = from[i * size + k];
        return to;
      };
      return {
        positions: pack(positions, 3),
        normals: pack(normals, 3),
        colors: pack(colors, 3),
        extra: pack(extra, 8),
        extraStride: 8,
        indices: new Uint32Array(idx),
        vertexCount: used,
        triangleCount: idx.length / 3,
      };
    },
  };
  return api;
}

// A table of rows keyed by height, read by linear interpolation.
const rowAt = (rows, y) => {
  if (y <= rows[0].y) return rows[0];
  for (let i = 1; i < rows.length; i++)
    if (y <= rows[i].y) {
      const a = rows[i - 1],
        b = rows[i],
        t = (y - a.y) / (b.y - a.y || 1),
        out = { y };
      for (const key of Object.keys(a)) if (key !== 'y') out[key] = lerp(a[key], b[key], t);
      return out;
    }
  return rows[rows.length - 1];
};

// ------------------------------------------------------------------------- the clothes
// A layer is what covers the skin somewhere: how far it stands off, which colour tints it
// and how rough it is. Thicker layers lie outside thinner ones.

const layer = (d, slot, col = WHITE, rough = 0.9) => ({ d, slot, col, rough });
const SKIN = layer(0, 3, WHITE, 0.62);
const TOPS = Object.freeze({
  tshirt: { d: 0.007, rough: 0.92, hem: -0.035, ease: 0.008, flare: 0, collar: 0 },
  shirt: { d: 0.01, rough: 0.9, hem: -0.05, ease: 0.012, flare: 0, collar: 0.022 },
  sweater: { d: 0.02, rough: 0.97, hem: -0.045, ease: 0.008, flare: 0, collar: 0.03 },
  jacket: { d: 0.024, rough: 0.8, hem: -0.075, ease: 0.016, flare: 0.02, collar: 0.03 },
  coat: { d: 0.026, rough: 0.93, hem: -0.36, ease: 0.02, flare: 0.07, collar: 0.034 },
  raincoat: { d: 0.028, rough: 0.34, hem: -0.27, ease: 0.024, flare: 0.1, collar: 0.03 },
});

/** Everything about a figure's surfaces that follows from its look. */
function wardrobe(look, rig) {
  const up = (d) => rig.hip + d * rig.torso;
  const dress = look.bottom === 'dress',
    skirted = dress || look.bottom === 'skirt';
  // A dress has its own bodice. A jacket, coat or raincoat is worn over it; a lighter top is
  // replaced by it.
  const bodice = dress && (look.top === 'tshirt' || look.top === 'shirt' || look.top === 'sweater');
  const T = bodice ? { ...TOPS.tshirt, collar: 0, hem: 0 } : TOPS[look.top];
  const top = bodice ? layer(0.008, 2, WHITE, 0.88) : layer(T.d, 1, WHITE, T.rough);
  const bottom = layer(look.bottom === 'trousers' ? 0.014 : look.bottom === 'shorts' ? 0.018 : 0.012, 2, WHITE, 0.9);
  const shoe = layer(0.005, 0, look.shoes === 'boots' ? c(24, 22, 14) : c(20, 10, 12), 0.5);
  const tights = layer(0.002, 0, c(240, 8, 14), 0.8);
  const glove = layer(0.005, 0, c(230, 8, 13), 0.8);
  const bare = skirted && (look.length > 0.75 || look.shoes === 'boots') ? tights : SKIN;
  const tucked = look.tucked && !dress;
  const start = tucked ? up(0.12) : up(0.08);
  const hipLayer = skirted ? tights : bottom;
  const hemAt = (len) => lerp(rig.hip - 0.12, rig.knee - 0.3, len);
  const tubes = [];
  if (skirted)
    tubes.push({
      layer: bodice ? top : bottom,
      // A tucked top goes into the waistband. A loose top hangs over it, so the skirt starts
      // below the top's lower edge and stays hidden under it.
      top: bodice ? up(0.08) : tucked ? up(0.11) : up(0.05),
      hem: hemAt(look.length),
      ease: 0.014,
      flare: lerp(0.18, 0.06, look.length),
      shared: bodice,
    });
  if (!tucked && !bodice)
    tubes.push({
      layer: top,
      top: up(0.08),
      hem: Math.max(rig.hip + T.hem * (0.8 + 0.2 * look.legs), ANKLE + 0.2),
      ease: T.ease + (skirted ? 0.024 : 0),
      flare: T.flare,
      shared: true,
    });
  const collar = look.collar && !bodice;
  const sleeveEnd = look.sleeves <= 0.02 ? Infinity : lerp(rig.shoulder - 0.1, rig.wrist + 0.012, look.sleeves);
  const trousers = look.bottom === 'trousers';
  const legEnd = trousers
    ? ANKLE + 0.045
    : look.bottom === 'shorts'
      ? lerp(rig.hip - 0.2, rig.knee - 0.04, clamp(look.length * 1.6, 0, 1))
      : Infinity;
  const bootTop = look.shoes === 'boots' ? ANKLE + (skirted ? 0.3 : 0.2) : 0.125;
  return {
    T,
    top,
    bottom,
    shoe,
    hipLayer,
    tucked,
    start,
    tubes,
    // What covers the trunk at a height: the top from `start` up, the hips' layer below.
    trunk: (y) => (y >= start - 1e-6 ? top : hipLayer),
    collarTop: Math.min(collar ? up(0.555) + T.collar * 0.9 : up(0.538), rig.neckTop - 0.004),
    arm: (y) => (y >= sleeveEnd ? top : look.gloves && y < rig.wrist + 0.03 ? glove : SKIN),
    sleeveEnd,
    leg: (y) => (y < 0.125 ? shoe : y >= legEnd ? bottom : y < bootTop ? shoe : bare),
    legBreaks: trousers ? [legEnd] : [legEnd, bootTop].filter((v) => Number.isFinite(v)),
  };
}

// --------------------------------------------------------------------------- the body

/**
 * A figure from a look. Returns the full `mesh`, a simpler `far` mesh, the `rig` that says
 * where its joints are, and the completed `look`. Called with a number, as older code does,
 * it returns the plain default figure.
 */
export function personAsset(look = {}, seed = 1) {
  const spec = personLook(typeof look === 'number' ? {} : look);
  const rig = personRig(spec);
  const mesh = buildFigure(spec, rig, false, seed),
    far = buildFigure(spec, rig, true, seed);
  assert(
    mesh.triangleCount <= personBudget.near && far.triangleCount <= personBudget.far,
    'RESOURCE_LIMIT',
    `A figure holds at most ${personBudget.near} triangles near and ${personBudget.far} far.`,
  );
  return { mesh, far, rig, look: spec };
}

function buildFigure(look, rig, far, seed) {
  const b = skinBuilder();
  const N = far ? 8 : 12;
  const W = wardrobe(look, rig);
  const g = look.build,
    gw = 1 + (g - 1) * 0.7,
    sh = look.shoulders,
    hp = look.hips;
  const up = (d) => rig.hip + d * rig.torso;
  const crotch = rig.hip - 0.12;
  const rows = [
    { y: crotch, rx: 0.1 * g, rz: 0.158 * hp * gw, x0: -0.004 },
    { y: rig.hip - 0.02, rx: 0.112 * g, rz: 0.168 * hp * gw, x0: -0.008 },
    { y: up(0.08), rx: 0.1 * g + (g - 1) * 0.03, rz: 0.15 * ((hp + 1) / 2) * gw, x0: -0.004 + (g - 1) * 0.03 },
    { y: up(0.16), rx: 0.09 * g + (g - 1) * 0.04, rz: 0.132 * gw, x0: (g - 1) * 0.04 },
    { y: up(0.26), rx: 0.098 * g, rz: 0.148 * sh * gw, x0: 0 },
    { y: up(0.36), rx: 0.106 * g, rz: 0.15 * sh * gw, x0: 0 },
    { y: up(0.44), rx: 0.1 * g, rz: 0.157 * sh * gw, x0: -0.003 },
    { y: up(0.51), rx: 0.08 * g, rz: 0.135 * sh * gw, x0: -0.008 },
    { y: up(0.55), rx: 0.058 * (1 + (g - 1) * 0.4), rz: 0.064 * (1 + (g - 1) * 0.4), x0: -0.006 },
    { y: rig.neckTop, rx: 0.05, rz: 0.05, x0: 0 },
  ];
  const trunkPoint = (theta, y, d) => {
    const r = rowAt(rows, y);
    return [r.x0 + (r.rx + d) * sp(Math.cos(theta)), y, (r.rz + d) * sp(Math.sin(theta))];
  };
  // ---- how a point of each part is bound
  const chestW = (y) => smooth(up(0.08), up(0.3), y);
  const headW = (y) => smooth(up(0.54), rig.neckTop + 0.012, y);
  // On the trunk the centre line between the legs stays with the hips.
  const thighW = (y, z, trunk = false) => {
    if (trunk && Math.abs(z) < 0.012) return 0;
    // The ramp starts in the fork between the legs and higher on the outside of the hip, and
    // is complete a few centimetres down the thigh, so the whole thigh moves as one.
    const root = crotch + 0.015 + 0.09 * smooth(0.02, 0.15, Math.abs(z));
    return smooth(0, 1, (root - y) / 0.085);
  };
  const bindTrunk = (y, z) => {
    if (y <= up(0.08)) return [z >= 0 ? J.thighLeft : J.thighRight, thighW(y, z, true)];
    if (y < up(0.54)) return [J.chest, chestW(y)];
    return [J.head, headW(y)];
  };
  const bindLeg = (y, z, s) => {
    if (y > rig.knee + 0.07) return [s > 0 ? J.thighLeft : J.thighRight, thighW(y, z)];
    if (y > 0.15) return [s > 0 ? J.shinLeft : J.shinRight, smooth(rig.knee + 0.07, rig.knee - 0.07, y)];
    return [s > 0 ? J.footLeft : J.footRight, smooth(0.15, 0.07, y)];
  };
  const put = (p, cover, bind, param = 0) =>
    b.rough(cover.rough).v(p[0], p[1], p[2], cover.col, bind[0], bind[1], cover.slot, param);

  // ---- the trunk: rings of N vertices from the fork of the legs up to the top of the neck
  const side = N / 4;
  const trunkRing = (y, cover) =>
    Array.from({ length: N }, (_, i) => {
      const p = trunkPoint((i / N) * TAU, y, cover.d);
      return put(p, cover, bindTrunk(y, p[2]));
    });
  const levels = far ? [rows[5].y, rows[7].y] : [rows[5].y, rows[6].y, rows[7].y];
  const ys = far
    ? [rows[0].y, rows[1].y, rows[2].y, rows[4].y, rows[5].y, rows[7].y, rows[8].y, rows[9].y]
    : rows.map((r) => r.y);
  // Garment edges on the trunk: where the top starts, and where its collar stops. At an
  // edge there are two rings at one height, one in each layer, joined by a narrow step. Under
  // an untucked top the hips end at the edge and the top starts a new loft there, from which
  // its hem hangs free.
  const trunkRings = [];
  const edges = [
    { y: W.start, below: W.hipLayer, above: W.top, join: W.tucked },
    { y: W.collarTop, below: W.top, above: SKIN, join: true },
  ];
  const heights = ys.filter((y) => edges.every((e) => Math.abs(e.y - y) > 0.004));
  for (const stop of [...heights.map((y) => ({ y })), ...edges].sort((a, b2) => a.y - b2.y)) {
    if (stop.below) {
      trunkRings.push({ y: stop.y, cover: stop.below, ids: trunkRing(stop.y, stop.below), join: true });
      trunkRings.push({ y: stop.y, cover: stop.above, ids: trunkRing(stop.y, stop.above), join: stop.join });
    } else {
      const cover = stop.y > W.collarTop ? SKIN : W.trunk(stop.y);
      trunkRings.push({ y: stop.y, cover, ids: trunkRing(stop.y, cover), join: true });
    }
  }
  const holeRows = levels.map((y) => trunkRings.findIndex((r) => Math.abs(r.y - y) < 1e-9));
  for (let r = 0; r + 1 < trunkRings.length; r++) {
    const A = trunkRings[r],
      B = trunkRings[r + 1];
    if (!B.join) continue;
    const inHole = r >= holeRows[0] && r + 1 <= holeRows[holeRows.length - 1];
    const mid = [0, (A.y + B.y) / 2, 0];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (inHole && (i === side - 1 || i === side || i === N - side - 1 || i === N - side)) continue;
      const q = [A.ids[i], A.ids[j], B.ids[j], B.ids[i]];
      const pa = b.pos(q[0]),
        pb = b.pos(q[2]);
      // Faces between two rings at one height are steps between layers and face up or down.
      const flat = Math.abs(A.y - B.y) < 1e-9;
      b.face(
        q,
        flat ? [0, A.cover.d > B.cover.d ? 1 : -1, 0] : [(pa[0] + pb[0]) / 2 - mid[0], 0, (pa[2] + pb[2]) / 2 - mid[2]],
      );
    }
  }
  const ringAt = (y) => trunkRings.findLast((r) => Math.abs(r.y - y) < 1e-9);

  // ---- hems: cloth that hangs free from the trunk and is pushed out by the legs
  const legRow = (y) => {
    const t = rowAt(
      [
        { y: 0.115, r: 0.036, x0: 0 },
        { y: 0.15, r: 0.037, x0: -0.002 },
        { y: ANKLE + 0.14, r: 0.042, x0: -0.004 },
        { y: rig.knee - 0.15, r: 0.056 * gw, x0: -0.01 },
        { y: rig.knee - 0.07, r: 0.052 * gw, x0: -0.002 },
        { y: rig.knee, r: 0.055 * gw, x0: 0.004 },
        { y: rig.knee + 0.07, r: 0.06 * gw, x0: 0.002 },
        { y: rig.knee + 0.22, r: 0.073 * gw, x0: 0 },
        { y: crotch - 0.07, r: 0.084 * gw, x0: -0.002 },
      ],
      y,
    );
    return t;
  };
  const legZ = (y) => lerp(0.078 * hp, rig.legOffset, clamp(y / rig.hip, 0, 1));
  // The widest the body is at a height, fore-and-aft and sideways, under a hanging hem.
  const envelope = (y) => {
    if (y >= crotch) {
      const r = rowAt(rows, y);
      return { rx: r.rx + Math.abs(r.x0) + W.hipLayer.d, rz: r.rz + W.hipLayer.d, x0: r.x0 };
    }
    const l = legRow(y),
      d = W.leg(y).d;
    return { rx: l.r + Math.abs(l.x0) + d, rz: legZ(y) + l.r + d, x0: -0.004 };
  };
  const tubeRadius = (tube, y) => {
    let rx = 0,
      rz = 0;
    // Cloth hangs straight down from the widest thing above it.
    for (let yy = y; yy <= tube.top + 1e-6; yy += 0.03) {
      const e = envelope(Math.min(yy, tube.top));
      rx = Math.max(rx, e.rx);
      rz = Math.max(rz, e.rz);
    }
    const drop = tube.top - y;
    return {
      rx: rx + tube.ease + tube.flare * drop * 0.8,
      rz: rz + tube.ease + tube.flare * drop,
      x0: envelope(Math.max(y, crotch)).x0,
    };
  };
  const hemParam = (y) => clamp((up(0.08) - y) / 0.55, 0, 1);
  const tubeOuter = (y) => {
    let rz = 0;
    for (const t of W.tubes) if (y <= t.top && y >= t.hem - 0.02) rz = Math.max(rz, tubeRadius(t, y).rz + t.layer.d);
    return rz;
  };
  for (const tube of W.tubes) {
    let ring = tube.shared ? ringAt(tube.top).ids : trunkRing(tube.top, tube.layer);
    const steps = Math.max(1, Math.round((tube.top - tube.hem) / (far ? 0.22 : 0.1)));
    for (let k = 1; k <= steps; k++) {
      const y = lerp(tube.top, tube.hem, k / steps),
        r = tubeRadius(tube, y);
      const next = Array.from({ length: N }, (_, i) => {
        const a = (i / N) * TAU;
        const shade = k === steps ? [0.86, 0.86, 0.86] : WHITE;
        return b
          .rough(tube.layer.rough)
          .v(r.x0 + r.rx * sp(Math.cos(a)), y, r.rz * sp(Math.sin(a)), shade, J.hem, 1, tube.layer.slot, hemParam(y));
      });
      b.bridge(ring, next);
      ring = next;
    }
  }

  // ---- legs: each starts from half of the lowest trunk ring plus one vertex in the fork
  const fork = put([-0.004, crotch - 0.035, 0], W.hipLayer, [J.hips, 0]);
  const lowest = trunkRings[0].ids;
  const legSides = N / 2 + 2;
  for (const s of [1, -1]) {
    const first = [];
    for (let i = 0; i <= N / 2; i++) first.push(lowest[s > 0 ? i : (N - i) % N]);
    first.push(fork);
    const angle = (j) => -Math.PI / 2 + ((j + 1) * TAU) / legSides;
    const legRing = (y, cover, shape = null) =>
      Array.from({ length: legSides }, (_, j) => {
        const a = angle(j),
          row = legRow(y),
          inner = Math.max(0, -Math.sin(a)),
          d = cover.d * (1 - 0.75 * inner * smooth(rig.knee, crotch, y));
        const p = shape
          ? [(Math.cos(a) >= 0 ? shape.front : shape.back) * Math.cos(a), y, s * (legZ(0) + shape.width * Math.sin(a))]
          : [row.x0 + (row.r + d) * Math.cos(a), y, s * (legZ(y) + (row.r + d) * Math.sin(a))];
        return put(p, cover, bindLeg(y, p[2], s));
      });
    let legHeights = far
      ? [crotch - 0.07, rig.knee + 0.07, rig.knee, rig.knee - 0.07, ANKLE + 0.14, 0.15, 0.115]
      : [
          crotch - 0.07,
          rig.knee + 0.22,
          rig.knee + 0.07,
          rig.knee + 0.035,
          rig.knee,
          rig.knee - 0.035,
          rig.knee - 0.07,
          rig.knee - 0.15,
          ANKLE + 0.14,
          0.15,
          0.115,
        ];
    legHeights = legHeights.filter((y) => W.legBreaks.every((e) => Math.abs(y - e) > 0.012));
    const stops = [...legHeights.map((y) => ({ y })), ...W.legBreaks.map((y) => ({ y, edge: true }))].sort(
      (a, b2) => b2.y - a.y,
    );
    let ring = first;
    for (const stop of stops) {
      if (stop.edge) {
        const above = legRing(stop.y, W.leg(stop.y + 1e-4)),
          under = legRing(stop.y, W.leg(stop.y - 1e-4));
        b.bridge(ring, above);
        b.bridge(above, under, { out: [0, -1, 0] });
        ring = under;
      } else {
        const next = legRing(stop.y, W.leg(stop.y));
        b.bridge(ring, next);
        ring = next;
      }
    }
    // The foot: the ankle widens into a shoe that reaches forward to the toe.
    for (const [y, front, back, width] of far
      ? [
          [0.05, 0.172, 0.062, 0.047],
          [0.004, 0.168, 0.058, 0.043],
        ]
      : [
          [0.082, 0.085, 0.048, 0.041],
          [0.05, 0.172, 0.062, 0.047],
          [0.004, 0.168, 0.058, 0.043],
        ]) {
      const next = legRing(y, W.shoe, { front, back, width });
      b.bridge(ring, next);
      ring = next;
    }
    b.cap(ring, put([0.05, 0.004, s * legZ(0)], W.shoe, [s > 0 ? J.footLeft : J.footRight, 1]), [0, -1, 0]);
  }

  // ---- arms: each grows from a hole left in the side of the trunk
  const holeRing = (s, d) => {
    const col = (k) => (s > 0 ? side + k : N - side - k);
    const cells = far
      ? [
          [1, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
          [0, -1],
        ]
      : [
          [1, -1],
          [2, -1],
          [2, 0],
          [2, 1],
          [1, 1],
          [0, 1],
          [0, 0],
          [0, -1],
        ];
    return cells.map(([level, k]) => {
      const ring = ringAt(levels[level]);
      if (d === null) return ring.ids[col(k)];
      const p = trunkPoint((col(k) / N) * TAU, levels[level], d);
      return put(p, SKIN, bindTrunk(levels[level], p[2]));
    });
  };
  const armSides = far ? 6 : 8;
  const armAngle = (j) => (far ? Math.PI / 6 + (j * TAU) / 6 : (j * TAU) / 8);
  const shoulderZ = rowAt(rows, up(0.44)).rz;
  const armRadius = (y) =>
    rowAt(
      [
        { y: rig.wrist, r: 0.027 },
        { y: rig.wrist + 0.06, r: 0.031 },
        { y: rig.elbow - 0.07, r: 0.041 * gw },
        { y: rig.elbow, r: 0.039 * gw },
        { y: rig.elbow + 0.12, r: 0.045 * gw },
        { y: rig.shoulder - 0.045, r: 0.046 * gw },
      ],
      y,
    ).r;
  const carry = look.bag === 'hand' ? 1 : 0,
    holdSide = look.umbrella ? -1 : 0,
    carrySide = carry ? (look.umbrella ? 1 : randomAt(seed, 8101, 1) < 0.5 ? 1 : -1) : 0;
  // Arms hang far enough out to clear the trunk, its clothes and any hanging hem.
  const y2 = rig.shoulder - 0.045;
  const sleeveD = (y) => W.arm(y).d;
  // The upper arm overlaps the side of the chest a little, as a real one does.
  let z2 = shoulderZ + 0.03 + W.top.d * 0.4,
    slope = 0.03;
  // Near the armpit an arm lies against the chest, as a real one does, so only the waist and
  // below are checked. Where two layers of cloth meet they press together by half.
  for (let y = rig.wrist - 0.12; y < up(0.2); y += 0.03) {
    const body = y >= up(0.08) ? rowAt(rows, y).rz + W.trunk(y).d * 0.5 : Math.max(envelope(y).rz, tubeOuter(y));
    const need = Math.max(body, tubeOuter(y)) + armRadius(Math.max(y, rig.wrist)) + sleeveD(y) * 0.5 + 0.006;
    slope = Math.max(slope, (need - z2) / (y2 - y));
  }
  const armZ = (y) => z2 + slope * (y2 - y);
  const hands = {};
  for (const s of [1, -1]) {
    const mode = s === holdSide ? -1 : s === carrySide ? 0.3 : 1;
    const upper = s > 0 ? J.armLeft : J.armRight,
      fore = s > 0 ? J.forearmLeft : J.forearmRight;
    const bindArm = (y, w = null) =>
      w !== null
        ? [upper, w]
        : y > rig.elbow + 0.06
          ? [upper, 1]
          : [fore, smooth(rig.elbow + 0.06, rig.elbow - 0.06, y)];
    const armRing = (centre, tilt, r1, r2, cover, bind) =>
      Array.from({ length: armSides }, (_, j) => {
        const a = armAngle(j),
          co = Math.cos(a) * (r1 + cover.d),
          si = Math.sin(a) * (r2 + cover.d);
        return put(
          [centre[0] + co, centre[1] + si * Math.cos(tilt), centre[2] + s * si * Math.sin(tilt)],
          cover,
          bind,
          mode,
        );
      });
    const sleeved = W.sleeveEnd < rig.shoulder + 1;
    const start = W.arm(rig.shoulder);
    let ring = holeRing(s, null);
    if (!sleeved) {
      const bare = holeRing(s, 0);
      b.bridge(ring, bare, { out: [0, 0, s] });
      ring = bare;
    }
    const r0 = 0.046 * gw;
    const shoulderRings = [
      // The shoulder: lower than the base of the neck, so the line from neck to arm slopes.
      [[0, rig.shoulder - 0.032, s * (shoulderZ + 0.006)], 0.9, r0 * 0.96, r0, 0.55],
      [[0, y2, s * z2], 1.35, r0 * 1.02, r0, 1],
    ];
    for (const [centre, tilt, r1, r2, w] of far ? shoulderRings.slice(1) : shoulderRings) {
      const next = armRing(centre, tilt, r1, r2, start, bindArm(0, w));
      b.bridge(ring, next);
      ring = next;
    }
    let armHeights = far
      ? [rig.elbow + 0.06, rig.elbow, rig.elbow - 0.06, rig.wrist]
      : [
          rig.shoulder - 0.11,
          rig.elbow + 0.06,
          rig.elbow + 0.03,
          rig.elbow,
          rig.elbow - 0.03,
          rig.elbow - 0.06,
          rig.wrist + 0.06,
          rig.wrist,
        ];
    const armEdges = [W.sleeveEnd, look.gloves ? rig.wrist + 0.03 : null].filter(
      (v) => v !== null && Number.isFinite(v) && v < rig.shoulder - 0.06,
    );
    armHeights = armHeights.filter((y) => armEdges.every((e) => Math.abs(y - e) > 0.012));
    const stops = [...armHeights.map((y) => ({ y })), ...armEdges.map((y) => ({ y, edge: true }))].sort(
      (a, b2) => b2.y - a.y,
    );
    const flat = (y, cover) => armRing([0, y, s * armZ(y)], Math.PI / 2, armRadius(y), armRadius(y), cover, bindArm(y));
    for (const stop of stops) {
      if (stop.edge) {
        const above = flat(stop.y, W.arm(stop.y + 1e-4)),
          under = flat(stop.y, W.arm(stop.y - 1e-4));
        b.bridge(ring, above);
        b.bridge(above, under, { out: [0, -1, 0] });
        ring = under;
      } else {
        const next = flat(stop.y, W.arm(stop.y));
        b.bridge(ring, next);
        ring = next;
      }
    }
    // A mitten hand, flat against the thigh, with the thumb as a bump toward the front.
    const glove = W.arm(rig.wrist - 0.05);
    // A relaxed hand: flat, as wide as a palm across the front and back, a thumb that pushes
    // the front of the palm forward, fingers that curl a little toward the leg, and a rounded
    // end. Each entry is how far below the wrist, the half-width, the half-thickness, how far
    // forward the middle sits and how far it curls in toward the body.
    const handRows = far
      ? [
          [0.05, 0.043, 0.017, 0.012, 0],
          [0.12, 0.034, 0.014, 0.01, 0.006],
          [0.155, 0.018, 0.009, 0.008, 0.01],
        ]
      : [
          [0.02, 0.036, 0.019, 0.006, 0],
          [0.045, 0.046, 0.018, 0.014, 0],
          [0.075, 0.046, 0.017, 0.012, 0.002],
          [0.1, 0.041, 0.015, 0.008, 0.005],
          [0.13, 0.036, 0.013, 0.006, 0.009],
          [0.158, 0.027, 0.011, 0.007, 0.012],
          [0.172, 0.014, 0.008, 0.008, 0.013],
        ];
    for (const [dy, r1, r2, fwd, curl] of handRows) {
      const y = rig.wrist - dy;
      const next = armRing([0.006 + fwd, y, s * (armZ(y) - curl)], Math.PI / 2, r1, r2, glove, [fore, 1]);
      b.bridge(ring, next);
      ring = next;
    }
    const tipY = rig.wrist - (far ? 0.165 : 0.178);
    b.cap(ring, put([0.014, tipY, s * (armZ(tipY) - 0.013)], glove, [fore, 1], mode), [0, -1, 0]);
    if (!far) {
      // The thumb: a short rounded stub on the front edge of the palm, angled forward and down.
      const ty = rig.wrist - 0.05;
      ball(b, [0.006 + 0.046, ty, s * (armZ(ty) - 0.004)], [0.013, 0.03, 0.012], true, (p) =>
        put(p, glove, [fore, 1], mode),
      );
    }
    hands[s] = { x: 0.006, y: rig.wrist - 0.075, z: s * armZ(rig.wrist - 0.075), joint: fore, mode };
  }

  // ---- the head, from the top ring of the neck
  const hd = look.head * (1 + (g - 1) * 0.2);
  const headRows = [
    { y: 0.09, f: 0.074, k: 0.058, rz: 0.058 },
    { y: 0.27, f: 0.09, k: 0.076, rz: 0.068 },
    { y: 0.47, f: 0.096, k: 0.092, rz: 0.075 },
    { y: 0.67, f: 0.093, k: 0.098, rz: 0.077 },
    { y: 0.85, f: 0.074, k: 0.086, rz: 0.066 },
    { y: 0.96, f: 0.044, k: 0.052, rz: 0.04 },
    { y: 1, f: 0, k: 0, rz: 0 },
  ];
  const headY = (yy) => rig.neckTop + 0.005 + yy * 0.205 * look.head;
  // A point on the head at angle theta round it and height yy (0 chin, 1 crown), pushed
  // outward along the surface by d.
  const headPoint = (theta, yy, d = 0) => {
    const r = rowAt(headRows, clamp(yy, 0.09, 1)),
      co = Math.cos(theta),
      si = Math.sin(theta),
      tilt = smooth(0.62, 1, yy) * (Math.PI / 2),
      out = d * Math.cos(tilt);
    return [0.012 + ((co >= 0 ? r.f : r.k) * hd + out) * co, headY(yy) + d * Math.sin(tilt), (r.rz * hd + out) * si];
  };
  const HEAD = [J.head, 1];
  // A face is only hinted at: the vertices round the eyes are shaded a little darker, the
  // nose and the brow stand a few millimetres forward, and the chin is shaded below the mouth.
  const face = (theta, yy) => {
    const front = Math.cos(theta),
      across = Math.abs(Math.sin(theta));
    let out = 0,
      shade = 1;
    if (front > 0.6) {
      if (Math.abs(yy - 0.56) < 0.01) shade = across > 0.2 ? 0.72 : 0.9;
      if (Math.abs(yy - 0.47) < 0.01 && across < 0.2) out = 0.016;
      if (Math.abs(yy - 0.67) < 0.01) out = 0.004;
      if (Math.abs(yy - 0.27) < 0.01) shade = 0.93;
    }
    return { out, shade };
  };
  let ring = trunkRings[trunkRings.length - 1].ids;
  for (const yy of far ? [0.09, 0.47, 0.85] : [0.09, 0.27, 0.47, 0.56, 0.67, 0.85, 0.96]) {
    const next = Array.from({ length: N }, (_, i) => {
      const theta = (i / N) * TAU,
        f = far ? { out: 0, shade: 1 } : face(theta, yy);
      const tone = f.shade === 1 ? SKIN : { ...SKIN, col: [f.shade, f.shade, f.shade] };
      return put(headPoint(theta, yy, f.out), tone, HEAD);
    });
    b.bridge(ring, next);
    ring = next;
  }
  b.cap(ring, put(headPoint(0, 1), SKIN, HEAD));
  if (!far) {
    // Features that read at street distance: a nose, ears, eyes set under a brow, and brows
    // in the hair colour. All of them belong to the head and turn with it.
    const onFace = (theta, yy, d) => headPoint(theta, yy, d);
    const feature = (centre, radii, tone) => ball(b, centre, radii, true, (p) => put(p, tone, HEAD));
    const nose = onFace(0, 0.43, -0.004);
    feature([nose[0] + 0.006 * hd, nose[1], 0], [0.011 * hd, 0.022 * hd, 0.0085 * hd], SKIN);
    for (const faceSide of [1, -1]) {
      const ear = onFace(faceSide * (Math.PI / 2) * 0.98, 0.5, -0.006);
      feature([ear[0] - 0.008, ear[1], ear[2]], [0.014 * hd, 0.026 * hd, 0.007 * hd], SKIN);
      const eye = onFace(faceSide * 0.36, 0.555, -0.004);
      feature(eye, [0.007 * hd, 0.0065 * hd, 0.008 * hd], layer(0, 0, [0.09, 0.075, 0.07], 0.25));
      const brow = onFace(faceSide * 0.36, 0.635, -0.001);
      feature(brow, [0.007 * hd, 0.004 * hd, 0.017 * hd], layer(0, 4, [0.75, 0.75, 0.75], 0.9));
    }
    // A mouth: a short dark line, a little below the nose.
    const mouth = onFace(0, 0.3, -0.003);
    feature(mouth, [0.004 * hd, 0.0035 * hd, 0.014 * hd], layer(0, 3, [0.55, 0.38, 0.36], 0.6));
  }

  const ctx = {
    b,
    look,
    rig,
    far,
    N,
    W,
    up,
    put,
    trunkPoint,
    bindTrunk,
    headPoint,
    headY,
    hd,
    HEAD,
    hands,
    seed,
    rows,
    tubeOuter,
    envelope,
    armZ,
  };
  addHair(ctx);
  addExtras(ctx);
  return b.finish();
}

// ------------------------------------------------------------------------------ hair
// Hair is a shell over the scalp that thins to nothing at the hairline, so no edge shows.
// The face is left open by an angle that changes with height; long kinds go on down past
// the head and lie on the neck, shoulders and back.

const HAIR = Object.freeze({
  cropped: { thick: 0.005, low: 0.14, nape: 2.5, ears: 1.5 },
  short: { thick: 0.016, low: 0.14, nape: 2.45, ears: 1.5 },
  curly: { thick: 0.04, low: 0.2, nape: 1.75, ears: 1.5, lumps: 0.55 },
  bob: { thick: 0.024, low: 0.3, nape: 1.42, ears: 1.42, hang: 'chin' },
  long: { thick: 0.024, low: 0.3, nape: 1.42, ears: 1.42, hang: 'back' },
  ponytail: { thick: 0.011, low: 0.14, nape: 1.9, ears: 1.62, tail: true },
  bun: { thick: 0.011, low: 0.14, nape: 1.9, ears: 1.62, knot: true },
});

function addHair({ b, look, rig, far, W, up, trunkPoint, headPoint, headY, hd, HEAD, seed }) {
  const H = HAIR[look.hair];
  if (!H || look.hood === 'up') return;
  const cover = { rough: 0.78, slot: 4 };
  const hatLine = look.hat === 'none' ? 2 : 0.6;
  // Half the angle of the gap left for the face, at a height on the head.
  const open = (yy) =>
    yy >= 0.86
      ? 0
      : yy >= 0.66
        ? 1.05 * Math.sqrt(1 - (yy - 0.66) / 0.2)
        : yy >= 0.45
          ? lerp(H.ears, 1.05, (yy - 0.45) / 0.21)
          : lerp(H.nape, H.ears, clamp((yy - H.low) / (0.45 - H.low), 0, 1));
  const cols = far ? 6 : 10;
  const scalp = far ? [0.93, 0.7, 0.45, H.low] : [0.95, 0.84, 0.7, 0.56, 0.42, H.low];
  const vert = (p, shade = 1) =>
    b.rough(cover.rough).v(p[0], p[1], p[2], [shade, shade, shade], HEAD[0], 1, cover.slot);
  const top = vert(headPoint(0, 1, Math.min(H.thick, hatLine < 2 ? 0.006 : 1)));
  let ring = null;
  const row = (yy, last) =>
    Array.from({ length: cols + 1 }, (_, i) => {
      const s = i / cols,
        gap = open(yy),
        theta = lerp(gap, TAU - gap, s);
      const edge = gap > 0.01 ? Math.min(smooth(0, 0.16, s), smooth(1, 0.84, s)) : 1;
      let d = H.thick * (0.25 + 0.75 * edge) * (last && !H.hang ? 0.3 : 1);
      if (H.lumps) d *= 1 - H.lumps / 2 + H.lumps * randomAt(seed, 8200 + i, Math.round(yy * 100));
      if (yy > hatLine) d = Math.min(d, 0.006);
      return vert(headPoint(theta, yy, Math.max(0.003, d)), 0.92 + 0.08 * edge);
    });
  scalp.forEach((yy, k) => {
    const next = row(yy, k === scalp.length - 1);
    if (ring) b.bridge(ring, next, { open: true });
    else for (let i = 0; i < cols; i++) b.face([top, next[i + 1], next[i]], [0, 1, 0]);
    ring = next;
  });
  if (H.hang) {
    // Below the head the hair falls straight from its widest ring, then lies on whatever is
    // under it: the neck, the shoulders and, for long hair, the back.
    const clear = W.top.d + 0.014 + (look.hood === 'down' ? 0.05 : 0) + (look.scarf ? 0.03 : 0);
    const endOf = (theta) => {
      const back = smooth(1.9, 2.6, Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))));
      return H.hang === 'back' ? lerp(up(0.56), up(0.34), back) : headY(-0.02);
    };
    const drops = far ? 2 : 4;
    for (let k = 1; k <= drops; k++) {
      const next = Array.from({ length: cols + 1 }, (_, i) => {
        const s = i / cols,
          gap = open(H.low),
          theta = lerp(gap, TAU - gap, s);
        const start = headPoint(theta, H.low, H.thick),
          y = lerp(start[1], endOf(theta), k / drops);
        const fall = headPoint(theta, 0.34, H.thick * (k === drops ? 0.35 : 0.9));
        let x = fall[0],
          z = fall[2];
        if (y < rig.neckTop + 0.03) {
          const body = trunkPoint(theta, Math.max(y, up(0.3)), clear + (k === drops ? 0.004 : 0.012));
          if (Math.hypot(body[0], body[2]) > Math.hypot(x, z)) [x, , z] = body;
        }
        return vert([x, y, z], k === drops ? 0.82 : 0.94);
      });
      b.bridge(ring, next, { open: true });
      ring = next;
    }
  }
  if (H.tail || H.knot) {
    const root = headPoint(Math.PI, H.knot ? 0.78 : 0.66, 0.012);
    if (H.knot)
      ball(b, [root[0] - 0.02 * hd, root[1] + 0.01, 0], [0.04 * hd, 0.038 * hd, 0.042 * hd], far, (p) => vert(p, 0.95));
    else {
      // A tail that leaves the back of the head and hangs behind the neck.
      const n = far ? 4 : 6;
      let last = null;
      const path = [
        [root[0] - 0.005, root[1], 0.03],
        [root[0] - 0.05, root[1] - 0.01, 0.034],
        [root[0] - 0.07, root[1] - 0.08, 0.03],
        [root[0] - 0.065, root[1] - 0.17, 0.024],
        [root[0] - 0.06, root[1] - 0.24, 0.008],
      ];
      for (const [x, y, r] of path) {
        const next = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * TAU;
          return vert([x + r * 0.7 * Math.cos(a), y + r * 0.3 * Math.cos(a), r * Math.sin(a)], 0.95);
        });
        if (last) b.bridge(last, next);
        last = next;
      }
    }
  }
}

// A small rounded lump, used for hair knots, bobbles and a hood that is down.
function ball(b, centre, radii, far, vert) {
  const n = far ? 5 : 7,
    bands = far ? [-0.5, 0.5] : [-0.62, 0, 0.62];
  const tip = (sign) => vert([centre[0], centre[1] + sign * radii[1], centre[2]]);
  const low = tip(-1),
    high = tip(1);
  let ring = null;
  for (const h of bands) {
    const r = Math.sqrt(1 - h * h);
    const next = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU;
      return vert([
        centre[0] + radii[0] * r * Math.cos(a),
        centre[1] + radii[1] * h,
        centre[2] + radii[2] * r * Math.sin(a),
      ]);
    });
    if (ring) b.bridge(ring, next);
    else b.cap(next, low, [0, -1, 0]);
    ring = next;
  }
  b.cap(ring, high, [0, 1, 0]);
}

// ----------------------------------------------------------------------------- extras

function addExtras(ctx) {
  const { b, look, rig, far, N, W, up, trunkPoint, bindTrunk, headPoint, headY, HEAD, hands, seed, rows, tubeOuter } =
    ctx;
  const accent =
    (shade = 1, rough = 0.9) =>
    (p, bind = HEAD, param = 0) =>
      b.rough(rough).v(p[0], p[1], p[2], [shade, shade, shade], bind[0], bind[1], 5, param);
  const topCloth =
    (shade = 1) =>
    (p, bind, param = 0) =>
      b.rough(W.top.rough).v(p[0], p[1], p[2], [shade, shade, shade], bind[0], bind[1], 1, param);

  // ---- hats: a shell over the top of the head, with a band, a peak or a brim
  if (look.hat !== 'none' && look.hood !== 'up') {
    const vert = accent(1, 0.95),
      dark = accent(0.82, 0.95);
    const d = look.hat === 'brim' ? 0.02 : 0.016;
    const around = (make) => Array.from({ length: N }, (_, i) => make((i / N) * TAU));
    const backness = (theta) => smooth(0.6, 1.6, Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))));
    const line = (theta) => (look.hat === 'beanie' ? lerp(0.6, 0.5, backness(theta)) : 0.64);
    // The lower edge turns in to the head, so the hat has no open rim.
    let ring = around((theta) => dark(headPoint(theta, line(theta), 0.002), HEAD));
    if (look.hat === 'brim') {
      // A crown that keeps its width up to a flat top, and a brim round its foot.
      const foot = around((theta) => vert(headPoint(theta, 0.64, d), HEAD));
      b.bridge(ring, foot, { out: [0, -1, 0] });
      const crown = around((theta) => {
        const p = headPoint(theta, 0.64, d);
        return vert([0.012 + (p[0] - 0.012) * 0.86, headY(1) + 0.03, p[2] * 0.86], HEAD);
      });
      b.bridge(foot, crown);
      b.cap(crown, vert([0.012, headY(1) + 0.034, 0], HEAD), [0, 1, 0]);
      const brim = around((theta) => {
        const p = headPoint(theta, 0.64, d);
        return dark([p[0] + 0.075 * Math.cos(theta), p[1] - 0.014, p[2] + 0.062 * Math.sin(theta)], HEAD);
      });
      b.bridge(foot, brim, { out: [0, 1, 0] });
    } else {
      const band = look.hat === 'beanie';
      for (const t of far ? [0, 0.5, 0.85] : [0, 0.16, 0.45, 0.72, 0.9]) {
        const next = around((theta) =>
          (band && t < 0.2 ? dark : vert)(
            headPoint(theta, lerp(line(theta), 0.985, t), d + (band && t < 0.2 ? 0.008 : 0)),
            HEAD,
          ),
        );
        b.bridge(ring, next, t === 0 ? { out: [0, -1, 0] } : {});
        ring = next;
      }
      b.cap(ring, vert(headPoint(0, 1, d), HEAD), [0, 1, 0]);
      if (band && !far && randomAt(seed, 8301, 2) < 0.4)
        ball(b, [0.012, headY(1) + d + 0.02, 0], [0.032, 0.03, 0.032], far, (p) => vert(p, HEAD));
      if (look.hat === 'cap') {
        // A peak over the eyes.
        const at = [-0.9, -0.45, 0, 0.45, 0.9];
        const inner = at.map((a) => dark(headPoint(a, 0.64, d), HEAD)),
          outer = at.map((a) => {
            const q = headPoint(a, 0.64, d);
            return dark([q[0] + 0.078 * Math.cos(a * 0.7), q[1] - 0.014, q[2] * 1.12], HEAD);
          });
        b.bridge(inner, outer, { out: [0, 1, 0], open: true });
      }
    }
  }

  // ---- a hood, up over the head or lying on the back
  if (look.hood === 'up') {
    const vert = topCloth(1);
    const gap = (yy) => (yy >= 0.93 ? 0 : yy >= 0.72 ? lerp(0.98, 0, (yy - 0.72) / 0.21) : 0.98);
    const cols = far ? 6 : 10,
      d = W.top.d + 0.006;
    let ring = null;
    for (const yy of far ? [-0.16, 0.2, 0.62, 0.9] : [-0.16, 0.06, 0.3, 0.55, 0.76, 0.93]) {
      const next = Array.from({ length: cols + 1 }, (_, i) => {
        const s = i / cols,
          theta = lerp(gap(yy), TAU - gap(yy), s),
          lip = gap(yy) > 0.01 && (i === 0 || i === cols) ? 0.012 : 0;
        if (yy < 0.05) {
          const y = rig.neck - 0.012,
            p = trunkPoint(theta, y, W.top.d + 0.012);
          return vert(p, bindTrunk(y, p[2]));
        }
        return vert(headPoint(theta, yy, d + lip), HEAD, 0);
      });
      if (ring) b.bridge(ring, next, { open: true });
      ring = next;
    }
    const tip = vert(headPoint(0, 1, d), HEAD);
    for (let i = 0; i < cols; i++) b.face([ring[i], ring[i + 1], tip], [0, 1, 0]);
  } else if (look.hood === 'down') {
    const back = trunkPoint(Math.PI, up(0.5), W.top.d);
    ball(b, [back[0] - 0.03, up(0.515), 0], [0.05, 0.05, 0.105], far, (p) => topCloth(0.9)(p, [J.chest, 1]));
  }

  // ---- a scarf wound round the neck, with one end on the chest
  if (look.scarf) {
    const vert = accent(1, 0.98);
    const base = W.top.d + (look.collar ? 0.012 : 0.004);
    let ring = null;
    for (const [dy, out] of [
      [-0.03, 0.022],
      [0.004, 0.05],
      [0.04, 0.034],
      [0.052, 0.012],
    ]) {
      const y = up(0.55) + dy;
      const next = Array.from({ length: N }, (_, i) => {
        const p = trunkPoint((i / N) * TAU, up(0.55), base + out);
        return vert([p[0], y, p[2]], bindTrunk(y, p[2]));
      });
      if (ring) b.bridge(ring, next);
      ring = next;
    }
    if (!far) {
      const strip = [up(0.53), up(0.45), up(0.37), up(0.3)].map((y, k) => {
        const p = trunkPoint(0.28, y, W.top.d + 0.016);
        return [0.035, -0.035].map((w) => accent(k === 3 ? 0.8 : 0.94, 0.98)([p[0], y, p[2] + w], [J.chest, 1]));
      });
      for (let k = 0; k + 1 < strip.length; k++)
        b.face([strip[k][0], strip[k][1], strip[k + 1][1], strip[k + 1][0]], [1, 0, 0]);
    }
  }

  // ---- an umbrella in the raised hand. It is modelled where the hand holds it and then
  // turned back to where the arm hangs at rest, so the arm's own pose carries it up.
  if (look.umbrella) {
    const hand = hands[-1];
    const posed = [hand.x, hand.y];
    turnAbout(posed, 0, rig.elbow, G.holdElbow);
    turnAbout(posed, 0, rig.shoulder, G.holdArm);
    const rest = (p) => {
      const q = [p[0], p[1]];
      turnAbout(q, 0, rig.shoulder, -G.holdArm);
      turnAbout(q, 0, rig.elbow, -G.holdElbow);
      return [q[0], q[1], p[2]];
    };
    // The shaft runs from the hand to a point just above the head, a little toward the hand's
    // side, so the canopy covers the head.
    const top = [0.05, rig.height + 0.32, hand.z * 0.25];
    const lean = [top[0] - posed[0], top[1] - posed[1], top[2] - hand.z],
      length = Math.hypot(...lean),
      axis = lean.map((v) => v / length);
    const along = (t) => [posed[0] + axis[0] * t, posed[1] + axis[1] * t, hand.z + axis[2] * t];
    // Two directions across the axis.
    const e1 = [axis[1], -axis[0], 0].map((v) => v / Math.hypot(axis[1], axis[0])),
      e2 = [axis[1] * e1[2] - axis[2] * e1[1], axis[2] * e1[0] - axis[0] * e1[2], axis[0] * e1[1] - axis[1] * e1[0]];
    const bind = [hand.joint, 1];
    const steel = (p) => b.rough(0.4).v(...rest(p), c(220, 6, 22), bind[0], bind[1], 0, -1);
    const cloth = accent(1, 0.42);
    let ring = null;
    for (const t of [-0.07, length]) {
      const o = along(t);
      const next = [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * TAU;
        return steel([0, 1, 2].map((k) => o[k] + 0.007 * (Math.cos(a) * e1[k] + Math.sin(a) * e2[k])));
      });
      if (ring) b.bridge(ring, next);
      ring = next;
    }
    const ribs = far ? 6 : 8,
      R = 0.54;
    const apex = cloth(rest(along(length)), bind, -1);
    let last = null;
    for (const [r, drop] of far
      ? [[R, 0.17]]
      : [
          [R * 0.55, 0.05],
          [R, 0.17],
        ]) {
      const o = along(length - drop);
      const next = Array.from({ length: ribs }, (_, i) => {
        const a = (i / ribs) * TAU;
        return cloth(rest([0, 1, 2].map((k) => o[k] + r * (Math.cos(a) * e1[k] + Math.sin(a) * e2[k]))), bind, -1);
      });
      if (last) b.bridge(last, next, { out: axis });
      else b.cap(next, apex, axis);
      last = next;
    }
  }

  // ---- bags
  if (look.bag === 'backpack') {
    const vert = accent(0.9, 0.85);
    const bind = [J.chest, 1];
    const back = (y) => trunkPoint(Math.PI, y, W.top.d)[0];
    let ring = null;
    const levels = far
      ? [
          [0.2, 0.9],
          [0.49, 0.8],
        ]
      : [
          [0.2, 0.82],
          [0.25, 1],
          [0.44, 1],
          [0.5, 0.78],
        ];
    const lows = [];
    for (const [h, scale] of levels) {
      const y = up(h),
        x0 = back(y) - 0.004,
        depth = 0.12 * scale,
        half = 0.125 * scale;
      const next = [
        [x0, half],
        [x0 - depth * 0.8, half],
        [x0 - depth, half * 0.6],
        [x0 - depth, -half * 0.6],
        [x0 - depth * 0.8, -half],
        [x0, -half],
      ].map(([x, z]) => vert([x, y, z], bind));
      if (ring) b.bridge(ring, next);
      else lows.push(...next);
      ring = next;
    }
    b.cap(ring, vert([back(up(0.5)) - 0.05, up(0.51), 0], bind), [0, 1, 0]);
    b.cap(lows, vert([back(up(0.2)) - 0.05, up(0.195), 0], bind), [0, -1, 0]);
    if (!far)
      for (const s of [1, -1]) {
        // Straps over the shoulders, lying on the clothes.
        const pts = [
          [2.5, 0.46],
          [1.9, 0.525],
          [1.2, 0.525],
          [0.75, 0.44],
          [0.85, 0.33],
        ].map(([theta, h]) => {
          const y = up(h);
          return [-0.07, 0.07].map((w) => {
            const p = trunkPoint(s * (theta + w), y, W.top.d + 0.007);
            return accent(0.7, 0.85)(p, bindTrunk(y, p[2]));
          });
        });
        for (let k = 0; k + 1 < pts.length; k++) {
          const mid = b.pos(pts[k][0]);
          b.face([pts[k][0], pts[k][1], pts[k + 1][1], pts[k + 1][0]], [mid[0], 0.25, mid[2]]);
        }
      }
  } else if (look.bag === 'shoulder') {
    const s = randomAt(seed, 8302, 3) < 0.5 ? 1 : -1;
    const vert = accent(0.86, 0.8);
    const wide = Math.max(ctx.envelope(rig.hip).rz, tubeOuter(rig.hip)) + 0.012;
    const box = (x0, x1, y0, y1, z0, z1, bind) => {
      const low = [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ].map(([x, z]) => vert([x, y0, s * z], bind)),
        high = [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ].map(([x, z]) => vert([x, y1, s * z], bind));
      b.bridge(low, high);
      b.face(high, [0, 1, 0]);
      b.face(low, [0, -1, 0]);
    };
    box(-0.2, 0.0, rig.hip - 0.06, rig.hip + 0.1, wide * 0.78, wide * 0.78 + 0.075, [J.hips, 0]);
    if (!far) {
      // The strap runs from the bag over the far shoulder and back down behind.
      const path = [];
      for (let k = 0; k <= 5; k++) path.push([lerp(1.75, -1.25, k / 5), lerp(0.1, 0.52, k / 5)]);
      path.push([-1.57, 0.532]);
      for (let k = 0; k <= 5; k++) path.push([lerp(-1.9, -4.28, k / 5), lerp(0.52, 0.1, k / 5)]);
      const pts = path.map(([theta, h]) => {
        const y = up(h),
          over = y < up(0.08) ? Math.max(0, tubeOuter(y) - rowAt(rows, y).rz) : W.trunk(y).d;
        return [-0.02, 0.02].map((dy) => {
          const p = trunkPoint(s * theta, y + dy, over + 0.008);
          return accent(0.66, 0.8)(p, bindTrunk(y + dy, p[2]));
        });
      });
      for (let k = 0; k + 1 < pts.length; k++) {
        const mid = b.pos(pts[k][0]);
        b.face([pts[k][0], pts[k][1], pts[k + 1][1], pts[k + 1][0]], [mid[0], 0, mid[2]]);
      }
    }
  } else if (look.bag === 'hand') {
    const s = look.umbrella ? 1 : hands[1].mode === 0.3 ? 1 : -1,
      hand = hands[s];
    const vert = (p) => accent(0.88, 0.8)(p, [hand.joint, 1], hand.mode);
    const low = rig.wrist - 0.44,
      high = rig.wrist - 0.2,
      z0 = Math.max(Math.abs(hand.z) - 0.02, tubeOuter(low + 0.1) + 0.03);
    const corners = (y, grow) =>
      [
        [-0.15 * grow, z0],
        [0.15 * grow, z0],
        [0.15 * grow, z0 + 0.08],
        [-0.15 * grow, z0 + 0.08],
      ].map(([x, z]) => vert([hand.x + x, y, s * z]));
    const a = corners(low, 0.92),
      d = corners(high, 1);
    b.bridge(a, d);
    b.face(a, [0, -1, 0]);
    b.face(d, [0, 1, 0]);
    if (!far)
      for (const x of [-0.07, 0.07]) {
        const strap = [
          [hand.x + x, high, s * (z0 + 0.04)],
          [hand.x + x * 0.3, hand.y - 0.03, s * Math.abs(hand.z)],
        ];
        const ids = strap.flatMap((p) => [vert([p[0] - 0.008, p[1], p[2]]), vert([p[0] + 0.008, p[1], p[2]])]);
        b.face([ids[0], ids[1], ids[3], ids[2]], [0, 0, s]);
      }
  }
}

// ------------------------------------------------------------------- automatic choices

/** Coat and jacket colours: mostly dark and muted, with the odd bright one. Hue, saturation, lightness, weight. */
export const COAT_PAINT = Object.freeze([
  [0, 0, 12, 4],
  [215, 30, 22, 4],
  [30, 20, 34, 3],
  [210, 8, 46, 3],
  [40, 30, 70, 2],
  [150, 24, 28, 2],
  [4, 60, 40, 1.2],
  [44, 80, 56, 0.8],
  [200, 50, 50, 0.8],
  [330, 40, 50, 0.6],
  [0, 0, 90, 1.5],
]);
/** The colours walkers are dressed from, by what the colour is for. */
export const PERSON_PAINT = Object.freeze({
  coat: COAT_PAINT,
  knit: [
    [28, 30, 62, 3],
    [215, 30, 34, 3],
    [0, 0, 20, 2],
    [4, 55, 38, 2],
    [150, 28, 32, 2],
    [44, 62, 56, 1.5],
    [0, 0, 84, 2],
    [280, 22, 42, 1],
    [18, 55, 48, 1],
  ],
  light: [
    [0, 0, 94, 5],
    [210, 40, 78, 3],
    [0, 0, 16, 3],
    [210, 12, 55, 2],
    [4, 62, 50, 1.5],
    [44, 80, 62, 1.2],
    [150, 36, 44, 1.2],
    [330, 48, 70, 1],
    [195, 55, 52, 1],
    [24, 60, 60, 1],
  ],
  rain: [
    [48, 92, 54, 4],
    [4, 72, 44, 2.5],
    [218, 48, 30, 3],
    [84, 30, 32, 2],
    [24, 88, 52, 1.5],
    [185, 55, 38, 1.5],
    [0, 0, 14, 2],
  ],
  legs: [
    [215, 38, 30, 5],
    [214, 32, 46, 3],
    [0, 0, 11, 4],
    [36, 26, 56, 2],
    [210, 6, 34, 2.5],
    [26, 30, 24, 1],
    [40, 22, 76, 0.7],
  ],
  skirt: [
    [0, 0, 12, 3],
    [350, 52, 40, 2],
    [216, 42, 34, 2],
    [40, 44, 62, 1.5],
    [150, 30, 34, 1.2],
    [280, 26, 44, 1],
    [18, 62, 50, 1.2],
    [0, 0, 90, 1.2],
    [200, 46, 60, 1],
  ],
  hair: [
    [28, 30, 9, 3],
    [26, 36, 17, 4],
    [28, 42, 28, 3],
    [34, 50, 46, 2],
    [42, 56, 66, 1.2],
    [16, 62, 34, 0.8],
    [0, 0, 58, 0.5],
  ],
  grey: [
    [0, 0, 70, 3],
    [0, 0, 88, 2],
    [30, 8, 46, 1.5],
    [28, 20, 22, 0.6],
  ],
  skin: [
    [24, 46, 80, 3],
    [22, 44, 72, 3],
    [24, 40, 62, 2],
    [24, 42, 50, 1.5],
    [22, 40, 38, 1.2],
    [20, 34, 26, 1],
  ],
  accent: [
    [4, 66, 44, 2],
    [44, 78, 54, 2],
    [220, 40, 28, 2],
    [0, 0, 55, 2],
    [150, 36, 34, 1.5],
    [40, 30, 86, 1.5],
    [0, 0, 13, 2],
    [330, 46, 60, 1],
    [185, 52, 40, 1],
  ],
  umbrella: [
    [0, 0, 9, 5],
    [220, 44, 24, 2],
    [4, 70, 42, 1.4],
    [48, 90, 56, 0.8],
    [150, 40, 30, 0.8],
    [0, 0, 90, 0.8],
    [200, 60, 50, 0.6],
  ],
});
const pickPaint = (list, u, jitter) => {
  let total = 0;
  for (const p of list) total += p[3];
  let t = u * total,
    hit = list[list.length - 1];
  for (const p of list) {
    t -= p[3];
    if (t <= 0) {
      hit = p;
      break;
    }
  }
  return rgb(hsla(hit[0], hit[1], clamp(hit[2] + jitter * 8, 3, 97)));
};

/**
 * The five colours of one walker for a look: `top`, `bottom`, `skin`, `hair` and `accent`
 * (hat, scarf, bag and umbrella), each as sRGB red, green and blue from 0 to 1. Colours the
 * look fixes are kept; the rest are drawn from `PERSON_PAINT` by `seed` and `index`.
 */
export function personColors(look, seed = 1, index = 0) {
  const r = (k) => randomAt(seed, 8500 + k, index);
  const outer =
    look.top === 'raincoat'
      ? 'rain'
      : look.top === 'coat' || look.top === 'jacket'
        ? 'coat'
        : look.top === 'sweater'
          ? 'knit'
          : 'light';
  const skirted = look.bottom === 'skirt' || look.bottom === 'dress';
  const auto = {
    top: () => pickPaint(PERSON_PAINT[outer], r(1), r(2) - 0.5),
    bottom: () => pickPaint(PERSON_PAINT[skirted ? 'skirt' : 'legs'], r(3), r(4) - 0.5),
    skin: () => pickPaint(PERSON_PAINT.skin, r(5), r(6) - 0.5),
    hair: () => pickPaint(PERSON_PAINT[look.age === 'older' ? 'grey' : 'hair'], r(7), r(8) - 0.5),
    accent: () => pickPaint(PERSON_PAINT[look.umbrella ? 'umbrella' : 'accent'], r(9), r(10) - 0.5),
  };
  const out = {};
  for (const key of Object.keys(auto)) out[key] = look.colors[key] ?? auto[key]();
  return out;
}

// How much colder or warmer than average people of a regional style dress.
const STYLE_CLIMATE = Object.freeze({ nordic: 0.12, british: 0.04, dutch: 0.03, central: 0.02, mediterranean: -0.16 });
const SEASON_COLD = Object.freeze({ summer: 0.12, spring: 0.45, autumn: 0.56, winter: 0.86 });

/**
 * What the weather asks of clothes, from 0 to 1: `cold`, `rain` and `snow`. `weather` is a
 * name from `WEATHER`, a condition, or nothing; `season` is one of the city's seasons and
 * `style` a regional style or its name.
 */
export function personClimate({ weather = null, season = 'summer', style = null } = {}) {
  assert(
    Object.hasOwn(SEASON_COLD, season),
    'INVALID_CITY',
    `season is one of ${Object.keys(SEASON_COLD).join(', ')}.`,
  );
  let w = weather;
  if (typeof weather === 'string') {
    assert(Object.hasOwn(WEATHER, weather), 'INVALID_CITY', `weather is one of ${Object.keys(WEATHER).join(', ')}.`);
    w = WEATHER[weather];
  }
  const rain = clamp(Number(w?.rain) || 0, 0, 1),
    snow = clamp(Math.max(Number(w?.snowfall) || 0, (Number(w?.snow) || 0) * 0.8), 0, 1);
  const name = typeof style === 'string' ? style : style?.name;
  const offset = Number.isFinite(style?.climate) ? clamp(style.climate, -1, 1) : (STYLE_CLIMATE[name] ?? 0);
  let cold = SEASON_COLD[season] + offset + (rain > 0.3 ? 0.1 : 0);
  if (snow > 0.2) cold = Math.max(cold, 0.86);
  return { cold: clamp(cold, 0, 1), rain, snow };
}

const bell = (x, mid, width) => Math.exp(-(((x - mid) / width) ** 2));

/**
 * Choose a look for the situation: coats, hats and scarves when it is cold or snowing,
 * raincoats and umbrellas in rain, light clothes in summer. `variety` from 0 to 1 sets how
 * far a choice may stray from the likeliest one, and how much bodies differ. `wear` fixes any
 * field of the look. The same `seed` and `index` always give the same look.
 */
export function personWardrobe(spec = {}) {
  options(spec, ['weather', 'season', 'style', 'variety', 'seed', 'index', 'wear'], 'personWardrobe');
  const { cold, rain, snow } = personClimate(spec);
  const variety = number(spec.variety ?? 0.7, 'variety', 0, 1);
  const seed = spec.seed ?? 1,
    index = spec.index ?? 0,
    wear = spec.wear ?? {};
  const r = (k) => randomAt(seed, 8400 + k, index);
  // Pick by weight. With no variety the likeliest wins; with full variety the weights stand.
  const choose = (weights, k) => {
    const names = Object.keys(weights);
    let best = names[0];
    for (const n of names) if (weights[n] > weights[best]) best = n;
    if (variety < 0.03) return best;
    const sharp = names.map((n) => Math.max(0, weights[n]) ** (1 / variety));
    let t = r(k) * sharp.reduce((a, v) => a + v, 0);
    for (let i = 0; i < names.length; i++) if ((t -= sharp[i]) <= 0) return names[i];
    return best;
  };
  const chance = (p, k) => (variety < 0.03 ? p >= 0.5 : r(k) < p);
  const spread = (k) => (r(k) - 0.5) * 2 * variety;
  const wet = rain > 0.3;
  const age = wear.age ?? choose({ adult: 0.78, older: 0.14, child: 0.08 }, 1);
  const top =
    wear.top ??
    choose(
      {
        tshirt: bell(cold, 0.05, 0.28) * (wet ? 0.12 : 1),
        shirt: bell(cold, 0.3, 0.26) * 0.9 * (wet ? 0.3 : 1),
        sweater: bell(cold, 0.5, 0.2) * (wet ? 0.5 : 1),
        jacket: bell(cold, 0.62, 0.24) * 1.1,
        coat: smooth(0.55, 0.9, cold) * 1.7,
        raincoat: wet ? 0.45 + 0.6 * rain : cold < 0.8 ? 0.03 : 0,
      },
      2,
    );
  const bottom =
    wear.bottom ??
    choose(
      {
        trousers: 1 + cold * 2,
        shorts: cold < 0.4 ? (0.4 - cold) * 3 * (wet ? 0.4 : 1) : 0,
        skirt: 0.34 * (1 - cold * 0.6),
        dress: 0.4 * (1 - cold) * (wet ? 0.5 : 1) + 0.04,
      },
      3,
    );
  const outer = top === 'jacket' || top === 'coat' || top === 'raincoat';
  let hood = 'none';
  if (top === 'raincoat') hood = wet ? (chance(0.62, 4) ? 'up' : 'down') : chance(0.7, 4) ? 'down' : 'none';
  else if (outer) hood = snow > 0.3 && chance(0.28, 4) ? 'up' : chance(0.2, 5) ? 'down' : 'none';
  const umbrella = wet ? chance(hood === 'up' ? 0.08 : 0.55, 6) : snow > 0.4 && hood !== 'up' && chance(0.1, 6);
  let hat = 'none';
  if (hood !== 'up') {
    if (cold > 0.55) hat = chance((cold - 0.4) * 0.9 + (snow > 0.2 ? 0.2 : 0), 7) ? 'beanie' : 'none';
    else if (wet) hat = !umbrella && chance(0.2, 7) ? (chance(0.5, 8) ? 'brim' : 'cap') : 'none';
    else if (cold < 0.35) hat = chance(0.2, 7) ? (chance(0.6, 8) ? 'cap' : 'brim') : 'none';
  }
  const older = age === 'older',
    child = age === 'child';
  const hair = choose(
    older
      ? { short: 4, bald: 1.5, bob: 2, bun: 1.5, cropped: 1, long: 0.4, curly: 0.6, ponytail: 0.3 }
      : child
        ? { short: 3, bob: 2, ponytail: 2, long: 1.5, curly: 1, cropped: 0.6, bun: 0.3, bald: 0 }
        : { short: 3, long: 2, bob: 1.6, ponytail: 1.2, curly: 1, cropped: 1, bun: 0.8, bald: 0.5 },
    9,
  );
  const base = AGE_BODY[age];
  const body = (key, amount, k) => clamp(base[key] * (1 + spread(k) * amount), ...personRanges[key]);
  const skirted = bottom === 'skirt' || bottom === 'dress';
  return personLook({
    age,
    height: body('height', child ? 0.12 : 0.085, 10),
    build: body('build', 0.16, 11),
    shoulders: body('shoulders', 0.09, 12),
    hips: body('hips', 0.09, 13),
    legs: body('legs', 0.04, 14),
    head: body('head', 0.04, 15),
    top,
    sleeves:
      top === 'shirt' && cold < 0.35 && chance(0.4, 16)
        ? 0.55
        : top === 'tshirt'
          ? 0.3
          : skirted && bottom === 'dress' && !outer
            ? cold < 0.3
              ? 0.15 + 0.3 * r(17)
              : 1
            : 1,
    tucked: (top === 'shirt' && chance(0.5, 18)) || (top === 'tshirt' && chance(0.22, 18)),
    bottom,
    length:
      bottom === 'trousers'
        ? 1
        : bottom === 'shorts'
          ? 0.2 + 0.3 * r(19)
          : clamp(0.32 + 0.45 * r(19) + cold * 0.2, 0, 1),
    shoes: snow > 0.2 || (cold > 0.75 && chance(0.7, 20)) || (wet && chance(0.35, 20)) ? 'boots' : 'shoes',
    hair,
    hat,
    scarf: cold > 0.5 && (outer || top === 'sweater') && chance((cold - 0.35) * 0.85, 21),
    hood,
    umbrella,
    bag: chance(0.45, 22) ? choose({ backpack: 0.4, shoulder: 0.35, hand: 0.25 }, 23) : 'none',
    gloves: cold > 0.7 && chance(0.5, 24),
    ...wear,
  });
}

/**
 * The numbers that make one walker move like no other, from a look and a seed. `noise` from
 * 0 to 1 scales every variation. `speed` is metres a second; `step` is the length of a step
 * in model metres at that speed; `swing` and `lean` are the arm swing and the forward lean;
 * `drift` is how far the speed wanders, with `driftRate` and `driftPhase`; `pause`, `rest`
 * and `pauseAt` are how often the walker stops, for how long, and when; `wander`,
 * `wanderRate` and `wanderPhase` move the walker from side to side on the pavement.
 */
export function personMotion(
  look,
  { seed = 1, index = 0, noise = 0.6, pauses = 0.25, gait = 'auto', weather = null } = {},
) {
  const r = (k) => randomAt(seed, 8600 + k, index);
  const n = clamp(noise, 0, 1);
  const style = personGaitStyle(look, gait, { seed, index, weather });
  const rig = personRig(look);
  const scale = look.height / rig.height;
  const pace = look.age === 'older' ? 0.8 : look.age === 'child' ? 0.9 : 1;
  const hurry = (1 + (r(1) - 0.5) * 0.5 * n) * style.pace;
  const speed = 1.36 * pace * hurry * Math.sqrt(scale) * (look.umbrella ? 0.95 : 1);
  const leg = (rig.hip - ANKLE) / 0.835;
  // Longer legs and more hurry take longer steps; each walker also has its own habit.
  const step = clamp(0.7 * leg * hurry ** 0.55 * style.step * (1 + (r(2) - 0.5) * 0.14 * n), 0.3, 0.86 * leg);
  return {
    speed,
    step,
    swing: clamp((look.age === 'older' ? 0.7 : 1) * style.swing * (1 + (r(3) - 0.5) * 0.7 * n), 0.15, 1.5),
    lean: clamp((look.age === 'older' ? 0.11 : 0.035) + style.lean + (r(4) - 0.3) * 0.07 * n, -0.08, 0.3),
    gait: style.name,
    drift: 0.14 * n * (0.4 + 0.6 * r(5)),
    driftRate: 0.05 + 0.12 * r(6),
    driftPhase: r(7) * TAU,
    pause: r(8) < pauses * style.pauses ? 35 + 90 * r(9) : 0,
    rest: 2 + 6 * r(10),
    pauseAt: r(11) * 200,
    wander: 0.3 * n * r(12),
    wanderRate: 0.04 + 0.1 * r(13),
    wanderPhase: r(14) * TAU,
    scale,
  };
}

/**
 * Ways of walking. Each is a set of factors on a walker's own pace, step length and arm
 * swing, an added forward lean in radians, and how often it stops. A walker's habits (see
 * personMotion) still vary round the style, so two strollers never move alike.
 */
export const PERSON_GAITS = Object.freeze({
  stroll: Object.freeze({ pace: 0.8, step: 0.9, swing: 0.7, lean: -0.01, pauses: 1.6 }),
  ordinary: Object.freeze({ pace: 1, step: 1, swing: 1, lean: 0, pauses: 1 }),
  brisk: Object.freeze({ pace: 1.2, step: 1.08, swing: 1.25, lean: 0.04, pauses: 0.4 }),
  purposeful: Object.freeze({ pace: 1.1, step: 1.05, swing: 0.8, lean: 0.07, pauses: 0.3 }),
  tired: Object.freeze({ pace: 0.75, step: 0.86, swing: 0.5, lean: 0.1, pauses: 1.3 }),
  shuffle: Object.freeze({ pace: 0.6, step: 0.62, swing: 0.32, lean: 0.14, pauses: 1.8 }),
  jaunty: Object.freeze({ pace: 1.05, step: 1.02, swing: 1.45, lean: -0.03, pauses: 0.8 }),
});
export const personGaits = Object.freeze(Object.keys(PERSON_GAITS));
const GAIT_KEYS = ['style', 'pace', 'step', 'swing', 'lean', 'pauses'];

/**
 * The way one walker walks. `gait` is 'auto', a name from `PERSON_GAITS`, or an object that
 * names a `style` and overrides any of its numbers. With 'auto' the choice follows the look and
 * the weather: older people stroll or shuffle, children are jaunty, and rain or snow hurries
 * everyone. Returns {name, pace, step, swing, lean, pauses}.
 */
export function personGaitStyle(look, gait = 'auto', { seed = 1, index = 0, weather = null } = {}) {
  const r = (k) => randomAt(seed, 8700 + k, index);
  let name = typeof gait === 'string' ? gait : (gait?.style ?? 'auto');
  if (name === 'auto') {
    const wet = Math.max(Number(weather?.rain) || 0, Number(weather?.snowfall) || 0);
    const weights =
      look.age === 'older'
        ? { stroll: 4, ordinary: 2, tired: 2, shuffle: 2 }
        : look.age === 'child'
          ? { jaunty: 4, brisk: 2, ordinary: 2 }
          : { ordinary: 5, stroll: 2, brisk: 2 + 4 * wet, purposeful: 2 + 2 * wet, tired: 1, jaunty: 0.6 };
    let pick = r(1) * Object.values(weights).reduce((a, b) => a + b, 0);
    name = 'ordinary';
    for (const [key, w] of Object.entries(weights))
      if ((pick -= w) <= 0) {
        name = key;
        break;
      }
  }
  assert(Object.hasOwn(PERSON_GAITS, name), 'INVALID_CITY', `gait is 'auto' or one of ${personGaits.join(', ')}.`);
  const out = { name, ...PERSON_GAITS[name] };
  if (gait && typeof gait === 'object') {
    options(gait, GAIT_KEYS, 'gait');
    out.pace = number(gait.pace ?? out.pace, 'gait pace', 0.3, 2);
    out.step = number(gait.step ?? out.step, 'gait step', 0.4, 1.3);
    out.swing = number(gait.swing ?? out.swing, 'gait swing', 0, 1.6);
    out.lean = number(gait.lean ?? out.lean, 'gait lean', -0.1, 0.25);
    out.pauses = number(gait.pauses ?? out.pauses, 'gait pauses', 0, 4);
  }
  return Object.freeze(out);
}
