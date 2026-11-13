// @recipe music-grid
// @title Time visual changes to the beats and moments of a song
// @task Analyse decoded music, then pin actions to bars, beats and events such as the drop and pulse a shape on every beat.
// @uses explainerkit/core, explainerkit/music
// @keywords music, song, beat, bar, drop, build up, sync to music, pulse, rhythm, tempo, mp3
// @guide docs/modules/music-analysis.md
// @times 0.5, 3.6, 6.6
import {scene} from 'explainerkit/core';
import {musicGrid} from 'explainerkit/music';

// With a real song: `const analysis = analyzeMusic(decodedPCM)` (run it in a Web Worker).
// Here a grid is built from a known tempo so the example runs without audio.
const grid = musicGrid({tempo: 120, beatsPerBar: 4, start: 0.25, duration: 8});
const cues = grid.pin([
  {id: 'title', at: {bar: 0}},
  {id: 'chart', at: {bar: 1, beat: 2}},
  {id: 'finale', at: {bar: 3}, beats: -0.5},
]);

const drawing = scene({width: 640, height: 300, duration: 8, label: 'Shapes appear on the bar lines and a dot pulses on every beat'});
const beat = drawing.parameter(0, {min: 0, max: 8});
beat.animate({from: 0, to: 8, duration: 8, ease: 'linear'});
drawing.circle({x: 560, y: 150, fill: '#a74a2d'}).bind('r', {inputs: [beat], map: (t) => 14 + 16 * grid.pulse(t, {unit: 'beat', decay: 0.12})});
cues.forEach((cue, i) => {
  const box = drawing.rect({x: 60 + i * 140, y: 110, width: 110, height: 80, fill: '#34766b', opacity: 0});
  box.to(cue.time, {opacity: 1}, {duration: 0.2});
});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
