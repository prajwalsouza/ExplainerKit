import {springTiming} from '../../runtime/src/motion/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const timing = springTiming({stiffness: 100, damping: 7});

export default function springCleaning(stage, ctx) {
  const clock = {name: 'the spring clock', x: 74, y: 245, axis: 'x', minX: 74, maxX: 446};
  return dragStudy(stage, ctx, {height: 270, handles: [clock], draw(g, {dark, ink}) {
    const progress = (clock.x - clock.minX) / (clock.maxX - clock.minX);
    const rest = 346;
    const x = 92 + timing.ease(progress) * (rest - 92);
    g.strokeStyle = paintColor(261, 40, dark ? 75 : 43, .35);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(52, 145);
    for (let i = 0; i <= 24; i++) g.lineTo(54 + (x - 76) * i / 24, 145 + 9 * Math.sin(i * Math.PI / 2));
    g.stroke();
    g.fillStyle = paintColor(261, 40, dark ? 75 : 43, .45);
    g.fillRect(rest - 1, 72, 2, 119);
    label(g, 'Rest', rest, 51, ink);
    for (const [dx, dy, radius] of [[-13, 0, 17], [9, 4, 19], [0, -13, 17], [0, 11, 17]]) {
      disc(g, x + dx, 145 + dy, radius, paintColor(262, 41, dark ? 68 : 62));
    }
    disc(g, x - 6, 143, 2.7, ink);
    disc(g, x + 6, 143, 2.7, ink);
    g.fillStyle = paintColor(261, 30, dark ? 73 : 47, .4);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 12, ink);
    return `${(progress * timing.duration).toFixed(2)} s of ${timing.duration.toFixed(2)} s. ${x > rest + .5 ? 'The dust bunny has overshot its mark.' : 'The line marks the resting position.'}`;
  }});
}
