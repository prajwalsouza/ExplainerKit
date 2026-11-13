import { readMidi, writeMidi } from '../../runtime/src/music/index.js';
import { block, labelAt, musicFigure, rule } from './music-figures.js';
import { makeGuidePhrase } from './score-cue.js';

export default function midiExample(stage, ctx) {
  const { score } = makeGuidePhrase();
  const bytes = writeMidi(score);
  const reopened = readMidi(bytes);
  const before = score.tracks[0].notes;
  const after = reopened.score.tracks[0].notes;
  const matching = before.filter((note, index) =>
    ['tick', 'pitch', 'duration', 'velocity'].every((key) => note[key] === after[index]?.[key]),
  ).length;
  const figure = musicFigure(
    stage,
    ctx,
    'Compare authored and reimported MIDI notes',
    118,
    (drawing, width, palette) => {
      const left = 99,
        right = width - 17;
      const x = (tick) => left + (tick / score.endTick) * (right - left);
      for (const [text, y, notes, fill] of [
        ['Authored', 38, before, palette.ink],
        ['Reopened', 81, after, palette.accent],
      ]) {
        labelAt(drawing, 14, y + 2, text, palette.soft);
        rule(drawing, left, y + 12, right, y + 12, palette.rule);
        for (const note of notes) {
          block(drawing, x(note.tick) + 2, y - 4 - (note.pitch - 62) * 1.6, x(note.duration) - left - 4, 9, fill);
        }
      }
    },
    `<button type="button">Download the MIDI</button>
    <output>${matching} of ${before.length} notes match · ${reopened.warnings.length} import notices</output>`,
  );
  let url;
  stage.querySelector('button').addEventListener(
    'click',
    () => {
      url ??= URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'music-guide-phrase.mid';
      link.click();
    },
    { signal: figure.signal },
  );
  figure.redraw();
  return () => {
    if (url) URL.revokeObjectURL(url);
    figure.dispose();
  };
}
