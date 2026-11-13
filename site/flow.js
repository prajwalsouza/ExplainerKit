// "Flow": a word written by one paper ribbon. The stroke is a smooth spline through authored knots,
// converted to cubic Béziers whose handles stay visible and draggable. The ribbon behaves like a
// broad nib: its face turns with the stroke direction, so it shows its sage side on the up-strokes
// and its ivory back on the down-strokes. Pure geometry here; the page owns input and time.
import { measurePath } from 'explainerkit/geometry';
import { hsla } from 'explainerkit/color';
import { theme, brandHsla } from './theme.js';

// Knots of the word, in the 1600 × 900 stage: a lead-in, f (tall loop, descender, crossbar), l, o, w and a tail.
export const KNOTS = Object.freeze([
  [262, 652], [352, 612], [452, 520], [530, 400], [586, 296], [622, 236], [612, 214], [584, 232], [560, 300],
  [538, 420], [514, 560], [494, 680], [474, 726], [450, 716], [458, 668], [508, 600], [590, 560], [660, 500],
  [722, 392], [758, 290], [770, 238], [752, 226], [728, 262], [716, 380], [720, 520], [742, 600], [784, 610],
  [826, 562], [868, 526], [906, 540], [912, 590], [880, 620], [842, 604], [846, 556], [900, 528], [952, 528],
  [972, 578], [994, 614], [1020, 566], [1040, 526], [1062, 580], [1086, 614], [1112, 566], [1130, 520],
  [1170, 528], [1236, 584], [1316, 590],
].map(([x, y]) => Object.freeze({ x, y })));
export const NIB = -.75; // nib angle, radians: strokes along it are thin, across it wide
const SAMPLES = 700, WIDTH = 15;

/** Catmull–Rom through the knots, as cubic Bézier segments with their handles. */
export function strokeOf(knots) {
  const segments = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const p0 = knots[Math.max(i - 1, 0)], p1 = knots[i], p2 = knots[i + 1], p3 = knots[Math.min(i + 2, knots.length - 1)];
    segments.push({ from: p1, c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }, to: p2 });
  }
  const commands = [['M', knots[0].x, knots[0].y], ...segments.map((s) => ['C', s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y])];
  const path = measurePath(commands, { maxPoints: 6000 });
  const x = new Float32Array(SAMPLES + 1), y = new Float32Array(SAMPLES + 1), angle = new Float32Array(SAMPLES + 1);
  for (let j = 0; j <= SAMPLES; j++) { const p = path.at(j / SAMPLES);x[j] = p.x;y[j] = p.y;angle[j] = p.rotation; }
  return { segments, length: path.length, x, y, angle, n: SAMPLES + 1, at: (u) => path.at(Math.min(Math.max(u, 0), 1)) };
}

const SAGE = Array.from({ length: 32 }, (_, i) => hsla(100, 16, 46 + i * .9)), IVORY = Array.from({ length: 32 }, (_, i) => hsla(40, 28, 80 + i * .55));
// On a dark page the ribbon is a different paper, not a dimmed one: a bronze face and a warm tan back, brown rather
// than green, with a gentle drift in hue along the light so it reads as material, not as a flat fill.
const BRONZE = Array.from({ length: 32 }, (_, i) => hsla(30 + i * .25, 30 + i * .2, 26 + i * .75)), TAN = Array.from({ length: 32 }, (_, i) => hsla(36, 26 + i * .2, 46 + i * .55));
const faces = () => (theme.night ? [BRONZE, TAN] : [SAGE, IVORY]);

/**
 * Paint the ribbon from arc-length 0 to `reveal`, with its shadow, edges and construction handles.
 * `t` breathes the twist a little so the paper never looks frozen.
 */
