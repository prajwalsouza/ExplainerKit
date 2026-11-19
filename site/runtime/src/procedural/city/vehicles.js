import { assert, number, options } from '../../core/validate.js';
import { hsla } from '../../color/space.js';
import { meshBuilder, rgb } from './mesh.js';
import { randomAt } from '../../noise/vector.js';

// The vehicle family. Every road and rail vehicle is built by one generator from a shape: a
// handful of lengths that say how long, wide and tall it is, where its cabin sits and how its
// glass rakes. A new variant is a new shape, never new geometry code.
//
// Vehicles face +x and stand on the ground at y = 0. The paint is white with tint 1, so each
// placed vehicle takes its own colour. Wheels carry the surface kind 0.4 (it rounds to plain)
// with their axle position in the first two extra numbers, so a renderer can turn them. Head
// and tail lights carry kinds 3 and 4; a vehicle built with `running: true` gives them a glow,
// which a renderer switches on after dark and in rain, and a parked one gives them none.

/** Surface kinds this module adds to those in assets.js. */
export const vehicleSurfaceKinds = Object.freeze({ wheel: 0.4, headlight: 3, taillight: 4 });

const S = (shape) => Object.freeze(shape);
/**
 * The built-in shapes, in metres. `length` and `width` are overall; `hood` is the height of
 * the bonnet or front deck, `belt` the height where the glass starts and `roof` the top.
 * `cabin` is where the glass starts and ends along the vehicle (from its middle), `rake` how
 * far the rear and front glass lean in, `wheel` the wheel radius and `axles` where they sit.
 * `nose` and `tail` round the ends in plan (0 square, 1 very round). `tumble` leans the sides
 * in toward the roof. `doors` and `band` only apply to buses and trams.
 */
export const VEHICLE_SHAPES = S({
  hatch: S({
    family: 'car',
    length: 4.0,
    width: 1.74,
    hood: 0.8,
    belt: 0.94,
    roof: 1.47,
    cabin: [-1.72, 0.82],
    rake: [0.42, 0.78],
    wheel: 0.31,
    axles: [-1.24, 1.22],
    nose: 0.5,
    tail: 0.3,
    tumble: 0.16,
    clearance: 0.17,
  }),
  sedan: S({
    family: 'car',
    length: 4.62,
    width: 1.8,
    hood: 0.78,
    belt: 0.92,
    roof: 1.43,
    cabin: [-1.34, 0.82],
    rake: [0.82, 0.86],
    wheel: 0.32,
    axles: [-1.38, 1.4],
    nose: 0.5,
    tail: 0.42,
    tumble: 0.17,
    clearance: 0.16,
  }),
  estate: S({
    family: 'car',
    length: 4.72,
    width: 1.8,
    hood: 0.8,
    belt: 0.94,
    roof: 1.47,
    cabin: [-2.16, 0.86],
    rake: [0.36, 0.84],
    wheel: 0.32,
    axles: [-1.4, 1.42],
    nose: 0.5,
    tail: 0.28,
    tumble: 0.15,
    clearance: 0.16,
  }),
  suv: S({
    family: 'car',
    length: 4.62,
    width: 1.9,
    hood: 1.02,
    belt: 1.14,
    roof: 1.72,
    cabin: [-2.12, 0.78],
    rake: [0.38, 0.66],
    wheel: 0.37,
    axles: [-1.38, 1.38],
    nose: 0.34,
    tail: 0.24,
    tumble: 0.13,
    clearance: 0.22,
  }),
  van: S({
    family: 'car',
    length: 5.3,
    width: 1.98,
    hood: 1.06,
    belt: 1.22,
    roof: 2.12,
    cabin: [-2.58, 1.86],
    rake: [0.08, 0.6],
    wheel: 0.35,
    axles: [-1.62, 1.66],
    nose: 0.3,
    tail: 0.1,
    tumble: 0.07,
    clearance: 0.2,
    panel: 0.3,
  }),
  bus: S({
    family: 'bus',
    length: 12.0,
    width: 2.55,
    hood: 1.05,
    belt: 1.08,
    roof: 3.05,
    cabin: [-5.95, 5.95],
    rake: [0.06, 0.22],
    wheel: 0.48,
    axles: [-3.1, 3.4],
    nose: 0.18,
    tail: 0.1,
    tumble: 0.03,
    clearance: 0.3,
    doors: [3.9, 0.2, -3.6],
    band: 0.42,
  }),
  tram: S({
    family: 'tram',
    length: 9.2,
    width: 2.4,
    hood: 0.95,
    belt: 0.98,
    roof: 3.3,
    cabin: [-4.56, 4.56],
    rake: [0.04, 0.04],
    wheel: 0.3,
    axles: [-2.6, 2.6],
    nose: 0.1,
    tail: 0.1,
    tumble: 0.03,
    clearance: 0.28,
    doors: [2.4, -2.4],
    band: 0.5,
  }),
  // A minibus: a van stretched, with windows all along.
  minibus: S({
    family: 'bus',
    length: 6.4,
    width: 2.02,
    hood: 1.0,
    belt: 1.12,
    roof: 2.45,
    cabin: [-3.12, 2.2],
    rake: [0.1, 0.62],
    wheel: 0.36,
    axles: [-2.05, 1.95],
    nose: 0.32,
    tail: 0.12,
    tumble: 0.06,
    clearance: 0.2,
    doors: [0.9],
    band: 0,
  }),
  // A taxi is a saloon with a lit sign on the roof.
  taxi: S({
    family: 'car',
    length: 4.7,
    width: 1.82,
    hood: 0.78,
    belt: 0.92,
    roof: 1.44,
    cabin: [-1.36, 0.84],
    rake: [0.8, 0.86],
    wheel: 0.32,
    axles: [-1.4, 1.42],
    nose: 0.5,
    tail: 0.42,
    tumble: 0.17,
    clearance: 0.16,
    sign: true,
  }),
  // A pickup and a box truck are a cab with something behind it: `cargo` says what, `cab` how long the cab is.
  pickup: S({
    family: 'car',
    length: 5.3,
    width: 1.9,
    hood: 1.0,
    belt: 1.12,
    roof: 1.78,
    cabin: [-0.6, 0.5],
    rake: [0.1, 0.64],
    wheel: 0.38,
    axles: [-1.65, 1.6],
    nose: 0.32,
    tail: 0.1,
    tumble: 0.12,
    clearance: 0.24,
    cargo: 'bed',
    cab: 3.0,
  }),
  boxTruck: S({
    family: 'car',
    length: 7.2,
    width: 2.3,
    hood: 1.15,
    belt: 1.32,
    roof: 2.42,
    cabin: [-0.55, 0.42],
    rake: [0.04, 0.42],
    wheel: 0.46,
    axles: [-2.35, 2.45],
    nose: 0.2,
    tail: 0.05,
    tumble: 0.05,
    clearance: 0.32,
    cargo: 'box',
    cab: 2.3,
    box: 3.4,
  }),
  // A bicycle with its rider. `seat` is the saddle height and `lean` how far the rider leans forward.
  bicycle: S({ family: 'bicycle', length: 1.8, width: 0.6, wheel: 0.34, seat: 0.95, lean: 0.34, clearance: 0 }),
});
export const vehicleKinds = Object.freeze(Object.keys(VEHICLE_SHAPES));
/** Vehicles grouped by what they are for, so a scene can ask for a whole group. */
export const vehicleFamilies = Object.freeze({
  cars: Object.freeze(['hatch', 'sedan', 'estate', 'suv', 'taxi']),
  work: Object.freeze(['van', 'pickup', 'boxTruck']),
  transit: Object.freeze(['bus', 'minibus', 'tram']),
  cycles: Object.freeze(['bicycle']),
});
/** Eras of design: how square or rounded a body is, and how its glass rakes. */
export const vehicleEras = Object.freeze(['classic', 'modern', 'sleek']);

