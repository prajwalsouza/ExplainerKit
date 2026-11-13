import { labelAt, listen, musicFigure, rule } from './music-figures.js';
import { comparison, stringStudy } from './music-spectral-data.js';

const ticks = [
  [200, '200'],
  [500, '500'],
  [1000, '1k'],
  [2000, '2k'],
  [5000, '5k'],
];
const windows = [
  [0, 'Strike'],
  [2, 'Body'],
  [4, 'Late note'],
];

export default function spectrumExample(stage, ctx) {
  let source = 'piano',
    moment = 0;
  const figure = musicFigure(
    stage,
    ctx,
    'Short-time spectra of piano and strings',
    228,
    (drawing, width, palette) => {
      const left = 42,
        right = width - 17,
        top = 27,
        bottom = 167;
      const x = (hz) => left + (Math.log(hz / 140) / Math.log(9000 / 140)) * (right - left);
      const y = (db) => bottom - ((Math.max(-70, Math.min(20, db)) + 70) / 90) * (bottom - top);
      for (const db of [20, 0, -20, -40, -60]) {
        const position = y(db);
        labelAt(drawing, left - 7, position + 4, String(db), palette.soft, 'end');
        rule(drawing, left, position, right, position, palette.rule);
      }
      for (const [hz, label] of ticks) {
        rule(drawing, x(hz), top, x(hz), bottom, palette.rule);
        labelAt(drawing, x(hz), bottom + 19, label, palette.soft, 'middle');
      }
      labelAt(drawing, left, 16, 'Relative level · dB', palette.ink);
      labelAt(drawing, right, bottom + 19, 'Hz', palette.soft, 'end');
      const traces =
        source === 'piano'
          ? [
              ['Original', comparison.traces.before, palette.soft],
              ['Recorded', comparison.traces.recorded, palette.ink],
              ['Calibrated', comparison.traces.after, palette.accent],
            ]
          : stringStudy
              .filter(({ articulation }) => articulation === source)
              .map(({ family, trace }) => [
                family === 'cello' ? 'Cello' : 'Violin',
                trace,
                family === 'cello' ? palette.ink : palette.accent,
              ]);
      traces.forEach(([name, trace, fill], index) => {
        const points = trace[moment];
        drawing.path({
          commands: points.map((db, i) => [i ? 'L' : 'M', left + ((i + 0.5) / points.length) * (right - left), y(db)]),
          stroke: fill,
          strokeWidth: index ? 1.7 : 1.25,
          fill: 'none',
        });
        const start = left + (index * (right - left)) / traces.length;
        rule(drawing, start, 209, start + 13, 209, fill);
        labelAt(drawing, start + 17, 213, name, fill);
      });
    },
    `<label>Compare <select aria-label="Spectrum comparison">
    <option value="piano">Piano A4</option><option value="arco">Bowed strings at C4</option>
    <option value="pizz">Plucked strings at C4</option>
  </select></label><label>Window <select aria-label="Spectrum time window">
    ${windows.map(([index, title]) => `<option value="${index}">${title} · ${Math.round(comparison.times[index] * 1000)} ms</option>`).join('')}
  </select></label><output aria-live="polite"></output>
  <div class="ek-music-auditions" hidden>
    <label>Recorded cello <audio controls preload="metadata" aria-label="Recorded cello"></audio></label>
    <label>Recorded violin <audio controls preload="metadata" aria-label="Recorded violin"></audio></label>
  </div>`,
  );
  const controls = stage.querySelectorAll('select');
  const players = stage.querySelectorAll('audio');
  const setSource = [...players].map((player) => listen(player, figure.signal));
  players.forEach((player, index) =>
    player.addEventListener('play', () => players[1 - index].pause(), { signal: figure.signal }),
  );
  const draw = () => {
    stage.querySelector('output').textContent =
      source === 'piano'
        ? `A4 partial-level error fell from ${comparison.result.beforeDb.toFixed(1)} to ${comparison.result.afterDb.toFixed(1)} dB across the five windows.`
        : 'Each trace keeps its initial reference level as you move between windows.';
    figure.redraw();
  };
  controls[0].addEventListener(
    'change',
    (event) => {
      source = event.target.value;
      stage.querySelector('.ek-music-auditions').hidden = source === 'piano';
      players.forEach((player) => player.pause());
      if (source !== 'piano')
        ['cello', 'violin'].forEach((family, index) => setSource[index](`${family}-${source}-reference`, false));
      draw();
    },
    { signal: figure.signal },
  );
  controls[1].addEventListener(
    'change',
    (event) => {
      moment = Number(event.target.value);
      draw();
    },
    { signal: figure.signal },
  );
  draw();
  return figure.dispose;
}
