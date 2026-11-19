import { hsla } from '../../color/space.js';
import { randomAt } from '../../noise/vector.js';
import { gradientRaw3 } from '../../noise/gradient.js';
import { meshBuilder, rgb, shade } from './mesh.js';

// The asset library: every street object the kit can place, generated from a few numbers and
// a seed. Each generator returns a mesh modelled around the point where the object meets the
// ground, with y up. Each vertex carries four extra numbers:
//
//   roughness   0 mirror-like .. 1 matt
//   glow        how strongly the surface shines when its glow kind is switched on
//   kind        see `surfaceKinds`
//   tint        1 where the per-object colour applies (car paint, leaves, cloth), else 0
//
// Objects are modelled once and repeated, so variety comes from several variants of each
// object plus a per-object turn, size and tint chosen when it is placed.

/** What the third extra number means. The renderer switches glows by weather and time of day. */
export const surfaceKinds = Object.freeze({
  plain: 0,
  lamp: 1,
  sign: 2,
  headlight: 3,
  taillight: 4,
  foliage: 5,
  glass: 6,
  signal: 7,
});

const c = (h, s, l) => rgb(hsla(h, s, l));
const IRON = c(210, 6, 16),
  STEEL = c(210, 5, 56),
  GALV = c(205, 6, 66),
  LAMP = c(44, 80, 86),
  LED = c(205, 30, 94),
  GLASS = c(205, 24, 26),
  TYRE = c(0, 0, 9),
  WOOD = c(28, 36, 36),
  CONCRETE = c(40, 5, 62);

function builder() {
  return meshBuilder(4);
}

// ----------------------------------------------------------------------- street lamps

/**
 * Street lamps. Every style returns the mesh and `lights`: where each lamp head hangs, so the
 * renderer can add a halo and the kit can add a pool of light to the street field.
 */
export const lampStyles = Object.freeze(['cobra', 'twin', 'led', 'lantern', 'globe', 'bracket', 'bollard']);
export function lampAsset(style, height = 8, seed = 1) {
  const b = builder();
  const lights = [];
  const r = (k) => randomAt(seed, 7001, k);
  if (style === 'cobra' || style === 'twin') {
    // A tapered steel column with one or two swept arms and a flat head with a lens below.
    const h = height;
    b.extra(0.45, 0, 0, 0);
    b.column(0, 0, 0, 0.9, 0.16, 0.13, STEEL, 10, '');
    b.column(0, 0, 0.9, 0.96, 0.15, 0.1, shade(STEEL, 0.8), 10, '');
    b.column(0, 0, 0.96, h, 0.1, 0.055, GALV, 8, 'top');
    b.box(-0.07, 0.35, 0.13, 0.07, 0.75, 0.15, shade(STEEL, 0.7));
    const arm = (dir) => {
      const reach = 1.6 + r(1) * 0.5;
      const path = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        path.push([dir * reach * (1 - (1 - t) ** 2), h - 0.5 + 0.75 * Math.sin((t * Math.PI) / 2), 0]);
      }
      b.extra(0.45, 0, 0, 0).tube(path, 0.035, GALV, 6, false);
      const x = dir * reach,
        y = h + 0.25;
      b.frame(x, y, 0, [dir, 0, 0], [0, 1, 0], [0, 0, dir]);
      // The head: a shallow shell that widens away from the arm.
      b.extra(0.4, 0, 0, 0);
      b.poly(
        [
          [-0.1, 0.05, -0.1],
          [-0.1, 0.05, 0.1],
          [0.62, 0.02, 0.17],
          [0.62, 0.02, -0.17],
        ],
        shade(GALV, 0.9),
      );
      b.poly(
        [
          [-0.1, -0.06, -0.1],
          [-0.1, 0.05, -0.1],
          [0.62, 0.02, -0.17],
          [0.62, -0.07, -0.17],
        ],
        shade(GALV, 0.8),
      );
      b.poly(
        [
          [-0.1, 0.05, 0.1],
          [-0.1, -0.06, 0.1],
          [0.62, -0.07, 0.17],
          [0.62, 0.02, 0.17],
        ],
        shade(GALV, 0.8),
      );
      b.poly(
        [
          [0.62, -0.07, -0.17],
          [0.62, 0.02, -0.17],
          [0.62, 0.02, 0.17],
          [0.62, -0.07, 0.17],
        ],
        shade(GALV, 0.8),
      );
      b.extra(0.3, 3, 1, 0).poly(
        [
          [0.05, -0.07, -0.11],
          [0.6, -0.08, -0.15],
          [0.6, -0.08, 0.15],
          [0.05, -0.07, 0.11],
        ],
        LAMP,
      );
      b.reset();
      lights.push({ x: x + dir * 0.32, y: y - 0.1, z: 0 });
    };
    arm(1);
    if (style === 'twin') arm(-1);
  } else if (style === 'led') {
    // A slim square column with a thin flat bar head.
    const h = height * 0.8;
    b.extra(0.4, 0, 0, 0);
    b.box(-0.07, 0, -0.07, 0.07, h, 0.07, c(210, 5, 26));
    b.box(-0.11, 0, -0.11, 0.11, 0.25, 0.11, c(210, 5, 20));
    b.box(-0.07, h - 0.05, -0.07, 1.25, h + 0.03, 0.07, c(210, 5, 26));
    b.extra(0.3, 3, 1, 0).box(0.35, h - 0.065, -0.055, 1.2, h - 0.05, 0.055, LED, 'y1');
    lights.push({ x: 0.8, y: h - 0.08, z: 0 });
  } else if (style === 'lantern') {
    // A cast-iron post with a fluted shaft, a collar and a six-sided lantern.
    const h = Math.min(5.2, height * 0.6);
    b.extra(0.55, 0, 0, 0);
    b.lathe(
      0,
      0,
      [
        [0.2, 0],
        [0.2, 0.12],
        [0.15, 0.2],
        [0.13, 0.6],
        [0.16, 0.66],
        [0.1, 0.78],
        [0.075, 1.0],
        [0.06, h - 0.9],
        [0.09, h - 0.82],
        [0.05, h - 0.7],
        [0.045, h - 0.42],
      ],
      IRON,
      10,
    );
    // Ladder bar, as on old gas lamps.
    b.tube(
      [
        [-0.28, h - 0.78, 0],
        [0.28, h - 0.78, 0],
      ],
      0.014,
      IRON,
      5,
    );
    // Cradle arms holding the lantern.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.tube(
        [
          [0, h - 0.5, 0],
          [Math.cos(a) * 0.17, h - 0.38, Math.sin(a) * 0.17],
          [Math.cos(a) * 0.15, h - 0.28, Math.sin(a) * 0.15],
        ],
        0.012,
        IRON,
        4,
        false,
      );
    }
    const y0 = h - 0.3,
      y1 = h + 0.14;
    // Lantern glass: wider at the top, lit from inside.
    b.extra(0.25, 2.4, 1, 0).column(0, 0, y0, y1, 0.13, 0.21, LAMP, 6, '');
    b.extra(0.55, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.tube(
        [
          [Math.cos(a) * 0.132, y0, Math.sin(a) * 0.132],
          [Math.cos(a) * 0.212, y1, Math.sin(a) * 0.212],
        ],
        0.011,
        IRON,
        4,
        false,
      );
    }
    b.column(0, 0, y0 - 0.03, y0, 0.14, 0.14, IRON, 6, 'bottom');
    b.lathe(
      0,
      0,
      [
        [0.25, y1],
        [0.23, y1 + 0.04],
        [0.1, y1 + 0.17],
        [0.05, y1 + 0.22],
        [0.03, y1 + 0.3],
        [0.0, y1 + 0.36],
      ],
      IRON,
      6,
    );
    lights.push({ x: 0, y: h - 0.08, z: 0 });
  } else if (style === 'globe') {
    // A park lamp: a short post and a white globe.
    const h = Math.min(3.8, height * 0.45);
    b.extra(0.5, 0, 0, 0);
    b.lathe(
      0,
      0,
      [
        [0.14, 0],
        [0.14, 0.1],
        [0.08, 0.18],
        [0.055, 0.5],
        [0.05, h - 0.2],
        [0.09, h - 0.16],
        [0.09, h - 0.1],
      ],
      c(150, 14, 18),
      8,
    );
    b.extra(0.3, 2.2, 1, 0).blob(0, h + 0.1, 0, 0.24, 0.24, 0.24, c(44, 30, 92), 2);
    lights.push({ x: 0, y: h + 0.1, z: 0 });
  } else if (style === 'bracket') {
    // A lantern on a scrolled wall bracket. The origin is on the wall at the bracket; z is out.
    b.extra(0.55, 0, 0, 0);
    b.box(-0.06, -0.3, 0, 0.06, 0.3, 0.03, IRON);
    const path = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      path.push([0, 0.2 + 0.18 * Math.sin(t * Math.PI), 0.03 + t * 0.85]);
    }
    b.tube(path, 0.016, IRON, 5, false);
    b.tube(
      [
        [0, -0.2, 0.03],
        [0, 0.12, 0.5],
      ],
      0.012,
      IRON,
      4,
      false,
    );
    b.tube(
      [
        [0, 0.2, 0.88],
        [0, 0.06, 0.88],
      ],
      0.008,
      IRON,
      4,
      false,
    );
    b.extra(0.25, 2.4, 1, 0).column(0, 0.88, -0.36, 0.0, 0.1, 0.17, LAMP, 6, 'bottom');
    b.extra(0.55, 0, 0, 0).lathe(
      0,
      0.88,
      [
        [0.2, 0.0],
        [0.08, 0.1],
        [0.0, 0.16],
      ],
      IRON,
      6,
    );
    lights.push({ x: 0, y: -0.18, z: 0.88 });
  } else {
    // A low bollard light for paths.
    b.extra(0.5, 0, 0, 0).column(0, 0, 0, 0.78, 0.075, 0.075, c(210, 5, 24), 8, '');
    b.extra(0.3, 2, 1, 0).column(0, 0, 0.78, 0.94, 0.07, 0.07, LAMP, 8, '');
    b.extra(0.5, 0, 0, 0).column(0, 0, 0.94, 0.99, 0.09, 0.09, c(210, 5, 24), 8, 'both');
    lights.push({ x: 0, y: 0.86, z: 0 });
  }
  return { mesh: b.finish(), lights };
}