/**
 * A vehicle shape varied along several dimensions at once. `size` scales the vehicle (0.8 is a
 * small one of its kind, 1.25 a large one); `era` is 'classic' (square, upright glass, more of
 * it), 'modern' or 'sleek' (low, rounded, raked glass); `ride` raises or lowers the body on its
 * wheels in metres (-0.05 to 0.15). Returns a plain shape for vehicleAsset's `shape` option.
 */
export function vehicleShape(kind, spec = {}) {
  options(spec, ['size', 'era', 'ride'], 'vehicleShape');
  assert(Object.hasOwn(VEHICLE_SHAPES, kind), 'INVALID_CITY', `A vehicle kind is one of ${vehicleKinds.join(', ')}.`);
  const base = VEHICLE_SHAPES[kind];
  const size = number(spec.size ?? 1, 'vehicle size', 0.8, 1.25),
    ride = number(spec.ride ?? 0, 'vehicle ride', -0.05, 0.15),
    era = spec.era ?? 'modern';
  assert(vehicleEras.includes(era), 'INVALID_CITY', `era is one of ${vehicleEras.join(', ')}.`);
  if (base.family === 'bicycle') return { ...base };
  const long = size,
    wide = Math.sqrt(size),
    tall = size ** 0.35;
  const sh = {
    ...base,
    length: base.length * long,
    width: base.width * wide,
    hood: base.hood * tall,
    belt: base.belt * tall,
    roof: base.roof * tall,
    cabin: base.cabin.map((x) => x * long),
    axles: base.axles.map((x) => x * long),
    wheel: base.wheel * tall,
    clearance: base.clearance,
    ...(base.cab ? { cab: base.cab * long } : {}),
    ...(base.box ? { box: base.box * tall } : {}),
    ...(base.doors ? { doors: base.doors.map((x) => x * long) } : {}),
  };
  if (era === 'classic') {
    Object.assign(sh, {
      nose: base.nose * 0.3,
      tail: base.tail * 0.4,
      tumble: base.tumble * 0.35,
      rake: base.rake.map((r) => r * 0.55),
      belt: sh.belt - 0.04,
      roof: sh.roof + 0.04,
      wheel: sh.wheel * 0.93,
    });
  } else if (era === 'sleek') {
    Object.assign(sh, {
      nose: Math.min(1, base.nose * 1.5 + 0.1),
      tail: Math.min(1, base.tail * 1.4 + 0.1),
      tumble: base.tumble * 1.4,
      rake: base.rake.map((r) => r * 1.35),
      roof: sh.roof - 0.06 * tall,
      belt: sh.belt + 0.03,
      clearance: Math.max(0.1, base.clearance - 0.03),
      wheel: sh.wheel * 1.04,
    });
  }
  sh.clearance += ride;
  sh.wheel += ride * 0.35;
  sh.hood += ride;
  sh.belt += ride;
  sh.roof += ride;
  return sh;
}

