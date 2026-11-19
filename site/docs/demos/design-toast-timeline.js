import {createTimeline} from '../../runtime/src/motion/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const action = createTimeline()
  .label('pop', .6)
  .add({bread: {from: 0, to: 1, duration: .43, ease: 'easeOut'}}, 'pop')
  .add({lever: {from: 0, to: 1, duration: .23, ease: 'easeOut'}}, '<<')
  .add({glow: {from: 1, to: 0, duration: .58, ease: 'linear'}}, 'pop');

function roundedBox(g, x, y, w, h, radius, color) {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x, y, w, h, radius);
  g.fill();
}

export default function toastTimeline(stage, ctx) {
  const timer = {name: 'the toaster timer', x: 124, y: 252, axis: 'x', minX: 124, maxX: 396};
  return dragStudy(stage, ctx, {height: 280, handles: [timer], draw(g, {dark, ink}) {
    const time = 1.18 * (timer.x - timer.minX) / (timer.maxX - timer.minX);
    const values = action.sample(time).values;
    const lift = 67 * (values.bread ?? 0);
    const lever = 25 * (values.lever ?? 0);
    roundedBox(g, 209, 107 - lift, 102, 84, 18, paintColor(31, 67, 51));
    roundedBox(g, 218, 114 - lift, 84, 63, 12, paintColor(37, 84, 78));
    disc(g, 247, 133 - lift, 3, paintColor(29, 52, 22));
    disc(g, 273, 133 - lift, 3, paintColor(29, 52, 22));
    roundedBox(g, 164, 135, 191, 71, 17, paintColor(8, 66, dark ? 66 : 56));
    roundedBox(g, 355, 178 - lever, 27, 8, 4, paintColor(12, 22, dark ? 69 : 39));
    disc(g, 186, 185, 5, paintColor(43, 100, 72, .22 + .78 * (values.glow ?? 1)));
    label(g, 'TOAST', 259, 174, paintColor(38, 80, 97), 13);
    g.fillStyle = paintColor(8, 33, dark ? 71 : 42, .4);
    g.fillRect(timer.minX, timer.y - 1, timer.maxX - timer.minX, 2);
    disc(g, timer.x, timer.y, 12, ink);
    return `${time.toFixed(2)} s. ${time < .6 ? 'Waiting for the pop cue.' : 'The bread and lever started together at 0.60 s.'}`;
  }});
}
