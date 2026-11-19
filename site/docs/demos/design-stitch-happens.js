import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 263;
const START = 72;
const END = WIDTH - 72;

export default function stitchHappens(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const patch = drawing.ellipse({x: 260, y: 103, rx: 124, ry: 69});
  const seam = drawing.ellipse({x: 260, y: 103, rx: 105, ry: 51, fill: 'none', strokeWidth: 5, strokeDasharray: [12, 8]});
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const bobbin = {name: 'the bobbin', x: START, y: 208, minX: START, maxX: END, axis: 'x'};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [bobbin],
    draw(g, {width, height, ink}) {
      const offset = 60 * (bobbin.x - START) / (END - START);
      patch.set({fill: colour(ctx, 21, 47, 51)});
      seam.set({stroke: ground(ctx), strokeDashoffset: offset});
      renderer.render(drawing.sample());
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.element, 0, 0);
      g.fillStyle = ink;
      g.fillRect(START, bobbin.y, END - START, 1);
      disc(g, bobbin.x, bobbin.y, 13, colour(ctx, 21, 47, 42));
      disc(g, bobbin.x, bobbin.y, 4, ground(ctx));
      label(g, 'Stitch offset', width / 2, 238, ink, 14);
      return `Dash offset ${offset.toFixed(1)} px. Each stitch is 12 px long and each gap is 8 px long.`;
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