const c = (h, s, l) => rgb(hsla(h, s, l));
const DARK = c(0, 0, 7),
  TRIM = c(210, 4, 14),
  GLASS = c(205, 24, 22),
  TYRE = c(0, 0, 8),
  ALLOY = c(210, 4, 64),
  LENS = c(48, 24, 92),
  RED = c(2, 82, 42),
  PLATE = c(48, 10, 90);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/**
 * Build one vehicle. `kind` names a built-in shape, and `shape` overrides any of its numbers.
 * `running` says whether its lights can be switched on. For trams, `end` is 'front', 'middle'
 * or 'rear', which shapes the ends of a section and adds a pantograph to the middle one.
 * Returns {mesh, shape}.
 */
export function vehicleAsset(kind = 'hatch', spec = {}) {
  options(spec, ['shape', 'look', 'running', 'end'], 'vehicleAsset');
  assert(Object.hasOwn(VEHICLE_SHAPES, kind), 'INVALID_CITY', `A vehicle kind is one of ${vehicleKinds.join(', ')}.`);
  const sh = { ...(spec.look ? vehicleShape(kind, spec.look) : VEHICLE_SHAPES[kind]), ...(spec.shape ?? {}) };
  if (sh.family === 'bicycle') return cyclist(sh);
  if (sh.cargo) return withCargo(kind, sh, spec.running === true);
  const big = sh.family !== 'car';
  const end = spec.end ?? (sh.family === 'tram' ? 'middle' : 'front');
  const b = meshBuilder(4);
  const L = sh.length / 2,
    W = sh.width / 2,
    floor = sh.clearance;
  const paint = [1, 1, 1];
  const [xa, xb] = sh.cabin,
    [rakeRear, rakeFront] = sh.rake;

  // ---- the body as a skin over stations along the vehicle. Each station is a cross-section
  // from one sill, up the side, over the top and down the other side.
  const stations = [];
  const add = (x) => stations.push(x);
  const N = big ? 22 : 18;
  for (let i = 0; i <= N; i++) add(-L + (2 * L * i) / N);
  // Extra stations where the glass starts and ends, so those edges are crisp.
  for (const x of [xa, xa + rakeRear, xb - rakeFront, xb]) if (x > -L + 0.02 && x < L - 0.02) add(x);
  // Door edges: the front of the front door, the pillar between the doors, the back of the rear door.
  const seams =
    sh.family === 'car'
      ? [xb - rakeFront + 0.2, (xa + rakeRear + xb - rakeFront) / 2 + 0.05, xa + rakeRear * 0.5 + 0.14]
      : [];
  for (const x of seams) {
    add(x - 0.011);
    add(x + 0.011);
  }
  stations.sort((p, q) => p - q);
  const xs = stations.filter((x, i) => i === 0 || x - stations[i - 1] > 0.015);
  // Width in plan: the nose and tail are rounded, more so on cars.
  const plan = (x) => {
    const front = (x - (L - 0.9 * (0.4 + sh.nose))) / (0.9 * (0.4 + sh.nose)),
      rear = (-L + 0.9 * (0.4 + sh.tail) - x) / (0.9 * (0.4 + sh.tail));
    const f = Math.max(0, front),
      r = Math.max(0, rear);
    return 1 - 0.34 * sh.nose * f * f - 0.3 * sh.tail * r * r;
  };
  // Height of the lower body (bonnet, deck) and how much cabin stands above it.
  const deck = (x) => {
    if (big) return sh.belt;
    if (x > xb)
      return (
        lerp(sh.belt, sh.hood - 0.1 * smooth((x - xb) / (L - xb)), smooth((x - xb) / 0.3)) -
        0.2 * smooth((x - (L - 0.45)) / 0.45) ** 2
      );
    if (x < xa)
      return sh.belt - 0.08 * smooth((xa - x) / Math.max(0.2, xa + L)) - 0.14 * smooth((-L + 0.3 - x) / 0.3) ** 2;
    return sh.belt;
  };
  const cabin = (x) => {
    if (x <= xa || x >= xb) return 0;
    return Math.min(smooth((x - xa) / Math.max(0.05, rakeRear)), smooth((xb - x) / Math.max(0.05, rakeFront)));
  };
  // One side of a cross-section: [height, half-width, part] from the sill to the roof centre.
  // Parts: 0 sill, 1 body side, 2 shoulder, 3 glass, 4 roof.
  const section = (x) => {
    const w = W * plan(x),
      d = deck(x),
      k = cabin(x),
      top = lerp(d, sh.roof, k),
      lean = sh.tumble * k;
    // The side bulges gently and rolls into the shoulder, as pressed steel does.
    const pts = [
      [floor, w * 0.9, 0],
      [floor + 0.06, w * 0.955, 1],
      [lerp(floor, d, 0.28), w * 0.992, 1],
      [lerp(floor, d, 0.55), w, 1],
      [lerp(floor, d, 0.8), w * 0.992, 1],
      [d - 0.07, w * 0.972, 1],
      [d - 0.02, w * 0.945, 2],
      [d, w * 0.915, 2],
    ];
    if (k > 0.01) {
      pts.push([lerp(d, top, 0.1), w * (0.915 - lean * 0.14), 3]);
      pts.push([lerp(d, top, 0.5), w * (0.915 - lean * 0.6), 3]);
      pts.push([lerp(d, top, 0.84), w * (0.915 - lean * 1.0), 3]);
      pts.push([top - 0.07, w * (0.9 - lean * 1.2), 4]);
      pts.push([top - 0.02, w * (0.85 - lean * 1.3), 4]);
      pts.push([top, w * (0.74 - lean * 1.3), 4]);
      pts.push([top + 0.012, w * (0.4 - lean * 0.6), 4]);
    } else {
      pts.push(
        [d + 0.001, w * 0.905, 2],
        [d + 0.002, w * 0.9, 2],
        [d + 0.003, w * 0.89, 2],
        [d + 0.006, w * 0.86, 2],
        [d + 0.012, w * 0.78, 2],
        [d + 0.02, w * 0.62, 2],
        [d + 0.026, w * 0.36, 2],
      );
    }
    pts.push([top + (k > 0.01 ? 0.02 : 0.03), 0, k > 0.01 ? 4 : 2]);
    return pts;
  };
  const rows = xs.map((x) => {
    const half = section(x);
    // Right side bottom to top, then left side top to bottom.
    const ring = half.map(([y, w, part]) => ({ p: [x, y, w], part }));
    for (let i = half.length - 2; i >= 0; i--) ring.push({ p: [x, half[i][0], -half[i][1]], part: half[i][2] });
    return ring;
  });
  const M = rows[0].length;
  // Smooth normals from neighbouring points of the skin.
  const normalAt = (i, j) => {
    const a = rows[Math.max(0, i - 1)][j].p,
      d = rows[Math.min(rows.length - 1, i + 1)][j].p,
      e = rows[i][Math.max(0, j - 1)].p,
      f = rows[i][Math.min(M - 1, j + 1)].p;
    const u = [d[0] - a[0], d[1] - a[1], d[2] - a[2]],
      v = [f[0] - e[0], f[1] - e[1], f[2] - e[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  // What each patch of skin is: paint, glass, pillar, door or coloured band.
  const pillars = big ? [] : [xa + rakeRear + 0.02, (xa + rakeRear + xb - rakeFront) / 2 + 0.05, xb - rakeFront - 0.02];
  const windowPosts = big ? Math.max(3, Math.round((xb - xa) / 1.55)) : 0;
  const material = (x0, x1, partLow, partHigh, side) => {
    const xm = (x0 + x1) / 2;
    const glass = partLow === 3 || (partLow === 2 && partHigh === 3);
    if (glass) {
      const raked = xm < xa + rakeRear || xm > xb - rakeFront;
      if (!raked) {
        if (pillars.some((p) => Math.abs(xm - p) < 0.07)) return 'paint';
        if (sh.panel && xm < xb - rakeFront - 1.5) return 'paint';
        if (big) {
          // Posts between the windows of a bus or tram, and doors.
          const t = ((xm - xa) / (xb - xa)) * windowPosts;
          if (Math.abs(t - Math.round(t)) < 0.04 * windowPosts * (0.16 / (xb - xa)) * 9) return 'trim';
          if (side > 0 && sh.doors?.some((dx) => Math.abs(xm - dx) < 0.62)) return 'door';
        }
      }
      return 'glass';
    }
    if (big && sh.band && partLow === 1 && side !== 0) return 'band';
    if (!big && side !== 0) {
      // Shut lines between doors, a dark sill, and the rubber that frames the glass.
      if (partLow === 1 && seams.some((p) => Math.abs(xm - p) < 0.012)) return 'seam';
      if (partLow === 0) return 'trim';
      if (partLow === 2 && partHigh === 2 && cabin(xm) > 0.6) return 'trim';
    }
    return 'paint';
  };
  const looks = {
    paint: { colour: paint, extra: [0.26, 0, 0, 1] },
    glass: { colour: GLASS, extra: [0.05, 0, 6, 0] },
    trim: { colour: TRIM, extra: [0.5, 0, 0, 0] },
    seam: { colour: DARK, extra: [0.7, 0, 0, 0] },
    door: { colour: c(205, 20, 16), extra: [0.08, 0, 6, 0] },
    band: { colour: [0.82, 0.82, 0.82], extra: [0.3, 0, 0, 1] },
  };
  for (let i = 0; i + 1 < rows.length; i++)
    for (let j = 0; j + 1 < M; j++) {
      const a = rows[i][j],
        d = rows[i + 1][j],
        e = rows[i + 1][j + 1],
        f = rows[i][j + 1];
      const side = j < M / 2 - 1 ? 1 : j > M / 2 ? -1 : 0;
      const low = Math.min(a.part, f.part),
        high = Math.max(a.part, f.part);
      const look = looks[material(xs[i], xs[i + 1], low, high, side)];
      b.extra(...look.extra);
      const first = b.vertexCount;
      for (const [q, ii, jj] of [
        [a, i, j],
        [d, i + 1, j],
        [e, i + 1, j + 1],
        [f, i, j + 1],
      ]) {
        const n = normalAt(ii, jj);
        b.vertex(q.p[0], q.p[1], q.p[2], n[0], n[1], n[2], look.colour);
      }
      b.tri(first, first + 1, first + 2);
      b.tri(first, first + 2, first + 3);
    }
  // Close the ends and the underside.
  for (const [row, dir] of [
    [rows[0], -1],
    [rows[rows.length - 1], 1],
  ]) {
    b.extra(0.26, 0, 0, 1);
    const pts = row.map((q) => q.p);
    b.poly(dir > 0 ? pts : pts.slice().reverse(), paint, [dir, 0, 0]);
  }
  b.extra(0.9, 0, 0, 0).quad(
    [-L, floor, -W * 0.86],
    [L, floor, -W * 0.86],
    [L, floor, W * 0.86],
    [-L, floor, W * 0.86],
    DARK,
    [0, -1, 0],
  );

  // ---- wheels, set into dark arches. A wheel's vertices carry its axle, so it can turn.
  const tyreWidth = big ? 0.3 : 0.21;
  for (const ax of sh.axles)
    for (const side of [1, -1]) {
      const z = side * (W - tyreWidth / 2 - 0.02);
      // The arch: a dark half-disc on the body side, a little larger than the wheel.
      b.reset().extra(0.9, 0, 0, 0);
      const arch = [];
      const R = sh.wheel + 0.07;
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI * (k / 12);
        arch.push([ax + Math.cos(a) * R, Math.max(floor, sh.wheel + Math.sin(a) * R), side * (W * plan(ax) + 0.004)]);
      }
      if (sh.family !== 'tram') b.poly(side > 0 ? arch : arch.slice().reverse(), DARK, [0, 0, side]);
      if (sh.family === 'tram') continue;
      b.frame(ax, sh.wheel, z, [1, 0, 0], [0, 0, side], [0, -side, 0]);
      b.extra(ax, sh.wheel, 0.4, 0);
      b.column(0, 0, -tyreWidth / 2, tyreWidth / 2, sh.wheel, sh.wheel, TYRE, 16, 'both');
      b.column(0, 0, tyreWidth / 2, tyreWidth / 2 + 0.012, sh.wheel * 0.62, sh.wheel * 0.58, ALLOY, 12, 'top');
      // Five dark openings in the rim, so the turning shows.
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        b.column(
          Math.cos(a) * sh.wheel * 0.36,
          Math.sin(a) * sh.wheel * 0.36,
          tyreWidth / 2 + 0.012,
          tyreWidth / 2 + 0.016,
          sh.wheel * 0.13,
          sh.wheel * 0.13,
          TRIM,
          6,
          'top',
        );
      }
      b.column(0, 0, tyreWidth / 2 + 0.012, tyreWidth / 2 + 0.03, sh.wheel * 0.14, sh.wheel * 0.1, ALLOY, 8, 'top');
      b.reset();
    }
  if (sh.family === 'tram') {
    // Bogies: dark boxes under the floor, with the wheels hidden inside.
    b.reset().extra(0.8, 0, 0, 0);
    for (const ax of sh.axles) b.box(ax - 1.1, 0.04, -W * 0.72, ax + 1.1, floor + 0.02, W * 0.72, TRIM);
  }

  // ---- lights, plates, bumpers, mirrors
  const running = spec.running === true;
  const frontW = W * plan(L - 0.05),
    rearW = W * plan(-L + 0.05);
  const noseY = deck(L - 0.02),
    tailY = deck(-L + 0.02);
  const headKind = 3,
    tailKind = 4;
  b.reset();
  const lamps = (x, dir, y, w, lightKind, colour, glow) => {
    for (const side of [1, -1]) {
      b.extra(0.15, glow, lightKind, 0);
      const z0 = side * w * 0.52,
        z1 = side * w * 0.9;
      const pts = [
        [x + dir * 0.012, y - 0.07, Math.min(z0, z1)],
        [x + dir * 0.012, y - 0.07, Math.max(z0, z1)],
        [x + dir * 0.012, y + 0.05, Math.max(z0, z1)],
        [x + dir * 0.012, y + 0.05, Math.min(z0, z1)],
      ];
      b.poly(dir > 0 ? pts : pts.reverse(), colour, [dir, 0, 0]);
    }
  };
  const hasFront = sh.family !== 'tram' || end === 'front',
    hasRear = sh.family !== 'tram' || end === 'rear';
  if (hasFront) {
    lamps(L, 1, big ? 0.72 : noseY - 0.2, frontW, headKind, LENS, running ? 2.4 : 0);
    b.extra(0.6, 0, 0, 0).box(L - 0.02, floor + 0.02, -frontW * 0.94, L + 0.035, floor + 0.2, frontW * 0.94, TRIM);
    b.extra(0.5, 0, 0, 0).box(
      L - 0.01,
      big ? 0.6 : noseY - 0.44,
      -frontW * 0.46,
      L + 0.02,
      big ? 0.82 : noseY - 0.28,
      frontW * 0.46,
      DARK,
    );
    b.extra(0.5, 0, 0, 0).quad(
      [L + 0.04, floor + 0.2, -0.26],
      [L + 0.04, floor + 0.2, 0.26],
      [L + 0.04, floor + 0.31, 0.26],
      [L + 0.04, floor + 0.31, -0.26],
      PLATE,
      [1, 0, 0],
    );
  }
  if (hasRear) {
    lamps(-L, -1, big ? 0.9 : tailY - 0.14, rearW, tailKind, RED, running ? 1.7 : 0);
    b.extra(0.6, 0, 0, 0).box(-L - 0.035, floor + 0.02, -rearW * 0.94, -L + 0.02, floor + 0.2, rearW * 0.94, TRIM);
    b.extra(0.5, 0, 0, 0).quad(
      [-L - 0.04, floor + 0.24, 0.26],
      [-L - 0.04, floor + 0.24, -0.26],
      [-L - 0.04, floor + 0.35, -0.26],
      [-L - 0.04, floor + 0.35, 0.26],
      PLATE,
      [-1, 0, 0],
    );
  }
  if (sh.family === 'car') {
    for (const side of [1, -1]) {
      b.extra(0.26, 0, 0, 1).box(
        xb - rakeFront * 0.5 - 0.1,
        sh.belt + 0.02,
        side * (W * 0.96) - 0.06,
        xb - rakeFront * 0.5 + 0.02,
        sh.belt + 0.13,
        side * (W * 0.96 + 0.11) + 0.06,
        paint,
      );
      // Door handles and the line of the sill, small things that make a side read as doors.
      b.extra(0.4, 0, 0, 0).box(
        (xa + xb) / 2 - 0.5,
        sh.belt - 0.14,
        side * (W + 0.004) - 0.004,
        (xa + xb) / 2 - 0.36,
        sh.belt - 0.11,
        side * (W + 0.004) + 0.004,
        TRIM,
      );
    }
  } else if (sh.family === 'bus') {
    // The destination display above the windscreen glows like a shop sign.
    b.extra(0.4, 1.3, 2, 0).quad(
      [L + 0.01, sh.roof - 0.36, -0.9],
      [L + 0.01, sh.roof - 0.36, 0.9],
      [L + 0.01, sh.roof - 0.12, 0.9],
      [L + 0.01, sh.roof - 0.12, -0.9],
      c(40, 90, 56),
      [1, 0, 0],
    );
    for (const side of [1, -1])
      b.extra(0.4, 0, 0, 0).box(
        L - 0.35,
        sh.belt + 0.6,
        side * (W + 0.02),
        L - 0.2,
        sh.belt + 0.95,
        side * (W + 0.3),
        TRIM,
      );
    // Roof plant: the air-conditioning pod.
    b.extra(0.5, 0, 0, 0).box(-2.2, sh.roof, -0.8, 1.6, sh.roof + 0.18, 0.8, c(210, 4, 78));
  } else if (end === 'middle') {
    // The pantograph: a folded arm reaching up to the wire.
    b.extra(0.5, 0, 0, 0);
    b.box(-0.9, sh.roof, -0.5, 0.9, sh.roof + 0.1, 0.5, TRIM);
    b.tube(
      [
        [-0.6, sh.roof + 0.1, 0],
        [0.3, sh.roof + 0.75, 0],
        [-0.3, sh.roof + 1.45, 0],
      ],
      0.03,
      TRIM,
      5,
    );
    b.tube(
      [
        [-0.3, sh.roof + 1.45, -0.75],
        [-0.3, sh.roof + 1.45, 0.75],
      ],
      0.03,
      TRIM,
      5,
    );
  }
  if (sh.sign) {
    // The taxi sign: a small lit box on the roof, glowing like a shop sign.
    const top = sh.roof + 0.012,
      mid = (xa + rakeRear + xb - rakeFront) / 2;
    b.reset()
      .extra(0.4, 1.6, 2, 0)
      .box(mid - 0.3, top, -0.13, mid + 0.3, top + 0.16, 0.13, c(48, 90, 62));
    b.extra(0.5, 0, 0, 0).box(mid - 0.33, top - 0.01, -0.15, mid + 0.33, top + 0.012, 0.15, DARK);
  }
  return { mesh: b.finish(), shape: Object.freeze(sh) };
}

// A bicycle and the person riding it, as one model. The coat carries tint 1, so each rider
// takes a colour of their own; the wheels carry their axles, so they turn.
function cyclist(sh) {
  const b = meshBuilder(4);
  const r = sh.wheel,
    base = 1.08,
    rear = -base / 2,
    front = base / 2;
  const metal = c(210, 6, 22),
    skin = c(26, 42, 62),
    legs = c(215, 24, 20),
    shoe = c(20, 12, 12);
  // Wheels: a tyre ring and spokes, turning about the hub.
  for (const x of [rear, front]) {
    b.extra(x, r, 0.4, 0);
    const ring = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ring.push([x + Math.cos(a) * r, r + Math.sin(a) * r, 0]);
    }
    b.tube(ring, 0.02, TYRE, 4, false);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      b.tube(
        [
          [x - Math.cos(a) * r, r - Math.sin(a) * r, 0],
          [x + Math.cos(a) * r, r + Math.sin(a) * r, 0],
        ],
        0.004,
        ALLOY,
        3,
        false,
      );
    }
  }
  // Frame, fork, bars and saddle.
  const crank = [-0.06, 0.3, 0],
    seat = [-0.24, sh.seat, 0],
    head = [0.34, 0.92, 0],
    bars = [0.4, 1.06, 0];
  b.extra(0.4, 0, 0, 0);
  b.tube([crank, seat], 0.018, metal, 5);
  b.tube([seat, head], 0.017, metal, 5);
  b.tube([crank, [0.32, 0.78, 0]], 0.02, metal, 5);
  b.tube([[rear, r, 0], crank], 0.012, metal, 4);
  b.tube([[rear, r, 0], seat], 0.012, metal, 4);
  b.tube([head, [0.4, 0.62, 0], [front, r, 0]], 0.016, metal, 5);
  b.tube([head, bars], 0.014, ALLOY, 4);
  b.tube([[bars[0], bars[1], -0.25], bars, [bars[0], bars[1], 0.25]], 0.013, TRIM, 4);
  b.box(seat[0] - 0.12, sh.seat, -0.07, seat[0] + 0.12, sh.seat + 0.04, 0.07, TRIM);
  // The rider. Hips on the saddle, back leaning to the bars, one leg down and one coming up.
  const hip = [seat[0] + 0.02, sh.seat + 0.1, 0],
    lean = sh.lean,
    shoulder = [hip[0] + lean + 0.1, hip[1] + 0.5, 0],
    neck = [shoulder[0] + 0.05, shoulder[1] + 0.08, 0];
  b.extra(0.8, 0, 0, 1);
  // Torso and arms are one coat: the arms leave the shoulders and reach the grips.
  b.tube([hip, [hip[0] + lean * 0.45 + 0.03, hip[1] + 0.26, 0], shoulder], [0.15, 0.155, 0.14], [1, 1, 1], 8, true);
  for (const side of [1, -1]) {
    const sh0 = [shoulder[0] - 0.02, shoulder[1] - 0.03, side * 0.17];
    b.tube(
      [sh0, [sh0[0] + 0.14, sh0[1] - 0.2, side * 0.2], [bars[0] - 0.04, bars[1] + 0.05, side * 0.23]],
      [0.055, 0.045, 0.036],
      [1, 1, 1],
      6,
      false,
    );
    b.extra(0.8, 0, 0, 0).blob(bars[0] - 0.01, bars[1] + 0.04, side * 0.23, 0.04, 0.035, 0.04, skin, 0);
    b.extra(0.8, 0, 0, 1);
  }
  b.extra(0.8, 0, 0, 0);
  b.tube([shoulder, neck], 0.05, skin, 6, false);
  b.blob(neck[0] + 0.04, neck[1] + 0.13, 0, 0.1, 0.12, 0.095, skin, 1);
  // A helmet or hair cap, tilted with the head.
  b.blob(neck[0] + 0.02, neck[1] + 0.2, 0, 0.11, 0.085, 0.105, c(20, 20, 16), 1);
  // Legs: thigh from the hip to the knee, shin from the knee to the pedal, feet on the pedals.
  const pedals = [
    [crank[0] + 0.02, crank[1] - 0.17, 0.1],
    [crank[0] + 0.1, crank[1] + 0.15, -0.1],
  ];
  pedals.forEach((pedal) => {
    const up = pedal[1] > crank[1];
    const knee = [hip[0] + (up ? 0.36 : 0.3), up ? hip[1] - 0.06 : hip[1] - 0.3, pedal[2] * 1.1];
    b.tube([[hip[0], hip[1] - 0.04, pedal[2] * 0.9], knee], [0.085, 0.065], legs, 6, false);
    b.tube([knee, [pedal[0] - 0.02, pedal[1] + 0.08, pedal[2]]], [0.06, 0.045], legs, 6, false);
    b.box(pedal[0] - 0.1, pedal[1], pedal[2] - 0.045, pedal[0] + 0.16, pedal[1] + 0.075, pedal[2] + 0.045, shoe);
    b.tube([crank, [pedal[0], pedal[1], pedal[2] * 0.6]], 0.012, ALLOY, 4, false);
  });
  return { mesh: b.finish(), shape: Object.freeze(sh) };
}

