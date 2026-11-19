import {intersect, polygon, subtract, union} from '../../runtime/src/geometry/shapes/index.js';
import {disc, dragStudy, label, paintColor, polygon as fillPolygon} from './design-stage.js';

const circle = (x, y, radius, vertices) => Array.from({length: vertices}, (_, index) => {
  const angle = 2 * Math.PI * index / vertices;
  return {x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle)};
});
const center = {x: 257, y: 107};
const cookie = polygon(circle(center.x, center.y, 78, 32));
const chips = [[219, 86], [252, 99], [239, 55], [291, 118], [219, 133], [277, 150], [304, 88], [192, 109]];

export default function cookieCutter(stage, ctx) {
  const cutter = {name: 'the round cutter', x: 305, y: 83, minX: 128, maxX: 394, minY: 45, maxY: 158};
  return dragStudy(stage, ctx, {height: 371, handles: [cutter], draw(g, {dark, ink}) {
    const disk = circle(cutter.x, cutter.y, 46, 22);
    const colors = {
      biscuit: paintColor(34, 73, dark ? 69 : 66),
      chips: paintColor(24, 62, dark ? 37 : 39, .65),
      cutter: paintColor(183, 49, dark ? 69 : 43),
      overlap: paintColor(302, 39, dark ? 73 : 52),
      cards: paintColor(36, 28, dark ? 30 : 95),
    };
    fillPolygon(g, cookie.polygons[0], colors.biscuit);
    for (const [x, y] of chips) disc(g, x, y, 5.5, colors.chips);
    fillPolygon(g, disk, paintColor(176, 48, 48, .25));
    g.strokeStyle = colors.cutter;
    g.lineWidth = 2.5;
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(disk[0].x, disk[0].y);
    for (const point of disk.slice(1)) g.lineTo(point.x, point.y);
    g.closePath();
    g.stroke();
    g.setLineDash([]);
    disc(g, cutter.x, cutter.y, 14, colors.cutter);
    disc(g, cutter.x, cutter.y, 5, ink);
    g.strokeStyle = paintColor(36, 17, dark ? 68 : 54, .3);
    g.beginPath(); g.moveTo(24, 204); g.lineTo(496, 204); g.stroke();

    const results = [
      {name: 'Union', region: union(cookie, disk), fill: colors.cutter},
      {name: 'Subtract', region: subtract(cookie, disk), fill: colors.biscuit},
      {name: 'Intersect', region: intersect(cookie, disk), fill: colors.overlap},
    ];
    for (const [index, {name, region, fill}] of results.entries()) {
      const x = 91 + 169 * index;
      g.fillStyle = colors.cards;
      g.beginPath(); g.roundRect(x - 76, 222, 152, 128, 12); g.fill();
      g.save();
      g.translate(x - center.x * .35, 278 - center.y * .35);
      g.scale(.35, .35);
      for (const outline of region.polygons) fillPolygon(g, outline, fill);
      g.restore();
      label(g, name, x, 325, ink, 19);
    }
    const relativeArea = region => Math.round(region.area / cookie.area * 100);
    return `Area relative to the original cookie. Union ${relativeArea(results[0].region)}%. Subtraction ${relativeArea(results[1].region)}%. Intersection ${relativeArea(results[2].region)}%.`;
  }});
}
