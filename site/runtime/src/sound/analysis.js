import { assert, number, options, safeCopy } from '../core/validate.js';
import { capturePCM } from './pcm.js';
function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length,
      wr = Math.cos(angle),
      wi = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let ur = 1,
        ui = 0;
      for (let k = 0; k < length / 2; k++) {
        const a = start + k,
          b = a + length / 2,
          tr = ur * real[b] - ui * imag[b],
          ti = ur * imag[b] + ui * real[b];
        real[b] = real[a] - tr;
        imag[b] = imag[a] - ti;
        real[a] += tr;
        imag[a] += ti;
        const next = ur * wr - ui * wi;
        ui = ur * wi + ui * wr;
        ur = next;
      }
    }
  }
}
/** Precomputed RMS/peak and Hann-windowed band energy, sampled by explicit scene time. */
export function analyzeSound(input, spec = {}) {
  options(spec, ['fftSize', 'hop', 'bands', 'channel'], 'sound analysis');
  const pcm = capturePCM(input),
    size = number(spec.fftSize ?? 1024, 'FFT size', 128, 4096),
    hop = number(spec.hop ?? 0.02, 'analysis hop', 0.002, 1),
    channel = spec.channel ?? 'mono';
  assert(Number.isInteger(size) && !(size & (size - 1)), 'SOUND_ANALYSIS', 'FFT size must be a power of two.');
  assert(['mono', 'left', 'right'].includes(channel), 'SOUND_ANALYSIS', 'Use mono, left or right analysis.');
  const ranges = safeCopy(
    spec.bands ?? [
      [40, 180],
      [180, 2000],
      [2000, Math.min(12000, pcm.sampleRate / 2)],
    ],
  );
  assert(Array.isArray(ranges) && ranges.length <= 16, 'RESOURCE_LIMIT', 'Use at most 16 frequency bands.');
  for (const b of ranges) {
    assert(Array.isArray(b) && b.length === 2, 'SOUND_ANALYSIS', 'Each band is [lowHz,highHz].');
    number(b[0], 'band low', 0, pcm.sampleRate / 2);
    number(b[1], 'band high', b[0] + Number.EPSILON, pcm.sampleRate / 2);
    assert(b[1] > b[0], 'SOUND_ANALYSIS', 'Bands need positive width.');
  }
  const step = Math.max(1, Math.round(hop * pcm.sampleRate)),
    count = Math.ceil(pcm.channels[0].length / step);
  assert(
    count * size * Math.log2(size) <= 32000000,
    'RESOURCE_LIMIT',
    'Offline spectral analysis exceeds its work budget; increase hop or shorten the clip.',
  );
  const window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))),
    sumWindowSquared = window.reduce((n, v) => n + v * v, 0),
    real = new Float64Array(size),
    imag = new Float64Array(size),
    frames = [];
  const read = (i) => {
    if (i < 0 || i >= pcm.channels[0].length) return 0;
    const left = pcm.channels[0][i],
      right = pcm.channels[1]?.[i] ?? left;
    return channel === 'left' ? left : channel === 'right' ? right : (left + right) / 2;
  };
  for (let frame = 0; frame < count; frame++) {
    let sum = 0,
      peak = 0;
    for (let i = 0; i < size; i++) {
      const value = read(frame * step + i - size / 2);
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
      real[i] = value * window[i];
      imag[i] = 0;
    }
    fft(real, imag);
    const bands = ranges.map(([low, high]) => {
      let energy = 0;
      for (
        let k = Math.ceil((low * size) / pcm.sampleRate);
        k <= Math.min(size / 2, high === pcm.sampleRate / 2 ? size / 2 : Math.ceil((high * size) / pcm.sampleRate) - 1);
        k++
      )
        energy += (real[k] * real[k] + imag[k] * imag[k]) * (k === 0 || k === size / 2 ? 1 : 2);
      return Math.sqrt(energy / (size * sumWindowSquared));
    });
    frames.push(
      Object.freeze({
        time: (frame * step) / pcm.sampleRate,
        rms: Math.sqrt(sum / size),
        peak,
        bands: Object.freeze(bands),
      }),
    );
  }
  const zero = Object.freeze({ rms: 0, peak: 0, bands: Object.freeze(ranges.map(() => 0)) });
  return Object.freeze({
    duration: pcm.duration,
    hop: step / pcm.sampleRate,
    fftSize: size,
    bandRanges: ranges,
    frames: Object.freeze(frames),
    sample(time) {
      number(time, 'sound analysis time', 0, 86400);
      if (time >= pcm.duration) return zero;
      const position = (time * pcm.sampleRate) / step,
        i = Math.min(frames.length - 1, Math.floor(position)),
        a = frames[i],
        b = frames[Math.min(i + 1, frames.length - 1)],
        u = position - i;
      return Object.freeze({
        rms: a.rms + (b.rms - a.rms) * u,
        peak: a.peak + (b.peak - a.peak) * u,
        bands: Object.freeze(a.bands.map((v, k) => v + (b.bands[k] - v) * u)),
      });
    },
  });
}
