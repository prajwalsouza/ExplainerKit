import {scene} from '../../runtime/src/core/index.js';
import {character, profile, profileReaction} from '../../runtime/src/characters/index.js';
import {disc, paintColor, polygon} from './design-stage.js';
import {characterStudy} from './design-character-study.js';

const HEIGHT = 214;

export default async function megaphoneProfile(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT});
  const actor = character(drawing, profile({
    line: 3.2,
    ink: paintColor(220, 23, 35),
    skin: paintColor(26, 53, 75),
    shirt: paintColor(175, 57, 51),
  }), {x: 162, y: 178, height: 153, idle: false});
  const amount = drawing.parameter(0, {min: 0, max: 1});
  actor.drive([], () => ({'head.r': .22, 'body.r': .12}), {mode: 'set'});
  actor.drive([amount], (volume, pose) => profileReaction(pose, volume), {mode: 'set'});
  const rim = {name: 'the megaphone rim', x: 318, y: 96, axis: 'y', minY: 51, maxY: 118};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [rim],
    draw(g, {dark}, paint) {
      const volume = (rim.maxY - rim.y) / (rim.maxY - rim.minY);
      const shell = paintColor(ctx.hue, 62, dark ? 64 : 47);
      const edge = paintColor(196, 56, dark ? 71 : 38);
      const waves = paintColor(ctx.hue, 74, dark ? 69 : 49, .32 + .4 * volume);
      const floor = paintColor(ctx.hue, 16, dark ? 29 : 80);
      g.fillStyle = floor;
      g.fillRect(57, 180, 238, 2);
      if (amount.sample({time: 0}) !== volume) amount.set(volume);
      paint(g, 0);

      const mouthHeight = 24 + 2 * (rim.maxY - rim.y);
      polygon(g, [
        {x: rim.x, y: rim.y}, {x: 414, y: 105}, {x: 414, y: 132},
        {x: rim.x, y: rim.y + mouthHeight},
      ], shell);
      polygon(g, [{x: 379, y: 130}, {x: 394, y: 130}, {x: 387, y: 163}, {x: 375, y: 163}], edge);
      g.strokeStyle = edge;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(rim.x, rim.y);
      g.lineTo(rim.x, rim.y + mouthHeight);
      g.stroke();
      disc(g, rim.x, rim.y, 10, edge);
      g.strokeStyle = waves;
      g.lineWidth = 2;
      for (let i = 1; i <= Math.round(volume * 4); i++) {
        g.beginPath();
        g.arc(311, 118, 14 * i, Math.PI * .78, Math.PI * 1.22);
        g.stroke();
      }
      return `Imaginary volume ${Math.round(100 * volume)} percent. ${volume ? 'The hands move toward the tilted head’s ears.' : 'The actor returns to the resting pose.'}`;
    },
  });
}