export function paintRibbon(ctx, stroke, { reveal = 1, t = 0, alpha = 1, handles = 1, lift = 0 }) {
  const last = Math.max(1, Math.floor(reveal * (stroke.n - 1)));
  if (reveal <= 0 || alpha <= 0) return;
  const { x, y, angle } = stroke, hw = new Float32Array(last + 1), face = new Float32Array(last + 1);
  for (let j = 0; j <= last; j++) {
    // Broad nib: width follows the stroke's angle to the nib; ends taper; a slow breath in the twist.
    const u = j / (stroke.n - 1), turn = angle[j] - NIB + .18 * Math.sin(t * .9 + u * 9);
    const taper = Math.min(1, u * 14, (1 - u) * 10 + .25);
    hw[j] = WIDTH * Math.sin(turn) * taper;face[j] = Math.cos(turn);
  }
  ctx.save();ctx.globalAlpha = alpha;ctx.lineJoin = ctx.lineCap = 'round';
  // Soft shadow on the paper below, further away when the ribbon is lifted.
  ctx.save();ctx.filter = `blur(${6 + lift * 8}px)`;ctx.globalAlpha = alpha * (.16 - lift * .05) * (theme.night ? 2.2 : 1);ctx.strokeStyle = theme.night ? hsla(0, 0, 0) : hsla(30, 25, 30);
  ctx.lineWidth = WIDTH * 1.1;ctx.beginPath();ctx.moveTo(x[0] + 8 + lift * 10, y[0] + 14 + lift * 18);
  for (let j = 1; j <= last; j += 2) ctx.lineTo(x[j] + 8 + lift * 10, y[j] + 14 + lift * 18);
  ctx.stroke();ctx.restore();
  for (let j = 0; j < last; j++) {
    const nx = -Math.sin(angle[j]), ny = Math.cos(angle[j]), nx2 = -Math.sin(angle[j + 1]), ny2 = Math.cos(angle[j + 1]);
    const h0 = hw[j], h1 = hw[j + 1], front = h0 + h1 > 0;
    // Light from the upper left: the face that turns toward it is brighter.
    const lit = Math.max(0, Math.min(1, .55 + .45 * face[j] * (front ? 1 : -1) * -.8 + .25 * (nx * -.5 + ny * -.85) * (front ? 1 : -1)));
    ctx.fillStyle = faces()[front ? 0 : 1][Math.round(lit * 31)];
    ctx.beginPath();
    ctx.moveTo(x[j] + nx * h0, y[j] + ny * h0);ctx.lineTo(x[j + 1] + nx2 * h1, y[j + 1] + ny2 * h1);
    ctx.lineTo(x[j + 1] - nx2 * h1, y[j + 1] - ny2 * h1);ctx.lineTo(x[j] - nx * h0, y[j] - ny * h0);ctx.closePath();ctx.fill();
  }
  // Fine graphite edges, as in a drawn construction.
  for (const side of [1, -1]) {
    ctx.beginPath();
    for (let j = 0; j <= last; j++) { const nx = -Math.sin(angle[j]), ny = Math.cos(angle[j]), px = x[j] + nx * hw[j] * side, py = y[j] + ny * hw[j] * side;if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.lineWidth = .7;ctx.strokeStyle = theme.night ? hsla(34, 22, 64, .3) : hsla(30, 10, 25, .45);ctx.stroke(); // on dark, edges catch light
  }
  if (handles > 0) paintHandles(ctx, stroke, reveal, handles * alpha);
  ctx.restore();
}

/** Construction handles: anchor dots with tangent lines to their Bézier control points. */
function paintHandles(ctx, stroke, reveal, alpha) {
  ctx.save();ctx.globalAlpha = alpha * .55;ctx.lineWidth = .8;ctx.strokeStyle = hsla(30, 8, 30);ctx.fillStyle = hsla(30, 8, 26);
  const shown = Math.floor(reveal * stroke.segments.length);
  for (let i = 0; i < shown; i += 3) {
    const s = stroke.segments[i];
    ctx.beginPath();ctx.moveTo(s.c1.x, s.c1.y);ctx.lineTo(s.from.x, s.from.y);ctx.stroke();
    ctx.beginPath();ctx.arc(s.from.x, s.from.y, 2.6, 0, 6.283);ctx.fill();
    ctx.beginPath();ctx.arc(s.c1.x, s.c1.y, 1.8, 0, 6.283);ctx.fill();
  }
  ctx.restore();
}

/** The thread from the ribbon's end to the bead, and the bead itself. */
export function paintBead(ctx, stroke, bead, { alpha = 1, reveal = 1 } = {}) {
  if (alpha <= 0) return;
  const end = stroke.at(reveal);
  ctx.save();ctx.globalAlpha = alpha;
  ctx.beginPath();ctx.moveTo(end.x, end.y);
  ctx.bezierCurveTo(end.x + 60, end.y + 20, bead.x - 90, bead.y + 30, bead.x, bead.y);
  ctx.lineWidth = 1.5;ctx.strokeStyle = brandHsla(-1);ctx.stroke();
  const g = ctx.createRadialGradient(bead.x - 4, bead.y - 5, 1, bead.x, bead.y, 12);
  g.addColorStop(0, brandHsla(20, 1, 18));g.addColorStop(.5, brandHsla(0, 1, 2));g.addColorStop(1, brandHsla(-18, 1, -6));
  ctx.beginPath();ctx.ellipse(bead.x + 3, bead.y + 13, 10, 3, 0, 0, 6.283);ctx.fillStyle = theme.night ? hsla(0, 0, 0, .4) : hsla(30, 25, 30, .14);ctx.fill();
  ctx.beginPath();ctx.arc(bead.x, bead.y, 12, 0, 6.283);ctx.fillStyle = g;ctx.fill();
  ctx.restore();
}
