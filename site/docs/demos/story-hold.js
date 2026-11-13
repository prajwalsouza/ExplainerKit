// Story scroll, felt: a seed grows into a flower as you scroll inside the card. At five seconds there is a hold: you
// keep scrolling, the flower waits. A graph beside it draws the story's map (scroll position against story time), with
// the hold as a flat step, and a dot that follows you along it.
import { scene } from '../../runtime/src/core/index.js';
import { attachStory } from '../../runtime/src/story/index.js';
import { css, colour as tint } from './_kit.js';

const CSS = `
.sh { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); min-height: 340px; }
.sh-scroll { position: relative; height: 340px; overflow-y: auto; overscroll-behavior: contain; border-right: 1px solid hsl(var(--h) 20% var(--edge-l)); scrollbar-width: thin; }
.sh-pin { height: 340px; }
.sh-side { padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 12px; }
.sh-read { display: flex; align-items: baseline; gap: 12px; }
.sh-time { font: 650 34px/1 var(--display); letter-spacing: -.02em; color: var(--ink); font-variant-numeric: tabular-nums; }
.sh-state { font: 600 12px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; padding: 5px 9px; border-radius: 999px; background: hsl(var(--h) 50% 50% / .12); color: hsl(var(--h) var(--accent-s) var(--accent-l)); transition: background-color .3s, color .3s; }
.sh-state.held { background: hsl(var(--h) var(--accent-s) var(--accent-l)); color: var(--panel); }
.sh-graph { width: 100%; height: auto; overflow: visible; }
.sh-hint { margin: 0; font-size: 13.5px; color: var(--muted); }
@media (max-width: 760px) { .sh { grid-template-columns: 1fr; } .sh-scroll { border-right: 0; border-bottom: 1px solid hsl(var(--h) 20% var(--edge-l)); } }
`;

