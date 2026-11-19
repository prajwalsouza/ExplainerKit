// A small working explanation of scene → frame → renderer. Playback uses the library's clock.
import {scene} from '../../runtime/src/core/index.js';
import {hsla, toHex} from '../../runtime/src/color/index.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {createProjectionPlayer} from '../../runtime/src/player/index.js';
import {css} from './_kit.js';

const CSS = `
.fs-demo { display:grid; grid-template-columns:minmax(0,2.6fr) minmax(170px,1fr); gap:20px; padding:18px; }
.fs-demo section { min-width:0; }
.fs-demo .fs-readout { align-self:center; padding:8px 6px; }
.fs-demo h3 { margin:0 0 8px; font:650 21px/1.2 var(--display); letter-spacing:-.025em; }
.fs-demo p { margin:0; color:var(--ink); font-size:14px; }
.fs-demo .fs-mount { aspect-ratio:480/228; overflow:hidden; border-radius:12px; }
.fs-demo .fs-mount svg { display:block; width:100%; height:100%; }
.fs-demo .fs-controls { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:14px; margin-top:10px; }
.fs-demo button { border:1px solid var(--line); border-radius:999px; padding:8px 16px; font:600 13px var(--sans); color:var(--ink); background:var(--ground); cursor:pointer; min-height:38px; }
.fs-demo button:disabled { cursor:default; opacity:.65; }
.fs-demo input { min-width:0; width:100%; accent-color:hsl(var(--h) 55% 45%); }
.fs-demo output { white-space:nowrap; font:12px var(--mono); color:var(--muted); }
.fs-demo .fs-position { display:block; margin:0 0 10px; font:650 22px/1.2 var(--display); font-variant-numeric:tabular-nums; color:var(--ink); }
.fs-demo .fs-note { margin-top:8px; font-size:12px; }
@media(max-width:700px) { .fs-demo { grid-template-columns:1fr; padding:12px; gap:10px; } .fs-demo .fs-readout { padding:4px 0; } .fs-demo h3 { font-size:18px; } .fs-demo .fs-controls { gap:8px; } }
`;

const duration = 2.8;
const paint = (hue, saturation, lightness, alpha = 1) => toHex(hsla(hue, saturation, lightness, alpha));
const palette = {
  sky: paint(173, 40, 88),
  floor: paint(176, 31, 24),
  platform: paint(170, 32, 36),
  rim: paint(158, 35, 63),
  guide: paint(172, 31, 48),
  ink: paint(176, 42, 17),
  body: paint(39, 94, 63),
  light: paint(64, 88, 80),
};

function buildJump() {
  const drawing = scene({width:480, height:228, duration, label:'A small yellow robot jumps between two platforms'});
  drawing.rect({x:0, y:0, width:480, height:228, fill:palette.sky});
  drawing.rect({x:0, y:172, width:480, height:56, fill:palette.floor});
  const trail = drawing.path({commands:[['M', 126, 141]], stroke:palette.guide, strokeWidth:1.5, strokeDasharray:[3, 6], fill:'none'});
  for (const [x, width] of [[0, 184], [296, 184]]) {
    drawing.rect({x, y:172, width, height:56, fill:palette.platform});
    drawing.rect({x, y:172, width, height:5, fill:palette.rim});
  }
  for (const x of [34, 66, 98, 382, 414, 446]) {
    drawing.line({x1:x, y1:198, x2:x + 9, y2:190, stroke:palette.rim, strokeWidth:2, opacity:0.45, strokeLinecap:'round'});
  }
  drawing.line({x1:403, y1:172, x2:403, y2:127, stroke:palette.platform, strokeWidth:3, strokeLinecap:'round'});
  drawing.path({commands:[['M', 403, 128], ['L', 432, 135], ['L', 403, 142], ['Z']], fill:palette.body, stroke:palette.ink, strokeWidth:1});

  const robot = drawing.group({x:126, y:141});
  robot.line({x1:0, y1:-19, x2:0, y2:-30, stroke:palette.ink, strokeWidth:3, strokeLinecap:'round'});
  robot.circle({x:0, y:-31, r:4, fill:palette.body, stroke:palette.ink, strokeWidth:2});
  robot.rect({x:-18, y:13, width:36, height:17, rx:6, fill:palette.ink});
  robot.rect({x:-25, y:-20, width:50, height:41, rx:11, fill:palette.body, stroke:palette.ink, strokeWidth:2});
  robot.rect({x:-18, y:-12, width:36, height:21, rx:8, fill:palette.ink});
  const eyes = robot.group({x:3});
  eyes.rect({x:-10, y:-7, width:5, height:10, rx:2, fill:palette.light});
  eyes.rect({x:3, y:-7, width:5, height:10, rx:2, fill:palette.light});
  robot.circle({x:0, y:14, r:1.8, fill:palette.ink});

  robot.to(0.36, {scaleY:0.83, y:146}, {duration:0.29, ease:'smooth'});
  robot.to(0.65, {scaleY:1, rotation:-0.18}, {duration:0.24, ease:'easeOut'});
  robot.to(0.65, {x:354}, {duration:1.7, ease:'linear'});
  robot.to(0.65, {y:75}, {duration:0.85, ease:'easeOut'});
  robot.to(1.5, {y:141, rotation:0.14}, {duration:0.85, ease:'smooth'});
  robot.to(2.35, {scaleY:0.83, y:146}, {duration:0.12, ease:'easeOut'});
  robot.to(2.47, {scaleY:1, y:141, rotation:0}, {duration:0.22, ease:'easeOut'});
  eyes.to(2.42, {scaleY:0.15}, {duration:0.06, ease:'linear'});
  eyes.to(2.5, {scaleY:1}, {duration:0.09, ease:'linear'});
  const robotPosition = frame => frame.children.find(child => child.id === robot.id).props;
  trail.set({commands:Array.from({length:18}, (_, i) => {
    const {x, y} = robotPosition(drawing.sample({time:0.65 + i / 10}));
    return [i ? 'L' : 'M', x, y];
  })});
  return {drawing, robotPosition};
}

