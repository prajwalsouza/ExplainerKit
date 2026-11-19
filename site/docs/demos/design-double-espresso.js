import {skeleton} from '../../runtime/src/rigs/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 274;
const BASE = {x: 260, y: 180};
const body = skeleton({bones: [
  {id: 'torso', length: 37},
  {id: 'left', parent: 'torso', length: 98},
  {id: 'right', parent: 'torso', length: 98},
]});
const posture = body.pose({angles: {torso: -Math.PI / 2, left: -Math.PI / 2, right: Math.PI / 2}});

function paintCup(g, point, fill, stroke) {
  g.fillStyle = fill;
  g.strokeStyle = stroke;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(point.x - 16, point.y - 27, 32, 28, [4, 4, 7, 7]);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(point.x + 17, point.y - 16, 5, -.5 * Math.PI, .5 * Math.PI);
  g.stroke();
}

export default function doubleEspresso(stage, ctx) {
  const hands = [
    {name: 'the left cup', x: 157, y: 147, minX: 57, maxX: 226, minY: 60, maxY: 200},
    {name: 'the right cup', x: 356, y: 135, minX: 297, maxX: 464, minY: 60, maxY: 200},
  ];
  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: hands,
    draw(g, {width, height, ink}) {
      const result = body.solveGoals({
        from: posture, iterations: 28, restarts: 1, tolerance: 1,
        goals: hands.map((cup, index) => ({
          id: index === 0 ? 'left-cup' : 'right-cup',
          end: index === 0 ? 'left' : 'right',
          target: {x: cup.x - BASE.x, y: cup.y - BASE.y},
        })),
      });
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.lineWidth = 13;
      g.lineCap = 'round';
      g.strokeStyle = colour(ctx, -151, 40, 38);
      for (const {start, end} of result.pose.bones) {
        g.beginPath();
        g.moveTo(BASE.x + start.x, BASE.y + start.y);
        g.lineTo(BASE.x + end.x, BASE.y + end.y);
        g.stroke();
        disc(g, BASE.x + end.x, BASE.y + end.y, 8, ink);
      }
      disc(g, BASE.x, BASE.y, 23, colour(ctx, 26, 42, 51));
      disc(g, BASE.x - 7, BASE.y - 2, 2.4, ground(ctx));
      disc(g, BASE.x + 7, BASE.y - 2, 2.4, ground(ctx));
      hands.forEach((cup, index) => {
        paintCup(g, cup, colour(ctx, 32 + index * 100, 35, 70), ink);
        disc(g, cup.x, cup.y + 5, 3, ink);
      });
      label(g, 'Double espresso, single pose', width / 2, 244, ink, 14);
      const errors = result.goals.map(goal => goal.error.toFixed(1));
      return `Distance from grippers to cups. Left ${errors[0]} px. Right ${errors[1]} px.`;
    },
  });
}
