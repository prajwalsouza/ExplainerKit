import {points} from '../../runtime/src/procedural/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const region = {rect: [55, 61, 410, 135]};
const loose = points({seed: 9, count: 36, in: region, method: 'random'});
const spread = points({seed: 9, count: 36, in: region, method: 'poisson', minDistance: 23});
const rows = [loose, spread].map(field => ({x: field.x, y: field.y}));

export default function craterDonuts(stage, ctx) {
  const tray = {name: 'the doughnut tray switch', x: 135, y: 246, axis: 'x', minX: 135, maxX: 385};
  return dragStudy(stage, ctx, {height: 272, handles: [tray], draw(g, {dark, ink}) {
    const selected = Number(tray.x >= 260);
    const {x, y} = rows[selected];
    const trayFill = paintColor(17, 32, dark ? 20 : 92);
    g.fillStyle = trayFill;
    g.beginPath();
    g.roundRect(34, 40, 452, 179, 19);
    g.fill();
    for (let i = 0; i < x.length; i++) {
      disc(g, x[i], y[i], 10.6, paintColor(15 + i % 7 * 19, 64, dark ? 63 : 55));
      disc(g, x[i], y[i], 3.5, trayFill);
    }
    g.fillStyle = paintColor(24, 37, dark ? 64 : 43, .4);
    g.fillRect(tray.minX, tray.y - 2, tray.maxX - tray.minX, 4);
    disc(g, tray.x, tray.y, 11, ink);
    label(g, 'Random', 76, tray.y, ink, 15);
    label(g, 'Spaced', 441, tray.y, ink, 15);
    return selected ? '36 doughnuts. Every pair of centers is at least 23 units apart.' : '36 doughnuts. Random placement allows overlap.';
  }});
}
