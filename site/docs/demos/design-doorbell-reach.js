import {bipedMotion} from '../../runtime/src/characters/index.js';
import {disc, dragStudy, paintColor} from './design-stage.js';

const ORIGIN = {x: 214, y: 210};
const SCALE = 105;
const model = bipedMotion({path: () => ({x: 0, z: 0, heading: 0})});
const screen = point => ({x: ORIGIN.x + point.x * SCALE, y: ORIGIN.y - point.y * SCALE});

export default async function doorbellReach(stage, ctx) {
  const bell = {name: 'the doorbell', x: 301, y: 91, minX: 263, maxX: 453, minY: 40, maxY: 169};
  return dragStudy(stage, ctx, {
    height: 238,
    handles: [bell],
    draw(g, {dark, ink}) {
      const target = {x: (bell.x - ORIGIN.x) / SCALE, y: (ORIGIN.y - bell.y) / SCALE, z: 0};
      const pose = model.sample(.4, {reach: {side: 'right', target, weight: 1}});
      const limb = pose.arms[1];
      const coat = paintColor(197, 51, dark ? 71 : 38);
      const trim = paintColor(ctx.hue, 31, dark ? 56 : 62);
      const brass = paintColor(41, 83, dark ? 70 : 48);
      const floor = paintColor(ctx.hue, 15, dark ? 36 : 79);
      function line(points, color, width) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (const {x,y} of points.slice(1)) g.lineTo(x, y);
        g.stroke();
      }
      g.fillStyle = floor;
      g.fillRect(68, ORIGIN.y, 407, 2);
      for (const leg of pose.legs) line([leg.root, leg.joint, leg.tip].map(screen), coat, 7);
      line(pose.legs.map(leg => screen(leg.root)), coat, 9);
      line([pose.pelvis, pose.chest].map(screen), coat, 19);
      line(pose.arms.map(arm => screen(arm.root)), coat, 9);
      const head = screen(pose.head);
      disc(g, head.x, head.y, 13, coat);
      disc(g, head.x + 4, head.y - 1, 2, ink);
      for (const arm of pose.arms) line([arm.root, arm.joint, arm.tip].map(screen), coat, 5);
      g.setLineDash([4, 4]);
      line([screen(limb.tip), bell], trim, 1.5);
      g.setLineDash([]);
      const grip = screen(limb.tip);
      disc(g, grip.x, grip.y, 5, coat);
      g.fillStyle = trim;
      g.beginPath();
      g.roundRect(bell.x - 11, bell.y - 16, 22, 32, 5);
      g.fill();
      disc(g, bell.x, bell.y, 6, brass);
      return limb.error < 1e-6 ? 'Ding-dong. The fingertip reaches the button.' : `Just out of reach. Hand error is ${limb.error.toFixed(2)} model units.`;
    },
  });
}
