import { block, labelAt, listen, musicFigure, rule } from './music-figures.js';
import { BAR, makeGuidePhrase } from './score-cue.js';

export default function phraseExample(stage, ctx) {
  const phrase = makeGuidePhrase();
  let developed = true;
  const figure = musicFigure(
    stage,
    ctx,
    'Repeat and change a phrase',
    146,
    (drawing, width, palette) => {
      const left = 45,
        right = width - 18;
      const x = (tick) => left + (tick * (right - left)) / (2 * BAR);
      for (const [pitch, name, y] of [
        [69, 'A4', 52],
        [65, 'F4', 84],
        [62, 'D4', 116],
      ]) {
        labelAt(drawing, 14, y + 4, name, palette.soft);
        rule(drawing, left, y, right, y, palette.rule);
        const notes = (developed ? phrase.score : phrase.copied).tracks[0].notes;
        for (const note of notes) {
          if (note.pitch !== pitch) continue;
          const accent = developed && note.id === phrase.changedId;
          block(
            drawing,
            x(note.tick) + 3,
            y - 6,
            x(note.duration) - left - 6,
            12,
            accent ? palette.accent : palette.ink,
          );
        }
      }
      rule(drawing, x(BAR), 34, x(BAR), 130, palette.rule);
      labelAt(drawing, x(0) + 3, 23, 'Bar 1 · Source', palette.ink);
      labelAt(drawing, x(BAR) + 7, 23, 'Bar 2 · Repeat', palette.ink);
    },
    `<div role="group" aria-label="Phrase ending">
    <button type="button" aria-pressed="false">Copy ending</button>
    <button type="button" aria-pressed="true">Change ending</button>
  </div><audio controls preload="metadata" aria-label="Audition the phrase"></audio>
  <output aria-live="polite">The second bar ends on F4.</output>`,
  );
  const buttons = [...stage.querySelectorAll('button')];
  const audio = listen(stage.querySelector('audio'), figure.signal);
  const select = (index) => {
    developed = index === 1;
    buttons.forEach((button, choice) => button.setAttribute('aria-pressed', String(index === choice)));
    stage.querySelector('output').textContent = `The second bar ends on ${developed ? 'F4' : 'A4'}.`;
    audio(developed ? 'phrase-ending' : 'phrase-repeat', false);
    figure.redraw();
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => select(index), { signal: figure.signal }));
  select(1);
  return figure.dispose;
}
