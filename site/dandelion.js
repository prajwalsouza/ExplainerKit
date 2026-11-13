// A dandelion clock as a soft body, drawn in 2D. Everything that moves is a small chain of points
// integrated with Verlet steps and held together by constraints (position-based dynamics):
//   · the stem is a flexible rod pinned at the ground, carrying a heavy head; wind on the head's
//     seeds swings it, and its shape spring brings it back with a little overshoot;
//   · every seed's stalk is a four-point elastic chain anchored to the head; air dragging on its
//     pappus bends it into a curve; a seed tugs, stretches its stalk, and only then lets go;
//   · a free seed is the same chain unanchored: heavy achene below, light draggy pappus above, so
//     it swings like a pendulum, sways in the eddies, and its stalk flexes as it flies.
// Every seed is different: length, stiffness, tilt, filament count, spread, droop, missing
// filaments, achene size and tint all come from a seeded random, so no two look alike.
// Stage units, 1600 × 900. Work per step is fixed: one stem, at most 104 attached and 90 free seeds.
import { hsla } from 'explainerkit/color';
import { theme, brandHsla } from './theme.js';
import { noise2, randomAt } from 'explainerkit/noise';

export const HEAD = Object.freeze({ x: 760, y: 430, r: 280, core: 70 });
export const HERO = 7; // the seed with the blue achene
const N = 104, GOLDEN = Math.PI * (3 - Math.sqrt(5)), LINKS = 4, MAX_FREE = 90, FLUTTER = Object.freeze({ seed: 17 });
const rnd = (i, c) => randomAt(23, i, c);

// ---- Seeds: each one its own -------------------------------------------------------------------------
const SEEDS = Array.from({ length: N }, (_, i) => {
  // Not a perfect sphere: directions jitter, the head is slightly oblate, and a few gaps open up.
  const z = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - z * z), a = i * GOLDEN + (rnd(i, 0) - .5) * .5;
  return {
    x: Math.cos(a) * r * (1 + (rnd(i, 1) - .5) * .12), y: Math.sin(a) * r * .94, z,
    len: .74 + rnd(i, 2) * .34, stiff: .05 + rnd(i, 3) ** 1.5 * .14, pappus: .78 + rnd(i, 4) * .44,
    variant: Math.floor(rnd(i, 5) * 6), achene: .8 + rnd(i, 6) * .45, hue: 26 + rnd(i, 7) * 12, light: 36 + rnd(i, 8) * 14,
    hold: 32 + rnd(i, 9) ** 2 * 90, curl: (rnd(i, 10) - .5) * .5, flutter: rnd(i, 11) * 100,
    // Colour is a little uneven too: beaks warmer or greyer, some parachutes brighter than others.
    beak: [30 + rnd(i, 12) * 12, 10 + rnd(i, 13) * 10, 52 + rnd(i, 14) * 12], glow: .82 + rnd(i, 15) * .18,
  };
});
SEEDS[HERO] = { ...SEEDS[HERO], x: .82, y: .1, z: .55, len: 1, hold: 1e9, pappus: 1.05 };

