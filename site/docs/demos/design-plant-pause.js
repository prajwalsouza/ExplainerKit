import {scene} from '../../runtime/src/core/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function plantPause(stage, ctx) {
  const clock = {name: 'the ambient clock', x: 80, y: 234, axis: 'x', minX: 80, maxX: 440};
  const film = scene({width: 520, height: 211, duration: 6});
  const ambient = film.ambient({rate: 1, offset: 0});
  const stem = film.group({x: 265, y: 150});
  stem.bind('rotation', {inputs: [ambient], map: seconds => .29 * Math.sin(seconds * Math.PI)});
  stem.line({x1: 0, y1: 5, x2: 0, y2: -76, stroke: paintColor(131, 46, 48), strokeWidth: 6});
  stem.circle({x: -11, y: -49, r: 14, fill: paintColor(107, 55, 56)});
  stem.circle({x: 11, y: -63, r: 14, fill: paintColor(97, 55, 61)});
  stem.circle({x: 0, y: -86, r: 18, fill: paintColor(31, 83, 66)});
  film.rect({x: 235, y: 149, width: 60, height: 42, rx: 7, fill: paintColor(17, 55, 58)});
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 261, handles: [clock], draw(g, {dark, ink}) {
    const seconds = 4 * (clock.x - clock.minX) / (clock.maxX - clock.minX);
    renderer.render(film.sample({time: 2, ambient: seconds}));
    g.drawImage(renderer.element, 0, 0, 520, 211);
    label(g, 'Story held at 2.00 s', 128, 47, ink, 17);
    g.fillStyle = paintColor(131, 34, dark ? 65 : 42, .4);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 12, ink);
    return `Story time 2.00 s. Ambient time ${seconds.toFixed(2)} s.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
