import {scale} from '../../runtime/src/data/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const stockPosition = scale({domain: [0, 16], range: [61, 459], clamp: true});
const linearRadius = scale({domain: [0, 16], range: [0, 60]});
const areaRadius = scale({type: 'sqrt', domain: [0, 16], range: [0, 60]});

function pear(g, x, y, radius, dark) {
  if (!radius) return;
  g.save();
  g.translate(x, y);
  g.scale(radius, radius);
  const peel = g.createLinearGradient(-.7, -.4, .85, .6);
  peel.addColorStop(0, paintColor(63, 69, dark ? 64 : 80));
  peel.addColorStop(1, paintColor(93, 47, dark ? 41 : 51));
  g.fillStyle = peel;
  g.beginPath();
  g.moveTo(0, -.78);
  g.bezierCurveTo(-.4, -.86, -.42, -.25, -.77, .11);
  g.bezierCurveTo(-1.33, .91, -.44, 1.18, 0, .98);
  g.bezierCurveTo(.5, 1.11, 1.18, .86, .82, .2);
  g.bezierCurveTo(.45, -.26, .35, -.86, 0, -.78);
  g.fill();
  g.strokeStyle = paintColor(33, 51, 33);
  g.lineWidth = .065;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-.025, -.74);
  g.quadraticCurveTo(-.05, -1.02, .15, -1.1);
  g.stroke();
  g.fillStyle = paintColor(112, 45, dark ? 52 : 41);
  g.beginPath();
  g.moveTo(.02, -.91);
  g.quadraticCurveTo(.24, -1.13, .45, -.97);
  g.quadraticCurveTo(.29, -.8, .02, -.91);
  g.fill();
  g.restore();
}

export default function pearScales(stage, ctx) {
  const crate = {name: 'pear on the stock counter', x: stockPosition(8), y: 222, axis: 'x', minX: 61, maxX: 459};
  return dragStudy(stage, ctx, {height: 276, handles: [crate], draw(g, {dark, ink}) {
    const count = Math.round(stockPosition.invert(crate.x));
    const radiusA = linearRadius(count);
    const radiusB = areaRadius(count);
    const rail = paintColor(73, 19, dark ? 52 : 37, .65);
    const ring = paintColor(73, 24, dark ? 58 : 49, .35);
    for (const x of [141, 379]) {
      g.strokeStyle = ring;
      g.lineWidth = 1;
      g.setLineDash([3, 5]);
      g.beginPath();
      g.arc(x, 108, 63, 0, 2 * Math.PI);
      g.stroke();
      g.setLineDash([]);
    }
    pear(g, 141, 108, radiusA, dark);
    pear(g, 379, 108, radiusB, dark);
    label(g, 'Linear radius', 141, 187, ink, 20);
    label(g, 'Square-root radius', 379, 187, ink, 20);

    g.strokeStyle = rail;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(crate.minX, crate.y);
    g.lineTo(crate.maxX, crate.y);
    g.stroke();
    for (const tick of [0, 4, 8, 12, 16]) {
      const x = stockPosition(tick);
      disc(g, x, crate.y, 2.5, rail);
      label(g, String(tick), x, 250, ink, 16);
    }
    disc(g, crate.x, crate.y, 17, paintColor(63, 37, dark ? 25 : 91));
    pear(g, crate.x, crate.y, 11, dark);

    const shareA = Math.round(100 * (radiusA / 60) ** 2);
    const shareB = Math.round(100 * (radiusB / 60) ** 2);
    return `${count} of 16 pears. Linear radius fills ${shareA}% of its full pear area. Square-root radius fills ${shareB}%.`;
  }});
}
