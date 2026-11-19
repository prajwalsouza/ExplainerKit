import { assert, number, options } from '../core/validate.js';
import { seedValue } from '../noise/vector.js';
import { gradientRaw2 } from '../noise/gradient.js';

// Live physical feel for interactive pages. These are explicit-step simulations: the page
// supplies dt and inputs, there are no clocks, DOM or renderers, and work per step is capped.
// Each simulation offers snapshot() and restore() so recorded inputs replay exactly.

const MAX_DT = 1 / 20;
const stepDt = (dt) => Math.min(number(dt, 'dt', 0, 10), MAX_DT);
const vec = (v, name) => {
  options(v, ['x', 'y'], name);
  return { x: number(v.x ?? 0, `${name} x`), y: number(v.y ?? 0, `${name} y`) };
};
const copy = (a) => Float64Array.from(a);

/**
 * A Verlet rope or rod: a stem, a stalk, a cable, a tail. `points` is its rest shape. Pinned
 * points never move unless you move them with pin(). `stiffness` is the spring pulling every point
 * toward its rest shape, in acceleration per unit of offset (0 is a loose rope), `bend` resists folding, `drag` couples it to the wind.
 */
export function softChain(spec = {}) {
  options(
    spec,
    ['points', 'pinned', 'stiffness', 'bend', 'drag', 'gravity', 'damping', 'iterations', 'mass'],
    'softChain',
  );
  const rest = spec.points;
  assert(
    Array.isArray(rest) && rest.length >= 2 && rest.length <= 512,
    'INVALID_CHAIN',
    'A chain needs between 2 and 512 points.',
  );
  const n = rest.length;
  const rx = new Float64Array(n),
    ry = new Float64Array(n);
  rest.forEach((p, i) => {
    const q = vec(p, 'chain point');
    rx[i] = q.x;
    ry[i] = q.y;
  });
  const pinned = new Uint8Array(n);
  for (const i of spec.pinned ?? [0]) {
    assert(Number.isInteger(i) && i >= 0 && i < n, 'INVALID_CHAIN', `Pinned index ${i} is not a point of the chain.`);
    pinned[i] = 1;
  }
  const stiffness = number(spec.stiffness ?? 20, 'chain stiffness', 0, 1e5);
  const bend = number(spec.bend ?? 0.3, 'chain bend', 0, 1);
  const drag = number(spec.drag ?? 1.5, 'chain drag', 0, 200);
  const gravity = vec(spec.gravity ?? { x: 0, y: 0 }, 'chain gravity');
  const damping = number(spec.damping ?? 0.99, 'chain damping', 0, 1);
  const iterations = number(spec.iterations ?? 6, 'chain iterations', 1, 40);
  assert(Number.isInteger(iterations), 'INVALID_CHAIN', 'Iterations must be a whole number.');
  const mass = (spec.mass ?? []).slice();
  assert(
    Array.isArray(mass) && mass.length <= n,
    'INVALID_CHAIN',
    'mass is a list of point masses, one per point at most.',
  );
  const w = new Float64Array(n).fill(1);
  mass.forEach((m, i) => (w[i] = 1 / number(m, 'point mass', 1e-3, 1e3)));
  for (let i = 0; i < n; i++) if (pinned[i]) w[i] = 0;
  const len = new Float64Array(n - 1),
    len2 = new Float64Array(Math.max(0, n - 2));
  for (let i = 0; i < n - 1; i++) len[i] = Math.hypot(rx[i + 1] - rx[i], ry[i + 1] - ry[i]);
  for (let i = 0; i < n - 2; i++) len2[i] = Math.hypot(rx[i + 2] - rx[i], ry[i + 2] - ry[i]);
  let x = copy(rx),
    y = copy(ry),
    ox = copy(rx),
    oy = copy(ry);
  // Rest shape relative to the first pinned point, so moving the pin carries the rest pose.
  const anchor = Math.max(0, pinned.indexOf(1));
  const offX = Float64Array.from(rx, (v) => v - rx[anchor]),
    offY = Float64Array.from(ry, (v) => v - ry[anchor]);
  let tension = 0;
  const link = (a, b, length, k) => {
    const dx = x[b] - x[a],
      dy = y[b] - y[a],
      d = Math.hypot(dx, dy) || 1e-9,
      sum = w[a] + w[b];
    if (!sum) return 0;
    const c = ((d - length) / d / sum) * k;
    x[a] += dx * c * w[a];
    y[a] += dy * c * w[a];
    x[b] -= dx * c * w[b];
    y[b] -= dy * c * w[b];
    return (d - length) / (length || 1);
  };
  const chain = {
    get count() {
      return n;
    },
    /** Point i as {x, y}. */
    point(i) {
      assert(Number.isInteger(i) && i >= 0 && i < n, 'INVALID_CHAIN', 'No such point.');
      return { x: x[i], y: y[i] };
    },
    points() {
      return Array.from({ length: n }, (_, i) => ({ x: x[i], y: y[i] }));
    },
    /** Velocity of point i in units per second, from the last step of length dt. */
    velocity(i, dt) {
      const d = Math.max(stepDt(dt), 1e-6);
      return { x: (x[i] - ox[i]) / d, y: (y[i] - oy[i]) / d };
    },
    /** How stretched the chain is, as the largest relative link error after the last step. */
    get tension() {
      return tension;
    },
    /** Move a pinned point (for example the base of a stem in a moving scene). */
    pin(i, p) {
      assert(Number.isInteger(i) && pinned[i], 'INVALID_CHAIN', `Point ${i} is not pinned.`);
      const q = vec(p, 'pin');
      x[i] = ox[i] = q.x;
      y[i] = oy[i] = q.y;
    },
    /**
     * Advance by dt seconds. `wind(x, y)` returns air velocity; drag pulls each point's velocity
     * toward it. `force` is an extra constant acceleration.
     */
    step(dt, s = {}) {
      options(s, ['wind', 'force'], 'softChain step');
      const h = stepDt(dt);
      if (h <= 0) return chain;
      const wind = s.wind;
      assert(
        wind === undefined || typeof wind === 'function',
        'INVALID_CHAIN',
        'wind must be a function (x, y) => {x, y}.',
      );
      const force = vec(s.force ?? { x: 0, y: 0 }, 'force');
      for (let i = 0; i < n; i++) {
        if (!w[i]) continue;
        const vx = (x[i] - ox[i]) * damping,
          vy = (y[i] - oy[i]) * damping;
        // The shape spring pulls each point toward its rest pose, as an acceleration per unit offset.
        let ax = gravity.x + force.x + stiffness * (x[anchor] + offX[i] - x[i]),
          ay = gravity.y + force.y + stiffness * (y[anchor] + offY[i] - y[i]);
        if (wind) {
          const a = wind(x[i], y[i]);
          const air = { x: number(a?.x, 'wind x'), y: number(a?.y, 'wind y') };
          ax += (air.x - vx / h) * drag * w[i];
          ay += (air.y - vy / h) * drag * w[i];
        }
        ox[i] = x[i];
        oy[i] = y[i];
        x[i] += vx + ax * h * h;
        y[i] += vy + ay * h * h;
      }
      for (let it = 0; it < iterations; it++) {
        if (bend > 0) for (let i = 0; i < n - 2; i++) link(i, i + 2, len2[i], bend);
        for (let i = 0; i < n - 1; i++) link(i, i + 1, len[i], 1);
      }
      tension = 0;
      for (let i = 0; i < n - 1; i++)
        tension = Math.max(tension, Math.abs(Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]) - len[i]) / (len[i] || 1));
      return chain;
    },
    snapshot() {
      return Object.freeze({ x: copy(x), y: copy(y), ox: copy(ox), oy: copy(oy), tension });
    },
    restore(s) {
      assert(
        s && s.x?.length === n && s.ox?.length === n,
        'INVALID_SNAPSHOT',
        'This snapshot belongs to a different chain.',
      );
      x = copy(s.x);
      y = copy(s.y);
      ox = copy(s.ox);
      oy = copy(s.oy);
      tension = s.tension;
      return chain;
    },
  };
  return chain;
}

