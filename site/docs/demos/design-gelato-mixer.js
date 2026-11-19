import {hsla, mix, toHex} from '../../runtime/src/color/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const coral = hsla(14, 82, 58);
const mint = hsla(171, 77, 52);

export default function gelatoMixer(stage, ctx) {
  const scoop = {name: 'the gelato mixer scoop', x: 260, y: 240, axis: 'x', minX: 70, maxX: 450};
  return dragStudy(stage, ctx, {height: 270, handles: [scoop], draw(g, {dark, ink}) {
    const t = (scoop.x - scoop.minX) / (scoop.maxX - scoop.minX);
    const blends = [mix(coral, mint, t), mix(coral, mint, t, {space: 'srgb'})];
    blends.forEach((color, i) => {
      const x = 160 + 200 * i;
      polygon(g, [{x: x - 38, y: 91}, {x: x + 38, y: 91}, {x, y: 165}], paintColor(35, 59, dark ? 63 : 70));
      disc(g, x, 76, 37, toHex(color));
      disc(g, x - 11, 65, 10, paintColor(0, 0, 100, .25));
      label(g, i ? 'sRGB' : 'HSLA', x, 196, ink);
    });
    const rail = g.createLinearGradient(scoop.minX, 0, scoop.maxX, 0);
    rail.addColorStop(0, coral);
    rail.addColorStop(1, mint);
    g.fillStyle = rail;
    g.fillRect(scoop.minX, scoop.y - 3, scoop.maxX - scoop.minX, 6);
    disc(g, scoop.x, scoop.y, 17, ink);
    disc(g, scoop.x, scoop.y, 11, toHex(blends[0]));
    return `Same recipe, two mixes. ${Math.round(t * 100)}% mint by interpolation progress.`;
  }});
}