// ---- Pappus sprites: six irregular variants × seven viewing tilts --------------------------------------
const VIEWS = 7, SPRITE = 260;
let PAPPI = null;
function pappusSprite(variant, tilt) {
  const c = document.createElement('canvas');c.width = c.height = SPRITE;
  const g = c.getContext('2d'), C = SPRITE / 2, alpha = tilt * Math.PI / 2, r = (k, ch) => randomAt(40 + variant, k, ch);
  const count = 15 + Math.floor(r(0, 0) * 12), cone = 1 + r(0, 1) * .3, L = SPRITE * .42, droop = .03 + r(0, 2) * .1;
  const rays = [];
  for (let k = 0; k < count; k++) {
    if (r(k, 3) < .08) continue; // a filament or two is missing
    const phi = k / count * 6.283 + (r(k, 4) - .5) * .5, th = cone * (.7 + r(k, 5) * .4), len = L * (.68 + r(k, 6) * .36);
    const dx = Math.sin(th) * Math.cos(phi), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(phi);
    rays.push({ x: dx * len, y: -(dy * Math.cos(alpha) - dz * Math.sin(alpha)) * len, z: dy * Math.sin(alpha) + dz * Math.cos(alpha), len, kink: (r(k, 7) - .5) * .25 });
  }
  rays.sort((a, b) => a.z - b.z);
  g.lineCap = 'round';
  for (const q of rays) {
    const fade = .45 + .55 * (q.z * .5 + .5), sag = (1 - tilt) * q.len * droop, mx = C + q.x * .5 + q.y * q.kink * .3, my = C + q.y * .5 - q.x * q.kink * .3 + sag * .4, ex = C + q.x, ey = C + q.y + sag;
    // By night the filaments are warm parchment rather than white, each a little different, with a dark under-shadow.
    const dk = theme.night, fl = (k) => (dk ? [34 + r(k, 12) * 14, 18 + r(k, 13) * 16, 64 + r(k, 14) * 14] : [38, 16 + r(0, 8) * 8, 82 + r(0, 9) * 6]);
    const [fh, fs, fl2] = fl(rays.indexOf(q));
    g.strokeStyle = dk ? hsla(0, 0, 0, .35 * fade) : hsla(30, 16, 46, .15 * fade);g.lineWidth = 2;g.beginPath();g.moveTo(C + 1, C + 1.5);g.quadraticCurveTo(mx + 1, my + 1.5, ex + 1, ey + 1.5);g.stroke();
    g.strokeStyle = hsla(fh, fs, fl2, .92 * fade);g.lineWidth = 1 + r(0, 10) * .3;g.beginPath();g.moveTo(C, C);g.quadraticCurveTo(mx, my, ex, ey);g.stroke();
    // Plumes: fine side hairs, denser near the tip, of uneven length.
    g.lineWidth = .55;g.strokeStyle = hsla(fh, fs, fl2 + (dk ? -4 : 0), .7 * fade);
    const ux = q.x / q.len, uy = q.y / q.len, hairs = 6 + Math.floor(r(0, 11) * 6);
    for (let h = 0; h < hairs; h++) {
      const t = .42 + h / hairs * .55, hx = C + q.x * t, hy = C + q.y * t + sag * t * t, s = (4 + h * .9) * (.7 + randomAt(9, h, variant) * .6);
      g.beginPath();g.moveTo(hx, hy);g.lineTo(hx + (ux * .5 - uy) * s, hy + (uy * .5 + ux) * s);g.moveTo(hx, hy);g.lineTo(hx + (ux * .5 + uy) * s, hy + (uy * .5 - ux) * s);g.stroke();
    }
  }
  g.fillStyle = theme.night ? hsla(32, 26, 56) : hsla(36, 20, 78);g.beginPath();g.arc(C, C, 2.4, 0, 6.283);g.fill();
  return c;
}
let PAPPI_MODE = null;
/** The sprites, drawn once per theme (day white, night parchment). */
const pappi = () => {
  if (PAPPI_MODE !== theme.mode) { PAPPI = null;PAPPI_MODE = theme.mode; }
  return (PAPPI ??= Array.from({ length: 6 }, (_, v) => Array.from({ length: VIEWS }, (_, k) => pappusSprite(v, k / (VIEWS - 1)))));
};

// ---- Drawing a seed from its chain --------------------------------------------------------------------
/**
 * Draw a seed from chain points px/py (achene first, pappus hub last): a ribbed achene with tiny
 * barbs, a beak bent along the chain, and a pappus that squashes and flutters in the relative wind.
 */
