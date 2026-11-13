import { createMusicScore, musicScoreTime } from '../../runtime/src/music/index.js';
import { labelAt, musicFigure, rule } from './music-figures.js';

const score = createMusicScore({
  ppq: 480,
  endTick: 3840,
  tempos: [
    { tick: 0, microsecondsPerQuarter: 750000 },
    { tick: 1920, microsecondsPerQuarter: 500000 },
  ],
});
const time = musicScoreTime(score);

export default function tempoExample(stage, ctx) {
  const figure = musicFigure(stage, ctx, 'Eight beats in ticks and seconds', 148, (drawing, width, palette) => {
    const left = 24,
      right = width - 24;
    const ticks = (beat) => left + (beat / 8) * (right - left);
    const seconds = (beat) => left + (time.secondsAt(beat * 480) / time.duration) * (right - left);
    labelAt(drawing, left, 23, 'Score position', palette.ink);
    labelAt(drawing, left, 79, 'Elapsed time', palette.ink);
    for (const [y, position] of [
      [46, ticks],
      [103, seconds],
    ]) {
      rule(drawing, left, y, right, y, palette.rule);
      for (let beat = 0; beat <= 8; beat++) {
        drawing.circle({
          x: position(beat),
          y,
          r: beat % 4 === 0 ? 4.3 : 2.8,
          fill: beat < 4 ? palette.soft : palette.accent,
        });
      }
    }
    labelAt(drawing, left, 131, '0 s', palette.soft);
    labelAt(drawing, seconds(4), 131, '3 s · Tempo rises', palette.accent, 'middle');
    labelAt(drawing, right, 131, '5 s', palette.soft, 'end');
  });
  figure.redraw();
  return figure.dispose;
}
