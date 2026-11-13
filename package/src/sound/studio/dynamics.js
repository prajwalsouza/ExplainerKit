import { assert, number, options } from '../../core/validate.js';
import { dbToGain } from './core.js';
import { biquadCoefficients, crossover, runBiquad } from './filters.js';

const coefficient = (seconds, rate) => Math.exp(-1 / Math.max(1, seconds * rate));
const LOG = 20 / Math.LN10;

// Four-phase windowed-sinc interpolator used to estimate peaks between samples.
const TAPS = 12;
const PHASES = [1, 2, 3].map((phase) => {
  const taps = new Float64Array(TAPS);
  for (let k = 0; k < TAPS; k++) {
    const x = k - TAPS / 2 + 1 - phase / 4,
      window = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TAPS / 2));
    taps[k] = Math.abs(x) < 1e-9 ? 1 : (Math.sin(Math.PI * x) / (Math.PI * x)) * window;
  }
  return taps;
});

/** Largest absolute value among each sample and three interpolated points after it. */
export function interSamplePeaks(channel, output = new Float32Array(channel.length)) {
  const frames = channel.length;
  for (let i = 0; i < frames; i++) {
    let peak = Math.abs(channel[i]);
    if (peak > 1e-5 && i >= TAPS / 2 && i < frames - TAPS / 2) {
      for (const taps of PHASES) {
        let value = 0;
        for (let k = 0; k < TAPS; k++) value += channel[i + k - TAPS / 2 + 1] * taps[k];
        if (value < 0) value = -value;
        if (value > peak) peak = value;
      }
    }
    if (peak > output[i]) output[i] = peak;
  }
  return output;
}

/** True peak of a stereo buffer in linear gain, estimated at four times the sample rate. */
export function truePeak(left, right) {
  const peaks = interSamplePeaks(right, interSamplePeaks(left));
  let peak = 0;
  for (let i = 0; i < peaks.length; i++) if (peaks[i] > peak) peak = peaks[i];
  return peak;
}

function reductionCurve(reduction, rate) {
  const hop = Math.max(1, Math.round(rate / 50)),
    curve = [];
  for (let i = 0; i < reduction.length; i += hop) {
    let most = 0;
    for (let j = i; j < Math.min(reduction.length, i + hop); j++) if (reduction[j] > most) most = reduction[j];
    curve.push(Math.round(most * 100) / 100);
  }
  return { step: hop / rate, reduction: curve };
}

function keySignal(buffer, params, context, name) {
  const frames = buffer.left.length;
  let left = buffer.left,
    right = buffer.right;
  if (params.key !== undefined) {
    const key = context.keys?.get(params.key);
    assert(key, 'SOUND_SIDECHAIN', `${name} key ${String(params.key)} is not an available sidechain source.`);
    assert(key.left.length === frames, 'SOUND_SIDECHAIN', 'A sidechain key must match the processed audio length.');
    ({ left, right } = key);
  }
  const level = new Float32Array(frames);
  const highpass = params.sidechainHighpass;
  if (highpass !== undefined) {
    const section = biquadCoefficients('highpass', number(highpass, 'sidechain high-pass', 20, 2000), buffer.rate);
    const l = Float32Array.from(left),
      r = Float32Array.from(right);
    runBiquad(l, section);
    runBiquad(r, section);
    left = l;
    right = r;
  }
  for (let i = 0; i < frames; i++) level[i] = Math.max(Math.abs(left[i]), Math.abs(right[i]));
  return level;
}

/**
 * Feed-forward compressor with a soft knee. The detector is stereo-linked and
 * can listen to another signal. Reduction is smoothed in decibels.
 */