// ------------------------------------------------------------------------------- trees

/** Tree forms. Each has several seeded variants; `season` changes the leaves. */
export const treeForms = Object.freeze(['round', 'oval', 'spreading', 'columnar', 'birch', 'conifer', 'young']);
export const seasons = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

const LEAF = {
  spring: {
    round: [90, 44, 44],
    oval: [84, 42, 42],
    spreading: [96, 40, 40],
    columnar: [102, 34, 36],
    birch: [82, 48, 50],
    conifer: [140, 28, 24],
    young: [88, 48, 48],
  },
  summer: {
    round: [100, 34, 32],
    oval: [94, 32, 30],
    spreading: [106, 30, 29],
    columnar: [112, 28, 27],
    birch: [90, 36, 37],
    conifer: [146, 28, 21],
    young: [96, 38, 35],
  },
  autumn: {
    round: [34, 62, 44],
    oval: [22, 60, 40],
    spreading: [42, 66, 46],
    columnar: [50, 56, 42],
    birch: [48, 72, 52],
    conifer: [146, 26, 21],
    young: [28, 64, 44],
  },
};
/**
 * One tree. `height` in metres, `crown` its widest spread. The trunk and branches are one
 * colour; leaves carry tint 1 so each placed tree can shift its green a little.
 */
