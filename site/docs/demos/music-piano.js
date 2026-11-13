import { pianoNote, processSound } from '../../runtime/src/sound/index.js';
import { encodeWav } from '../../runtime/src/sound/mix.js';
import { labelAt, listen, musicFigure, rule } from './music-figures.js';
import { handoffEnd, hybridA4 } from './music-piano-hybrid.js';

const settings = [
  ['Calibrated', {}, 'A4 uses measured partial levels and three slightly detuned strings.'],
  ['Original model', { calibration: false }, 'The partial frequencies and decay use the original formulas.'],
  ['Softer hammer', { hardness: 0.15 }, 'The longer contact softens the higher partials.'],
  ['Harder hammer', { hardness: 0.9 }, 'The shorter contact makes the upper partials stronger.'],
  ['Wider unison', { unison: 6 }, 'The detuned strings interfere more quickly, creating audible beating.'],
  ['Pedal down', { pedal: true }, 'The strings continue ringing after the key is released.'],
  ['Wider microphones', { micWidth: 1 }, 'The longer cross-channel delay changes the stereo image.'],
];

function envelope(channel, frames, columns) {
  return Array.from({ length: columns }, (_, index) => {
    let low = 0,
      high = 0;
    for (let i = Math.floor((index * frames) / columns); i < Math.floor(((index + 1) * frames) / columns); i++) {
      low = Math.min(low, channel[i]);
      high = Math.max(high, channel[i]);
    }
    return [low, high];
  });
}

async function loadHybrid(calibrated) {
  const response = await fetch(new URL('./music-piano-reference.mp3', import.meta.url));
  if (!response.ok) throw new Error('The piano recording could not be loaded.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 256 * 1024) throw new Error('The piano recording is too large.');
  const { sampleRate } = calibrated;
  const decoder = new OfflineAudioContext(2, 1, sampleRate);
  const audio = await decoder.decodeAudioData(bytes);
  if (audio.numberOfChannels !== 2 || audio.duration < 2 || audio.duration > 3) {
    throw new Error('The piano recording has an unexpected format.');
  }
  const channels = [audio.getChannelData(0), audio.getChannelData(1)];
  return hybridA4({ channels, sampleRate }, calibrated.metadata.partialHz);
}

export default async function pianoExample(stage, ctx) {
  const calibrated = pianoNote('A4');
  const hybrid = await loadHybrid(calibrated).catch(() => null);
  const choices = hybrid
    ? [['Hybrid', null, 'Recorded strike, then a decay synthesized from the recording’s stereo partials.'], ...settings]
    : settings;
  let note = hybrid ?? calibrated;
  let url;
  let room = false;
  const figure = musicFigure(
    stage,
    ctx,
    'Strike and decay of the selected piano note',
    186,
    (drawing, width, palette) => {
      const left = 17,
        right = width - 17;
      const rows = [
        { y: 51, length: Math.round(0.035 * note.sampleRate), title: 'Hammer attack', duration: '35 ms' },
        {
          y: 136,
          length: note.channels[0].length,
          title: 'Note and release',
          duration: `${note.duration.toFixed(2)} s`,
        },
      ];
      for (const { y, length, title, duration } of rows) {
        const columns = width < 400 ? 88 : 138;
        const step = (right - left) / (columns - 1);
        rule(drawing, left, y, right, y, palette.rule);
        for (const [index, [low, high]] of envelope(note.channels[0], length, columns).entries()) {
          const x = left + index * step;
          rule(drawing, x, y - high * 36, x, y - low * 36, palette.accent);
        }
        labelAt(drawing, left, y - 28, title, palette.ink);
        labelAt(drawing, right, y - 28, duration, palette.soft, 'end');
      }
      const isHybrid = note === hybrid;
      const marker = left + ((isHybrid ? handoffEnd : 1.15) / note.duration) * (right - left);
      rule(drawing, marker, 148, marker, 161, palette.soft);
      labelAt(drawing, isHybrid ? left : marker, 175, isHybrid ? 'Synthesized from 240 ms' : 'Key release', palette.soft, isHybrid ? 'start' : 'middle');
    },
    `<label>Compare <select aria-label="Piano model setting">${choices.map(([name], index) => `<option value="${index}">${name}</option>`).join('')}</select></label>
    <label><input type="checkbox" aria-label="Add room to the comparison note"> Add room</label>
    <output aria-live="polite"></output>
    <div class="ek-music-auditions"><label><span data-comparison-name></span> <audio controls preload="metadata" aria-label="Comparison A4"></audio></label>
    <label>Recorded A4 <audio controls preload="metadata" aria-label="Recorded A4"></audio></label></div>`,
  );
  const [model, reference] = stage.querySelectorAll('audio');
  const output = stage.querySelector('output');
  const audition = (index) => {
    const [name, spec, description] = choices[index];
    note = spec === null ? hybrid : name === 'Calibrated' ? calibrated : pianoNote('A4', spec);
    const auditionPCM = room
      ? processSound(note, [
          { type: 'delay', time: 0.024, feedback: 0, mix: 0.08, tail: 0.024 },
          { type: 'reverb', seconds: 0.64, decay: 0.58, mix: 0.16, tail: 0.64 },
        ])
      : note;
    const wave = encodeWav({ channels: auditionPCM.channels, sampleRate: auditionPCM.sampleRate });
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([wave], { type: 'audio/wav' }));
    model.pause();
    model.src = url;
    stage.querySelector('[data-comparison-name]').textContent = `${name} A4`;
    output.textContent = spec === null ? description : `${description} Contact ${note.metadata.hammerContactMs.toFixed(2)} ms.${hybrid ? '' : ' Hybrid audition unavailable.'}`;
    figure.redraw();
  };
  stage.querySelector('input').addEventListener(
    'change',
    (event) => {
      room = event.target.checked;
      audition(Number(stage.querySelector('select').value));
    },
    { signal: figure.signal },
  );
  stage
    .querySelector('select')
    .addEventListener('change', (event) => audition(Number(event.target.value)), { signal: figure.signal });
  model.addEventListener('play', () => reference.pause(), { signal: figure.signal });
  reference.addEventListener('play', () => model.pause(), { signal: figure.signal });
  listen(reference, figure.signal)('piano-reference', false);
  audition(0);
  return () => {
    if (url) URL.revokeObjectURL(url);
    figure.dispose();
  };
}
