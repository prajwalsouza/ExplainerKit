// A flock of paper planes in three dimensions, with one predator. Classic boids: each plane keeps
// its distance from neighbours (separation), matches their heading (alignment) and drifts toward
// them (cohesion), steers gently toward the reader's pointer or a slow path through the room, and
// flees the vermilion predator, which hunts the nearest plane and never flocks. Planes also steer round any
// upright obstacles the page names, such as a tree trunk in footage.
// A flock is a simulation, not a function of time, so it steps at a fixed rate from a seed and
// records every step's input, with checkpoints: any earlier time replays exactly, launches and
// pointer included. Units are metres; y is up.
import { randomAt } from 'explainerkit/noise';

export const DT = 1 / 60, MAX_PLANES = 48;
const CHECK = 120, TRAIL_EVERY = 3, TRAIL = 46, SEED = 5;
export const BOX = Object.freeze({ x0: -2.6, x1: 4.8, y0: 1.3, y1: 3.8, z0: -2.2, z1: 2.4 });
// Paper colours, chosen as HSLA: ivory, sage and charcoal; the predator is vermilion.
export const PAPERS = Object.freeze([[40, 26, 95], [100, 15, 66], [30, 5, 31], [40, 26, 95], [100, 15, 66], [40, 26, 95]]);
export const PREDATOR = Object.freeze([9, 76, 57]);
export const FOLD_TIME = .8; // seconds for a new sheet to fold into a plane

