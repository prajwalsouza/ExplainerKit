import { block, labelAt, listen, musicFigure, rule } from './music-figures.js';
import { PARTS } from './score-cue.js';
import { waveforms } from './music-waveforms.js';

const lanes = [{ id: 'full', name: 'Full mix' }, ...PARTS];

export default function stemExample(stage, ctx) {
  let active = 'full';
  const figure = musicFigure(
    stage,
    ctx,
    'Hear the mix and aligned stems',
    198,
    (drawing, width, palette) => {
      const left = 119,
        right = width - 16;
      lanes.forEach(({ id, name }, index) => {
        const y = 23 + index * 36;
        const fill = id === active ? palette.accent : palette.soft;
        labelAt(drawing, 13, y + 4, name, id === active ? palette.accent : palette.ink);
        rule(drawing, left, y, right, y, palette.rule);
        const bins = waveforms[id],
          step = (right - left) / bins.length;
        bins.forEach((peak, i) => {
          if (peak < 0.001) return;
          const height = Math.sqrt(peak) * 36;
          block(drawing, left + i * step, y - height / 2, Math.max(1, step * 0.74), height, fill);
        });
      });
    },
    `<label>Listen to <select aria-label="Listen to a stem">${lanes.map(({ id, name }) => `<option value="${id}">${name}</option>`).join('')}</select></label>
    <audio controls preload="metadata" aria-label="Play Beneath the Surface"></audio>`,
  );
  const audio = listen(stage.querySelector('audio'), figure.signal);
  stage.querySelector('select').addEventListener(
    'change',
    (event) => {
      active = event.target.value;
      audio(active);
      figure.redraw();
    },
    { signal: figure.signal },
  );
  audio(active, false);
  figure.redraw();
  return figure.dispose;
}
