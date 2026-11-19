import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, css, ink} from './_kit.js';

const WIDTH = 520;
const HEIGHT = 258;
const FISH = [
  {name: 'far koi', depth: 7, x: 129, y: 82, scale: .72, hue: -70},
  {name: 'middle koi', depth: 3, x: 360, y: 119, scale: .94, hue: 18},
  {name: 'near koi', depth: 1, x: 220, y: 181, scale: 1.2, hue: -150},
];
const BODY = [
  ['M', -37, 0], ['Q', -12, -24, 11, -18], ['Q', 35, -14, 44, 0],
  ['Q', 33, 16, 12, 16], ['Q', -11, 22, -37, 0], ['Z'],
];
const TAIL = [['M', -33, 0], ['Q', -52, -18, -63, -12], ['L', -56, 0], ['L', -63, 12], ['Q', -52, 18, -33, 0], ['Z']];

const CSS = `
.ek-koi-pool { border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.ek-koi-water { position: relative; aspect-ratio: 520 / 258; }
.ek-koi-water canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; }
.ek-koi-water button { position: absolute; z-index: 1; width: 20%; height: 24%; border: 0; background: transparent; transform: translate(-50%, -50%); cursor: pointer; border-radius: 50%; }
.ek-koi-water button[aria-pressed="true"] { border: 1px dashed var(--ek-koi-ring); }
.ek-koi-status { padding: .6rem 1rem .8rem; margin: 0; font-size: .875rem; }
`;

export default function koiFocus(stage, ctx) {
  css('design-koi-focus', CSS);
  stage.innerHTML = '<div class="ek-koi-pool"><div class="ek-koi-water"></div><p class="ek-koi-status" role="status"></p></div>';
  const pond = stage.querySelector('.ek-koi-water');
  const status = stage.querySelector('.ek-koi-status');
  const renderer = createCanvasRenderer(pond, {label: 'Three koi swimming at different depths'});
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const focalDepth = drawing.parameter(3, {min: 1, max: 7});
  drawing.focus({depth: focalDepth, aperture: .65});
  const fish = FISH.map(({name, depth, x, y, scale, hue}) => {
    const layer = drawing.layer({depth});
    const shape = drawing.group({x, y, scaleX: scale, scaleY: scale});
    const tail = shape.path({commands: TAIL});
    const body = shape.path({commands: BODY});
    const patch = shape.circle({x: 8, y: -6, r: 9});
    const eye = shape.circle({x: 28, y: -3, r: 2.6});
    layer.add(shape);
    return {name, depth, x, y, hue, tail, body, patch, eye};
  });
  const events = new AbortController();
  let selected = 1;
  const controls = fish.map(({name, x, y}, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Focus the ${name}`);
    button.style.left = `${100 * x / WIDTH}%`;
    button.style.top = `${100 * y / HEIGHT}%`;
    button.addEventListener('click', () => {
      selected = index;
      paint();
    }, {signal: events.signal});
    pond.append(button);
    return button;
  });

  function paint() {
    pond.style.background = colour(ctx, 104, 24, ctx.dark() ? 12 : 78);
    pond.style.setProperty('--ek-koi-ring', ink(ctx));
    fish.forEach(({hue, tail, body, patch, eye}, index) => {
      tail.set({fill: colour(ctx, hue, 43, 43)});
      body.set({fill: colour(ctx, hue, 56, 58)});
      patch.set({fill: colour(ctx, hue + 24, 57, 72)});
      eye.set({fill: ink(ctx)});
      controls[index].setAttribute('aria-pressed', String(index === selected));
    });
    focalDepth.set(fish[selected].depth);
    renderer.render(drawing.sample());
    status.textContent = `Focus depth ${fish[selected].depth}. The ${fish[selected].name} is in focus.`;
  }

  paint();
  const offTheme = ctx.onTheme(paint);
  return () => {
    events.abort();
    offTheme();
    renderer.dispose();
  };
}