export function createFlight({ count = 18 } = {}) {
  // Storage for the most planes the reader can make; `n` are flying. Plane 0 is the predator.
  const M = MAX_PLANES, p = new Float64Array(M * 3), v = new Float64Array(M * 3), roll = new Float64Array(M);
  const size = new Float64Array(M), born = new Float64Array(M).fill(-1e9), paper = [], trail = new Float64Array(M * TRAIL * 3);
  let n = count;
  for (let i = 0; i < M; i++) {
    const r = (c) => randomAt(SEED, i, c);
    p[i * 3] = -1 + r(0) * 4.5;p[i * 3 + 1] = 1.6 + r(1) * 1.8;p[i * 3 + 2] = -1.8 + r(2) * 3.4;
    const a = r(3) * 6.283;v[i * 3] = Math.cos(a) * 2;v[i * 3 + 1] = 0;v[i * 3 + 2] = Math.sin(a) * 1.2;
    size[i] = i === 0 ? .56 : .34 + r(4) * .16;
    paper.push(i === 0 ? PREDATOR : PAPERS[i % PAPERS.length]);
    for (let k = 0; k < TRAIL; k++) trail.set(p.subarray(i * 3, i * 3 + 3), (i * TRAIL + k) * 3);
  }
  let step = 0, head = 0;
  const inputs = [], checkpoints = [], launches = [];
  const snapshot = () => ({ step, head, n, p: p.slice(), v: v.slice(), roll: roll.slice(), born: born.slice(), trail: trail.slice() });
  const restore = (c) => { step = c.step;head = c.head;n = c.n;p.set(c.p);v.set(c.v);roll.set(c.roll);born.set(c.born);trail.set(c.trail); };
  checkpoints.push(snapshot());

  /** Where the flock is drawn: the pointer when present, otherwise a slow figure-eight. */
  const centre = (t, input) => (input.active ? input : { x: 1.2 + Math.sin(t * .21) * 2.2, y: 2.5 + Math.sin(t * .42) * .5, z: Math.sin(t * .29) * .9 });

  function advance(input) {
    const t = step * DT;
    if (input.launch && n < M) {
      // A new sheet appears where the reader tapped; it folds, then joins the flock.
      const i = n++, l = input.launch;
      p[i * 3] = l.x;p[i * 3 + 1] = l.y;p[i * 3 + 2] = l.z;v[i * 3] = l.vx;v[i * 3 + 1] = l.vy;v[i * 3 + 2] = l.vz;roll[i] = 0;born[i] = t;
      for (let k = 0; k < TRAIL; k++) trail.set(p.subarray(i * 3, i * 3 + 3), (i * TRAIL + k) * 3);
    }
    const c = centre(t, input);
    for (let i = 0; i < n; i++) {
      const ix = i * 3, px = p[ix], py = p[ix + 1], pz = p[ix + 2];
      let fx = 0, fy = 0, fz = 0;
      if (t - born[i] < FOLD_TIME) { v[ix] *= .97;v[ix + 1] *= .97;v[ix + 2] *= .97;continue; } // still folding: it hovers
      if (i === 0) {
        // The predator hunts: it steers at the nearest plane, leading it slightly.
        let best = -1, bd = 1e9;
        for (let j = 1; j < n; j++) { const d = Math.hypot(p[j * 3] - px, p[j * 3 + 1] - py, p[j * 3 + 2] - pz);if (d < bd) { bd = d;best = j; } }
        if (best > 0) { const b = best * 3;fx = (p[b] + v[b] * .4 - px) * 2.2;fy = (p[b + 1] + v[b + 1] * .4 - py) * 2.2;fz = (p[b + 2] + v[b + 2] * .4 - pz) * 2.2; }
        fx += (c.x - px) * .15;fy += (c.y - py) * .15;fz += (c.z - pz) * .15;
      } else {
        let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, mx = 0, my = 0, mz = 0, near = 0;
        for (let j = 1; j < n; j++) {
          if (j === i) continue;
          const dx = p[j * 3] - px, dy = p[j * 3 + 1] - py, dz = p[j * 3 + 2] - pz, d = Math.hypot(dx, dy, dz);
          if (d > 2.2) continue;
          near++;ax += v[j * 3];ay += v[j * 3 + 1];az += v[j * 3 + 2];mx += dx;my += dy;mz += dz;
          const gap = (size[i] + size[j]) * 1.5; // personal space, wider than the hard limit below
          if (d < gap) { const f = (gap - d) / gap * 9 / Math.max(d, .05);sx -= dx * f;sy -= dy * f;sz -= dz * f; }
        }
        fx = sx + (c.x - px) * .6;fy = sy + (c.y - py) * .6;fz = sz + (c.z - pz) * .6;
        if (near) { fx += (ax / near - v[ix]) * 1.1 + mx / near * .8;fy += (ay / near - v[ix + 1]) * 1.1 + my / near * .8;fz += (az / near - v[ix + 2]) * 1.1 + mz / near * .8; }
        // Flee the predator, sideways as much as away, as real flocks split around a hawk.
        const dx = px - p[0], dy = py - p[1], dz = pz - p[2], d = Math.hypot(dx, dy, dz);
        if (d < 2) { const f = (2 - d) * 14 / (d + .1);fx += dx * f - dz * f * .5;fy += dy * f * .6;fz += dz * f + dx * f * .5; }
      }
      // Upright obstacles, such as a tree trunk in footage: a plane that comes within reach of one turns away from
      // it, more sharply the closer it is, and slides round its side rather than stopping.
      for (const o of input.avoid ?? []) {
        const ox = px - o.x, oz = pz - o.z, d = Math.hypot(ox, oz) || 1e-6, reach = o.r + .7;
        if (d < reach) { const f = (reach - d) / reach * 26 / d;fx += ox * f - oz * f * .35;fz += oz * f + ox * f * .35; }
      }
      fx += wall(px, BOX.x0, BOX.x1);fy += wall(py, BOX.y0, BOX.y1) * 1.6;fz += wall(pz, BOX.z0, BOX.z1);
      let vx = v[ix] + fx * DT, vy = v[ix + 1] + fy * DT, vz = v[ix + 2] + fz * DT;
      // Planes glide: speed stays within a band and climbs and dives stay shallow.
      const flat = Math.hypot(vx, vz), climb = .55 * flat;
      if (vy > climb) vy = climb; else if (vy < -climb) vy = -climb;
      const sp = Math.hypot(vx, vy, vz), max = i === 0 ? 3.6 : 3, min = 1.4, k = sp > max ? max / sp : sp < min ? min / sp : 1;
      vx *= k;vy *= k;vz *= k;
      // Bank into the turn: the sideways part of the steering sets the roll, smoothed.
      const side = (vx * fz - vz * fx) / (flat + 1e-6), target = Math.max(-1.05, Math.min(1.05, Math.atan(side / 9.8) * 2.2));
      roll[i] += (target - roll[i]) * (1 - Math.exp(-DT * 4));
      v[ix] = vx;v[ix + 1] = vy;v[ix + 2] = vz;
    }
    for (let i = 0; i < n * 3; i++) p[i] += v[i] * DT;
    keepApart();
    step++;
    if (step % TRAIL_EVERY === 0) { head = (head + 1) % TRAIL;for (let i = 0; i < n; i++) trail.set(p.subarray(i * 3, i * 3 + 3), (i * TRAIL + head) * 3); }
    if (step % CHECK === 0) checkpoints[step / CHECK] = snapshot();
  }

  /** Planes never pass through each other: overlapping pairs are pushed apart and stop closing. */
  function keepApart() {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = i * 3, b = j * 3, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      const min = (size[i] + size[j]) * .7;
      if (d >= min) continue;
      const ux = dx / d, uy = dy / d, uz = dz / d, push = (min - d) / 2;
      p[a] -= ux * push;p[a + 1] -= uy * push;p[a + 2] -= uz * push;p[b] += ux * push;p[b + 1] += uy * push;p[b + 2] += uz * push;
      const closing = (v[b] - v[a]) * ux + (v[b + 1] - v[a + 1]) * uy + (v[b + 2] - v[a + 2]) * uz;
      if (closing < 0) { const k = closing / 2;v[a] += ux * k;v[a + 1] += uy * k;v[a + 2] += uz * k;v[b] -= ux * k;v[b + 1] -= uy * k;v[b + 2] -= uz * k; }
    }
  }

  return {
    get count() { return n; }, max: M, p, v, roll, size, born, paper, trail, TRAIL,
    get head() { return head; },
    get time() { return step * DT; },
    /**
     * Before the first step only: start plane 0 at `lead` (where a page's loader left it, metres and m/s),
     * and give the planes birth times (`born[i]`, seconds), so they fold in one after another.
     */
    begin({ lead = null, born: times = null } = {}) {
      if (step) return;
      if (lead) { p[0] = lead.x;p[1] = lead.y;p[2] = lead.z;v[0] = lead.vx;v[1] = lead.vy;v[2] = lead.vz;for (let k = 0; k < TRAIL; k++) trail.set(p.subarray(0, 3), k * 3); }
      if (times) times.forEach((at, i) => { if (i < M) born[i] = at; });
      checkpoints[0] = snapshot();
    },
    /** Queue a plane to launch at the next new step, from a point with a velocity (metres, m/s). */
    launch(at) { if (n + launches.length < M) launches.push(Object.freeze({ ...at })); },
    /** Bring the flock to `time`. New steps record `input`; earlier times replay what was recorded. */
    to(time, input) {
      const target = Math.max(0, Math.floor(time / DT));
      if (target < step) restore(checkpoints[Math.min(Math.floor(target / CHECK), checkpoints.length - 1)]);
      let budget = 240; // a long jump (a hidden tab) catches up over several frames
      while (step < target && budget--) {
        if (step >= inputs.length) inputs.push(Object.freeze({ ...input, launch: launches.shift() ?? null }));
        advance(inputs[step]);
      }
    },
  };
}
const wall = (x, lo, hi) => (x < lo ? (lo - x) * 6 : x > hi ? (hi - x) * 6 : 0);

