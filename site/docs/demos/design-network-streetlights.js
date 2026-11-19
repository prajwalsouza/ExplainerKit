import {points} from '../../runtime/src/procedural/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const stops = [[75, 143], [252, 143], [416, 141], [362, 52], [317, 218]];
const roads = [[0,1], [1,2], [1,3], [1,4]];

export default function networkStreetlights(stage, ctx) {
  const spacing = {name: 'the streetlight spacing', x: 193, y: 256, axis: 'x', minX: 83, maxX: 430};
  return dragStudy(stage, ctx, {height: 280, handles: [spacing], draw(g, {dark, ink}) {
    const distance = 20 + Math.round(37 * (spacing.x - spacing.minX) / (spacing.maxX - spacing.minX));
    const lamps = points({along: {nodes: stops, edges: roads}, spacing: distance, junctions: true, offset: 8, alternate: true});
    g.strokeStyle = paintColor(217, 16, dark ? 69 : 37, .39);
    g.lineWidth = 10;
    g.lineCap = 'round';
    for (const [a, b] of roads) {
      g.beginPath(); g.moveTo(...stops[a]); g.lineTo(...stops[b]); g.stroke();
    }
    const x = lamps.x, y = lamps.y;
    for (let i = 0; i < lamps.count; i++) {
      disc(g, x[i], y[i], 9, paintColor(40, 91, dark ? 70 : 52, .21));
      disc(g, x[i], y[i], 3, paintColor(34, 94, dark ? 76 : 39));
    }
    label(g, 'Shared junction', 188, 106, ink, 15);
    g.fillStyle = paintColor(36, 30, dark ? 63 : 42, .4);
    g.fillRect(spacing.minX, spacing.y - 2, spacing.maxX - spacing.minX, 4);
    disc(g, spacing.x, spacing.y, 11, ink);
    return `${lamps.count} lights at spacing ${distance}. The junction stays anchored as other lights are placed along the roads.`;
  }});
}
