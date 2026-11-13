// Layers, felt. The card starts with explainerkit/core only: four pitch circles, drawn by the scene. Touch one and the
// demo imports explainerkit/mechanisms on the spot (a real dynamic import; the readout counts the files it fetched).
// The circles grow involute teeth, mesh, and turn together: grab any gear and spin it, let go and it coasts. The two
// swatches change the application (a brass watch or a blueprint); the mechanical model never changes.
import { scene } from '../../runtime/src/core/index.js';
import { inertia, velocityTracker } from '../../runtime/src/physics/index.js';
import { css, colour, ink } from './_kit.js';

const CSS = `
.lg { position: relative; height: 340px; overflow: hidden; touch-action: none; cursor: grab; }
.lg.held { cursor: grabbing; }
.lg-mount { position: absolute; inset: 0; }
.lg-read { position: absolute; left: 22px; top: 18px; display: grid; gap: 6px; pointer-events: none; }
.lg-row { display: flex; align-items: baseline; gap: 10px; font: 12.5px/1.3 var(--mono); color: var(--muted); }
.lg-row b { font: 600 13px/1.3 var(--mono); color: var(--ink); }
.lg-row.off { opacity: .38; }
.lg-row i { font-style: normal; color: hsl(var(--h) var(--accent-s) var(--accent-l)); }
.lg-hint { position: absolute; left: 22px; bottom: 16px; right: 140px; margin: 0; font-size: 13.5px; color: var(--muted); pointer-events: none; }
.lg-skins { position: absolute; right: 18px; bottom: 14px; display: flex; gap: 12px; align-items: end; }
.lg-skin { all: unset; cursor: pointer; display: grid; justify-items: center; gap: 5px; font: 11px/1 var(--sans); letter-spacing: .04em; color: var(--muted); }
.lg-skin span { width: 34px; height: 34px; border-radius: 50%; box-shadow: 0 2px 8px rgb(0 0 0 / .18), inset 0 0 0 2px hsl(0 0% 100% / .35); transition: transform .45s cubic-bezier(.3, 1.7, .4, 1); }
.lg-skin:hover span, .lg-skin:focus-visible span { transform: scale(1.22); }
.lg-skin[aria-pressed="true"] { color: var(--ink); }
.lg-skin[aria-pressed="true"] span { transform: scale(1.12); box-shadow: 0 0 0 3px var(--panel), 0 0 0 5px hsl(var(--h) var(--accent-s) var(--accent-l)); }
`;

const MODULE = 4;
// Teeth, and the direction from the gear each one meshes with (radians). Positions follow from the pitch radii.
const TRAIN = [
  { id: 'crown', teeth: 26 },
  { id: 'pinion', teeth: 14, on: 0, angle: -.42 },
  { id: 'wheel', teeth: 34, on: 1, angle: .55 },
  { id: 'escape', teeth: 11, on: 0, angle: 2.55 },
];

