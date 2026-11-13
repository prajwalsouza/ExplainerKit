import { assert, number, options } from '../../core/validate.js';
import { dbToGain, midiToFrequency, seeded } from './core.js';
import { biquadCoefficients } from './filters.js';
import { defineInstrument, panGains } from './instrument.js';

/** Plucked-string starting points. `decay` is the ring time in seconds at middle C. */
export const PLUCKED_PRESETS = Object.freeze({
  harp: Object.freeze({ decay: 5.5, brightness: 0.52, pick: 0.32, body: [180, 410], release: 1.6, ring: true }),
  nylon: Object.freeze({ decay: 3.2, brightness: 0.45, pick: 0.2, body: [110, 220], release: 0.25, ring: false }),
  pizzicato: Object.freeze({ decay: 0.75, brightness: 0.3, pick: 0.14, body: [190, 290], release: 0.2, ring: true }),
  zither: Object.freeze({ decay: 4.5, brightness: 0.85, pick: 0.09, body: [260, 520], release: 1, ring: true }),
});

/**
 * Plucked string from a filtered delay loop. The loop length sets the pitch,
 * its filter sets how fast the upper partials fade, and the pick position
 * removes the partials that have a node where the string is plucked.
 */
export function pluckedInstrument(settings = {}) {
  options(
    settings,
    ['name', 'preset', 'decay', 'brightness', 'pick', 'body', 'release', 'ring', 'gain', 'keySpread'],
    'plucked instrument',
  );
  const presetName = settings.preset ?? 'harp';
  assert(Object.hasOwn(PLUCKED_PRESETS, presetName), 'SOUND_INSTRUMENT', 'Use a documented plucked preset.');
  const preset = PLUCKED_PRESETS[presetName];
  const decay = number(settings.decay ?? preset.decay, 'string decay', 0.05, 30),
    brightness = number(settings.brightness ?? preset.brightness, 'string brightness', 0, 1),
    pick = number(settings.pick ?? preset.pick, 'pick position', 0.02, 0.5),
    release = number(settings.release ?? preset.release, 'string release', 0.02, 10),
    ring = settings.ring ?? preset.ring,
    level = dbToGain(number(settings.gain ?? 0, 'instrument gain in dB', -48, 24)),
    keySpread = number(settings.keySpread ?? 0.35, 'key spread', 0, 1),
    body = settings.body ?? preset.body;
  assert(typeof ring === 'boolean', 'SOUND_INSTRUMENT', 'ring is boolean.');
  assert(Array.isArray(body) && body.length <= 4, 'SOUND_INSTRUMENT', 'Give at most four body resonances.');
  body.forEach((hz) => number(hz, 'body resonance', 40, 4000));
  const longest = ring ? decay * 2.2 : release;
  return defineInstrument(
    { kind: 'plucked', name: settings.name ?? presetName, release: Math.min(30, longest), cost: 10, range: [24, 108] },
    (voice) => {
      const { left, right, rate, start, gate, pitch, velocity } = voice;
      const frequency = midiToFrequency(pitch);
      if (frequency >= rate * 0.4) return;
      const ringTime = decay * (261.63 / frequency) ** 0.45,
        total = Math.min(
          left.length - start,
          ring ? Math.ceil(ringTime * 1.3 * rate) : gate + Math.ceil(release * rate),
        );
      if (total <= 0) return;
      const random = seeded(`pluck:${voice.seed}:${pitch}:${start}`);
      // The loop filter delays the wave by `blend` samples, so the delay line is shortened to match.
      const blend = 0.5 * (1 - brightness) * (0.35 + 0.65 * Math.min(1, frequency / 500)),
        period = rate / frequency - blend,
        whole = Math.floor(period - 0.1),
        fraction = period - whole,
        tune = (1 - fraction) / (1 + fraction);
      const line = new Float32Array(whole);
      // The excitation is noise shaped by how hard the string is plucked.
      const pole = 1 - Math.exp((-2 * Math.PI * (500 + 9000 * velocity ** 1.5 * (0.4 + 0.6 * brightness))) / rate);
      let smooth = 0,
        mean = 0;
      for (let i = 0; i < whole; i++) {
        smooth += pole * (random() * 2 - 1 - smooth);
        line[i] = smooth;
        mean += smooth;
      }
      mean /= whole;
      const offset = Math.max(1, Math.round(pick * whole)),
        shaped = new Float32Array(whole);
      let peak = 1e-9;
      for (let i = 0; i < whole; i++) {
        shaped[i] = line[i] - mean - (line[(i + whole - offset) % whole] - mean);
        peak = Math.max(peak, Math.abs(shaped[i]));
      }
      for (let i = 0; i < whole; i++) line[i] = shaped[i] / peak;
      const sustainLoss = 10 ** (-3 / (frequency * ringTime)),
        dampLoss = 10 ** (-3 / (frequency * release));
      const sections = body.map((hz) => ({ c: biquadCoefficients('peak', hz, rate, 3, 5), s1: 0, s2: 0 }));
      const position = Math.max(-1, Math.min(1, voice.pan + ((pitch - 60) / 36) * keySpread)),
        [panL, panR] = panGains(position);
      const amplitude = voice.gain * level * (0.25 + 0.75 * velocity ** 1.4) * 0.5;
      let cursor = 0,
        previous = 0,
        allpassIn = 0,
        allpassOut = 0;
      const fadeFrames = Math.min(total, Math.round(0.02 * rate));
      for (let i = 0; i < total; i++) {
        const current = line[cursor],
          loss = !ring && i >= gate ? dampLoss : sustainLoss,
          filtered = loss * ((1 - blend) * current + blend * previous);
        previous = current;
        const tuned = tune * (filtered - allpassOut) + allpassIn;
        allpassIn = filtered;
        allpassOut = tuned;
        line[cursor] = tuned;
        if (++cursor === whole) cursor = 0;
        let out = current;
        for (const section of sections) {
          const y = section.c[0] * out + section.s1;
          section.s1 = section.c[1] * out - section.c[3] * y + section.s2;
          section.s2 = section.c[2] * out - section.c[4] * y;
          out = y;
        }
        const end = total - i;
        if (end < fadeFrames) out *= end / fadeFrames;
        if (i < 24) out *= (i + 1) / 25;
        left[start + i] += out * amplitude * panL * Math.SQRT2;
        right[start + i] += out * amplitude * panR * Math.SQRT2;
      }
    },
  );
}

