// The real Canvas renderer, updated only when the reader changes a control.
import {scene} from '../../runtime/src/core/index.js';
import {texture} from '../../runtime/src/graphics/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {css, colour, ground} from './_kit.js';

const CSS = `
.fl { padding: 22px; }
.fl-visual { max-width: 560px; margin: auto; }
.fl-visual canvas { width: 100%; height: auto; display: block; }
.fl-controls { display: flex; flex-wrap: wrap; gap: 18px 28px; align-items: center; margin-top: 12px; }
.fl-controls label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ink); }
.fl-controls input[type=range] { width: min(180px, 32vw); accent-color: hsl(var(--h) var(--accent-s) var(--accent-l)); }
.fl-controls select { max-width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--panel); font: inherit; }
.fl-status { margin: 14px 0 0; min-height: 1.5em; color: var(--muted); font-size: 13px; }
`;

export default function filmLight(stage, ctx) {
  css('film-light', CSS);
  stage.innerHTML = `<div class="fl">
    <div class="fl-visual"></div>
    <div class="fl-controls">
      <label>Light angle <input type="range" min="-180" max="180" value="-45" step="1"><output>−45°</output></label>
      <label>Surface <select><option value="grain">Grain</option><option value="paper">Paper</option><option value="halftone">Halftone</option><option value="hatch">Hatch</option><option value="none">No texture</option></select></label>
      <label><input type="checkbox" checked> Shading</label>
    </div>
    <p class="fl-status" role="status">Turn the light. The grain stays in the planet's local coordinates.</p>
  </div>`;
  const mount = stage.querySelector('.fl-visual');
  const angle = stage.querySelector('input[type=range]');
  const surface = stage.querySelector('select');
  const shade = stage.querySelector('input[type=checkbox]');
  const output = stage.querySelector('output');
  const status = stage.querySelector('.fl-status');
  const drawing = scene({width: 400, height: 240, label: 'A planet with directional light and a repeatable surface'});
  const background = drawing.rect({x: 0, y: 0, width: 400, height: 240});
  const planet = drawing.circle({x: 200, y: 120, r: 76});
  const renderer = createCanvasRenderer(mount, {pixelRatio: Math.min(devicePixelRatio || 1, 2)});
  let disposed = false;
  const render = () => {
    if (disposed) return;
    output.value = `${angle.value}°`;
    background.set({fill: ground(ctx)});
    drawing.light({angle: Number(angle.value) * Math.PI / 180, color: colour(ctx, -174, 80, 82), ambient: colour(ctx, 0, 42, 22)});
    planet.set({
      fill: colour(ctx, 0, 46, 54),
      shade: shade.checked ? {shadow: {amount: .65, distance: 18, softness: .45}, light: {amount: .48, distance: 14}, rim: {width: 3, amount: .75}} : null,
      texture: surface.value === 'none' ? null : texture({kind: surface.value, seed: 42, amount: .2, scale: 1}),
    });
    try {
      renderer.render(drawing.sample({time: 0}));
    } catch (error) {
      if (error.code !== 'RENDER_UNSUPPORTED' || error.capability !== 'shade') throw error;
      // State the capability refusal and keep the independently supported surface demonstration usable.
      shade.checked = false;
      shade.disabled = true;
      planet.set({shade: null});
      renderer.render(drawing.sample({time: 0}));
      status.textContent = 'This browser does not support the Canvas filters required for shading. Surface textures remain available.';
    }
  };
  const controls = [angle, surface, shade];
  for (const control of controls) control.addEventListener('input', render);
  const offTheme = ctx.onTheme(render);
  try {render();} catch (error) {offTheme?.();renderer.dispose();throw error;}
  return () => {
    if (disposed) return;
    disposed = true;
    for (const control of controls) control.removeEventListener('input', render);
    offTheme?.();
    renderer.dispose();
  };
}