/**
 * A small stable-fluids air field (after Jos Stam, 1999) over a width x height stage. splat()
 * pushes air, step() advects and projects it so a sweep rolls into eddies, and velocity()
 * reads it. `breeze` adds a steady drift plus coherent noise. Work per step is fixed by the grid.
 */
export function windField(spec = {}) {
  options(spec, ['width', 'height', 'cell', 'iterations', 'breeze', 'decay'], 'windField');
  const width = number(spec.width ?? 1600, 'wind width', 1, 1e5),
    height = number(spec.height ?? 900, 'wind height', 1, 1e5),
    cell = number(spec.cell ?? 20, 'wind cell', 1, 1e4);
  const nx = Math.ceil(width / cell),
    ny = Math.ceil(height / cell),
    count = nx * ny;
  assert(
    count <= 40000,
    'RESOURCE_LIMIT',
    `The wind grid would have ${count} cells. Use a larger cell so it stays under 40000.`,
  );
  const iterations = number(spec.iterations ?? 14, 'pressure iterations', 1, 60);
  assert(Number.isInteger(iterations), 'INVALID_WIND', 'Iterations must be a whole number.');
  const decay = number(spec.decay ?? 0.985, 'wind decay', 0, 1);
  let breeze = null;
  if (spec.breeze != null) {
    options(spec.breeze, ['x', 'y', 'gust', 'scale', 'speed', 'seed'], 'breeze');
    breeze = {
      x: number(spec.breeze.x ?? 0, 'breeze x'),
      y: number(spec.breeze.y ?? 0, 'breeze y'),
      gust: number(spec.breeze.gust ?? 0, 'breeze gust', 0, 1e5),
      scale: number(spec.breeze.scale ?? 600, 'breeze scale', 1e-3, 1e7),
      speed: number(spec.breeze.speed ?? 0.12, 'breeze speed', 0, 1e3),
      seed: seedValue(spec.breeze.seed ?? 31),
    };
  }
  let u = new Float64Array(count),
    v = new Float64Array(count),
    u0 = new Float64Array(count),
    v0 = new Float64Array(count);
  const p = new Float64Array(count),
    div = new Float64Array(count);
  const at = (i, j) => Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i));
  const sample = (f, px, py) => {
    const gx = Math.min(nx - 1.001, Math.max(0, px / cell - 0.5)),
      gy = Math.min(ny - 1.001, Math.max(0, py / cell - 0.5));
    const i = gx | 0,
      j = gy | 0,
      a = gx - i,
      b = gy - j;
    return (
      (f[at(i, j)] * (1 - a) + f[at(i + 1, j)] * a) * (1 - b) +
      (f[at(i, j + 1)] * (1 - a) + f[at(i + 1, j + 1)] * a) * b
    );
  };
  const splats = [];
  const field = {
    get columns() {
      return nx;
    },
    get rows() {
      return ny;
    },
    /** Push air: a soft blob of velocity (units per second) applied on the next step. */
    splat(px, py, vx, vy, radius = cell * 4) {
      for (const [k, val] of Object.entries({ px, py, vx, vy })) number(val, `splat ${k}`, -1e6, 1e6);
      number(radius, 'splat radius', 1e-3, 1e5);
      splats.push({ x: px, y: py, vx, vy, radius });
      if (splats.length > 16) splats.shift();
    },
    /** Air velocity at a point at time t (time only moves the breeze). */
    velocity(px, py, t = 0) {
      number(px, 'wind x', -1e7, 1e7);
      number(py, 'wind y', -1e7, 1e7);
      let bx = 0,
        by = 0;
      if (breeze) {
        const s = breeze.scale,
          z = number(t, 'wind time', -1e7, 1e7) * breeze.speed;
        bx = breeze.x + breeze.gust * gradientRaw2(px / s + z, py / s, breeze.seed);
        by = breeze.y + breeze.gust * 0.6 * gradientRaw2(px / s - 7.3, py / s + z, (breeze.seed + 1) >>> 0);
      }
      return { x: sample(u, px, py) + bx, y: sample(v, px, py) + by };
    },
    /** How fast the air spins at a point, per second (positive is clockwise on a y-down stage). */
    curl(px, py) {
      const h = cell;
      return (
        (sample(v, px + h, py) - sample(v, px - h, py) - (sample(u, px, py + h) - sample(u, px, py - h))) / (2 * h)
      );
    },
    /** Total kinetic energy of the solved air, for tests and for fading effects out. */
    energy() {
      let e = 0;
      for (let k = 0; k < count; k++) e += u[k] * u[k] + v[k] * v[k];
      return e / count;
    },
    step(dt) {
      const h = stepDt(dt);
      for (const s of splats) {
        const r2 = 2 * s.radius * s.radius;
        const i0 = Math.max(0, Math.floor((s.x - s.radius * 2) / cell)),
          i1 = Math.min(nx - 1, Math.ceil((s.x + s.radius * 2) / cell));
        const j0 = Math.max(0, Math.floor((s.y - s.radius * 2) / cell)),
          j1 = Math.min(ny - 1, Math.ceil((s.y + s.radius * 2) / cell));
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const dx = (i + 0.5) * cell - s.x,
              dy = (j + 0.5) * cell - s.y,
              f = Math.exp(-(dx * dx + dy * dy) / r2);
            u[j * nx + i] += s.vx * f * 0.5;
            v[j * nx + i] += s.vy * f * 0.5;
          }
      }
      splats.length = 0;
      if (h <= 0) return field;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          u0[k] = sample(u, (i + 0.5) * cell - u[k] * h, (j + 0.5) * cell - v[k] * h) * decay;
          v0[k] = sample(v, (i + 0.5) * cell - u[k] * h, (j + 0.5) * cell - v[k] * h) * decay;
        }
      [u, u0] = [u0, u];
      [v, v0] = [v0, v];
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          div[j * nx + i] = -0.5 * (u[at(i + 1, j)] - u[at(i - 1, j)] + v[at(i, j + 1)] - v[at(i, j - 1)]);
          p[j * nx + i] = 0;
        }
      for (let it = 0; it < iterations; it++)
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++)
            p[j * nx + i] =
              (div[j * nx + i] + p[at(i - 1, j)] + p[at(i + 1, j)] + p[at(i, j - 1)] + p[at(i, j + 1)]) / 4;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          u[k] -= 0.5 * (p[at(i + 1, j)] - p[at(i - 1, j)]);
          v[k] -= 0.5 * (p[at(i, j + 1)] - p[at(i, j - 1)]);
        }
      return field;
    },
    /** Mean divergence magnitude: near zero after a step means the air swirls instead of piling up. */
    divergence() {
      let d = 0;
      for (let j = 1; j < ny - 1; j++)
        for (let i = 1; i < nx - 1; i++)
          d += Math.abs(0.5 * (u[at(i + 1, j)] - u[at(i - 1, j)] + v[at(i, j + 1)] - v[at(i, j - 1)]));
      return d / Math.max(1, (nx - 2) * (ny - 2));
    },
    snapshot() {
      return Object.freeze({ u: copy(u), v: copy(v), splats: splats.map((s) => ({ ...s })) });
    },
    restore(s) {
      assert(s && s.u?.length === count, 'INVALID_SNAPSHOT', 'This snapshot belongs to a different wind field.');
      u = copy(s.u);
      v = copy(s.v);
      splats.length = 0;
      splats.push(...s.splats.map((q) => ({ ...q })));
      return field;
    },
  };
  return field;
}