function drawChain(ctx, s, px, py, o, { tilt, rel = null, alpha = 1, hero = false, t = 0, scale = 1 }) {
  const ax = px[o], ay = py[o], bx = px[o + 1], by = py[o + 1], ex = px[o + LINKS - 1], ey = py[o + LINKS - 1];
  const dir = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
  ctx.globalAlpha = alpha;
  // Achene: a spindle with ribs and a few barbs at its upper end.
  ctx.save();ctx.translate(ax + (bx - ax) * .25, ay + (by - ay) * .25);ctx.rotate(dir);ctx.scale(s.achene * scale, s.achene * scale);
  ctx.fillStyle = hero ? brandHsla(-3) : hsla(s.hue, 26, s.light);ctx.beginPath();ctx.ellipse(0, 0, 4.2, 16, 0, 0, 6.283);ctx.fill();
  ctx.strokeStyle = hero ? brandHsla(16, .7, -8) : hsla(s.hue, 22, s.light + 18, .55);ctx.lineWidth = .6;
  for (const k of [-1.7, 0, 1.7]) { ctx.beginPath();ctx.moveTo(k, -13);ctx.lineTo(k * .8, 13);ctx.stroke(); }
  for (let b = 0; b < 4; b++) { const y = -13 + b * 2.5;ctx.beginPath();ctx.moveTo(-3.6, y);ctx.lineTo(-5.4, y - 2);ctx.moveTo(3.6, y);ctx.lineTo(5.4, y - 2);ctx.stroke(); }
  ctx.restore();
  // Beak: a smooth curve through the chain, so bending reads as bending.
  ctx.strokeStyle = hsla(s.beak[0], s.beak[1], s.beak[2], .85);ctx.lineWidth = (.9 + s.achene * .2) * scale;ctx.beginPath();ctx.moveTo(ax + (bx - ax) * .5, ay + (by - ay) * .5);
  for (let k = 1; k < LINKS - 1; k++) { const mx = (px[o + k] + px[o + k + 1]) / 2, my = (py[o + k] + py[o + k + 1]) / 2;ctx.quadraticCurveTo(px[o + k], py[o + k], mx, my); }
  ctx.lineTo(ex, ey);ctx.stroke();
  // Pappus: tilted to the beak's last link, squashed along the relative wind, fluttering a little.
  const end = Math.atan2(ey - py[o + LINKS - 2], ex - px[o + LINKS - 2]) + Math.PI / 2, img = pappi()[s.variant][Math.round(Math.min(1, Math.abs(tilt)) * (VIEWS - 1))];
  const size = 92 * s.pappus * scale * 2 / (SPRITE * .84), flutter = .06 * noise2(t * 3 + s.flutter, s.flutter, FLUTTER);
  ctx.save();ctx.translate(ex, ey);
  if (rel) { const speed = Math.min(1, Math.hypot(rel.x, rel.y) / 260), wa = Math.atan2(rel.y, rel.x);ctx.rotate(wa);ctx.scale(1 - .28 * speed, 1 + .06 * speed);ctx.rotate(-wa); }
  ctx.rotate(end + flutter + s.curl * .2);ctx.globalAlpha = alpha * s.glow;ctx.drawImage(img, -SPRITE / 2 * size, -SPRITE / 2 * size, SPRITE * size, SPRITE * size);ctx.restore();
}

/** A single seed drawn on its own (used when one seed is carried between scenes). */
export function drawSeed(ctx, x, y, dx, dy, dz, len, p, alpha = 1, hero = false) {
  const px = new Float32Array(LINKS), py = new Float32Array(LINKS);
  for (let k = 0; k < LINKS; k++) { px[k] = x + dx * len * k / (LINKS - 1);py[k] = y + dy * len * k / (LINKS - 1); }
  drawChain(ctx, { ...SEEDS[HERO], pappus: p / 92 }, px, py, 0, { tilt: dz, alpha, hero });
}

