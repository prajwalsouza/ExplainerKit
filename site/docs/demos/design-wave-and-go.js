import {scene} from '../../runtime/src/core/index.js';
import {character, stick} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 269;
const END = 4;

export default async function waveAndGo(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: END});
  const figure = character(drawing, stick({ink: paintColor(208, 41, 43), line: 4.5}), {x: 80, y: 191, idle: false, size: .7});
  figure.keys([
    {at: 1.9, pose: {handF: [17,-157]}},
    {at: 2.25, pose: {handF: [34,-156]}},
    {at: 2.6, pose: 'rest'},
  ]);
  figure.follow([[0,80],[1.8,205],[2.45,205],[END,400]], {
    feet: 'auto', step: {threshold:17,duration:.19,lift:13},
  });
  const clock = {name: 'the stop clock', x: 158, y: 229, axis: 'x', minX: 72, maxX: 446};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [clock],
    draw(g, {dark, ink}, paint) {
      const time = END * (clock.x - clock.minX) / (clock.maxX - clock.minX);
      const waiting = time >= 1.8 && time <= 2.45;
      const brick = paintColor(ctx.hue, 19, dark ? 45 : 74);
      const sign = paintColor(41, 78, dark ? 73 : 47);
      const clockColor = paintColor(189, 56, dark ? 68 : 42);
      g.fillStyle = brick;
      g.fillRect(42, 192, 436, 3);
      g.fillRect(242, 101, 4, 92);
      disc(g, 244, 91, 15, sign);
      label(g, '✋', 244, 91, ink, 17);
      paint(g, time);
      rail(g, clock, clockColor, ink, 'Approach', 'Depart');
      label(g, '◷', clock.x, clock.y, paintColor(42, 58, 97), 18);
      return `${time.toFixed(2)} s. ${waiting ? 'The root track pauses at the stop. The pose keys keep the wave going.' : 'The root track advances along the route.'}`;
    },
  });
}
