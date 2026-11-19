import {attachMedia} from '../../runtime/src/media/index.js';
import {encodeWav} from '../../runtime/src/sound/mix.js';
import {mountAudioReel, pulseTape} from './design-audio-reel.js';
import {paintColor} from './design-stage.js';

const duration = 3.5;

export default function snailTape(stage, ctx) {
  const mutedNote = ctx.still ? ' Reduced motion keeps the picture still during playback.' : '';
  return mountAudioReel(stage, ctx, {
    title: 'Snail Mail Express follows the audio tape', duration,
    note: `The snail visits each postmark on a tape beep.${mutedNote}`,
    build(drawing) {
      const shell = paintColor(24, 61, 55);
      const slime = paintColor(145, 37, 57);
      const detail = paintColor(29, 46, 22);
      drawing.line({x1: 60, x2: 467, y1: 161, y2: 161, stroke: slime, strokeWidth: 2});
      for (const x of [80, 170, 260, 350, 440]) drawing.circle({x, y: 161, r: 5, fill: slime});
      const snail = drawing.group({x: 80, y: 135});
      snail.to(0, {x: 440}, {duration: 3.2, ease: 'linear'});
      snail.ellipse({x: 0, y: 11, rx: 32, ry: 11, fill: slime});
      snail.circle({x: 22, y: -1, r: 13, fill: slime});
      snail.circle({x: -10, y: -12, r: 22, fill: shell});
      snail.circle({x: -10, y: -12, r: 13, fill: paintColor(31, 75, 70)});
      snail.circle({x: -9, y: -12, r: 6, fill: shell});
      snail.line({x1: 20, y1: -10, x2: 18, y2: -21, stroke: slime, strokeWidth: 2});
      snail.line({x1: 28, y1: -9, x2: 34, y2: -21, stroke: slime, strokeWidth: 2});
      snail.circle({x: 24, y: -4, r: 2, fill: detail});
      snail.circle({x: 29, y: -4, r: 2, fill: detail});
    },
    attach(player) {
      const pcm = pulseTape(duration, [0, .8, 1.6, 2.4, 3.2].map((time, index) => [time, 340 + index * 55, .16]));
      const media = document.createElement('audio');
      const url = URL.createObjectURL(new Blob([encodeWav(pcm)], {type: 'audio/wav'}));
      media.src = url;
      media.volume = .54;
      const release = () => { media.removeAttribute('src'); media.load(); URL.revokeObjectURL(url); };
      try { return {media, adapter: attachMedia(player, media, {reducedMotion: 'audio-only'}), release}; }
      catch (error) { release(); throw error; }
    },
  });
}