export default async function layersGears(stage, ctx) {
  css('layers-gears', CSS);
  stage.innerHTML = `<div class="lg"><div class="lg-mount"></div>
    <div class="lg-read">
      <div class="lg-row"><b>explainerkit/core</b><span class="lg-core">loaded with the page</span></div>
      <div class="lg-row off lg-mech"><b>explainerkit/mechanisms</b><span class="lg-mech-note">not imported yet</span></div>
      <div class="lg-row off lg-ratio"><span>input</span><i class="lg-in">0.00</i><span>wheel turns ×</span><i class="lg-r">–</i></div>
    </div>
    <p class="lg-hint">The core draws four circles. Touch one to import the gear model.</p>
    <div class="lg-skins" role="group" aria-label="Application style">
      <button class="lg-skin" type="button" data-skin="brass" aria-pressed="true"><span></span>watch</button>
      <button class="lg-skin" type="button" data-skin="print" aria-pressed="false"><span></span>blueprint</button>
    </div></div>`;
  const box = stage.querySelector('.lg'), mount = box.querySelector('.lg-mount'), hint = box.querySelector('.lg-hint');
  const mechRow = box.querySelector('.lg-mech'), mechNote = box.querySelector('.lg-mech-note'), ratioRow = box.querySelector('.lg-ratio');
  const inLabel = box.querySelector('.lg-in'), ratioLabel = box.querySelector('.lg-r');
  const H = 340, W = Math.max(360, Math.round(box.clientWidth || 720));

  // Place the train from pitch radii, so centre distances are exact sums. The whole train is centred in the card.
  const placed = [];
  for (const g of TRAIN) {
    const r = (g.teeth * MODULE) / 2;
    if (g.on === undefined) placed.push({ ...g, r, x: 0, y: 0 });
    else { const p = placed[g.on], d = p.r + r;placed.push({ ...g, r, x: p.x + d * Math.cos(g.angle), y: p.y + d * Math.sin(g.angle) }); }
  }
  const minX = Math.min(...placed.map((g) => g.x - g.r)), maxX = Math.max(...placed.map((g) => g.x + g.r));
  const minY = Math.min(...placed.map((g) => g.y - g.r)), maxY = Math.max(...placed.map((g) => g.y + g.r));
  const ox = W * .58 - (minX + maxX) / 2, oy = H / 2 - (minY + maxY) / 2 + 6;
  for (const g of placed) { g.x += ox;g.y += oy; }

  const drawing = scene({ width: W, height: H, label: 'A gear train', description: 'Four meshed gears; the model comes from explainerkit/mechanisms.' });
  const turn = drawing.parameter(0, { min: -1e6, max: 1e6 });
  const cx = (minX + maxX) / 2 + ox, cy = (minY + maxY) / 2 + oy;
  const plate = drawing.circle({ x: cx, y: cy, r: Math.min(H / 2 - 6, Math.max(...placed.map((g) => Math.hypot(g.x - cx, g.y - cy) + g.r * .55))), fill: '#ffffff', opacity: 0 });
  const pitch = placed.map((g) => drawing.circle({ x: g.x, y: g.y, r: g.r, fill: 'none', stroke: '#888888', strokeWidth: 1.5, strokeDasharray: [4, 5] }));
  const hubs = placed.map((g) => drawing.circle({ x: g.x, y: g.y, r: Math.max(5, g.r * .14), fill: '#888888' }));
  let gears = [], skin = 'brass', model = null;

  const paint = () => {
    const dark = ctx.dark(), brass = skin === 'brass';
    plate.set({ opacity: model ? (brass ? (dark ? .5 : .9) : .55) : 0, fill: brass ? colour(ctx, -176, 22, dark ? 18 : 93) : colour(ctx, 0, 40, dark ? 20 : 95), stroke: brass ? colour(ctx, -180, 30, dark ? 34 : 80) : colour(ctx, 0, 50, dark ? 42 : 78), strokeWidth: 2 });
    pitch.forEach((c) => c.set({ stroke: model ? colour(ctx, 0, 40, dark ? 46 : 70) : ink(ctx), opacity: model ? (brass ? 0 : .55) : .55 }));
    gears.forEach((p, i) => {
      // Healthy variation: each gear's tone leans a little, so the train reads as metal, not a clone.
      const lean = [0, 8, -6, 12][i], light = [52, 44, 58, 40][i];
      p.set(brass
        ? { fill: colour(ctx, -176 + lean, 62 - i * 4, dark ? light - 10 : light), stroke: colour(ctx, -180 + lean, 50, dark ? 26 : 30), strokeWidth: 1.2 }
        : { fill: colour(ctx, 0, 60, dark ? 30 : 92), stroke: colour(ctx, 4 * i, 72, dark ? 58 : 42), strokeWidth: 1.6 });
    });
    hubs.forEach((h, i) => h.set({ fill: brass ? colour(ctx, -186, 30, dark ? 22 : 24) : colour(ctx, 4 * i, 72, dark ? 58 : 42) }));
    box.querySelectorAll('.lg-skin').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.skin === skin));
      b.querySelector('span').style.background = b.dataset.skin === 'brass'
        ? `radial-gradient(circle at 35% 30%, ${colour(ctx, -170, 70, 70)}, ${colour(ctx, -180, 60, 38)})`
        : `repeating-linear-gradient(0deg, ${colour(ctx, 0, 70, 55)} 0 1px, transparent 1px 6px), ${colour(ctx, 0, 60, ctx.dark() ? 26 : 90)}`;
    });
  };

  const player = await drawing.mount(mount, { controls: false, height: H });
  paint();
  const offTheme = ctx.onTheme(paint);
  box.querySelectorAll('.lg-skin').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation();skin = b.dataset.skin;paint(); }));
  box.querySelectorAll('.lg-skin').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));

  // The optional model arrives on first touch: a real dynamic import, timed and counted from resource timing.
  let loading = null;
  const load = () => loading ??= (async () => {
    const before = new Set(performance.getEntriesByType('resource').map((e) => e.name)), start = performance.now();
    const { mechanism, gearPath } = await import('../../runtime/src/mechanisms/index.js');
    const ms = performance.now() - start, files = performance.getEntriesByType('resource').filter((e) => !before.has(e.name) && /\.js(\?|$)/.test(e.name)).length;
    const train = mechanism(), parts = [];
    placed.forEach((g, i) => {
      const part = train.gear({ id: g.id, x: g.x, y: g.y, teeth: g.teeth, module: MODULE });
      if (g.on !== undefined) part.meshWith(parts[g.on], { phase: 'interlock', tolerance: 1e-6 });
      parts.push(part);
    });
    const pose = train.derive(drawing, turn); // one sample of the model per frame, shared by every gear
    gears = placed.map((g, i) => {
      const path = drawing.path({ commands: gearPath({ teeth: g.teeth, module: MODULE, bore: Math.max(3, g.r * .14) }), x: g.x, y: g.y, fillRule: 'evenodd', scaleX: .2, scaleY: .2 });
      path.bind('rotation', { inputs: [pose], map: (p) => p[g.id].rotation });
      return path;
    });
    hubs.forEach((h) => h.set({ opacity: 0 }));
    model = { train, ratios: placed.map((g) => train.sample(1)[g.id].rotation) };
    paint();
    // The teeth grow out on a spring, each gear a beat after the last.
    const t0 = performance.now();
    const grow = (now) => {
      let busy = false;
      gears.forEach((p, i) => {
        const t = Math.max(0, (now - t0) / 1000 - i * .09), k = ctx.still ? 1 : 1 - Math.exp(-7 * t) * Math.cos(11 * t);
        busy ||= t < 1.4 && !ctx.still;
        p.set({ scaleX: .2 + .8 * k, scaleY: .2 + .8 * k });
      });
      if (busy) requestAnimationFrame(grow); else gears.forEach((p) => p.set({ scaleX: 1, scaleY: 1 }));
    };
    requestAnimationFrame(grow);
    mechRow.classList.remove('off');ratioRow.classList.remove('off');
    mechNote.textContent = files ? `imported on first touch: ${files} file${files === 1 ? '' : 's'}, ${Math.round(ms)} ms` : `imported on first touch, ${Math.round(ms)} ms`;
    ratioLabel.textContent = (model.ratios[2]).toFixed(3);
    hint.textContent = 'Grab any gear and spin it. Let go and it coasts. Same model, whichever swatch you pick.';
    return model;
  })();

  // Spin: the angle of the pointer about the grabbed gear's centre, divided by that gear's ratio, is the train input.
  const toScene = (e) => { const r = mount.getBoundingClientRect();return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  let grab = null, coast = null, frame = 0, pressed = false;
  const tracker = velocityTracker({ window: .1 });
  const show = () => { inLabel.textContent = turn.value.toFixed(2); };
  box.addEventListener('pointerdown', async (e) => {
    const p = toScene(e), hit = placed.map((g, i) => [i, Math.hypot(p.x - g.x, p.y - g.y) - g.r]).sort((a, b) => a[1] - b[1])[0];
    if (hit[1] > 30) return;
    pressed = true;box.setPointerCapture(e.pointerId);box.classList.add('held');
    const m = await load();
    if (!pressed) return;
    const g = placed[hit[0]], k = m.ratios[hit[0]];
    cancelAnimationFrame(frame);coast = null;tracker.clear();
    grab = { g, k, last: Math.atan2(p.y - g.y, p.x - g.x), input: turn.value };
  });
  box.addEventListener('pointermove', (e) => {
    if (!grab) return;
    const p = toScene(e), a = Math.atan2(p.y - grab.g.y, p.x - grab.g.x);
    let d = a - grab.last;if (d > Math.PI) d -= 2 * Math.PI;if (d < -Math.PI) d += 2 * Math.PI;
    grab.last = a;grab.input += d / grab.k;
    turn.set(grab.input);tracker.add(performance.now() / 1000, { x: grab.input, y: 0 });show();
  });
  const release = () => {
    pressed = false;box.classList.remove('held');
    if (!grab) return;
    box.classList.remove('held');
    const v = ctx.still ? 0 : Math.max(-40, Math.min(40, tracker.sample(performance.now() / 1000).x));
    coast = inertia({ from: turn.value, velocity: v, friction: 1.1, at: 0 });grab = null;
    const t0 = performance.now();
    const step = (now) => {
      const s = coast.state(Math.max(0, (now - t0) / 1000));turn.set(s.value);show();
      if (Math.abs(s.velocity) > .002) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);
  return () => { cancelAnimationFrame(frame);offTheme();player.dispose?.(); };
}
