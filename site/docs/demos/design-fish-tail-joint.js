import {appendage, appendageShapes, frameAlong, taper, tube} from '../../runtime/src/characters/index.js';
import {disc, dragStudy, paintColor} from './design-stage.js';

const SPINE = [[140,112], [205,113], [276,119], [331,119]];
const TAIL = frameAlong(SPINE, 1);
const commandsToPath = commands => new Path2D(commands.map(command => command.join(' ')).join(' '));

export default async function fishTailJoint(stage, ctx) {
  const body = commandsToPath(tube(SPINE, taper({max: 34, nose: 15, end: 9}), {endCap: 'flat'}));
  const finShape = appendageShapes.forkedFin();
  const pin = {name: 'the tail joint', x: 319, y: TAIL.point[1], axis: 'x', minX: 293, maxX: 331};
  return dragStudy(stage, ctx, {
    height: 219,
    handles: [pin],
    draw(g, {dark, ink}) {
      const overlap = TAIL.point[0] - pin.x;
      const flesh = paintColor(181, 61, dark ? 60 : 39, .78);
      const fin = paintColor(ctx.hue, 58, dark ? 70 : 45);
      g.fillStyle = fin;
      g.fill(commandsToPath(appendage(finShape, TAIL, {overlap, scale: 2.6})));
      g.fillStyle = flesh;
      g.fill(body);
      disc(g, 161, 104, 9, paintColor(44, 34, 95));
      disc(g, 158, 103, 3.4, ink);
      g.strokeStyle = flesh;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(181, 110, 14, -1.2, 1.2);
      g.stroke();
      disc(g, pin.x, pin.y, 7, fin);
      disc(g, pin.x, pin.y, 2.5, paintColor(38, 42, 93));
      return overlap > 0
        ? `The fin starts ${Math.round(overlap)} units inside the body.`
        : 'Something’s fishy. The fin starts right at the edge.';
    },
  });
}
