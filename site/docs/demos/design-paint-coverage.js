import {auditPalette, comparePalettes} from '../../runtime/src/audit/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const W = 100;
const H = 50;
const blue = paintColor(210, 64, 57);
const coral = paintColor(13, 73, 61);

export default function paintCoverage(stage, ctx) {
  const roller = {name: 'the paint roller', x: 260, y: 123, axis: 'x', minX: 65, maxX: 453};
  const board = document.createElement('canvas');
  board.width = W;
  board.height = H;
  const paint = board.getContext('2d', {willReadFrequently: true});
  function measure(size) {
    paint.fillStyle = blue;
    paint.fillRect(0, 0, W, H);
    paint.fillStyle = coral;
    paint.fillRect(0, 0, size, H);
    const {data} = paint.getImageData(0, 0, W, H);
    return auditPalette({pixels: {width: W, height: H, data}, maxColors: 2});
  }
  const reference = measure(50);
  let previous, report, delta;
  return dragStudy(stage, ctx, {height: 257, handles: [roller], draw(g, {ink}) {
    const size = Math.round(100 * (roller.x - roller.minX) / (roller.maxX - roller.minX));
    if (previous !== size) {
      report = measure(size);
      delta = comparePalettes(reference, report);
      previous = size;
    }
    g.drawImage(board, 65, 38, 388, 170);
    const radius = 14;
    disc(g, roller.x, roller.y, radius, ink);
    disc(g, roller.x, roller.y, radius - 4, coral);
    const sizes = report.clusters.map(c => Math.round(100 * c.coverage));
    label(g, sizes.map(n => `${n}%`).join(' / '), 260, 230, ink, 18);
    return `Measured cluster shares ${sizes.map(n => `${n}%`).join(' and ')}. Drift from the half-painted wall is ${delta.drift.toFixed(3)}.`;
  }});
}
