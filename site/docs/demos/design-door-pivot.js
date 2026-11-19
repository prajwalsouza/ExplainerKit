import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function doorPivot(stage, ctx) {
  const turn = {name: 'the door turn handle', x: 140, y: 243, axis: 'x', minX: 78, maxX: 443};
  const drawing = scene({width: 520, height: 220});
  const doors = [
    drawing.rect({x: 100, y: 77, width: 82, height: 95, rx: 7, pivot: 'center', fill: paintColor(17, 64, 61)}),
    drawing.rect({x: 337, y: 77, width: 82, height: 95, rx: 7, pivot: 'left', fill: paintColor(193, 54, 51)}),
  ];
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 266, handles: [turn], draw(g, {dark, ink}) {
    const angle = 1.4 * (turn.x - turn.minX) / (turn.maxX - turn.minX);
    for (const door of doors) door.set({rotation: angle});
    renderer.render(drawing.sample());
    g.drawImage(renderer.element, 0, 0, 520, 220);
    for (const [x, title] of [[141, 'Center pivot'], [337, 'Left pivot']]) {
      disc(g, x, 124.5, 5, ink);
      label(g, title, x, 34, ink, 18);
    }
    g.fillStyle = paintColor(19, 26, dark ? 64 : 43, .43);
    g.fillRect(turn.minX, turn.y - 2, turn.maxX - turn.minX, 4);
    disc(g, turn.x, turn.y, 12, ink);
    return `Both doors turned ${Math.round(angle * 180 / Math.PI)}°. The dots mark their fixed pivots.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
