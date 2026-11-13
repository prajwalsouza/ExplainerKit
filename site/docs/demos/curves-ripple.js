// A pond of beads, rippled by stagger and shaped by easingCurve (explainerkit/motion). Click a bead: the delays are
// stagger(step, {from: thatBead, grid}), so the change spreads in rings of equal distance. Hover a stone to choose the
// curve family each bead rises with; click the stone to cycle its mode. Back and elastic overshoot; bounce lands twice.
import { easingCurve, stagger } from '../../runtime/src/motion/index.js';
import { css } from './_kit.js';

const CSS = `.cr { position: relative; height: 412px; } .cr canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.cr-code { position: absolute; left: 24px; top: 18px; right: 24px; font: 12.5px/1.5 var(--mono); color: var(--muted); pointer-events: none; }
.cr-code b { color: var(--ink); font-weight: 600; }`;
const FAMILIES = ['power', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce'];
const MODES = ['out', 'inOut', 'in', 'outIn'];
const C = 19, R = 9, N = C * R, STEP = 0.045, SPAN = 0.8;

export default async function curvesRipple(stage, ctx) {
  css('curves-ripple', CSS);
  stage.innerHTML = '<div class="cr"><canvas role="img" aria-label="A grid of beads. Click a bead to ripple from it; hover a stone below to change the easing family."></canvas><div class="cr-code"></div></div>';
  const box = stage.querySelector('.cr'), canvas = box.querySelector('canvas'), g = canvas.getContext('2d'), code = box.querySelector('.cr-code');
  let w = 0, h = 0;
  const fit = () => { const r = devicePixelRatio || 1;w = box.clientWidth;h = box.clientHeight;canvas.width = w * r;canvas.height = h * r;g.setTransform(r, 0, 0, r, 0, 0);wake(); };
  // The pond: a tilted grid, so rising beads read as height.
  const cell = () => Math.max(6, Math.min((w - 80) / (C - 1), 36));
  const beadAt = (i) => { const c = i % C, r = Math.floor(i / C), s = cell(), x0 = w / 2 - ((C - 1) * s) / 2;return { x: x0 + c * s + (r % 2 ? s * .18 : 0), y: 104 + r * s * .62 }; };
  const stoneAt = (k) => ({ x: w * (0.5 + (k - 3) * Math.min(0.13, 120 / Math.max(1, w))), y: 346 });
  let family = 4, mode = 0, ease = easingCurve({ family: FAMILIES[family], mode: MODES[mode] }), origin = Math.floor(N / 2);
  const beads = Array.from({ length: N }, () => ({ from: 0, to: 0, start: 0, ease }));
  let pointer = { x: -1e3, y: -1e3 }, hoverStone = -1, awakeUntil = 0, running = false;
  const describe = () => { code.innerHTML = `delay = <b>stagger(${STEP}, {from: ${origin}, grid: [${C}, ${R}]})</b>(i, ${N})<br>rise = <b>easingCurve({family: '${FAMILIES[family]}', mode: '${MODES[mode]}'})</b>`; };
  const ripple = (from) => {
    origin = from;
    const delay = stagger(STEP, { from, grid: [C, R] }), now = performance.now(), next = beads[from].to ? 0 : 1;
    beads.forEach((b, i) => {
      const p = ctx.still ? 1 : Math.min(1, Math.max(0, (now - b.start) / (SPAN * 1000)));
      b.from = b.from + (b.to - b.from) * b.ease(p);b.to = next;b.ease = ease;b.start = now + delay(i, N) * 1000;
      if (ctx.still) { b.from = next;b.start = now - SPAN * 1000; }
    });
    describe();wake(1000 * (SPAN + STEP * 22) + 400);
  };
  const choose = (k, m = mode) => { family = k;mode = m;ease = easingCurve({ family: FAMILIES[family], mode: MODES[mode] });ripple(origin); };
  const local = (e) => { const r = canvas.getBoundingClientRect();return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const nearestBead = (p) => { let best = -1, d = 1e9;for (let i = 0; i < N; i++) { const b = beadAt(i), q = Math.hypot(b.x - p.x, b.y - p.y);if (q < d) { d = q;best = i; } }return d < cell() ? best : -1; };
  const stoneUnder = (p) => FAMILIES.findIndex((_, k) => Math.hypot(p.x - stoneAt(k).x, p.y - stoneAt(k).y) < 30);
  const events = new AbortController(), on = { signal: events.signal };
  let disposed = false, visible = true;
  canvas.addEventListener('pointermove', (e) => {
    pointer = local(e);
    const k = stoneUnder(pointer), b = nearestBead(pointer);
    canvas.style.cursor = k >= 0 || b >= 0 ? 'pointer' : 'default';
    if (k !== hoverStone) { hoverStone = k;if (k >= 0 && k !== family) choose(k); }
    wake();
  }, on);
  canvas.addEventListener('pointerleave', () => { pointer = { x: -1e3, y: -1e3 };hoverStone = -1;wake(); }, on);
  canvas.addEventListener('pointerdown', (e) => {
    const p = local(e), k = stoneUnder(p);
    if (k >= 0) { choose(k, k === family ? (mode + 1) % MODES.length : mode);return; }
    const b = nearestBead(p);if (b >= 0) ripple(b);
  }, on);

  const glyph = (cx, cy, r, curve, colour, width) => {
    g.strokeStyle = colour;g.lineWidth = width;g.lineJoin = g.lineCap = 'round';g.beginPath();
    for (let k = 0; k <= 40; k++) { const u = k / 40, x = cx - r * .62 + u * r * 1.24, y = cy + r * .42 - curve(u) * r * .84;k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  const frame = (now) => {
    if (disposed || !visible || w < 40) { running = false;return; }
    const dark = ctx.dark(), hue = ctx.hue, s = cell();
    g.clearRect(0, 0, w, h);
    // Beads, back rows first. Each value v runs from 0 (resting) to 1 (raised); overshoot shows as extra height.
    for (let i = 0; i < N; i++) {
      const b = beads[i], at = beadAt(i), p = Math.min(1, Math.max(0, (now - b.start) / (SPAN * 1000))), v = b.from + (b.to - b.from) * b.ease(p);
      const near = Math.max(0, 1 - Math.hypot(pointer.x - at.x, pointer.y - at.y) / 90), lift = v * s * .48 + near * 4, k = Math.min(1, Math.max(0, v));
      g.fillStyle = `hsl(${hue} 30% ${dark ? 4 : 30}% / ${.12 + .1 * k})`;
      g.beginPath();g.ellipse(at.x, at.y + 2, s * .2 + k * 2, s * .07 + k, 0, 0, 6.283);g.fill();
      const r = s * .13 + k * s * .08, y = at.y - lift, light = dark ? 50 + k * 18 : 64 - k * 14, hk = hue - 8 + 34 * k;
      const gr = g.createRadialGradient(at.x - r * .35, y - r * .4, r * .1, at.x, y, r);
      gr.addColorStop(0, `hsl(${hk} ${50 + 25 * k}% ${Math.min(92, light + 22)}%)`);gr.addColorStop(1, `hsl(${hk} ${45 + 30 * k}% ${light}%)`);
      g.fillStyle = gr;g.beginPath();g.arc(at.x, y, r, 0, 6.283);g.fill();
      if (i === origin) { g.strokeStyle = `hsl(${hue} 70% ${dark ? 74 : 40}% / .7)`;g.lineWidth = 1.5;g.beginPath();g.ellipse(at.x, at.y + 2, s * .34, s * .13, 0, 0, 6.283);g.stroke(); }
    }
    // Stones: one per family, each drawing its own curve; the chosen one glows, the rest swell toward the cursor.
    FAMILIES.forEach((name, k) => {
      const p = stoneAt(k), on = k === family, near = Math.max(0, 1 - Math.hypot(pointer.x - p.x, pointer.y - p.y) / 120), r = 23 + near * 5 + (on ? 3 : 0);
      if (on) { const gl = g.createRadialGradient(p.x, p.y, r * .5, p.x, p.y, r * 1.9);gl.addColorStop(0, `hsl(${hue + 20} 90% 60% / ${dark ? .3 : .22})`);gl.addColorStop(1, 'transparent');g.fillStyle = gl;g.beginPath();g.arc(p.x, p.y, r * 1.9, 0, 6.283);g.fill(); }
      g.fillStyle = dark ? `hsl(${hue} 14% ${on ? 20 : 15}%)` : `hsl(${hue} 40% ${on ? 97 : 95}%)`;g.beginPath();g.arc(p.x, p.y, r, 0, 6.283);g.fill();
      g.strokeStyle = `hsl(${hue} 40% ${dark ? 40 : 78}% / ${on ? 1 : .6 + near * .4})`;g.lineWidth = on ? 2 : 1;g.stroke();
      glyph(p.x, p.y, r, easingCurve({ family: name, mode: on ? MODES[mode] : 'out' }), `hsl(${hue + 20} 70% ${dark ? 70 : 44}% / ${on ? 1 : .55 + near * .45})`, on ? 2.2 : 1.6);
      g.fillStyle = `hsl(${hue} 10% ${dark ? 84 : 28}% / ${on ? 1 : .7})`;g.font = `${on ? 650 : 500} 12.5px ui-sans-serif, -apple-system, sans-serif`;g.textAlign = 'center';
      g.fillText(on ? `${name} · ${MODES[mode]}` : name, p.x, p.y + r + 18);
    });
    if (now < awakeUntil) requestAnimationFrame(frame);
    else running = false;
  };
  function wake(ms = 900) { awakeUntil = Math.max(awakeUntil, performance.now() + ms);if (!running) { running = true;requestAnimationFrame(frame); } }
  const resize = new ResizeObserver(fit);resize.observe(box);
  const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting;if (visible) wake(); });seen.observe(stage);
  const offTheme = ctx.onTheme(() => wake());
  fit();describe();
  const first = setTimeout(() => ripple(Math.floor(N / 2)), ctx.still ? 0 : 500);
  return () => { disposed = true;clearTimeout(first);events.abort();resize.disconnect();seen.disconnect();offTheme(); };
}
