// A lantern at dusk. The reader carries a light (glow, blend 'add') over a little courtyard of standing stones. Each
// stone's shadow is shadowOnPlane: its top corners projected from the light onto the ground, drawn as an ordinary
// path with a blur and a 'multiply' blend. The construction rays that solve the projection sit in a group behind an
// alphaMask, a radial gradient centred on the light, so the geometry shows only near the flame. Lift the lantern and
// the shadows shorten; lower it and they run long. Fireflies drift with their own glows, added onto the dusk.
import { scene } from '../../runtime/src/core/index.js';
import { glow, alphaMask, shadowOnPlane } from '../../runtime/src/look/index.js';
import { radialGradient, linearGradient } from '../../runtime/src/graphics/index.js';
import { noise2 } from '../../runtime/src/noise/index.js';
import { ellipsePath } from '../../runtime/src/geometry/index.js';
import { css } from './_kit.js';

const CSS = `.ll { position: relative; height: 380px; touch-action: none; cursor: grab; user-select: none; }
.ll.held { cursor: grabbing; }
.ll .explainerkit-stage { position: absolute; inset: 0; }
.ll-read { position: absolute; right: 18px; top: 14px; font: 12.5px/1.5 var(--mono); color: hsl(40 30% 86% / .8); text-align: right; pointer-events: none; font-variant-numeric: tabular-nums; }`;

// Standing stones: x across, depth y (0 = nearest), half-width and height, in ground units.
const STONES = [[-250, 150, 16, 92], [-150, 40, 20, 118], [-40, 175, 14, 70], [70, 70, 22, 136], [190, 135, 15, 84], [280, 30, 18, 104]];

