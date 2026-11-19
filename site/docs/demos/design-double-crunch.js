import {hitstop} from '../../runtime/src/juicy/index.js';
import {disc, dragStudy, label, paintColor, clamp} from './design-stage.js';

export default function doubleCrunch(stage, ctx) {
  const clock = {name: 'the impact clock', x: 101, y: 253, axis: 'x', minX: 101, maxX: 419};
  return dragStudy(stage, ctx, {height: 278, handles: [clock], draw(g, {dark, ink}) {
    const time = 2 * (clock.x - clock.minX) / (clock.maxX - clock.minX);
    const stopped = hitstop(time, [{at: .78, hold: .42}]);
    for (const [index, action] of [time, stopped].entries()) {
      const x = 143 + index * 234;
      const top = 73 + 89 * clamp(action / .78, 0, 1) - 42 * clamp((action - .78) / .65, 0, 1);
      const hot = Math.abs(action - .78) < .015;
      label(g, index ? 'With hit-stop' : 'Without hit-stop', x, 37, ink, 17);
      const plate = paintColor(192, 47, dark ? 61 : 51);
      g.fillStyle = plate;
      g.beginPath();
      g.ellipse(x, 196, 75, 11, 0, 0, Math.PI * 2);
      g.fill();
      const apple = paintColor(hot ? 48 : 7, 75, dark ? 67 : 55);
      disc(g, x - 10, top, 25, apple);
      disc(g, x + 10, top, 25, apple);
      g.fillStyle = paintColor(100, 36, dark ? 63 : 39);
      g.fillRect(x, top - 32, 4, 15);
      if (hot) label(g, 'CRUNCH', x + 63, top - 26, ink, 14);
    }
    g.fillStyle = paintColor(191, 25, dark ? 67 : 44, .35);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 12, ink);
    return `Clock ${time.toFixed(2)} s. Action with hit-stop ${stopped.toFixed(2)} s.`;
  }});
}
