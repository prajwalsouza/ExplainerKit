import { assert, number, options } from '../../core/validate.js';
import { dbToGain, seeded } from './core.js';
import { defineInstrument, panGains } from './instrument.js';

/** Sounds a percussion kit can map to a MIDI pitch. */
export const PERCUSSION_SOUNDS = Object.freeze([
  'boom',
  'taiko',
  'frame',
  'sub',
  'rim',
  'tick',
  'shaker',
  'swell',
  'riser',
  'fall',
]);

/** The default kit. Each pitch plays one sound, with `tune` in semitones. */
export const PERCUSSION_KIT = Object.freeze({
  35: Object.freeze({ sound: 'sub' }),
  36: Object.freeze({ sound: 'boom' }),
  37: Object.freeze({ sound: 'rim' }),
  38: Object.freeze({ sound: 'frame' }),
  41: Object.freeze({ sound: 'taiko', tune: -5 }),
  43: Object.freeze({ sound: 'taiko', tune: -2 }),
  45: Object.freeze({ sound: 'taiko', tune: 2 }),
  47: Object.freeze({ sound: 'taiko', tune: 6 }),
  42: Object.freeze({ sound: 'tick' }),
  44: Object.freeze({ sound: 'shaker' }),
  49: Object.freeze({ sound: 'swell' }),
  52: Object.freeze({ sound: 'riser' }),
  53: Object.freeze({ sound: 'fall' }),
});

const TAILS = {
  boom: 3,
  taiko: 1.8,
  frame: 0.7,
  sub: 3.5,
  rim: 0.2,
  tick: 0.08,
  shaker: 0.2,
  swell: 4,
  riser: 0.4,
  fall: 0.3,
};
// Ratios of the first circular-membrane modes to the fundamental.
const MEMBRANE = [1, 1.593, 2.136, 2.296, 2.653, 2.918, 3.156];

function drum(voice, random, { hz, ring, bend, noise, noiseHz, modes, click }) {
  const { rate, velocity } = voice,
    frames = voice.frames;
  const out = new Float32Array(frames);
  const phases = new Float64Array(modes),
    noisePole = 1 - Math.exp((-2 * Math.PI * noiseHz) / rate);
  let filtered = 0;
  for (let i = 0; i < frames; i++) {
    const time = i / rate,
      // The head is tighter just after the strike, so the pitch starts high and settles.
      pitch = hz * (1 + bend * velocity * Math.exp(-time / 0.035));
    let sample = 0;
    for (let m = 0; m < modes; m++) {
      phases[m] += (pitch * MEMBRANE[m]) / rate;
      sample += (Math.sin(2 * Math.PI * phases[m]) * Math.exp((-time * (1 + m * 1.7)) / ring)) / (1 + m * 0.9);
    }
    filtered += noisePole * (random() * 2 - 1 - filtered);
    sample += filtered * noise * Math.exp(-time / (0.012 + 0.03 * velocity));
    if (i < click) sample += (random() * 2 - 1) * 0.35 * velocity * (1 - i / click);
    out[i] = Math.tanh(sample * (0.9 + velocity)) * 0.8;
  }
  return out;
}

function noiseBand(voice, random, shape) {
  const { rate } = voice,
    frames = voice.frames,
    out = new Float32Array(frames);
  let ic1 = 0,
    ic2 = 0;
  for (let i = 0; i < frames; i++) {
    const { hz, q, level } = shape(i / rate, i),
      g = Math.tan((Math.PI * Math.min(hz, rate * 0.45)) / rate),
      k = 1 / q,
      a1 = 1 / (1 + g * (g + k)),
      a2 = g * a1,
      v3 = random() * 2 - 1 - ic2,
      v1 = a1 * ic1 + a2 * v3,
      v2 = ic2 + a2 * ic1 + g * a2 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = v1 * level;
  }
  return out;
}