// A wheel on its own: a tyre, a rim with openings and a hub, turning about its axle.
function wheelAt(b, ax, radius, z, side, tyreWidth) {
  b.frame(ax, radius, z, [1, 0, 0], [0, 0, side], [0, -side, 0]);
  b.extra(ax, radius, 0.4, 0);
  b.column(0, 0, -tyreWidth / 2, tyreWidth / 2, radius, radius, TYRE, 16, 'both');
  b.column(0, 0, tyreWidth / 2, tyreWidth / 2 + 0.012, radius * 0.62, radius * 0.58, ALLOY, 12, 'top');
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    b.column(
      Math.cos(a) * radius * 0.36,
      Math.sin(a) * radius * 0.36,
      tyreWidth / 2 + 0.012,
      tyreWidth / 2 + 0.016,
      radius * 0.13,
      radius * 0.13,
      TRIM,
      6,
      'top',
    );
  }
  b.column(0, 0, tyreWidth / 2 + 0.012, tyreWidth / 2 + 0.03, radius * 0.14, radius * 0.1, ALLOY, 8, 'top');
  b.reset();
}

// A cab with something behind it. The cab is an ordinary short body built by vehicleAsset with
// only its front axle; the bed or box, the chassis under it and the rear axle are added here.
function withCargo(kind, sh, running) {
  const L = sh.length / 2,
    W = sh.width / 2,
    cabLen = Math.min(sh.cab, sh.length * 0.7);
  const cabMid = L - cabLen / 2,
    frontAxle = sh.axles[sh.axles.length - 1],
    rearAxle = sh.axles[0];
  const cab = vehicleAsset(kind, {
    running,
    shape: {
      cargo: null,
      length: cabLen,
      cabin: [
        -cabLen / 2 + 0.12 + (sh.cabin[0] - sh.cabin[0]),
        Math.min(cabLen / 2 - 0.5, cabLen / 2 - 0.9 + sh.rake[1]),
      ],
      axles: [frontAxle - cabMid],
      tail: 0.02,
    },
  });
  const b = meshBuilder(4);
  b.append(cab.mesh);
  // The cab was built round its own middle; move every vertex forward to where it belongs.
  const moved = b.finish();
  for (let i = 0; i < moved.vertexCount; i++) {
    moved.positions[i * 3] += cabMid;
    // Wheels keep their axle in the first extra number; it moves with them.
    if (Math.abs(moved.extra[i * 4 + 2] - 0.4) < 1e-6) moved.extra[i * 4] += cabMid;
  }
  const out = meshBuilder(4);
  out.append(moved);
  const back = -L,
    front = L - cabLen - 0.06,
    floor = sh.clearance + sh.wheel * 0.9;
  const paint = [1, 1, 1];
  // The chassis rails under the load, with the rear wheels under them.
  out.extra(0.8, 0, 0, 0).box(back + 0.1, sh.clearance, -W * 0.42, front + 0.2, floor, W * 0.42, DARK);
  const tyreWidth = sh.cargo === 'box' ? 0.3 : 0.24;
  for (const side of [1, -1]) {
    const z = side * (W - tyreWidth / 2 - 0.02);
    wheelAt(out, rearAxle, sh.wheel, z, side, tyreWidth);
    if (sh.cargo === 'box') wheelAt(out, rearAxle, sh.wheel, z - side * (tyreWidth + 0.02), side, tyreWidth);
  }
  if (sh.cargo === 'bed') {
    // An open bed: a floor and four low painted walls, with a dark lining.
    const top = floor + 0.5;
    out.extra(0.85, 0, 0, 0).box(back, floor, -W, front, floor + 0.04, W, TRIM);
    out.extra(0.3, 0, 0, 1);
    out.box(back, floor, -W, front, top, -W + 0.05, paint);
    out.box(back, floor, W - 0.05, front, top, W, paint);
    out.box(back, floor, -W, back + 0.06, top, W, paint);
    out.box(front - 0.05, floor, -W, front, top, W, paint);
    // Wheel arches cut into the bed sides, and the tail lights.
    out.extra(0.15, 0, 4, 0);
    for (const side of [1, -1])
      out.box(back - 0.012, top - 0.3, side * (W - 0.24) - 0.1, back, top - 0.08, side * (W - 0.24) + 0.1, RED);
  } else {
    // A box body, taller than the cab, with a roll-up door at the back and ribs along its sides.
    const top = sh.box;
    out.extra(0.4, 0, 0, 1).box(back, floor, -W, front, top, W, paint);
    out.extra(0.5, 0, 0, 0);
    const ribs = Math.max(2, Math.round((front - back) / 0.9));
    for (let k = 1; k < ribs; k++) {
      const x = back + ((front - back) * k) / ribs;
      for (const side of [1, -1])
        out.box(x - 0.02, floor + 0.05, side * W - 0.012, x + 0.02, top - 0.05, side * W + 0.012, c(210, 4, 70));
    }
    for (let k = 0; k < 8; k++) {
      const y = floor + ((top - floor) * (k + 0.5)) / 8;
      out.box(back - 0.012, y - 0.008, -W * 0.92, back, y + 0.008, W * 0.92, c(210, 4, 60));
    }
    out.extra(0.15, 0, 4, 0);
    for (const side of [1, -1])
      out.box(back - 0.014, floor + 0.08, side * (W - 0.18) - 0.1, back, floor + 0.3, side * (W - 0.18) + 0.1, RED);
  }
  // A bumper at the back.
  out.extra(0.6, 0, 0, 0).box(back - 0.05, sh.clearance, -W * 0.9, back + 0.04, sh.clearance + 0.16, W * 0.9, TRIM);
  return { mesh: out.finish(), shape: Object.freeze(sh) };
}