export function treeAsset(form, spec = {}) {
  const height = spec.height ?? 10,
    crown = spec.crown ?? height * 0.55,
    seed = spec.seed ?? 1,
    season = spec.season ?? 'summer',
    far = spec.lod === 'far';
  const b = builder();
  const r = (k) => randomAt(seed, 9001, k);
  const bare = season === 'winter' && form !== 'conifer';
  const bark =
    form === 'birch' ? c(40, 8, 84) : form === 'conifer' ? c(18, 26, 26) : c(28 + r(1) * 10, 16, 31 + r(2) * 9);
  const noise = (x, y, z, f) => gradientRaw3(x * f + seed * 0.13, y * f, z * f - seed * 0.07, 77);
  // Trunk: a tapered tube with a slight lean and a flare at the foot.
  const trunkTop =
    form === 'conifer' ? height * 0.96 : form === 'columnar' ? height * 0.7 : height * (0.42 + r(3) * 0.1);
  const lean = [(r(4) - 0.5) * 0.5, (r(5) - 0.5) * 0.5];
  const girth = Math.max(0.07, (form === 'young' ? 0.012 : form === 'birch' ? 0.016 : 0.022) * height + crown * 0.008);
  const trunk = [],
    radii = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunk.push([lean[0] * t * t, trunkTop * t, lean[1] * t * t]);
    radii.push(girth * (1 - t * 0.55) * (i === 0 ? 1.45 : 1));
  }
  b.extra(0.95, 0, 0, 0).tube(trunk, radii, bark, 7, false);
  if (form === 'birch') {
    // Dark bands on white bark.
    for (let k = 0; k < 5; k++) {
      const y = trunkTop * (0.12 + r(10 + k) * 0.7),
        rad = girth * (1 - (y / trunkTop) * 0.55) * 1.02;
      b.column(
        lean[0] * (y / trunkTop) ** 2,
        lean[1] * (y / trunkTop) ** 2,
        y,
        y + 0.06 + r(20 + k) * 0.08,
        rad,
        rad,
        c(30, 8, 16),
        7,
        '',
      );
    }
  }
  const top = trunk[trunk.length - 1];
  // Limbs: a few rising branches that split once or twice.
  const tips = [];
  const limb = (from, dir, length, radius, depth, k) => {
    const path = [from];
    let p = from,
      d = dir;
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      d = [d[0] + (randomAt(seed, k, i) - 0.5) * 0.3, d[1] + 0.08, d[2] + (randomAt(seed, k, i + 9) - 0.5) * 0.3];
      const l = Math.hypot(d[0], d[1], d[2]);
      d = [d[0] / l, d[1] / l, d[2] / l];
      p = [p[0] + (d[0] * length) / steps, p[1] + (d[1] * length) / steps, p[2] + (d[2] * length) / steps];
      path.push(p);
    }
    b.extra(0.95, 0, 0, 0).tube(
      path,
      path.map((_, i) => radius * (1 - (i / steps) * 0.6)),
      bark,
      depth > 1 ? 5 : 4,
      false,
    );
    tips.push(p);
    if (depth <= 0) return;
    const forks = 2 + (randomAt(seed, k, 30) < 0.4 ? 1 : 0);
    for (let j = 0; j < forks; j++) {
      const a = randomAt(seed, k, 40 + j) * Math.PI * 2,
        spread = 0.5 + randomAt(seed, k, 50 + j) * 0.5;
      limb(
        path[2 + (j % 2)],
        [d[0] + Math.cos(a) * spread, d[1] * 0.7 + 0.25, d[2] + Math.sin(a) * spread],
        length * (0.62 + randomAt(seed, k, 60 + j) * 0.15),
        radius * 0.5,
        depth - 1,
        k * 7 + j + 1,
      );
    }
  };
  if (form !== 'conifer' && !(far && season !== 'winter')) {
    const limbs = far ? 3 : form === 'young' ? 3 : form === 'columnar' ? 5 : 4 + Math.floor(r(6) * 3);
    const depth = bare ? (form === 'young' || far ? 1 : 2) : far || form === 'young' ? 0 : 1;
    for (let k = 0; k < limbs; k++) {
      const a = (k / limbs) * Math.PI * 2 + r(30 + k) * 0.9;
      const out = form === 'columnar' ? 0.25 : form === 'spreading' ? 1.0 : 0.65;
      const start = trunk[3 + (k % 3)];
      limb(
        start,
        [Math.cos(a) * out, 0.75, Math.sin(a) * out],
        (height - start[1]) *
          (bare ? (form === 'spreading' ? 0.8 : 0.62) : form === 'spreading' ? 0.62 : 0.52) *
          (0.8 + r(40 + k) * 0.3),
        girth * 0.42,
        depth,
        100 + k * 13,
      );
    }
  }
  if (bare) return { mesh: b.finish() };
  const hsl = LEAF[season === 'winter' ? 'summer' : season][form];
  const leaf = (dh = 0, dl = 0) => c(hsl[0] + dh, hsl[1], hsl[2] + dl);
  if (form === 'conifer') {
    // Stacked skirts of needles, each a drooping cone with a ragged edge.
    const tiers = far ? 3 : 6 + Math.floor(r(7) * 3);
    const y0 = height * 0.14;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers,
        y = y0 + (height - y0) * t,
        radius = (crown / 2) * (1 - t * 0.92) * (0.9 + r(50 + i) * 0.2),
        drop = (height - y0) / tiers;
      const sides = 9,
        first = b.vertexCount,
        tone = leaf((r(60 + i) - 0.5) * 6, -3 + t * 7);
      b.extra(0.9, 0, 5, 1);
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2 + i,
          rag = 1 + 0.16 * Math.sin(s * 2.4 + i * 1.7),
          ca = Math.cos(a),
          sa = Math.sin(a);
        b.vertex(ca * radius * rag, y - drop * 0.25, sa * radius * rag, ca * 0.75, 0.55, sa * 0.75, shade(tone, 0.8));
        b.vertex(ca * radius * 0.12, y + drop * 1.25, sa * radius * 0.12, ca * 0.55, 0.8, sa * 0.55, shade(tone, 1.15));
      }
      for (let s = 0; s < sides; s++) {
        const k = first + s * 2;
        b.tri(k, k + 1, k + 3);
        b.tri(k, k + 3, k + 2);
      }
    }
    return { mesh: b.finish() };
  }
  // Crown: foliage grows from the wood. Every lump of leaves is centred on a branch tip, on the
  // top of the trunk, or inside a lump that is already attached, so nothing floats. Lumps stay
  // inside an egg-shaped envelope whose proportions differ from tree to tree.
  const crownBase = form === 'columnar' ? height * 0.22 : trunkTop * 0.95;
  const halfH = ((height - crownBase) / 2) * (0.88 + r(150) * 0.24);
  const halfW = (crown / 2) * (form === 'columnar' ? 0.6 : 1) * (0.86 + r(151) * 0.28);
  // The crown leans a little off the trunk, as real crowns do toward light.
  const centre = [top[0] + (r(152) - 0.5) * halfW * 0.35, crownBase + halfH, top[2] + (r(153) - 0.5) * halfW * 0.35];
  const base = halfW * (form === 'birch' ? 0.34 : 0.4);
  const clampToEnvelope = (p) => {
    const d = [(p[0] - centre[0]) / halfW, (p[1] - centre[1]) / halfH, (p[2] - centre[2]) / halfW];
    const l = Math.hypot(d[0], d[1], d[2]);
    return l <= 1
      ? p
      : [centre[0] + (d[0] / l) * halfW, centre[1] + (d[1] / l) * halfH, centre[2] + (d[2] / l) * halfW];
  };
  const lumps = [];
  const grow = (p, k, scale = 1, fine = false) => {
    const rx = base * scale * (0.75 + r(110 + k) * 0.5);
    lumps.push({ p, rx, ry: rx * (0.62 + r(120 + k) * 0.3), fine });
  };
  // Anchors: the trunk top and every branch tip carry leaves.
  grow([top[0], Math.max(top[1], crownBase + base * 0.4), top[2]], 0, 1.15);
  const anchors = far ? tips.slice(0, 2) : tips;
  anchors.forEach((tip, k) => grow(clampToEnvelope([tip[0], tip[1] + base * 0.15, tip[2]]), 1 + k));
  // Fill: each new lump starts inside an attached one and pushes outward and upward by less
  // than that lump's radius, so the two always overlap.
  // Many small masses read as foliage with sky showing between them; a few big ones read as balls.
  const fill = far ? 2 : form === 'young' ? 9 : form === 'columnar' ? 16 : 22 + Math.floor(r(8) * 12);
  for (let k = 0; k < fill; k++) {
    const parent = lumps[Math.floor(r(160 + k) * lumps.length)];
    const a = k * 2.39996 + r(80 + k) * 0.9,
      up = -0.15 + r(70 + k) * 1.0,
      ring = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(up)) ** 2));
    const reach = parent.rx * (0.7 + r(90 + k) * 0.28);
    grow(
      clampToEnvelope([
        parent.p[0] + Math.cos(a) * ring * reach,
        parent.p[1] + up * parent.ry * 0.85,
        parent.p[2] + Math.sin(a) * ring * reach,
      ]),
      20 + k,
      far ? 1.1 : 0.5 + r(170 + k) * 0.35,
      !far,
    );
  }
  b.extra(0.9, 0, 5, 1);
  lumps.forEach((lump, k) => {
    const hue = (r(130 + k) - 0.5) * 9,
      tone = leaf(hue, (r(140 + k) - 0.5) * 5);
    b.blob(
      lump.p[0],
      lump.p[1],
      lump.p[2],
      lump.rx * (far ? 1.35 : 1),
      lump.ry * (far ? 1.25 : 1),
      lump.rx * (far ? 1.35 : 1),
      tone,
      far || lump.fine ? 1 : 2,
      (x, y, z) => 1 + 0.3 * noise(x + k, y, z, 2.3) + 0.2 * noise(x, y + k, z, 5.9),
      (x, y, z) => {
        const world = (lump.p[1] + y * lump.ry - crownBase) / (halfH * 2);
        const lightness = 0.62 + 0.5 * Math.min(1, Math.max(0, world)) + 0.12 * noise(x * 2, y * 2 + k, z * 2, 2.3);
        return shade(tone, lightness);
      },
    );
  });
  return { mesh: b.finish() };
}

/** A low clipped shrub or hedge ball for planters and park edges. */
export function shrubAsset(seed = 1) {
  const b = builder();
  const base = c(110 + randomAt(seed, 1, 1) * 20, 34, 26);
  b.extra(0.9, 0, 5, 1);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + randomAt(seed, 2, k),
      d = k ? 0.35 : 0;
    b.blob(
      Math.cos(a) * d,
      0.45 + randomAt(seed, 3, k) * 0.2,
      Math.sin(a) * d,
      0.5,
      0.42,
      0.5,
      base,
      1,
      (x, y, z) => 1 + 0.18 * gradientRaw3(x * 2 + k, y * 2, z * 2 + seed, 5),
      (x, y) => shade(base, 0.7 + 0.5 * (y * 0.5 + 0.5)),
    );
  }
  return { mesh: b.finish() };
}

// --------------------------------------------------------------------------- vehicles

export const carBodies = Object.freeze(['hatch', 'sedan', 'estate', 'suv', 'van']);
/**
 * A parked car, nose toward +x. The paint is white with tint 1, so each placed car takes its
 * own colour. Head and tail lights carry glow kinds the renderer may switch on.
 */