/**
 * A live spring follower: set target, call step(dt), read value. It overshoots and settles,
 * which makes hover, gaze and UI motion feel physical. Works on a number or a list of numbers.
 */
export function chaser(spec = {}) {
  options(spec, ['value', 'stiffness', 'damping'], 'chaser');
  const initial = spec.value ?? 0;
  const scalar = !Array.isArray(initial);
  const dims = scalar ? 1 : initial.length;
  assert(dims >= 1 && dims <= 16, 'INVALID_CHASER', 'A chaser follows a number or up to 16 numbers.');
  const read = (v, name) =>
    scalar
      ? [number(v, name, -1e9, 1e9)]
      : (assert(Array.isArray(v) && v.length === dims, 'INVALID_CHASER', `${name} needs ${dims} numbers.`),
        v.map((q) => number(q, name, -1e9, 1e9)));
  const stiffness = number(spec.stiffness ?? 170, 'chaser stiffness', 0, 1e5),
    damping = number(spec.damping ?? 14, 'chaser damping', 0, 1e4);
  let value = read(initial, 'chaser value'),
    velocity = new Array(dims).fill(0),
    target = value.slice();
  const out = (a) => (scalar ? a[0] : a.slice());
  const c = {
    get value() {
      return out(value);
    },
    get velocity() {
      return out(velocity);
    },
    get target() {
      return out(target);
    },
    set target(t) {
      target = read(t, 'chaser target');
    },
    /** Jump to a value with no motion, for example after a cut. */
    snap(v) {
      value = read(v, 'chaser value');
      target = value.slice();
      velocity.fill(0);
      return c;
    },
    /** Push it, as if struck. */
    kick(v) {
      const k = read(v, 'chaser kick');
      velocity = velocity.map((q, i) => q + k[i]);
      return c;
    },
    get settled() {
      return value.every((q, i) => Math.abs(q - target[i]) < 1e-3 && Math.abs(velocity[i]) < 1e-3);
    },
    step(dt) {
      let rest = number(dt, 'dt', 0, 10);
      // Semi-implicit Euler sub-steps keep stiff springs stable at low frame rates.
      for (let guard = 0; rest > 1e-9 && guard < 64; guard++) {
        const h = Math.min(rest, 1 / 240);
        for (let i = 0; i < dims; i++) {
          velocity[i] += (stiffness * (target[i] - value[i]) - damping * velocity[i]) * h;
          value[i] += velocity[i] * h;
        }
        rest -= h;
      }
      return c;
    },
    snapshot: () => Object.freeze({ value: value.slice(), velocity: velocity.slice(), target: target.slice() }),
    restore(s) {
      assert(s && s.value?.length === dims, 'INVALID_SNAPSHOT', 'This snapshot belongs to a different chaser.');
      value = s.value.slice();
      velocity = s.velocity.slice();
      target = s.target.slice();
      return c;
    },
  };
  return c;
}

