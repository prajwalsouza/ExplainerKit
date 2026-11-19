import {Line, outlineDraw} from '../../runtime/src/geometry/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 285;
const START = 45;
const END = WIDTH - 45;
const SIGNATURE = [
  ['M', 56, 145], ['C', 89, 148, 103, 91, 147, 86],
  ['C', 185, 79, 207, 143, 248, 137],
  ['M', 330, 137], ['C', 367, 100, 426, 108, 462, 129],
];
const line = new Line(SIGNATURE, {tolerance: .2});

function trace(g, commands) {
  const path = new Path2D(commands.map(command => command.join(' ')).join(' '));
  g.stroke(path);
}

function snail(g, position, ctx, ink) {
  g.save();
  g.translate(position.x, position.y - 3);
  g.rotate(position.rotation);
  g.fillStyle = colour(ctx, 152, 37, 45);
  g.beginPath();
  g.roundRect(-23, -11, 42, 12, 6);
  g.fill();
  disc(g, 17, -11, 7, colour(ctx, 152, 37, 45));
  disc(g, -8, -16, 14, colour(ctx, 31, 57, 60));
  g.strokeStyle = ink;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(-8, -16, 7, .1, Math.PI * 1.8);
  g.stroke();
  disc(g, 20, -13, 1.7, ink);
  g.restore();
}

export default function snailSignature(stage, ctx) {
  const nib = {name: 'the ink nib', x: START, y: 230, minX: START, maxX: END, axis: 'x'};
  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [nib],
    draw(g, {width, height, dark, ink}) {
      const progress = (nib.x - START) / (END - START);
      const position = line.at(progress);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.strokeStyle = dark ? '#ffffff68' : '#302b2968';
      g.lineWidth = 2;
      g.setLineDash([3, 5]);
      trace(g, SIGNATURE);
      g.setLineDash([]);
      g.strokeStyle = ink;
      g.lineWidth = 3;
      trace(g, outlineDraw(SIGNATURE, {progress, mode: 'length'}));
      if (position.contour > 0) {
        label(g, 'Pen lift', 290, 159, ink, 14);
      }
      snail(g, position, ctx, ink);
      g.fillStyle = ink;
      g.fillRect(START, nib.y, END - START, 1);
      g.beginPath();
      g.moveTo(nib.x - 7, nib.y - 8);
      g.lineTo(nib.x + 6, nib.y - 8);
      g.lineTo(nib.x + 9, nib.y + 3);
      g.lineTo(nib.x, nib.y + 12);
      g.lineTo(nib.x - 9, nib.y + 3);
      g.closePath();
      g.fillStyle = colour(ctx, -122, 53, 38);
      g.fill();
      label(g, 'Drawn length', width / 2, 258, ink, 13);
      return `${Math.round(progress * 100)}% of the drawn length. Snail on stroke ${position.contour + 1} of 2.`;
    },
  });
}
