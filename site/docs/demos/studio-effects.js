import { measureAudio, pluckedInstrument, percussionInstrument, processAudio } from '../../runtime/src/sound/studio/index.js';
import { labelAt, musicFigure, rule } from './music-figures.js';
import { drawWave, phrase, player, RATE } from './studio-audition.js';

const TEMPO = 96;
const beat = 60 / TEMPO;
// A plucked figure over a slow drum, written in beats: [beat, pitch, beats, velocity].
const harpNotes = [
  [0, 'D3', 1, 0.75],
  [0.5, 'A3', 1, 0.6],
  [1, 'D4', 1, 0.7],
  [1.5, 'F#4', 1, 0.62],
  [2, 'A4', 1.5, 0.8],
  [3, 'F#4', 1, 0.6],
  [4, 'B2', 1, 0.75],
  [4.5, 'F#3', 1, 0.6],
  [5, 'B3', 1, 0.7],
  [5.5, 'D4', 1, 0.62],
  [6, 'F#4', 2, 0.8],
].map(([at, pitch, beats, velocity]) => [at * beat, pitch, beats * beat, velocity]);
const drumNotes = [
  [0, 36, 0.5, 0.95],
  [2, 41, 0.5, 0.7],
  [3, 43, 0.5, 0.6],
  [4, 36, 0.5, 0.95],
  [6, 45, 0.5, 0.75],
  [7, 47, 0.5, 0.65],
].map(([at, pitch, beats, velocity]) => [at * beat, pitch, beats * beat, velocity]);

const chains = [
  ['Concert hall', [{ type: 'reverb', preset: 'hall', decay: 3.2, mix: 0.32 }], 'A feedback delay network adds early reflections and a three-second tail.'],
  ['Dotted-eighth delay', [{ type: 'delay', time: '1/8d', feedback: 0.45, mix: 0.3, pingPong: true }], 'Repeats land three sixteenth notes apart at 96 BPM and alternate sides.'],
  ['Compressor', [{ type: 'compressor', threshold: -26, ratio: 5, attack: 0.004, release: 0.18, makeup: 'auto' }], 'Peaks above the threshold are turned down, then the whole signal is raised.'],
  ['Tape saturation', [{ type: 'saturation', curve: 'tape', drive: 16 }], 'A soft curve adds harmonics and rounds the peaks at the same level.'],
  ['Low-pass sweep', [{ type: 'filter', mode: 'lowpass', resonance: 0.55, slope: 24, frequency: [{ time: 0, value: 260 }, { time: 4.5, value: 9000 }] }], 'The cutoff rises from 260 Hz to 9 kHz across the phrase.'],
  ['Shimmer', [{ type: 'shimmer', decay: 6, mix: 0.3 }], 'Copies raised by one and two octaves feed a long reverb.'],
  ['Chorus and width', [{ type: 'chorus', voices: 4, mix: 0.5 }, { type: 'width', width: 1.5 }], 'Slowly detuned copies thicken the sound and widen the stereo image.'],
  ['Mastering chain', [
    { type: 'eq', bands: [{ type: 'highpass', frequency: 35, slope: 24 }, { type: 'highshelf', frequency: 8000, gain: 2.5 }] },
    { type: 'compressor', threshold: -22, ratio: 2, knee: 10, attack: 0.03, release: 0.3, detector: 'rms' },
    { type: 'limiter', ceiling: -1, gain: 7 },
  ], 'An equaliser, a gentle compressor and a limiter with a ceiling of -1 dBTP.'],
];

export default function effectsExample(stage, ctx) {
  const harp = phrase(pluckedInstrument({ preset: 'nylon', gain: -1 }), harpNotes, 5.4),
    kit = phrase(percussionInstrument({ gain: -9 }), drumNotes, 5.4);
  const dry = { sampleRate: RATE, channels: harp.channels.map((channel, index) => channel.map((value, i) => value + kit.channels[index][i])) };
  const dryMeters = measureAudio(dry);
  let wet = dry,
    wetMeters = dryMeters;
  const figure = musicFigure(
    stage,
    ctx,
    'Waveforms of the phrase before and after the selected effect chain',
    206,
    (drawing, width, palette) => {
      const left = 16,
        right = width - 16,
        columns = width < 400 ? 150 : 300,
        seconds = wet.channels[0].length / RATE,
        dryRight = left + ((right - left) * dry.channels[0].length) / wet.channels[0].length;
      const rows = [
        ['Dry', dry, dryMeters, 60, dryRight, palette.soft],
        ['Processed', wet, wetMeters, 152, right, palette.accent],
      ];
      for (const [name, pcm, meters, y, end, stroke] of rows) {
        rule(drawing, left, y, right, y, palette.rule);
        drawWave(drawing, pcm.channels[0], { left, right: end, y, height: 36, scale: 1, stroke, columns: Math.round((columns * (end - left)) / (right - left)) });
        labelAt(drawing, left, y - 42, name, palette.ink);
        labelAt(drawing, right, y - 42, `${meters.integrated.toFixed(1)} LUFS · ${meters.truePeak.toFixed(1)} dBTP`, palette.soft, 'end');
      }
      labelAt(drawing, right, 200, `${seconds.toFixed(1)} s`, palette.soft, 'end');
      labelAt(drawing, left, 200, '0 s', palette.soft);
    },
    `<label>Effect chain <select aria-label="Effect chain to audition">${chains.map(([name], index) => `<option value="${index}">${name}</option>`).join('')}</select></label>
    <output aria-live="polite"></output>
    <div class="ek-music-auditions"><label>Dry <audio controls preload="metadata" aria-label="Play the dry phrase"></audio></label>
    <label>Processed <audio controls preload="metadata" aria-label="Play the processed phrase"></audio></label></div>`,
  );
  const [dryAudio, wetAudio] = stage.querySelectorAll('audio');
  const before = player(dryAudio),
    after = player(wetAudio),
    output = stage.querySelector('output');
  before.set(dry);
  const audition = (index) => {
    const [, chain, description] = chains[index];
    wet = processAudio(dry, chain, { tail: 'auto', tempo: TEMPO });
    wetMeters = measureAudio(wet);
    after.set(wet);
    const reduction = wet.reports.find((report) => report.maxReduction > 0);
    output.textContent = reduction ? `${description} Largest gain reduction ${reduction.maxReduction.toFixed(1)} dB.` : description;
    figure.redraw();
  };
  stage
    .querySelector('select')
    .addEventListener('change', (event) => audition(Number(event.target.value)), { signal: figure.signal });
  dryAudio.addEventListener('play', () => wetAudio.pause(), { signal: figure.signal });
  wetAudio.addEventListener('play', () => dryAudio.pause(), { signal: figure.signal });
  audition(0);
  return () => {
    before.dispose();
    after.dispose();
    figure.dispose();
  };
}
