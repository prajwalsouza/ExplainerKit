import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const SHOT_HEIGHT = 220;
const HEIGHT = 282;
const START = 58;
const END = WIDTH - 58;
const DETAIL_X = 1200;
const DURATION = 2.6;
const CRUMBS = [[102, 163, 11], [158, 139, 19], [210, 160, 11], [286, 109, 21], [363, 148, 14], [403, 103, 25], [450, 169, 10]];

export default function crumbScene(stage, ctx) {
  const drawing = scene({width: WIDTH, height: SHOT_HEIGHT, duration: DURATION});
  const wall = drawing.rect({width: WIDTH, height: SHOT_HEIGHT});
  const oven = drawing.rect({x: 130, y: 25, width: 260, height: 170, rx: 19});
  const rim = drawing.circle({x: 260, y: 107, r: 65});
  const window = drawing.circle({x: 260, y: 107, r: 54});
  const buttons = [164, 188, 336, 358].map(x => drawing.circle({x, y: 171, r: 5}));
  const counter = drawing.rect({x: DETAIL_X, y: 0, width: WIDTH, height: SHOT_HEIGHT});
  const crumbs = CRUMBS.map(([x, y, r], index) => drawing.path({x: x + DETAIL_X, y, commands: [
    ['M', -r, r * .35], ['L', -r * .4, -r * .77], ['L', r * .5, -r], ['L', r, -r * .12],
    ['L', r * .57, r * .8], ['L', -r * .47, r], ['Z'],
  ], rotation: index / 4}));
  drawing.region('bakery', {x: 0, y: 0, width: WIDTH, height: SHOT_HEIGHT});
  drawing.region('crumbs', {x: DETAIL_X, y: 0, width: WIDTH, height: SHOT_HEIGHT});
  drawing.camera().shots([
    {at: 0, frame: 'bakery'},
    {at: .3, zoomThrough: window, duration: 1.5},
    {at: 1.95, cut: 'crumbs'},
  ]);
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const film = {name: 'the filmstrip', x: START, y: 243, minX: START, maxX: END, axis: 'x'};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [film],
    draw(g, {width, height, ink}) {
      const time = DURATION * (film.x - START) / (END - START);
      wall.set({fill: colour(ctx, 10, 25, 77)});
      oven.set({fill: colour(ctx, 162, 37, 39)});
      rim.set({fill: colour(ctx, 154, 38, 22)});
      window.set({fill: colour(ctx, -25, 28, 16)});
      buttons.forEach(button => button.set({fill: colour(ctx, 30, 52, 63)}));
      counter.set({fill: colour(ctx, 26, 29, 53)});
      crumbs.forEach((crumb, index) => crumb.set({fill: colour(ctx, 28 + index * 2 - ctx.hue, 64, 71 - index * 2)}));
      renderer.render(drawing.sample({time}));
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.element, 0, 0);
      g.fillStyle = ink;
      g.fillRect(START, film.y - 1, END - START, 2);
      for (const [text, cutTime] of [['Bakery', 0], ['Zoom through', 1.02], ['Cut to detail', 1.95]]) {
        const x = START + (END - START) * cutTime / DURATION;
        disc(g, x, film.y, 3, ink);
        label(g, text, x, 266, ink, 12);
      }
      g.fillStyle = colour(ctx, 126, 49, 39);
      g.beginPath();
      g.roundRect(film.x - 17, film.y - 9, 34, 18, 3);
      g.fill();
      g.fillStyle = ground(ctx);
      g.fillRect(film.x - 5, film.y - 3, 10, 6);
      if (time >= 1.95) return 'Cut to the crumb scene.';
      if (time >= 1.8) return 'The oven window now covers the entire frame.';
      if (time >= .3) return 'The camera is zooming through the oven window.';
      return 'The camera frames the bakery overview.';
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
