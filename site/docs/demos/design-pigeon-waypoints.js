import {cubicBezier, scene} from '../../runtime/src/core/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const START = {x: 80, y: 158};
const FINISH = {x: 440, y: 140};
const HOP = cubicBezier(.42, 0, .58, 1);

function crumb(g, x, y, color) {
  polygon(g, [
    {x: x - 10, y: y + 3}, {x: x - 9, y: y - 6}, {x: x - 3, y: y - 11},
    {x: x + 7, y: y - 8}, {x: x + 11, y: y + 3}, {x: x + 4, y: y + 8},
  ], color);
}

export default async function pigeonWaypoints(stage, ctx) {
  const drawing = scene({width: 520, height: 270, duration: 2});
  const bird = drawing.group(START);
  const waypoint = {name: 'the middle breadcrumb', x: 260, y: 58, axis: 'y', minY: 34, maxY: 166};
  const clock = {name: 'the route clock', x: 146, y: 224, axis: 'x', minX: 80, maxX: 440};
  bird.keys('x', [
    {at: 0, value: START.x, ease: 'linear'},
    {at: 1, value: waypoint.x, ease: 'linear'},
    {at: 2, value: FINISH.x},
  ]);

  const sample = (time) => drawing.sample({time}).children[0].props;
  let lastY;
  let route;
  return dragStudy(stage, ctx, {
    height: 265,
    handles: [waypoint, clock],
    draw(g, {dark, ink}) {
      if (lastY !== waypoint.y) {
        bird.replaceKeys('y', [
          {at: 0, value: START.y, ease: HOP},
          {at: 1, value: waypoint.y, ease: HOP},
          {at: 2, value: FINISH.y},
        ]);
        route = Array.from({length: 31}, (_, index) => sample(index / 15));
        lastY = waypoint.y;
      }
      const bread = paintColor(42, 75, dark ? 72 : 49);
      const body = paintColor(216, 30, dark ? 75 : 44);
      const neck = paintColor(166, 43, dark ? 66 : 42);
      const wing = paintColor(216, 27, dark ? 60 : 32);
      const faint = paintColor(ctx.hue, 22, dark ? 55 : 54, .48);
      const time = 2 * (clock.x - clock.minX) / (clock.maxX - clock.minX);
      const pose = sample(time);

      for (const point of route) disc(g, point.x, point.y, 1.7, faint);
      for (const point of [START, waypoint, FINISH]) crumb(g, point.x, point.y, bread);
      g.save();
      g.translate(pose.x, pose.y - 17);
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(-3, 0, 16, 9, -.2, 0, 2 * Math.PI);
      g.fill();
      polygon(g, [{x:-11,y:-3},{x:-22,y:2},{x:-15,y:5},{x:6,y:4},{x:13,y:-6}], wing);
      disc(g, 9, -7, 6.5, neck);
      disc(g, 11, -9, 1.7, ink);
      polygon(g, [{x:14,y:-9},{x:20,y:-7},{x:14,y:-5}], bread);
      g.restore();

      g.fillStyle = faint;
      g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
      disc(g, 260, clock.y, 4, bread);
      disc(g, clock.x, clock.y, 13, neck);
      label(g, '◷', clock.x, clock.y, paintColor(35, 38, 95), 19);
      label(g, '0 s', 80, 247, ink, 14);
      label(g, '1 s', 260, 247, ink, 14);
      label(g, '2 s', 440, 247, ink, 14);
      return `${time.toFixed(2)} s. The middle key is at y = ${Math.round(waypoint.y)} scene units.`;
    },
  });
}