/**
 * Struck bars, bells and bowls. Each entry lists partials as
 * `[frequency ratio, level, decay scale]`. `decay` is the ring time at middle C.
 */
export const MODAL_PRESETS = Object.freeze({
  celesta: Object.freeze({
    decay: 2.6,
    modes: [
      [1, 1, 1],
      [2.01, 0.22, 0.6],
      [3.99, 0.3, 0.4],
      [6.3, 0.1, 0.22],
      [10.1, 0.05, 0.12],
    ],
    strike: 0.25,
    ring: true,
  }),
  glockenspiel: Object.freeze({
    decay: 3.4,
    modes: [
      [1, 1, 1],
      [2.756, 0.42, 0.55],
      [5.404, 0.2, 0.3],
      [8.933, 0.09, 0.16],
    ],
    strike: 0.4,
    ring: true,
  }),
  vibraphone: Object.freeze({
    decay: 6,
    modes: [
      [1, 1, 1],
      [4, 0.26, 0.35],
      [10, 0.07, 0.12],
    ],
    strike: 0.12,
    ring: false,
    tremolo: [4.6, 0.22],
  }),
  marimba: Object.freeze({
    decay: 1.1,
    modes: [
      [1, 1, 1],
      [3.94, 0.3, 0.25],
      [9.2, 0.08, 0.1],
    ],
    strike: 0.3,
    ring: true,
  }),
  kalimba: Object.freeze({
    decay: 2.2,
    modes: [
      [1, 1, 1],
      [5.9, 0.16, 0.12],
      [14.6, 0.04, 0.05],
    ],
    strike: 0.5,
    ring: true,
  }),
  musicBox: Object.freeze({
    decay: 3,
    modes: [
      [1, 1, 1],
      [6.27, 0.12, 0.3],
      [17.5, 0.05, 0.12],
    ],
    strike: 0.6,
    ring: true,
  }),
  tubularBell: Object.freeze({
    decay: 9,
    // A tube's partials follow the squares of odd numbers. The fourth to sixth
    // lie near 2, 3 and 4 times the note, and the ear supplies the missing fundamental.
    modes: [
      [0.617, 0.3, 1.2],
      [1.21, 0.6, 1.1],
      [2, 1, 1],
      [2.99, 0.8, 0.8],
      [4.17, 0.55, 0.6],
      [5.56, 0.3, 0.42],
      [7.14, 0.15, 0.3],
    ],
    strike: 0.2,
    ring: true,
  }),
  bowl: Object.freeze({
    decay: 14,
    modes: [
      [1, 1, 1],
      [1.004, 0.8, 1],
      [2.71, 0.5, 0.6],
      [2.722, 0.4, 0.6],
      [5.12, 0.22, 0.35],
      [8.1, 0.08, 0.2],
    ],
    strike: 0.05,
    ring: true,
    gain: -4,
  }),
});

