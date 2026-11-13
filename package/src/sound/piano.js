import { assert, number, options } from '../core/validate.js';
import { frequencyOf, midiPitch } from './instruments.js';
import { allocate, fades, peakOf, result, rng, sampleRate, scalePeak } from './pcm.js';
import { envelopeAt, partialEnvelope, pianoProfile } from './piano-calibration.js';

const BODY_MODES = [
  [106, 0.22],
  [179, 0.16],
  [263, 0.22],
  [367, 0.14],
  [526, 0.15],
  [746, 0.11],
];
const MAX_MODAL_STEPS = 42_000_000;

function oscillator(frequency, amplitude, decay, rate) {
  const angle = (2 * Math.PI * frequency) / rate;
  const radius = Math.exp(-1 / (rate * decay));
  return {
    current: 0,
    previous: (-amplitude * Math.sin(angle)) / radius,
    step: 2 * radius * Math.cos(angle),
    squared: radius * radius,
  };
}

function advance(mode) {
  const current = mode.current;
  mode.current = mode.step * current - mode.squared * mode.previous;
  mode.previous = current;
  return current;
}

function stringModes(midi, base, settings, rate, profile) {
  const { contact, stiffness, unison, velocity, overrideStiffness } = settings;
  const strings = midi < 31 ? [0] : midi < 48 ? [-0.52, 0.63] : [-0.62, 0, 0.73];
  const modes = [],
    partialHz = [];
  const position = 0.125 - (midi - 60) * 0.0004;
  const tunedBase = profile ? base * profile[0][0] : base;
  for (let harmonic = 1; harmonic <= (profile?.length ?? 22); harmonic++) {
    const measured = profile?.[harmonic - 1];
    const frequency =
      measured && !overrideStiffness
        ? base * measured[0]
        : tunedBase * harmonic * Math.sqrt((1 + stiffness * harmonic ** 2) / (1 + stiffness));
    if (frequency >= rate * 0.43) break;
    partialHz.push(frequency);
    // The strike point limits the energy in partials with a node near the hammer.
    const strike = Math.sin(Math.PI * harmonic * position) / Math.sin(Math.PI * position);
    // A shorter felt contact transmits more of the upper spectrum.
    const contactFilter = 1 / Math.sqrt(1 + (frequency * contact * 0.78) ** 4);
    const nominalContact = (3.8 - 1.85 * 0.52 - 1.12 * velocity) / 1000;
    const amplitude = measured
      ? 0.72 * contactFilter * Math.sqrt(1 + (frequency * nominalContact * 0.78) ** 4) * (Math.sign(strike) || 1)
      : (strike * contactFilter) / harmonic ** 0.83;
    const envelope = measured ? partialEnvelope(measured.slice(1), rate) : null;
    const register = Math.max(0.43, 1.34 - (midi - 21) / 100);
    const slow = (2.65 * register) / (1 + 0.32 * harmonic ** 1.23);
    const fast = slow * (0.22 + 0.08 / harmonic);
    strings.forEach((offset, index) => {
      const tuned = frequency * 2 ** ((unison * offset) / 1200);
      const weight = index === 1 && strings.length === 3 ? 0.42 : strings.length === 3 ? 0.29 : 1 / strings.length;
      const delay = Math.round(index * 0.00009 * rate);
      const pan = offset * 0.36;
      modes.push({
        fast: oscillator(tuned, amplitude * weight * (envelope ? 1 : 0.68), envelope ? 100_000 : fast, rate),
        slow: envelope ? null : oscillator(tuned * (1 + 0.00012 * (index - 1)), amplitude * weight * 0.32, slow, rate),
        envelope,
        delay,
        pan,
      });
    });
  }
  return { modes, partialHz, stringCount: strings.length };
}

function soundboard(rate) {
  return BODY_MODES.map(([frequency, weight]) => {
    const mode = oscillator(frequency, 0, 0.09 + 0.18 * weight, rate);
    return { ...mode, drive: weight * (1 - mode.squared) * Math.sin((2 * Math.PI * frequency) / rate) };
  });
}

function radiation(board, force) {
  let sound = 0;
  for (const mode of board) {
    sound += advance(mode);
    mode.current += force * mode.drive;
  }
  return sound;
}

