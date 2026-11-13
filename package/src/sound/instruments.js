import { assert, number, options } from '../core/validate.js';
import { allocate, result, sampleRate, rng, scalePeak, fades, dense, processSound, SAMPLE_BUDGET } from './pcm.js';

export const INSTRUMENT_KINDS = Object.freeze(['felt', 'mallet', 'pluck', 'bell', 'glass', 'pad']);
export function midiPitch(pitch) {
  if (typeof pitch === 'number') return number(pitch, 'MIDI pitch', 0, 127);
  assert(
    typeof pitch === 'string' && pitch.length <= 8,
    'SOUND_PITCH',
    'Use a MIDI number or scientific note such as C4.',
  );
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(pitch);
  assert(match, 'SOUND_PITCH', 'Use a scientific note such as C4, F#3 or Bb5.');
  const notes = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return number(
    (Number(match[3]) + 1) * 12 + notes[match[1].toUpperCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0),
    'MIDI pitch',
    0,
    127,
  );
}
export function frequencyOf(pitch) {
  return 440 * 2 ** ((midiPitch(pitch) - 69) / 12);
}
/** Damped/modal or feedback-string notes with velocity-dependent excitation and body. */
export function note(pitch, spec = {}) {
  options(spec, ['instrument', 'duration', 'sampleRate', 'velocity', 'seed', 'brightness', 'pan', 'reverb'], 'note');
  const instrument = spec.instrument ?? 'felt';
  assert(
    INSTRUMENT_KINDS.includes(instrument),
    'SOUND_INSTRUMENT',
    'Use a documented instrument or caller sample bank.',
  );
  const duration = number(spec.duration ?? 1.1, 'note duration', 0.03, 12),
    rate = sampleRate(spec.sampleRate),
    velocity = number(spec.velocity ?? 0.7, 'note velocity', 0, 1),
    brightness = number(spec.brightness ?? 0.5, 'note brightness', 0, 1),
    pan = number(spec.pan ?? 0, 'note pan', -1, 1),
    space = number(spec.reverb ?? 0.12, 'note reverb', 0, 0.6),
    midi = midiPitch(pitch),
    frequency = frequencyOf(midi);
  assert(
    frequency < rate * 0.43,
    'SOUND_PITCH',
    'Pitch must stay below the synthesis Nyquist guard; raise the sample rate or lower the note.',
  );
  const channels = allocate(Math.max(2, Math.round(duration * rate))),
    random = rng(spec.seed ?? 1);
  const ratios =
    instrument === 'bell'
      ? [1, 2.01, 2.76, 3.94, 5.4, 8.21]
      : instrument === 'glass'
        ? [1, 2.32, 4.25, 6.63, 9.4]
        : instrument === 'mallet'
          ? [1, 3.99, 9.01, 15.98]
          : Array.from({ length: 16 }, (_, i) => (i + 1) * Math.sqrt(1 + 0.00015 * i * i));
  const delay = Math.max(1, rate / frequency - 0.5),
    string = new Float32Array(Math.ceil(delay) + 2);
  for (let i = 0; i < string.length; i++) string[i] = (random() * 2 - 1) * (0.4 + 0.6 * velocity);
  let previous = 0;
  for (let i = 0; i < channels[0].length; i++) {
    const t = i / rate,
      attack = 1 - Math.exp(-t / (instrument === 'pad' ? 0.1 : 0.002)),
      release = Math.min(1, (duration - t) / Math.max(0.02, duration * 0.12));
    let value = 0;
    if (instrument === 'pluck') {
      const index = i % string.length,
        read = (index - delay + string.length) % string.length,
        base = Math.floor(read),
        fraction = read - base,
        current = string[base] * (1 - fraction) + string[(base + 1) % string.length] * fraction,
        filtered = (current + previous) * 0.5;
      string[index] = filtered * (0.992 + 0.006 * brightness);
      previous = current;
      value = current;
    } else
      for (let m = 0; m < ratios.length; m++) {
        const f = frequency * ratios[m];
        if (f > rate * 0.43) continue;
        const decay =
            instrument === 'pad'
              ? duration
              : (duration * (instrument === 'felt' ? 0.35 : 0.7)) / (1 + m * (instrument === 'felt' ? 0.45 : 0.18)),
          power = instrument === 'felt' ? 1.7 - brightness * 0.5 : 1.4 - brightness * 0.6;
        value +=
          Math.sin(2 * Math.PI * f * t + Math.sin(2 * Math.PI * 0.7 * t) * 0.002 * m) *
          (1 / (1 + m) ** power) *
          Math.exp(-t / decay) *
          (m ? 0.25 + 0.75 * velocity : 1);
      }
    value += (random() * 2 - 1) * Math.exp(-t / (instrument === 'felt' ? 0.012 : 0.004)) * 0.045 * velocity;
    value *= attack * release;
    channels[0][i] = value * Math.cos(((pan + 1) * Math.PI) / 4);
    channels[1][i] = value * Math.sin(((pan + 1) * Math.PI) / 4);
  }
  scalePeak(channels, 0.72 * velocity);
  fades(channels, rate, 0.002, 0.025);
  let output = result(channels, rate, {
    instrument,
    midi,
    source: 'original-physical-informed-dsp',
    quality: 'audition-required',
  });
  if (space) {
    output = processSound(output, [
      { type: 'reverb', seconds: Math.min(duration, 0.8), tail: 0, mix: space, seed: spec.seed ?? 1 },
    ]);
    fades(output.channels, rate, 0.002, 0.025);
  }
  return result(
    output.channels.map((c) => c.slice()),
    rate,
    { instrument, midi, source: 'original-physical-informed-dsp', quality: 'audition-required' },
  );
}
/** Captured note list mixed with gain headroom; note count is limited to 16. */
export function chord(pitches, spec = {}) {
  const list = dense(pitches, 'chord pitches', 16);
  assert(list.length > 0, 'SOUND_PITCH', 'A chord needs at least one pitch.');
  options(
    spec,
    ['instrument', 'duration', 'sampleRate', 'velocity', 'seed', 'brightness', 'pan', 'reverb', 'spread', 'strum'],
    'chord',
  );
  rng(spec.seed ?? 1);
  const spread = number(spec.spread ?? 0.5, 'chord stereo spread', 0, 1),
    strum = number(spec.strum ?? 0.012, 'chord strum', 0, 0.2),
    basePan = number(spec.pan ?? 0, 'chord pan', -1, 1);
  const workRate = sampleRate(spec.sampleRate),
    workDuration = number(spec.duration ?? 1.1, 'chord note duration', 0.03, 12);
  assert(
    Math.round(workRate * workDuration) * 2 * list.length <= SAMPLE_BUDGET,
    'RESOURCE_LIMIT',
    'Chord voice capture exceeds the combined PCM budget.',
  );
  const voices = list.map((pitch, index) =>
    note(pitch, {
      instrument: spec.instrument,
      duration: spec.duration,
      sampleRate: spec.sampleRate,
      velocity: spec.velocity,
      seed: `${spec.seed ?? 1}:${index}`,
      brightness: spec.brightness,
      pan: Math.max(-1, Math.min(1, basePan + (list.length === 1 ? 0 : (index / (list.length - 1)) * 2 - 1) * spread)),
      reverb: spec.reverb,
    }),
  );
  const rate = voices[0].sampleRate,
    channels = allocate(voices[0].channels[0].length + Math.round((voices.length - 1) * strum * rate));
  voices.forEach((voice, index) => {
    const offset = Math.round(index * strum * rate);
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < voice.channels[c].length; i++)
        channels[c][offset + i] += voice.channels[c][i] / Math.sqrt(voices.length);
  });
  if (peak(channels) > 0.9) scalePeak(channels, 0.9);
  return result(channels, rate, {
    source: 'original-chord',
    pitches: list.map(midiPitch),
    quality: 'audition-required',
  });
}
function peak(channels) {
  let value = 0;
  for (const c of channels) for (const x of c) value = Math.max(value, Math.abs(x));
  return value;
}