const SOUNDS = {
  boom: (voice, random, tune) =>
    drum(voice, random, { hz: 49 * tune, ring: 0.75, bend: 0.5, noise: 0.5, noiseHz: 700, modes: 5, click: 90 }),
  taiko: (voice, random, tune) =>
    drum(voice, random, { hz: 92 * tune, ring: 0.42, bend: 0.35, noise: 0.7, noiseHz: 1500, modes: 6, click: 140 }),
  frame: (voice, random, tune) =>
    drum(voice, random, { hz: 165 * tune, ring: 0.17, bend: 0.2, noise: 0.9, noiseHz: 3200, modes: 7, click: 160 }),
  sub: (voice, random, tune) => {
    const out = new Float32Array(voice.frames);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const time = i / voice.rate;
      phase += ((34 + 46 * Math.exp(-time / 0.09)) * tune) / voice.rate;
      out[i] = Math.tanh(Math.sin(2 * Math.PI * phase) * 1.6 * Math.exp(-time / 0.95)) * 0.8 * Math.min(1, i / 96);
    }
    return out;
  },
  rim: (voice, random, tune) => {
    const out = new Float32Array(voice.frames);
    for (let i = 0; i < out.length; i++) {
      const time = i / voice.rate;
      out[i] =
        (Math.sin(2 * Math.PI * 430 * tune * time) * 0.6 + Math.sin(2 * Math.PI * 1130 * tune * time) * 0.35) *
          Math.exp(-time / 0.022) +
        (i < 60 ? (random() * 2 - 1) * 0.5 * (1 - i / 60) : 0);
    }
    return out;
  },
  tick: (voice, random, tune) =>
    noiseBand(voice, random, (time) => ({ hz: 5200 * tune, q: 1.6, level: 1.1 * Math.exp(-time / 0.011) })),
  shaker: (voice, random, tune) =>
    noiseBand(voice, random, (time) => ({
      hz: 6800 * tune,
      q: 1.1,
      level: Math.min(1, time / 0.018) * Math.exp(-Math.max(0, time - 0.018) / 0.045),
    })),
  // A rolled cymbal or gong: the level and brightness grow until the gate closes, then ring out.
  swell: (voice, random, tune) => {
    const gate = voice.gate / voice.rate;
    const wash = noiseBand(voice, random, (time) => {
      const rise = Math.min(1, time / gate);
      return {
        hz: (900 + 4200 * rise ** 2) * tune,
        q: 0.6,
        level: time < gate ? 0.9 * rise ** 2.2 : 0.9 * Math.exp(-(time - gate) / 1.1),
      };
    });
    const partials = [1, 1.47, 1.83, 2.31, 2.89, 3.52, 4.3, 5.1].map((ratio) => [
      2 * Math.PI * 310 * tune * ratio * (1 + 0.01 * (random() - 0.5)),
      2 * Math.PI * random(),
    ]);
    for (let i = 0; i < wash.length; i++) {
      const time = i / voice.rate,
        rise = Math.min(1, time / gate),
        level = time < gate ? rise ** 2 : Math.exp(-(time - gate) / 1.4);
      let metal = 0;
      for (const [omega, phase] of partials) metal += Math.sin(omega * time + phase);
      wash[i] += metal * 0.035 * level;
    }
    return wash;
  },
  riser: (voice, random, tune) => {
    const gate = voice.gate / voice.rate;
    return noiseBand(voice, random, (time) => {
      const rise = Math.min(1, time / gate);
      return {
        hz: 260 * tune * 2 ** (5 * rise),
        q: 2.4,
        level: time < gate ? 0.4 * rise ** 1.6 : 0.4 * Math.exp(-(time - gate) / 0.05),
      };
    });
  },
  fall: (voice, random, tune) => {
    const gate = voice.gate / voice.rate;
    return noiseBand(voice, random, (time) => {
      const progress = Math.min(1, time / gate);
      return {
        hz: 7000 * tune * 2 ** (-5 * progress),
        q: 2,
        level: 0.45 * (1 - progress) ** 1.3 * Math.min(1, time / 0.01),
      };
    });
  },
};

/** A kit of synthesized drums, hits and noise gestures. Pitches not in the map are silent. */
export function percussionInstrument(settings = {}) {
  options(settings, ['name', 'kit', 'gain', 'width'], 'percussion instrument');
  const map = settings.kit ?? PERCUSSION_KIT;
  options(map, Object.keys(map), 'percussion kit');
  const kit = new Map();
  for (const [key, value] of Object.entries(map)) {
    const pitch = Number(key);
    assert(Number.isInteger(pitch) && pitch >= 0 && pitch <= 127, 'SOUND_INSTRUMENT', 'Kit keys are MIDI pitches.');
    options(value, ['sound', 'tune', 'gain', 'pan'], 'kit entry');
    assert(PERCUSSION_SOUNDS.includes(value.sound), 'SOUND_INSTRUMENT', 'Use a sound from PERCUSSION_SOUNDS.');
    kit.set(pitch, {
      sound: value.sound,
      tune: 2 ** (number(value.tune ?? 0, 'kit tuning in semitones', -24, 24) / 12),
      gain: dbToGain(number(value.gain ?? 0, 'kit gain in dB', -48, 24)),
      pan: number(value.pan ?? 0, 'kit pan', -1, 1),
    });
  }
  assert(kit.size >= 1 && kit.size <= 128, 'SOUND_INSTRUMENT', 'A kit maps 1–128 pitches.');
  const level = dbToGain(number(settings.gain ?? 0, 'instrument gain in dB', -48, 24));
  return defineInstrument(
    { kind: 'percussion', name: settings.name ?? 'percussion', release: 4, cost: 24 },
    (voice) => {
      const entry = kit.get(Math.round(voice.pitch));
      if (!entry) return;
      const { left, right, rate, start, velocity } = voice;
      const sustained = entry.sound === 'swell' || entry.sound === 'riser' || entry.sound === 'fall';
      const frames = Math.min(left.length - start, (sustained ? voice.gate : 0) + Math.ceil(TAILS[entry.sound] * rate));
      if (frames <= 0) return;
      const random = seeded(`${entry.sound}:${voice.seed}:${start}`);
      const mono = SOUNDS[entry.sound]({ rate, velocity, gate: voice.gate, frames }, random, entry.tune);
      const [panL, panR] = panGains(Math.max(-1, Math.min(1, voice.pan + entry.pan)));
      const amplitude = voice.gain * level * entry.gain * (0.08 + 0.92 * velocity ** 1.7);
      const fadeFrames = Math.min(frames, Math.round(0.03 * rate));
      for (let i = 0; i < frames; i++) {
        const end = frames - i,
          value = mono[i] * amplitude * (end < fadeFrames ? end / fadeFrames : 1);
        left[start + i] += value * panL * Math.SQRT2;
        right[start + i] += value * panR * Math.SQRT2;
      }
    },
  );
}