// ---- The soft body ---------------------------------------------------------------------------------
const STEM_N = 12, STEM_BASE = { x: HEAD.x - 70, y: 980 };
const STEM_REST = Array.from({ length: STEM_N }, (_, k) => {
  const u = k / (STEM_N - 1), top = { x: HEAD.x - 10, y: HEAD.y + HEAD.core * .6 }, m = { x: STEM_BASE.x + 14, y: (STEM_BASE.y + top.y) / 2 };
  return { x: (1 - u) ** 2 * STEM_BASE.x + 2 * u * (1 - u) * m.x + u * u * top.x, y: (1 - u) ** 2 * STEM_BASE.y + 2 * u * (1 - u) * m.y + u * u * top.y };
});
const SEG = Math.hypot(STEM_REST[1].x - STEM_REST[0].x, STEM_REST[1].y - STEM_REST[0].y);
const REST_ANGLE = Math.atan2(STEM_REST[STEM_N - 1].y - STEM_REST[STEM_N - 2].y, STEM_REST[STEM_N - 1].x - STEM_REST[STEM_N - 2].x);

/** A chain point store: positions, previous positions (Verlet), inverse masses. */
function points(n) { return { x: new Float32Array(n), y: new Float32Array(n), ox: new Float32Array(n), oy: new Float32Array(n), w: new Float32Array(n).fill(1) }; }
function link(P, a, b, len, k = 1) {
  const dx = P.x[b] - P.x[a], dy = P.y[b] - P.y[a], d = Math.hypot(dx, dy) || 1e-6, wa = P.w[a], wb = P.w[b], sum = wa + wb;
  if (!sum) return 0;
  const c = (d - len) / d / sum * k;P.x[a] += dx * c * wa;P.y[a] += dy * c * wa;P.x[b] -= dx * c * wb;P.y[b] -= dy * c * wb;
  return d - len;
}

