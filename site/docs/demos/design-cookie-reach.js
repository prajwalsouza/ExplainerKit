import {solveTwoBone} from '../../runtime/src/rigs/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const COOKIE_Y = 130;
const ROOT_X = 144;
const LENGTHS = [104, 104];

export default async function cookieReach(stage, ctx) {
  const cookie = {name: 'the cookie', x: 336, y: COOKIE_Y, axis: 'x', minX: 299, maxX: 429};
  return dragStudy(stage, ctx, {
    height: 260,
    handles: [cookie],
    draw(g, {dark, ink}) {
      const guide = paintColor(ctx.hue, 16, dark ? 48 : 64);
      const cookieColor = paintColor(32, 72, dark ? 67 : 53);
      const chocolate = paintColor(25, 60, 24);
      const arms = [
        {y: 79, softness: 0, color: paintColor(200, 62, dark ? 72 : 38), name: 'Hard reach'},
        {y: 177, softness: 48, color: paintColor(344, 66, dark ? 73 : 43), name: 'Soft reach'},
      ];

      g.lineWidth = 1;
      g.strokeStyle = guide;
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(cookie.x, 54);
      g.lineTo(cookie.x, 209);
      g.stroke();
      g.setLineDash([]);

      const gaps = arms.map(({y, softness, color, name}) => {
        const pose = solveTwoBone({root: {x: ROOT_X, y}, lengths: LENGTHS, target: {x: cookie.x, y}, bend: 1, softness});
        g.strokeStyle = color;
        g.lineWidth = 10;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(pose.root.x, pose.root.y);
        g.lineTo(pose.elbow.x, pose.elbow.y);
        g.lineTo(pose.tip.x, pose.tip.y);
        g.stroke();
        disc(g, pose.elbow.x, pose.elbow.y, 5, ink);
        disc(g, pose.tip.x, pose.tip.y, 6, color);
        g.fillStyle = color;
        g.beginPath();
        g.roundRect(40, y - 26, ROOT_X - 36, 52, 11);
        g.fill();
        const face = paintColor(40, 37, 95);
        disc(g, 69, y - 6, 5, face);
        disc(g, 89, y - 6, 5, face);
        disc(g, 71, y - 6, 2, ink);
        disc(g, 91, y - 6, 2, ink);
        g.fillStyle = face;
        g.fillRect(72, y + 8, 16, 2);
        g.strokeStyle = guide;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cookie.x, y, 8, 0, 2 * Math.PI);
        g.stroke();
        label(g, name, 89, y - 43, ink, 18);
        return pose.error;
      });

      disc(g, cookie.x, COOKIE_Y, 23, cookieColor);
      for (const [dx, dy, r] of [[-9, -9, 3.5], [8, -11, 3], [10, 6, 4], [-7, 9, 4], [0, 0, 2.5]]) {
        disc(g, cookie.x + dx, COOKIE_Y + dy, r, chocolate);
      }
      return `Distance from the cookie. Hard reach ${gaps[0].toFixed(1)} units. Soft reach ${gaps[1].toFixed(1)} units.`;
    },
  });
}
