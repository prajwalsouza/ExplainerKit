// Labels that keep clear, felt. A summer sky: the stars of the Summer Triangle and the Swan, each named. Drag a star
// (or the Moon) and placeLabels from explainerkit/layout/labels re-plans every name on every move, measured with
// canvasTextMeasurer. The eight places it tries around the dragged star are drawn in the order it tries them; the
// one it chose is lit. Crowd a star until no place is clear and the planner refuses (LABEL_LAYOUT_OVERFLOW): the
// last good layout stays, because the caller adopts a plan whole or not at all. Names glide on springs.
import { placeLabels, canvasTextMeasurer } from '../../runtime/src/layout/labels.js';
import { spring } from '../../runtime/src/physics/index.js';
import { css } from './_kit.js';

const CSS = `.mld { position: relative; height: 380px; } .mld canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.mld-say { position: absolute; left: 24px; right: 24px; bottom: 14px; font-size: 13.5px; color: var(--muted); pointer-events: none; min-height: 1.4em; }
.mld-say b { color: var(--ink); font-weight: 600; } .mld-say.no b { color: hsl(8 70% var(--accent-l)); }`;
// Positions as fractions of the sky, roughly as the Swan flies over the Triangle.
const STARS = [
  ['Deneb', .58, .14, 1.25], ['Sadr', .52, .34, .9], ['Gienah', .70, .36, .75], ['Fawaris', .36, .28, .7],
  ['Albireo', .40, .72, .8], ['Vega', .17, .22, 1.35], ['Sheliak', .2, .5, .6], ['Altair', .84, .7, 1.2], ['Tarazed', .8, .58, .65],
];
const LINES = [['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah', 'Sadr'], ['Sadr', 'Fawaris'], ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega'], ['Vega', 'Sheliak'], ['Altair', 'Tarazed']];
const FONT = '500 14px ui-sans-serif, -apple-system, "Segoe UI", sans-serif', GAP = 6;

export default async function measuredLabelsDrag(stage, ctx) {
  css('measured-labels-drag', CSS);
  stage.innerHTML = '<div class="mld"><canvas role="img" aria-label="A star chart. Drag a star or the Moon; the star names re-plan to stay clear of each other."></canvas><div class="mld-say"></div></div>';
  const box = stage.querySelector('.mld'), canvas = box.querySelector('canvas'), g = canvas.getContext('2d'), say = box.querySelector('.mld-say');
  const events = new AbortController(), media = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = Boolean(ctx.still || media.matches);
  const still = () => reducedMotion;
  let disposed = false, visible = true, request = null, until = 0;
  const allowed = () => !disposed && visible && !document.hidden;
  const stop = () => { if (request !== null) cancelAnimationFrame(request);request = null; };
  function wake(milliseconds = 0) {
    if (!allowed()) return;
    until = Math.max(until, performance.now() + milliseconds);
    if (request === null) request = requestAnimationFrame(frame);
  }
  let w = 0, h = 0;
  const stars = STARS.map(([id, fx, fy, mag], k) => ({ id, fx, fy, mag, k, x: 0, y: 0, twinkle: Math.random() * 6.28 }));
  const moon = { fx: .3, fy: .58, r: 30, x: 0, y: 0 };
  const shown = new Map(); // id → {x, y} springs toward the planned box
  let captured = null;
  const releaseCapture = () => { if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);captured = null; };
  let plan = null, held = null, refused = null, pointer = { x: -1e3, y: -1e3 };
  const measure = canvasTextMeasurer(g, { font: FONT, lineHeight: 20 });
  const bounds = () => ({ x: 10, y: 10, width: w - 20, height: h - 48 });
  const moonBox = () => ({ x: moon.x - moon.r, y: moon.y - moon.r, width: moon.r * 2, height: moon.r * 2 });

  // The plan: every name, in author order, measured; the Moon's box is the one obstacle.
  const replan = () => {
    try {
      const next = placeLabels(stars.map((s) => ({ id: s.id, text: s.id, anchor: { x: s.x, y: s.y } })), { bounds: bounds(), measure, obstacles: [moonBox()], gap: GAP });
      plan = new Map(next.map((b) => [b.id, b]));refused = null;
      const now = performance.now() / 1000;
      for (const b of next) {
        const s = shown.get(b.id);
        if (!s) { shown.set(b.id, { x: b.x, y: b.y, sx: null, sy: null }); continue; }
        if (s.tx === b.x && s.ty === b.y) continue;
        const cur = at(s, now);
        s.sx = spring({ from: cur.x, to: b.x, velocity: cur.vx, stiffness: 260, damping: 24, at: now });
        s.sy = spring({ from: cur.y, to: b.y, velocity: cur.vy, stiffness: 260, damping: 24, at: now });
        s.tx = b.x;s.ty = b.y;
      }
    } catch (error) {
      if (error.code !== 'LABEL_LAYOUT_OVERFLOW') throw error;
      refused = error.message.replace(/;.*$/, '');
    }
    tell();wake(1800);
  };
  const at = (s, now) => (still() && s.tx !== undefined ? { x: s.tx, y: s.ty, vx: 0, vy: 0 } : s.sx ? { x: s.sx.sample(now), y: s.sy.sample(now), vx: s.sx.velocity(now), vy: s.sy.velocity(now) } : { x: s.x, y: s.y, vx: 0, vy: 0 });
  const tell = () => {
    say.classList.toggle('no', !!refused);
    say.innerHTML = refused
      ? `<b>Refused: LABEL_LAYOUT_OVERFLOW.</b> ${refused.replace('No supported collision-free placement for', 'No clear place for')}. The last good layout stays: nothing is clipped, shrunk or dropped.`
      : held ? `<b>${held === moon ? 'The Moon' : held.id}</b>: ${held === moon ? 'an obstacle. Every name keeps its gap from its box.' : `tries the right first, then left, above, below, then the corners. Place ${slotOf(held)} was clear.`}`
        : 'Drag a star, or the Moon, into the crowd. Every name is re-planned on every move.';
  };
  const slotOf = (s) => {
    const b = plan?.get(s.id);if (!b) return '?';
    const k = slots(s).findIndex((c) => Math.abs(c.x - b.x) < .01 && Math.abs(c.y - b.y) < .01);
    return k + 1;
  };
  // The eight candidates placeLabels tries, in its order (right, left, above, below, then the four corners).
  const slots = (s) => {
    const m = measure(s.id), W = m.width, H = m.height, x = s.x, y = s.y;
    return [[x + GAP, y - H / 2], [x - W - GAP, y - H / 2], [x - W / 2, y - H - GAP], [x - W / 2, y + GAP], [x + GAP, y - H - GAP], [x - W - GAP, y - H - GAP], [x + GAP, y + GAP], [x - W - GAP, y + GAP]].map(([a, b]) => ({ x: a, y: b, width: W, height: H }));
  };
  const fit = () => {
    const r = devicePixelRatio || 1;w = box.clientWidth;h = box.clientHeight;canvas.width = w * r;canvas.height = h * r;g.setTransform(r, 0, 0, r, 0, 0);
    for (const s of stars) if (!s.moved) { s.x = s.fx * w;s.y = 18 + s.fy * (h - 80); }
    if (!moon.moved) { moon.x = moon.fx * w;moon.y = 18 + moon.fy * (h - 80); }
    shown.clear();replan();
  };
  const resize = new ResizeObserver(fit);resize.observe(box);

  const local = (e) => { const r = canvas.getBoundingClientRect();return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const pick = (p) => (Math.hypot(p.x - moon.x, p.y - moon.y) < moon.r + 4 ? moon : stars.reduce((best, s) => (Math.hypot(p.x - s.x, p.y - s.y) < Math.hypot(p.x - (best?.x ?? 1e9), p.y - (best?.y ?? 1e9)) ? s : best), null));
  const pointerDown = (e) => {
    if (!allowed()) return;
    const p = local(e), hit = pick(p);
    if (!hit || (hit !== moon && Math.hypot(p.x - hit.x, p.y - hit.y) > 26)) return;
    held = hit;held.dx = hit.x - p.x;held.dy = hit.y - p.y;canvas.setPointerCapture(e.pointerId);captured = e.pointerId;tell();wake();
  };
  const pointerMove = (e) => {
    if (!allowed()) return;
    pointer = local(e);
    if (!held) { const hit = pick(pointer);canvas.style.cursor = hit && (hit === moon || Math.hypot(pointer.x - hit.x, pointer.y - hit.y) < 26) ? 'grab' : 'default';return; }
    canvas.style.cursor = 'grabbing';
    held.x = Math.max(14, Math.min(w - 14, pointer.x + held.dx));held.y = Math.max(14, Math.min(h - 52, pointer.y + held.dy));held.moved = true;
    replan();
  };
  const release = () => { releaseCapture();if (held) { held = null;tell();wake(); } };
  canvas.addEventListener('pointerdown', pointerDown, {signal: events.signal});
  canvas.addEventListener('pointermove', pointerMove, {signal: events.signal});
  canvas.addEventListener('pointerup', release, {signal: events.signal});
  canvas.addEventListener('pointercancel', release, {signal: events.signal});
  canvas.addEventListener('pointerleave', () => { pointer = { x: -1e3, y: -1e3 };wake(); }, {signal: events.signal});

  const frame = (ms) => {
    request = null;if (!allowed()) return;
    const now = still() ? 0 : ms / 1000, dark = ctx.dark();
    g.clearRect(0, 0, w, h);
    // A soft band of sky light behind the Swan.
    const band = g.createLinearGradient(w * .2, 0, w * .75, h);
    band.addColorStop(0, 'transparent');band.addColorStop(.5, `hsl(${ctx.hue + 20} 60% ${dark ? 60 : 55}% / ${dark ? .1 : .08})`);band.addColorStop(1, 'transparent');
    g.fillStyle = band;g.fillRect(0, 0, w, h);
    // The Moon, an obstacle: its box drawn faintly so the reader sees what the planner sees.
    const mg = g.createRadialGradient(moon.x - 8, moon.y - 10, 2, moon.x, moon.y, moon.r);
    mg.addColorStop(0, dark ? '#fbf3dc' : '#fff6d8');mg.addColorStop(1, dark ? '#c9b98f' : '#e8cf8c');
    g.fillStyle = mg;g.beginPath();g.arc(moon.x, moon.y, moon.r, 0, 6.283);g.fill();
    g.strokeStyle = `hsl(40 30% ${dark ? 70 : 45}% / ${held === moon ? .7 : .28})`;g.setLineDash([3, 4]);g.lineWidth = 1;g.strokeRect(moon.x - moon.r, moon.y - moon.r, moon.r * 2, moon.r * 2);g.setLineDash([]);
    // The asterism lines.
    g.strokeStyle = `hsl(${ctx.hue} 30% ${dark ? 70 : 40}% / .22)`;g.lineWidth = 1;
    for (const [a, b] of LINES) { const p = stars.find((s) => s.id === a), q = stars.find((s) => s.id === b);g.beginPath();g.moveTo(p.x, p.y);g.lineTo(q.x, q.y);g.stroke(); }
    // The eight candidates around the held star, numbered in the planner's order; the chosen one lit.
    if (held && held !== moon) {
      const chosen = plan?.get(held.id);
      slots(held).forEach((c, k) => {
        const on = !refused && chosen && Math.abs(c.x - chosen.x) < .01 && Math.abs(c.y - chosen.y) < .01;
        g.strokeStyle = on ? `hsl(${ctx.hue} 70% ${dark ? 66 : 48}%)` : refused ? 'hsl(8 70% 55% / .5)' : `hsl(${ctx.hue} 20% ${dark ? 70 : 40}% / .3)`;
        g.setLineDash(on ? [] : [2, 3]);g.lineWidth = on ? 1.6 : 1;g.beginPath();g.roundRect(c.x - 3, c.y - 1, c.width + 6, c.height + 2, 5);g.stroke();g.setLineDash([]);
        g.fillStyle = g.strokeStyle;g.font = '600 9px ui-sans-serif, sans-serif';g.textAlign = 'center';g.fillText(String(k + 1), c.x + c.width / 2, c.y + c.height / 2 + 3);
      });
    }
    // Stars with halos that breathe.
    for (const s of stars) {
      const tw = 1 + .15 * Math.sin(now * 1.7 + s.twinkle), r = 2.2 + s.mag * 2.2, hot = held === s;
      const col = `hsl(${ctx.hue - 40 + s.k * 14} ${dark ? 70 : 65}% ${dark ? 78 : 50}%`;
      const halo = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 5 * tw);halo.addColorStop(0, `${col} / ${hot ? .55 : .35})`);halo.addColorStop(1, 'transparent');
      g.fillStyle = halo;g.beginPath();g.arc(s.x, s.y, r * 5 * tw, 0, 6.283);g.fill();
      g.fillStyle = dark ? '#fff' : `${col})`;g.beginPath();g.arc(s.x, s.y, r * (hot ? 1.3 : 1), 0, 6.283);g.fill();
      if (hot && refused) { g.strokeStyle = 'hsl(8 75% 55%)';g.lineWidth = 2;g.beginPath();g.arc(s.x, s.y, r + 9 + Math.sin(now * 12) * 1.5, 0, 6.283);g.stroke(); }
    }
    // The names, at their springing positions; a hairline leads back when a name sits away from its star.
    g.font = FONT;g.textAlign = 'left';g.textBaseline = 'middle';
    for (const s of stars) {
      const p = shown.get(s.id);if (!p) continue;
      const q = at(p, now), m = measure(s.id);
      const cx = Math.max(q.x, Math.min(s.x, q.x + m.width)), cy = Math.max(q.y, Math.min(s.y, q.y + m.height));
      if (Math.hypot(cx - s.x, cy - s.y) > GAP + 4) { g.strokeStyle = `hsl(${ctx.hue} 20% ${dark ? 70 : 40}% / .35)`;g.beginPath();g.moveTo(s.x, s.y);g.lineTo(cx, cy);g.stroke(); }
      g.fillStyle = dark ? '#e5e1dc' : '#2c2a27';g.globalAlpha = held && held !== s && held !== moon ? .7 : 1;
      g.fillText(s.id, q.x, q.y + m.height / 2 + 1);g.globalAlpha = 1;
    }
    if (!still() && ms < until) request = requestAnimationFrame(frame);
  };
  const visibility = () => { stop();if (!allowed()) { releaseCapture();held = null; }if (allowed()) wake(); };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting;visibility(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', visibility, {signal: events.signal});
  media.addEventListener('change', () => { reducedMotion = media.matches;visibility(); }, {signal: events.signal});
  const offTheme = ctx.onTheme(() => wake());
  fit();
  return () => {
    if (disposed) return;
    disposed = true;stop();events.abort();resize.disconnect();observer.disconnect();offTheme();
    releaseCapture();held = null;shown.clear();
  };
}
