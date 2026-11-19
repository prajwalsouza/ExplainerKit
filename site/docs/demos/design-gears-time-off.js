import {scene} from '../../runtime/src/core/index.js';
import {stage as staging} from '../../runtime/src/layout/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 275;
const CLOCK_HEIGHT = 210;
const START = 62;
const END = WIDTH - 62;
const DURATION = 4;
const TAU = Math.PI * 2;

function gearOutline(radius, teeth) {
  const points = Array.from({length: teeth * 4}, (_, index) => {
    const angle = index * TAU / (teeth * 4);
    const distance = index % 4 < 2 ? radius : radius * .78;
    return [index === 0 ? 'M' : 'L', Math.cos(angle) * distance, Math.sin(angle) * distance];
  });
  return [...points, ['Z']];
}

function gear(drawing, x, y, radius, teeth, rotation) {
  const wheel = drawing.group({x, y});
  const outline = wheel.path({commands: gearOutline(radius, teeth)});
  const axle = wheel.circle({r: radius / 4});
  const index = wheel.circle({x: radius / 2, r: 3});
  wheel.animate('rotation', {from: 0, to: rotation, duration: DURATION, ease: 'linear'});
  return {wheel, outline, axle, index};
}

export default function gearsTimeOff(stage, ctx) {
  const drawing = scene({width: WIDTH, height: CLOCK_HEIGHT, duration: DURATION});
  const clock = drawing.circle({x: 260, y: 105, r: 87, strokeWidth: 2});
  const left = gear(drawing, 232, 119, 38, 12, TAU);
  const right = gear(drawing, 287, 95, 28, 9, -TAU * 4 / 3);
  const control = staging(drawing);
  control.explode([left.wheel, right.wheel], {at: .9, duration: .65, returnAt: 2.45});
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const knob = {name: 'the clock’s time knob', x: START, y: 240, minX: START, maxX: END, axis: 'x'};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [knob],
    draw(g, {width, height, ink}) {
      const time = DURATION * (knob.x - START) / (END - START);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      const metal = colour(ctx, 37, 33, 73);
      clock.set({stroke: metal, fill: colour(ctx, -23, 23, 85)});
      left.outline.set({fill: colour(ctx, 32, 65, 55)});
      right.outline.set({fill: colour(ctx, -121, 45, 53)});
      for (const {axle, index} of [left, right]) {
        axle.set({fill: ground(ctx)});
        index.set({fill: ink});
      }
      renderer.render(drawing.sample({time}));
      g.drawImage(renderer.element, 0, 0);
      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(START, knob.y);
      g.lineTo(END, knob.y);
      g.stroke();
      disc(g, knob.x, knob.y, 12, colour(ctx, 35, 48, 43));
      label(g, '0 s', START, 260, ink, 13);
      label(g, '4 s', END, 260, ink, 13);
      const clockTime = `${time.toFixed(1)} s.`;
      if (time < .9) return `${clockTime} Both gears are turning on the clock face.`;
      if (time < 1.55) return `${clockTime} Both gears move out of frame as they turn.`;
      if (time < 2.45) return `${clockTime} Both gears are offscreen. Their rotation tracks keep running.`;
      if (time < 3.1) return `${clockTime} Both gears are returning to the clock face.`;
      return `${clockTime} The gears have clocked back in at their current angles.`;
    },
  });
  return () => {
    stop();
    renderer.dispose();
    control.dispose();
  };
}
