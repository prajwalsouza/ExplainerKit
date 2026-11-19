import {variation} from '../../runtime/src/variation/index.js';
import {hsla, toHex} from '../../runtime/src/color/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function peasInAPod(stage, ctx) {
  const seed = {name: 'the seed packet', x: 92, y: 236, axis: 'x', minX: 92, maxX: 428};
  return dragStudy(stage, ctx, {height: 264, handles: [seed], draw(g, {dark, ink}) {
    const amount = 2 * (seed.x - seed.minX) / (seed.maxX - seed.minX);
    const peas = variation({seed: 23, preset: 'botanical', amount});
    const pod = g.createLinearGradient(0, 70, 0, 171);
    pod.addColorStop(0, paintColor(95, 42, dark ? 43 : 73));
    pod.addColorStop(1, paintColor(120, 38, dark ? 28 : 53));
    g.fillStyle = pod;
    g.beginPath();
    g.moveTo(54, 107);
    g.quadraticCurveTo(233, 30, 463, 103);
    g.quadraticCurveTo(369, 207, 100, 164);
    g.closePath();
    g.fill();
    const sizes = [];
    for (let index = 0; index < 7; index++) {
      const x = 117 + index * 48;
      const y = peas.around(index, 115 + 16 * Math.sin(index * .52));
      const radius = peas.size(index, 17);
      sizes.push(radius);
      disc(g, x + 3, y + 4, radius + 1, paintColor(115, 34, 15, .24));
      disc(g, x, y, radius, toHex(peas.tint(index, hsla(89, 56, dark ? 65 : 70))));
      disc(g, x - radius * .27, y - radius * .32, radius * .24, paintColor(88, 76, 95, .53));
    }
    g.fillStyle = paintColor(94, 35, dark ? 73 : 41, .4);
    g.fillRect(seed.minX, seed.y - 2, seed.maxX - seed.minX, 4);
    disc(g, seed.x, seed.y, 13, ink);
    label(g, 'Pea', seed.x, seed.y, paintColor(88, 76, dark ? 18 : 90), 10);
    return `Variation amount ${amount.toFixed(2)}. Pea radii span ${Math.min(...sizes).toFixed(1)}–${Math.max(...sizes).toFixed(1)} units.`;
  }});
}