export default async function lookLantern(stage, ctx) {
  css('look-lantern', CSS);
  stage.innerHTML = '<div class="ll" role="img" aria-label="Drag the lantern over the standing stones; their shadows follow the light"><div class="ll-read"></div></div>';
  const box = stage.querySelector('.ll'), read = box.querySelector('.ll-read');
  const events = new AbortController(), listen = {signal: events.signal};
  const H = 380, W = Math.max(520, Math.round(box.clientWidth || 900)), cx = W / 2, base = 352;
  // Oblique ground: depth rises up the screen, height rises straight up.
  const sx = (x) => cx + x, sy = (y, z = 0) => base - y * .62 - z;
  const drawing = scene({ width: W, height: H, label: 'A lantern over standing stones', description: 'Shadows projected from a point light onto the ground.' });
  const dusk = () => ctx.dark();
  const sky = drawing.rect({ x: 0, y: 0, width: W, height: H });
  const ground = drawing.path({ commands: [['M', 0, sy(250)], ['L', W, sy(250)], ['L', W, H], ['L', 0, H], ['Z']] });
  const pool = drawing.ellipse({ x: cx, y: sy(110), rx: 150, ry: 46, blur: 18, blend: 'add', opacity: .5 });
  const shadows = STONES.map(() => drawing.path({ commands: [['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['Z']], fill: '#2a2440', blur: 2.5, blend: 'multiply', opacity: .75 }));
  // The construction: rays from the flame past each stone's top to the tip of its shadow, revealed near the light.
  const rays = drawing.group({});
  const rayLines = STONES.map(() => rays.line({ x1: 0, y1: 0, x2: 1, y2: 1, strokeWidth: 1.2, strokeDasharray: [3, 5] }));
  const tips = STONES.map(() => rays.circle({ x: 0, y: 0, r: 3 }));
  // Stones painted far to near, each a slab with a lit cap.
  const order = STONES.map((s, i) => i).sort((a, b) => STONES[b][1] - STONES[a][1]);
  const stones = [];
  for (const i of order) {
    const [x, y, w, h] = STONES[i];
    stones[i] = { body: drawing.rect({ x: sx(x) - w, y: sy(y, h), width: w * 2, height: h, rx: w * .55 }), cap: drawing.rect({ x: sx(x) - w, y: sy(y, h), width: w * 2, height: 10, rx: 5, opacity: .5 }) };
  }
  // Fireflies: small lights with glows, added onto the dusk.
  const flies = Array.from({ length: 9 }, (_, i) => ({ k: i * 17.3, node: drawing.circle({ x: 0, y: 0, r: 2.2, fill: '#fff4c2', blend: 'add', glow: glow({ color: '#ffd36b', blur: 6, opacity: .9 }) }) }));
  const lantern = drawing.group({});
  const halo = lantern.circle({ x: 0, y: 0, r: 22, fill: '#ffe7a3', blend: 'add', blur: 16, opacity: .7 });
  const flame = lantern.circle({ x: 0, y: 0, r: 9, fill: '#fff6d8', glow: glow({ color: '#ffb84a', blur: 14, opacity: .95 }), blend: 'add' });
  void halo;void flame;

  const player = await drawing.mount(box, { controls: false, height: H });
  const svg = box.querySelector('.explainerkit-stage');
  const tallest = Math.max(...STONES.map((s) => s[3]));
  let light = { x: -60, y: 115, z: 190 }, held = false;

  const paintTheme = () => {
    const d = dusk();
    sky.set({ fill: linearGradient({ x1: 0, y1: 0, x2: 0, y2: H, stops: [{ offset: 0, color: d ? '#0d1022' : '#3a3f6e' }, { offset: .55, color: d ? '#232142' : '#8d6f96' }, { offset: 1, color: d ? '#2c2440' : '#7a5f7d' }] }) });
    ground.set({ fill: linearGradient({ x1: 0, y1: sy(250), x2: 0, y2: H, stops: [{ offset: 0, color: d ? '#2a2a3c' : '#5b5470' }, { offset: 1, color: d ? '#3a3448' : '#8a7a86' }] }) });
    pool.set({ fill: d ? '#ffcf7a' : '#ffd88f' });
    STONES.forEach((_, i) => { stones[i].body.set({ fill: d ? '#4a4660' : '#6d6782' });stones[i].cap.set({ fill: '#ffe2a8' }); });
    rayLines.forEach((l) => l.set({ stroke: '#ffe2a8' }));tips.forEach((t) => t.set({ fill: '#ffd36b' }));
  };

  const place = () => {
    light.z = Math.max(tallest + 18, Math.min(300, light.z));
    const lx = sx(light.x), ly = sy(light.y, light.z);
    lantern.set({ x: lx, y: ly });
    pool.set({ x: lx, y: sy(light.y), commands: ellipsePath({rx: 90 + light.z * .55, ry: 24 + light.z * .16}), opacity: .25 + 60 / light.z });
    let longest = 0;
    STONES.forEach(([x, y, w, h], i) => {
      // The shadow of a slab: its foot on the ground, and its two top corners carried along rays from the light.
      const top = shadowOnPlane([{ x: x - w, y, z: h }, { x: x + w, y, z: h }], { light, planeZ: 0 });
      shadows[i].set({ commands: [['M', sx(x - w), sy(y)], ['L', sx(x + w), sy(y)], ['L', sx(top[1].x), sy(top[1].y)], ['L', sx(top[0].x), sy(top[0].y)], ['Z']] });
      const tipX = (top[0].x + top[1].x) / 2, tipY = (top[0].y + top[1].y) / 2;
      rayLines[i].set({ x1: lx, y1: ly, x2: sx(tipX), y2: sy(tipY) });
      tips[i].set({ x: sx(tipX), y: sy(tipY) });
      longest = Math.max(longest, Math.hypot(tipX - x, tipY - y));
    });
    rays.set({ mask: alphaMask(radialGradient({ x: lx, y: ly, r: 260, stops: [{ offset: 0, color: '#ffffffd0' }, { offset: .55, color: '#ffffff55' }, { offset: 1, color: '#ffffff00' }] }), { x: lx - 260, y: ly - 260, width: 520, height: 520 }) });
    read.textContent = `light ${Math.round(light.z)} high · longest shadow ${Math.round(longest)}`;
  };

  const fly = (now) => {
    for (const f of flies) {
      const t = now / 1000 * .12;
      f.node.set({ x: W * (.5 + .48 * noise2(f.k, t, { seed: 7 })), y: H * (.42 + .36 * noise2(t, f.k + 40, { seed: 7 })), opacity: .45 + .55 * Math.max(0, noise2(f.k + 9, t * 3, { seed: 7 })) });
    }
  };

  const toLight = (e) => {
    const r = box.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    light = { x: Math.max(-cx + 20, Math.min(cx - 20, px - cx)), y: light.y, z: sy(light.y) - py };
    place();
  };
  box.addEventListener('pointerdown', (e) => { held = true;box.classList.add('held');box.setPointerCapture(e.pointerId);toLight(e); }, listen);
  box.addEventListener('pointermove', (e) => { if (held) toLight(e); }, listen);
  box.addEventListener('pointerup', () => { held = false;box.classList.remove('held'); }, listen);
  box.addEventListener('pointercancel', () => { held = false;box.classList.remove('held'); }, listen);

  paintTheme();place();fly(0);
  const offTheme = ctx.onTheme(paintTheme);
  void svg;void player;
  // The lantern idles in a slow sway until it is picked up; fireflies drift. Stops while the card is off screen.
  let visible = false, disposed = false, raf = 0, start = performance.now();
  const wake = () => { if (!disposed && visible && !document.hidden && !ctx.still && !raf) raf = requestAnimationFrame(loop); };
  const observer = new IntersectionObserver(([e]) => { visible = e.isIntersecting;if (!visible) {cancelAnimationFrame(raf);raf = 0;}wake(); });
  observer.observe(box);
  document.addEventListener('visibilitychange', () => {if (document.hidden) {cancelAnimationFrame(raf);raf = 0;}else wake();}, listen);
  const loop = (now) => {
    raf = 0;
    if (disposed || !visible || document.hidden || ctx.still) return;
    if (visible && !ctx.still) {
      fly(now);
      if (!held && now - start < 1e9) { light.x += (Math.sin(now / 2600) * 160 - 40 - light.x) * .02;light.z += (190 + Math.sin(now / 1900) * 50 - light.z) * .02;place(); }
    }
    wake();
  };
  box.addEventListener('pointerdown', () => { start = -Infinity; }, { once: true, signal: events.signal });
  return () => {
    if (disposed) return;disposed = true;
    cancelAnimationFrame(raf);observer.disconnect();events.abort();offTheme?.();player.dispose();
  };
}