export function createClock(air) {
  const stem = points(STEM_N);
  STEM_REST.forEach((p, k) => { stem.x[k] = stem.ox[k] = p.x;stem.y[k] = stem.oy[k] = p.y; });
  stem.w[0] = 0;stem.w[STEM_N - 1] = .22; // pinned at the ground; the head is heavy
  const seeds = points(N * LINKS), state = new Int8Array(N), strain = new Float32Array(N), gone = new Float32Array(N).fill(-1), grow = new Float32Array(N).fill(1);
  const free = points(MAX_FREE * LINKS), freeOf = new Int16Array(MAX_FREE).fill(-1);
  let head = { x: STEM_REST[STEM_N - 1].x, y: STEM_REST[STEM_N - 1].y, a: 0 };
  /** Rest position of seed i's chain point k, in the current head frame. */
  const rest = (i, k) => {
    const s = SEEDS[i], rim = Math.hypot(s.x, s.y) || 1, ax = s.x / rim * HEAD.core * .92, ay = s.y / rim * HEAD.core * .74 - HEAD.core * .6;
    const L = HEAD.r * s.len * grow[i], u = k / (LINKS - 1), bend = s.curl * u * u * L * .12;
    const lx = ax + s.x * L * u - s.y * bend, ly = ay + s.y * L * u + s.x * bend, c = Math.cos(head.a), sn = Math.sin(head.a);
    return { x: head.x + lx * c - ly * sn, y: head.y + lx * sn + ly * c };
  };
  for (let i = 0; i < N; i++) for (let k = 0; k < LINKS; k++) { const p = rest(i, k), j = i * LINKS + k;seeds.x[j] = seeds.ox[j] = p.x;seeds.y[j] = seeds.oy[j] = p.y;seeds.w[j] = k ? 1 : 0; }

  const integrate = (P, j, fx, fy, dt, damp) => {
    const vx = (P.x[j] - P.ox[j]) * damp, vy = (P.y[j] - P.oy[j]) * damp;
    P.ox[j] = P.x[j];P.oy[j] = P.y[j];P.x[j] += vx + fx * dt * dt;P.y[j] += vy + fy * dt * dt;
  };
  const velocity = (P, j, dt) => ({ x: (P.x[j] - P.ox[j]) / dt, y: (P.y[j] - P.oy[j]) / dt });

  function release(i, t) {
    state[i] = 1;gone[i] = t;
    const slot = freeOf.indexOf(-1);if (slot < 0) return;
    freeOf[slot] = i;
    for (let k = 0; k < LINKS; k++) { const a = i * LINKS + k, b = slot * LINKS + k;free.x[b] = seeds.x[a];free.y[b] = seeds.y[a];free.ox[b] = seeds.ox[a];free.oy[b] = seeds.oy[a];free.w[b] = 1; }
    free.w[slot * LINKS] = .45; // the achene is the heavy end
  }

  let peak = 0;
  return {
    stem, seeds, free, freeOf, state, gone,
    get peak() { const p = peak;peak = 0;return p; },
    get head() { return head; },
    /** A seed's pappus hub, for a camera or a transition to follow. */
    tipOf(i) { const j = i * LINKS + LINKS - 1;return { x: seeds.x[j], y: seeds.y[j] }; },
    /** Advance: `gust` in [0, 1] is the scroll's wind, which also loosens every seed's hold. */
    step(dt, t, { gust = 0 } = {}) {
      dt = Math.min(Math.max(dt, 1 / 240), 1 / 30);
      const wind = (x, y) => { const w = air.velocity(x, y, t);return { x: w.x + gust * 700, y: w.y - gust * 90 }; };
      // Lost seeds grow back after a while; scrolling back before the gust grows them back at once.
      for (let i = 0; i < N; i++) if (state[i] && (gust <= 0 && t - gone[i] > 14)) { state[i] = 0;grow[i] = 0;strain[i] = 0; }
      for (let i = 0; i < N; i++) grow[i] = Math.min(1, grow[i] + dt * .8);
      // The stem: wind drag on every point, much more at the head (it carries the seeds' drag),
      // then Verlet, length constraints and a shape spring toward its rest curve.
      let attached = 0;for (let i = 0; i < N; i++) attached += state[i] ? 0 : 1;attached /= N;
      for (let k = 1; k < STEM_N; k++) {
        const v = velocity(stem, k, dt), w = wind(stem.x[k], stem.y[k]), cd = k === STEM_N - 1 ? 6 + 16 * attached : 1.6;
        integrate(stem, k, (w.x - v.x) * cd * .9, (w.y - v.y) * cd * .25, dt, .992);
      }
      for (let it = 0; it < 6; it++) {
        for (let k = 0; k < STEM_N - 1; k++) link(stem, k, k + 1, SEG);
        for (let k = 1; k < STEM_N; k++) { const kk = .018 * (k / STEM_N);stem.x[k] += (STEM_REST[k].x - stem.x[k]) * kk;stem.y[k] += (STEM_REST[k].y - stem.y[k]) * kk; }
      }
      const tip = STEM_N - 1, ang = Math.atan2(stem.y[tip] - stem.y[tip - 1], stem.x[tip] - stem.x[tip - 1]);
      head = { x: stem.x[tip], y: stem.y[tip], a: ang - REST_ANGLE };
      // Attached seeds: the anchor rides the head; the chain feels the air and a shape spring
      // (its own stiffness) toward its rest pose. Strain builds while it is pulled hard.
      for (let i = 0; i < N; i++) {
        if (state[i]) continue;
        const s = SEEDS[i], o = i * LINKS, tipJ = o + LINKS - 1;
        const a0 = rest(i, 0);seeds.x[o] = seeds.ox[o] = a0.x;seeds.y[o] = seeds.oy[o] = a0.y;
        for (let k = 1; k < LINKS; k++) {
          const j = o + k, v = velocity(seeds, j, dt), w = wind(seeds.x[j], seeds.y[j]), cd = k === LINKS - 1 ? 26 * s.pappus : 2;
          integrate(seeds, j, (w.x - v.x) * cd, (w.y - v.y) * cd, dt, .985);
        }
        // Links match the projected rest spacing, so a resting stalk is straight, not buckled.
        const L = HEAD.r * s.len * grow[i] * Math.hypot(s.x, s.y) / (LINKS - 1);
        // The stalk's own stiffness pulls it toward its rest pose once per step; the links then keep its length.
        for (let k = 1; k < LINKS; k++) { const r = rest(i, k), kk = s.stiff * (.5 + k * .25);seeds.x[o + k] += (r.x - seeds.x[o + k]) * kk;seeds.y[o + k] += (r.y - seeds.y[o + k]) * kk; }
        for (let it = 0; it < 3; it++) for (let k = 0; k < LINKS - 1; k++) link(seeds, o + k, o + k + 1, L);
        const r = rest(i, LINKS - 1), pull = Math.hypot(seeds.x[tipJ] - r.x, seeds.y[tipJ] - r.y) / (HEAD.r * s.len);
        if (pull > peak) peak = pull;
        // A seed tugs before it lets go: it must stay bent past its own limit for a moment.
        strain[i] = pull * 200 > s.hold * (1 - gust * .85) ? strain[i] + dt : Math.max(0, strain[i] - dt * 2);
        if (strain[i] > .04 && grow[i] >= 1) { strain[i] = 0;release(i, t); }
      }
      // Free seeds: pendulum chains with a heavy achene and a draggy pappus.
      for (let f = 0; f < MAX_FREE; f++) {
        const i = freeOf[f];if (i < 0) continue;
        const s = SEEDS[i], o = f * LINKS;
        for (let k = 0; k < LINKS; k++) {
          const j = o + k, v = velocity(free, j, dt), w = wind(free.x[j], free.y[j]), cd = k === LINKS - 1 ? 7 * s.pappus : .5;
          integrate(free, j, (w.x - v.x) * cd, (w.y - v.y) * cd + (k === 0 ? 260 : 30), dt, .996);
        }
        const L = HEAD.r * s.len / (LINKS - 1);
        for (let it = 0; it < 3; it++) {
          for (let k = 0; k < LINKS - 1; k++) link(free, o + k, o + k + 1, L);
          link(free, o, o + 2, L * 1.98, .9);link(free, o + 1, o + 3, L * 1.98, .9);link(free, o, o + 3, L * 2.94, .5); // a stiff beak: it flexes, it does not coil
        }
        const x = free.x[o + LINKS - 1], y = free.y[o + LINKS - 1];
        if (x > 1900 || x < -400 || y > 1200 || y < -500) freeOf[f] = -1;
      }
    },
  };
}

