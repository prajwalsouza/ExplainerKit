import {scene} from '../../runtime/src/core/index.js';
import {jiggle, lag} from '../../runtime/src/physics/index.js';
import {clamp, disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const END = 3.5;
const START_X = 106;
const TRAVEL = 274;
const driver = (time) => {
  const p = clamp((time - .4) / .8, 0, 1);
  return START_X + TRAVEL * p * p * (3 - 2 * p);
};

export default async function taxiBaggage(stage, ctx) {
  const drawing = scene({width: 520, height: 230, duration: END});
  const bag = lag(drawing, driver, {halfLife: .16, history: END, step: 1 / 100});
  const aerial = jiggle(drawing, driver, {frequency: 2.6, damping: .14, history: END, step: 1 / 100});
  const meter = {name: 'the taxi meter', x: 116, y: 194, axis: 'x', minX: 66, maxX: 454};
  return dragStudy(stage, ctx, {
    height: 230,
    handles: [meter],
    draw(g, {dark, ink}) {
      const time = END * (meter.x - meter.minX) / (meter.maxX - meter.minX);
      const context = {time};
      const x = driver(time);
      const caseX = x - 41 + .58 * (bag.sample(context) - x);
      const tipX = x + 10 + .54 * (aerial.sample(context) - x);
      const road = paintColor(ctx.hue, 15, dark ? 26 : 86);
      const yellow = paintColor(43, 87, dark ? 65 : 52);
      const caseColor = paintColor(17, 65, dark ? 65 : 44);
      const glass = paintColor(201, 38, dark ? 23 : 95);
      g.fillStyle = road;
      g.fillRect(27, 145, 466, 19);
      g.fillStyle = ink;
      g.globalAlpha = .35;
      for (let i = 47; i < 482; i += 37) g.fillRect(i, 156, 17, 2);
      g.globalAlpha = 1;

      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 24, 111);
      g.quadraticCurveTo(x - 27, 78, caseX + 9, 98);
      g.moveTo(x + 10, 99);
      g.quadraticCurveTo(x + 4, 72, tipX, 58);
      g.stroke();
      disc(g, tipX, 58, 4, caseColor);
      g.fillStyle = caseColor;
      g.beginPath();
      g.roundRect(caseX - 16, 92, 32, 24, 5);
      g.fill();
      g.fillStyle = yellow;
      g.fillRect(caseX - 5, 92, 3, 24);
      g.fillRect(caseX + 4, 92, 3, 24);

      polygon(g, [
        {x: x - 35, y: 114}, {x: x - 17, y: 98}, {x: x + 17, y: 98},
        {x: x + 34, y: 114}, {x: x + 49, y: 117}, {x: x + 51, y: 139},
        {x: x - 47, y: 139}, {x: x - 47, y: 119},
      ], yellow);
      polygon(g, [
        {x: x - 26, y: 115}, {x: x - 14, y: 103}, {x: x + 13, y: 103}, {x: x + 27, y: 115},
      ], glass);
      g.fillStyle = yellow;
      g.fillRect(x - 2, 102, 4, 14);
      for (const wheel of [x - 28, x + 30]) {
        disc(g, wheel, 139, 11, ink);
        disc(g, wheel, 139, 4, glass);
      }

      g.fillStyle = road;
      g.fillRect(meter.minX, meter.y - 2, meter.maxX - meter.minX, 4);
      disc(g, meter.x, meter.y, 15, yellow);
      label(g, '◷', meter.x, meter.y, paintColor(38, 46, 21), 20);
      label(g, '0 s', 55, 218, ink, 14);
      label(g, `${END} s`, 464, 218, ink, 14);
      return `${time.toFixed(2)} s. The suitcase lags behind. The antenna oscillates as it catches up.`;
    },
  });
}