/**
 * Volume-preserving squash and stretch from velocity. Returns the stretch along the motion,
 * the squash across it (their product is 1, so area is kept) and the motion angle in radians.
 */
export function squash(vx, vy, spec = {}) {
  options(spec, ['amount', 'max', 'speed'], 'squash');
  number(vx, 'velocity x', -1e7, 1e7);
  number(vy, 'velocity y', -1e7, 1e7);
  const amount = number(spec.amount ?? 1, 'squash amount', 0, 10),
    max = number(spec.max ?? 0.6, 'squash max', 0, 4),
    speed = number(spec.speed ?? 1000, 'reference speed', 1e-6, 1e7);
  const s = Math.min(max, (amount * Math.hypot(vx, vy)) / speed);
  return Object.freeze({ along: 1 + s, across: 1 / (1 + s), angle: Math.atan2(vy, vx) });
}

/**
 * Overshoot-and-settle for arrivals and taps: 0 before age 0, then a value that springs past 1
 * and settles on it. Multiply a scale by it, or use 1 + (pop - 1) * k for a gentler pop.
 */
export function pop(age, spec = {}) {
  options(spec, ['frequency', 'decay'], 'pop');
  number(age, 'pop age', -1e7, 1e7);
  const f = number(spec.frequency ?? 2.2, 'pop frequency', 0.01, 100),
    d = number(spec.decay ?? 7, 'pop decay', 0.01, 1000);
  if (age <= 0) return 0;
  return 1 - Math.exp(-d * age) * Math.cos(2 * Math.PI * f * age);
}

