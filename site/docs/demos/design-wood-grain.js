import {scene} from '../../runtime/src/core/index.js';
import {paint} from '../../runtime/src/graphics/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 270;
const START = 60;
const END = WIDTH - 60;

export default function woodGrain(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const board = drawing.rect({x: 52, y: 27, width: 416, height: 149, rx: 20, strokeWidth: 2});
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const brush = {name: 'the brush', x: START, y: 216, minX: START, maxX: END, axis: 'x'};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [brush],
    draw(g, {width, height, ink}) {
      const direction = Math.PI * (brush.x - START) / (END - START);
      const colors = [colour(ctx, 24 - ctx.hue, 51, 35), colour(ctx, 38 - ctx.hue, 54, 70)];
      board.set({fill: paint({kind: 'brush', colors, seed: 9, direction, frequency: 3, scale: 4}), stroke: colors[0]});
      renderer.render(drawing.sample());
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.element, 0, 0);
      g.fillStyle = ink;
      g.fillRect(START, brush.y, END - START, 1);
      g.fillStyle = colors[0];
      g.beginPath();
      g.roundRect(brush.x - 15, brush.y - 8, 17, 16, 2);
      g.roundRect(brush.x + 2, brush.y - 4, 16, 8, 3);
      g.fill();
      label(g, 'Brush direction', width / 2, 246, ink, 14);
      return `Brush direction ${Math.round(direction * 180 / Math.PI)}°. The paint seed and palette stay fixed.`;
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