/** Paint the clock: stem, back seeds, receptacle, front seeds, then seeds in flight. */
export function paintClock(ctx, clock, { t, bloom = 1, alpha = 1, hideHero = false }) {
  if (alpha <= 0) return null;
  ctx.save();ctx.globalAlpha = alpha;ctx.lineCap = 'round';ctx.lineJoin = 'round';
  const h = clock.head;
  ctx.save();ctx.filter = 'blur(60px)';ctx.fillStyle = hsla(30, 20, 40, .06 * bloom);ctx.beginPath();ctx.ellipse(h.x - 60, h.y + 100, HEAD.r * .9, HEAD.r * .55, 0, 0, 6.283);ctx.fill();ctx.restore();
  paintStem(ctx, clock.stem, bloom);
  const order = [...SEEDS.keys()].sort((a, b) => SEEDS[a].z - SEEDS[b].z);
  const draw = (back) => {
    for (const i of order) {
      const s = SEEDS[i];
      if ((s.z < 0) !== back || clock.state[i] || (hideHero && i === HERO)) continue;
      const open = smooth(i / N * .5, i / N * .5 + .5, bloom);
      if (open <= 0) continue;
      drawChain(ctx, s, clock.seeds.x, clock.seeds.y, i * LINKS, { tilt: s.z, alpha: alpha * (back ? .5 : 1) * open, hero: i === HERO, t, scale: .4 + .6 * open });
    }
  };
  draw(true);
  ctx.globalAlpha = alpha;receptacle(ctx, h, bloom);
  draw(false);
  for (let f = 0; f < MAX_FREE; f++) {
    const i = clock.freeOf[f];if (i < 0) continue;
    drawChain(ctx, SEEDS[i], clock.free.x, clock.free.y, f * LINKS, { tilt: SEEDS[i].z * .4, alpha, t });
  }
  ctx.restore();
  return null;
}
const smooth = (a, b, x) => { const v = Math.min(Math.max((x - a) / (b - a), 0), 1);return v * v * (3 - 2 * v); };