export function carAsset(body = 'hatch') {
  const S = {
    hatch: {
      len: 4.0,
      w: 0.86,
      hood: 0.78,
      belt: 0.92,
      roof: 1.46,
      cabin: [-1.75, 0.85],
      rake: [0.75, 0.3],
      wheel: 0.31,
      base: [-1.25, 1.22],
    },
    sedan: {
      len: 4.6,
      w: 0.89,
      hood: 0.76,
      belt: 0.9,
      roof: 1.42,
      cabin: [-1.35, 0.8],
      rake: [0.8, 0.75],
      wheel: 0.32,
      base: [-1.38, 1.4],
    },
    estate: {
      len: 4.7,
      w: 0.89,
      hood: 0.78,
      belt: 0.92,
      roof: 1.46,
      cabin: [-2.2, 0.85],
      rake: [0.8, 0.28],
      wheel: 0.32,
      base: [-1.4, 1.42],
    },
    suv: {
      len: 4.6,
      w: 0.94,
      hood: 0.98,
      belt: 1.12,
      roof: 1.72,
      cabin: [-2.15, 0.75],
      rake: [0.6, 0.3],
      wheel: 0.37,
      base: [-1.38, 1.38],
    },
    van: {
      len: 5.2,
      w: 0.98,
      hood: 1.02,
      belt: 1.2,
      roof: 2.1,
      cabin: [-2.52, 1.75],
      rake: [0.5, 0.06],
      wheel: 0.35,
      base: [-1.6, 1.62],
    },
  }[body];
  const b = builder();
  const paint = [1, 1, 1],
    under = c(0, 0, 12);
  const L = S.len / 2,
    w = S.w;
  // Lower body as a loft along the car: stations of x with the top height there.
  const stations = [
    [-L, S.belt * 0.86, 0.9],
    [-L + 0.12, S.belt, 0.97],
    [S.cabin[0], S.belt, 1],
    [S.cabin[1], S.belt, 1],
    [S.cabin[1] + 0.25, S.hood, 1],
    [L - 0.35, S.hood - 0.05, 0.98],
    [L - 0.06, S.hood - 0.18, 0.92],
    [L, S.hood - 0.3, 0.86],
  ];
  const floor = 0.24;
  b.extra(0.28, 0, 0, 1);
  for (let i = 0; i + 1 < stations.length; i++) {
    const [x0, h0, k0] = stations[i],
      [x1, h1, k1] = stations[i + 1];
    const w0 = w * k0,
      w1 = w * k1;
    // Sides tuck in toward the sill, which is what makes a body look like pressed metal.
    for (const s of [1, -1]) {
      const A = [x0, floor, s * w0 * 0.94],
        B = [x1, floor, s * w1 * 0.94],
        C = [x1, h1 * 0.62, s * w1],
        D = [x0, h0 * 0.62, s * w0],
        E = [x1, h1, s * w1 * 0.95],
        F = [x0, h0, s * w0 * 0.95];
      if (s > 0) {
        b.quad(A, B, C, D, paint);
        b.quad(D, C, E, F, paint);
      } else {
        b.quad(B, A, D, C, paint);
        b.quad(C, D, F, E, paint);
      }
    }
    b.quad([x0, h0, w0 * 0.95], [x1, h1, w1 * 0.95], [x1, h1, -w1 * 0.95], [x0, h0, -w0 * 0.95], paint);
    b.extra(0.9, 0, 0, 0).quad(
      [x0, floor, -w0 * 0.94],
      [x1, floor, -w1 * 0.94],
      [x1, floor, w1 * 0.94],
      [x0, floor, w0 * 0.94],
      under,
    );
    b.extra(0.28, 0, 0, 1);
  }
  // Nose and tail panels.
  const cap = (st, front) => {
    const [x, h, k] = st,
      ww = w * k;
    const pts = [
      [x, floor, -ww * 0.94],
      [x, h * 0.62, -ww],
      [x, h, -ww * 0.95],
      [x, h, ww * 0.95],
      [x, h * 0.62, ww],
      [x, floor, ww * 0.94],
    ];
    b.poly(front ? pts : pts.reverse(), paint);
  };
  cap(stations[0], false);
  cap(stations[stations.length - 1], true);
  // Bumpers and grille in dark trim.
  b.extra(0.6, 0, 0, 0);
  b.box(L - 0.03, floor, -w * 0.84, L + 0.04, floor + 0.22, w * 0.84, under);
  b.box(-L - 0.04, floor, -w * 0.84, -L + 0.03, floor + 0.22, w * 0.84, under);
  b.box(L - 0.02, S.hood - 0.42, -w * 0.5, L + 0.015, S.hood - 0.3, w * 0.5, c(0, 0, 6));
  // Lights.
  for (const s of [1, -1]) {
    b.extra(0.2, 2.2, 3, 0).box(
      L - 0.05,
      S.hood - 0.32,
      s * w * 0.6 - 0.14,
      L + 0.02,
      S.hood - 0.2,
      s * w * 0.6 + 0.14,
      c(48, 20, 92),
    );
    b.extra(0.25, 1.6, 4, 0).box(
      -L - 0.02,
      S.belt * 0.86 - 0.2,
      s * w * 0.66 - 0.12,
      -L + 0.05,
      S.belt * 0.86 - 0.06,
      s * w * 0.66 + 0.12,
      c(2, 80, 40),
    );
  }
  // Cabin: glass all round under a painted roof.
  const [xa, xb] = S.cabin,
    [rakeFront, rakeRear] = S.rake;
  const wb = w * 0.93,
    wt = w * 0.76,
    y0 = S.belt,
    y1 = S.roof;
  const P = (x, y, z) => [x, y, z];
  const bl = P(xa, y0, wb),
    br = P(xa, y0, -wb),
    fl = P(xb, y0, wb),
    fr = P(xb, y0, -wb);
  const tbl = P(xa + rakeRear, y1, wt),
    tbr = P(xa + rakeRear, y1, -wt),
    tfl = P(xb - rakeFront, y1, wt),
    tfr = P(xb - rakeFront, y1, -wt);
  b.extra(0.06, 0, 6, 0);
  b.quad(fl, fr, tfr, tfl, GLASS); // windscreen
  b.quad(br, bl, tbl, tbr, body === 'van' ? under : GLASS); // rear window
  if (body === 'van') {
    // A van has glass only beside the driver; the load space is painted.
    const mid = xb - 1.5;
    b.extra(0.28, 0, 0, 1);
    b.quad(bl, P(mid, y0, wb), P(mid, y1, wt), tbl, paint);
    b.quad(P(mid, y0, -wb), br, tbr, P(mid, y1, -wt), paint);
    b.extra(0.06, 0, 6, 0);
    b.quad(P(mid, y0, wb), fl, tfl, P(mid, y1, wt), GLASS);
    b.quad(fr, P(mid, y0, -wb), P(mid, y1, -wt), tfr, GLASS);
  } else {
    b.quad(bl, fl, tfl, tbl, GLASS);
    b.quad(fr, br, tbr, tfr, GLASS);
    // Door pillars.
    const px = (xa + xb) / 2 + 0.05;
    b.extra(0.3, 0, 0, 1);
    for (const s of [1, -1]) {
      const z0 = s * (wb + 0.004),
        z1 = s * (wt + 0.004);
      const pts = [
        [px - 0.05, y0, z0],
        [px + 0.05, y0, z0],
        [px + 0.05, y1, z1],
        [px - 0.05, y1, z1],
      ];
      b.poly(s > 0 ? pts : pts.reverse(), paint);
    }
  }
  b.extra(0.28, 0, 0, 1).quad(tbl, tfl, tfr, tbr, paint, [0, 1, 0]);
  // Wing mirrors.
  for (const s of [1, -1])
    b.extra(0.3, 0, 0, 1).box(
      xb - 0.12,
      y0 + 0.02,
      s * (wb + 0.02) - 0.07,
      xb + 0.02,
      y0 + 0.14,
      s * (wb + 0.02) + 0.07,
      paint,
    );
  // Wheels: tyres with a pale hub, set into the body.
  for (const x of S.base)
    for (const s of [1, -1]) {
      b.frame(x, S.wheel, s * (w - 0.09), [1, 0, 0], [0, 0, s], [0, -s, 0]);
      b.extra(0.9, 0, 0, 0).column(0, 0, -0.11, 0.11, S.wheel, S.wheel, TYRE, 14, 'both');
      b.extra(0.35, 0, 0, 0).column(0, 0, 0.11, 0.125, S.wheel * 0.6, S.wheel * 0.55, c(210, 4, 62), 10, 'top');
      b.reset();
    }
  return { mesh: b.finish(), length: S.len, width: S.w * 2 };
}

