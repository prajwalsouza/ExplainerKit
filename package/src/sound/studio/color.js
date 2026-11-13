import { assert, number, options } from '../../core/validate.js';
import { controlCurve, dbToGain } from './core.js';
import { biquadCoefficients, runBiquad } from './filters.js';

export const SATURATION_CURVES = Object.freeze(['tape', 'tube', 'soft', 'hard', 'fold']);

// Half-band interpolation taps for the point midway between two samples.
const HALF = Array.from({ length: 12 }, (_, k) => {
  const x = k - 5.5;
  return (Math.sin(Math.PI * x) / (Math.PI * x)) * (0.5 + 0.5 * Math.cos((Math.PI * x) / 6));
});

/** Apply a nonlinear function at twice the sample rate so the harmonics it adds fold back less. */
function oversampled(channel, shape) {
  const frames = channel.length,
    up = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    let between = 0;
    for (let k = 0; k < 12; k++) between += (channel[i + k - 5] ?? 0) * HALF[k];
    up[2 * i] = shape(channel[i]);
    up[2 * i + 1] = shape(between);
  }
  for (let i = 0; i < frames; i++) {
    let odd = 0;
    for (let k = 0; k < 12; k++) odd += (up[2 * i + 2 * (k - 5) - 1] ?? 0) * HALF[k];
    channel[i] = 0.5 * up[2 * i] + 0.5 * odd;
  }
}

function rms(left, right) {
  let sum = 0;
  for (let i = 0; i < left.length; i++) sum += left[i] * left[i] + right[i] * right[i];
  return Math.sqrt(sum / (2 * left.length));
}

/**
 * Harmonic saturation. Without an `output` level the result is matched to the
 * input's RMS level, so a comparison hears the colour and not a volume change.
 */
