import { assert, number } from '../../core/validate.js';

/** One studio call holds at most 15 minutes of stereo audio and 256 million samples across its buffers. */
export const STUDIO_LIMITS = Object.freeze({ seconds: 900, samples: 256_000_000, effects: 64 });

export const dbToGain = (db) => 10 ** (db / 20);
export const gainToDb = (gain) => (gain > 1e-12 ? 20 * Math.log10(gain) : -240);
export const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
export const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function studioRate(value = 48000) {
  number(value, 'studio sample rate', 22050, 96000);
  assert(Number.isInteger(value), 'AUDIO_RATE', 'Use a whole-Hz sample rate from 22050 to 96000.');
  return value;
}

function field(input, key) {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  assert(descriptor && 'value' in descriptor, 'SOUND_DATA', `Audio needs a plain ${key} field.`);
  return descriptor.value;
}

/** Read caller PCM as `{channels, sampleRate}` without copying. Mono input is duplicated by `stereoCopy`. */
export function readAudio(input, name = 'audio') {
  assert(input && typeof input === 'object', 'SOUND_DATA', `${name} must be decoded PCM with channels and a rate.`);
  const rate = studioRate(field(input, 'sampleRate'));
  const channels = field(input, 'channels');
  assert(
    Array.isArray(channels) && channels.length >= 1 && channels.length <= 2,
    'AUDIO_CHANNELS',
    `${name} needs one or two channels.`,
  );
  const sources = [0, 1].slice(0, channels.length).map((index) => field(channels, index));
  for (const source of sources) {
    const prototype = source && Object.getPrototypeOf(source);
    assert(
      prototype === Float32Array.prototype || prototype === Float64Array.prototype,
      'SOUND_DATA',
      `${name} channels must be Float32Array or Float64Array.`,
    );
    assert(
      source.length > 0 && source.length === sources[0].length,
      'AUDIO_CHANNELS',
      `${name} channels need equal nonzero lengths.`,
    );
  }
  assert(
    sources[0].length <= STUDIO_LIMITS.seconds * rate,
    'RESOURCE_LIMIT',
    `${name} exceeds the ${STUDIO_LIMITS.seconds}-second studio limit.`,
  );
  return { channels: sources, rate };
}

/** Copy caller PCM into a mutable stereo working buffer, optionally with silent frames appended. */
export function stereoCopy(input, extraFrames = 0, name = 'audio') {
  const { channels, rate } = readAudio(input, name);
  const frames = channels[0].length + extraFrames;
  assert(frames <= STUDIO_LIMITS.seconds * rate, 'RESOURCE_LIMIT', `${name} with its tail exceeds the studio limit.`);
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  left.set(channels[0]);
  right.set(channels[channels.length - 1]);
  for (let i = 0; i < channels[0].length; i++) {
    assert(Number.isFinite(left[i]) && Number.isFinite(right[i]), 'SOUND_DATA', `${name} contains a nonfinite sample.`);
  }
  return { left, right, rate };
}

export function audioResult(left, right, rate, extra = {}) {
  return Object.freeze({
    sampleRate: rate,
    channels: Object.freeze([left, right]),
    duration: left.length / rate,
    ...extra,
  });
}

/** Deterministic generator shared by instruments and effects. The same seed gives the same stream. */
export function seeded(seed = 1) {
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** A control value that is either one number or breakpoints in seconds, sampled per frame with linear ramps. */
export function controlCurve(value, frames, rate, name, min, max) {
  if (typeof value === 'number') return { constant: number(value, name, min, max), at: null };
  assert(
    Array.isArray(value) && value.length >= 1 && value.length <= 4096,
    'SOUND_AUTOMATION',
    `${name} must be a number or 1–4096 automation points.`,
  );
  const points = value.map((point) => {
    assert(point && typeof point === 'object', 'SOUND_AUTOMATION', `${name} automation points need time and value.`);
    return [number(point.time, `${name} time`, 0, STUDIO_LIMITS.seconds), number(point.value, name, min, max)];
  });
  for (let i = 1; i < points.length; i++) {
    assert(points[i][0] >= points[i - 1][0], 'SOUND_AUTOMATION', `${name} automation times must not decrease.`);
  }
  const curve = new Float32Array(frames);
  let index = 0;
  for (let i = 0; i < frames; i++) {
    const time = i / rate;
    while (index + 1 < points.length && points[index + 1][0] <= time) index++;
    const [t0, v0] = points[index],
      next = points[index + 1];
    curve[i] = !next || time <= t0 ? v0 : v0 + ((v1(next) - v0) * (time - t0)) / Math.max(1e-9, next[0] - t0);
  }
  return { constant: null, at: curve };
}
const v1 = (point) => point[1];
