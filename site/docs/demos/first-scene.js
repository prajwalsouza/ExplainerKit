// A small working explanation of scene → frame → renderer. Playback uses the library's clock.
import {scene} from '../../runtime/src/core/index.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {createProjectionPlayer} from '../../runtime/src/player/index.js';
import {css, colour} from './_kit.js';

const CSS = `
.fs-demo { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(180px,1fr); gap:14px; padding:16px; }
.fs-demo section { min-width:0; border-radius:16px; padding:24px; background:var(--panel); }
.fs-demo .fs-visual { grid-row:span 2; display:flex; flex-direction:column; }
.fs-demo h3 { margin:0 0 8px; font:650 21px/1.2 var(--display); letter-spacing:-.025em; }
.fs-demo p { margin:0; color:var(--muted); font-size:14px; }
.fs-demo .fs-mount { flex:1; min-height:160px; display:grid; align-items:center; }
.fs-demo .fs-mount svg { width:100%; max-height:240px; }
.fs-demo .fs-controls { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:14px; margin-top:10px; }
.fs-demo button { border:1px solid var(--line); border-radius:999px; padding:8px 16px; font:600 13px var(--sans); color:var(--ink); background:var(--ground); cursor:pointer; min-height:38px; }
.fs-demo button:disabled { cursor:default; opacity:.65; }
.fs-demo input { min-width:0; width:100%; accent-color:hsl(var(--h) 55% 45%); }
.fs-demo output { white-space:nowrap; font:12px var(--mono); color:var(--muted); }
.fs-demo .fs-position { display:block; margin:18px 0 8px; font:650 32px/1 var(--display); letter-spacing:-.03em; color:var(--ink); }
.fs-demo .fs-note { margin-top:12px; font-size:12px; }
@media(max-width:680px) { .fs-demo { grid-template-columns:repeat(2,minmax(0,1fr)); padding:10px; gap:10px; } .fs-demo .fs-visual { grid-column:1/-1; grid-row:auto; } .fs-demo section { padding:18px; } .fs-demo h3 { font-size:18px; } .fs-demo .fs-controls { gap:8px; } }
@media(max-width:380px) { .fs-demo { grid-template-columns:1fr; } .fs-demo .fs-visual { grid-column:auto; } }
`;

export default function firstScene(stage, ctx) {
  css('first-scene', CSS);
  stage.innerHTML = `<div class="fs-demo">
    <section class="fs-visual"><h3>Move through a moment.</h3><p>Play the scene, or move the time slider in either direction.</p><div class="fs-mount"></div><div class="fs-controls"><button type="button">Play</button><input type="range" min="0" max="2" step="0.01" value="1.5" aria-label="Scene time in seconds"><output>1.50 s</output></div><p class="fs-note">Rendered with ExplainerKit’s SVG renderer.</p></section>
    <section><h3>Describe it once.</h3><p>The circle waits for one second, then travels from x = 40 to x = 200.</p></section>
    <section><h3>Choose any moment.</h3><output class="fs-position">x = 120</output><p>At 1.5 seconds it is halfway. Returning to that time returns the same frame.</p></section>
  </div>`;
  const mount = stage.querySelector('.fs-mount'), button = stage.querySelector('button'), slider = stage.querySelector('input'), time = stage.querySelector('.fs-controls output'), position = stage.querySelector('.fs-position'), note = stage.querySelector('.fs-note');
  const drawing = scene({width:320, height:180, duration:2, label:'A circle travelling from x 40 to x 200'});
  const rail = drawing.line({x1:40, y1:90, x2:200, y2:90, stroke:colour(ctx, 0, 22, 76), strokeWidth:2});
  const start = drawing.circle({x:40, y:90, r:4, fill:colour(ctx, 0, 22, 76)});
  const end = drawing.circle({x:200, y:90, r:4, fill:colour(ctx, 0, 22, 76)});
  const circle = drawing.circle({x:40, y:90, r:16, fill:colour(ctx, -24, 58, 44)});
  circle.to(1, {x:200}, {duration:1, ease:'linear'});
  const renderer = createSVGRenderer(mount, {label:drawing.label});
  let disposed = false;
  const player = createProjectionPlayer(drawing, {
    project(frame, context) {
      renderer.render(frame);
      slider.value = String(context.time);
      time.value = `${context.time.toFixed(2)} s`;
      position.value = `x = ${Math.round(40 + Math.max(0, Math.min(1, context.time - 1)) * 160)}`;
    },
  });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotion = () => {
    if (disposed) return;
    if (media.matches) player.pause();
    button.disabled = media.matches;
    note.textContent = media.matches ? 'Reduced motion is on. Use the slider to explore each frame.' : 'Rendered with ExplainerKit’s SVG renderer.';
  };
  const syncButton = () => { button.textContent = player.playing ? 'Pause' : player.time >= 2 ? 'Replay' : 'Play'; };
  const play = () => {
    if (player.playing) player.pause();
    else {
      if (player.time >= 2) player.seek(0);
      player.play();
    }
  };
  const seek = () => { player.pause();player.seek(Number(slider.value));syncButton(); };
  const hidden = () => { if (document.hidden) player.pause(); };
  const observer = new IntersectionObserver((entries) => { if (!entries[0]?.isIntersecting) player.pause(); });
  observer.observe(stage);
  button.addEventListener('click', play);
  slider.addEventListener('input', seek);
  document.addEventListener('visibilitychange', hidden);
  media.addEventListener('change', syncMotion);
  const offPlay = player.on('play', syncButton), offPause = player.on('pause', syncButton);
  const offTheme = ctx.onTheme(() => {
    rail.set({stroke:colour(ctx, 0, 22, 76)});
    start.set({fill:colour(ctx, 0, 22, 76)});
    end.set({fill:colour(ctx, 0, 22, 76)});
    circle.set({fill:colour(ctx, -24, 58, 44)});
    player.refresh();
  });
  player.seek(1.5);
  syncMotion();syncButton();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    button.removeEventListener('click', play);
    slider.removeEventListener('input', seek);
    document.removeEventListener('visibilitychange', hidden);
    media.removeEventListener('change', syncMotion);
    offTheme();offPlay();offPause();
    player.dispose();renderer.dispose();
  };
}
