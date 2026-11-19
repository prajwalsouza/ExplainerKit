import {motionPath} from '../../runtime/src/geometry/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const WIND = motionPath([
  ['M', 68, 126],
  ['C', 148, 32, 209, 50, 259, 102],
  ['C', 321, 162, 389, 170, 452, 99],
]);
const MARKS = Array.from({length: 48}, (_, index) => WIND.sample(index / 47));

export default async function mapleFlight(stage, ctx) {
  const knot = {name: 'the wind knot', x: 188, y: 211, axis: 'x', minX: 65, maxX: 455};
  return dragStudy(stage, ctx, {
    height: 250,
    handles: [knot],
    draw(g, {dark, ink}) {
      const gust = paintColor(ctx.hue, 39, dark ? 68 : 48);
      const faint = paintColor(ctx.hue, 27, dark ? 61 : 42, .24);
      const shell = paintColor(37, 60, dark ? 68 : 48);
      const wing = paintColor(48, 70, dark ? 75 : 66);
      const p = (knot.x - knot.minX) / (knot.maxX - knot.minX);
      const pose = WIND.sample(p);
      MARKS.forEach(({x, y}, index) => disc(g, x, y, 2, index / 47 <= p ? gust : faint));

      g.save();
      g.translate(pose.x, pose.y);
      g.rotate(pose.rotation);
      g.fillStyle = wing;
      g.beginPath();
      g.moveTo(7, 1);
      g.bezierCurveTo(-4, -25, -39, -31, -53, -16);
      g.bezierCurveTo(-37, -4, -15, 4, 7, 1);
      g.fill();
      g.strokeStyle = shell;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-43, -17);
      g.quadraticCurveTo(-16, -13, 6, -1);
      g.stroke();
      disc(g, 5, 0, 7, shell);
      disc(g, 8, -2, 2, wing);
      g.restore();

      g.fillStyle = faint;
      g.fillRect(knot.minX, knot.y - 2, knot.maxX - knot.minX, 4);
      disc(g, knot.x, knot.y, 14, gust);
      g.strokeStyle = ink;
      g.lineWidth = 1.5;
      for (const r of [3, 7]) {
        g.beginPath();
        g.arc(knot.x, knot.y, r, -.65, 3.7);
        g.stroke();
      }
      label(g, 'Lift off', 69, 235, ink, 15);
      label(g, 'Touch down', 442, 235, ink, 15);
      return `Route progress ${Math.round(100 * p)} percent. The seed points along the curve.`;
    },
  });
}