function pianoSettings(midi, spec) {
  options(
    spec,
    [
      'sampleRate',
      'velocity',
      'hold',
      'tail',
      'hardness',
      'stiffness',
      'unison',
      'pedal',
      'micWidth',
      'body',
      'seed',
      'calibration',
    ],
    'modeled piano note',
  );
  const rate = sampleRate(spec.sampleRate);
  assert(rate >= 16000 && rate <= 96000, 'AUDIO_RATE', 'Modeled piano sample rates range from 16000 to 96000 Hz.');
  const velocity = number(spec.velocity ?? 0.64, 'piano velocity', 0, 1);
  const hardness = number(spec.hardness ?? 0.52, 'hammer hardness', 0, 1);
  const hold = number(spec.hold ?? 1.15, 'piano hold', 0.04, 6);
  const tail = number(spec.tail ?? 1.55, 'piano tail', 0.08, 4);
  const pedal = spec.pedal ?? false;
  const calibration = spec.calibration ?? true;
  assert(typeof calibration === 'boolean', 'SOUND_PIANO', 'Piano calibration must be boolean.');
  assert(typeof pedal === 'boolean', 'SOUND_PIANO', 'Piano pedal must be boolean.');
  return {
    rate,
    velocity,
    hardness,
    hold,
    tail,
    pedal,
    calibration,
    overrideStiffness: spec.stiffness !== undefined,
    contact: (3.8 - 1.85 * hardness - 1.12 * velocity) / 1000,
    stiffness: number(spec.stiffness ?? 0.00022 * 2 ** (Math.abs(midi - 51) / 33), 'string stiffness', 0, 0.008),
    unison: number(spec.unison ?? 2.25, 'unison spread in cents', 0, 8),
    micWidth: number(spec.micWidth ?? 0.55, 'piano microphone width', 0, 1),
    body: number(spec.body ?? 0.58, 'piano soundboard amount', 0, 1),
  };
}

/** Render one note from hammer, stiff-string, soundboard, damper and microphone models. */
export function pianoNote(pitch, spec = {}) {
  const midi = midiPitch(pitch);
  assert(midi >= 21 && midi <= 108, 'SOUND_PIANO', 'Use a piano pitch from MIDI 21 through 108.');
  const settings = pianoSettings(midi, spec);
  const { rate, velocity, hardness, hold, tail, pedal, micWidth, contact, unison, stiffness, body } = settings;
  const count = Math.round((hold + tail) * rate),
    gate = Math.round(hold * rate);
  const fundamentalHz = frequencyOf(midi);
  const profile = settings.calibration ? pianoProfile(midi, velocity) : null;
  const { modes, partialHz, stringCount } = stringModes(midi, fundamentalHz, settings, rate, profile);
  assert(
    count * (2 * modes.length + BODY_MODES.length + 3) <= MAX_MODAL_STEPS,
    'RESOURCE_LIMIT',
    'Piano note exceeds the modal synthesis work budget.',
  );
  const board = soundboard(rate);
  const bodyMix = body * (profile ? 0.2 : 1);
  const sympathy = pedal
    ? [1.5, 2, 3]
        .map((ratio) => fundamentalHz * ratio)
        .filter((frequency) => frequency < rate * 0.43)
        .map((frequency, index) => oscillator(frequency, 0.018 / (index + 1), 2.3, rate))
    : [];
  const [left, right] = allocate(count);
  const delay = Math.round(rate * micWidth * 0.00053);
  const ring = new Float32Array(delay + 1);
  const random = rng(spec.seed ?? 1);
  const amp = 0.75 * velocity ** 1.38;
  let noiseMemory = 0,
    damper = 1;
  const damperStep = Math.exp(-1 / (rate * (0.105 + (108 - midi) * 0.00115)));
  for (let frame = 0; frame < count; frame++) {
    let bridge = 0,
      side = 0;
    for (const mode of modes) {
      if (frame < mode.delay) continue;
      const value = mode.envelope
        ? advance(mode.fast) * envelopeAt(mode.envelope, frame)
        : advance(mode.fast) + advance(mode.slow);
      bridge += value;
      side += value * mode.pan;
    }
    if (!pedal && frame >= gate) damper *= damperStep;
    const time = frame / rate;
    const randomSample = random() * 2 - 1;
    noiseMemory += 0.19 * (randomSample - noiseMemory);
    const action = noiseMemory * (0.024 + 0.042 * hardness) * Math.exp(-time / (0.009 + contact));
    const keyUp = !pedal && frame >= gate ? 0.013 * noiseMemory * Math.exp(-(frame - gate) / (0.012 * rate)) : 0;
    let ringing = 0;
    for (const mode of sympathy) ringing += advance(mode);
    ringing *= 1 - Math.exp(-time / 0.11);
    const force = bridge * damper * (1 - Math.exp(-time / (0.001 + contact * 0.23)));
    const mono = force + bodyMix * radiation(board, force + action * 0.5) + ringing + action + keyUp;
    const ringIndex = frame % ring.length;
    ring[ringIndex] = mono;
    const distant = ring[(ringIndex + 1) % ring.length];
    left[frame] = amp * (mono + micWidth * (0.16 * (distant - mono) - side * damper));
    right[frame] = amp * (mono + micWidth * (0.24 * (distant - mono) + side * damper));
  }
  const channels = fades([left, right], rate, 0.001, Math.min(0.12, tail / 2));
  if (peakOf(channels) > 0.94) scalePeak(channels, 0.94);
  return result(channels, rate, {
    source: 'modeled-piano',
    midi,
    fundamentalHz,
    tunedFundamentalHz: partialHz[0],
    calibration: profile ? 'salamander-v3' : 'none',
    partialHz,
    stringCount,
    unison,
    hammerContactMs: contact * 1000,
    micDelayMs: (delay * 1000) / rate,
    stiffness,
    pedal,
  });
}
