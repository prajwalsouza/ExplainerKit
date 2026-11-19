import {perceptualGroups} from '../../runtime/src/perception/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

export default function birdsOfACluster(stage, ctx) {
  const bird = {name: 'the wandering bird', x: 230, y: 204, minX: 48, maxX: 470, minY: 55, maxY: 225};
  return dragStudy(stage, ctx, {height: 270, handles: [bird], draw(g, {dark, ink}) {
    const members = [{x: 112, y: 110}, {x: 159, y: 125}, bird, {x: 299, y: 126}, {x: 359, y: 112}];
    const plan = perceptualGroups(members.map(({x, y}, index) => ({id: String(index), bounds: {x: x - 16, y: y - 13, width: 32, height: 26}})), {distance: 39});
    plan.groups.forEach(({members: ids}, index) => {
      const people = ids.map(id => members[Number(id)]);
      const hue = 105 + index * 54;
      const x0 = Math.min(...people.map(({x}) => x)) - 29;
      const x1 = Math.max(...people.map(({x}) => x)) + 29;
      const y0 = Math.min(...people.map(({y}) => y)) - 26;
      const y1 = Math.max(...people.map(({y}) => y)) + 26;
      g.fillStyle = paintColor(hue, 55, dark ? 62 : 53, .15);
      g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 19); g.fill();
      for (const {x, y} of people) {
        disc(g, x - 7, y + 2, 13, paintColor(hue, 54, dark ? 67 : 49));
        disc(g, x + 6, y - 7, 9, paintColor(hue, 54, dark ? 67 : 49));
        polygon(g, [{x: x + 12, y: y - 8}, {x: x + 23, y: y - 4}, {x: x + 12, y: y}], paintColor(31, 70, 62));
        disc(g, x + 8, y - 9, 2, ink);
      }
    });
    label(g, 'Move the unpaired bird', 260, 35, ink, 18);
    return `The grouping rule suggests ${plan.groups.length} ${plan.groups.length === 1 ? 'flock' : 'flocks'}. A chain of nearby birds can join the whole group.`;
  }});
}
