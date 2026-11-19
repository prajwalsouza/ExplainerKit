import {scene} from '../../runtime/src/core/index.js';
import {character, starter, surface} from '../../runtime/src/characters/index.js';
import {disc, paintColor, polygon} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 273;
const GROUND = surface({points: [[0,196], [127,196], [312,142], [520,192]]});

export default async function slopeStroll(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT});
  const person = character(drawing, starter('bean-student'), {x: 79, standOn: GROUND, size: .53, idle: false});
  const duration = person.walkTo(435, {speed: 98});
  const walker = {name: 'the trail marker', x: 224, y: 238, axis: 'x', minX: 79, maxX: 435};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [walker],
    draw(g, {dark, ink}, paint) {
      const time = duration * (walker.x - walker.minX) / (walker.maxX - walker.minX);
      const grass = paintColor(157, 35, dark ? 31 : 65);
      const edge = paintColor(157, 53, dark ? 52 : 36);
      const marker = paintColor(ctx.hue, 70, dark ? 70 : 43);
      const points = GROUND.points.map(([x, y]) => ({x, y}));
      polygon(g, [...points, {x: 520, y: 214}, {x: 0, y: 214}], grass);
      g.strokeStyle = edge;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (const {x, y} of points.slice(1)) g.lineTo(x, y);
      g.stroke();
      paint(g, time);
      const planted = [['Front', 'footF'], ['Back', 'footB']].flatMap(([name, key]) => {
        const foot = person.socket(key, time);
        if (Math.abs(foot.y - GROUND.yAt(foot.x)) > 1e-5) return [];
        disc(g, foot.x, foot.y, 4, marker);
        return [name.toLowerCase()];
      });
      rail(g, walker, marker, ink, 'Trailhead', 'Finish');
      g.strokeStyle = paintColor(40, 32, 96);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(walker.x - 4, walker.y + 5);
      g.lineTo(walker.x, walker.y - 4);
      g.lineTo(walker.x + 4, walker.y + 5);
      g.stroke();
      return `${time.toFixed(2)} s. Ground contact at the ${planted.join(' and ')} foot${planted.length > 1 ? ' positions' : ''}.`;
    },
  });
}
