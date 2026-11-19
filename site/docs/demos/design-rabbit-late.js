import {scene} from '../../runtime/src/core/index.js';
import {createTimeline} from '../../runtime/src/editor/timeline/index.js';
import {css} from './_kit.js';
import {paintColor} from './design-stage.js';

const CSS = `
.ek-rabbit-demo { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); overflow: hidden; }
.ek-rabbit-visual { min-height: 100px; }
.ek-rabbit-editor { padding: 0 .65rem .55rem; }
.ek-rabbit-status { margin: 0; padding: .3rem .9rem .8rem; font-size: .85rem; }
`;

export default async function rabbitLate(stage, ctx) {
  css('design-rabbit-late', CSS);
  stage.innerHTML = '<div class="ek-rabbit-demo"><div class="ek-rabbit-visual"></div><div class="ek-rabbit-editor"></div><p class="ek-rabbit-status" role="status"></p></div>';
  const drawing = scene({width: 520, height: 170, duration: 3, label: 'Rabbit hopping to a carrot'});
  const rabbit = drawing.group({x: 70, y: 104});
  const cream = paintColor(36, 37, 91);
  rabbit.circle({r: 22, fill: cream});
  rabbit.circle({x: 17, y: -15, r: 16, fill: cream});
  rabbit.rect({x: 8, y: -52, rx: 4, width: 9, height: 31, rotation: -.12, fill: cream});
  rabbit.rect({x: 24, y: -52, rx: 4, width: 9, height: 29, rotation: .19, fill: cream});
  rabbit.circle({x: 23, y: -18, r: 3, fill: paintColor(28, 27, 18)});
  rabbit.circle({x: -22, y: -5, r: 9, fill: paintColor(48, 30, 95)});
  const carrot = drawing.path({commands: [['M', 439, 94], ['L', 473, 92], ['L', 465, 126], ['Z']], fill: paintColor(27, 90, 56)});
  drawing.line({x1: 457, y1: 97, x2: 457, y2: 82, stroke: paintColor(106, 52, 46), strokeWidth: 5});
  const keys = [{at: 0, value: 70, ease: 'smooth'}, {at: 1.5, value: 255, ease: 'easeOut'}, {at: 3, value: 423}];
  rabbit.keys('x', keys);
  const player = await drawing.mount(stage.querySelector('.ek-rabbit-visual'), {controls: false});
  const status = stage.querySelector('.ek-rabbit-status');
  const editor = createTimeline(player, stage.querySelector('.ek-rabbit-editor'), {
    tracks: [{label: 'Rabbit position', handle: rabbit, property: 'x', keys}],
    onChange({keys: current}) { status.textContent = `The rabbit’s middle key is now at ${current[1].at.toFixed(2)} s.`; },
  });
  const theme = () => {
    carrot.set({fill: paintColor(27, 90, ctx.dark() ? 67 : 53)});
    player.refresh();
  };
  const offTheme = ctx.onTheme(theme);
  theme();
  return () => { offTheme(); editor.dispose(); player.dispose(); };
}
