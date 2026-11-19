import {scene} from '../../runtime/src/core/index.js';
import {lattice} from '../../runtime/src/geometry/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 274;
const GRID = {x: 60, y: 46, width: 400, height: 184};
const COLUMNS = 5;
const ROWS = 3;
const NOODLE = [
  ['M', 62, 160],
  ['C', 130, 160, 130, 94, 202, 94],
  ['C', 274, 94, 264, 175, 330, 175],
  ['C', 392, 175, 383, 121, 458, 121],
];

function trace(g, commands) {
  g.beginPath();
  for (const [command, ...args] of commands) {
    switch (command) {
      case 'M': g.moveTo(...args); break;
      case 'L': g.lineTo(...args); break;
      case 'C': g.bezierCurveTo(...args); break;
    }
  }
}

export default function noodleStretch(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const warp = lattice(drawing, NOODLE, {columns: COLUMNS, rows: ROWS, bounds: GRID, subdivisions: 24});
  const control = warp.point(2, 1);
  const pin = {
    name: 'the noodle grid point', ...control.original,
    minX: 180, maxX: 340, minY: 57, maxY: 221,
  };

  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [pin],
    draw(g, {width, height, dark, ink}) {
      control.x.set(pin.x);
      control.y.set(pin.y);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);

      g.strokeStyle = dark ? '#ffffff26' : '#25221e25';
      g.lineWidth = 1;
      const pointAt = (column, row) => row === 1 && column === 2 ? pin : warp.point(column, row).original;
      g.beginPath();
      for (let row = 0; row < ROWS; row++) {
        for (let column = 0; column < COLUMNS; column++) {
          const point = pointAt(column, row);
          if (column + 1 < COLUMNS) {
            const right = pointAt(column + 1, row);
            g.moveTo(point.x, point.y);
            g.lineTo(right.x, right.y);
          }
          if (row + 1 < ROWS) {
            const below = pointAt(column, row + 1);
            g.moveTo(point.x, point.y);
            g.lineTo(below.x, below.y);
          }
        }
      }
      g.stroke();
      for (const {original} of warp.controls) {
        disc(g, original.x, original.y, 2, dark ? '#ffffff50' : '#25221e50');
      }

      g.lineJoin = 'round';
      g.lineCap = 'round';
      trace(g, warp.sample());
      g.lineWidth = 30;
      g.strokeStyle = colour(ctx, 4, 67, 35);
      g.stroke();
      g.lineWidth = 23;
      g.strokeStyle = colour(ctx, 25, 77, 67);
      g.stroke();
      const displacement = Math.round(Math.hypot(pin.x - control.original.x, pin.y - control.original.y));
      if (displacement) {
        trace(g, NOODLE);
        g.lineWidth = 2;
        g.setLineDash([4, 6]);
        g.strokeStyle = dark ? '#ffffffb0' : '#25221e8c';
        g.stroke();
        g.setLineDash([]);
      }
      disc(g, pin.x, pin.y, 15, ground(ctx));
      disc(g, pin.x, pin.y, 9, colour(ctx, 165, 57, 39));
      label(g, 'Pasta Pilates', width / 2, 246, ink, 17);

      return displacement ? `Grid point moved ${displacement} px. The dashed line marks the original noodle.` : 'Drag the pin to bend the noodle.';
    },
  });
}