/** How likely each era is in a regional style: [classic, modern, sleek]. */
const STYLE_ERAS = Object.freeze({
  american: [3, 5, 2],
  mediterranean: [3, 6, 1],
  british: [1.5, 6, 2],
  modern: [0.3, 5, 4],
  nordic: [1, 6, 2.5],
});
/** Looks drawn for each vehicle type, so a street has variety without a model per car. */
export const VEHICLE_VARIANTS = 3;
/**
 * The look of variant `variant` of a vehicle type in a place: an era chosen by the regional
 * style, a size and a ride height. The same type, variant, seed and style always give the
 * same look, which is what lets every car sharing that look share one model.
 */
export function vehicleLook(kind, variant, seed = 1, style = null) {
  const shape = VEHICLE_SHAPES[kind];
  if (!shape || shape.family === 'bicycle' || shape.family === 'tram') return {};
  const r = (k) => randomAt(seed, 7300 + variant * 13 + kind.length, k);
  const weights = STYLE_ERAS[style] ?? [1.2, 6, 2];
  let pick = r(1) * (weights[0] + weights[1] + weights[2]),
    era = 'modern';
  if ((pick -= weights[0]) < 0) era = 'classic';
  else if (pick - weights[1] > 0) era = 'sleek';
  const transit = shape.family === 'bus';
  return {
    era: transit ? 'modern' : era,
    size: transit ? 1 : 0.88 + 0.26 * r(2),
    ride: transit ? 0 : (r(3) - 0.35) * 0.06,
  };
}
