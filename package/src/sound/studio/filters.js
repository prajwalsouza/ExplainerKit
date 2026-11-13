import { assert, number, options } from '../../core/validate.js';
import { controlCurve, dbToGain, studioRate } from './core.js';

export const FILTER_TYPES = Object.freeze([
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'allpass',
  'peak',
  'lowshelf',
  'highshelf',
]);
const SLOPES = [12, 24, 36, 48];
// Butterworth section Q values for 2nd, 4th, 6th and 8th order filters.
const BUTTERWORTH = {
  12: [Math.SQRT1_2],
  24: [0.5411961, 1.306563],
  36: [0.5176381, Math.SQRT1_2, 1.9318517],
  48: [0.5097956, 0.6013449, 0.8999762, 2.5629154],
};

/** Normalized biquad coefficients `[b0, b1, b2, a1, a2]` from the Audio EQ Cookbook formulas. */
export function biquadCoefficients(type, frequency, rate, q = Math.SQRT1_2, gainDb = 0) {
  const w = (2 * Math.PI * Math.min(frequency, rate * 0.49)) / rate,
    cos = Math.cos(w),
    sin = Math.sin(w),
    alpha = sin / (2 * q),
    a = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'notch') {
    b0 = 1;
    b1 = -2 * cos;
    b2 = 1;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'allpass') {
    b0 = 1 - alpha;
    b1 = -2 * cos;
    b2 = 1 + alpha;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'peak') {
    b0 = 1 + alpha * a;
    b1 = -2 * cos;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * cos;
    a2 = 1 - alpha / a;
  } else {
    const root = 2 * Math.sqrt(a) * alpha,
      sign = type === 'lowshelf' ? 1 : -1;
    assert(type === 'lowshelf' || type === 'highshelf', 'SOUND_FILTER', 'Use a documented filter type.');
    b0 = a * (a + 1 - sign * (a - 1) * cos + root);
    b1 = sign * 2 * a * (a - 1 - sign * (a + 1) * cos);
    b2 = a * (a + 1 - sign * (a - 1) * cos - root);
    a0 = a + 1 + sign * (a - 1) * cos + root;
    a1 = -sign * 2 * (a - 1 + sign * (a + 1) * cos);
    a2 = a + 1 + sign * (a - 1) * cos - root;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/** Run one biquad over a channel in place using the transposed direct form II. */
export function runBiquad(channel, [b0, b1, b2, a1, a2]) {
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < channel.length; i++) {
    const x = channel[i],
      y = b0 * x + s1;
    s1 = b1 * x - a1 * y + s2;
    s2 = b2 * x - a2 * y;
    channel[i] = y;
  }
}

function bandSections(band, rate, label) {
  options(band, ['type', 'frequency', 'q', 'gain', 'slope'], label);
  const type = band.type ?? 'peak';
  assert(FILTER_TYPES.includes(type), 'SOUND_FILTER', 'Use a documented filter type.');
  const frequency = number(band.frequency ?? 1000, `${label} frequency`, 10, 22000),
    q = number(band.q ?? Math.SQRT1_2, `${label} Q`, 0.1, 30),
    gain = number(band.gain ?? 0, `${label} gain in dB`, -36, 36),
    slope = band.slope ?? 12;
  assert(SLOPES.includes(slope), 'SOUND_FILTER', 'Filter slopes are 12, 24, 36 or 48 dB per octave.');
  if ((type === 'lowpass' || type === 'highpass') && slope > 12) {
    return BUTTERWORTH[slope].map((sectionQ) => biquadCoefficients(type, frequency, rate, sectionQ, 0));
  }
  return [biquadCoefficients(type, frequency, rate, q, gain)];
}

function bandList(params, rate) {
  const bands = params.bands;
  assert(Array.isArray(bands) && bands.length >= 1 && bands.length <= 24, 'SOUND_FILTER', 'An EQ holds 1–24 bands.');
  return bands.flatMap((band, index) => bandSections(band, rate, `EQ band ${index + 1}`));
}

/** Parametric equaliser. Each band is a biquad, or a Butterworth cascade for steeper cuts. */
export function equalizer(buffer, params) {
  options(params, ['type', 'bands'], 'eq effect');
  for (const section of bandList(params, buffer.rate)) {
    runBiquad(buffer.left, section);
    runBiquad(buffer.right, section);
  }
}

/** Level in dB of an EQ band list at each frequency, for drawing a response curve. */
export function filterResponse(bands, frequencies, sampleRate = 48000) {
  const rate = studioRate(sampleRate),
    sections = bandList({ bands }, rate);
  assert(
    Array.isArray(frequencies) && frequencies.length <= 4096,
    'SOUND_FILTER',
    'Give at most 4096 response frequencies.',
  );
  return frequencies.map((frequency) => {
    const w = (2 * Math.PI * number(frequency, 'response frequency', 1, rate / 2)) / rate;
    let power = 1;
    for (const [b0, b1, b2, a1, a2] of sections) {
      const c1 = Math.cos(w),
        s1 = Math.sin(w),
        c2 = Math.cos(2 * w),
        s2 = Math.sin(2 * w);
      const nr = b0 + b1 * c1 + b2 * c2,
        ni = -(b1 * s1 + b2 * s2),
        dr = 1 + a1 * c1 + a2 * c2,
        di = -(a1 * s1 + a2 * s2);
      power *= (nr * nr + ni * ni) / (dr * dr + di * di);
    }
    return 10 * Math.log10(Math.max(power, 1e-24));
  });
}

