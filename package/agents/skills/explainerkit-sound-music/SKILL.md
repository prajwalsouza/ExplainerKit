---
name: explainerkit-sound-music
description: "Use when adding sound effects tied to motion, generating notes and phrases, composing and producing a score with instruments, effects and a mastered mix, mixing audio, or analysing a song to time visuals to its beats, bars, drops and sections with the ExplainerKit JavaScript library. Covers explainerkit/sound, explainerkit/sound/mix, explainerkit/sound/studio, explainerkit/music, with tested recipes and the exact option vocabularies."
---

# Sound and music

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/sound`: Sound generation and explicit playback. Read `docs/modules/sound.md`, `docs/modules/sound-playback.md`.
  Exports: `INSTRUMENT_KINDS`, `SOUND_EFFECT_KINDS`, `analyzeSound`, `attachSoundtrack`, `chord`, `createSoundtrack`, `cueForMotion`, `musicPhrase`, `note`, `pianoNote`, `processSound`, `sampleInstrument`, `soundEffect`.
- `explainerkit/sound/mix`: PCM mixing and WAV encoding. Read `docs/modules/audio-mixing.md`.
  Exports: `createAudioMix`, `encodeWav`.
- `explainerkit/sound/studio`: Synthesizer, plucked, struck, percussion and sampled instruments, an effect rack with equalisers, dynamics, reverbs and delays, and loudness meters. Read `docs/modules/studio-instruments.md`, `docs/modules/studio-effects.md`.
  Exports: `EFFECT_TYPES`, `FILTER_TYPES`, `METER_BANDS`, `MODAL_PRESETS`, `PERCUSSION_KIT`, `PERCUSSION_SOUNDS`, `PLUCKED_PRESETS`, `REVERB_PRESETS`, `SATURATION_CURVES`, `STUDIO_LIMITS`, `SYNTH_PATCHES`, `biquadCoefficients`, `dbToGain`, `effectTail`, `filterResponse`, `gainToDb`, `layerInstruments`, `measureAudio`, `modalInstrument`, `noteSeconds`, `percussionInstrument`, `playInstrument`, `pluckedInstrument`, `processAudio`, `sampledInstrument`, `synthInstrument`.
- `explainerkit/music`: Score composition and variations, MIDI exchange, arrangement in bars and beats, produced mixes with buses, returns, loudness targets and stems, song analysis, beat grids, retargeting and adaptive scores. Read `docs/modules/music.md`, `docs/modules/music-production.md`, `docs/modules/music-analysis.md`.
  Exports: `CHORD_QUALITIES`, `CHORD_SHAPES`, `CHORD_VOCABULARIES`, `GRID_UNITS`, `MAX_MUSIC_SECONDS`, `MUSIC_ANALYSIS_VERSION`, `PITCH_NAMES`, `PRODUCTION_LIMITS`, `SCORE_INSTRUMENTS`, `SCORE_LIMITS`, `analyzeMusic`, `arpeggiate`, `arrangeMusic`, `beatsFromText`, `chordPitches`, `createAdaptiveScore`, `createMusicScore`, `editMusicNotes`, `musicGrid`, `musicScoreTime`, `produceMusic`, `readMidi`, `renderMusicEdits`, `renderMusicScore`, `repeatMusicPhrase`, `retargetMusic`, `voiceLead`, `writeMidi`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Give a move a sound that is timed to it

Generate a whoosh and impact tied to an animation and attach the soundtrack to the scene player.

```js
import {scene} from 'explainerkit/core';
import {createSoundtrack, cueForMotion, attachSoundtrack} from 'explainerkit/sound';

const move = {at: 0.5, duration: 0.8};
const drawing = scene({width: 640, height: 300, duration: 2.5, label: 'A dot lands with a thud'});
drawing.circle({x: 80, y: 150, r: 24, fill: '#34766b'}).to(move.at, {x: 560}, {duration: move.duration, ease: 'launch'});

const score = createSoundtrack([
  cueForMotion('whoosh', move, {options: {seed: 2}}),
  cueForMotion('impact', move, {options: {intensity: 0.5}}),
]);
export const player = await drawing.mount(document.querySelector('#stage'));
// Playback needs a user gesture in browsers: call `await sound.play()` from a click handler.
export const sound = attachSoundtrack(player, score.render({duration: 2.5}));
```

### Time visual changes to the beats and moments of a song

Analyse decoded music, then pin actions to bars, beats and events such as the drop and pulse a shape on every beat.

```js
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
```

### Compose a phrase and vary its ending

Repeat a short score, edit the last note, render stereo audio and show the result on a piano roll.

```js
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
```

### Arrange parts and produce a mastered mix

Write a pad, a harp figure and a drum in bars and beats, mix them through a shared hall to a loudness target and show the parts with the measured result.

```js
import { scene } from 'explainerkit/core';
import { hsla, toHex } from 'explainerkit/color';
import { arpeggiate, arrangeMusic, chordPitches, musicScoreTime, produceMusic, voiceLead } from 'explainerkit/music';
import { percussionInstrument, pluckedInstrument, synthInstrument, SYNTH_PATCHES } from 'explainerkit/sound/studio';

const chords = ['Dm', 'Bb', 'F', 'C'];
const voicings = voiceLead(chords, { voices: 3, low: 'D3', high: 'D5' });
const score = arrangeMusic({
  tempo: 96,
  bars: 4,
  parts: [
    { id: 'pad', notes: voicings.map((pitch, bar) => ({ bar, pitch, beats: 4, velocity: 70 })) },
    {
      id: 'harp',
      notes: chords.flatMap((chord, bar) =>
        arpeggiate(chordPitches(chord, { octave: 4 }), { pattern: 'updown', steps: 8, step: 0.5, accent: 14 }).map((note) => ({ bar, ...note })),
      ),
    },
    { id: 'drums', percussion: true, notes: [0, 1, 2, 3].map((bar) => ({ bar, pitch: 36, velocity: 96 })) },
  ],
});