/**
 * Idle sway in radians or units: a slow coherent wander, different for every index, so grass,
 * flowers and hanging things never move in step. Pure function of time.
 */
export function sway(t, spec = {}) {
  options(spec, ['seed', 'index', 'amount', 'rate'], 'sway');
  number(t, 'sway time', -1e7, 1e7);
  const seed = seedValue(spec.seed ?? 0),
    index = number(spec.index ?? 0, 'sway index', 0, 1e7),
    amount = number(spec.amount ?? 0.06, 'sway amount', 0, 1e4),
    rate = number(spec.rate ?? 0.3, 'sway rate', 0, 100);
  // Two octaves: a slow lean plus a lighter flutter.
  const a = gradientRaw2(t * rate + index * 0.618, index * 1.37 + 0.5, seed);
  const b = gradientRaw2(t * rate * 2.7 + 3.1, index * 0.91 - 1.2, (seed + 1) >>> 0);
  return amount * (0.8 * a + 0.35 * b);
}

/**
 * Accumulated-strain release: a thing lets go only after a visible pull. step(dt, pull) returns
 * true on the step it releases. `threshold` is the pull that builds strain and `hold` is how long,
 * in seconds, the pull must last.
 */
export function tug(spec = {}) {
  options(spec, ['threshold', 'hold', 'recover'], 'tug');
  const threshold = number(spec.threshold ?? 1, 'tug threshold', 0, 1e7),
    hold = number(spec.hold ?? 0.25, 'tug hold', 0, 100),
    recover = number(spec.recover ?? 2, 'tug recover', 0, 1e3);
  let strain = 0,
    released = false;
  const t = {
    get strain() {
      return hold ? Math.min(1, strain / hold) : released ? 1 : 0;
    },
    get released() {
      return released;
    },
    step(dt, pull) {
      const h = number(dt, 'dt', 0, 10);
      number(pull, 'pull', 0, 1e9);
      if (released) return false;
      strain = pull > threshold ? strain + h : Math.max(0, strain - h * recover);
      if (strain >= hold && pull > threshold) {
        released = true;
        return true;
      }
      return false;
    },
    reset() {
      strain = 0;
      released = false;
      return t;
    },
    snapshot: () => Object.freeze({ strain, released }),
    restore(s) {
      assert(s && typeof s.strain === 'number', 'INVALID_SNAPSHOT', 'Not a tug snapshot.');
      strain = s.strain;
      released = !!s.released;
      return t;
    },
  };
  return t;
}

