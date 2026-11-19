import {bin, scale} from '../../runtime/src/data/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const domain = [10, 40];
const thresholds = [20, 30];
const position = scale({domain, range: [80, 440], clamp: true});
const batch = [14, 18, 25, 32, 36].map((diameter, id) => ({id, diameter}));

function donut(g, x, y, r, pink, dark) {
  const icing = g.createLinearGradient(x - r * .7, y - r, x + .8 * r, y + r);
  icing.addColorStop(0, pink ? paintColor(340, 76, dark ? 77 : 78) : paintColor(41, 75, 74));
  icing.addColorStop(1, pink ? paintColor(332, 64, dark ? 49 : 48) : paintColor(28, 64, 51));
  g.fillStyle = icing;
  g.beginPath();
  g.arc(x, y, r, 0, 2 * Math.PI);
  g.moveTo(x + r * .4, y);
  g.arc(x, y, r * .4, 0, 2 * Math.PI);
  g.fill('evenodd');
  const sprinkle = pink ? paintColor(349, 86, 96) : paintColor(44, 67, 94);
  for (const angle of [-2.6, -1.53, -.42, .95, 2.2]) {
    disc(g, x + .73 * r * Math.cos(angle), y + .73 * r * Math.sin(angle), Math.max(1.1, r * .09), sprinkle);
  }
}

export default function donutBins(stage, ctx) {
  const handle = {name: 'pink doughnut on the measuring rail', x: position(29), y: 215, axis: 'x', minX: position(10), maxX: position(40)};
  return dragStudy(stage, ctx, {height: 280, handles: [handle], draw(g, {dark, ink}) {
    const diameter = Math.round(position.invert(handle.x));
    const {bins} = bin([...batch, {id: 'pink', diameter}], {field: 'diameter', domain, thresholds});
    let selected;
    for (const [index, interval] of bins.entries()) {
      const left = 13 + 169 * index;
      const active = interval.rows.some(row => row.id === 'pink');
      if (active) selected = interval;
      g.fillStyle = active ? paintColor(332, 28, dark ? 24 : 92) : paintColor(30, 26, dark ? 20 : 93);
      g.strokeStyle = active ? paintColor(332, 44, dark ? 65 : 42) : paintColor(26, 24, dark ? 43 : 67);
      g.lineWidth = active ? 2 : 1;
      g.beginPath();
      g.roundRect(left, 16, 155, 135, 12);
      g.fill();
      g.stroke();
      const inclusive = interval.x1 === domain[1];
      label(g, `[${interval.x0}, ${interval.x1}${inclusive ? ']' : ')'}`, left + 77.5, 43, ink, 19);
      for (let slot = 0; slot < 3; slot++) {
        const x = left + 33 + 44 * slot;
        disc(g, x, 90, 18, paintColor(33, 21, dark ? 28 : 86));
        const row = interval.rows[slot];
        if (row) donut(g, x, 90, 13 + .07 * row.diameter, row.id === 'pink', dark);
      }
      label(g, `${interval.count} ${interval.count === 1 ? 'doughnut' : 'doughnuts'}`, left + 77.5, 130, ink, 18);
    }

    const edge = paintColor(30, 33, dark ? 67 : 45);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(handle.minX, handle.y);
    g.lineTo(handle.maxX, handle.y);
    g.stroke();
    for (const tick of [10, ...thresholds, 40]) {
      const x = position(tick);
      disc(g, x, handle.y, 3, edge);
      label(g, `${tick} mm`, x, 268, ink, 16);
    }
    donut(g, handle.x, handle.y, 12 + .24 * diameter, true, dark);
    label(g, `${diameter} mm`, handle.x, 169, ink, 19);
    const end = selected.x1 === domain[1] ? 'included' : 'excluded';
    return `The pink doughnut is ${diameter} mm. Its tray runs from ${selected.x0} to ${selected.x1} mm, with ${selected.x1} mm ${end}. Tray counts are ${bins.map(item => item.count).join(', ')}.`;
  }});
}
