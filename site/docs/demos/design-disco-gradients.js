import {scene} from '../../runtime/src/core/index.js';
import {clipCircle, radialGradient} from '../../runtime/src/graphics/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, paintColor} from './design-stage.js';

export default function discoGradients(stage, ctx) {
  const center = {x: 260, y: 142};
  const light = {name: 'the disco ball’s highlight', x: 227, y: 114, minX: 175, maxX: 345, minY: 57, maxY: 227};
  const drawing = scene({width: 520, height: 280});
  const ball = drawing.group({...center, clip: clipCircle({r: 100})});
  const shine = ball.circle({r: 100, fill: paintColor(277, 45, 32)});
  for (let row = -5; row <= 5; row++) {
    for (let col = -5; col <= 5; col++) {
      ball.rect({ x: 19 * col, y: 19 * row, width: 16, height: 16, rx: 2,
        fill: paintColor(249 + ((row + col + 10) % 7) * 7, 86, 89, .09 + .045 * ((row - col + 10) % 5))});
    }
  }
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 280, handles: [light], draw(g, {dark, ink}) {
    shine.set({fill: radialGradient({x: light.x - center.x, y: light.y - center.y, r: 139, stops: [
      {offset: 0, color: paintColor(55, 95, 94)},
      {offset: .31, color: paintColor(303, 66, dark ? 65 : 64)},
      {offset: 1, color: paintColor(264, 54, dark ? 23 : 31)},
    ]})});
    renderer.render(drawing.sample());
    g.drawImage(renderer.element, 0, 0, 520, 280);
    disc(g, light.x, light.y, 10, ink);
    disc(g, light.x, light.y, 7, paintColor(55, 95, 94));
    return `Gradient center at local x ${Math.round(light.x - center.x)}, y ${Math.round(light.y - center.y)}.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