// Tracks feed a bus or the master. Sends copy them to one shared hall, and the master sets the delivery level.
const mix = produceMusic(score, {
  sampleRate: 32000,
  tracks: [
    { id: 'pad', instrument: synthInstrument(SYNTH_PATCHES.warmPad), gain: -8, output: 'synths', sends: { hall: -9 } },
    { id: 'harp', instrument: pluckedInstrument({ preset: 'harp' }), gain: -6, pan: 0.25, sends: { hall: -8 } },
    { id: 'drums', instrument: percussionInstrument(), gain: -6 },
  ],
  buses: [{ id: 'synths', effects: [{ type: 'compressor', key: 'drums', threshold: -28, ratio: 3 }] }],
  returns: [{ id: 'hall', effects: [{ type: 'reverb', preset: 'hall', decay: 2.4, mix: 1 }] }],
  master: { loudness: -16, ceiling: -1 },
});
export const audio = { sampleRate: mix.sampleRate, channels: mix.channels };

const time = musicScoreTime(score);
const drawing = scene({ width: 480, height: 270, duration: mix.duration, label: 'Three parts of a produced cue with its loudness and true peak' });
const ink = toHex(hsla(215, 30, 24));
const hues = { pad: 262, harp: 28, drums: 166 };
drawing.text({ x: 24, y: 32, text: 'Three parts, one mastered mix', fontSize: 20, fill: ink });
const left = 78,
  width = 378,
  scale = width / mix.duration;
score.tracks.forEach((track, lane) => {
  const top = 56 + lane * 58;
  drawing.text({ x: 24, y: top + 28, text: track.id, fontSize: 14, fill: ink });
  const pitches = track.notes.map((note) => note.pitch);
  const low = Math.min(...pitches),
    span = Math.max(1, Math.max(...pitches) - low);
  for (const note of track.notes) {
    const start = time.secondsAt(note.tick),
      end = time.secondsAt(note.tick + note.duration);
    drawing.rect({
      x: left + start * scale,
      y: top + 38 - ((note.pitch - low) / span) * 34,
      width: Math.max(3, (end - start) * scale - 1),
      height: 6,
      rx: 2,
      fill: toHex(hsla(hues[track.id], 55, 42)),
    });
  }
});
drawing.text({
  x: 24,
  y: 252,
  text: `${mix.loudness.toFixed(1)} LUFS · ${mix.truePeak.toFixed(1)} dBTP · ${mix.duration.toFixed(1)} s with its reverb tail`,
  fontSize: 14,
  fill: ink,
});
const cursor = drawing.rect({ x: left, y: 52, width: 2, height: 178, fill: ink, opacity: 0.5 });
cursor.to(0, { x: left + width }, { duration: mix.duration, ease: 'linear' });
export const player = await drawing.mount(document.querySelector('#stage'));
```

## Vocabularies

- Named easings: linear, smooth, easeOut, easeInOut, launch, titleOpen, anticipateOut, linearStop, snapIn.
- Entrance styles: fade, rise, pop, cut, reveal.
- Text properties: text, fontSize, fontFamily, fontWeight, letterSpacing, align, baseline, wrap, lineHeight, minScreenSize, halo, textOutline, textAdvance.

The full lists, including every shape's properties, are in `agents/catalog.json` under `vocabularies`.

## Common mistakes

- For new VFX shots, prepare fitted camera poses with compileCameraTrack. Its standard level repairs isolated pose spikes by default. Choose strong for smaller spikes or none to inspect the original poses.
- Text alignment is the `align` property with the values start, middle and end. `textAnchor` is SVG vocabulary and is rejected.
- That easing name does not exist. Named easings are listed in vocabularies.easings, for example easeOut, easeInOut, smooth or linear, or pass a trusted progress function.
- Text `align` takes start, middle or end, not center, left or right.
- Path commands are absolute M, L, C, Q and Z only. Convert relative, smooth (S, T), arc (A) and horizontal or vertical (H, V) commands, or build paths with explainerkit/geometry.
- The `glow` property is an object, not a number. See docs/modules/graphics.md.
- A cloud takes `points: {positions: [x0, y0, x1, y1, …], radii?, colors?}`, not an array of {x, y} objects.
- A band scale exposes `bandwidth` and `step` as numbers, not methods. Write `x.bandwidth`.
- Create scenes with `scene({width, height})` from explainerkit/core. There is no global ExplainerKit object.
- You rarely need your own animation loop. Animate with `to`, parameters or timelines and let `scene.mount()` return a player that owns the clock, so seeking and export keep working.
- ExplainerKit has its own scales, timelines and effects. Check find_capability before adding another animation or charting library. Three.js is supplied to explainerkit/renderers/three, not imported by ExplainerKit.
- Drawing directly to SVG or Canvas bypasses the scene, so seeking, export and audits cannot see it. Add shapes to a scene and mount it, or use a renderer from explainerkit/renderers/svg or explainerkit/renderers/canvas.

## Check your work

Run the module and look at it before you report success. With the ExplainerKit MCP server, call `preview` with the code and the scene times to capture. Without it, run `node agents/cli.mjs preview path/to/module.js --times 0.5,2` from the ExplainerKit repository. Both return screenshots, console output and errors. Fix every error and check that the picture shows what the task asked for.
