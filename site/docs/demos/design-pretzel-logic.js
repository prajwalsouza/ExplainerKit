import {booleanPath} from '../../runtime/src/geometry/shapes/index.js';
import {disc, dragStudy, paintColor} from './design-stage.js';

const ring = (x, y, rx, ry) => Array.from({length: 32}, (_, i) => ({
  x: x + rx * Math.cos(i * Math.PI / 16), y: y + ry * Math.sin(i * Math.PI / 16),
}));
const left = [ring(186, 143, 98, 71), ring(186, 143, 60, 40)];

export default function pretzelLogic(stage, ctx) {
  const dough = {name: 'the second ring of dough', x: 333, y: 138, minX: 150, maxX: 402, minY: 79, maxY: 202};
  return dragStudy(stage, ctx, {height: 285, handles: [dough], draw(g, {dark, ink}) {
    const right = [ring(dough.x, dough.y, 82, 61), ring(dough.x, dough.y, 47, 32)];
    const joined = booleanPath('union', left, right);
    g.beginPath();
    for (const loop of joined.loops) {
      g.moveTo(loop[0].x, loop[0].y);
      for (const point of loop.slice(1)) g.lineTo(point.x, point.y);
      g.closePath();
    }
    g.fillStyle = paintColor(30, 70, dark ? 64 : 61);
    g.fill('evenodd');
    g.strokeStyle = paintColor(24, 47, dark ? 73 : 39);
    g.lineWidth = 2;
    g.stroke();
    disc(g, dough.x, dough.y, 12, ink);
    return `${joined.loops.length} boundary loops in the union. The stroke follows the new boundaries.`;
  }});
}