/** A bicycle, nose toward +x, leaning on its stand. The frame carries tint 1. */
export function bikeAsset(kind = 'city') {
  const b = builder();
  const wheel = 0.34,
    base = 1.08;
  const ring = (x) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([x + Math.cos(a) * wheel, wheel + Math.sin(a) * wheel, 0]);
    }
    b.extra(0.9, 0, 0, 0).tube(pts, 0.022, TYRE, 4, false);
    b.extra(0.4, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      b.tube(
        [
          [x - Math.cos(a) * wheel, wheel - Math.sin(a) * wheel, 0],
          [x + Math.cos(a) * wheel, wheel + Math.sin(a) * wheel, 0],
        ],
        0.004,
        c(210, 4, 70),
        3,
        false,
      );
    }
  };
  ring(-base / 2);
  ring(base / 2);
  const paint = [1, 1, 1];
  const crank = [-0.08, 0.3, 0],
    seat = [-0.22, 0.86, 0],
    head = [0.36, 0.9, 0],
    rear = [-base / 2, wheel, 0],
    front = [base / 2, wheel, 0];
  b.extra(0.35, 0, 0, 1);
  b.tube([crank, seat], 0.018, paint, 5);
  b.tube([seat, head], kind === 'city' ? 0.016 : 0.018, paint, 5);
  b.tube([crank, [0.34, 0.76, 0]], 0.02, paint, 5);
  b.tube([rear, crank], 0.012, paint, 4);
  b.tube([rear, seat], 0.012, paint, 4);
  b.tube([head, [0.4, 0.62, 0], front], 0.016, paint, 5);
  b.extra(0.5, 0, 0, 0);
  b.tube([head, [0.33, 1.04, 0]], 0.014, c(210, 4, 66), 4);
  b.tube(
    [
      [0.3, 1.05, -0.26],
      [0.33, 1.04, 0],
      [0.3, 1.05, 0.26],
    ],
    0.012,
    c(0, 0, 14),
    4,
  );
  b.tube([seat, [-0.24, 0.96, 0]], 0.014, c(210, 4, 66), 4);
  b.box(-0.36, 0.95, -0.07, -0.1, 0.99, 0.07, c(20, 20, 14));
  if (kind === 'city') {
    // Mudguard arcs and a rear rack: what makes it a town bike.
    for (const x of [-base / 2, base / 2]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (0.15 + (i / 6) * 0.75);
        pts.push([x + Math.cos(a) * (wheel + 0.04), wheel + Math.sin(a) * (wheel + 0.04), 0]);
      }
      b.extra(0.4, 0, 0, 1).tube(pts, 0.012, paint, 3, false);
    }
    b.extra(0.5, 0, 0, 0).box(-0.72, 0.72, -0.07, -0.3, 0.735, 0.07, c(0, 0, 14));
  }
  return { mesh: b.finish() };
}

/** A small open boat moored on a canal, bow toward +x. The hull carries tint 1. */
export function boatAsset(seed = 1) {
  const b = builder();
  const len = 4.6 + randomAt(seed, 5, 1) * 2,
    beam = 0.85 + randomAt(seed, 5, 2) * 0.2;
  const hull = [1, 1, 1],
    inside = c(32, 24, 46);
  const st = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8,
      x = (t - 0.5) * len;
    const wd =
      beam *
      Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.95)) ** 0.6 *
      (t > 0.82 ? 1 - ((t - 0.82) / 0.18) ** 2 * 0.95 : 1);
    st.push([x, Math.max(0.03, wd), 0.38 + t * t * 0.22]);
  }
  for (let i = 0; i + 1 < st.length; i++) {
    const [x0, w0, h0] = st[i],
      [x1, w1, h1] = st[i + 1];
    b.extra(0.4, 0, 0, 1);
    b.quad([x0, -0.12, w0 * 0.5], [x1, -0.12, w1 * 0.5], [x1, h1, w1], [x0, h0, w0], hull);
    b.quad([x1, -0.12, -w1 * 0.5], [x0, -0.12, -w0 * 0.5], [x0, h0, -w0], [x1, h1, -w1], hull);
    b.extra(0.8, 0, 0, 0);
    b.quad([x0, h0, w0], [x1, h1, w1], [x1, h1 - 0.26, w1 * 0.8], [x0, h0 - 0.26, w0 * 0.8], inside);
    b.quad([x1, h1, -w1], [x0, h0, -w0], [x0, h0 - 0.26, -w0 * 0.8], [x1, h1 - 0.26, -w1 * 0.8], inside);
    b.quad(
      [x0, h0 - 0.26, w0 * 0.8],
      [x1, h1 - 0.26, w1 * 0.8],
      [x1, h1 - 0.26, -w1 * 0.8],
      [x0, h0 - 0.26, -w0 * 0.8],
      shade(inside, 0.8),
      [0, 1, 0],
    );
  }
  b.extra(0.4, 0, 0, 1).poly(
    [
      [st[0][0], -0.12, -st[0][1] * 0.5],
      [st[0][0], st[0][2], -st[0][1]],
      [st[0][0], st[0][2], st[0][1]],
      [st[0][0], -0.12, st[0][1] * 0.5],
    ],
    hull,
  );
  // Thwarts and, on some boats, a canvas cover over the stern.
  b.extra(0.8, 0, 0, 0);
  for (const t of [0.3, 0.55])
    b.box((t - 0.5) * len - 0.12, 0.26, -beam * 0.8, (t - 0.5) * len + 0.12, 0.3, beam * 0.8, WOOD);
  if (randomAt(seed, 5, 3) < 0.5)
    b.extra(0.9, 0, 0, 0).box(
      -len * 0.48,
      0.4,
      -beam * 0.86,
      -len * 0.05,
      0.47,
      beam * 0.86,
      c(200 + randomAt(seed, 5, 4) * 40, 22, 30),
    );
  return { mesh: b.finish(), length: len };
}

// -------------------------------------------------------------------------- furniture

export const furnitureKinds = Object.freeze([
  'bench',
  'benchModern',
  'bin',
  'binBox',
  'bollard',
  'bollardSteel',
  'bikeRack',
  'shelter',
  'signal',
  'signRound',
  'signTriangle',
  'signPlate',
  'postbox',
  'hydrant',
  'cabinet',
  'planter',
  'cafeTable',
  'cafeChair',
  'umbrella',
  'kiosk',
]);

