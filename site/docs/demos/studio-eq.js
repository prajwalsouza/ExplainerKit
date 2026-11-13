import { filterResponse } from '../../runtime/src/sound/studio/index.js';
import { labelAt, musicFigure, rule } from './music-figures.js';

const LOW = 20,
  HIGH = 20000,
  RANGE = 18;
const TYPES = [
  ['peak', 'Peak'],
  ['lowshelf', 'Low shelf'],
  ['highshelf', 'High shelf'],
  ['highpass', 'High-pass, 24 dB per octave'],
  ['lowpass', 'Low-pass, 24 dB per octave'],
];

export default function eqExample(stage, ctx) {
  const band = { type: 'peak', frequency: 1000, gain: 6, q: 1.2 };
  const figure = musicFigure(
    stage,
    ctx,
    'Frequency response of one equaliser band',
    210,
    (drawing, width, palette) => {
      const left = 44,
        right = width - 14,
        top = 16,
        bottom = 176;
      const x = (hz) => left + ((right - left) * Math.log(hz / LOW)) / Math.log(HIGH / LOW),
        y = (db) => top + ((bottom - top) * (RANGE - Math.max(-RANGE, Math.min(RANGE, db)))) / (2 * RANGE);
      for (const db of [12, 0, -12]) {
        rule(drawing, left, y(db), right, y(db), palette.rule);
        labelAt(drawing, left - 7, y(db) + 4, `${db > 0 ? '+' : ''}${db}`, palette.soft, 'end');
      }
      for (const [hz, label] of [[100, '100 Hz'], [1000, '1 kHz'], [10000, '10 kHz']]) {
        rule(drawing, x(hz), top, x(hz), bottom, palette.rule);
        labelAt(drawing, x(hz), bottom + 18, label, palette.soft, 'middle');
      }
      const steep = band.type === 'highpass' || band.type === 'lowpass';
      const bands = [steep ? { type: band.type, frequency: band.frequency, slope: 24 } : band];
      const count = width < 400 ? 110 : 220;
      const frequencies = Array.from({ length: count }, (_, i) => LOW * (HIGH / LOW) ** (i / (count - 1)));
      const levels = filterResponse(bands, frequencies);
      for (let i = 1; i < count; i++) {
        drawing.line({ x1: x(frequencies[i - 1]), y1: y(levels[i - 1]), x2: x(frequencies[i]), y2: y(levels[i]), stroke: palette.accent, strokeWidth: 2.5 });
      }
      drawing.circle({ x: x(band.frequency), y: y(filterResponse(bands, [band.frequency])[0]), r: 5, fill: palette.accent });
      labelAt(drawing, left - 7, top - 3, 'dB', palette.soft, 'end');
    },
    `<label>Band <select aria-label="Equaliser band type">${TYPES.map(([value, name]) => `<option value="${value}">${name}</option>`).join('')}</select></label>
    <label>Frequency <input type="range" min="0" max="1000" value="566" aria-label="Band frequency"></label>
    <label>Gain <input type="range" min="-15" max="15" step="0.5" value="6" aria-label="Band gain in decibels"></label>
    <output aria-live="polite"></output>`,
  );
  const [frequency, gain] = stage.querySelectorAll('input'),
    select = stage.querySelector('select'),
    output = stage.querySelector('output');
  const update = () => {
    band.type = select.value;
    band.frequency = Math.round(LOW * (HIGH / LOW) ** (Number(frequency.value) / 1000));
    band.gain = Number(gain.value);
    const steep = band.type === 'highpass' || band.type === 'lowpass';
    gain.disabled = steep;
    output.textContent = steep
      ? `{type: '${band.type}', frequency: ${band.frequency}, slope: 24}`
      : `{type: '${band.type}', frequency: ${band.frequency}, gain: ${band.gain}${band.type === 'peak' ? ', q: 1.2' : ''}}`;
    figure.redraw();
  };
  for (const control of [frequency, gain, select]) control.addEventListener('input', update, { signal: figure.signal });
  update();
  return figure.dispose;
}