const FILTER_MODES = ['lowpass', 'highpass', 'bandpass', 'notch'];

/**
 * State-variable filter whose cutoff can move during the sound. The topology
 * preserves its tuning under fast modulation, so sweeps do not click.
 */
export function sweepFilter(buffer, params) {
  options(params, ['type', 'mode', 'frequency', 'resonance', 'slope', 'lfo', 'mix'], 'filter effect');
  const mode = params.mode ?? 'lowpass';
  assert(FILTER_MODES.includes(mode), 'SOUND_FILTER', 'A sweeping filter is lowpass, highpass, bandpass or notch.');
  const { left, right, rate } = buffer,
    frames = left.length;
  const frequency = controlCurve(params.frequency ?? 1200, frames, rate, 'filter frequency', 16, 20000);
  const resonance = number(params.resonance ?? 0.1, 'filter resonance', 0, 0.98),
    stages = params.slope === 24 ? 2 : 1,
    mix = number(params.mix ?? 1, 'filter mix', 0, 1);
  assert(params.slope === undefined || params.slope === 12 || params.slope === 24, 'SOUND_FILTER', 'Use 12 or 24.');
  let lfoRate = 0,
    lfoDepth = 0;
  if (params.lfo !== undefined) {
    options(params.lfo, ['rate', 'depth'], 'filter LFO');
    lfoRate = number(params.lfo.rate ?? 0.2, 'filter LFO rate', 0.01, 20);
    lfoDepth = number(params.lfo.depth ?? 1, 'filter LFO depth in octaves', 0, 4);
  }
  const k = 2 - 2 * resonance;
  for (const [index, channel] of [left, right].entries()) {
    const state = new Float64Array(stages * 2);
    let g = 0,
      a1 = 0,
      a2 = 0,
      a3 = 0;
    for (let i = 0; i < frames; i++) {
      if ((i & 15) === 0) {
        let hz = frequency.at ? frequency.at[i] : frequency.constant;
        if (lfoDepth) hz *= 2 ** (lfoDepth * Math.sin((2 * Math.PI * lfoRate * i) / rate + index * 0.6));
        g = Math.tan((Math.PI * Math.min(hz, rate * 0.45)) / rate);
        a1 = 1 / (1 + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
      }
      const dry = channel[i];
      let x = dry;
      for (let stage = 0; stage < stages; stage++) {
        const ic1 = state[stage * 2],
          ic2 = state[stage * 2 + 1],
          v3 = x - ic2,
          v1 = a1 * ic1 + a2 * v3,
          v2 = ic2 + a2 * ic1 + a3 * v3;
        state[stage * 2] = 2 * v1 - ic1;
        state[stage * 2 + 1] = 2 * v2 - ic2;
        x = mode === 'lowpass' ? v2 : mode === 'bandpass' ? v1 : mode === 'highpass' ? x - k * v1 - v2 : x - k * v1;
      }
      channel[i] = dry + (x - dry) * mix;
    }
  }
}

/** Four-pole ladder low-pass with feedback resonance and a saturating input, run at twice the sample rate. */
export function ladderFilter(buffer, params) {
  options(params, ['type', 'frequency', 'resonance', 'drive'], 'ladder effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const frequency = controlCurve(params.frequency ?? 900, frames, rate, 'ladder frequency', 16, 18000);
  const resonance = number(params.resonance ?? 0.2, 'ladder resonance', 0, 1) * 3.9,
    drive = dbToGain(number(params.drive ?? 0, 'ladder drive in dB', 0, 24));
  for (const channel of [left, right]) {
    let y1 = 0,
      y2 = 0,
      y3 = 0,
      y4 = 0,
      g = 0;
    for (let i = 0; i < frames; i++) {
      if ((i & 15) === 0) {
        const hz = frequency.at ? frequency.at[i] : frequency.constant;
        g = 1 - Math.exp((-Math.PI * Math.min(hz, rate * 0.45)) / rate);
      }
      const input = channel[i] * drive;
      for (let pass = 0; pass < 2; pass++) {
        const x = Math.tanh(input - resonance * y4);
        y1 += g * (x - y1);
        y2 += g * (y1 - y2);
        y3 += g * (y2 - y3);
        y4 += g * (y3 - y4);
      }
      channel[i] = y4 / drive ** 0.5;
    }
  }
}

/** Linkwitz–Riley fourth-order split. Low plus high reconstructs the input with an all-pass phase shift. */
export function crossover(channel, rate, frequency) {
  const low = Float32Array.from(channel),
    high = Float32Array.from(channel);
  const lp = biquadCoefficients('lowpass', frequency, rate),
    hp = biquadCoefficients('highpass', frequency, rate);
  runBiquad(low, lp);
  runBiquad(low, lp);
  runBiquad(high, hp);
  runBiquad(high, hp);
  return [low, high];
}
