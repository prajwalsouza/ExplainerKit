import {fracture, polygon} from '../../runtime/src/geometry/shapes/index.js';
import {disc, dragStudy, label, paintColor, polygon as fillPolygon} from './design-stage.js';

const slab = polygon([
  {x: 104, y: 64}, {x: 393, y: 64}, {x: 415, y: 83}, {x: 415, y: 205},
  {x: 394, y: 225}, {x: 106, y: 225}, {x: 86, y: 205}, {x: 86, y: 83},
]);
const sites = [{x: 127, y: 97}, {x: 365, y: 103}, {x: 130, y: 195}, {x: 370, y: 192}, {x: 256, y: 199}];

export default function iceFracture(stage, ctx) {
  const point = {name: 'the orange fracture site', x: 242, y: 115, minX: 157, maxX: 341, minY: 78, maxY: 160};
  const spread = {name: 'the piece separation handle', x: 89, y: 276, axis: 'x', minX: 89, maxX: 431};
  return dragStudy(stage, ctx, {height: 306, handles: [point, spread], draw(g, {dark, ink}) {
    const amount = (spread.x - spread.minX) / (spread.maxX - spread.minX);
    const result = fracture(slab, {pieces: 6, sites: [{x: point.x, y: point.y}, ...sites]});
    g.fillStyle = paintColor(210, 24, dark ? 25 : 94);
    g.beginPath(); g.roundRect(54, 39, 411, 207, 15); g.fill();
    result.pieces.forEach((piece, index) => {
      const dx = (piece.site.x - 250) * amount * .29;
      const dy = (piece.site.y - 144) * amount * .29;
      const hue = 193 + index * 7;
      for (const outline of piece.polygons) {
        const moved = outline.map(({x, y}) => ({x: x + dx, y: y + dy}));
        fillPolygon(g, moved.map(({x, y}) => ({x: x + 1.4, y: y + 3})), paintColor(hue, 48, 32, .34));
        fillPolygon(g, moved, paintColor(hue, 63, (dark ? 57 : 72) + index * 2));
        g.strokeStyle = paintColor(hue, 41, dark ? 76 : 47, .78);
        g.lineWidth = 1.2;
        g.stroke();
      }
      if (index > 0) disc(g, piece.site.x + dx, piece.site.y + dy, 3.6, paintColor(hue, 35, dark ? 24 : 37));
    });
    disc(g, point.x, point.y, 11, paintColor(25, 82, dark ? 73 : 55));
    disc(g, point.x, point.y, 3.2, ink);
    g.fillStyle = paintColor(197, 27, dark ? 67 : 45, .43);
    g.fillRect(spread.minX, spread.y - 2, spread.maxX - spread.minX, 4);
    disc(g, spread.x, spread.y, 11, ink);
    label(g, 'Together', 42, 277, ink, 14);
    label(g, 'Apart', 468, 277, ink, 14);
    const area = result.pieces.reduce((sum, part) => sum + part.area, 0);
    return `${result.pieces.length} pieces. Together they cover ${Math.round(area).toLocaleString()} square units, the area of the starting slab.`;
  }});
}
