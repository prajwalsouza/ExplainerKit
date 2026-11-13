import { assert, number, options, safeCopy } from '../core/validate.js';

export const SAMPLE_BUDGET = 16_000_000;
export function sampleRate(value = 48000) {
  number(value, 'sound sample rate', 8000, 192000);
  assert(Number.isInteger(value), 'AUDIO_RATE', 'Use a whole-Hz sample rate.');
  return value;
}
export function dense(input, name = 'sound array', max = 2048) {
  assert(
    Array.isArray(input) && input.length <= max && Reflect.ownKeys(input).length === input.length + 1,
    'SOUND_DATA',
    `${name} must be a bounded dense array.`,
  );
  return Array.from({ length: input.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(input, i);
    assert(d && 'value' in d, 'SOUND_DATA', `${name} cannot contain holes or accessors.`);
    return d.value;
  });
}
export function allocate(count, channels = 2) {
  assert(
    Number.isInteger(count) && count > 0 && count * channels <= SAMPLE_BUDGET,
    'RESOURCE_LIMIT',
    'Sound PCM exceeds the 16-million-sample call budget.',
  );
  return Array.from({ length: channels }, () => new Float32Array(count));
}
export function result(channels, rate, metadata = {}) {
  return Object.freeze({
    channels: Object.freeze(channels),
    sampleRate: rate,
    duration: channels[0].length / rate,
    metadata: safeCopy(metadata),
  });
}
/** Capture caller decoded mono/stereo PCM. The returned typed arrays belong to the caller. */
export function capturePCM(input) {
  options(input, ['channels', 'sampleRate', 'duration', 'metadata', 'clippedSamples'], 'sound PCM');
  const rate = sampleRate(input.sampleRate),
    sources = dense(input.channels, 'PCM channels', 2);
  assert(sources.length > 0, 'AUDIO_CHANNELS', 'Supply one or two PCM channels.');
  let count = 0;
  for (const source of sources) {
    assert(
      source &&
        (Array.isArray(source) ||
          Object.getPrototypeOf(source) === Float32Array.prototype ||
          Object.getPrototypeOf(source) === Float64Array.prototype),
      'SOUND_DATA',
      'Supply plain arrays or built-in Float32/64 PCM channels.',
    );
    assert(
      !Object.getOwnPropertyDescriptor(source, 'length') ||
        'value' in Object.getOwnPropertyDescriptor(source, 'length'),
      'SOUND_DATA',
      'PCM length cannot be an accessor.',
    );
    count += source.length;
    assert(count <= SAMPLE_BUDGET, 'RESOURCE_LIMIT', 'Captured sound PCM exceeds budget.');
  }
  const channels = sources.map((source) => {
    const values = Array.isArray(source) ? dense(source, 'PCM values', SAMPLE_BUDGET) : source;
    assert(values.length > 0, 'SOUND_DATA', 'PCM must contain samples.');
    const output = new Float32Array(values.length);
    for (let i = 0; i < output.length; i++) output[i] = number(values[i], 'PCM amplitude', -100, 100);
    return output;
  });
  assert(
    channels.every((c) => c.length === channels[0].length),
    'AUDIO_CHANNELS',
    'PCM channels must have equal lengths.',
  );
  return result(channels, rate, input.metadata ?? {});
}
export function rng(seed = 1) {
  assert(typeof seed === 'string' || typeof seed === 'number', 'SOUND_SEED', 'Use a string or finite numeric seed.');
  if (typeof seed === 'number') number(seed, 'sound seed', -1e12, 1e12);
  assert(String(seed).length <= 256, 'RESOURCE_LIMIT', 'Sound seed is too long.');
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
export function peakOf(channels) {
  let peak = 0;
  for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  return peak;
}
export function scalePeak(channels, peak = 0.85) {
  const current = peakOf(channels),
    gain = current > 0 ? peak / current : 1;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  return channels;
}
export function fades(channels, rate, attack = 0.003, release = 0.03) {
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) {
      const a = Math.min(1, i / Math.max(1, attack * rate)),
        b = Math.min(1, (channel.length - 1 - i) / Math.max(1, release * rate));
      channel[i] =
        i === 0 || i === channel.length - 1
          ? 0
          : channel[i] * Math.sin((a * Math.PI) / 2) * Math.sin((b * Math.PI) / 2);
    }
  return channels;
}
function biquad(channel, rate, type, frequency, q, gain) {
  const w = (2 * Math.PI * frequency) / rate,
    c = Math.cos(w),
    s = Math.sin(w),
    alpha = s / (2 * q),
    a = 10 ** (gain / 40);
  let b0,
    b1,
    b2,
    a0 = 1 + alpha,
    a1 = -2 * c,
    a2 = 1 - alpha;
  if (type === 'lowpass') {
    b0 = (1 - c) / 2;
    b1 = 1 - c;
    b2 = b0;
  } else if (type === 'highpass') {
    b0 = (1 + c) / 2;
    b1 = -(1 + c);
    b2 = b0;
  } else if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  } else {
    b0 = 1 + alpha * a;
    b1 = -2 * c;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * c;
    a2 = 1 - alpha / a;
  }
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < channel.length; i++) {
    const x = channel[i],
      y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    channel[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
}
/** Ordered offline processing. Delay/reverb retain tails unless an explicit tail bound is supplied. */
export function processSound(input, operations = []) {
  let pcm = capturePCM(input),
    channels = pcm.channels.map((c) => c.slice());
  const rate = pcm.sampleRate,
    history = [];
  let work = 0;
  for (const operation of dense(operations, 'sound operations', 32)) {
    options(
      operation,
      [
        'type',
        'from',
        'to',
        'seconds',
        'attack',
        'release',
        'value',
        'frequency',
        'q',
        'gain',
        'time',
        'feedback',
        'mix',
        'tail',
        'decay',
        'seed',
        'threshold',
      ],
      'sound operation',
    );
    const kind = operation.type;
    work += channels[0].length * channels.length * (kind === 'reverb' ? 12 : kind === 'delay' ? 3 : 1);
    assert(
      work <= 128_000_000,
      'RESOURCE_LIMIT',
      'Sound operation work exceeds this call budget; process shorter segments.',
    );
    if (kind === 'trim') {
      const from = number(operation.from ?? 0, 'trim start', 0, channels[0].length / rate),
        to = number(operation.to ?? channels[0].length / rate, 'trim end', from, channels[0].length / rate),
        start = Math.round(from * rate),
        end = Math.round(to * rate);
      assert(end > start, 'SOUND_DATA', 'Trim must retain at least one sample.');
      channels = channels.map((c) => c.slice(start, end));
    } else if (kind === 'fade') {
      fades(
        channels,
        rate,
        number(operation.attack ?? 0.005, 'fade attack', 0, 30),
        number(operation.release ?? 0.03, 'fade release', 0, 30),
      );
    } else if (kind === 'gain') {
      const gain = number(operation.value ?? 1, 'sound gain', 0, 16);
      for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= gain;
    } else if (kind === 'reverse') {
      for (const c of channels) c.reverse();
    } else if (kind === 'pan') {
      const pan = number(operation.value ?? 0, 'sound pan', -1, 1),
        left = Math.cos(((pan + 1) * Math.PI) / 4),
        right = Math.sin(((pan + 1) * Math.PI) / 4);
      if (channels.length === 1) channels = [channels[0].slice(), channels[0].slice()];
      for (let i = 0; i < channels[0].length; i++) {
        channels[0][i] *= left;
        channels[1][i] *= right;
      }
    } else if (['lowpass', 'highpass', 'bandpass', 'eq'].includes(kind)) {
      const frequency = number(operation.frequency ?? 1000, 'filter frequency', 10, rate * 0.45),
        q = number(operation.q ?? 0.707, 'filter Q', 0.1, 20),
        gain = number(operation.gain ?? 0, 'EQ gain dB', -24, 24);
      for (const c of channels) biquad(c, rate, kind, frequency, q, gain);
    } else if (kind === 'normalize') {
      scalePeak(channels, number(operation.value ?? 0.85, 'normalization peak', 0.001, 1));
    } else if (kind === 'limit') {
      const threshold = number(operation.threshold ?? 0.95, 'peak ceiling', 0.01, 1);
      for (const c of channels)
        for (let i = 0; i < c.length; i++) c[i] = Math.max(-threshold, Math.min(threshold, c[i]));
    } else if (kind === 'delay') {
      const seconds = number(operation.time ?? 0.12, 'delay time', 1 / rate, 2),
        feedback = number(operation.feedback ?? 0.3, 'delay feedback', 0, 0.95),
        mix = number(operation.mix ?? 0.2, 'delay mix', 0, 1),
        tail = number(
          operation.tail ??
            Math.min(8, seconds * Math.max(1, Math.ceil(Math.log(0.001) / Math.log(Math.max(0.001, feedback))))),
          'delay tail',
          0,
          8,
        ),
        offset = Math.max(1, Math.round(seconds * rate));
      const next = allocate(channels[0].length + Math.round(tail * rate), channels.length);
      for (let c = 0; c < channels.length; c++) {
        const wet = new Float32Array(next[c].length);
        for (let i = 0; i < wet.length; i++) {
          wet[i] = (channels[c][i] ?? 0) + (i >= offset ? wet[i - offset] * feedback : 0);
          next[c][i] = (channels[c][i] ?? 0) * (1 - mix) + (i >= offset ? wet[i - offset] * mix : 0);
        }
      }
      channels = next;
    } else if (kind === 'reverb') {
      // Schroeder-inspired parallel damped combs plus short decorrelating all-pass stages.
      const seconds = number(operation.seconds ?? 0.7, 'reverb length', 0.03, 4),
        decay = number(operation.decay ?? 0.65, 'reverb decay', 0.05, 0.95),
        mix = number(operation.mix ?? 0.18, 'reverb mix', 0, 1),
        tail = number(operation.tail ?? seconds, 'reverb tail', 0, 4),
        next = allocate(channels[0].length + Math.round(tail * rate), channels.length),
        random = rng(operation.seed ?? 41);
      for (let c = 0; c < channels.length; c++) {
        const wet = new Float32Array(next[c].length);
        for (const base of [0.0297, 0.0371, 0.0411, 0.0437]) {
          const delay = Math.max(2, Math.round((base + (random() - 0.5) * 0.002 + c * 0.0013) * rate)),
            buffer = new Float32Array(delay),
            feedback = decay ** (delay / (rate * 0.05));
          let damp = 0;
          for (let i = 0; i < wet.length; i++) {
            const index = i % delay,
              old = buffer[index];
            damp = 0.25 * old + 0.75 * damp;
            buffer[index] = (channels[c][i] ?? 0) + damp * feedback;
            wet[i] += old * 0.25;
          }
        }
        for (const delaySeconds of [0.005, 0.0017]) {
          const count = Math.max(1, Math.round(delaySeconds * rate)),
            buffer = new Float32Array(count);
          for (let i = 0; i < wet.length; i++) {
            const index = i % count,
              old = buffer[index],
              value = wet[i];
            wet[i] = old - 0.5 * value;
            buffer[index] = value + 0.5 * wet[i];
          }
        }
        for (let i = 0; i < wet.length; i++) next[c][i] = (channels[c][i] ?? 0) * (1 - mix) + wet[i] * mix;
      }
      channels = next;
    } else assert(false, 'SOUND_OPERATION', 'Use a supported offline sound operation.');
    history.push(kind);
    assert(
      peakOf(channels) <= 100,
      'SOUND_RANGE',
      'Processing gain exceeds bounded PCM amplitude; lower gain or limit earlier.',
    );
  }
  pcm = null;
  return result(channels, rate, { source: 'processed-pcm', operations: history, peak: peakOf(channels) });
}
