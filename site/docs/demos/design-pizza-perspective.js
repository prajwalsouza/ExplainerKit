import {orthographicCamera, perspectiveCamera, projectPoint} from '../../runtime/src/spatial/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const viewport = {width: 260, height: 213};
const camera = {z: 300, fov: Math.PI / 3};
const views = [perspectiveCamera(camera, viewport), orthographicCamera({z: 300}, viewport)];

export default function pizzaPerspective(stage, ctx) {
  const depth = {name: 'the back pizza’s distance', x: 176, y: 240, axis: 'x', minX: 80, maxX: 440};
  return dragStudy(stage, ctx, {height: 265, handles: [depth], draw(g, {dark, ink}) {
    const z = -20 - 300 * (depth.x - depth.minX) / (depth.maxX - depth.minX);
    views.forEach((view, i) => {
      g.save();
      g.translate(260 * i, 0);
      label(g, i ? 'Orthographic' : 'Perspective', 130, 32, ink);
      for (const p of [{x: 47, y: 3, z}, {x: -47, y: -9, z: 0}]) {
        const center = projectPoint(view, p);
        const edge = projectPoint(view, {...p, x: p.x + 37});
        const radius = Math.abs(edge.x - center.x);
        disc(g, center.x, center.y, radius, paintColor(32, 74, dark ? 66 : 53));
        disc(g, center.x, center.y, radius * .86, paintColor(45, 84, dark ? 72 : 73));
        for (const [dx, dy] of [[0, -.44], [.42, .26], [-.4, .25]]) disc(g, center.x + radius * dx, center.y + radius * dy, radius * .15, paintColor(8, 60, dark ? 58 : 48));
      }
      g.restore();
    });
    g.fillStyle = paintColor(15, 28, dark ? 70 : 41, .35);
    g.fillRect(depth.minX, depth.y - 2, depth.maxX - depth.minX, 4);
    disc(g, depth.x, depth.y, 13, ink);
    return `The second pizza is ${Math.round(-z)} world units behind the first. Both have the same world radius.`;
  }});
}
