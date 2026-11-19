import {idle, scene} from '../../runtime/src/core/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const START = .85;
const END = 2.95;
const DURATION = 4;

function oval(g, x, y, rx, ry, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  g.fill();
}

export default async function penguinPortrait(stage, ctx) {
  const drawing = scene({width: 520, height: 270, duration: DURATION});
  const penguin = drawing.group({x: 260, y: 107});
  const movement = idle(penguin, {
    sway: {amplitude: 18, period: 1.8},
    turn: {amplitude: .2, period: 1.9},
    breathe: {amplitude: .11, period: 1.4},
  }).during({from: START, to: END, fade: .25});
  const shutter = {name: 'the exposure marker', x: 134, y: 222, axis: 'x', minX: 70, maxX: 450};
  const dispose = dragStudy(stage, ctx, {
    height: 265,
    handles: [shutter],
    draw(g, {dark, ink}) {
      const shutterRange = shutter.maxX - shutter.minX;
      const time = (shutter.x - shutter.minX) / shutterRange * DURATION;
      const pose = drawing.sample({time}).children[0].props;
      const frame = paintColor(ctx.hue, 22, dark ? 66 : 46);
      const studio = paintColor(190, 46, dark ? 24 : 90);
      const bill = paintColor(39, 92, dark ? 67 : 53);
      const coat = paintColor(210, 37, dark ? 15 : 22);
      const belly = paintColor(42, 44, 95);
      g.fillStyle = studio;
      g.beginPath();
      g.roundRect(133, 22, 254, 169, 14);
      g.fill();
      g.strokeStyle = frame;
      g.lineWidth = 2;
      for (const [x, y, dx, dy] of [[151, 40, 1, 1], [370, 40, -1, 1], [151, 173, 1, -1], [370, 173, -1, -1]]) {
        g.beginPath();
        g.moveTo(x + 12*dx, y);
        g.lineTo(x, y);
        g.lineTo(x, y + 12*dy);
        g.stroke();
      }
      oval(g, 260, 168, 44, 6, paintColor(187, 39, dark ? 18 : 78));
      g.save();
      g.translate(pose.x, pose.y);
      g.rotate(pose.rotation);
      g.scale(pose.scaleX, pose.scaleY);
      oval(g, -22, 49, 15, 6, bill);
      oval(g, 22, 49, 15, 6, bill);
      oval(g, 0, 1, 38, 52, coat);
      oval(g, 0, 16, 25, 32, belly);
      disc(g, -11, -17, 8, belly);
      disc(g, 11, -17, 8, belly);
      disc(g, -10, -17, 3, coat);
      disc(g, 10, -17, 3, coat);
      polygon(g, [{x: -6, y: -8}, {x: 6, y: -8}, {x: 0, y: 0}], bill);
      g.restore();

      g.fillStyle = studio;
      g.fillRect(shutter.minX, shutter.y - 3, shutterRange, 6);
      g.fillStyle = frame;
      g.fillRect(shutter.minX + shutterRange * START / DURATION, shutter.y - 3, shutterRange * (END - START) / DURATION, 6);
      disc(g, shutter.x, shutter.y, 13, bill);
      disc(g, shutter.x, shutter.y, 6, coat);
      label(g, 'Idle window', 250, 247, ink, 15);
      const active = time > START && time < END;
      return `${time.toFixed(2)} s. ${active ? 'Please hold still-ish.' : 'The penguin is holding still.'}`;
    },
  });
  return () => {
    dispose();
    movement.dispose();
  };
}