/** A tuned percussion instrument made from decaying partials, each a two-pole resonator. */
export function modalInstrument(settings = {}) {
  options(
    settings,
    ['name', 'preset', 'modes', 'decay', 'strike', 'ring', 'release', 'hardness', 'gain', 'tremolo', 'width'],
    'modal instrument',
  );
  const presetName = settings.preset ?? 'celesta';
  assert(Object.hasOwn(MODAL_PRESETS, presetName), 'SOUND_INSTRUMENT', 'Use a documented modal preset.');
  const preset = MODAL_PRESETS[presetName];
  const modes = settings.modes ?? preset.modes;
  assert(Array.isArray(modes) && modes.length >= 1 && modes.length <= 24, 'SOUND_INSTRUMENT', 'Give 1–24 modes.');
  const table = modes.map((mode) => {
    assert(Array.isArray(mode) && mode.length === 3, 'SOUND_INSTRUMENT', 'A mode is [ratio, level, decay scale].');
    return [
      number(mode[0], 'mode ratio', 0.1, 40),
      number(mode[1], 'mode level', 0, 4),
      number(mode[2], 'mode decay scale', 0.01, 4),
    ];
  });
  const decay = number(settings.decay ?? preset.decay, 'modal decay', 0.05, 30),
    strike = number(settings.strike ?? preset.strike, 'strike noise', 0, 1),
    hardness = number(settings.hardness ?? 0.5, 'mallet hardness', 0, 1),
    ring = settings.ring ?? preset.ring,
    release = number(settings.release ?? 0.35, 'modal release', 0.02, 10),
    level = dbToGain(number(settings.gain ?? preset.gain ?? 0, 'instrument gain in dB', -48, 24)),
    width = number(settings.width ?? 0.5, 'modal width', 0, 1),
    tremolo = settings.tremolo ?? preset.tremolo ?? null;
  assert(typeof ring === 'boolean', 'SOUND_INSTRUMENT', 'ring is boolean.');
  if (tremolo) {
    assert(Array.isArray(tremolo) && tremolo.length === 2, 'SOUND_INSTRUMENT', 'Tremolo is [rate, depth].');
    number(tremolo[0], 'tremolo rate', 0.1, 20);
    number(tremolo[1], 'tremolo depth', 0, 1);
  }
  const longest = Math.max(...table.map((mode) => mode[2])) * decay * 1.6;
  return defineInstrument(
    {
      kind: 'modal',
      name: settings.name ?? presetName,
      release: Math.min(30, ring ? longest : release),
      cost: 3 + table.length * 3,
    },
    (voice) => {
      const { left, right, rate, start, gate, pitch, velocity } = voice;
      const frequency = midiToFrequency(pitch),
        scale = (261.63 / frequency) ** 0.5,
        total = Math.min(
          left.length - start,
          ring ? Math.ceil(longest * scale * rate) : gate + Math.ceil(release * rate),
        );
      if (total <= 0) return;
      const random = seeded(`modal:${voice.seed}:${pitch}:${start}`);
      const [panL, panR] = panGains(voice.pan);
      const amplitude = voice.gain * level * (0.12 + 0.88 * velocity ** 1.5) * 0.32;
      // A harder or faster strike puts more energy into the upper partials.
      const tilt = 0.25 + 1.6 * (1 - hardness) * (1.15 - velocity);
      const resonators = [];
      for (const [index, [ratio, weight, scaleDecay]] of table.entries()) {
        const hz = frequency * ratio;
        if (hz >= rate * 0.45) continue;
        const seconds = decay * scale * scaleDecay,
          radius = Math.exp(-6.9 / (seconds * rate)),
          angle = (2 * Math.PI * hz) / rate,
          amp = weight / ratio ** tilt,
          side = (index % 2 ? 1 : -1) * width * 0.5 * Math.min(1, index / 2);
        resonators.push({
          current: 0,
          previous: (-amp * Math.sin(angle)) / radius,
          step: 2 * radius * Math.cos(angle),
          squared: radius * radius,
          left: 1 - Math.max(0, side),
          right: 1 + Math.min(0, side),
        });
      }
      const noiseFrames = Math.round((0.004 + 0.01 * (1 - hardness)) * rate),
        noisePole = 1 - Math.exp((-2 * Math.PI * Math.min(9000, frequency * 6)) / rate),
        releaseStep = Math.exp(-6.9 / (release * rate)),
        fadeFrames = Math.min(total, Math.round(0.03 * rate));
      let noise = 0,
        damper = 1;
      for (let i = 0; i < total; i++) {
        let l = 0,
          r = 0;
        for (const mode of resonators) {
          const value = mode.current;
          mode.current = mode.step * value - mode.squared * mode.previous;
          mode.previous = value;
          l += value * mode.left;
          r += value * mode.right;
        }
        if (i < noiseFrames) {
          noise += noisePole * (random() * 2 - 1 - noise);
          const click = noise * strike * velocity * (1 - i / noiseFrames) ** 2;
          l += click;
          r += click;
        }
        if (!ring && i >= gate) damper *= releaseStep;
        let out = amplitude * damper;
        if (tremolo) out *= 1 - tremolo[1] * (0.5 - 0.5 * Math.cos((2 * Math.PI * tremolo[0] * (start + i)) / rate));
        const end = total - i;
        if (end < fadeFrames) out *= end / fadeFrames;
        left[start + i] += l * out * panL * Math.SQRT2;
        right[start + i] += r * out * panR * Math.SQRT2;
      }
    },
  );
}
