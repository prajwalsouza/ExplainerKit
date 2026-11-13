import { assert, number, options } from '../../core/validate.js';
import { dbToGain, seeded } from './core.js';
import { biquadCoefficients, runBiquad } from './filters.js';

/** Named spaces. Each is a starting point whose fields can be overridden in the effect. */
export const REVERB_PRESETS = Object.freeze({
  room: Object.freeze({ decay: 0.7, size: 0.45, predelay: 0.004, damping: 0.45, early: 0.6, modulation: 0.15 }),
  chamber: Object.freeze({ decay: 1.4, size: 0.7, predelay: 0.012, damping: 0.5, early: 0.45, modulation: 0.25 }),
  plate: Object.freeze({ decay: 2.2, size: 0.55, predelay: 0.002, damping: 0.72, early: 0.08, modulation: 0.35 }),
  hall: Object.freeze({ decay: 2.8, size: 1, predelay: 0.024, damping: 0.42, early: 0.3, modulation: 0.3 }),
  cathedral: Object.freeze({ decay: 5.5, size: 1.5, predelay: 0.04, damping: 0.34, early: 0.2, modulation: 0.4 }),
  ambient: Object.freeze({ decay: 9, size: 1.3, predelay: 0.03, damping: 0.5, early: 0.05, modulation: 0.6 }),
});

const LINES = 16;
// Delay lengths in milliseconds at size 1, chosen without common factors once rounded to samples.
const LENGTHS = [31.7, 37.3, 41.9, 46.1, 52.3, 57.1, 61.9, 67.3, 71.3, 77.9, 83.3, 89.7, 94.1, 101.3, 107.9, 113.3];
const DIFFUSERS = [4.77, 3.6, 12.73, 9.31];
const EARLY = [
  [7.1, 0.84, -0.6],
  [11.3, 0.72, 0.7],
  [16.9, 0.66, -0.25],
  [23.3, 0.58, 0.45],
  [29.9, 0.5, -0.8],
  [37.1, 0.44, 0.85],
  [46.3, 0.36, -0.4],
  [56.9, 0.3, 0.3],
  [68.3, 0.24, 0.65],
  [79.7, 0.18, -0.7],
];

function nextPrime(value) {
  for (let n = Math.max(3, value | 1); ; n += 2) {
    let prime = true;
    for (let d = 3; d * d <= n; d += 2) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) return n;
  }
}

function hadamard(v) {
  for (let width = 1; width < LINES; width <<= 1) {
    for (let i = 0; i < LINES; i += width << 1) {
      for (let j = i; j < i + width; j++) {
        const a = v[j],
          b = v[j + width];
        v[j] = a + b;
        v[j + width] = a - b;
      }
    }
  }
}

/**
 * Algorithmic reverb built from early reflections, input diffusion and a
 * sixteen-line feedback delay network. Decay times are set per frequency band,
 * and slow modulation of the delay lines keeps long tails from ringing.
 */
