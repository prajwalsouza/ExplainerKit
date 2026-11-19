import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label} from './design-stage.js';

export function characterStudy(stage, ctx, drawing, {height, handles, draw}) {
  const renderer = createCanvasRenderer(stage.ownerDocument.createElement('div'), {pixelRatio: 1});
  function paint(g, time) {
    renderer.render(drawing.sample({time}));
    g.drawImage(renderer.element, 0, 0);
  }
  let stop;
  try {
    stop = dragStudy(stage, ctx, {height, handles, draw: (g, colors) => draw(g, colors, paint)});
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  return () => {
    stop();
    renderer.dispose();
  };
}

export function rail(g, marker, accent, ink, left, right) {
  g.fillStyle = accent;
  g.globalAlpha = .28;
  g.fillRect(marker.minX, marker.y - 1, marker.maxX - marker.minX, 2);
  g.globalAlpha = 1;
  disc(g, marker.x, marker.y, 13, accent);
  label(g, left, marker.minX, marker.y + 23, ink, 14);
  label(g, right, marker.maxX, marker.y + 23, ink, 14);
}
