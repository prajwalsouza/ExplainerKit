import {quadrupedGait} from '../../runtime/src/characters/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const ROUTE_START = 103;
const ROUTE_END = 395;
const GROUND = 174;
const LEGS = ['RH', 'RF', 'LH', 'LF'];
const NAMES = {LH: 'left hind', RF: 'right fore', RH: 'right hind', LF: 'left fore'};

export default async function fourFootMail(stage, ctx) {
  const speed = 88;
  const dog = quadrupedGait({
    gait: 'trot', speed, stride: 72, ground: GROUND, start: ROUTE_START,
    hip: {x: -34, y: 4}, shoulder: {x: 34, y: 4}, legs: {upper: 29, lower: 29},
  });
  const stamp = {name: 'the envelope on the route', x: ROUTE_START + 18, y: 226, axis: 'x', minX: ROUTE_START, maxX: ROUTE_END};
  return dragStudy(stage, ctx, {
    height: 265,
    handles: [stamp],
    draw(g, {dark, ink}) {
      const pose = dog.pose((stamp.x - ROUTE_START) / speed);
      const coat = paintColor(26, 56, dark ? 69 : 49);
      const ears = paintColor(24, 42, dark ? 48 : 35);
      const track = paintColor(ctx.hue, 22, dark ? 40 : 71);
      const mail = paintColor(47, 80, dark ? 77 : 63);
      const pairA = paintColor(175, 52, dark ? 69 : 34);
      const pairB = paintColor(302, 57, dark ? 72 : 40);
      g.fillStyle = track;
      g.fillRect(31, GROUND + 2, 461, 2);
      for (const x of [ROUTE_START, 184, 260, 337, ROUTE_END]) {
        disc(g, x, 225, 3, track);
      }
      g.lineWidth = 1;
      g.strokeStyle = track;
      g.setLineDash([3, 5]);
      g.beginPath();
      g.moveTo(ROUTE_START, 225);
      g.lineTo(ROUTE_END, 225);
      g.stroke();
      g.setLineDash([]);

      g.fillStyle = track;
      g.fillRect(469, 136, 5, 38);
      g.fillStyle = pairA;
      g.beginPath();
      g.roundRect(444, 115, 47, 25, [11, 11, 2, 2]);
      g.fill();
      g.fillStyle = ink;
      g.fillRect(448, 122, 22, 3);

      for (const key of LEGS) {
        const root = key.endsWith('H') ? pose.roots.hind : pose.roots.fore;
        const knee = pose.knees[key];
        const foot = pose.feet[key];
        const pair = key === 'LH' || key === 'RF' ? pairA : pairB;
        g.strokeStyle = pair;
        g.globalAlpha = key.startsWith('R') ? .55 : 1;
        g.lineWidth = 5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(root.x, root.y);
        g.lineTo(knee.x, knee.y);
        g.lineTo(foot.x, foot.y);
        g.stroke();
        g.globalAlpha = 1;
        if (foot.planted) {
          g.fillStyle = pair;
          g.fillRect(foot.x - 6, GROUND + 3, 12, 3);
          disc(g, foot.x, foot.y, 4, pair);
        }
        label(g, key, foot.x, GROUND + (key.startsWith('R') ? 29 : 15), pair, 11);
      }

      g.save();
      g.translate(pose.body.x, pose.body.y);
      g.rotate(pose.body.pitch);
      g.fillStyle = coat;
      g.beginPath();
      g.ellipse(0, -7, 47, 17, 0, 0, 2 * Math.PI);
      g.fill();
      g.strokeStyle = coat;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(-37, -9);
      g.quadraticCurveTo(-55, -6, -63, -29);
      g.stroke();
      disc(g, 40, -23, 19, coat);
      g.fillStyle = ears;
      g.beginPath();
      g.ellipse(31, -16, 8, 15, -.22, 0, 2 * Math.PI);
      g.fill();
      disc(g, 49, -29, 3, ink);
      polygon(g, [{x: 50, y: -26}, {x: 68, y: -24}, {x: 67, y: -15}, {x: 50, y: -13}], coat);
      disc(g, 65, -22, 4, ink);
      g.fillStyle = mail;
      g.fillRect(56, -13, 24, 15);
      g.strokeStyle = ears;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(56, -13);
      g.lineTo(68, -5);
      g.lineTo(80, -13);
      g.stroke();
      g.restore();

      g.fillStyle = mail;
      g.beginPath();
      g.roundRect(stamp.x - 15, stamp.y - 10, 30, 20, 4);
      g.fill();
      g.strokeStyle = ears;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(stamp.x - 14, stamp.y - 9);
      g.lineTo(stamp.x, stamp.y + 1);
      g.lineTo(stamp.x + 14, stamp.y - 9);
      g.stroke();
      label(g, 'Kennel', ROUTE_START, 250, ink, 15);
      label(g, 'Letterbox', ROUTE_END, 250, ink, 15);
      return `Planted paws. ${LEGS.filter(leg => pose.feet[leg].planted).map(leg => NAMES[leg]).join(' and ')}.`;
    },
  });
}
