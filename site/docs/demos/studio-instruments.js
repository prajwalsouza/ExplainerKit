import {
  SYNTH_PATCHES,
  measureAudio,
  modalInstrument,
  percussionInstrument,
  pluckedInstrument,
  synthInstrument,
} from '../../runtime/src/sound/studio/index.js';
import { labelAt, musicFigure, rule } from './music-figures.js';
import { drawWave, normalized, phrase, player } from './studio-audition.js';

// A rising figure in D major, then a held chord: [start, pitch, duration, velocity].
const melody = [
  [0, 'D4', 0.45, 0.7],
  [0.5, 'F#4', 0.45, 0.62],
  [1, 'A4', 0.45, 0.7],
  [1.5, 'D5', 0.9, 0.82],
  [2.5, 'D3', 1.6, 0.6],
  [2.5, 'A3', 1.6, 0.55],
  [2.5, 'F#4', 1.6, 0.6],
];
const chords = [
  [0, 'D3', 2.2, 0.7],
  [0, 'A3', 2.2, 0.65],
  [0, 'F#4', 2.2, 0.7],
  [2.2, 'B2', 2, 0.7],
  [2.2, 'F#3', 2, 0.65],
  [2.2, 'D4', 2, 0.72],
];
const bass = [
  [0, 'D2', 0.9, 0.8],
  [1, 'D2', 0.4, 0.6],
  [1.5, 'A1', 0.9, 0.8],
  [2.5, 'B1', 1.4, 0.85],
];
const drums = [
  [0, 36, 0.3, 0.9],
  [0.5, 42, 0.1, 0.5],
  [0.75, 41, 0.3, 0.6],
  [1, 43, 0.3, 0.75],
  [1.5, 38, 0.3, 0.7],
  [1.75, 44, 0.1, 0.5],
  [2, 45, 0.3, 0.8],
  [2.25, 47, 0.3, 0.85],
  [2.5, 35, 0.5, 0.9],
  [2.5, 49, 1.2, 0.7],
];

const choices = [
  ['Harp', () => pluckedInstrument({ preset: 'harp' }), melody, 'A plucked string from a filtered delay loop.'],
  ['Celesta', () => modalInstrument({ preset: 'celesta' }), melody, 'Struck bars built from five decaying partials.'],
  ['Marimba', () => modalInstrument({ preset: 'marimba' }), melody, 'A short wooden bar with a soft mallet.'],
  ['Glass bell', () => synthInstrument(SYNTH_PATCHES.bell), melody, 'Frequency modulation gives the strike its metallic partials.'],
  ['Electric piano', () => synthInstrument(SYNTH_PATCHES.electricPiano), melody, 'A sine carrier with a decaying modulator.'],
  ['Warm pad', () => synthInstrument(SYNTH_PATCHES.warmPad), chords, 'Seven detuned saw waves behind a slowly opening filter.'],
  ['Choir', () => synthInstrument(SYNTH_PATCHES.choir), chords, 'Saw and pulse waves shaped by three vowel resonances.'],
  ['Synth strings', () => synthInstrument(SYNTH_PATCHES.synthStrings), chords, 'A detuned section with delayed vibrato.'],
  ['Deep bass', () => synthInstrument(SYNTH_PATCHES.deepBass), bass, 'Saw and square waves with a filter that closes after each attack.'],
  ['Percussion kit', () => percussionInstrument(), drums, 'Membrane drums, a rim, ticks, a shaker and a cymbal swell.'],
];

export default function instrumentExample(stage, ctx) {
  let pcm = null,
    meters = null;
  const figure = musicFigure(
    stage,
    ctx,
    'Waveform of the selected instrument playing a short phrase',
    150,
    (drawing, width, palette) => {
      if (!pcm) return;
      const left = 16,
        right = width - 16;
      rule(drawing, left, 78, right, 78, palette.rule);
      drawWave(drawing, pcm.channels[0], { left, right, y: 78, height: 50, scale: 0.9, stroke: palette.accent, columns: width < 400 ? 150 : 300 });
      labelAt(drawing, left, 18, `${(pcm.channels[0].length / pcm.sampleRate).toFixed(1)} s phrase`, palette.ink);
      labelAt(drawing, right, 18, `${meters.integrated.toFixed(1)} LUFS`, palette.soft, 'end');
      labelAt(drawing, left, 142, 'Every phrase is scaled to the same peak.', palette.soft);
    },
    `<label>Instrument <select aria-label="Instrument to audition">${choices.map(([name], index) => `<option value="${index}">${name}</option>`).join('')}</select></label>
    <audio controls preload="metadata" aria-label="Play the selected instrument"></audio>
    <output aria-live="polite"></output>`,
  );
  const audio = player(stage.querySelector('audio')),
    output = stage.querySelector('output');
  const audition = (index) => {
    const [, make, notes, description] = choices[index];
    const instrument = make();
    const last = Math.max(...notes.map(([start, , duration]) => start + duration));
    pcm = normalized(phrase(instrument, notes, last + Math.min(3, instrument.release)));
    meters = measureAudio(pcm);
    audio.set(pcm);
    output.textContent = description;
    figure.redraw();
  };
  stage
    .querySelector('select')
    .addEventListener('change', (event) => audition(Number(event.target.value)), { signal: figure.signal });
  audition(0);
  return () => {
    audio.dispose();
    figure.dispose();
  };
}
