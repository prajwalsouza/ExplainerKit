import {auditMotion} from '../../runtime/src/audit/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const END_X = 411;
const GROUND = 163;
const TOLERANCE = 12;
const flight = t => [71 + (END_X - 71) * t, GROUND - 92 * Math.sin(Math.PI * t)];

export default async function droneLanding(stage, ctx) {
  const pad = {name: 'the delivery pad', x: END_X - 3, y: GROUND, axis: 'x', minX: 288, maxX: 472};
  return dragStudy(stage, ctx, {
    height: 235,
    handles: [pad],
    draw(g, {dark, ink}) {
      const report = auditMotion(flight, {
        to: 1, fps: 30, space: 'world', includeSamples: true,
        arrivals: [{id: 'delivery', at: 1, target: [pad.x, pad.y], tolerance: TOLERANCE}],
      });
      const arrival = report.checks[0];
      const inkSoft = paintColor(ctx.hue, 17, dark ? 58 : 52);
      const route = paintColor(ctx.hue, 50, dark ? 62 : 45);
      const blue = paintColor(207, 52, dark ? 72 : 48);
      const parcel = paintColor(33, 67, dark ? 70 : 57);
      const padColor = arrival.status === 'pass'
        ? paintColor(160, 57, dark ? 72 : 38)
        : paintColor(10, 68, dark ? 73 : 45);

      for (const {point: [x, y]} of report.samples) disc(g, x, y, 1.9, route);
      g.fillStyle = inkSoft;
      g.fillRect(40, GROUND + 17, 445, 2);
      g.fillStyle = padColor;
      g.beginPath();
      g.roundRect(pad.x - 20, GROUND - 10, 40, 20, 4);
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(pad.x - 6, GROUND - 1);
      g.lineTo(pad.x + 6, GROUND - 1);
      g.moveTo(pad.x - 6, GROUND + 3);
      g.lineTo(pad.x + 6, GROUND + 3);
      g.stroke();
      g.strokeStyle = arrival.status === 'pass' ? inkSoft : padColor;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(END_X, GROUND + 9);
      g.lineTo(END_X, GROUND + 36);
      g.lineTo(pad.x, GROUND + 36);
      g.lineTo(pad.x, GROUND + 9);
      g.stroke();
      g.setLineDash([]);

      g.fillStyle = blue;
      g.beginPath();
      g.roundRect(END_X - 16, GROUND - 50, 32, 14, 6);
      g.fill();
      g.fillRect(END_X - 32, GROUND - 45, 64, 3);
      for (const x of [END_X - 30, END_X + 30]) {
        disc(g, x, GROUND - 44, 6, blue);
        g.fillStyle = ink;
        g.fillRect(x - 12, GROUND - 52, 24, 2);
      }
      g.fillStyle = parcel;
      g.fillRect(END_X - 9, GROUND - 32, 18, 16);
      g.fillStyle = ink;
      g.fillRect(END_X - 1, GROUND - 32, 2, 16);
      disc(g, END_X, GROUND, 3.5, route);
      const distance = arrival.error.value.toFixed(1);
      label(g, `${distance} units`, (pad.x + END_X) / 2, 218, padColor, 15);
      const verdict = arrival.status === 'pass' ? 'Special delivery.' : 'Return to sender.';
      return `${verdict} Arrival error is ${distance} units against a ${TOLERANCE}-unit tolerance.`;
    },
  });
}
