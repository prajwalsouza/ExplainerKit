import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 259;
const BODY = [
  ['M', -71, -25], ['C', -73, -43, -48, -54, -36, -45],
  ['C', -27, -65, 0, -62, 12, -48], ['C', 29, -61, 56, -54, 57, -37],
  ['C', 82, -37, 90, -22, 81, -7], ['C', 93, 9, 79, 33, 60, 31],
  ['C', 47, 48, 19, 40, 11, 34], ['C', -6, 49, -36, 43, -46, 33],
  ['C', -67, 40, -84, 35, -83, 17], ['C', -97, 9, -95, -13, -71, -25], ['Z'],
];

export default function newEwe(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const sheep = drawing.path({commands: BODY, strokeWidth: 2});
  const pattern = drawing.group({clip: sheep});
  const left = pattern.rect({width: WIDTH / 2, height: HEIGHT});
  const right = pattern.rect({x: WIDTH / 2, width: WIDTH / 2, height: HEIGHT});
  const stripes = [];
  for (let x = 13; x < WIDTH / 2; x += 35) {
    stripes.push(pattern.rect({x, width: 9, height: HEIGHT, opacity: .53}));
  }
  for (let y = 18; y < HEIGHT; y += 35) {
    stripes.push(pattern.rect({y, width: WIDTH / 2, height: 9, opacity: .53}));
  }
  const dots = [];
  for (let row = 0; row < 7; row++) {
    for (let x = 277 + (row % 2) * 14; x < WIDTH; x += 35) {
      dots.push(pattern.circle({x, y: row * 39 + 14, r: 5.5}));
    }
  }
  const face = drawing.group();
  const legs = [-44, 29].map(x => face.rect({x, y: 27, width: 9, height: 35, rx: 3}));
  const wool = face.path({commands: BODY, fill: 'none', strokeWidth: 2.5});
  const head = face.circle({x: 72, y: -12, r: 21});
  const ear = face.circle({x: 72, y: -27, r: 10, scaleX: 1.4});
  const eye = face.circle({x: 81, y: -16, r: 2.2});
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const ewe = {name: 'the sheep', x: 260, y: 123, minX: 105, maxX: 415, minY: 80, maxY: 168};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [ewe],
    draw(g, {width, height, ink}) {
      const background = ground(ctx);
      const tartan = colour(ctx, -108, 48, 60);
      const polka = colour(ctx, 41, 54, 64);
      left.set({fill: tartan});
      right.set({fill: polka});
      stripes.forEach(stripe => stripe.set({fill: colour(ctx, 86, 39, 31)}));
      dots.forEach(dot => dot.set({fill: colour(ctx, -37, 45, 36)}));
      sheep.set({x: ewe.x, y: ewe.y, fill: background});
      face.set({x: ewe.x, y: ewe.y});
      wool.set({stroke: ink});
      head.set({fill: ink});
      ear.set({fill: ink});
      legs.forEach(leg => leg.set({fill: ink}));
      eye.set({fill: background});
      renderer.render(drawing.sample());
      g.fillStyle = background;
      g.fillRect(0, 0, width, height);
      g.fillStyle = colour(ctx, -108, 20, 78);
      g.fillRect(0, 28, width / 2, 196);
      g.fillStyle = colour(ctx, 41, 25, 80);
      g.fillRect(width / 2, 28, width / 2, 196);
      g.drawImage(renderer.element, 0, 0);
      label(g, 'Tartan', width / 4, 241, ink, 13);
      label(g, 'Polka dots', width * .75, 241, ink, 13);
      if (ewe.x < 178) return 'The sheep is now wearing tartan.';
      if (ewe.x > 350) return 'The sheep is now wearing polka dots.';
      return 'The sheep’s outline reveals both swatches.';
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
