import {localProjection} from '../../runtime/src/maps/index.js';
import {osmSummary, parseOverpass} from '../../runtime/src/maps/osm.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const center = {lat: 1, lon: 1};
const project = localProjection({center});
function building(id, x, tags) {
  return {type: 'way', id, tags: {building: 'apartments', ...tags},
    geometry: [[x, 0], [x + 20, 0], [x + 20, 20], [x, 20], [x, 0]].map(([east, north]) => project.unproject(east, north))};
}

export default function tallTale(stage, ctx) {
  const tag = {name: 'the height tag', x: 83, y: 238, axis: 'x', minX: 83, maxX: 437};
  return dragStudy(stage, ctx, {height: 263, handles: [tag], draw(g, {dark, ink}) {
    const tagged = tag.x >= 260;
    const elements = [building(1, -48, {height: '11 m'}), building(2, 22, tagged ? {height: '19 m'} : {})];
    const city = parseOverpass(JSON.stringify({elements}), {center});
    const builds = city.buildings;
    g.fillStyle = paintColor(182, 25, dark ? 62 : 46, .4);
    g.fillRect(50, 172, 420, 2);
    builds.forEach((house, i) => {
      const x = 123 + 192 * i;
      const h = 5.5 * house.height;
      const hue = 191 + i * 35;
      g.fillStyle = paintColor(hue, 47, dark ? 63 : 48, house.inferred.includes('height') ? .55 : 1);
      g.fillRect(x, 171 - h, 83, h);
      polygon(g, [{x, y: 171 - h}, {x: x + 83, y: 171 - h}, {x: x + 112, y: 157 - h}, {x: x + 31, y: 157 - h}], paintColor(hue, 45, dark ? 58 : 57));
      label(g, `${house.height.toFixed(1)} m`, x + 44, 142 - h, ink, 17);
      label(g, house.inferred.includes('height') ? 'Inferred' : 'Tagged', x + 44, 193, ink, 16);
    });
    g.fillStyle = paintColor(192, 28, dark ? 66 : 42, .41);
    g.fillRect(tag.minX, tag.y - 2, tag.maxX - tag.minX, 4);
    disc(g, tag.x, tag.y, 11, ink);
    return `${osmSummary(city).buildings.count} buildings in the fictional extract. The second height is ${builds[1].inferred.includes('height') ? 'inferred from the input' : 'supplied by its height tag'}.`;
  }});
}