export function compressor(buffer, params, context = {}) {
  options(
    params,
    [
      'type',
      'threshold',
      'ratio',
      'knee',
      'attack',
      'release',
      'makeup',
      'lookahead',
      'detector',
      'sidechainHighpass',
      'key',
      'mix',
      'range',
    ],
    'compressor effect',
  );
  const { left, right, rate } = buffer,
    frames = left.length;
  const threshold = number(params.threshold ?? -18, 'compressor threshold in dB', -80, 0),
    ratio = number(params.ratio ?? 3, 'compressor ratio', 1, 100),
    knee = number(params.knee ?? 6, 'compressor knee in dB', 0, 36),
    attack = coefficient(number(params.attack ?? 0.01, 'compressor attack', 0.0001, 2), rate),
    release = coefficient(number(params.release ?? 0.15, 'compressor release', 0.005, 5), rate),
    lookahead = Math.round(number(params.lookahead ?? 0, 'compressor lookahead', 0, 0.05) * rate),
    mix = number(params.mix ?? 1, 'compressor mix', 0, 1),
    range = number(params.range ?? 60, 'compressor range in dB', 0, 60),
    detector = params.detector ?? 'peak';
  assert(detector === 'peak' || detector === 'rms', 'SOUND_DYNAMICS', 'The detector is peak or rms.');
  const slope = 1 - 1 / ratio;
  const makeup =
    params.makeup === 'auto'
      ? (-threshold * slope) / 2
      : number(params.makeup ?? 0, 'compressor makeup in dB', -24, 36);
  const level = keySignal(buffer, params, context, 'Compressor');
  const reduction = new Float32Array(frames);
  const rmsCoefficient = coefficient(0.02, rate);
  let state = 0,
    meanSquare = 0,
    total = 0,
    most = 0;
  for (let i = 0; i < frames; i++) {
    let input = level[i];
    if (detector === 'rms') {
      meanSquare = rmsCoefficient * meanSquare + (1 - rmsCoefficient) * input * input;
      input = Math.sqrt(meanSquare);
    }
    const over = (input > 1e-9 ? LOG * Math.log(input) : -180) - threshold;
    let target = 0;
    if (2 * over > knee) target = over * slope;
    else if (2 * over > -knee) target = (slope * (over + knee / 2) ** 2) / (2 * knee);
    if (target > range) target = range;
    state = target > state ? attack * state + (1 - attack) * target : release * state + (1 - release) * target;
    reduction[i] = state;
    total += state;
    if (state > most) most = state;
  }
  const makeupGain = dbToGain(makeup);
  for (let i = 0; i < frames; i++) {
    // With lookahead the reduction computed from later samples reaches this sample early.
    const ahead = Math.min(frames - 1, i + lookahead),
      gain = 1 - mix + mix * Math.exp(-reduction[ahead] / LOG) * makeupGain;
    left[i] *= gain;
    right[i] *= gain;
  }
  return {
    maxReduction: most,
    meanReduction: total / frames,
    makeup,
    ...(context.curves ? reductionCurve(reduction, rate) : {}),
  };
}

/** Downward expander. Below the threshold the level falls faster, down to `range` decibels of cut. */
export function gate(buffer, params, context = {}) {
  options(
    params,
    ['type', 'threshold', 'ratio', 'range', 'attack', 'hold', 'release', 'sidechainHighpass', 'key'],
    'gate effect',
  );
  const { left, right, rate } = buffer,
    frames = left.length;
  const threshold = number(params.threshold ?? -45, 'gate threshold in dB', -90, 0),
    ratio = number(params.ratio ?? 4, 'gate ratio', 1, 100),
    range = number(params.range ?? 40, 'gate range in dB', 0, 90),
    attack = coefficient(number(params.attack ?? 0.002, 'gate attack', 0.0001, 1), rate),
    release = coefficient(number(params.release ?? 0.15, 'gate release', 0.005, 5), rate),
    hold = Math.round(number(params.hold ?? 0.03, 'gate hold', 0, 2) * rate);
  const level = keySignal(buffer, params, context, 'Gate');
  let envelope = 0,
    state = range,
    held = 0;
  const envelopeRelease = coefficient(0.01, rate);
  for (let i = 0; i < frames; i++) {
    envelope = level[i] > envelope ? level[i] : envelopeRelease * envelope;
    const under = threshold - (envelope > 1e-9 ? LOG * Math.log(envelope) : -180);
    let target = under > 0 ? Math.min(range, under * (ratio - 1)) : 0;
    if (target === 0) held = hold;
    else if (held > 0) {
      held--;
      target = 0;
    }
    state = target < state ? attack * state + (1 - attack) * target : release * state + (1 - release) * target;
    const gain = Math.exp(-state / LOG);
    left[i] *= gain;
    right[i] *= gain;
  }
}

/**
 * Brickwall limiter. It measures peaks between samples, looks ahead so the
 * gain is already down when a peak arrives, and releases exponentially.
 */
