import { block, labelAt, listen, musicFigure, rule } from './music-figures.js';
import { cues } from './music-cue-data.js';

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function cueExample(stage, ctx) {
  let cue = cues[0],
    position = 0;
  const figure = musicFigure(
    stage,
    ctx,
    'Level and sections of the selected documentary cue',
    178,
    (drawing, width, palette) => {
      const left = 16,
        right = width - 16,
        middle = 84,
        x = (seconds) => left + ((right - left) * seconds) / cue.duration;
      // Narrow figures draw every other reading so the bars keep a visible gap.
      const stride = width < 400 ? 2 : 1,
        step = ((right - left) * stride) / cue.peaks.length,
        played = (position / cue.duration) * cue.peaks.length;
      for (let i = 0; i < cue.peaks.length; i += stride) {
        const peak = Math.max(...cue.peaks.slice(i, i + stride));
        if (peak < 0.002) continue;
        const height = Math.max(1.5, Math.sqrt(peak) * 84);
        block(drawing, left + (i / stride) * step, middle - height / 2, Math.max(1, step * 0.7), height, i < played ? palette.accent : palette.soft);
      }
      cue.sections.forEach((section, index) => {
        const at = x(section.seconds),
          next = cue.sections[index + 1],
          room = x(next ? next.seconds : cue.duration) - at;
        rule(drawing, at, 132, at, 150, palette.rule);
        // A label is drawn only where the section is wide enough to hold it.
        if (room > section.name.length * 6.6 + 8) labelAt(drawing, at + 5, 148, section.name, palette.ink);
      });
      labelAt(drawing, left, 172, `${clock(position)} of ${clock(cue.duration)}`, palette.soft);
      labelAt(drawing, right, 172, `${cue.loudness.toFixed(1)} LUFS · ${cue.truePeak.toFixed(1)} dBTP · ${cue.tracks} tracks`, palette.soft, 'end');
    },
    `<label>Cue <select aria-label="Documentary cue">${cues.map(({ id, title }) => `<option value="${id}">${title}</option>`).join('')}</select></label>
    <audio controls preload="metadata" aria-label="Play the selected cue"></audio>
    <output aria-live="polite"></output>`,
  );
  const element = stage.querySelector('audio'),
    output = stage.querySelector('output'),
    audio = listen(element, figure.signal);
  const choose = (id) => {
    cue = cues.find((entry) => entry.id === id);
    position = 0;
    audio(`cue-${id}`, false);
    output.textContent = cue.description;
    figure.redraw();
  };
  element.addEventListener(
    'timeupdate',
    () => {
      // Redraw once per waveform bar, not on every media event.
      const next = element.currentTime;
      if (Math.abs(next - position) < cue.duration / cue.peaks.length) return;
      position = next;
      figure.redraw();
    },
    { signal: figure.signal },
  );
  stage.querySelector('select').addEventListener('change', (event) => choose(event.target.value), { signal: figure.signal });
  choose(cue.id);
  return figure.dispose;
}
