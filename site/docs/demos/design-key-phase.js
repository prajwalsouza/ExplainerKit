import {ellipsePath, regularPolygon, roundedRectPath} from '../../runtime/src/geometry/index.js';
import {createCompoundMorph} from '../../runtime/src/morph/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 280;
const START = 68;
const END = WIDTH - 68;
const KEYHOLE = [
  ['M', 260, 72], ['C', 244, 72, 239, 90, 252, 103],
  ['L', 247, 128], ['L', 273, 128], ['L', 268, 103],
  ['C', 281, 90, 276, 72, 260, 72], ['Z'],
];

const plate = createCompoundMorph([
  {id: 'plate', commands: roundedRectPath({x: 173, y: 34, width: 174, height: 139, radius: 15})},
  {id: 'opening', commands: KEYHOLE},
], [
  {id: 'opening', commands: regularPolygon({x: 260, y: 104, sides: 3, radius: 33})},
  {id: 'plate', commands: ellipsePath({x: 260, y: 104, rx: 96, ry: 85})},
]);

export default function keyPhase(stage, ctx) {
  const key = {name: 'the key', x: START, y: 234, minX: START, maxX: END, axis: 'x'};
  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [key],
    draw(g, {width, height, ink}) {
      const progress = (key.x - START) / (END - START);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.fillStyle = colour(ctx, -145, 23, 66);
      for (let y = 20; y <= 196; y += 16) g.fillRect(140, y, 240, 1);
      const silhouette = new Path2D(plate.sample(progress).map(command => command.join(' ')).join(' '));
      g.fillStyle = colour(ctx, 32, 53, 56);
      g.fill(silhouette, 'evenodd');
      g.strokeStyle = colour(ctx, 14, 56, 36);
      g.lineWidth = 3;
      g.stroke(silhouette);
      for (const x of [197, 323]) disc(g, x, 104, 4, colour(ctx, 14, 56, 36));

      g.fillStyle = ink;
      g.fillRect(START, key.y, END - START, 1);
      disc(g, key.x - 8, key.y, 13, colour(ctx, -67, 38, 44));
      disc(g, key.x - 8, key.y, 6, ground(ctx));
      g.fillStyle = colour(ctx, -67, 38, 44);
      g.fillRect(key.x, key.y - 3, 25, 6);
      g.fillRect(key.x + 17, key.y + 3, 8, 6);
      label(g, 'Rounded rectangle', START + 13, 263, ink, 13);
      label(g, 'Oval', END, 263, ink, 13);
      return `${Math.round(progress * 100)}% through the morph. The pattern behind the opening stays visible.`;
    },
  });
}
