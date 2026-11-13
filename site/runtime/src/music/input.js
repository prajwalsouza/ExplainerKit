import { assert, number, options } from '../core/validate.js';
import { sampleRate } from '../sound/pcm.js';

/** Longest recording, in seconds, that one analysis call accepts. */
export const MAX_MUSIC_SECONDS = 900;
const MAX_SAMPLES = 2 * MAX_MUSIC_SECONDS * 96000;

function channelArray(source) {
  assert(
    source &&
      (Object.getPrototypeOf(source) === Float32Array.prototype ||
        Object.getPrototypeOf(source) === Float64Array.prototype),
    'SOUND_DATA',
    'Music analysis reads decoded PCM as built-in Float32Array or Float64Array channels.',
  );
  return source;
}

/**
 * Validate decoded PCM without copying the caller's channels. Accepts the
 * `{channels, sampleRate}` shape that `explainerkit/sound` produces and that an
 * application builds from a decoded AudioBuffer.
 */
export function readMusicPCM(input) {
  options(input, ['channels', 'sampleRate', 'duration', 'metadata', 'clippedSamples'], 'music PCM');
  const rate = sampleRate(input.sampleRate);
  assert(
    Array.isArray(input.channels) && input.channels.length >= 1 && input.channels.length <= 2,
    'AUDIO_CHANNELS',
    'Supply one or two PCM channels.',
  );
  const descriptors = [0, 1]
    .slice(0, input.channels.length)
    .map((i) => Object.getOwnPropertyDescriptor(input.channels, i));
  assert(
    descriptors.every((d) => d && 'value' in d),
    'SOUND_DATA',
    'PCM channels cannot be holes or accessors.',
  );
  const channels = descriptors.map((d) => channelArray(d.value)),
    length = channels[0].length;
  assert(length > 0, 'SOUND_DATA', 'PCM must contain samples.');
  assert(
    channels.every((c) => c.length === length),
    'AUDIO_CHANNELS',
    'PCM channels must have equal lengths.',
  );
  assert(
    length / rate <= MAX_MUSIC_SECONDS && length * channels.length <= MAX_SAMPLES,
    'RESOURCE_LIMIT',
    `Music analysis accepts at most ${MAX_MUSIC_SECONDS} seconds of audio per call.`,
  );
  for (const channel of channels)
    for (let i = 0; i < length; i++) {
      const v = channel[i];
      if (!(v >= -100 && v <= 100)) number(v, 'PCM amplitude', -100, 100);
    }
  return { channels, sampleRate: rate, length, duration: length / rate };
}

/**
 * Fold to mono and decimate by a whole factor to an analysis rate near
 * 22 kHz. A Blackman-windowed sinc low-pass filter removes content above the
 * new Nyquist frequency before samples are dropped.
 */
export function analysisSignal(pcm) {
  const factor = Math.max(1, Math.round(pcm.sampleRate / 22050)),
    rate = pcm.sampleRate / factor,
    [left, right = left] = pcm.channels,
    count = Math.ceil(pcm.length / factor),
    output = new Float32Array(count);
  if (factor === 1) {
    for (let i = 0; i < count; i++) output[i] = (left[i] + right[i]) / 2;
    return { signal: output, sampleRate: rate, factor };
  }
  const taps = 16 * factor + 1,
    half = (taps - 1) / 2,
    cutoff = 0.45 / factor,
    kernel = new Float64Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - half,
      sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x),
      blackman =
        0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    kernel[i] = sinc * blackman;
    sum += kernel[i];
  }
  for (let i = 0; i < taps; i++) kernel[i] /= sum;
  for (let n = 0; n < count; n++) {
    const centre = n * factor;
    let acc = 0;
    for (let k = 0; k < taps; k++) {
      const index = centre + k - half;
      if (index >= 0 && index < pcm.length) acc += kernel[k] * (left[index] + right[index]);
    }
    output[n] = acc / 2;
  }
  return { signal: output, sampleRate: rate, factor };
}