export function saturation(buffer, params) {
  options(params, ['type', 'curve', 'drive', 'output', 'mix', 'bias'], 'saturation effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const curve = params.curve ?? 'tape';
  assert(SATURATION_CURVES.includes(curve), 'SOUND_SATURATION', 'Use a documented saturation curve.');
  const drive = dbToGain(number(params.drive ?? 6, 'saturation drive in dB', 0, 36)),
    mix = number(params.mix ?? 1, 'saturation mix', 0, 1),
    bias = number(params.bias ?? 0.2, 'saturation bias', 0, 0.6),
    offset = Math.tanh(bias);
  const shapes = {
    tape: (x) => Math.tanh(x * drive),
    tube: (x) => (Math.tanh(x * drive + bias) - offset) / (1 - offset * offset),
    soft: (x) => {
      const v = Math.max(-1, Math.min(1, x * drive * (2 / 3)));
      return 1.5 * (v - (v * v * v) / 3);
    },
    hard: (x) => Math.max(-1, Math.min(1, x * drive)),
    fold: (x) => Math.sin((Math.PI / 2) * x * drive),
  };
  const before = rms(left, right);
  const dryL = mix < 1 ? Float32Array.from(left) : null,
    dryR = mix < 1 ? Float32Array.from(right) : null;
  // Tape emphasis saturates the top of the spectrum first and restores the balance afterwards.
  const emphasis = curve === 'tape' ? biquadCoefficients('highshelf', 4000, rate, Math.SQRT1_2, 4) : null,
    restore = curve === 'tape' ? biquadCoefficients('highshelf', 4000, rate, Math.SQRT1_2, -4) : null;
  for (const channel of [left, right]) {
    if (emphasis) runBiquad(channel, emphasis);
    oversampled(channel, shapes[curve]);
    if (restore) runBiquad(channel, restore);
    if (curve === 'tube') runBiquad(channel, biquadCoefficients('highpass', 12, rate));
  }
  const after = rms(left, right);
  const output =
    params.output === undefined
      ? after > 1e-9
        ? before / after
        : 1
      : dbToGain(number(params.output, 'saturation output in dB', -36, 24));
  for (let i = 0; i < frames; i++) {
    left[i] = left[i] * output * mix + (dryL ? dryL[i] * (1 - mix) : 0);
    right[i] = right[i] * output * mix + (dryR ? dryR[i] * (1 - mix) : 0);
  }
}

/** Reduce bit depth and hold samples, for deliberately coarse digital texture. */
export function bitcrush(buffer, params) {
  options(params, ['type', 'bits', 'hold', 'mix'], 'bitcrush effect');
  const bits = number(params.bits ?? 10, 'bit depth', 2, 16),
    hold = params.hold ?? 2,
    mix = number(params.mix ?? 1, 'bitcrush mix', 0, 1),
    levels = 2 ** (bits - 1);
  assert(Number.isInteger(hold) && hold >= 1 && hold <= 64, 'SOUND_SATURATION', 'Hold 1–64 samples.');
  for (const channel of [buffer.left, buffer.right]) {
    let held = 0;
    for (let i = 0; i < channel.length; i++) {
      if (i % hold === 0) held = Math.round(channel[i] * levels) / levels;
      channel[i] += (held - channel[i]) * mix;
    }
  }
}

/** Add harmonics generated from the upper band only, which brightens without raising the whole top end. */
export function exciter(buffer, params) {
  options(params, ['type', 'frequency', 'drive', 'amount'], 'exciter effect');
  const { left, right, rate } = buffer;
  const section = biquadCoefficients(
      'highpass',
      number(params.frequency ?? 3500, 'exciter frequency', 500, 12000),
      rate,
    ),
    drive = dbToGain(number(params.drive ?? 12, 'exciter drive in dB', 0, 36)),
    amount = number(params.amount ?? 0.15, 'exciter amount', 0, 1);
  for (const channel of [left, right]) {
    const band = Float32Array.from(channel);
    runBiquad(band, section);
    oversampled(band, (x) => Math.tanh(x * drive) / drive);
    runBiquad(band, section);
    for (let i = 0; i < channel.length; i++) channel[i] += band[i] * amount * 4;
  }
}

/** Mid/side width. `lowMono` keeps frequencies below it in the centre. */
export function width(buffer, params) {
  options(params, ['type', 'width', 'lowMono'], 'width effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const amount = controlCurve(params.width ?? 1, frames, rate, 'stereo width', 0, 2);
  const side = new Float32Array(frames);
  for (let i = 0; i < frames; i++) side[i] = (left[i] - right[i]) * 0.5;
  if (params.lowMono !== undefined) {
    const section = biquadCoefficients('highpass', number(params.lowMono, 'low mono frequency', 20, 1000), rate);
    runBiquad(side, section);
    runBiquad(side, section);
  }
  for (let i = 0; i < frames; i++) {
    const mid = (left[i] + right[i]) * 0.5,
      s = side[i] * (amount.at ? amount.at[i] : amount.constant);
    left[i] = mid + s;
    right[i] = mid - s;
  }
}

/** Equal-power balance, scaled so the centre position leaves the level unchanged. */
export function pan(buffer, params) {
  options(params, ['type', 'pan'], 'pan effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const position = controlCurve(params.pan ?? 0, frames, rate, 'pan', -1, 1);
  for (let i = 0; i < frames; i++) {
    const angle = (((position.at ? position.at[i] : position.constant) + 1) * Math.PI) / 4;
    left[i] *= Math.SQRT2 * Math.cos(angle);
    right[i] *= Math.SQRT2 * Math.sin(angle);
  }
}

/** Delay one side by a few milliseconds, which moves a sound sideways without changing its level. */
export function haas(buffer, params) {
  options(params, ['type', 'delay', 'side'], 'haas effect');
  const frames = Math.round(number(params.delay ?? 0.012, 'haas delay', 0, 0.04) * buffer.rate),
    side = params.side ?? 'right';
  assert(side === 'left' || side === 'right', 'SOUND_STEREO', 'Delay the left or the right side.');
  const channel = side === 'left' ? buffer.left : buffer.right;
  channel.copyWithin(frames, 0, channel.length - frames);
  channel.fill(0, 0, frames);
}

/** Gain in decibels, as one value or as automation points. */
export function gain(buffer, params) {
  options(params, ['type', 'gain'], 'gain effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const level = controlCurve(params.gain ?? 0, frames, rate, 'gain in dB', -120, 36);
  if (!level.at) {
    const g = dbToGain(level.constant);
    for (let i = 0; i < frames; i++) {
      left[i] *= g;
      right[i] *= g;
    }
    return;
  }
  for (let i = 0; i < frames; i++) {
    const g = Math.exp(level.at[i] * 0.11512925464970229);
    left[i] *= g;
    right[i] *= g;
  }
}

/** Fade the start and the end of the buffer with raised-cosine ramps. */
export function fade(buffer, params) {
  options(params, ['type', 'in', 'out'], 'fade effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const fadeIn = Math.min(frames, Math.round(number(params.in ?? 0, 'fade in', 0, 120) * rate)),
    fadeOut = Math.min(frames, Math.round(number(params.out ?? 0, 'fade out', 0, 120) * rate));
  for (let i = 0; i < fadeIn; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn);
    left[i] *= g;
    right[i] *= g;
  }
  for (let i = 0; i < fadeOut; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeOut),
      at = frames - 1 - i;
    left[at] *= g;
    right[at] *= g;
  }
}