/** Street furniture by name. Unknown names are refused by the caller. */
export function furnitureAsset(kind, seed = 1) {
  const b = builder();
  const r = (k) => randomAt(seed, 3001, k);
  b.extra(0.7, 0, 0, 0);
  switch (kind) {
    case 'bench': {
      // Slatted timber on cast-iron ends.
      for (const x of [-0.78, 0.78]) {
        b.extra(0.55, 0, 0, 0);
        b.tube(
          [
            [x, 0, 0.26],
            [x, 0.4, 0.2],
            [x, 0.44, -0.2],
            [x, 0.9, -0.3],
          ],
          0.025,
          IRON,
          5,
        );
        b.tube(
          [
            [x, 0, -0.26],
            [x, 0.42, -0.18],
          ],
          0.025,
          IRON,
          5,
        );
        b.tube(
          [
            [x, 0.44, 0.2],
            [x, 0.62, 0.24],
            [x, 0.62, -0.05],
          ],
          0.018,
          IRON,
          4,
        );
      }
      b.extra(0.8, 0, 0, 0);
      for (let i = 0; i < 5; i++)
        b.box(-0.9, 0.44, 0.19 - i * 0.095, 0.9, 0.47, 0.265 - i * 0.095, shade(WOOD, 0.9 + (i % 2) * 0.15));
      for (let i = 0; i < 3; i++) {
        const y = 0.6 + i * 0.11,
          z = -0.215 - i * 0.03;
        b.box(-0.9, y, z - 0.015, 0.9, y + 0.08, z + 0.015, shade(WOOD, 0.95 + (i % 2) * 0.12));
      }
      break;
    }
    case 'benchModern':
      b.extra(0.85, 0, 0, 0)
        .box(-0.9, 0, -0.24, -0.6, 0.4, 0.24, CONCRETE)
        .box(0.6, 0, -0.24, 0.9, 0.4, 0.24, CONCRETE);
      b.extra(0.75, 0, 0, 0);
      for (let i = 0; i < 4; i++)
        b.box(-1.0, 0.4, -0.24 + i * 0.125, 1.0, 0.45, -0.14 + i * 0.125, shade(c(30, 40, 42), 0.9 + (i % 2) * 0.14));
      break;
    case 'bin':
      b.extra(0.5, 0, 0, 0).column(0, 0, 0.08, 0.86, 0.2, 0.24, c(150, 22, 20), 10, '');
      b.column(0, 0, 0.86, 0.9, 0.26, 0.26, c(150, 22, 14), 10, 'top');
      b.column(0, 0, 0, 0.08, 0.1, 0.1, IRON, 8, '');
      b.extra(0.9, 0, 0, 0).column(0, 0, 0.9, 0.905, 0.17, 0.17, c(0, 0, 4), 10, 'top');
      break;
    case 'binBox':
      b.extra(0.45, 0, 0, 0).box(-0.24, 0.04, -0.2, 0.24, 0.95, 0.2, c(210, 6, 32));
      b.box(-0.27, 0.95, -0.23, 0.27, 1.0, 0.23, c(210, 6, 22));
      b.extra(0.9, 0, 0, 0).box(-0.16, 0.72, 0.2, 0.16, 0.86, 0.205, c(0, 0, 4));
      break;
    case 'bollard':
      // The squat cast-iron bollard of old towns.
      b.extra(0.6, 0, 0, 0).lathe(
        0,
        0,
        [
          [0.11, 0],
          [0.11, 0.08],
          [0.08, 0.14],
          [0.075, 0.62],
          [0.1, 0.68],
          [0.1, 0.72],
          [0.07, 0.78],
          [0.0, 0.84],
        ],
        c(8, 44, 22),
        8,
      );
      break;
    case 'bollardSteel':
      b.extra(0.3, 0, 0, 0).column(0, 0, 0, 0.95, 0.055, 0.055, c(210, 4, 70), 8, 'top');
      b.extra(0.5, 0, 0, 0).column(0, 0, 0.78, 0.84, 0.057, 0.057, c(0, 0, 12), 8, '');
      break;
    case 'bikeRack':
      // A row of hoops.
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.7,
          pts = [];
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI;
          pts.push([x, 0.5 + Math.sin(a) * 0.32, Math.cos(a) * 0.36]);
        }
        b.extra(0.3, 0, 0, 0).tube([[x, 0, 0.36], ...pts, [x, 0, -0.36]], 0.022, c(210, 4, 66), 5, false);
      }
      break;
    case 'shelter': {
      // Bus shelter: glass back and one side, a thin roof, a bench and a route sign.
      const frame = c(210, 6, 24);
      b.extra(0.4, 0, 0, 0);
      for (const x of [-1.9, 0, 1.9]) b.box(x - 0.04, 0, -0.62, x + 0.04, 2.5, -0.54, frame);
      b.box(1.86, 0, 0.56, 1.94, 2.5, 0.64, frame);
      b.box(-2.1, 2.5, -0.75, 2.1, 2.58, 0.85, frame);
      b.extra(0.05, 0, 6, 0);
      b.box(-1.86, 0.25, -0.59, -0.04, 2.3, -0.575, c(200, 20, 40));
      b.box(0.04, 0.25, -0.59, 1.86, 2.3, -0.575, c(200, 20, 40));
      b.box(1.89, 0.25, -0.54, 1.905, 2.3, 0.56, c(200, 20, 40));
      b.extra(0.8, 0, 0, 0).box(-1.5, 0.44, -0.5, 0.6, 0.49, -0.14, WOOD);
      b.extra(0.5, 0, 0, 0).box(-1.4, 0, -0.36, -1.32, 0.44, -0.28, frame).box(0.42, 0, -0.36, 0.5, 0.44, -0.28, frame);
      // A lit advert panel on the closed side.
      b.extra(0.4, 1.4, 2, 0).box(1.86, 0.5, -0.4, 1.885, 2.2, 0.45, c(40 + r(1) * 200, 50, 62));
      b.extra(0.4, 0, 0, 0).column(-2.5, 0.2, 0, 2.7, 0.04, 0.04, frame, 6, 'top');
      b.extra(0.5, 0.8, 2, 0).box(-2.74, 2.25, 0.18, -2.26, 2.7, 0.22, c(48, 80, 54));
      break;
    }
    case 'signal': {
      const dark = c(150, 10, 12);
      b.extra(0.5, 0, 0, 0).column(0, 0, 0, 3.2, 0.06, 0.055, c(150, 10, 18), 8, 'top');
      b.box(-0.14, 2.3, 0.05, 0.14, 3.15, 0.25, dark);
      const lit = Math.floor(r(1) * 3);
      // Lenses are modelled flat on the housing front.
      b.extra(0.5, 0, 0, 0);
      [3.0, 2.73, 2.46].forEach((y, i) => {
        const col = [
          [2, 76, 46],
          [40, 90, 52],
          [140, 70, 42],
        ][i];
        const on = i === lit;
        b.extra(0.3, on ? 3 : 0.1, 7, 0);
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          pts.push([Math.cos(a) * 0.085, y + Math.sin(a) * 0.085, 0.255]);
        }
        b.poly(pts, c(col[0], col[1], on ? col[2] + 12 : col[2] * 0.35), [0, 0, 1]);
        b.extra(0.5, 0, 0, 0).box(-0.11, y + 0.085, 0.25, 0.11, y + 0.1, 0.36, dark);
      });
      break;
    }
    case 'signRound':
    case 'signTriangle':
    case 'signPlate': {
      b.extra(0.4, 0, 0, 0).column(0, 0, 0, 2.6, 0.03, 0.03, GALV, 6, 'top');
      const y = 2.3;
      if (kind === 'signRound') {
        const blue = r(1) < 0.5;
        const ringPts = (rad, z) => {
          const pts = [];
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            pts.push([Math.cos(a) * rad, y + Math.sin(a) * rad, z]);
          }
          return pts;
        };
        b.extra(0.4, 0, 0, 0).poly(ringPts(0.3, 0.035), blue ? c(215, 70, 40) : c(2, 76, 46), [0, 0, 1]);
        b.poly(ringPts(0.21, 0.037), blue ? c(215, 70, 40) : c(0, 0, 96), [0, 0, 1]);
        if (blue) b.box(-0.04, y - 0.16, 0.038, 0.04, y + 0.16, 0.04, c(0, 0, 96));
        b.poly(ringPts(0.3, -0.005).reverse(), GALV, [0, 0, -1]);
      } else if (kind === 'signTriangle') {
        b.poly(
          [
            [-0.36, y - 0.26, 0.035],
            [0.36, y - 0.26, 0.035],
            [0, y + 0.36, 0.035],
          ],
          c(2, 76, 46),
          [0, 0, 1],
        );
        b.poly(
          [
            [-0.24, y - 0.19, 0.037],
            [0.24, y - 0.19, 0.037],
            [0, y + 0.22, 0.037],
          ],
          c(0, 0, 96),
          [0, 0, 1],
        );
        b.poly(
          [
            [0.36, y - 0.26, -0.005],
            [-0.36, y - 0.26, -0.005],
            [0, y + 0.36, -0.005],
          ],
          GALV,
          [0, 0, -1],
        );
      } else {
        const blue = c(215, 60, 34);
        b.box(-0.45, y - 0.12, 0.03, 0.45, y + 0.12, 0.045, r(1) < 0.6 ? blue : c(0, 0, 96));
        b.box(-0.38, y - 0.02, 0.045, 0.3, y + 0.03, 0.047, r(1) < 0.6 ? c(0, 0, 96) : c(0, 0, 10));
      }
      break;
    }
    case 'postbox':
      b.extra(0.4, 0, 0, 1).lathe(
        0,
        0,
        [
          [0.2, 0],
          [0.2, 0.06],
          [0.17, 0.1],
          [0.17, 1.15],
          [0.2, 1.18],
          [0.2, 1.22],
          [0.12, 1.34],
          [0.0, 1.38],
        ],
        [1, 1, 1],
        12,
      );
      b.extra(0.9, 0, 0, 0).box(-0.09, 1.0, 0.165, 0.09, 1.03, 0.175, c(0, 0, 4));
      break;
    case 'hydrant':
      b.extra(0.5, 0, 0, 0).lathe(
        0,
        0,
        [
          [0.1, 0],
          [0.1, 0.06],
          [0.07, 0.1],
          [0.07, 0.5],
          [0.09, 0.53],
          [0.09, 0.58],
          [0.05, 0.68],
          [0.0, 0.72],
        ],
        c(4, 70, 42),
        8,
      );
      b.frame(0, 0.42, 0, [1, 0, 0], [0, 0, 1], [0, -1, 0])
        .column(0, 0, -0.14, 0.14, 0.04, 0.04, c(4, 70, 36), 6, 'both')
        .reset();
      break;
    case 'cabinet':
      // A telecom or power cabinet.
      b.extra(0.5, 0, 0, 0).box(-0.5, 0.08, -0.18, 0.5, 1.2, 0.18, c(90 + r(1) * 60, 8, 50));
      b.box(-0.54, 0, -0.2, 0.54, 0.08, 0.2, CONCRETE);
      b.box(-0.52, 1.2, -0.2, 0.52, 1.24, 0.2, c(120, 6, 40));
      b.box(-0.005, 0.12, 0.18, 0.005, 1.16, 0.185, c(0, 0, 20));
      break;
    case 'planter': {
      const stone = c(36, 8, 58);
      b.extra(0.85, 0, 0, 0).box(-0.6, 0, -0.6, 0.6, 0.55, 0.6, stone, 'y1');
      b.box(-0.66, 0.55, -0.66, 0.66, 0.6, 0.66, shade(stone, 1.1));
      b.extra(0.95, 0, 0, 0).box(-0.56, 0.5, -0.56, 0.56, 0.57, 0.56, c(28, 30, 16), 'y0');
      b.at(0, 0.5, 0).append(shrubAsset(seed).mesh);
      break;
    }
    case 'cafeTable':
      b.extra(0.45, 0, 0, 0).column(0, 0, 0, 0.03, 0.22, 0.2, IRON, 10, 'top');
      b.column(0, 0, 0.03, 0.7, 0.025, 0.025, IRON, 6, '');
      b.extra(0.35, 0, 0, 1).column(0, 0, 0.7, 0.73, 0.36, 0.36, [1, 1, 1], 14, 'both');
      break;
    case 'cafeChair': {
      b.extra(0.45, 0, 0, 0);
      for (const [x, z] of [
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ])
        b.tube(
          [
            [x * 1.1, 0, z * 1.1],
            [x, 0.45, z],
          ],
          0.011,
          c(210, 4, 62),
          4,
        );
      b.extra(0.6, 0, 0, 1).box(-0.2, 0.45, -0.2, 0.2, 0.47, 0.2, [1, 1, 1]);
      b.extra(0.45, 0, 0, 0).tube(
        [
          [-0.18, 0.45, -0.18],
          [-0.19, 0.85, -0.22],
          [0.19, 0.85, -0.22],
          [0.18, 0.45, -0.18],
        ],
        0.011,
        c(210, 4, 62),
        4,
        false,
      );
      b.extra(0.6, 0, 0, 1).box(-0.17, 0.62, -0.225, 0.17, 0.8, -0.21, [1, 1, 1]);
      break;
    }
    case 'umbrella': {
      // A café parasol: canvas over ribs, with a scalloped edge.
      b.extra(0.5, 0, 0, 0).column(0, 0, 0, 2.5, 0.022, 0.022, c(30, 20, 60), 6, 'top');
      b.column(0, 0, 0, 0.1, 0.2, 0.18, c(210, 5, 34), 8, 'top');
      const sides = 8,
        rad = 1.35;
      b.extra(0.9, 0, 0, 1);
      const first = b.vertexCount;
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2,
          ca = Math.cos(a),
          sa = Math.sin(a);
        b.vertex(ca * rad, 2.1, sa * rad, ca * 0.4, 0.9, sa * 0.4, [1, 1, 1]);
        b.vertex(0, 2.5, 0, ca * 0.4, 0.9, sa * 0.4, [1, 1, 1]);
        b.vertex(ca * rad, 1.96, sa * rad, ca, 0.1, sa, [0.86, 0.86, 0.86]);
      }
      for (let s = 0; s < sides; s++) {
        const k = first + s * 3;
        b.tri(k, k + 1, k + 3);
        b.tri(k + 2, k, k + 3);
        b.tri(k + 2, k + 3, k + 5);
      }
      break;
    }
    case 'kiosk': {
      // A news or flower kiosk: a small booth with a canopy and a lit hatch.
      const body = c(150 + r(1) * 60, 26, 26);
      b.extra(0.6, 0, 0, 0).box(-1.2, 0, -0.9, 1.2, 2.3, 0.9, body);
      b.box(-1.5, 2.3, -1.15, 1.5, 2.42, 1.4, shade(body, 0.7));
      b.extra(0.3, 1.5, 2, 0).box(-0.9, 1.0, 0.9, 0.9, 2.0, 0.91, c(44, 60, 78));
      b.extra(0.7, 0, 0, 0).box(-1.0, 0.92, 0.9, 1.0, 1.0, 1.15, WOOD);
      break;
    }
    default:
      return null;
  }
  return { mesh: b.finish() };
}

