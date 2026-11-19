import {auditHandover} from '../../runtime/src/audit/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 238;
const PANEL = {width: 224, height: 164};
const LEFT = 20;
const RIGHT = 276;
const TOP = 42;
const ANCHOR = {id: 'cup', x: 102, y: 88, size: 38};

function mug(g, x, y, color, ink) {
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(x + 23, y + 4, 12, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x - 22, y - 18, 43, 44, [4, 4, 11, 11]);
  g.fill();
  disc(g, x, y, 3, ink);
}

export default function cupContinuity(stage, ctx) {
  const cup = {name: 'the incoming cup', x: RIGHT + 158, y: TOP + 67, minX: RIGHT + 39, maxX: RIGHT + 178, minY: TOP + 32, maxY: TOP + 112};
  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [cup],
    draw(g, {width, height, ink}) {
      const color = colour(ctx, 31, 57, 46);
      const incoming = {...ANCHOR, x: cup.x - RIGHT, y: cup.y - TOP};
      const audit = auditHandover({viewport: PANEL, from: [ANCHOR], to: [incoming]});
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      for (const [left, text] of [[LEFT, 'Outgoing shot'], [RIGHT, 'Incoming shot']]) {
        label(g, text, left + PANEL.width / 2, 23, ink, 15);
        g.fillStyle = colour(ctx, -28, 15, 78);
        g.fillRect(left, TOP, PANEL.width, PANEL.height);
        g.fillStyle = colour(ctx, -10, 20, 40);
        g.fillRect(left, TOP + 120, PANEL.width, 44);
      }
      mug(g, LEFT + ANCHOR.x, TOP + ANCHOR.y, color, ink);
      g.strokeStyle = ink;
      g.lineWidth = 1.5;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.arc(RIGHT + ANCHOR.x, TOP + ANCHOR.y, 29, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      mug(g, cup.x, cup.y, color, ink);
      const distance = Math.hypot(ANCHOR.x - incoming.x, ANCHOR.y - incoming.y);
      return audit.status === 'pass' ? 'Pass. The cup’s anchor lines up across both shots.' : `Fail. The cup jumps ${distance.toFixed(1)} px between shots.`;
    },
  });
}
