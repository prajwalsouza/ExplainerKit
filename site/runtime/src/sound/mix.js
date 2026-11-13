import { assert, number, options, text } from '../core/validate.js';

const MAX_SAMPLES = 32_000_000;
function denseValues(input) {
  assert(
    Array.isArray(input) && Reflect.ownKeys(input).length === input.length + 1,
    'AUDIO_DATA',
    'Audio arrays must be dense indexed data.',
  );
  return Array.from({ length: input.length }, (_, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, i);
    assert(descriptor && 'value' in descriptor, 'AUDIO_DATA', 'Audio arrays cannot contain holes or accessors.');
    return descriptor.value;
  });
}
function channel(input) {
  assert(
    Array.isArray(input) || input instanceof Float32Array || input instanceof Float64Array,
    'AUDIO_DATA',
    'Supply decoded PCM channel arrays.',
  );
  assert(
    input.length > 0 && input.length <= MAX_SAMPLES,
    'RESOURCE_LIMIT',
    'PCM channels must contain 1–32 million samples.',
  );
  const values = Array.isArray(input) ? denseValues(input) : input;
  const result = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) result[i] = number(values[i], 'PCM amplitude', -100, 100);
  return result;
}
const smooth = (t) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

/** Captured decoded PCM, explicit timeline offsets and pure time-addressed mixing. */
export function createAudioMix(input, spec = {}) {
  options(spec, ['duckGain', 'attack', 'release', 'threshold'], 'audio mix');
  assert(
    Array.isArray(input) && input.length > 0 && input.length <= 32,
    'RESOURCE_LIMIT',
    'Mix 1–32 decoded audio tracks.',
  );
  const duckGain = number(spec.duckGain ?? 0.25, 'duck gain', 0, 1);
  const attack = number(spec.attack ?? 0.05, 'duck attack', 0.001, 10),
    release = number(spec.release ?? 0.2, 'duck release', 0.001, 10);
  const threshold = number(spec.threshold ?? 0.01, 'narration threshold', 0, 1);
  const ids = new Set();
  let total = 0;
  const tracks = denseValues(input).map((track) => {
    options(track, ['id', 'channels', 'sampleRate', 'start', 'gain', 'role'], 'audio track');
    const id = text(track.id, 'track ID', 200);
    assert(id && !ids.has(id), 'DUPLICATE_ID', 'Audio tracks need unique nonempty IDs.');
    ids.add(id);
    const sampleRate = number(track.sampleRate, 'sample rate', 8000, 192000);
    assert(Number.isInteger(sampleRate), 'AUDIO_RATE', 'Sample rate must be whole Hz.');
    assert(
      Array.isArray(track.channels) && track.channels.length >= 1 && track.channels.length <= 2,
      'AUDIO_CHANNELS',
      'Supply mono or stereo decoded channels.',
    );
    const sources = denseValues(track.channels);
    for (const source of sources) {
      total += source?.length ?? MAX_SAMPLES + 1;
      assert(total <= MAX_SAMPLES, 'RESOURCE_LIMIT', 'Total captured PCM exceeds 32 million samples.');
    }
    const channels = sources.map(channel);
    assert(
      channels.every((c) => c.length === channels[0].length),
      'AUDIO_CHANNELS',
      'All channels of a track need equal lengths.',
    );
    const start = number(track.start ?? 0, 'audio start', 0, 86400),
      gain = number(track.gain ?? 1, 'track gain', 0, 16);
    const role = track.role ?? 'effect';
    assert(['narration', 'music', 'effect'].includes(role), 'AUDIO_ROLE', 'Use narration, music or effect.');
    return { id, channels, sampleRate, start, gain, role, duration: channels[0].length / sampleRate };
  });
  const windows = [];
  // Fixed 10ms peak blocks are an explicit deterministic heuristic, not phoneme analysis.
  for (const track of tracks.filter((t) => t.role === 'narration')) {
    const block = Math.max(1, Math.round(track.sampleRate * 0.01));
    for (let i = 0; i < track.channels[0].length; i += block) {
      let peak = 0;
      for (const c of track.channels)
        for (let j = i; j < Math.min(i + block, c.length); j++) peak = Math.max(peak, Math.abs(c[j] * track.gain));
      if (peak > threshold)
        windows.push([
          track.start + i / track.sampleRate,
          track.start + Math.min(i + block, track.channels[0].length) / track.sampleRate,
        ]);
    }
  }
  windows.sort((a, b) => a[0] - b[0]);
  const intervals = [];
  for (const window of windows) {
    const previous = intervals.at(-1);
    if (previous && window[0] <= previous[1] + 1e-9) previous[1] = Math.max(previous[1], window[1]);
    else intervals.push([...window]);
  }
  function narrationEnvelope(time) {
    // The latest past interval dominates release; the earliest future one
    // dominates anticipation. Checking these two is independent of clip length.
    let lo = 0,
      hi = intervals.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (intervals[mid][0] <= time) lo = mid + 1;
      else hi = mid;
    }
    let weight = 0;
    // Also consider the previous release if the new interval is only anticipating.
    for (let i = Math.max(0, lo - 1); i < Math.min(intervals.length, lo + 1); i++) {
      const [start, end] = intervals[i];
      weight = Math.max(
        weight,
        time < start ? smooth((time - start + attack) / attack) : time <= end ? 1 : 1 - smooth((time - end) / release),
      );
    }
    return weight;
  }
  function sample(time) {
    number(time, 'audio time', 0, 86400);
    const output = [0, 0],
      duck = 1 - (1 - duckGain) * narrationEnvelope(time);
    for (const track of tracks) {
      const position = (time - track.start) * track.sampleRate;
      if (position < 0 || position >= track.channels[0].length) continue;
      const index = Math.floor(position),
        fraction = position - index,
        gain = track.gain * (track.role === 'music' ? duck : 1);
      for (let c = 0; c < 2; c++) {
        const data = track.channels[Math.min(c, track.channels.length - 1)];
        output[c] += (data[index] + ((data[index + 1] ?? 0) - data[index]) * fraction) * gain;
      }
    }
    return Object.freeze(output);
  }
  const duration = Math.max(...tracks.map((t) => t.start + t.duration));
  assert(duration <= 86400, 'AUDIO_DURATION', 'Audio timeline exceeds one day.');
  return Object.freeze({
    duration,
    tracks: Object.freeze(
      tracks.map(({ id, sampleRate, start, gain, role, duration: length }) =>
        Object.freeze({ id, sampleRate, start, gain, role, duration: length }),
      ),
    ),
    sample,
    render({ from = 0, duration: length = duration - from, sampleRate = 48000 } = {}) {
      number(from, 'audio render start', 0, 86400);
      number(length, 'audio render duration', Number.MIN_VALUE, 86400);
      number(sampleRate, 'output sample rate', 8000, 192000);
      assert(Number.isInteger(sampleRate), 'AUDIO_RATE', 'Sample rate must be whole Hz.');
      assert(from + length <= 86400, 'AUDIO_DURATION', 'Audio render exceeds one day.');
      const count = Math.ceil(length * sampleRate);
      assert(
        count * tracks.length <= 16_000_000 && count * 2 <= MAX_SAMPLES,
        'RESOURCE_LIMIT',
        'Audio render work exceeds this call budget; render bounded contiguous segments.',
      );
      const channels = [new Float32Array(count), new Float32Array(count)];
      let clippedSamples = 0;
      for (let i = 0; i < count; i++) {
        const value = sample(from + i / sampleRate);
        for (let c = 0; c < 2; c++) {
          channels[c][i] = value[c];
          if (Math.abs(value[c]) > 1) clippedSamples++;
        }
      }
      return Object.freeze({ sampleRate, channels: Object.freeze(channels), clippedSamples });
    },
  });
}

