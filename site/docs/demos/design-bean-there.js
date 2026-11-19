import {scene} from '../../runtime/src/core/index.js';
import {character, starter} from '../../runtime/src/characters/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function beanThere(stage, ctx) {
  const clock = {name: 'the bean scientist’s clock', x: 81, y: 244, axis: 'x', minX: 81, maxX: 439};
  const drawing = scene({width: 520, height: 231, duration: 5});
  const bean = character(drawing, starter('bean-scientist'), {x: 260, y: 201, height: 130, seed: 4, idle: false});
  bean.act('wave', {at: .25, duration: 1.25})
    .emote('thinking', {at: 1.5, duration: 1.25})
    .say('I have bean thinking.', {at: 2.8, rate: 14});
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 268, handles: [clock], draw(g, {dark, ink}) {
    const time = 5 * (clock.x - clock.minX) / (clock.maxX - clock.minX);
    renderer.render(drawing.sample({time}));
    g.drawImage(renderer.element, 0, 0, 520, 231);
    if (time >= 2.8 && time < 4.45) label(g, 'I have bean thinking.', 260, 32, ink, 23);
    g.fillStyle = paintColor(158, 25, dark ? 69 : 41, .4);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 12, ink);
    const action = time < .25 ? 'Ready' : time < 1.5 ? 'Wave' : time < 2.75 ? 'Think' : time < 2.8 ? 'Pause' : time < 4.45 ? 'Speak' : 'Settled';
    return `${time.toFixed(2)} s. ${action}.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
