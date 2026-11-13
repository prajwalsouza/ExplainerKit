// The ExplainerKit landing page: one continuous scroll story on one stage, each scene showing what
// the library does, each turning into the next.
// 1 Flight: a 3D boid flock with a predator; a stick figure watches and reacts.      (simulation, 3D projection, characters)
// 2 Ribbon: the flock lands on a stroke; a paper roll unrolls a ribbon that writes "flow".   (measured paths)
// 3 Dandelion: the ribbon unfurls into a stem; a clock blooms; the pointer is wind.   (fields, rigs, drag physics)
// 4 Garden: the camera pulls back from the dandelion, now one plant in a clay garden that grows on springs. (springs, Poisson beds)
// 5 City: zoom out: the garden is the park of a clay city; a marker follows a route.  (log zoom, motion paths)
// 6 Earth: the city tilts flat into a map, the map into the globe; it parts into rings that close to a point. (projection, stagger)
// Scroll sets one scene parameter; everything on the stage is sampled from it and from the clock.
import { scene } from 'explainerkit/core';
import { hsla, toHex } from 'explainerkit/color';
import { randomAt } from 'explainerkit/noise';
import { character, starter } from 'explainerkit/characters';
import { kineticText } from 'explainerkit/typography';
import { bindDOM } from 'explainerkit/dom';
import { projectPoint, screenRay } from 'explainerkit/spatial';
import { logZoom } from 'explainerkit/zoom';
import { velocityTracker } from 'explainerkit/physics';
import { scrollPace, arrivalPlan, arrivalTime } from 'explainerkit/story';
import { theme, surface, brandHsla } from './theme.js';
import { createProjectionPlayer } from 'explainerkit/player';
import { createCanvasRenderer } from 'explainerkit/renderers/canvas';
import { createFlight } from './flight.js';
import { createPainter, stageFor } from './paint.js';
import { KNOTS, strokeOf, paintRibbon, paintBead } from './flow.js';
import { createWind } from './wind.js';
import { createMotes, paintMotes } from './air.js';
import { createClock, paintClock, drawSeed, HEAD, HERO } from './dandelion.js';
import { createThreeStage, createLift, PLACES, ROUTE, EARTH_R, DANDELION_HEAD, DANDELION_RECEPTACLE, toWorld as planToWorld } from './three-stage.js';
import { placeLabels, canvasTextMeasurer } from 'explainerkit/layout/labels';
import { rayPlane, pickBounds } from 'explainerkit/spatial';
import { points } from 'explainerkit/procedural';
import { auditHandover } from 'explainerkit/audit';
import { createLive } from './live.js';
import { importSVG, importSVGFile } from 'explainerkit/import/svg';

// The stylesheet loads after the first-paint plane (index.html); measure nothing until it has arrived.
const sheet = document.querySelector('link[href$="style.css"]');
if (sheet && !sheet.sheet) await new Promise((done) => { sheet.addEventListener('load', done, { once: true });sheet.addEventListener('error', done, { once: true }); });
const $ = (id) => document.getElementById(id);
const stage = $('stage'), ink = $('ink'), cast = $('cast');
const room = stageFor(innerWidth, innerHeight), { W, H, camera } = room;
const flight = createFlight(), painter = createPainter($('back'), $('front'), room);
const mixN = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const v = Math.min(Math.max((x - a) / (b - a), 0), 1);return v * v * (3 - 2 * v); };
// Later scenes are authored on a 1600 × 900 stage; a tall stage shows them scaled to its width.
const FIT = { s: W / 1600, y: (H - 900 * W / 1600) / 2 };
const toArt = (p) => ({ x: p.x / FIT.s, y: (p.y - FIT.y) / FIT.s });

// ---- Scene: time, story position, the figure's attention and poses ----------------------------------
const STORY_MAX = 19.5;
const drawing = scene({ width: W, height: H, renderer: 'canvas', duration: 3600, label: 'ExplainerKit', description: 'A scroll story: paper planes flock; a ribbon writes a word and becomes a dandelion stem; the dandelion stands in a clay garden, the garden in a city that builds outward into countryside, region and planet; the Earth opens into rings that close to one point.' });
const story = drawing.parameter(0, { min: 0, max: STORY_MAX });
const LIVE = [11.9, 13.9], ROOM = [13.9, 15.8], RIVER = [15.8, 17.4], END = 17.75;
// The flock from the opening returns over the river, steers round its tree and stays for the closing line.
const FLOCK = [RIVER[0] + .95, RIVER[0] + 1.3];
/**
 * How folded the live chapter is, by scroll position alone, so it reverses exactly: the view grows out of the
 * point after the core's handover, and stays open through the room, where it hangs on the wall, and the river.
 * It folds back into the point, out of sight under the river, before the closing line. Scrolling back up with data on stage plays the same fold in reverse; nothing is left half-shown.
 */