export default async function storyHold(stage, ctx) {
  css('story-hold', CSS);
  stage.innerHTML = `<div class="sh">
    <div class="sh-scroll" tabindex="0" aria-label="A scroll story. Scroll inside this panel to grow the flower."><div class="sh-region"><div class="sh-pin"></div></div></div>
    <div class="sh-side">
      <div class="sh-read"><b class="sh-time">0.0 s</b><span class="sh-state">moving</span></div>
      <svg class="sh-graph" viewBox="0 0 220 132" role="img" aria-label="Story time against scroll position, with a flat step at the hold"></svg>
      <p class="sh-hint">Scroll inside the left panel. Halfway, the bud holds: the scroll keeps going, the story clock does not. Scroll back up and every frame returns exactly.</p>
    </div></div>`;
  const scroller = stage.querySelector('.sh-scroll'), region = stage.querySelector('.sh-region'), pin = stage.querySelector('.sh-pin');
  const timeLabel = stage.querySelector('.sh-time'), stateLabel = stage.querySelector('.sh-state'), graph = stage.querySelector('.sh-graph');

  // The film: ten seconds. A seed swells, a stem draws itself, two leaves unfold, the bud waits (the hold, at five
  // seconds), then six petals open and the flower turns to face you.
  // The scene takes the panel's own shape, so nothing is cropped at any width; everything is placed from its centre.
  const H = 340, W = Math.max(240, Math.round((H * pin.clientWidth) / Math.max(1, pin.clientHeight))), cx = W / 2, drawing = scene({ width: W, height: H, duration: 10, label: 'A seed grows into a flower', description: 'A scroll story with a hold at five seconds, while the bud waits.' });
  const colour = (dh, s, l) => tint(ctx, dh, s, l);
  const ground = drawing.line({ x1: cx - 140, y1: 286, x2: cx + 140, y2: 286, stroke: colour(30, 20, 70), strokeWidth: 2, strokeLinecap: 'round' });
  const seed = drawing.ellipse({ x: cx, y: 282, rx: 10, ry: 7, fill: colour(30, 40, 38) });
  seed.animate('scaleX', { from: 1, to: 1.5, at: 0, duration: .8, ease: 'easeOut' }).animate('scaleY', { from: 1, to: 1.5, at: 0, duration: .8, ease: 'easeOut' });
  seed.animate('opacity', { from: 1, to: 0, at: 1, duration: .6 });
  const stem = drawing.path({ commands: [['M', cx, 284], ['C', cx - 4, 230, cx + 8, 180, cx, 120]], stroke: colour(110, 38, 40), strokeWidth: 6, strokeLinecap: 'round', fill: 'none', trimEnd: 0 });
  stem.animate('trimEnd', { from: 0, to: 1, at: .6, duration: 2.6, ease: 'easeInOut' });
  const leaf = (side, at) => {
    const l = drawing.ellipse({ x: cx + side * 22, y: 214, rx: 22, ry: 9, rotation: side * -.5, fill: colour(105, 42, 46), scaleX: 0, scaleY: 0 });
    l.animate('scaleX', { from: 0, to: 1, at, duration: .9, ease: 'easeOut' }).animate('scaleY', { from: 0, to: 1, at, duration: .9, ease: 'easeOut' });
  };
  leaf(-1, 2.4);leaf(1, 3);
  const flower = drawing.group({ x: cx, y: 120 });
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2, p = flower.ellipse({ x: 0, y: 0, rx: 10, ry: 22, rotation: a, fill: colour(-10 + i * 6, 70, 62), opacity: 0 });
    p.to(5, { x: Math.sin(a) * 2, y: -Math.cos(a) * 2, opacity: 1 }, { duration: .01 });
    p.to(5.3 + i * .12, { x: Math.sin(a) * 22, y: -Math.cos(a) * 22 }, { duration: 1.4, ease: 'easeOut' });
    return p;
  });
  void petals;
  const bud = flower.circle({ x: 0, y: 0, r: 0, fill: colour(-20, 70, 52) });
  bud.animate('r', { from: 0, to: 13, at: 3.4, duration: 1.2, ease: 'easeOut' });
  const centre = flower.circle({ x: 0, y: 0, r: 0, fill: colour(30, 80, 58) });
  centre.animate('r', { from: 0, to: 10, at: 6.2, duration: .8, ease: 'easeOut' });
  flower.animate('rotation', { from: 0, to: .35, at: 7, duration: 3, ease: 'easeInOut' });

  const player = await drawing.mount(pin, { controls: false, height: H });
  const story = attachStory(player, {
    element: region, container: scroller, sticky: pin, smoothing: .08,
    acts: [{ id: 'grow', from: 0, to: 10, length: 1100, holds: [{ at: 5, length: 300 }] }],
  });

  // The story's map as a graph: scroll position (across) against time (up). The hold is the flat step.
  const map = story.timeline, steps = 120, pts = [];
  for (let k = 0; k <= steps; k++) { const pos = (k / steps) * map.length, t = map.sample(pos).time;pts.push([10 + (pos / map.length) * 200, 120 - (t / 10) * 108]); }
  const accent = () => `hsl(${ctx.hue} 70% ${ctx.dark() ? 66 : 46}%)`;
  graph.innerHTML = `<line x1="10" y1="120" x2="212" y2="120" stroke="currentColor" opacity=".25"/><line x1="10" y1="120" x2="10" y2="8" stroke="currentColor" opacity=".25"/>
    <text x="212" y="131" font-size="8" text-anchor="end" fill="currentColor" opacity=".55">scroll →</text><text x="13" y="8" font-size="8" fill="currentColor" opacity=".55">time ↑</text>
    <polyline class="curve" fill="none" stroke-width="2.4" stroke-linejoin="round" points="${pts.map((p) => p.join(',')).join(' ')}"/>
    <circle class="dot" r="5"/>`;
  graph.style.color = 'var(--muted)';
  const curve = graph.querySelector('.curve'), dot = graph.querySelector('.dot');
  const paint = () => { curve.setAttribute('stroke', accent());dot.setAttribute('fill', accent()); };
  paint();
  ctx.onTheme(() => { paint(); });

  const read = () => {
    const pos = Math.min(map.length, scroller.scrollTop), s = map.sample(pos);
    timeLabel.textContent = `${s.time.toFixed(1)} s`;
    stateLabel.textContent = s.hold !== null ? 'held' : pos >= map.length - 1 ? 'the end' : 'moving';
    stateLabel.classList.toggle('held', s.hold !== null);
    dot.setAttribute('cx', 10 + (pos / map.length) * 200);dot.setAttribute('cy', 120 - (s.time / 10) * 108);
  };
  scroller.addEventListener('scroll', read, { passive: true });
  read();
}