/** The stem as a soft tube along its chain, with a light edge. */
function paintStem(ctx, P, grow) {
  const n = Math.max(2, Math.round(STEM_N * grow)), path = () => {
    ctx.beginPath();ctx.moveTo(P.x[0], P.y[0]);
    for (let k = 1; k < n - 1; k++) ctx.quadraticCurveTo(P.x[k], P.y[k], (P.x[k] + P.x[k + 1]) / 2, (P.y[k] + P.y[k + 1]) / 2);
    ctx.lineTo(P.x[n - 1], P.y[n - 1]);
  };
  // The stem's green drifts along its length: yellower near the ground, cooler under the head.
  const along = (h, s, l, a = 1) => { const g = ctx.createLinearGradient(P.x[0], P.y[0], P.x[n - 1], P.y[n - 1]);g.addColorStop(0, hsla(h + 6, s + 3, l + 2, a));g.addColorStop(.55, hsla(h, s, l, a));g.addColorStop(1, hsla(h - 4, s - 2, l - 3, a));return g; };
  // By night the stem is an olive-brown that sits back in the dark, not a lit green: browner, lower, softer highlights.
  const STEM = theme.night ? [[40, along(52, 20, 22), 3], [34, along(56, 21, 29), 0], [14, along(58, 22, 38, .6), -8], [3, along(60, 24, 50, .45), -12]] : [[40, along(90, 18, 40), 3], [34, along(88, 19, 50), 0], [14, along(86, 22, 62, .7), -8], [3, along(84, 24, 74, .5), -12]];
  for (const [w, c, ox] of STEM) {
    ctx.save();ctx.translate(ox * .5, 0);ctx.strokeStyle = c;ctx.lineWidth = w;path();ctx.stroke();ctx.restore();
  }
}

/** The receptacle: a soft dome riding the stem's tip, pitted where seeds were attached. */
function receptacle(ctx, h, bloom) {
  const rx = HEAD.core * bloom, ry = HEAD.core * .78 * bloom;
  if (rx < 1) return;
  ctx.save();ctx.translate(h.x, h.y);ctx.rotate(h.a);ctx.translate(0, -HEAD.core * .6);
  const g = ctx.createRadialGradient(-rx * .3, -ry * .4, rx * .1, 0, 0, rx * 1.05);
  if (theme.night) { g.addColorStop(0, hsla(34, 30, 54));g.addColorStop(.6, hsla(30, 26, 38));g.addColorStop(1, hsla(26, 24, 24)); }
  else { g.addColorStop(0, hsla(38, 16, 78));g.addColorStop(.6, hsla(34, 12, 62));g.addColorStop(1, hsla(30, 12, 46)); }
  ctx.fillStyle = g;ctx.beginPath();ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283);ctx.fill();
  ctx.fillStyle = theme.night ? hsla(24, 20, 16, .6) : hsla(30, 16, 40, .55);
  for (let i = 0; i < 70; i++) { const a = i * GOLDEN, r = Math.sqrt((i + .5) / 70), x = Math.cos(a) * r * rx * .9, y = Math.sin(a) * r * ry * .9 - ry * .05;ctx.beginPath();ctx.ellipse(x, y, 2.4 * (1 - r * .4) * (.7 + rnd(i, 30) * .6), 1.8 * (1 - r * .4), rnd(i, 31), 0, 6.283);ctx.fill(); }
  ctx.restore();
}
