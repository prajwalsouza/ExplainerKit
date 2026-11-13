// @recipe score-variation
// @title Compose a phrase and vary its ending
// @task Repeat a short score, edit the last note, render stereo audio and show the result on a piano roll.
// @uses explainerkit/core, explainerkit/color, explainerkit/music
// @keywords compose, MIDI, score, piano roll, motif, notes, stereo, variation
// @guide docs/modules/music.md
// @times 0, 1.2, 2.2
import { scene } from 'explainerkit/core';
import { hsla, toHex } from 'explainerkit/color';
import { createMusicScore, editMusicNotes, musicScoreTime, renderMusicScore, repeatMusicPhrase } from 'explainerkit/music';

const first = createMusicScore({
  endTick: 960,
  tracks: [{ id: 'keys', notes: [
    { tick: 0, duration: 340, pitch: 62 },
    { tick: 480, duration: 340, pitch: 69 },
  ] }],
});
const copy = repeatMusicPhrase(first, { id: 'echo', start: 0, end: 960, at: 960 });
const ending = copy.tracks[0].notes.at(-1);
const score = editMusicNotes(copy, [{ id: ending.id, pitch: 65 }]);
const time = musicScoreTime(score);
export const audio = renderMusicScore(score);

const drawing = scene({ width: 480, height: 240, duration: 2, label: 'A two-note motif repeats with a new ending' });
const accent = toHex(hsla(25, 65, 42));
const original = toHex(hsla(166, 48, 31));
drawing.text({ x: 28, y: 35, text: 'Repeat a phrase and change its ending', fontSize: 21, fill: original });
for (const note of score.tracks[0].notes) {
  const start = time.secondsAt(note.tick);
  const duration = time.secondsAt(note.tick + note.duration) - start;
  drawing.rect({
    x: 34 + start * 200, y: 195 - (note.pitch - 60) * 12,
    width: 200 * duration, height: 14, fill: note.id === ending.id ? accent : original,
  });
}
const cursor = drawing.rect({ x: 34, y: 61, width: 2, height: 150, fill: original, opacity: 0.56 });
cursor.to(0, { x: 434 }, { duration: 2, ease: 'linear' });
export const player = await drawing.mount(document.querySelector('#stage'));