const liveRetract = (s) => Math.max(smooth(RIVER[1] - .42, RIVER[1] - .16, s), 1 - smooth(LIVE[0] + .02, LIVE[0] + .4, s));
/** Small line icons for each kind of view: what the shape looks like, drawn in one stroke weight. */
const VIEW_ICONS = {
  onion: ['M8 4.6a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8', 'M8 .9v1.3M8 13.8v1.3M.9 8h1.3M13.8 8h1.3M3 3l.9.9M12.1 12.1l.9.9M3 13l.9-.9M12.1 3.9l.9-.9'],
  chord: ['M8 1.6a6.4 6.4 0 1 1 0 12.8a6.4 6.4 0 1 1 0-12.8', 'M3.5 3.5C7 7 9 7 12.5 3.5M3.5 12.5C6 8.5 6.5 6 3.5 3.5M12.5 12.5C9 9.5 7 9.5 3.5 12.5'],
  sunburst: ['M8 5.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2', 'M8 1.4a6.6 6.6 0 0 1 6.6 6.6M14.6 8A6.6 6.6 0 0 1 4 13.3M2.6 12A6.6 6.6 0 0 1 6.5 1.6'],
  bloom: ['M8 8C6 5 6.6 2 8 1.4C9.4 2 10 5 8 8M8 8c3-2 6-1.4 6.6 0C14 9.4 11 10 8 8M8 8c2 3 1.4 6 0 6.6C6.6 14 6 11 8 8M8 8C5 10 2 9.4 1.4 8C2 6.6 5 6 8 8'],
  stream: ['M1.5 6c2.5-2 4.5 1 6.5-.5S12 3 14.5 4.5', 'M1.5 9.5c2.5-1.5 4.5 1.5 6.5 0s4-2 6.5-.5', 'M1.5 12.5c2.5-1 5 .8 7 0s3.5-1.2 6-.5'],
  packed: ['M5.6 3.2a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8', 'M10.6 6.6a3 3 0 1 1 0 6a3 3 0 1 1 0-6', 'M4.6 9.6a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4'],
  bars: ['M8 8V1.6M8 8l4.6-3.2M8 8l3 4.8M8 8l-4.6 2.4M8 8L3.6 3.8'],
  spiral: ['M8 8.4a.6.6 0 1 1-.1-1.1c1.6.3 1.6 2.9-.4 3.1-2.6.2-3.4-3.4-1-4.7 3-1.6 6.2 1.3 4.9 4.4'],
};
// ---- The view's labels and hover card, as page text over the canvas ------------------------------------
const labelLayer = $('live-labels'), card = $('live-card'), labelPool = [];
const toPage = (x, y) => ({ x: Math.round(view.x + x * scale), y: Math.round(view.y + y * scale) });
function pageLabels(visible) {
  const list = visible ? live.labels : [];
  while (labelPool.length < list.length) { const span = document.createElement('span');labelLayer.append(span);labelPool.push(span); }
  labelPool.forEach((span, i) => {
    const l = list[i];
    if (!l) { if (!span.hidden) span.hidden = true;return; }
    const p = toPage(l.x, l.y), dx = l.align === 'right' ? '-100%' : l.align === 'center' ? '-50%' : '0';
    if (span.textContent !== l.text) span.textContent = l.text;
    span.hidden = false;span.classList.toggle('inside', !!l.inside);
    span.style.font = `${l.weight} ${Math.round(l.size * scale)}px var(--sans)`;
    // A label set along a ray wraps inside its band: a fixed width, at most its line count, then an ellipsis.
    span.classList.toggle('ray', !!l.box);
    span.style.width = l.box ? `${Math.round(l.box.width * scale)}px` : '';
    span.style.webkitLineClamp = l.box ? String(l.box.lines) : '';
    span.style.opacity = l.opacity.toFixed(2);
    span.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${l.angle.toFixed(4)}rad) translate(${dx}, -50%)`;
  });
  const h = visible ? live.hovered : null;
  card.hidden = !h;
  if (!h) return;
  const it = h.item, key = `${it.key}`;
  if (card.dataset.key !== key) {
    card.dataset.key = key;
    const colour = (hue, s = 52, l = 56) => toHex(hsla(((hue % 360) + 360) % 360, s, l));
    const title = document.createElement('div');title.className = 't';
    const dot = document.createElement('i');dot.style.background = colour(it.h, it.s, it.l);title.append(dot, it.card?.title ?? it.label[0]);
    const parts = [title];
    if (it.card) {
      const who = document.createElement('div');who.className = 'who';
      for (const p of it.card.people) { const span = document.createElement('span');span.className = p.here ? '' : 'away';const i = document.createElement('i');i.style.background = colour(p.hue);span.append(i, p.name);who.append(span); }
      parts.push(who);
    } else for (const line of it.label.slice(1)) { const d = document.createElement('div');d.className = 'd';d.textContent = line;parts.push(d); }
    card.replaceChildren(...parts);
  }
  const p = toPage(h.x, h.y), w = card.offsetWidth, ht = card.offsetHeight;
  card.style.transform = `translate(${Math.min(innerWidth - w - 12, p.x + 18)}px, ${Math.min(innerHeight - ht - 12, p.y + 16)}px)`;
}
const px = drawing.parameter(W * .7, { min: -1e4, max: 1e4 }), py = drawing.parameter(H * .3, { min: -1e4, max: 1e4 });
// Authored poses layered over the rig, each a 0–1 parameter animated by timeline clips.
const pose = Object.fromEntries(['point', 'awe', 'shade', 'duck', 'reach', 'throw'].map((k) => [k, drawing.parameter(0, { min: 0, max: 1 })]));

const FEET = { x: -.35, y: 0, z: 1.9 }, feet = projectPoint(camera, FEET), headAt = projectPoint(camera, { ...FEET, y: 1.3 });
const size = (feet.y - headAt.y) / 174;
// A cute build: a big head on a short torso, legs about half the height, so it reads as a
// character rather than a diagram. Pose targets below are measured from its shoulder.
const BUILD = { headR: 25, head: -132, neck: -109, shoulder: -103, hip: -66, upper: 23, fore: 22, thigh: 34, shin: 32, hand: [13, -64], foot: 9 };
const SH = BUILD.shoulder, ARM = BUILD.upper + BUILD.fore;
const hero = character(drawing, starter('stick-classic', { face: 'none', line: 4.5, build: BUILD, ink: toHex(hsla(30, 6, 22)), paper: toHex(hsla(42, 50, 97)) }), { x: feet.x, y: feet.y, size: size * 1.08, seed: 3, motionStyle: 'classic' });
hero.track(px, py, { reach: 900 });
/** Piecewise-smooth keyframes: [[t, value], …] sampled at t. */
const keyed = (t, keys) => { let i = 1;while (i < keys.length - 1 && t > keys[i][0]) i++;const [t0, a] = keys[i - 1], [t1, b] = keys[i], u = smooth(t0, t1, t);return a + (b - a) * u; };
/** Throw: fold a sheet at the chest, wind the arm back, release forward, follow through. */
const THROW = {
  fx: [[0, 4], [.32, 8], [.42, -26], [.62, -30], [.72, 42], [.86, 34], [1, 10]],
  fy: [[0, -88], [.32, -84], [.42, -132], [.62, -136], [.72, -118], [.86, -88], [1, -70]],
  bx: [[0, -4], [.32, -2], [.42, 20], [.62, 22], [.72, -12], [1, -10]],
  by: [[0, -86], [.32, -82], [.42, -98], [.62, -100], [.72, -80], [1, -70]],
  lean: [[0, 0], [.42, -.05], [.62, -.12], [.72, .14], [.86, .08], [1, 0]],
};
const THROW_RELEASE = .68;
hero.drive([px, py, pose.point, pose.awe, pose.shade, pose.duck, pose.reach, pose.throw], (x, y, p, a, sh, dk, rc, th, now, live) => {
  // Five layered poses on the stick rig. Point: the front arm toward what it watches. Awe: both
  // hands up beside the head. Shade: a hand over the brow, peering. Duck: crouch with hands over
  // the head as a plane skims past. Reach: on tiptoe, both arms up toward the flock.
  const k = live.size ?? size * 1.08, sx = live.root.x, sy = live.root.y + SH * k, dx = (x - sx) / k, dy = (y - sy) / k, d = Math.hypot(dx, dy) || 1;
  const toward = (len) => ({ x: dx / d * len, y: SH + dy / d * len }), aim = toward(ARM * .95), up = toward(ARM);
  const blendTo = (key, target, w) => (target - now[key]) * w;
  const tw = th > 0 && th < 1 ? Math.min(1, th / .08, (1 - th) / .12) : 0, tl = keyed(th, THROW.lean) * tw;
  const thrown = tw > 0 ? {
    'handF.x': blendTo('handF.x', keyed(th, THROW.fx), tw), 'handF.y': blendTo('handF.y', SH + 103 + keyed(th, THROW.fy), tw),
    'handB.x': blendTo('handB.x', keyed(th, THROW.bx), tw), 'handB.y': blendTo('handB.y', SH + 103 + keyed(th, THROW.by), tw),
  } : null;
  const base = {
    'handF.x': blendTo('handF.x', aim.x, p) + blendTo('handF.x', 20, a * (1 - p)) + blendTo('handF.x', 12, sh) + blendTo('handF.x', 8, dk) + blendTo('handF.x', up.x + 6, rc),
    'handF.y': blendTo('handF.y', aim.y, p) + blendTo('handF.y', SH - 34, a * (1 - p)) + blendTo('handF.y', BUILD.head + 4, sh) + blendTo('handF.y', BUILD.head - 18, dk) + blendTo('handF.y', up.y - 8, rc),
    'handB.x': blendTo('handB.x', -20, a) + blendTo('handB.x', -8, dk) + blendTo('handB.x', up.x - 10, rc),
    'handB.y': blendTo('handB.y', SH - 34, a) + blendTo('handB.y', BUILD.head - 16, dk) + blendTo('handB.y', up.y - 4, rc),
    'head.r': -.22 * a - .12 * sh + .3 * dk - .25 * rc, 'body.r': -.06 * a + .16 * dk + Math.max(-1, Math.min(1, dx / 800)) * .06 * (1 - dk),
    'body.y': 14 * dk - 6 * rc, 'body.sy': -.1 * dk + .04 * rc, // drive outputs are offsets from the solved pose
  };
  if (!thrown) return base;
  for (const key of Object.keys(thrown)) base[key] = base[key] * (1 - tw) + thrown[key];
  base['body.r'] += tl;base['head.r'] += tl * .6;
  return base;
});
const busy = new Map();
/** Story position past which the figure leaves the opening (see figureExit), and how it left. */
const FIG_EXIT = .78;
let exit = null;
/** Rise to 1, hold, fall; a new envelope on the same pose starts after the previous one ends. */
function envelope(parameter, time, hold, rise = .45, fall = .6) {
  const at = Math.max(time, busy.get(parameter) ?? 0);
  parameter.to(at, 1, { duration: rise }).to(at + rise + hold, 0, { duration: fall });
  busy.set(parameter, at + rise + hold + fall);
  return at;
}
/** The figure's day: seeded quiet moments, written as seekable clips, between reactions. */
const MOODS = ['wander', 'throw', 'shade', 'point', 'wander', 'awe', 'hop', 'throw', 'think', 'wander', 'reach', 'wave', 'shrug', 'wander', 'throw', 'nod', 'hop', 'awe'];
let pendingThrow = null;
let nextMood = 1.6, mood = 0, walkEnds = 0, lastDuck = -9;
/** Somewhere new to stand: a short stroll left or right, kept on the visible ground. */
function strollTarget(r) {
  const here = hero.inspect(player.time).root.x, lo = W * (room.tall ? .14 : .37), hi = W * (room.tall ? .55 : .6);
  const step = (70 + r * 130) * (r < .5 ? -1 : 1) * size;
  return Math.max(lo, Math.min(hi, here + step));
}
function direct(time) {
  if (story.value > .9 || exit) return;
  // React first: a plane skimming past the head makes the figure duck, then hop back up.
  const head = hero.inspect(time).root;
  for (let i = 0; i < flight.count && time - lastDuck > 3; i++) {
    const q = projectPoint(camera, { x: flight.p[i * 3], y: flight.p[i * 3 + 1], z: flight.p[i * 3 + 2] });
    if (Math.hypot(q.x - head.x, q.y - (head.y - 130 * size)) < 70 * size) { envelope(pose.duck, time, .35, .16, .45);lastDuck = time;nextMood = Math.max(nextMood, time + 1.6); }
  }
  if (time < nextMood || time < walkEnds) return;
  const r = (c) => randomAt(17, mood, c), kind = MOODS[mood % MOODS.length], hold = 1.1 + r(1) * 1.4;
  let busyFor = hold;
  if (kind === 'throw') { const at = Math.max(time, busy.get(pose.throw) ?? 0);pose.throw.to(at, 1, { duration: 1.9 }).to(at + 1.9, 0, { duration: .01 });busy.set(pose.throw, at + 1.95);pendingThrow = at + 1.9 * THROW_RELEASE;busyFor = 2.1; }
  else if (pose[kind]) envelope(pose[kind], time, hold, kind === 'awe' || kind === 'reach' ? .7 : .4, .6);
  else if (kind === 'wander') { walkEnds = hero.walkTo(strollTarget(r(2)), { at: time, speed: 60 + r(4) * 40 });busyFor = walkEnds - time; }
  else if (kind === 'hop') { hero.act('hop', { at: time, duration: .8 });busyFor = .9; }
  else hero.act(kind, { at: time, duration: kind === 'think' ? hold + 1 : 1.3 });
  mood++;nextMood = time + busyFor + .8 + r(3) * 1.6;
}

// ---- The word and the ribbon ------------------------------------------------------------------------
const fitWord = (() => { const s = Math.min(1, (W - 90) / 1180), ox = (W - 1180 * s) / 2 - 250 * s, oy = H * .5 - 480 * s;return (k) => ({ x: ox + k.x * s, y: oy + k.y * s }); })();
const stroke = strokeOf(KNOTS.map(fitWord)), BEAD = fitWord({ x: 1400, y: 560 });
// The dandelion's stem, as a stroke the ribbon can unfurl into.
const STEM = strokeOf(Array.from({ length: 16 }, (_, k) => { const u = k / 15, bx = HEAD.x - 70, by = 960, tx = HEAD.x - 10, ty = HEAD.y + HEAD.core * .6;
  const m = { x: bx + 14, y: (by + ty) / 2 }, x = (1 - u) ** 2 * bx + 2 * u * (1 - u) * m.x + u * u * tx, y = (1 - u) ** 2 * by + 2 * u * (1 - u) * m.y + u * u * ty;return { x: x * FIT.s, y: y * FIT.s + FIT.y }; }).reverse());
/** Unfurl one stroke into another along arc length, loops opening one after another. */
function unfurl(a, b, k) {
  const n = a.n, x = new Float32Array(n), y = new Float32Array(n), angle = new Float32Array(n);
  for (let j = 0; j < n; j++) { const e = smooth(0, 1, k * 1.6 - j / (n - 1) * .6);x[j] = mixN(a.x[j], b.x[j], e);y[j] = mixN(a.y[j], b.y[j], e); }
  for (let j = 0; j < n; j++) { const p = Math.max(j - 1, 0), q = Math.min(j + 1, n - 1);angle[j] = Math.atan2(y[q] - y[p], x[q] - x[p]); }
  return { ...a, x, y, angle, at: (u) => { const j = Math.round(Math.min(Math.max(u, 0), 1) * (n - 1));return { x: x[j], y: y[j], rotation: angle[j] }; } };
}
/** A paper roll at the ribbon's growing end: the strip unrolls from it as it travels. */
function paintRoll(ctx, at, r, alpha) {
  if (alpha <= 0 || r < 1) return;
  ctx.save();ctx.globalAlpha = alpha;ctx.translate(at.x, at.y);ctx.rotate(at.rotation);
  const g = ctx.createLinearGradient(0, -r, 0, r);g.addColorStop(0, hsla(100, 16, 70));g.addColorStop(.5, hsla(100, 16, 56));g.addColorStop(1, hsla(100, 18, 42));
  ctx.shadowColor = hsla(30, 30, 20, .25);ctx.shadowBlur = 8;ctx.shadowOffsetY = 4;
  ctx.fillStyle = g;ctx.beginPath();ctx.ellipse(0, 0, r * .55, r, 0, 0, 6.283);ctx.fill();ctx.shadowColor = 'transparent';
  ctx.strokeStyle = hsla(40, 30, 92, .8);ctx.lineWidth = 1;ctx.beginPath();
  for (let a = 0; a < 14; a += .2) { const rr = r * (1 - a / 16);ctx.lineTo(Math.cos(a) * rr * .5, Math.sin(a) * rr * .92); }
  ctx.stroke();ctx.restore();
}

// ---- The gather: planes fly to places on the stroke and settle there --------------------------------
const display = { ...flight, p: new Float64Array(flight.max * 3), v: new Float64Array(flight.max * 3), roll: new Float64Array(flight.max), size: new Float64Array(flight.max) };
Object.defineProperties(display, { count: { get: () => flight.count }, head: { get: () => flight.head } });
const fold = new Float32Array(flight.max).fill(1), fade = new Float32Array(flight.max).fill(1), shade = new Float32Array(flight.max).fill(1);
let places = null;
function onWall(s) { const ray = screenRay(camera, { x: s.x, y: s.y }), t = -ray.origin.z / ray.direction.z;return { x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t, z: 0 }; }
function gather(a) {
  const n = flight.count;
  display.p.set(flight.p);display.v.set(flight.v);display.roll.set(flight.roll);display.size.set(flight.size);fold.fill(1);fade.fill(1);shade.fill(1);
  if (a <= 0) { places = null;return; }
  if (!places || places.length !== n) {
    const sx = (i) => projectPoint(camera, { x: flight.p[i * 3], y: flight.p[i * 3 + 1], z: flight.p[i * 3 + 2] }).x;
    const order = [...Array(n).keys()].sort((i, j) => sx(i) - sx(j));
    places = new Float32Array(n);order.forEach((i, rank) => { places[i] = (rank + .5) / n * .97; });
  }
  const laid = smooth(.55, 1, a);
  for (let i = 0; i < n; i++) {
    const u = places[i], e = smooth(0, 1, a * 1.5 - u * .45), at = stroke.at(u), target = onWall(at);
    const dx = Math.cos(at.rotation), dy = -Math.sin(at.rotation), sp = Math.hypot(flight.v[i * 3], flight.v[i * 3 + 1], flight.v[i * 3 + 2]);
    for (let k = 0; k < 3; k++) display.p[i * 3 + k] += ([target.x, target.y, 0][k] - flight.p[i * 3 + k]) * e;
    const f = [flight.v[i * 3] / sp, flight.v[i * 3 + 1] / sp, flight.v[i * 3 + 2] / sp], g = [dx, dy, .001];
    for (let k = 0; k < 3; k++) display.v[i * 3 + k] = f[k] + (g[k] - f[k]) * e;
    const face = dx >= 0 ? -Math.PI / 2 : Math.PI / 2;display.roll[i] = flight.roll[i] + (face - flight.roll[i]) * e;
    fold[i] = 1 - smooth(.45, .95, e);display.size[i] = flight.size[i] * (1 - .5 * e);shade[i] = 1 - e;
    // Each plane fades as the roll passes its place: it has become part of the ribbon.
    fade[i] = 1 - smooth(u - .02, u + .04, laid);
  }
}

// ---- Live state for the later scenes ----------------------------------------------------------------
const air = createWind(), motes = createMotes(), clock = createClock(air), lift = createLift(), track = velocityTracker();
const gl = $('gl');
let three = null, threeLoading = null, hovered = -1, lastT = 0, gardenPointer = null, notice = '';
const trail = [], sprouts = [], gardenRipples = [];let sproutCount = 0;
/** Load Three.js and build the 3D stage only when the story approaches it. */
/**
 * Chapters and what each needs before it can play. The opening chapters ship with the page; the 3D
 * stage loads in the background from the first idle moment, and reports as each part is ready.
 */
const CHAPTERS = [
  { from: 0, to: 5.4, needs: [] },
  { from: 5.4, to: 8.55, needs: ['engine', 'city', 'garden'] },
  { from: 8.55, to: 9.9, needs: ['land', 'earth'] },
  { from: 9.9, to: 11.9, needs: ['earth'] },
  { from: LIVE[0], to: ROOM[0], needs: [] },
  { from: ROOM[0], to: RIVER[0], needs: ['room'] },
  { from: RIVER[0], to: RIVER[1], needs: ['river'] },
  { from: RIVER[1], to: 99, needs: [] },
];
const loaded = new Set(), loadedAt = { start: null };
const chapterReady = (s) => (CHAPTERS.find((c) => s >= c.from && s < c.to) ?? CHAPTERS.at(-1)).needs.every((n) => loaded.has(n));
let footageLoading = false;
let roomShot = null, riverShot = null;
/** The two recorded shots load as the reader nears the end of the live chapter. */
function prepareFootage() {
  if (footageLoading) return;
  footageLoading = true;
  import('./room-shot.js').then(({ createRoomShot }) => {
    roomShot = createRoomShot($('room-shot'), $('room-credit'), { grab: grabChart });
    player.refresh();
  }).catch(() => { $('room-shot').hidden = true; }).finally(() => { loaded.add('room');paintRail(); });
  import('./river-shot.js').then(({ createRiverShot }) => {
    riverShot = createRiverShot($('river-shot'), $('river-credit'));
    player.refresh();
  }).catch(() => { $('river-shot').hidden = true; }).finally(() => { loaded.add('river');paintRail(); });
}
/**
 * The live chart as it is on screen now, drawn into a square of `size` pixels: the ink canvas around the point,
 * and the labels the page sets as text. This is what hangs on the wall in the room.
 */
function grabChart(target, size) {
  const r = Math.max(40, liveRoom * scale) * 1.12, cx = innerWidth / 2, cy = innerHeight / 2, box = ink.getBoundingClientRect();
  if (!box.width) return;
  const k = ink.width / box.width;
  target.drawImage(ink, (cx - r - box.left) * k, (cy - r - box.top) * k, 2 * r * k, 2 * r * k, 0, 0, size, size);
  const into = size / (2 * r), colour = getComputedStyle(labelLayer).getPropertyValue('--label') || '#555';
  for (const l of live.labels) {
    if (l.opacity < .05 || l.box) continue;
    const p = toPage(l.x, l.y);
    target.save();target.globalAlpha = l.opacity;target.fillStyle = l.inside ? 'hsl(30 30% 98%)' : colour.trim() || '#555';
    target.font = `${l.weight} ${l.size * scale * into}px ui-sans-serif, -apple-system, sans-serif`;target.textBaseline = 'middle';
    target.textAlign = l.align === 'right' ? 'right' : l.align === 'center' ? 'center' : 'left';
    target.translate((p.x - cx + r) * into, (p.y - cy + r) * into);target.rotate(l.angle);target.fillText(l.text, 0, 0);target.restore();
  }
}
function ensureThree() {
  if (three || threeLoading) return;
  loadedAt.start = performance.now();
  threeLoading = createThreeStage(gl, { progress: (step) => { loaded.add(step);loadedAt[step] = performance.now();paintRail(); } }).then((st) => { three = st;three.setDark(theme.night);fit();if (new URLSearchParams(location.search).has('audit')) globalThis.explainerkitStage = st; }).catch((error) => { notice = `3D unavailable: ${error.message}`; });
}

// ---- Rendering: one projection per frame ----------------------------------------------------------
const ctx = ink.getContext('2d');
const measure = canvasTextMeasurer(ctx, { font: '500 13px ui-sans-serif, -apple-system, sans-serif', lineHeight: 18 });
const ripples = [];
let pointer = { active: false, x: 0, y: 0, z: 0 }, aim = { x: px.value, y: py.value }, wanted = { x: W * .7, y: H * .3 }, focusUntil = 0, scale = 1, ratio = 1;
const renderer = createCanvasRenderer(cast, { label: drawing.label, pixelRatio: Math.min(4, Math.max(1, Math.min(devicePixelRatio || 1, 2) * Math.min(innerWidth / room.fit[0], innerHeight / room.fit[1]))) });
// The 3D camera's journey, in metres: close on the garden, out over the city as it builds, then
// straight up — one camera, by `logZoom`, from a flower bed to the whole planet. Looking straight
// down at the end, it matches the Earth model's own camera, so the handover is seamless.
const ZOOM = [8.55, 9.9];
/** Far enough back that the whole island fits, whatever the viewport's shape. */
const gardenDistance = () => Math.max(30, 30 * 1.7 / Math.max(.4, innerWidth / innerHeight));
/** The garden sits right of centre, clear of the captions, on wide screens. */
const GARDEN_AIM = () => { const shift = innerWidth / innerHeight > 1.2 ? 5.5 : 0;return { x: -Math.cos(.75) * shift, y: 4, z: Math.sin(.75) * shift }; };
/**
 * The camera pose that puts the clay dandelion's head exactly where the painted one is, at the same
 * size: distance from the receptacle's apparent radius, target shifted so the head lands off-centre.
 */
let matchFix = { x: 0, y: 0, k: 1 }, continuity = null;
/**
 * The painted stem, cast into the 3D scene: each point of the 2D chain (base to tip, with the drawn
 * continuation below it) is projected onto the plane through the dandelion that faces the camera.
 */
function paintedStemInWorld(camera3, cam) {
  const P = clock.stem, art = [{ x: HEAD.x - 79, y: 1400 }, ...Array.from({ length: 12 }, (_, i) => ({ x: P.x[i], y: P.y[i] }))];
  const normal = { x: Math.sin(cam.heading) * Math.cos(cam.elevation), y: Math.sin(cam.elevation), z: Math.cos(cam.heading) * Math.cos(cam.elevation) };
  return art.map((a) => {
    const v = { x: view.x + a.x * FIT.s * scale, y: view.y + (a.y * FIT.s + FIT.y) * scale };
    return rayPlane(screenRay(camera3, v), { point: DANDELION_RECEPTACLE, normal })?.point ?? DANDELION_RECEPTACLE;
  });
}
/** The painted receptacle as a continuity anchor, in viewport pixels. */
function paintedHead() {
  const h = clock.head, c = HEAD.core, x = h.x + Math.sin(h.a) * c * .6, y = h.y - Math.cos(h.a) * c * .6;
  return { id: 'receptacle', x: view.x + x * FIT.s * scale, y: view.y + (y * FIT.s + FIT.y) * scale, size: c * .78 * FIT.s * scale, color: hsla(34, 12, 62) };
}
function dandelionMatch() {
  const fov = .62, heading = .75, elevation = .1, half = innerHeight / 2, t = Math.tan(fov / 2), painted = paintedHead();
  // The analytic match, refined by the continuity audit's measured correction.
  const hx = painted.x + matchFix.x, hy = painted.y + matchFix.y, rpx = HEAD.core * FIT.s * scale * matchFix.k;
  const distance = .34 * half / (rpx * t), m = distance * t / half, dx = (hx - innerWidth / 2) * m, dy = (hy - half) * m;
  const right = { x: Math.cos(heading), z: -Math.sin(heading) }, up = { x: -Math.sin(elevation) * Math.sin(heading), y: Math.cos(elevation), z: -Math.sin(elevation) * Math.cos(heading) }, h = DANDELION_HEAD;
  return { distance, heading, elevation, target: { x: h.x - right.x * dx + up.x * dy, y: h.y + up.y * dy, z: h.z - right.z * dx + up.z * dy } };
}
function cityCamera(s) {
  const pull = smooth(5.45, 6.35, s), out = smooth(6.6, 7.6, s), u = Math.min(1, Math.max(0, (s - ZOOM[0]) / (ZOOM[1] - ZOOM[0]))), z = u * u * (3 - 2 * u), turn = smooth(0, .3, z);
  // From the dandelion's head, where the 2D close-up ends, back to the whole garden around it.
  if (out <= 0) { const start = dandelionMatch();return { distance: logZoom(start.distance, gardenDistance(), pull), elevation: mixN(start.elevation, .4, pull), heading: start.heading, target: { x: mixN(start.target.x, GARDEN_AIM().x, pull), y: mixN(start.target.y, 4, pull), z: mixN(start.target.z, GARDEN_AIM().z, pull) }, fov: .62 }; }
  if (z <= 0) return { distance: logZoom(gardenDistance(), 1050, out), elevation: mixN(.4, .6, out), heading: mixN(.75, .79, out), target: { x: mixN(GARDEN_AIM().x, 0, out), y: mixN(4, 0, out), z: mixN(GARDEN_AIM().z, 0, out) }, fov: mixN(.62, .5, out) };
  return { distance: logZoom(1050, 4.8 * EARTH_R, z), elevation: mixN(.6, Math.PI / 2, turn), heading: mixN(.79, 0, turn), target: { x: 0, y: 0, z: 0 }, fov: mixN(.5, Math.PI / 6, z) };
}
/** How far the world has been drawn, by camera altitude: countryside, then region, then the globe. */
const span = (h, a, b) => Math.min(1, Math.max(0, Math.log(h / a) / Math.log(b / a)));
function revealFor(s, h) {
  return {
    outskirts: Math.max(s < 6.45 ? 0 : mixN(150, 900, smooth(6.9, 7.6, s)), h > 600 ? logZoom(900, 12900, span(h, 600, 2.4e4)) : 0),
    // The region is always drawn a little further out than the countryside, so no edge shows.
    region: h > 2000 ? Math.max(1.15 * logZoom(900, 12900, span(h, 600, 2.4e4)), logZoom(4000, 2.6e5, span(h, 3000, 4e5))) : 0,
    globe: h > 2e5 ? logZoom(250, 2.1e4, span(h, 2e5, 1.4e7)) : 0,
  };
}
/** The stage's top-left in viewport pixels; the 3D canvas covers the whole viewport. */
const view = { x: 0, y: 0 };
const fromView = (p) => ({ x: (p.x - view.x) / scale, y: (p.y - view.y) / scale });
const player = createProjectionPlayer(drawing, {
  project(frame, { time }) {
    const s = story.sample(time), dt = Math.max(0, Math.min(.05, time - lastT));lastT = time;
    renderer.render(frame);
    flight.to(time, { ...pointer, avoid: s > FLOCK[0] - .2 && s < RIVER[1] ? trunkInWorld() : [] });
    const a = smooth(1.3, 2.7, s), word = smooth(2.45, 2.75, s), back = smooth(FLOCK[0], FLOCK[1], s);
    gather(a * (1 - back));
    // Back from the ribbon, the planes fold in again over the river.
    if (s > FLOCK[0] - .05) for (let i = 0; i < flight.count; i++) { const j = smooth(FLOCK[0] + (i % 7) * .03, FLOCK[0] + .12 + (i % 7) * .03, s);fade[i] *= j;fold[i] = Math.min(fold[i], j); }
    // Before its birth a plane is not there yet; it appears as a sheet just before it folds.
    for (let i = 1; i < flight.count; i++) { const j = smooth(flight.born[i] - .3, flight.born[i], time);fade[i] *= j;shade[i] *= j; }
    const root = hero.inspect(time).root, present = figureExit(s, time, root);
    painter.paint(display, { split: feet.cameraDepth, ripples, time, fold, fade, shadow: shade, trails: Math.max(1 - smooth(.9, 1.8, s), .7 * back), ground: { x: root.x + 3, y: root.y + 2, w: 40 * size, alpha: present * smooth(.4, 1.1, time) } });
    cast.style.opacity = present * smooth(.4, 1.1, time); // the figure joins just after the first planes

    ctx.setTransform(1, 0, 0, 1, 0, 0);ctx.clearRect(0, 0, ink.width, ink.height);
    const k = scale * ratio;ctx.setTransform(k, 0, 0, k, view.x * ratio, view.y * ratio);
    // Story beats, as progress in [0, 1].
    const reveal = smooth(.55, 1, a), toStem = smooth(3.3, 3.95, s), bloom = smooth(3.8, 4.45, s), blow = smooth(5.0, 5.45, s);
    const grow = s > 5.75 ? (s - 5.75) * 6 : -1, cut = smooth(10.05, 10.55, s), rings = smooth(10.6, 11.25, s), close = smooth(11.25, 11.75, s);
    if (s > 3.6) ensureThree(); // in case the idle start has not come yet

    // The sheet being folded, in the figure's hands until it is thrown.
    const th = pose.throw.sample(time);
    if (th > .02 && th < THROW_RELEASE && s < .9) {
      const hand = handAt(time), folded = smooth(.05, .32, th), size = 16 * (1 - .45 * folded);
      ctx.save();ctx.translate(hand.x, hand.y - 4);ctx.rotate(-.4 - folded * .5);ctx.fillStyle = hsla(42, 40, 95);ctx.strokeStyle = hsla(30, 10, 60);ctx.lineWidth = 1;
      ctx.beginPath();ctx.moveTo(-size, -size * (1 - folded) * .8);ctx.lineTo(size, 0);ctx.lineTo(-size, size * (1 - folded * .6) * .8);ctx.lineTo(-size * .6, 0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    // 2 · The ribbon, unrolled by a paper roll, then unfurling into the dandelion's stem.
    if (reveal > 0 && toStem < 1) {
      const shape = toStem > 0 ? unfurl(stroke, STEM, toStem) : stroke;
      paintRibbon(ctx, shape, { reveal, t: time * (1 - toStem), handles: 0, alpha: 1 - smooth(.85, 1, toStem) });
      paintRoll(ctx, shape.at(reveal), 22 * (1 - reveal) + 3, reveal < 1 ? 1 : 0);
      if (bloom < 1) paintBead(ctx, shape, { x: mixN(BEAD.x, HEAD.x * FIT.s + 60, toStem), y: mixN(BEAD.y, HEAD.y * FIT.s + FIT.y, toStem), r: 12 }, { alpha: word * (1 - bloom), reveal });
    }
    // 3 · The dandelion: the pointer's air moves the seeds; the scroll gust carries them off.
    const clockAlpha = smooth(3.85, 4.0, s) * (1 - smooth(5.35, 5.75, s));
    if (clockAlpha > 0) {
      air.step(dt);clock.step(dt, time, { gust: blow });
      ctx.save();ctx.translate(0, FIT.y);ctx.scale(FIT.s, FIT.s);
      motes.step(dt, time, air);paintMotes(ctx, motes, { alpha: clockAlpha * bloom });
      // Below its pinned base the stem simply continues to the ground, past any viewport's edge.
      ctx.save();ctx.globalAlpha = clockAlpha;ctx.lineCap = 'butt';
      for (const [w, c, ox] of [[40, hsla(96, 21, 42), 3], [34, hsla(94, 22, 52), 0], [14, hsla(92, 25, 64, .7), -8], [3, hsla(90, 27, 76, .5), -12]]) { ctx.strokeStyle = c;ctx.lineWidth = w;ctx.beginPath();ctx.moveTo(HEAD.x - 70 + ox * .5, 978);ctx.lineTo(HEAD.x - 104 + ox * .5, 2600);ctx.stroke(); }
      ctx.restore();
      paintClock(ctx, clock, { t: time, blow, bloom, alpha: clockAlpha, hideHero: false });
      ctx.restore();
    }
    // 4–6 · Garden, city, countryside, region and globe in 3D, on one camera.
    // The 3D stage runs from the dandelion to the closed rings; the 2D live point takes over from the core.
    const threeAlpha = s > 5.3 && s < LIVE[0] ? 1 : 0;
    if (three && threeAlpha > 0 && s < ZOOM[1]) {
      const cam = cityCamera(s), h = Math.sin(cam.elevation) * cam.distance + cam.target.y;
      three.setCamera(cam);
      // While the painted and the clay dandelion overlap, audit the handover and correct the camera.
      if (s > 5.25 && s < 5.8) {
        const q = three.look(DANDELION_RECEPTACLE), top = three.look({ ...DANDELION_RECEPTACLE, y: DANDELION_RECEPTACLE.y + .29 });
        continuity = auditHandover({ at: time, viewport: { width: innerWidth, height: innerHeight }, from: [paintedHead()], to: [{ id: 'receptacle', x: q.x, y: q.y, size: Math.hypot(top.x - q.x, top.y - q.y), color: hsla(34, 12, 64) }] });
        const fix = continuity.checks[0];
        if (fix) { matchFix = { x: matchFix.x + fix.shift.x * -.5, y: matchFix.y + fix.shift.y * -.5, k: matchFix.k * Math.sqrt(paintedHead().size / Math.max(1e-3, Math.hypot(top.x - q.x, top.y - q.y))) };three.setCamera(cityCamera(s)); }
      }
      // The clay stem takes the painted stem's shape, then springs back to its own as the camera retreats.
      const w = 1 - smooth(5.5, 6.05, s);
      three.bendDandelion(w > 0 ? paintedStemInWorld(three.camera(), cam) : null, w);
      const away = 1 - smooth(2.5e4, 6e4, h), cityAlpha = s > 6.4 ? away : 0, gardenAlpha = away;
      three.lifts.forEach((param, id) => param.override(lift.value(id, time)));
      three.progress.override(smooth(7.6, 8.5, s));
      three.renderCity({ time, cityAlpha, gardenAlpha, island: smooth(5.4, 6.0, s), build: smooth(6.45, 7.5, s), grow, pointer: gardenPointer, ripples: gardenRipples, sprouts, reveal: revealFor(s, h) });
    }
    // 7 · The Earth model itself: cut open to its core; its layers become rings that close to a point.
    if (three && threeAlpha > 0 && s >= ZOOM[1]) three.renderEarth({ time, spin: (s - ZOOM[1]) * .25, cut, rings, close, distance: 58 });
    gl.style.opacity = threeAlpha;
    // City overlay: labels that keep clear of each other, and the marker seen through buildings.
    const labelAlpha = smooth(7.5, 7.8, s) * (1 - smooth(8.45, 8.65, s));
    if (three && labelAlpha > 0) paintCityOverlay(three, labelAlpha);
    // 8 · The live point: the core's twin, at its exact projected place and size, now driven by inputs.
    if (s < LIVE[0] - .02 && labelPool.length) pageLabels(false);
    if (s >= LIVE[0] - .02) {
      const r = .6 / (58 * Math.tan(Math.PI / 12)) * (innerHeight / 2) / scale, at = fromView({ x: innerWidth / 2, y: innerHeight / 2 });
      if (!(livePlaced++ % 12)) placeLive();    // the chip and caption settle after the chapter changes: re-measure now and then
      livePoint = { at, r };
      liveRoom += (liveLayout.room - liveRoom) * (liveRoom ? Math.min(1, dt * 3) : 1);
      live.paint(ctx, { at, r, time, dt, view: liveLayout.view, room: liveRoom, keep: liveLayout.keep, retract: liveRetract(s), alpha: 1 - smooth(RIVER[0] - .1, RIVER[0] + .05, s), brandMix: smooth(LIVE[0] + .05, LIVE[0] + .45, s) });
      pageLabels(true);
    }
    // 9 · Recorded footage: the chart hangs on a real wall, then a real river carries paper boats.
    const centre = { x: innerWidth / 2, y: innerHeight / 2 };
    const roomCover = roomShot ? roomShot.project((s - ROOM[0]) / (ROOM[1] - ROOM[0]), time, { ...centre, r: Math.max(40, liveRoom * scale) }) : 0;
    const riverCover = riverShot ? riverShot.project((s - RIVER[0]) / (RIVER[1] - RIVER[0]), time, { wipe: roomShot?.pillar ?? ['hsl(190 36% 40%)', 'hsl(195 46% 27%)'], point: centre }) : 0;
    const footage = (s > ROOM[0] && s < RIVER[1]) && (roomCover > 0 || riverCover > 0);
    if (labelLayer.style.visibility !== (footage ? 'hidden' : '')) labelLayer.style.visibility = footage ? 'hidden' : '';
    document.documentElement.classList.toggle('on-footage', s > ROOM[0] + .2 && s < RIVER[1] - .2);
    if (notice) { ctx.fillStyle = surface(30, 20, 40);ctx.font = '13px ui-sans-serif, sans-serif';ctx.fillText(notice, 32 * FIT.s, H - 140); }
  },
});

/**
 * Labels for named places, placed by the library so none overlap each other, the marker, the
 * caption or the code chip. A ray test from the camera finds the marker when a building hides it;
 * it is then drawn through the building as a ring, and its label says what is in the way.
 */
function paintCityOverlay(st, alpha) {
  const progress = smooth(7.6, 8.5, story.value), q = ROUTE.sample(progress), seen = (p) => { const l = st.look(p);return { ...l, ...fromView(l) }; }, marker = seen(planToWorld(q.x, q.y, 10));
  const box = (el) => { const r = el.getBoundingClientRect(), a = fromView({ x: r.left - 24, y: r.top - 24 }), b = fromView({ x: r.right + 24, y: r.bottom + 24 });return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }; };
  const obstacles = [{ x: marker.x - 26, y: marker.y - 50, width: 52, height: 60 }, box(document.querySelector('[data-caption="city"]')), box(document.querySelector('.chip')), box($('rail'))];
  const anchors = PLACES.map((p) => ({ ...p, at: seen(p.anchor) })).filter((p) => p.at.visible);
  let boxes = [];
  try { boxes = placeLabels(anchors.map((p) => ({ id: p.name, text: p.name, anchor: { x: p.at.x, y: p.at.y } })), { bounds: { x: Math.max(8, -view.x / scale + 8), y: Math.max(8, -view.y / scale + 8), width: Math.min(W, innerWidth / scale) - 16, height: Math.min(H, innerHeight / scale) - 16 }, measure, obstacles, gap: 8 }); } catch { boxes = []; }
  ctx.save();ctx.globalAlpha = alpha;ctx.font = '500 13px ui-sans-serif, -apple-system, sans-serif';ctx.textBaseline = 'middle';
  for (const box of boxes) {
    const p = anchors.find((a) => a.name === box.id), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    ctx.strokeStyle = surface(30, 12, 40, p.at.hidden ? .3 : .55);ctx.setLineDash(p.at.hidden ? [3, 3] : []);ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(p.at.x, p.at.y);ctx.lineTo(cx, cy);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle = surface(42, 60, 98, .92);ctx.beginPath();ctx.roundRect(box.x - 7, box.y - 3, box.width + 14, box.height + 6, 9);ctx.fill();
    ctx.fillStyle = surface(30, 12, 26, p.at.hidden ? .55 : 1);ctx.fillText(box.id, box.x, cy);
    ctx.fillStyle = surface(30, 12, 40);ctx.beginPath();ctx.arc(p.at.x, p.at.y, 2.5, 0, 6.283);ctx.fill();
  }
  if (marker.hidden) {
    // Occlusion: the pin is behind a building, so draw its outline through the wall.
    ctx.strokeStyle = brandHsla(0, .9);ctx.lineWidth = 2;ctx.setLineDash([4, 3]);ctx.beginPath();ctx.arc(marker.x, marker.y - 14, 13, 0, 6.283);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle = brandHsla(0, .95);ctx.font = '12px ui-monospace, Menlo, monospace';ctx.fillText(`hidden by ${marker.by}`, marker.x + 20, marker.y - 14);
  }
  ctx.restore();
}

// The headline is set by the same clock: letters settle like paper landing, then the line follows.
const title = kineticText(document.querySelector('.title h1'), { split: 'graphemes' });
title.bind(drawing, { player, at: .25, duration: 1.1, stagger: .032, from: { y: -34, rotation: -.6, scale: .9, opacity: 0 } });
// kineticText splits into plain tokens, so mark the emphasised word's tokens again (until explainerkit/emphasis exists).
{
  const tokens = [...document.querySelectorAll('.title h1 [data-explainerkit-kinetic] [data-explainerkit-token]')], textAll = tokens.map((t) => t.textContent).join(''), at = textAll.indexOf('frame');
  let offset = 0;
  for (const t of tokens) { if (offset >= at && offset < at + 5) t.classList.add('focus');offset += t.textContent.length; }
}
const lede = kineticText(document.querySelector('.title p'), { split: 'words' });
lede.bind(drawing, { player, at: 1, duration: .8, stagger: .045, from: { y: 10, opacity: 0 } });
// Captions follow the story parameter through the DOM adapter.
const BEATS = [['ribbon', 2.4, 3.35], ['dandelion', 4.3, 5.05], ['garden', 5.95, 6.65], ['city', 7.55, 8.5], ['earth', 8.75, 9.9], ['rings', 10.1, 11.5], ['live', 12.05, 13.65], ['room', ROOM[0] + 1.12, ROOM[0] + 1.66], ['river', RIVER[0] + .3, RIVER[0] + 1.32]];
bindDOM(drawing, [
  { element: document.querySelector('.title'), inputs: [story], map: (s) => ({ y: -60 * smooth(.6, 1.3, s), opacity: 1 - smooth(.6, 1.2, s) }) },
  ...BEATS.map(([id, from, to]) => ({ element: document.querySelector(`[data-caption="${id}"]`), inputs: [story], map: (s) => ({ y: 24 * (1 - smooth(from, from + .3, s)), opacity: smooth(from, from + .3, s) * (1 - smooth(to - .2, to, s)) }) })),
  { element: document.querySelector('.start'), inputs: [story], map: (s) => ({ y: 40 * (1 - smooth(RIVER[1] - .05, RIVER[1] + .3, s)), opacity: smooth(RIVER[1] - .05, RIVER[1] + .3, s) }) },
], { player });

/** Where the figure's throwing hand is, in stage pixels. */
function handAt(time) { const f = hero.inspect(time), k = f.root.scaleX;return { x: f.root.x + f.pose['handF.x'] * k, y: f.root.y + f.pose['handF.y'] * Math.abs(f.root.scaleY) }; }
/** Release: a new plane leaves the hand, nose up and away from the figure. */
function throwPlane(time) {
  if (story.value > .9) return;
  const hand = handAt(time), dir = Math.sign(hero.inspect(time).root.scaleX) || 1;
  flight.launch({ ...toWorld(hand), vx: 1.5 * dir, vy: .55, vz: -.35 });
  wanted = { x: hand.x + 300 * dir, y: hand.y - 220 };focusUntil = time + 1.2;
}
// ---- Attention, once per animation frame, outside the frame callback --------------------------------
function attend() {
  const time = player.time;
  if (!pointer.active && time > focusUntil) { const lead = projectPoint(camera, { x: flight.p[0], y: flight.p[1], z: flight.p[2] });wanted = { x: lead.x, y: lead.y }; }
  aim = { x: aim.x + (wanted.x - aim.x) * .1, y: aim.y + (wanted.y - aim.y) * .1 };
  px.override(aim.x);py.override(aim.y);
  direct(time);
  if (pendingThrow !== null && time >= pendingThrow) { pendingThrow = null;throwPlane(time); }
  if (player.playing) requestAnimationFrame(attend);
}
player.on('play', () => requestAnimationFrame(attend));

// ---- Input ---------------------------------------------------------------------------------------
function toStage(e) { const r = stage.getBoundingClientRect();return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
/** The river's tree trunk as an upright obstacle for the flock, where the 3D view sees it on screen. */
function trunkInWorld() {
  const box = riverShot?.trunk();if (!box) return [];
  const r = stage.getBoundingClientRect(), at = (x) => toWorld({ x: (x - r.left) / r.width * W, y: (box.y - r.top) / r.height * H });
  const left = at(box.x0), right = at(box.x1);
  return [{ x: (left.x + right.x) / 2, z: .2, r: Math.abs(right.x - left.x) / 2 }];
}
function toWorld(s) { const ray = screenRay(camera, { x: s.x, y: s.y }), t = (.2 - ray.origin.z) / ray.direction.z;return { x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t, z: .2 }; }
const between = (a, b) => story.value > a && story.value < b;
/** The building under a stage point: the nearest box the camera ray hits. */
function pickBoundsAt(cam, v) { return pickBounds(screenRay(cam, { x: v.x, y: v.y }), three.boxes)?.id ?? null; }
/** The island-top point under a viewport point, by a ray from the 3D camera. */
function onIsland(v) { const cam = three?.camera();if (!cam) return null;const hit = rayPlane(screenRay(cam, { x: v.x, y: v.y }), { point: { x: 0, y: three.ISLAND_TOP, z: 0 }, normal: { x: 0, y: 1, z: 0 } });return hit?.point ?? null; }
stage.addEventListener('pointermove', (e) => {
  const s = toStage(e), now = e.timeStamp / 1000, v = track.add(now, s).sample();
  if (between(3.9, 5.4)) { const a = toArt(s);air.splat(a.x, a.y, v.x / FIT.s, v.y / FIT.s); }
  if (between(5.85, 6.7) && three) {
    // The pointer's path across the island; candidates are spaced along it by arc length, and each
    // is planted only if the garden's density budget allows it there.
    const p = onIsland({ x: e.clientX, y: e.clientY });gardenPointer = p;
    if (p) {
      trail.push({ x: p.x, z: p.z, t: player.time });while (trail.length && player.time - trail[0].t > 1.5) trail.shift();
      if (trail.length > 2 && sprouts.length < 48) {
        const along = points({ along: [['M', trail[0].x, trail[0].z], ...trail.slice(1).map((q) => ['L', q.x, q.z])], spacing: 1.2, seed: 5 });
        for (let n = 0; n < along.count && sprouts.length < 48; n++) {
          const x = along.x[n], z = along.y[n], kind = three.plantable(x, z, sprouts, sproutCount);
          if (kind) sprouts.push({ x, y: three.ISLAND_TOP, z, t: player.time, k: sproutCount++, kind });
        }
      }
    }
  }
  if (between(7.4, 8.5) && three) {
    // Hovering a building raises it on a spring: the ray finds the building under the pointer.
    const cam = three.camera(), hit = cam && pickBoundsAt(cam, { x: e.clientX, y: e.clientY });
    const best = hit ? Number(hit.slice(1)) : -1;
    if (best !== hovered) { if (hovered >= 0) lift.leave(hovered, player.time);if (best >= 0) lift.hover(best, player.time);hovered = best; }
  }
  if (story.value > .9 && story.value < FLOCK[0]) return;
  pointer = { active: true, ...toWorld(s) };
  if (player.time > focusUntil) wanted = s;
});
stage.addEventListener('pointerleave', () => { pointer = { ...pointer, active: false }; });
stage.addEventListener('pointerdown', (e) => {
  const s = toStage(e), time = player.time;
  if (between(5.85, 6.7)) { const p = onIsland({ x: e.clientX, y: e.clientY });if (p) gardenRipples.push({ x: p.x, z: p.z, t: time });if (gardenRipples.length > 5) gardenRipples.shift();return; }
  if (story.value > .9 && story.value < FLOCK[0]) return;
  // A tap folds a new plane out of a sheet where you tapped; the figure cheers.
  flight.launch({ ...toWorld(s), vx: 1.2, vy: .15, vz: -.3 });
  ripples.push({ x: s.x, y: s.y, at: time });if (ripples.length > 6) ripples.shift();
  wanted = s;focusUntil = time + 1.4;hero.act('cheer', { at: time + .1, duration: 1.3 });nextMood = Math.max(nextMood, time + 2.4);
  $('hint').classList.add('done');
});

// ---- SVG import: drop a file, or try the sample, while the garden is on stage ----------------------
const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">
  <path id="stem" d="M58 138 C56 110 62 92 60 70 L64 70 C66 92 60 110 62 138 Z" fill="#7f9a6c"/>
  <path id="leaf-left" d="M59 112 C40 108 24 92 22 76 C38 80 54 92 59 112 Z" fill="#9fb38f"/>
  <path id="leaf-right" d="M63 98 C80 96 96 82 100 66 C84 68 68 80 63 98 Z" fill="#8aa678"/>
  <circle id="petal-1" cx="62" cy="34" r="17" fill="#f2c9b2"/><circle id="petal-2" cx="80" cy="48" r="17" fill="#efc0a6"/>
  <circle id="petal-3" cx="74" cy="68" r="17" fill="#f4d0bc"/><circle id="petal-4" cx="50" cy="68" r="17" fill="#eec3aa"/>
  <circle id="petal-5" cx="44" cy="48" r="17" fill="#f1cab6"/><circle id="heart" cx="62" cy="52" r="11" fill="#e2583c"/>
</svg>`;
function plantSVG(asset) {
  if (!three) return;
  try { three.addSVG(asset, player.time);notice = ''; } catch (error) { notice = `That SVG can't be extruded: ${error.capability ?? error.code ?? error.message}`; }
}
$('sample').addEventListener('click', () => plantSVG(importSVG(SAMPLE_SVG)));
stage.addEventListener('dragover', (e) => { if (between(5.85, 6.7)) e.preventDefault(); });
stage.addEventListener('drop', async (e) => {
  if (!between(5.85, 6.7)) return;
  e.preventDefault();
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type === 'image/svg+xml' || f.name.endsWith('.svg'));
  if (!file) { notice = 'Drop an .svg file.';return; }
  try { plantSVG(await importSVGFile(file, { maxBytes: 400000 })); } catch (error) { notice = `Couldn't import: ${error.code ?? error.message}`; }
});

// ---- Scroll, chip and rail -------------------------------------------------------------------------
/** Code chips by story position; `tint` (light page) and `night` (dark page) colour the imported names in the chapter's secondary colour. */
const CHIPS = [
  { from: 0, tint: 'hsl(30 8% 30%)', night: 'hsl(36 30% 74%)', code: "import { character, starter } from '⟨explainerkit/characters⟩';\n\nconst hero = character(drawing, starter('stick-classic'));\nhero.act('cheer', { at, duration: 1.3 });" },
  { from: 1.2, tint: 'hsl(100 26% 36%)', night: 'hsl(28 62% 64%)', code: "import { measurePath } from '⟨explainerkit/geometry⟩';\n\nconst stroke = measurePath(commands);\nconst { x, y, rotation } = stroke.at(progress);" },
  { from: 3.4, tint: 'hsl(36 72% 38%)', night: 'hsl(40 70% 64%)', code: "import { velocityTracker } from '⟨explainerkit/physics⟩';\nimport { noiseVectorField } from '⟨explainerkit/noise⟩';\n\nconst breeze = noiseVectorField({ seed, octaves: 2 });" },
  { from: 5.5, tint: 'hsl(118 34% 34%)', night: 'hsl(22 64% 66%)', code: "import { points } from '⟨explainerkit/procedural⟩';\nimport { importSVG } from '⟨explainerkit/import/svg⟩';\n\nconst bed = points({ in: island, method: 'poisson', minDistance: 1.15 });" },
  { from: 6.8, tint: 'hsl(205 34% 40%)', night: 'hsl(34 44% 70%)', code: "import { createThreeAdapter } from '⟨explainerkit/renderers/three⟩';\n\nconst three = createThreeAdapter({ THREE, shadows: true });\nthree.update(city.sampleWorld({ time }), { camera });" },
  { from: 7.5, tint: 'hsl(205 34% 40%)', night: 'hsl(34 44% 70%)', code: "import { placeLabels } from '⟨explainerkit/layout/labels⟩';\nimport { pickBounds, screenRay } from '⟨explainerkit/spatial⟩';\n\nconst hidden = pickBounds(screenRay(camera, point), buildings);" },
  { from: 8.9, tint: 'hsl(92 32% 34%)', night: 'hsl(30 66% 62%)', code: "import { logZoom } from '⟨explainerkit/zoom⟩';\n\nconst altitude = logZoom(30, 3e7, progress); // metres" },
  { from: 9.95, tint: 'hsl(16 70% 46%)', night: 'hsl(16 70% 64%)', code: "import { stagger } from '⟨explainerkit/motion⟩';\n\nconst close = stagger([0, .45], { from: 'first' });" },
  { from: 11.95, tint: 'hsl(284 46% 46%)', night: 'hsl(284 50% 72%)', code: "import { dragInput, fileInput, microphoneInput, bindData } from '⟨explainerkit/inputs⟩';\n\nconst rows = drawing.data([], { key: 'id' });\nbindData(rows, fileInput(stage), { map: ({ value }) => chart(value.rows) });" },
  { from: ROOM[0], tint: 'hsl(326 53% 42%)', night: 'hsl(182 55% 73%)', code: "import { projectPoint, screenRay, rayPlane } from '⟨explainerkit/spatial⟩';\n\nconst at = projectPoint(roomCamera(frame), cornerOnWall);\nconst tap = rayPlane(screenRay(roomCamera(frame), pointer), tabletop);" },
  { from: RIVER[0], tint: 'hsl(200 70% 34%)', night: 'hsl(190 70% 72%)', code: "import { compileFlow, flowStreaks, traceFlow } from '⟨explainerkit/vfx⟩';\n\nconst field = compileFlow(measured);\nconst boat = traceFlow(field, { x, y }, { duration: 14 });" },
  { from: RIVER[1], tint: 'var(--accent)', night: 'var(--accent)', code: "import { scene } from '⟨explainerkit⟩';\n\nconst drawing = scene({ width: 640, height: 360 });\ndrawing.circle({ x: 320, y: 180, r: 8 });" },
];
const code = document.querySelector('.chip code'), rail = $('rail'), TICKS = 28;
rail.replaceChildren(...Array.from({ length: TICKS }, (_, i) => { const tick = document.createElement('i');tick.style.setProperty('--k', i);return tick; }));
/** The rail: position, chapter marks, and a soft shimmer on chapters still loading. */
function paintRail() {
  const s = story.value, at = Math.round(Math.min(1, s / STORY_END) * (TICKS - 1));
  let busy = false;
  [...rail.children].forEach((d, i) => {
    const pending = !chapterReady(i / (TICKS - 1) * STORY_END);busy ||= pending;
    d.classList.toggle('on', i === at);d.classList.toggle('major', i !== at && CHIPS.some((c) => Math.round(c.from / STORY_END * (TICKS - 1)) === i));d.classList.toggle('pending', pending);
  });
  rail.setAttribute('aria-busy', String(busy));
}
let chip = -1;
/**
 * Colour-code a chip: the module path in the accent, the imported names (wherever they appear) in the chapter's
 * tint, comments grey and quiet; everything else plain ink.
 */
function showCode(source, tint) {
  const names = [...source.matchAll(/import\s*\{([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((n) => n.trim()).filter(Boolean));
  const name = names.length ? `\\b(?:${names.join('|')})\\b` : '(?!)';
  code.style.setProperty('--tint', tint ?? 'var(--ink)');
  code.replaceChildren(...source.split(new RegExp(`(⟨[^⟩]+⟩|//[^\\n]*|${name})`)).filter(Boolean).map((part) => {
    const kind = part.startsWith('⟨') ? 'fn' : part.startsWith('//') ? 'note' : names.includes(part) ? 'name' : null;
    if (!kind) return document.createTextNode(part);
    const span = document.createElement('span');span.className = kind;span.textContent = kind === 'fn' ? part.slice(1, -1) : part;return span;
  }));
}
const STORY_END = END;
/** Screen heights of scroll per story unit: every beat gets room to breathe. */
const PACE = 2.2;
// ---- The reader's pace, and arriving part-way ---------------------------------------------------------
// Pace (scroll velocity) never changes what a position shows; it chooses how the figure leaves and starts the
// 3D stage early when the reader heads down fast. A page opened part-way (a reload, back/forward) replays the
// current chapter in, held at its start until its parts have loaded, instead of snapping into the middle.
const pace = scrollPace({ viewportHeight: innerHeight }), opened = performance.now();
let arrival = null, readerTouched = false;
for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) addEventListener(name, () => { readerTouched = true;if (arrival) arrival.done = true; }, { passive: true });
function offerArrival(s) {
  if (arrival || readerTouched || s < .3 || performance.now() - opened > 1500) return;
  arrival = { plan: arrivalPlan({ mode: 'chapter', time: s, duration: STORY_MAX, chapters: CHAPTERS.map((c) => c.from).filter((t) => t < STORY_MAX) }), elapsed: 0, last: null, done: stillMotion.matches };
  ensureThree();
  requestAnimationFrame(arriving);
}
/** The story position to show now: the arrival's replay while it runs, else the reader's own. */
function storyAt(target) {
  if (!arrival || arrival.done) return target;
  const now = performance.now();
  if (arrival.last === null && !chapterReady(arrival.plan.to) && now - opened < 4000) return arrival.plan.from;
  // Frame steps of at most 50 ms, so the 3D build's long task does not swallow the replay.
  arrival.elapsed += arrival.last === null ? 0 : Math.min(now - arrival.last, 50) / 1000;
  arrival.last = now;
  if (arrival.elapsed >= arrival.plan.seconds) arrival.done = true;
  return arrivalTime(arrival.plan, Math.min(arrival.elapsed, arrival.plan.seconds), target);
}
function arriving() {
  story.set(storyAt(Math.min(scrollY / (innerHeight * PACE), STORY_MAX)));
  if (arrival && !arrival.done) requestAnimationFrame(arriving);
}
// The figure leaves the opening on foot: past FIG_EXIT it walks off the nearer edge, and walks home if the reader
// scrolls back. Rushing past (or with reduced motion), it fades with the scroll instead.
function figureExit(s, time, root) {
  if (s > FIG_EXIT && !exit) {
    const rushed = pace.sample(performance.now()).pace === 'rushing' || stillMotion.matches || s > 1.4;
    const left = fromView({ x: 0, y: 0 }).x, right = fromView({ x: innerWidth, y: 0 }).x;
    exit = { rushed, home: root.x };
    if (!rushed) hero.walkTo(root.x - left < right - root.x ? Math.max(left, 0) - 140 * size : Math.min(right, W) + 140 * size, { at: time, speed: 150 });
  } else if (s < FIG_EXIT - .08 && exit) {
    if (!exit.rushed) hero.walkTo(exit.home, { at: time, speed: 150 });
    exit = null;
  }
  if (!exit || exit.rushed) return 1 - smooth(.9, 1.6, s);
  // On foot: fully there until it reaches the stage's edge, then gone past it (the cast layer ends there).
  const edge = Math.min(root.x, W - root.x);
  return smooth(-90 * size, 30 * size, edge) * (1 - smooth(2.2, 2.6, s));
}
function onScroll() {
  const s = scrollY / (innerHeight * PACE), reading = pace.add(scrollY, performance.now());
  if (s > LIVE[1] - 1.2) prepareFootage();
  if (reading.direction > 0 && (reading.pace === 'skimming' || reading.pace === 'rushing')) ensureThree();
  offerArrival(s);
  document.documentElement.classList.toggle('scrolled', s > .04);
  story.set(storyAt(Math.min(s, STORY_MAX)));
  const inLive = s > LIVE[0] - .05 && s < LIVE[1] + .05;
  if (inLive) live.enter(); else live.leave();
  const showLive = s > LIVE[0] + .1 && s < LIVE[1] - .2;
  if (liveBox.hidden === showLive) { liveBox.hidden = !showLive;if (!showLive) openLive(false); }
  if (!showLive) { document.documentElement.classList.remove('live-full');$('live-caption').hidden = true; }
  if (showLive) placeLive();
  // Nobody let the ghost file go: a little way into the chapter it drops by itself, so every reader sees the data.
  if (s > LIVE[0] + .55 && s < LIVE[1] - .3) live.release();
  const next = CHIPS.findLastIndex((c) => s >= c.from);
  if (next !== chip) { chip = next;showCode(CHIPS[chip].code, theme.night ? CHIPS[chip].night : CHIPS[chip].tint); }
  paintRail();
  // The hint returns with the flock at the end: steer it, or fold another plane.
  const ending = s > FLOCK[1];$('hint').hidden = s > .9 && !ending;
  const words = ending ? 'Move to steer the planes · tap to fold one' : 'Tap to fold a plane';if ($('hint').textContent !== words) $('hint').textContent = words;
  if (ending) $('hint').classList.remove('done');
  document.querySelector('.start').style.pointerEvents = s > RIVER[1] ? 'auto' : 'none';
  $('sample').hidden = !(s > 5.85 && s < 6.7);
  // The captions' scrim, only while busy 3D sits behind them.
  $('scrim').style.opacity = String(Math.min(1, Math.max(0, (s - 5.4) / .3)) * (1 - Math.min(1, Math.max(0, (s - 9.7) / .25))));
}
addEventListener('scroll', onScroll, { passive: true });

function fit() {
  if (stageFor(innerWidth, innerHeight).tall !== room.tall) return location.reload();
  scale = Math.min(innerWidth / room.fit[0], innerHeight / room.fit[1]);ratio = Math.min(devicePixelRatio || 1, 2);
  stage.style.width = `${W * scale}px`;stage.style.height = `${H * scale}px`;
  ink.width = Math.round(innerWidth * ratio);ink.height = Math.round(innerHeight * ratio);
  // The stage is centred in the layout viewport (without the scrollbar); read where it really is, so the full-window
  // layers inside it land on whole pixels. Off by the scrollbar's half (7.5 px), every canvas pixel was resampled.
  const placed = stage.getBoundingClientRect();view.x = placed.left;view.y = placed.top;
  for (const layer of [gl, ink, $('back'), $('front')]) Object.assign(layer.style, { left: `${-view.x}px`, top: `${-view.y}px`, width: `${innerWidth}px`, height: `${innerHeight}px` });
  painter.resize(scale, { x: view.x, y: view.y, width: innerWidth, height: innerHeight });three?.resize(innerWidth, innerHeight, ratio);player.refresh();
}
// The live chapter's sources and its two quiet controls.
const stillMotion = matchMedia('(prefers-reduced-motion: reduce)');
const viewButton = $('live-view');
const live = createLive({ stage, drawing, player, units: (px) => px / scale, onNotice: (m) => { notice = m; }, reducedMotion: () => stillMotion.matches,
  onView: (m) => { viewButton.hidden = m.views.length < 2;const next = m.views[(m.views.indexOf(m.view) + 1) % m.views.length];viewButton.querySelector('.label').textContent = `View · ${next}`; } });
let livePoint = null;    // where the live point was last painted (stage units), for clicks
// Any press in the chapter that is not on a control acts on the live point, even over the code chip or rail,
// so letting the ghost file go never needs a second try.
document.addEventListener('pointerdown', (e) => {
  if (!livePoint || liveBox.hidden || e.button > 0 || e.target.closest('button, a, input, .live-controls')) return;
  const q = fromView({ x: e.clientX, y: e.clientY });live.click(q.x, q.y, livePoint.at, livePoint.r);
});
viewButton.addEventListener('click', () => live.nextView());
const liveBox = $('live-controls'), liveToggle = $('live-toggle');
const openLive = (open) => { liveBox.classList.toggle('open', open);liveToggle.setAttribute('aria-expanded', String(open)); };
liveToggle.addEventListener('click', () => openLive(!liveBox.classList.contains('open')));
liveBox.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openLive(false);liveToggle.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!liveBox.contains(e.target)) openLive(false); });
$('live-file').addEventListener('click', () => $('live-input').click());
$('live-input').addEventListener('change', (e) => { const chosen = e.currentTarget.files?.[0];if (chosen) live.open(chosen);e.currentTarget.value = ''; });
$('live-sample').addEventListener('click', async (e) => { const b = e.currentTarget.getBoundingClientRect(), name = await live.sample(b.width ? fromView({ x: b.left + b.width / 2, y: b.top + b.height / 2 }) : null);if (name) $('live-sample').querySelector('.label').textContent = `Sample · ${name.split(/[-.]/)[0]}`; });
/** Season dots: each shows whether its file has loaded, which one is on screen, and one asked for while loading. */
function paintSeasons(current = live.caption?.season ?? null) {
  for (const b of $('live-seasons').querySelectorAll('button')) {
    const n = b.dataset.season === 'all' ? 'all' : Number(b.dataset.season), state = live.seasonState(n);
    b.dataset.load = state.load;b.toggleAttribute('data-pending', state.pending);
    b.setAttribute('aria-pressed', String(String(n) === String(current)));
    b.setAttribute('aria-busy', String(state.pending));
  }
}
// Day and night: the switch in the corner. Tokens restyle the page; the canvas layers read the theme each frame.
const themeButton = $('theme');
const labelTheme = () => { themeButton.setAttribute('aria-pressed', String(theme.night));themeButton.setAttribute('aria-label', theme.night ? 'Switch to day' : 'Switch to night'); };
themeButton.addEventListener('click', () => theme.toggle());
theme.onChange(() => { labelTheme();if (chip >= 0) showCode(CHIPS[chip].code, theme.night ? CHIPS[chip].night : CHIPS[chip].tint);painter.setDark(theme.night);three?.setDark(theme.night);player.refresh(); });
painter.setDark(theme.night);
labelTheme();
$('live-views').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]');if (b) { live.showView(b.dataset.view);placeLive(); } });
$('live-seasons').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-season]');
  if (!b) return;
  // Any dot can be pressed, loaded or not: an unloaded season loads, pulsing, and the view morphs when it lands.
  const asked = live.season(b.dataset.season === 'all' ? 'all' : Number(b.dataset.season));
  paintSeasons();
  void asked.then(() => { paintSeasons();placeLive(); }, (error) => { notice = `Couldn't load that season: ${error.message}`;paintSeasons(); });
});
$('live-listen').addEventListener('click', async (e) => { const button = e.currentTarget, on = await live.listen();button.setAttribute('aria-pressed', String(on));button.querySelector('.label').textContent = on ? 'Listening' : 'Listen'; });
/**
 * Where the live controls and the data may go: the controls sit bottom right, above the code chip when they
 * would meet it; the data's radius is the largest circle round the point that stays clear of the caption,
 * the chip, the controls and the rail (with room for its rim labels).
 */
