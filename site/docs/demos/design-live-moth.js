import {scene} from '../../runtime/src/core/index.js';
import {bindInputs, pointerInput} from '../../runtime/src/inputs/index.js';
import {css} from './_kit.js';
import {clamp, paintColor} from './design-stage.js';

const WIDTH = 520;
const HEIGHT = 252;
const CSS = `
.ek-moth-card { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.ek-moth-host { overflow: hidden; border-radius: 15px 15px 0 0; background: var(--night); cursor: crosshair; touch-action: pan-y; }
.ek-moth-host:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
.ek-moth-host svg { display: block; width: 100%; height: auto; }
.ek-moth-card [role=status] { color: var(--ink); margin: 0; padding: .6rem 1rem .75rem; font-size: .875rem; }
`;

export default async function liveMoth(stage, ctx) {
  css('design-live-moth', CSS);
  stage.innerHTML = '<div class="ek-moth-card"><div class="ek-moth-host" tabindex="0" role="group" aria-label="Porch light. Move the pointer in the picture or use the arrow keys."></div><p role="status"></p></div>';
  const host = stage.querySelector('.ek-moth-host');
  const message = stage.querySelector('[role=status]');
  const drawing = scene({width: WIDTH, height: HEIGHT, label: 'A moth follows a moving porch light'});
  const across = drawing.parameter(.5);
  const down = drawing.parameter(.46);
  const amber = paintColor(36, 91, 66);
  const silk = paintColor(176, 30, 76);
  const shadow = paintColor(224, 23, 20);
  const lampX = u => 60 + 400 * u;
  const lampY = u => 52 + 148 * u;

  for (const [x, y, r] of [[59, 41, 1.6], [117, 98, 1.9], [159, 55, 1.9], [228, 30, 1.2], [311, 75, 1.6], [399, 40, 1.1], [455, 105, 2], [442, 155, 1.4], [74, 174, 1.2]]) {
    drawing.circle({x, y, r, fill: paintColor(143, 41, 74, .65)});
  }
  const lamp = drawing.group().bind('x', {inputs: [across], map: lampX}).bind('y', {inputs: [down], map: lampY});
  lamp.circle({r: 43, fill: paintColor(37, 88, 66, .10)});
  lamp.circle({r: 34, fill: paintColor(37, 88, 66, .15)});
  lamp.rect({x: -16, y: -20, width: 32, height: 40, rx: 7, fill: amber, stroke: shadow, strokeWidth: 2});
  lamp.rect({x: -11, y: -17, width: 22, height: 33, rx: 4, fill: paintColor(46, 91, 88)});
  lamp.line({x1: 0, x2: 0, y1: -18, y2: 18, strokeWidth: 1.2, stroke: amber});
  lamp.rect({x: -17, y: -24, width: 34, height: 7, rx: 3, fill: shadow});
  lamp.rect({x: -17, y: 16, width: 34, height: 7, rx: 3, fill: shadow});

  const moth = drawing.group().bind('x', {inputs: [across], map: u => 95 + 300 * u})
    .bind('y', {inputs: [down], map: u => 108 + 120 * u})
    .bind('rotation', {inputs: [across], map: u => .8 * (u - .5)});
  moth.ellipse({x: -16, y: 3, rx: 16, ry: 24, rotation: -.74, fill: silk, stroke: shadow, strokeWidth: 1.5});
  moth.ellipse({x: 16, y: 3, rx: 16, ry: 24, rotation: .74, fill: silk, stroke: shadow, strokeWidth: 1.5});
  moth.ellipse({x: 0, y: 4, rx: 6, ry: 17, fill: paintColor(189, 27, 50)});
  moth.circle({x: 0, y: -9, r: 7, fill: shadow});
  moth.line({x1: -3, y1: -12, x2: -10, y2: -21, stroke: silk, strokeWidth: 1.5, strokeLinecap: 'round'});
  moth.line({x1: 3, y1: -12, x2: 10, y2: -21, stroke: silk, strokeWidth: 1.5, strokeLinecap: 'round'});
  moth.circle({x: -18, y: 2, r: 3.4, fill: amber});
  moth.circle({x: 18, y: 2, r: 3.4, fill: amber});

  const player = await drawing.mount(host, {controls: false});
  const pointer = pointerInput(host, {id: 'porch-light'});
  const binding = bindInputs(drawing, [pointer], [
    {parameter: across, map: ([sample]) => clamp(sample.value.nx, 0, 1)},
    {parameter: down, map: ([sample]) => clamp(sample.value.ny, 0, 1)},
  ], {player, stale: 'hold'});
  const events = new AbortController();
  host.addEventListener('keydown', event => {
    const key = {ArrowLeft: [across, -.05], ArrowRight: [across, .05], ArrowUp: [down, -.07], ArrowDown: [down, .07]}[event.key];
    if (!key) return;
    event.preventDefault();
    const [parameter, delta] = key;
    parameter.override(clamp(parameter.sample(player.time) + delta, 0, 1));
  }, {signal: events.signal});
  const report = () => {
    const x = Math.round(100 * across.sample(player.time));
    const y = Math.round(100 * down.sample(player.time));
    const text = `Light at ${x}% across, ${y}% down. The moth follows while scene time stays paused.`;
    if (message.textContent !== text) message.textContent = text;
  };
  const offFrame = player.on('frame', report);
  const theme = () => host.style.setProperty('--night', paintColor(217, 28, ctx.dark() ? 9 : 15));
  const offTheme = ctx.onTheme(theme);
  const dispose = () => { events.abort(); offFrame(); offTheme(); binding.dispose(); pointer.dispose(); player.dispose(); };
  theme();
  report();
  try { await pointer.start(); }
  catch (error) { dispose(); throw error; }
  return dispose;
}