export function reverb(buffer, params) {
  options(
    params,
    [
      'type',
      'preset',
      'decay',
      'size',
      'predelay',
      'damping',
      'bass',
      'early',
      'modulation',
      'diffusion',
      'mix',
      'wet',
      'dry',
      'lowCut',
      'highCut',
      'width',
      'seed',
    ],
    'reverb effect',
  );
  const preset = params.preset ?? 'hall';
  assert(Object.hasOwn(REVERB_PRESETS, preset), 'SOUND_REVERB', 'Use a documented reverb preset.');
  const base = REVERB_PRESETS[preset];
  const { left, right, rate } = buffer,
    frames = left.length;
  const decay = number(params.decay ?? base.decay, 'reverb decay in seconds', 0.1, 30),
    size = number(params.size ?? base.size, 'reverb size', 0.2, 2),
    predelay = Math.round(number(params.predelay ?? base.predelay, 'reverb predelay', 0, 0.25) * rate),
    damping = number(params.damping ?? base.damping, 'reverb damping', 0, 1),
    bass = number(params.bass ?? 1.1, 'reverb bass decay ratio', 0.3, 2),
    early = number(params.early ?? base.early, 'reverb early level', 0, 1),
    modulation = number(params.modulation ?? base.modulation, 'reverb modulation', 0, 1),
    diffusion = number(params.diffusion ?? 0.7, 'reverb diffusion', 0, 0.85),
    width = number(params.width ?? 1, 'reverb width', 0, 1.5);
  let wet, dry;
  if (params.mix !== undefined) {
    const mix = number(params.mix, 'reverb mix', 0, 1);
    wet = Math.sin((mix * Math.PI) / 2);
    dry = Math.cos((mix * Math.PI) / 2);
  } else {
    wet = dbToGain(number(params.wet ?? -12, 'reverb wet level in dB', -80, 12));
    dry = params.dry === undefined ? 1 : dbToGain(number(params.dry, 'reverb dry level in dB', -80, 12));
    if (params.dry !== undefined && params.dry <= -80) dry = 0;
  }
  const random = seeded(params.seed ?? 'reverb');

  // The wet path starts from a copy so the dry signal stays untouched until the final sum.
  const inL = new Float32Array(frames),
    inR = new Float32Array(frames);
  for (let i = predelay; i < frames; i++) {
    inL[i] = left[i - predelay];
    inR[i] = right[i - predelay];
  }
  const wetL = new Float32Array(frames),
    wetR = new Float32Array(frames);

  if (early > 0) {
    for (const [ms, gain, pan] of EARLY) {
      const delay = Math.round(ms * size * 0.001 * rate),
        l = gain * early * Math.min(1, 1 - pan),
        r = gain * early * Math.min(1, 1 + pan);
      for (let i = delay; i < frames; i++) {
        // Each reflection crosses a little into the opposite side, as a wall reflection would.
        wetL[i] += (inL[i - delay] * 0.8 + inR[i - delay] * 0.2) * l * 0.35;
        wetR[i] += (inR[i - delay] * 0.8 + inL[i - delay] * 0.2) * r * 0.35;
      }
    }
  }

  for (const [index, channel] of [inL, inR].entries()) {
    for (const ms of DIFFUSERS) {
      const length = nextPrime(Math.round(ms * (1 + index * 0.07) * 0.001 * rate)),
        memory = new Float32Array(length);
      let cursor = 0;
      for (let i = 0; i < frames; i++) {
        const delayed = memory[cursor],
          input = channel[i] - delayed * diffusion;
        memory[cursor] = input;
        channel[i] = delayed + input * diffusion;
        if (++cursor === length) cursor = 0;
      }
    }
  }

  const lengths = LENGTHS.map((ms) => nextPrime(Math.round(ms * size * 0.001 * rate)));
  const span = 2 ** Math.ceil(Math.log2(Math.max(...lengths) + rate * 0.004 + 4)),
    mask = span - 1;
  const lines = lengths.map(() => new Float32Array(span));
  const highDecay = decay * (0.12 + 0.88 * (1 - damping) ** 1.5),
    lowDecay = decay * bass;
  const gMid = lengths.map((length) => 10 ** ((-3 * length) / (decay * rate))),
    gHigh = lengths.map((length) => 10 ** ((-3 * length) / (highDecay * rate))),
    gLow = lengths.map((length) => 10 ** ((-3 * length) / (lowDecay * rate)));
  const highPole = 1 - Math.exp((-2 * Math.PI * (2200 + 5000 * (1 - damping))) / rate),
    lowPole = 1 - Math.exp((-2 * Math.PI * 220) / rate);
  const lowState = new Float64Array(LINES),
    highState = new Float64Array(LINES);
  const depth = lengths.map((_, index) => (index % 2 === 0 ? modulation * 0.0011 * rate * (0.5 + random()) : 0)),
    speed = lengths.map(() => (2 * Math.PI * (0.11 + 0.9 * random())) / rate),
    phase = lengths.map(() => 2 * Math.PI * random());
  const v = new Float64Array(LINES);
  const scale = 1 / Math.sqrt(LINES);
  let write = 0;
  for (let i = 0; i < frames; i++) {
    let outL = 0,
      outR = 0;
    for (let n = 0; n < LINES; n++) {
      let sample;
      if (depth[n]) {
        const position = write - lengths[n] - depth[n] * (1 + Math.sin(phase[n] + speed[n] * i)),
          whole = Math.floor(position),
          fraction = position - whole;
        const line = lines[n],
          a = line[whole & mask];
        sample = a + (line[(whole + 1) & mask] - a) * fraction;
      } else sample = lines[n][(write - lengths[n]) & mask];
      lowState[n] += lowPole * (sample - lowState[n]);
      highState[n] += highPole * (sample - highState[n]);
      const low = lowState[n],
        high = sample - highState[n];
      v[n] = gMid[n] * (sample - low - high) + gLow[n] * low + gHigh[n] * high;
      // Alternating signs across the lines give two output sums that share little direct correlation.
      if (n & 1) outR += n & 2 ? sample : -sample;
      else outL += n & 2 ? -sample : sample;
    }
    hadamard(v);
    const l = inL[i],
      r = inR[i];
    for (let n = 0; n < LINES; n++) lines[n][write] = v[n] * 0.25 + (n & 1 ? r : l) * scale * 2;
    write = (write + 1) & mask;
    wetL[i] += outL * 0.25;
    wetR[i] += outR * 0.25;
  }

  const lowCut = number(params.lowCut ?? 140, 'reverb low cut', 20, 2000),
    highCut = number(params.highCut ?? 9000, 'reverb high cut', 500, 20000);
  for (const channel of [wetL, wetR]) {
    runBiquad(channel, biquadCoefficients('highpass', lowCut, rate));
    runBiquad(channel, biquadCoefficients('lowpass', highCut, rate));
  }
  const mid = (1 + width) / 2,
    side = (1 - width) / 2;
  for (let i = 0; i < frames; i++) {
    const l = wetL[i],
      r = wetR[i];
    left[i] = left[i] * dry + (l * mid + r * side) * wet;
    right[i] = right[i] * dry + (r * mid + l * side) * wet;
  }
  return { decay, predelay: predelay / rate };
}

/** Seconds a reverb with these settings needs before its tail falls 60 dB. */
export function reverbTail(params = {}) {
  const base = REVERB_PRESETS[params.preset ?? 'hall'] ?? REVERB_PRESETS.hall;
  return (params.decay ?? base.decay) * (params.bass > 1 ? params.bass : 1.1) + (params.predelay ?? base.predelay);
}