const liveLayout = { view: { x0: 0, y0: 0, x1: W, y1: H }, room: 200, keep: [] };
let livePlaced = 0, liveRoom = 0;
function placeLive() {
  const chip = document.querySelector('.chip').getBoundingClientRect(), box = liveBox.getBoundingClientRect();
  const right = 56, clash = chip.width && chip.right > innerWidth - right - 160 && chip.top < innerHeight - 32 - 48;
  liveBox.style.bottom = `${clash ? innerHeight - chip.top + 14 : 32}px`;liveBox.style.right = `${right}px`;
  const tl = fromView({ x: 0, y: 0 }), br = fromView({ x: innerWidth, y: innerHeight }), c = { x: innerWidth / 2, y: innerHeight / 2 };
  // With data on stage the view zooms in: the caption and the code chip step aside and the form takes the screen.
  // The chart stays open through the room, but the page's own caption and chip come back once the room takes over.
  const full = !!live.form && liveRetract(story.value) < .5;document.documentElement.classList.toggle('live-full', full && story.value < LIVE[1] + .02);
  // The data's caption is page text under the form: a readable title, the seasons when it has them, and for real
  // data its source credit, worded for what was derived.
  const about = full && story.value < LIVE[1] - .2 ? live.caption : null;
  $('live-caption').hidden = !about;
  if (about) {
    $('live-title').textContent = about.title;$('live-what').textContent = about.what;
    const views = $('live-views'), names = about.views.join(' ');
    if (views.dataset.names !== names) {
      views.dataset.names = names;
      views.replaceChildren(...about.views.map((v) => {
        const b = document.createElement('button');b.type = 'button';b.dataset.view = v;
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');icon.setAttribute('viewBox', '0 0 16 16');icon.setAttribute('aria-hidden', 'true');
        for (const d of VIEW_ICONS[v] ?? []) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');path.setAttribute('d', d);icon.append(path); }
        const name = document.createElement('span');name.textContent = v.charAt(0).toUpperCase() + v.slice(1);
        b.append(icon, name);return b;
      }));
    }
    views.hidden = about.views.length < 2;
    for (const b of views.children) b.setAttribute('aria-pressed', String(b.dataset.view === about.view));
    $('live-seasons').hidden = about.season === null;
    paintSeasons(about.season);
    if (about.season !== null) void live.prefetchSeasons(about.season === 'all' ? 1 : about.season);
    $('live-credit').hidden = !live.hasMeasuredPairs || !live.source?.startsWith('friends-');
    $('live-credit-how').textContent = 'Interaction counts derived by ExplainerKit from shared scenes and consecutive speaker turns.';
  }
  let room = full ? (Math.min(innerWidth, innerHeight) / 2 - 24) / 1.24 : Math.min(innerWidth, innerHeight) * .38;
  const caption = document.querySelector('[data-caption="live"]');
  for (const el of [...(full ? [$('live-caption')] : [caption, document.querySelector('.chip')]), liveToggle, $('rail'), document.querySelector('.brand')]) {
    const b = el?.getBoundingClientRect();if (!b || !b.width) continue;
    const dx = Math.max(b.left - c.x, 0, c.x - b.right), dy = Math.max(b.top - c.y, 0, c.y - b.bottom);
    room = Math.min(room, (Math.hypot(dx, dy) - 18) / 1.22);    // 1.22: the rim labels and the title sit outside the form
  }
  liveLayout.view = { x0: tl.x, y0: tl.y, x1: br.x, y1: br.y };liveLayout.room = Math.max(70, room) / scale;void box;
  // Text the eager dots must stay off (caption, chip, controls, brand), in stage units with a margin.
  liveLayout.keep = [...(full ? [$('live-caption')] : [caption, document.querySelector('.chip')]), liveBox, document.querySelector('.brand')].map((el) => el?.getBoundingClientRect()).filter((b) => b?.width)
    .map((b) => { const a = fromView({ x: b.left - 16, y: b.top - 16 }), z = fromView({ x: b.right + 16, y: b.bottom + 16 });return { x0: a.x, y0: a.y, x1: z.x, y1: z.y }; });
}
addEventListener('resize', () => { fit();placeLive(); });
function followSignalLink() {
  if (location.hash === '#room') scrollTo(0, (ROOM[0] + .05) * innerHeight * PACE);
  if (location.hash === '#river') scrollTo(0, (RIVER[0] + .2) * innerHeight * PACE);
}
addEventListener('hashchange', followSignalLink);
fit();followSignalLink();onScroll();placeLive();
// Take over the first-paint plane (index.html, CSS only) in the same pose: the real predator starts where it is,
// at its speed and heading, and the rest of the flock folds in around it, one sheet after another.
const lead = (() => {
  const el = $('boot'), svg = el?.querySelector('svg'), fly = svg?.getAnimations()[0];
  if (!fly) return null;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', getComputedStyle(svg).offsetPath.replace(/^path\("|"\)$/g, ''));
  const total = path.getTotalLength(), period = fly.effect.getTiming().duration / 1000, u = (fly.currentTime / 1000 / period) % 1;
  const o = el.getBoundingClientRect(), p = path.getPointAtLength(u * total), q = path.getPointAtLength(((u + .002) % 1) * total);
  const speed = total / period, d = Math.hypot(q.x - p.x, q.y - p.y) || 1, at = { x: o.left + p.x, y: o.top + p.y };
  // Same size too: slide back along the view ray until the dart (its length is its size) spans the drawn plane.
  const drawn = svg.getBoundingClientRect().width * 27 / 40, span = (w) => { const m = projectPoint(camera, { ...w, x: w.x - flight.size[0] / 2 }), n = projectPoint(camera, { ...w, x: w.x + flight.size[0] / 2 });return Math.hypot(n.x - m.x, n.y - m.y) * scale; };
  const deep = (s) => { const w = toWorld(fromView(s)), eye = screenRay(camera, fromView(s)).origin, k = span(w) / drawn;return { x: eye.x + (w.x - eye.x) * k, y: eye.y + (w.y - eye.y) * k, z: eye.z + (w.z - eye.z) * k }; };
  const a = deep(at), b = deep({ x: at.x + (q.x - p.x) / d * speed * .1, y: at.y + (q.y - p.y) / d * speed * .1 });
  return { ...a, vx: (b.x - a.x) * 10, vy: (b.y - a.y) * 10, vz: (b.z - a.z) * 10 };
})();
flight.begin({ lead, born: Array.from({ length: flight.count }, (_, i) => (i ? .3 + i * .14 : -1e9)) });
// Opened past the opening (a reload part-way): the plane has no flock to join here, so it flies off instead.
if (story.value > .9 && $('boot')) { $('boot').classList.add('leaving');setTimeout(() => $('boot')?.remove(), 900); } else $('boot')?.remove();
document.documentElement.classList.add('ready');player.refresh();
player.play();
// Start the 3D stage once the opening has settled (the flock has folded in and the page joined), in an idle
// moment, so its build never competes with the first frames. Reading fast, arriving part-way, or scrolling
// toward the 3D chapters starts it sooner (see onScroll and offerArrival).
setTimeout(() => (globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 200)))(() => ensureThree(), { timeout: 2000 }), 3200);

/** Copy with visible feedback every time: the async clipboard, else a selection copy, else say how. */
async function copyText(button, value) {
  let ok = false;
  try { await navigator.clipboard.writeText(value);ok = true; } catch {
    const area = Object.assign(document.createElement('textarea'), { value });area.setAttribute('readonly', '');Object.assign(area.style, { position: 'fixed', opacity: '0' });
    document.body.append(area);area.select();try { ok = document.execCommand('copy'); } catch { ok = false; }area.remove();
  }
  button.dataset.done = ok ? 'copied' : 'press ⌘C';
  button.classList.remove('pop');void button.offsetWidth;button.classList.add('pop');
  clearTimeout(button._done);button._done = setTimeout(() => { delete button.dataset.done; }, 1800);
}
$('install').addEventListener('click', (e) => copyText(e.currentTarget, 'npm i explainerkit'));
$('copy').addEventListener('click', (e) => copyText(e.currentTarget, code.textContent));

window.landing = { get room() { return roomShot; }, get river() { return riverShot; }, player, drawing, flight, hero, story, clock, air, sprouts, PACE, get three() { return three; }, get continuity() { return continuity; }, pose, loaded, loadedAt, get director() { return { mood, nextMood, walkEnds, pendingThrow }; }, live };
