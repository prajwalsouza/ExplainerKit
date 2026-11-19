import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const PHOTO_HEIGHT = 195;
const HEIGHT = 275;
const FLOOR = 145;
const GIRAFFE = [
  ['M', -29, -1], ['L', -29, -31], ['L', 3, -31], ['L', 13, -87],
  ['L', 16, -98], ['L', 23, -92], ['L', 34, -88], ['L', 34, -79],
  ['L', 23, -79], ['L', 15, -29], ['L', 14, -1], ['L', 7, -1],
  ['L', 5, -19], ['L', -18, -19], ['L', -21, -1], ['Z'],
];
const TORTOISE = [
  ['M', -28, -2], ['L', -29, -9], ['Q', -26, -29, -7, -28],
  ['Q', 12, -29, 18, -17], ['L', 25, -23], ['Q', 37, -21, 34, -13],
  ['L', 23, -8], ['L', 20, -1], ['L', 14, -1], ['L', 11, -8],
  ['L', -15, -8], ['L', -17, -1], ['Z'],
];

export default function weddingKeeping(stage, ctx) {
  const drawing = scene({width: WIDTH, height: PHOTO_HEIGHT});
  const giraffe = drawing.group({x: 188, y: FLOOR});
  const tortoise = drawing.group({x: 324, y: FLOOR});
  const neck = giraffe.path({commands: GIRAFFE});
  const shell = tortoise.path({commands: TORTOISE});
  const eye = giraffe.circle({x: 28, y: -85, r: 2});
  const spots = [[-20, -23], [-7, -25], [9, -34], [11, -49], [16, -63]].map(([x, y]) =>
    giraffe.circle({x, y, r: 3}),
  );
  const sash = tortoise.path({commands: [['M', -11, -24], ['L', 19, -8]], strokeWidth: 3});
  const camera = drawing.camera();
  camera.keep([giraffe, tortoise], {padding: 24, ground: 'bottom'});
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const controls = [
    {name: 'the giraffe', x: 188, y: 233, minX: 48, maxX: 472, axis: 'x'},
    {name: 'the tortoise', x: 324, y: 252, minX: 48, maxX: 472, axis: 'x'},
  ];
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: controls,
    draw(g, {width, height, ink}) {
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      neck.set({fill: colour(ctx, 30, 66, 54)});
      shell.set({fill: colour(ctx, 138, 36, 33)});
      eye.set({fill: ink});
      spots.forEach(spot => spot.set({fill: colour(ctx, 12, 45, 38)}));
      sash.set({stroke: colour(ctx, -102, 43, 73)});
      giraffe.set({x: controls[0].x});
      tortoise.set({x: controls[1].x});
      renderer.render(drawing.sample());
      g.fillStyle = colour(ctx, -94, 26, 77);
      g.fillRect(0, 0, width, PHOTO_HEIGHT);
      g.fillStyle = colour(ctx, 26, 27, 67);
      g.fillRect(0, PHOTO_HEIGHT - 24, width, 24);
      g.drawImage(renderer.element, 0, 0);
      label(g, 'Camera view', 64, 17, colour(ctx, 90, 35, 13), 13);
      g.fillStyle = ink;
      g.fillRect(38, 241, width - 76, 2);
      controls.forEach((handle, index) => {
        const color = index === 0 ? colour(ctx, 30, 66, 45) : colour(ctx, 138, 36, 33);
        disc(g, handle.x, handle.y, 13, color);
        label(g, index === 0 ? 'G' : 'T', handle.x, handle.y, '#ffffff', 13);
      });
      return `Camera zoom ${camera.view().pose.zoom.toFixed(2)}×. Both guests fit inside the photo.`;
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
