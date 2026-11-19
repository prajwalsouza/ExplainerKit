import {ease} from '../../runtime/src/core/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const measured = ease.fromSamples([0, .22, .52, .82, 1], [0, .36, 1.14, 1.04, 1]);

export default function slipperyData(stage, ctx) {
  const time = {name: 'the replay time', x: 82, y: 237, axis: 'x', minX: 82, maxX: 438};
  return dragStudy(stage, ctx, {height: 261, handles: [time], draw(g, {dark, ink}) {
    const t = (time.x - time.minX) / (time.maxX - time.minX);
    const finish = 397;
    g.strokeStyle = paintColor(31, 25, dark ? 67 : 44, .48);
    g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(finish, 35); g.lineTo(finish, 187); g.stroke();
    g.setLineDash([]);
    for (const [i, fraction] of [t, measured(t)].entries()) {
      const y = 71 + 82 * i;
      const x = 137 + (finish - 137) * fraction;
      label(g, i ? 'Measured' : 'Linear', 69, y, ink, 17);
      g.fillStyle = paintColor(32, 81, dark ? 66 : 56);
      g.beginPath();
      g.roundRect(x - 21, y - 15, 42, 29, 10);
      g.fill();
      disc(g, x + 8, y - 4, 3, ink);
      g.fillStyle = paintColor(39, 54, dark ? 72 : 49, .45);
      g.fillRect(130, y + 24, 283, 2);
    }
    g.fillStyle = paintColor(31, 25, dark ? 65 : 47, .35);
    g.fillRect(time.minX, time.y - 2, time.maxX - time.minX, 4);
    disc(g, time.x, time.y, 12, ink);
    return `Clock ${(100 * t).toFixed(0)}%. Measured motion ${(100 * measured(t)).toFixed(0)}% of the start-to-finish distance.`;
  }});
}
