// Shared signal-processing helpers for music analysis. Everything here is pure,
// synchronous and bounded by the callers that size its inputs.

const fftTables = new Map();
function tables(size) {
  let table = fftTables.get(size);
  if (table) return table;
  const reverse = new Uint32Array(size);
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    reverse[i] = j;
  }
  const cos = new Float64Array(size / 2),
    sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / size);
    sin[i] = Math.sin((-2 * Math.PI * i) / size);
  }
  table = { reverse, cos, sin };
  if (fftTables.size > 8) fftTables.clear();
  fftTables.set(size, table);
  return table;
}

/** In-place radix-2 complex FFT. The length must be a power of two. */
export function fft(real, imag) {
  const size = real.length,
    { reverse, cos, sin } = tables(size);
  for (let i = 1; i < size; i++) {
    const j = reverse[i];
    if (i < j) {
      let t = real[i];
      real[i] = real[j];
      real[j] = t;
      t = imag[i];
      imag[i] = imag[j];
      imag[j] = t;
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const half = length >> 1,
      stride = size / length;
    for (let start = 0; start < size; start += length) {
      for (let k = 0; k < half; k++) {
        const a = start + k,
          b = a + half,
          wr = cos[k * stride],
          wi = sin[k * stride],
          tr = wr * real[b] - wi * imag[b],
          ti = wr * imag[b] + wi * real[b];
        real[b] = real[a] - tr;
        imag[b] = imag[a] - ti;
        real[a] += tr;
        imag[a] += ti;
      }
    }
  }
}

export function hann(size) {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  return window;
}

/**
 * Short-time magnitude spectra of a mono signal. Frame `i` is centred on
 * sample `i * hop`; samples outside the signal read as zero. The callback
 * receives a reused magnitude buffer of `size / 2 + 1` bins.
 */
export function spectra(signal, size, hop, visit, stride = 1) {
  const window = hann(size),
    real = new Float64Array(size),
    imag = new Float64Array(size),
    magnitude = new Float64Array(size / 2 + 1),
    count = Math.ceil(signal.length / hop),
    half = size >> 1;
  for (let frame = 0; frame < count; frame += stride) {
    const centre = frame * hop;
    for (let i = 0; i < size; i++) {
      const index = centre - half + i;
      real[i] = index >= 0 && index < signal.length ? signal[index] * window[i] : 0;
      imag[i] = 0;
    }
    fft(real, imag);
    for (let k = 0; k <= half; k++) magnitude[k] = Math.hypot(real[k], imag[k]);
    visit(frame, magnitude);
  }
  return count;
}

export const midiToHz = (midi, tuning = 0) => 440 * 2 ** ((midi - 69 + tuning) / 12);
export const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);

/**
 * Triangular filters spaced logarithmically between two frequencies. Filters
 * that would cover the same FFT bins as a neighbour are merged, so low bands
 * never repeat one bin. Each filter is normalised to unit area.
 */
export function logFilterbank(size, rate, low, high, perOctave) {
  const binHz = rate / size,
    centres = [];
  for (let f = low; f <= high; f *= 2 ** (1 / perOctave)) {
    const bin = Math.round(f / binHz);
    if (bin >= 1 && bin < size / 2 && centres[centres.length - 1] !== bin) centres.push(bin);
  }
  const filters = [];
  for (let i = 1; i < centres.length - 1; i++) {
    const start = centres[i - 1],
      centre = centres[i],
      stop = centres[i + 1],
      weights = [];
    for (let k = start; k <= stop; k++) {
      const w = k <= centre ? (k - start + 1) / (centre - start + 1) : (stop - k + 1) / (stop - centre + 1);
      weights.push(w);
    }
    const area = weights.reduce((n, w) => n + w, 0);
    filters.push({ start, weights: Float64Array.from(weights, (w) => w / area), hz: centre * binHz });
  }
  return filters;
}

export function applyFilters(filters, magnitude, output, offset = 0) {
  for (let f = 0; f < filters.length; f++) {
    const { start, weights } = filters[f];
    let sum = 0;
    for (let k = 0; k < weights.length; k++) sum += weights[k] * magnitude[start + k];
    output[offset + f] = sum;
  }
}

export function movingAverage(values, radius) {
  const output = new Float64Array(values.length),
    prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) prefix[i + 1] = prefix[i] + values[i];
  for (let i = 0; i < values.length; i++) {
    const a = Math.max(0, i - radius),
      b = Math.min(values.length, i + radius + 1);
    output[i] = (prefix[b] - prefix[a]) / (b - a);
  }
  return output;
}

export function movingMax(values, before, after) {
  const output = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let m = -Infinity;
    for (let j = Math.max(0, i - before); j <= Math.min(values.length - 1, i + after); j++) m = Math.max(m, values[j]);
    output[i] = m;
  }
  return output;
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort(),
    index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p)),
    lo = Math.floor(index),
    hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function mean(values, from = 0, to = values.length) {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += values[i];
  return sum / (to - from);
}

export function standardDeviation(values) {
  const m = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - m) ** 2;
  return Math.sqrt(sum / Math.max(1, values.length));
}

/** Rescale so the 5th percentile maps to 0 and the 95th to 1, clamped. */
export function rank(values) {
  const lo = percentile(values, 0.05),
    hi = percentile(values, 0.95),
    span = hi - lo || 1;
  return Float64Array.from(values, (v) => Math.max(0, Math.min(1, (v - lo) / span)));
}

export function cosine(a, b, offsetA = 0, offsetB = 0, length = a.length) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < length; i++) {
    const x = a[offsetA + i],
      y = b[offsetB + i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Interpolate a series sampled every `step` seconds at an arbitrary time. */
export function sampleSeries(values, step, time) {
  if (!values.length) return 0;
  const x = Math.max(0, Math.min(values.length - 1, time / step)),
    i = Math.floor(x),
    j = Math.min(values.length - 1, i + 1);
  return values[i] + (values[j] - values[i]) * (x - i);
}

/** Index of the last value in a sorted array that is less than or equal to `x`, or -1. */
export function floorIndex(sorted, x) {
  let lo = 0,
    hi = sorted.length - 1,
    answer = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) {
      answer = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return answer;
}

export const round = (value, places = 3) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
