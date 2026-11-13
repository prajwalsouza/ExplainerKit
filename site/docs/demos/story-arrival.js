// Arriving part-way, embodied. A three-act story is a glowing ribbon; the reader is a light you drag along it to the
// place they reloaded. Four portals float below: hover one and a comet replays that way in (arrivalPlan and arrivalTime
// from explainerkit/story), from where it begins to the reader's place, leaving a trail.
import { arrivalPlan, arrivalTime } from '../../runtime/src/story/index.js';
import { css } from './_kit.js';

const CSS = `.sa { position: relative; height: 330px; cursor: default; } .sa canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.sa-say { position: absolute; left: 26px; right: 26px; bottom: 16px; font-size: 13.5px; color: var(--muted); pointer-events: none; transition: opacity .3s; }`;
const MODES = [
  ['jump', 'Jump', 'The frame at the reader’s place, at once. Nothing replays; the default.'],
  ['travel', 'Travel', 'A short replay from the very start, so the reader sees how they got here.'],
  ['chapter', 'Chapter', 'The current act plays in from its own start.'],
  ['top', 'Top', 'Back to the beginning; the story waits there.'],
];
const ACTS = [['question', 0, 8], ['evidence', 8, 18], ['answer', 18, 24]], DURATION = 24;

export default async function storyArrival(stage, ctx) {
  css('story-arrival', CSS);
  stage.innerHTML = '<div class="sa"><canvas aria-label="Drag the reader along the story; hover a portal to replay that way in" role="img"></canvas><div class="sa-say">Drag the light along the story to where the reader reloaded. Then hover a portal.</div></div>';
  const box = stage.querySelector('.sa'), canvas = box.querySelector('canvas'), g = canvas.getContext('2d'), say = box.querySelector('.sa-say');
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
  const fit = () => { const r = devicePixelRatio || 1;w = box.clientWidth;h = box.clientHeight;canvas.width = w * r;canvas.height = h * r;g.setTransform(r, 0, 0, r, 0, 0);wake(); };
  const resize = new ResizeObserver(fit);resize.observe(box);
  const x = (t) => 40 + (t / DURATION) * (w - 80), ribbonY = () => 96;
  const portalAt = (k) => ({ x: w * (0.2 + k * 0.2), y: 214 });
  const hue = (k = 0) => ctx.hue + k;
  const light = () => (ctx.dark() ? 64 : 52);
  let captured = null;
  const releaseCapture = () => { if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);captured = null;drag = false; };
  let target = 15, drag = false, hover = -1, plan = null, started = 0, pointer = { x: -1e3, y: -1e3 }, trail = [], sparks = [];
  const local = (e) => { const r = canvas.getBoundingClientRect();return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const pointerDown = (e) => { if (!allowed()) return;const p = local(e);if (Math.abs(p.y - ribbonY()) < 26) { drag = true;canvas.setPointerCapture(e.pointerId);captured = e.pointerId;target = Math.max(.5, Math.min(DURATION - .5, ((p.x - 40) / (w - 80)) * DURATION));plan = null;wake(); } };
  const pointerMove = (e) => {
    if (!allowed()) return;
    pointer = local(e);
    if (drag) { target = Math.max(.5, Math.min(DURATION - .5, ((pointer.x - 40) / (w - 80)) * DURATION));plan = null;wake();return; }
    const k = MODES.findIndex((_, i) => Math.hypot(pointer.x - portalAt(i).x, pointer.y - portalAt(i).y) < 34);
    canvas.style.cursor = k >= 0 || Math.abs(pointer.y - ribbonY()) < 26 ? 'pointer' : 'default';
    if (k !== hover) {
      hover = k;
      if (k >= 0) {
        plan = arrivalPlan({ mode: MODES[k][0], time: target, duration: DURATION, chapters: ACTS.map(([, a]) => a) });
        started = performance.now();trail = [];sparks = [];wake((plan.seconds + 2.2) * 1000);
        say.textContent = `${MODES[k][2]}${plan.seconds ? ` ${plan.from.toFixed(1)} s → ${plan.to.toFixed(1)} s in ${plan.seconds.toFixed(2)} s.` : ''}`;
      }
    }
    wake();
  };
  const pointerUp = () => { releaseCapture();wake(); };
  const pointerLeave = () => { hover = -1;pointer = { x: -1e3, y: -1e3 };wake(); };
  canvas.addEventListener('pointerdown', pointerDown, {signal: events.signal});
  canvas.addEventListener('pointermove', pointerMove, {signal: events.signal});
  addEventListener('pointerup', pointerUp, {signal: events.signal});
  canvas.addEventListener('pointercancel', pointerUp, {signal: events.signal});
  canvas.addEventListener('pointerleave', pointerLeave, {signal: events.signal});

  const frame = (now) => {
    request = null;if (!allowed()) return;
    const reduced = still(), motionTime = reduced ? 0 : now;
    g.clearRect(0, 0, w, h);
    const y = ribbonY(), dark = ctx.dark();
    // The ribbon: three acts as soft glowing bands with a hairline between them.
    ACTS.forEach(([name, a, b], k) => {
      const gr = g.createLinearGradient(x(a), 0, x(b), 0);
      gr.addColorStop(0, `hsl(${hue(k * 26 - 26)} 70% ${light()}% / .55)`);gr.addColorStop(1, `hsl(${hue(k * 26 - 14)} 70% ${light()}% / .85)`);
      g.fillStyle = gr;g.beginPath();g.roundRect(x(a) + 3, y - 9, x(b) - x(a) - 6, 18, 9);g.fill();
      g.fillStyle = `hsl(${hue()} 10% ${dark ? 70 : 40}% / .8)`;g.font = '500 12px ui-sans-serif, -apple-system, sans-serif';g.textAlign = 'center';g.fillText(name, (x(a) + x(b)) / 2, y + 34);
    });
    // The replay: a comet from where the way in begins to the reader's place, shedding a trail and sparks.
    let at = target;
    if (plan) {
      const t = reduced ? plan.to : arrivalTime(plan, Math.max(0, (now - started) / 1000 - .25), target);
      at = plan.rewind ? 0 : t;
      if (!reduced && now - started < (plan.seconds + .25) * 1000) trail.push({ x: x(at), y, life: 1 });
      if (!reduced && now - started < (plan.seconds + .25) * 1000 && Math.random() < .6) sparks.push({ x: x(at), y, vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 40, life: 1 });
    }
    if (reduced) { trail = [];sparks = []; }
    trail.forEach((p) => { p.life -= .012; });trail = trail.filter((p) => p.life > 0);
    for (let i = 1; i < trail.length; i++) { const p = trail[i], q = trail[i - 1];g.strokeStyle = `hsl(${hue(20)} 90% ${dark ? 72 : 56}% / ${p.life * .8})`;g.lineWidth = 6 * p.life;g.lineCap = 'round';g.beginPath();g.moveTo(q.x, q.y);g.lineTo(p.x, p.y);g.stroke(); }
    sparks.forEach((p) => { p.x += p.vx / 60;p.y += p.vy / 60;p.vy += 2;p.life -= .02; });sparks = sparks.filter((p) => p.life > 0);
    for (const p of sparks) { g.fillStyle = `hsl(${hue(30)} 90% 70% / ${p.life})`;g.beginPath();g.arc(p.x, p.y, 1.6, 0, 6.283);g.fill(); }
    // The reader: a light on the ribbon, haloed, with its time.
    const rx = x(plan && plan.seconds ? at : plan?.rewind ? 0 : target), pulse = 1 + .08 * Math.sin(motionTime / 300);
    const halo = g.createRadialGradient(rx, y, 0, rx, y, 30 * pulse);halo.addColorStop(0, `hsl(${hue(10)} 90% ${dark ? 76 : 60}% / .55)`);halo.addColorStop(1, 'transparent');
    g.fillStyle = halo;g.beginPath();g.arc(rx, y, 30 * pulse, 0, 6.283);g.fill();
    g.fillStyle = dark ? '#fff' : `hsl(${hue(10)} 90% 40%)`;g.beginPath();g.arc(rx, y, 7, 0, 6.283);g.fill();
    g.fillStyle = `hsl(${hue()} 10% ${dark ? 88 : 22}%)`;g.font = '600 13px ui-sans-serif, -apple-system, sans-serif';g.textAlign = 'center';
    g.fillText(`${(plan && plan.seconds ? at : plan?.rewind ? 0 : target).toFixed(1)} s`, rx, y - 22);
    // The ghost of the reader's place when the replay is elsewhere.
    if (plan && Math.abs(rx - x(target)) > 2) { g.strokeStyle = `hsl(${hue()} 20% ${dark ? 70 : 40}% / .5)`;g.setLineDash([3, 4]);g.beginPath();g.arc(x(target), y, 10, 0, 6.283);g.stroke();g.setLineDash([]); }
    // The portals: rings that swell toward the cursor and glow when hovered.
    MODES.forEach(([, label], k) => {
      const p = portalAt(k), near = Math.max(0, 1 - Math.hypot(pointer.x - p.x, pointer.y - p.y) / 140), on = k === hover, r = 22 + near * 6 + (on ? 4 : 0);
      if (on) { const gl = g.createRadialGradient(p.x, p.y, r * .4, p.x, p.y, r * 2);gl.addColorStop(0, `hsl(${hue(k * 22 - 30)} 90% 60% / .35)`);gl.addColorStop(1, 'transparent');g.fillStyle = gl;g.beginPath();g.arc(p.x, p.y, r * 2, 0, 6.283);g.fill(); }
      g.lineWidth = on ? 3 : 1.6;g.strokeStyle = `hsl(${hue(k * 22 - 30)} 70% ${light()}% / ${on ? 1 : .55 + near * .4})`;
      g.beginPath();g.arc(p.x, p.y, r, 0, 6.283);g.stroke();
      g.beginPath();g.arc(p.x, p.y, r * .55, -motionTime / 900 * (k % 2 ? 1 : -1), -motionTime / 900 * (k % 2 ? 1 : -1) + Math.PI * (0.6 + near));g.stroke();
      g.fillStyle = `hsl(${hue()} 10% ${dark ? 86 : 26}% / ${on ? 1 : .75})`;g.font = `${on ? 650 : 500} 13px ui-sans-serif, -apple-system, sans-serif`;g.fillText(label, p.x, p.y + r + 20);
    });
    if (!reduced && now < until) request = requestAnimationFrame(frame);
  };
  const visibility = () => { stop();if (!allowed()) releaseCapture();if (allowed()) wake(); };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting;visibility(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', visibility, {signal: events.signal});
  media.addEventListener('change', () => { reducedMotion = media.matches;visibility(); }, {signal: events.signal});
  const offTheme = ctx.onTheme(() => wake());
  fit();
  return () => {
    if (disposed) return;
    disposed = true;stop();events.abort();resize.disconnect();observer.disconnect();offTheme();
    releaseCapture();trail = [];sparks = [];
  };
}