export function limiter(buffer, params) {
  options(params, ['type', 'ceiling', 'gain', 'lookahead', 'release'], 'limiter effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const ceiling = dbToGain(number(params.ceiling ?? -1, 'limiter ceiling in dBTP', -24, 0)),
    input = dbToGain(number(params.gain ?? 0, 'limiter input gain in dB', -24, 36)),
    window = Math.max(2, Math.round(number(params.lookahead ?? 0.005, 'limiter lookahead', 0.001, 0.02) * rate)),
    release = coefficient(number(params.release ?? 0.12, 'limiter release', 0.01, 2), rate);
  if (input !== 1) {
    for (let i = 0; i < frames; i++) {
      left[i] *= input;
      right[i] *= input;
    }
  }
  const required = interSamplePeaks(right, interSamplePeaks(left));
  let needed = false;
  for (let i = 0; i < frames; i++) {
    required[i] = required[i] > ceiling ? ceiling / required[i] : 1;
    if (required[i] < 1) needed = true;
  }
  if (!needed) return { maxReduction: 0, limitedSamples: 0 };
  // Sliding minimum over the lookahead window, using a monotonic queue of indices.
  const minimum = new Float32Array(frames),
    queue = new Int32Array(frames);
  let head = 0,
    tail = 0;
  for (let i = 0, write = -window; i < frames + window; i++, write++) {
    if (i < frames) {
      while (tail > head && required[queue[tail - 1]] >= required[i]) tail--;
      queue[tail++] = i;
    }
    if (write < 0) continue;
    while (queue[head] < write) head++;
    minimum[write] = required[queue[head]];
  }
  // A moving average of the minimum reaches each peak's gain exactly when the peak arrives.
  let sum = 0,
    state = 1,
    most = 0,
    limitedSamples = 0;
  for (let i = 0; i < frames; i++) {
    sum += minimum[i] - (i >= window ? minimum[i - window] : 1);
    const smooth = 1 + sum / window;
    state = Math.min(smooth, release * state + (1 - release));
    if (state < 0.9999) limitedSamples++;
    if (1 - state > most) most = 1 - state;
    left[i] *= state;
    right[i] *= state;
  }
  // Gain movement between samples can leave a small overshoot, which is trimmed here.
  const peaks = interSamplePeaks(right, interSamplePeaks(left));
  let peak = 0;
  for (let i = 0; i < frames; i++) if (peaks[i] > peak) peak = peaks[i];
  if (peak > ceiling) {
    const trim = ceiling / peak;
    for (let i = 0; i < frames; i++) {
      left[i] *= trim;
      right[i] *= trim;
    }
  }
  return { maxReduction: -LOG * Math.log(1 - most), limitedSamples };
}

/** Raise or soften note attacks and sustains from the difference between fast and slow envelopes. */
export function transientShaper(buffer, params) {
  options(params, ['type', 'attack', 'sustain'], 'transient effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const attackAmount = number(params.attack ?? 0, 'transient attack amount', -1, 1) * 1.2,
    sustainAmount = number(params.sustain ?? 0, 'transient sustain amount', -1, 1) * 1.2;
  const fastAttack = coefficient(0.0004, rate),
    slowAttack = coefficient(0.025, rate),
    shortRelease = coefficient(0.06, rate),
    longRelease = coefficient(0.6, rate);
  let fast = 0,
    slow = 0,
    tail = 0,
    smoothed = 0;
  const smoothing = coefficient(0.002, rate);
  for (let i = 0; i < frames; i++) {
    const input = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    fast = input > fast ? fastAttack * fast + (1 - fastAttack) * input : shortRelease * fast;
    slow = input > slow ? slowAttack * slow + (1 - slowAttack) * input : shortRelease * slow;
    tail = input > tail ? fastAttack * tail + (1 - fastAttack) * input : longRelease * tail;
    const a = fast > 1e-6 && slow > 1e-6 ? LOG * Math.log(fast / slow) : 0,
      s = tail > 1e-6 && fast > 1e-6 ? LOG * Math.log(tail / fast) : 0;
    const target = Math.max(-12, Math.min(12, attackAmount * Math.max(0, a) + sustainAmount * Math.max(0, s) * 0.5));
    smoothed = smoothing * smoothed + (1 - smoothing) * target;
    const gain = Math.exp(smoothed / LOG);
    left[i] *= gain;
    right[i] *= gain;
  }
}

/** Split into bands with phase-matched crossovers, compress each band and sum the result. */
export function multibandCompressor(buffer, params, context = {}) {
  options(params, ['type', 'crossovers', 'bands'], 'multiband effect');
  const { left, right, rate } = buffer;
  const points = params.crossovers ?? [180, 2500];
  assert(Array.isArray(points) && points.length >= 1 && points.length <= 3, 'SOUND_DYNAMICS', 'Use 1–3 crossovers.');
  points.forEach((point, index) => {
    number(point, 'crossover frequency', 30, 16000);
    assert(index === 0 || point > points[index - 1] * 1.5, 'SOUND_DYNAMICS', 'Space crossovers at least 1.5× apart.');
  });
  const settings = params.bands ?? [];
  assert(
    Array.isArray(settings) && settings.length <= points.length + 1,
    'SOUND_DYNAMICS',
    'Give at most one setting per band.',
  );
  const split = (channel) => {
    const bands = [];
    let rest = channel;
    for (const [index, point] of points.entries()) {
      const [low, high] = crossover(rest, rate, point);
      // Later crossovers shift phase in the higher bands, so each lower band gets the same shift.
      let aligned = low;
      for (const later of points.slice(index + 1)) {
        const [a, b] = crossover(aligned, rate, later);
        for (let i = 0; i < a.length; i++) a[i] += b[i];
        aligned = a;
      }
      bands.push(aligned);
      rest = high;
    }
    bands.push(rest);
    return bands;
  };
  const lefts = split(left),
    rights = split(right),
    reports = [];
  left.fill(0);
  right.fill(0);
  for (let band = 0; band < lefts.length; band++) {
    const part = { left: lefts[band], right: rights[band], rate };
    const { gain = 0, ...compression } = settings[band] ?? {};
    reports.push(compressor(part, { threshold: -24, ratio: 2, attack: 0.02, release: 0.2, ...compression }, context));
    const level = dbToGain(number(gain, 'band gain in dB', -24, 24));
    for (let i = 0; i < left.length; i++) {
      left[i] += part.left[i] * level;
      right[i] += part.right[i] * level;
    }
  }
  return { bands: reports };
}
