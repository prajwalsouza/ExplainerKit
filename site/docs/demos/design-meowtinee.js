import {attachSoundtrack} from '../../runtime/src/sound/index.js';
import {mountAudioReel, pulseTape} from './design-audio-reel.js';
import {paintColor} from './design-stage.js';

const duration = 3.4;
const chirps = [[.32, 410, .32, -130], [1.25, 550, .27, -210], [2.3, 480, .55, -150]];

export default function meowtinee(stage, ctx) {
  const mutedNote = ctx.still ? ' Reduced motion keeps the picture still during playback.' : '';
  const pcm = pulseTape(duration, chirps);
  return mountAudioReel(stage, ctx, {
    title: 'Meowtinee, a cat lip-syncing to three synthesized chirps', duration,
    note: `Rewind and replay to hear the same three chirps from the rendered soundtrack.${mutedNote}`,
    build(drawing) {
      const fur = paintColor(31, 67, 63);
      const stripe = paintColor(24, 58, 49);
      const eye = paintColor(27, 26, 17);
      drawing.path({commands: [['M', 198, 91], ['L', 210, 29], ['L', 246, 66], ['L', 273, 66], ['L', 311, 29], ['L', 323, 91], ['Z']], fill: fur});
      drawing.ellipse({x: 260, y: 110, rx: 65, ry: 52, fill: fur});
      drawing.ellipse({x: 260, y: 130, rx: 36, ry: 23, fill: paintColor(43, 69, 85)});
      drawing.circle({x: 236, y: 104, r: 5, fill: eye});
      drawing.circle({x: 283, y: 104, r: 5, fill: eye});
      drawing.ellipse({x: 260, y: 119, rx: 6, ry: 3, fill: stripe});
      const mouth = drawing.ellipse({x: 260, y: 136, rx: 7, ry: 1.6, fill: eye});
      mouth.bind('scaleY', {map: ({time}) => {
        const cue = chirps.find(([at, , length]) => time >= at && time <= at + length);
        return cue ? 1 + 4.375 * Math.sin(Math.PI * (time - cue[0]) / cue[2]) : 1;
      }});
      for (const direction of [-1, 1]) {
        for (const y of [-8, 0, 8]) {
          drawing.line({x1: 260 + 28 * direction, x2: 260 + 76 * direction, y1: 129 + .45 * y, y2: 129 + y, stroke: stripe, strokeWidth: 1.5, strokeLinecap: 'round'});
        }
      }
    },
    attach(player) {
      const adapter = attachSoundtrack(player, pcm, {volume: .62});
      return {adapter, media: adapter.media};
    },
  });
}