export default function firstScene(stage) {
  css('first-scene', CSS);
  stage.innerHTML = `<div class="fs-demo">
    <section><div class="fs-mount"></div><div class="fs-controls"><button type="button">Play</button><input type="range" min="0" max="${duration}" step="0.01" value="0" aria-label="Scene time in seconds"><output aria-label="Scene time">0.00 s</output></div><p class="fs-note" hidden></p></section>
    <section class="fs-readout"><h3>Catch it mid-jump</h3><output class="fs-position" aria-label="Robot position" aria-live="off">x 126 · y 141</output><p>Scrub to 1.50 s. The renderer draws the robot at the position in that frame. Return to 1.50 s from either direction to see the same pose.</p></section>
  </div>`;
  const mount = stage.querySelector('.fs-mount');
  const button = stage.querySelector('button');
  const slider = stage.querySelector('input');
  const time = stage.querySelector('.fs-controls output');
  const position = stage.querySelector('.fs-position');
  const note = stage.querySelector('.fs-note');
  const {drawing, robotPosition} = buildJump();
  const renderer = createSVGRenderer(mount, {label:drawing.label});
  let disposed = false;
  const player = createProjectionPlayer(drawing, {
    project(frame, context) {
      renderer.render(frame);
      slider.value = String(context.time);
      time.value = `${context.time.toFixed(2)} s`;
      const {x, y} = robotPosition(frame);
      position.value = `x ${Math.round(x)} · y ${Math.round(y)}`;
    },
  });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotion = () => {
    if (disposed) return;
    if (media.matches) player.pause();
    button.disabled = media.matches;
    note.hidden = !media.matches;
    note.textContent = media.matches ? 'Reduced motion is on. Use the slider to explore each frame.' : '';
  };
  const syncButton = () => { button.textContent = player.playing ? 'Pause' : player.time >= duration ? 'Replay' : 'Play'; };
  const play = () => {
    if (player.playing) player.pause();
    else {
      if (player.time >= duration) player.seek(0);
      player.play();
    }
  };
  const seek = () => {
    const target = Number(slider.value);
    player.pause();
    player.seek(target);
    syncButton();
  };
  const hidden = () => { if (document.hidden) player.pause(); };
  const observer = new IntersectionObserver((entries) => { if (!entries[0]?.isIntersecting) player.pause(); });
  observer.observe(stage);
  button.addEventListener('click', play);
  slider.addEventListener('input', seek);
  document.addEventListener('visibilitychange', hidden);
  media.addEventListener('change', syncMotion);
  const offPlay = player.on('play', syncButton), offPause = player.on('pause', syncButton);
  player.seek(0);
  syncMotion();
  syncButton();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    button.removeEventListener('click', play);
    slider.removeEventListener('input', seek);
    document.removeEventListener('visibilitychange', hidden);
    media.removeEventListener('change', syncMotion);
    offPlay();
    offPause();
    player.dispose();
    renderer.dispose();
  };
}