/** Body colours for placed cars, weighted toward the greys, whites and blacks seen on streets. */
export const CAR_PAINT = Object.freeze([
  [0, 0, 88, 5],
  [0, 0, 12, 5],
  [210, 5, 46, 4],
  [210, 6, 66, 4],
  [215, 40, 28, 2],
  [4, 66, 38, 2],
  [205, 30, 42, 1],
  [30, 20, 52, 1],
  [150, 24, 26, 1],
  [44, 70, 54, 0.5],
  [18, 60, 46, 0.5],
]);
/** Colours for bicycle frames. */
export const BIKE_PAINT = Object.freeze([
  [0, 0, 10, 4],
  [0, 0, 86, 2],
  [215, 50, 36, 2],
  [4, 66, 40, 2],
  [150, 36, 30, 1],
  [44, 70, 52, 1],
  [180, 40, 46, 1],
  [330, 40, 60, 0.5],
]);
/** Colours for hulls, parasols and café furniture. */
export const CLOTH_PAINT = Object.freeze([
  [6, 56, 42, 2],
  [150, 34, 30, 2],
  [215, 40, 36, 2],
  [42, 60, 62, 2],
  [30, 24, 84, 3],
  [0, 0, 92, 2],
  [200, 30, 50, 1],
]);

// ------------------------------------------------------------------------ ground cover