/**
 * Screen shake driven by trauma: kick() adds trauma, it decays each step, and the offset scales
 * with trauma squared so small hits stay subtle. Smooth noise makes it rattle rather than jitter.
 */
export function trauma(spec = {}) {
  options(spec, ['decay', 'frequency', 'distance', 'angle', 'seed'], 'trauma');
  const decay = number(spec.decay ?? 1.6, 'trauma decay per second', 0, 1e3),
    frequency = number(spec.frequency ?? 22, 'shake frequency', 0, 1e3),
    distance = number(spec.distance ?? 12, 'shake distance', 0, 1e5),
    angle = number(spec.angle ?? 0.05, 'shake angle', 0, Math.PI),
    seed = seedValue(spec.seed ?? 5);
  let level = 0,
    time = 0;
  const s = {
    get level() {
      return level;
    },
    kick(amount) {
      level = Math.min(1, level + number(amount, 'trauma kick', 0, 10));
      return s;
    },
    step(dt) {
      const h = number(dt, 'dt', 0, 10);
      time += h;
      level = Math.max(0, level - decay * h);
      return s;
    },
    /** The current offset: {x, y} in the distance's units and rotation in radians. */
    offset() {
      const k = level * level,
        t = time * frequency;
      if (k === 0) return Object.freeze({ x: 0, y: 0, rotation: 0 });
      return Object.freeze({
        x: distance * k * gradientRaw2(t, 0.5, seed),
        y: distance * k * gradientRaw2(0.5, t, (seed + 1) >>> 0),
        rotation: angle * k * gradientRaw2(t + 9.1, t - 3.3, (seed + 2) >>> 0),
      });
    },
    snapshot: () => Object.freeze({ level, time }),
    restore(q) {
      assert(q && typeof q.level === 'number', 'INVALID_SNAPSHOT', 'Not a trauma snapshot.');
      level = q.level;
      time = q.time;
      return s;
    },
  };
  return s;
}

/**
 * Hit-stop: map real time to action time so the action freezes briefly at each impact. `hits`
 * is a list of {at, hold} in action time. Pure, so it works with seeking and export.
 */
export function hitstop(realTime, hits = []) {
  number(realTime, 'time', -1e7, 1e7);
  assert(Array.isArray(hits) && hits.length <= 10000, 'INVALID_HITS', 'Give at most 10000 hits.');
  const sorted = hits
    .map((h) => {
      options(h, ['at', 'hold'], 'hit');
      return { at: number(h.at, 'hit time', -1e7, 1e7), hold: number(h.hold ?? 0.06, 'hit hold', 0, 10) };
    })
    .sort((a, b) => a.at - b.at);
  let shift = 0;
  for (const h of sorted) {
    const start = h.at + shift;
    if (realTime < start) break;
    if (realTime < start + h.hold) return h.at;
    shift += h.hold;
  }
  return realTime - shift;
}