/** PCM16 RIFF/WAVE output. Saturates out-of-range samples; render reports clipping separately. */
/** @param {{sampleRate:number,channels:readonly (Float32Array|Float64Array|readonly number[])[],clippedSamples?:number,duration?:number,metadata?:unknown}} input */
export function encodeWav(input) {
  options(input, ['sampleRate', 'channels', 'clippedSamples', 'duration', 'metadata'], 'WAV input');
  const sampleRate = number(input.sampleRate, 'WAV sample rate', 8000, 192000);
  assert(Number.isInteger(sampleRate), 'AUDIO_RATE', 'Sample rate must be whole Hz.');
  assert(
    Array.isArray(input.channels) && input.channels.length >= 1 && input.channels.length <= 2,
    'AUDIO_CHANNELS',
    'Encode one or two PCM channels.',
  );
  const sources = denseValues(input.channels);
  let total = 0;
  for (const source of sources) {
    assert(
      Array.isArray(source) || source instanceof Float32Array || source instanceof Float64Array,
      'AUDIO_DATA',
      'Supply decoded PCM arrays.',
    );
    total += source.length;
    assert(total <= MAX_SAMPLES, 'RESOURCE_LIMIT', 'Total WAV channels exceed 32 million samples.');
  }
  const channels = sources.map(channel),
    count = channels[0].length,
    n = channels.length;
  assert(
    channels.every((c) => c.length === count) && count * n <= MAX_SAMPLES,
    'RESOURCE_LIMIT',
    'WAV channels need equal bounded lengths.',
  );
  const bytes = new Uint8Array(44 + count * n * 2),
    view = new DataView(bytes.buffer),
    label = (offset, value) => {
      for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
  label(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, n, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * n * 2, true);
  view.setUint16(32, n * 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, count * n * 2, true);
  for (let i = 0; i < count; i++)
    for (let c = 0; c < n; c++) {
      const value = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(44 + (i * n + c) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    }
  return bytes;
}
