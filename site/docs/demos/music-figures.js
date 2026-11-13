import { scene } from '../../runtime/src/core/index.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { colour, css, ink } from './_kit.js';

const CSS = `
figure.demo .stage:has(> .ek-music-figure) { min-height:0; }
.ek-music-figure { border:1px solid var(--line); border-radius:14px; overflow:hidden; background:var(--panel); }
.ek-music-plot { min-width:0; background:hsl(var(--h) var(--tile-s) var(--tile-l)); }
.ek-music-plot svg { display:block; width:100%; height:auto; }
.ek-music-tools { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:12px 14px; }
.ek-music-tools button,.ek-music-tools select { color:var(--ink); border:1px solid var(--line); border-radius:8px; background:var(--ground); padding:5px 9px; min-height:34px; font:inherit; font-size:13px; }
.ek-music-tools button { cursor:pointer; }
.ek-music-tools button[aria-pressed="true"] { background:hsl(var(--h) var(--tile-s) var(--edge-l)); }
.ek-music-tools label,.ek-music-tools output { font-size:13px; color:var(--muted); }
.ek-music-tools label { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.ek-music-tools audio { width:min(100%, 270px); height:36px; }
.ek-music-auditions { flex:1 0 100%; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; max-width:560px; }
.ek-music-auditions[hidden] { display:none; }
.ek-music-auditions label { display:block; }
.ek-music-auditions audio { display:block; width:100%; margin-top:4px; }
.ek-music-figure :focus-visible { outline:2px solid hsl(var(--h) var(--accent-s) var(--accent-l)); outline-offset:2px; }
@media(max-width:460px) { .ek-music-tools audio { width:100%; } .ek-music-auditions { grid-template-columns:1fr; } }
`;

export function musicFigure(stage, ctx, label, height, draw, controls = '') {
  css('music-figures', CSS);
  stage.innerHTML = `<section class="ek-music-figure" aria-label="${label}">
    <div class="ek-music-plot"></div>${controls ? `<div class="ek-music-tools">${controls}</div>` : ''}
  </section>`;
  const plot = stage.querySelector('.ek-music-plot');
  const renderer = createSVGRenderer(plot, { label });
  const controller = new AbortController();
  let width = 0;
  const redraw = () => {
    width = plot.clientWidth < 460 ? 340 : 650;
    const drawing = scene({ width, height, label });
    const palette = {
      ink: ink(ctx),
      accent: colour(ctx, 0, 60, ctx.dark() ? 51 : 39),
      soft: colour(ctx, 0, 16, ctx.dark() ? 49 : 38),
      rule: colour(ctx, 0, 15, ctx.dark() ? 17 : 81),
    };
    draw(drawing, width, palette);
    renderer.render(drawing.sample());
  };
  const observer = new ResizeObserver(() => {
    if ((plot.clientWidth < 460 ? 340 : 650) !== width) redraw();
  });
  observer.observe(plot);
  const unsubscribe = ctx.onTheme(redraw);
  return {
    redraw,
    signal: controller.signal,
    dispose() {
      controller.abort();
      observer.disconnect();
      unsubscribe();
      for (const audio of stage.querySelectorAll('audio')) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      renderer.dispose();
    },
  };
}

export const labelAt = (drawing, x, y, text, fill, align = 'start') =>
  drawing.text({ x, y, text, fill, align, fontSize: 13, fontFamily: 'system-ui' });
export const rule = (drawing, x1, y1, x2, y2, stroke) => drawing.line({ x1, y1, x2, y2, stroke, strokeWidth: 1 });
export const block = (drawing, x, y, width, height, fill) =>
  drawing.rect({ x, y, width, height, fill, rx: Math.min(4, height / 2) });

export function listen(audio, signal) {
  let seek = 0;
  audio.addEventListener(
    'loadedmetadata',
    () => {
      audio.currentTime = Math.min(seek, audio.duration);
    },
    { signal },
  );
  return (asset, preserve = true) => {
    seek = preserve ? audio.currentTime : 0;
    audio.pause();
    audio.src = new URL(`./music-${asset}.mp3`, import.meta.url).href;
  };
}