/** Small plants that carpet the ground near trees and in parks. */
export const coverKinds = Object.freeze(['grass', 'grassTall', 'flowers', 'fern', 'treePit']);
/**
 * One clump of ground cover, modelled within about half a metre of its root. Blades and
 * leaves are foliage (they sway in the wind) and carry tint 1, so each clump can shift its
 * green; blossoms keep their own colour.
 */
export function coverAsset(kind, seed = 1, bloom = [48, 90, 60]) {
  const b = builder();
  const r = (k) => randomAt(seed, 5001, k);
  const blade = (x, z, lean, turn, height, width, colour) => {
    // A blade is two quads bent toward its tip, dark at the root and bright at the tip.
    const dx = Math.cos(turn),
      dz = Math.sin(turn),
      nx = -dz,
      nz = dx;
    const p = (t, side) => [
      x + dx * lean * t * t + nx * width * side * (1 - t * 0.85),
      height * t,
      z + dz * lean * t * t + nz * width * side * (1 - t * 0.85),
    ];
    const tone = (t) => shade(colour, 0.5 + 0.7 * t);
    const first = b.vertexCount;
    for (const t of [0, 0.5, 1])
      for (const side of [-1, 1]) {
        const q = p(t, side);
        b.vertex(q[0], q[1], q[2], dx * 0.3, 0.9, dz * 0.3, tone(t));
      }
    b.tri(first, first + 1, first + 3);
    b.tri(first, first + 3, first + 2);
    b.tri(first + 2, first + 3, first + 5);
    b.tri(first + 2, first + 5, first + 4);
  };
  b.extra(0.9, 0, 5, 1);
  if (kind === 'grass' || kind === 'grassTall') {
    const tall = kind === 'grassTall';
    // A patch of lawn is many short, broad blades close together, so patches set side by side
    // read as turf. Tall grass is a looser tussock with a few slender seed heads.
    const count = tall ? 14 : 20;
    const green = c(92 + r(1) * 16, 42, tall ? 36 : 34);
    for (let i = 0; i < count; i++) {
      const a = r(10 + i) * Math.PI * 2,
        d = Math.sqrt(r(20 + i)) * (tall ? 0.2 : 0.36);
      // Some blades are yellower and drier than the rest.
      const dry = r(70 + i) < 0.18 ? c(62, 40, 44) : green;
      blade(
        Math.cos(a) * d,
        Math.sin(a) * d,
        (tall ? 0.2 : 0.09) * (0.4 + r(30 + i)),
        a + (r(40 + i) - 0.5) * 2,
        (tall ? 0.36 : 0.11) * (0.55 + r(50 + i) * 0.8),
        tall ? 0.014 : 0.024,
        shade(dry, 0.9 + r(60 + i) * 0.25),
      );
    }
    if (tall) {
      // Seed heads: thin stalks ending in a small, slim head, pale as dry straw.
      const heads = 1 + Math.floor(r(2) * 3);
      for (let i = 0; i < heads; i++) {
        const a = r(80 + i) * Math.PI * 2,
          d = r(84 + i) * 0.1,
          h = 0.4 + r(88 + i) * 0.16;
        const x = Math.cos(a) * d,
          z = Math.sin(a) * d;
        b.extra(0.9, 0, 5, 1);
        blade(x, z, 0.06, a, h, 0.004, c(70, 30, 44));
        b.extra(0.9, 0, 5, 0).blob(
          x + Math.cos(a) * 0.06,
          h + 0.02,
          z + Math.sin(a) * 0.06,
          0.007,
          0.032,
          0.007,
          c(46, 26, 58),
          1,
        );
      }
    }
  } else if (kind === 'flowers') {
    const green = c(104, 40, 30);
    const petal = c(bloom[0], bloom[1], bloom[2]);
    const stems = 5 + Math.floor(r(3) * 4);
    for (let i = 0; i < stems; i++) {
      const a = r(10 + i) * Math.PI * 2,
        d = Math.sqrt(r(20 + i)) * 0.2,
        h = 0.16 + r(30 + i) * 0.22;
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d,
        lx = (r(40 + i) - 0.5) * 0.1,
        lz = (r(50 + i) - 0.5) * 0.1;
      b.extra(0.9, 0, 5, 1);
      blade(x, z, 0.05, a, h, 0.006, green);
      blade(x, z, 0.1, a + 2, h * 0.5, 0.02, green);
      // The blossom: a ring of petals round a darker eye, cupped a little so it has a shape
      // from the side as well as from above.
      b.extra(0.8, 0, 5, 0);
      const cx = x + lx,
        cz = z + lz,
        size = 0.016 + r(60 + i) * 0.012,
        petals = 5 + Math.floor(r(64 + i) * 3);
      const tone = shade(petal, 0.85 + r(70 + i) * 0.3);
      const first = b.vertexCount;
      b.vertex(cx, h + 0.002, cz, 0, 1, 0, c(42, 80, 40));
      for (let k = 0; k <= petals * 2; k++) {
        const pa = (k / (petals * 2)) * Math.PI * 2,
          rad = size * (k % 2 ? 1 : 0.45);
        b.vertex(
          cx + Math.cos(pa) * rad,
          h + (k % 2 ? 0.008 : 0.003),
          cz + Math.sin(pa) * rad,
          Math.cos(pa) * 0.4,
          0.9,
          Math.sin(pa) * 0.4,
          tone,
        );
      }
      for (let k = 0; k < petals * 2; k++) b.tri(first, first + 2 + k, first + 1 + k);
    }
  } else if (kind === 'fern') {
    // Arching fronds from one crown, as on a woodland floor.
    const green = c(112 + r(1) * 12, 40, 28);
    const fronds = 6 + Math.floor(r(2) * 3);
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + r(10 + i),
        len = 0.35 + r(20 + i) * 0.25;
      const dx = Math.cos(a),
        dz = Math.sin(a);
      const first = b.vertexCount;
      for (let k = 0; k <= 3; k++) {
        const t = k / 3,
          w = 0.09 * Math.sin(Math.PI * (0.15 + t * 0.85)),
          y = 0.32 * Math.sin(t * Math.PI * 0.75);
        b.vertex(dx * len * t - dz * w, y, dz * len * t + dx * w, 0, 1, 0, shade(green, 0.6 + 0.6 * t));
        b.vertex(dx * len * t + dz * w, y, dz * len * t - dx * w, 0, 1, 0, shade(green, 0.6 + 0.6 * t));
      }
      for (let k = 0; k < 3; k++) {
        const q = first + k * 2;
        b.tri(q, q + 1, q + 3);
        b.tri(q, q + 3, q + 2);
      }
    }
  } else {
    // The square of open soil a street tree grows from, with a low edging.
    const soil = c(26, 24, 15);
    b.extra(0.95, 0, 0, 0);
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      pts.push([
        Math.cos(a) * (0.82 + 0.06 * Math.sin(k * 2.3)),
        0.012,
        -Math.sin(a) * (0.82 + 0.06 * Math.sin(k * 2.3)),
      ]);
    }
    b.poly(pts, soil, [0, 1, 0]);
  }
  return { mesh: b.finish() };
}
/** Blossom colours for flower clumps: [hue, saturation, lightness, weight]. */
export const BLOOMS = Object.freeze([
  [48, 92, 60, 3],
  [0, 0, 94, 3],
  [280, 46, 62, 2],
  [4, 78, 52, 1.5],
  [330, 60, 70, 1.5],
  [212, 62, 60, 1],
  [28, 90, 56, 1],
]);

// ------------------------------------------------------------------------------ people
// Figures, their clothes and their colours are built in people.js.
export { personAsset, COAT_PAINT } from './people.js';
