import {scene} from '../../runtime/src/core/index.js';
import {bean, character, speechFromRhubarb} from '../../runtime/src/characters/index.js';
import {label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const END = 1.6;
const HEIGHT = 266;
const CUES = {metadata: {duration: END}, mouthCues: [
  {start: 0, end: .26, value: 'A'},
  {start: .26, end: .61, value: 'D'},
  {start: .61, end: .91, value: 'B'},
  {start: 1.13, end: 1.48, value: 'F'},
]};

export default async function silentMouthCues(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: END});
  const actor = character(drawing, bean(), {x: 258, y: 203, height: 172, idle: false});
  const speech = speechFromRhubarb(CUES, {blend: 0});
  actor.lipSync(CUES, {blend: 0});
  const reel = {name: 'the silent film reel', x: 181, y: 224, axis: 'x', minX: 81, maxX: 439};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [reel],
    draw(g, {dark, ink}, paint) {
      const range = reel.maxX - reel.minX;
      const time = END * (reel.x - reel.minX) / range;
      const accent = paintColor(ctx.hue, 63, dark ? 71 : 42);
      CUES.mouthCues.forEach(({start,end,value}, index) => {
        const left = reel.minX + start / END * range;
        const width = (end - start) / END * range;
        g.fillStyle = paintColor((ctx.hue + index * 23) % 360, 49, dark ? 34 : 85);
        g.fillRect(left, 212, width, 24);
        label(g, value, left + width / 2, 202, ink, 13);
      });
      paint(g, time);
      rail(g, reel, accent, ink, 'Start', 'Wrap');
      label(g, '◉', reel.x, reel.y, paintColor(42, 48, 95), 15);
      const cue = CUES.mouthCues.find(({start,end}) => start <= time && time < end);
      const mouth = speech.sample(time);
      return cue ? `Cue ${cue.value} at ${time.toFixed(2)} s. Mouth opening ${mouth.open.toFixed(2)}.` : `${time.toFixed(2)} s. The mouth rests between cues.`;
    },
  });
}
