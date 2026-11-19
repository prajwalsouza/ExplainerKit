import {scene} from '../../runtime/src/core/index.js';
import {ellipsePath} from '../../runtime/src/geometry/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {css, ground} from './_kit.js';
import {paintColor, WIDTH} from './design-stage.js';

const HEIGHT = 212;
const CENTER = {x: 260, y: 106};
const CSS = `
.ek-bagel { border: 1px solid var(--line); border-radius: 16px; overflow: hidden }
.ek-bagel-view { position: relative; aspect-ratio: 520 / 212 }
.ek-bagel-view canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important }
.ek-bagel-view button { position: absolute; inset: 13% 24%; border: 0; background: transparent; border-radius: 50%; cursor: pointer }
.ek-bagel-view button:focus-visible { outline-offset: -2px }
.ek-bagel-status { margin: 0; padding: .6rem 1rem .8rem; font-size: .875rem }
`;

export default function bagelHole(stage, ctx) {
  css('design-bagel-hole', CSS);
  stage.innerHTML = '<div class="ek-bagel"><div class="ek-bagel-view"></div><p class="ek-bagel-status" role="status"></p></div>';
  const view = stage.querySelector('.ek-bagel-view');
  const status = stage.querySelector('.ek-bagel-status');
  const renderer = createCanvasRenderer(view, {label: 'A bagel drawn with two contours'});
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const cloth = drawing.rect({x: 78, y: 17, width: 364, height: 178, rx: 9});
  const stripes = [];
  for (let x = 110; x < 440; x += 34) stripes.push(drawing.rect({x, y: 18, width: 6, height: 176}));
  const bagel = drawing.path({
    commands: [...ellipsePath({...CENTER, rx: 128, ry: 74}), ...ellipsePath({...CENTER, rx: 52, ry: 31})],
    fillRule: 'evenodd', strokeWidth: 4,
  });
  const seeds = Array.from({length: 17}, (_, index) => {
    const angle = index * 2 * Math.PI / 17;
    return drawing.ellipse({
      x: CENTER.x + (86 + 12 * Math.sin(index)) * Math.cos(angle),
      y: CENTER.y + (49 + 7 * Math.sin(index)) * Math.sin(angle),
      rx: 4.1, ry: 1.8, rotation: angle + index,
    });
  });
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Fill the bagel’s center');
  view.append(button);
  const events = new AbortController();
  let solid = false;

  function draw() {
    const dark = ctx.dark();
    view.style.background = ground(ctx);
    cloth.set({fill: paintColor(182, 28, dark ? 27 : 73)});
    stripes.forEach(stripe => stripe.set({fill: paintColor(180, 34, dark ? 36 : 85)}));
    bagel.set({fill: paintColor(34, 64, dark ? 58 : 65), stroke: paintColor(27, 52, dark ? 43 : 40), fillRule: solid ? 'nonzero' : 'evenodd'});
    seeds.forEach(seed => seed.set({fill: paintColor(45, 73, dark ? 82 : 90)}));
    renderer.render(drawing.sample());
    button.setAttribute('aria-pressed', String(solid));
    status.textContent = solid
      ? 'nonzero. Both contours wind the same way, so the center stays filled.'
      : 'evenodd. Crossing the inner contour opens a hole in the center.';
  }

  button.addEventListener('click', () => {
    solid = !solid;
    draw();
  }, {signal: events.signal});
  draw();
  const offTheme = ctx.onTheme(draw);
  return () => {
    events.abort();
    offTheme();
    renderer.dispose();
  };
}