/**
 * A folded dart, in plane space: a forward, b right, c up. Two creased wing panels each side and a
 * two-layer keel below. `flat` is the same sheet before folding: keel and wings opened into a plane.
 */
export const DART = Object.freeze({
  points: [[.52, 0, .012], [-.48, 0, 0], [-.48, -.17, .03], [-.48, -.47, .085], [-.48, .17, .03], [-.48, .47, .085], [-.42, -.012, -.14], [-.42, .012, -.14], [.28, 0, -.02]],
  flat: [[.52, 0, 0], [-.48, 0, 0], [-.48, -.2, 0], [-.48, -.56, 0], [-.48, .2, 0], [-.48, .56, 0], [-.42, -.7, 0], [-.42, .7, 0], [.28, 0, 0]],
  faces: [[0, 1, 6, 'keel'], [0, 1, 7, 'keel'], [0, 2, 1, 'inner'], [0, 3, 2, 'outer'], [0, 1, 4, 'inner'], [0, 4, 5, 'outer']],
});

/** World-space vertices of plane i, folded by `fold` in [0, 1], written into `out` (9 xyz triples). */
export function placeDart(f, i, out, offset = 0, fold = 1) {
  const ix = i * 3, vx = f.v[ix], vy = f.v[ix + 1], vz = f.v[ix + 2], sp = Math.hypot(vx, vy, vz) || 1;
  const fx = vx / sp, fy = vy / sp, fz = vz / sp;
  // Right = forward × up, then the plane's own up; rolling turns both about the forward axis.
  let rx = -fz, rz = fx;const rl = Math.hypot(rx, rz) || 1;rx /= rl;rz /= rl;
  let ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const c = Math.cos(f.roll[i]), s = Math.sin(f.roll[i]);
  const Rx = rx * c + ux * s, Ry = uy * s, Rz = rz * c + uz * s;
  ux = ux * c - rx * s;uy = uy * c;uz = uz * c - rz * s;
  const k = f.size[i];
  for (let j = 0; j < DART.points.length; j++) {
    const P = DART.points[j], F = DART.flat[j], a = F[0] + (P[0] - F[0]) * fold, b = F[1] + (P[1] - F[1]) * fold, cc = F[2] + (P[2] - F[2]) * fold, o = offset + j * 3;
    out[o] = f.p[ix] + (fx * a + Rx * b + ux * cc) * k;
    out[o + 1] = f.p[ix + 1] + (fy * a + Ry * b + uy * cc) * k;
    out[o + 2] = f.p[ix + 2] + (fz * a + Rz * b + uz * cc) * k;
  }
}
