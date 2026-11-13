import { assert, number, safeCopy } from '../core/validate.js';

function values(input, label, maximum = 100000) {
  const source = ArrayBuffer.isView(input) ? Array.from(input) : safeCopy(input);
  assert(
    Array.isArray(source) && source.length > 0 && source.length <= maximum,
    'PROCEDURAL_DISTRIBUTION',
    `${label} needs 1–${maximum} numeric values.`,
  );
  return source.map((value) => number(value, label, -1e7, 1e7));
}
function fromSamples(input) {
  const samples = values(input, 'distribution sample').sort((a, b) => a - b);
  return Object.freeze({
    kind: 'empirical',
    count: samples.length,
    sample(u) {
      number(u, 'distribution quantile', 0, 1);
      return samples[Math.min(samples.length - 1, Math.floor(u * samples.length))];
    },
  });
}
function fromHistogram(inputBins, inputCounts) {
  const bins = values(inputBins, 'histogram edges', 4097),
    counts = values(inputCounts, 'histogram counts', 4096);
  assert(
    bins.length === counts.length + 1 && bins.every((v, i) => i === 0 || v > bins[i - 1]),
    'PROCEDURAL_DISTRIBUTION',
    'Histogram edges must increase, with one more edge than count.',
  );
  const cumulative = [];
  let total = 0;
  for (const count of counts) {
    assert(count >= 0, 'PROCEDURAL_DISTRIBUTION', 'Histogram counts must be nonnegative.');
    total += count;
    cumulative.push(total);
  }
  assert(total > 0, 'PROCEDURAL_DISTRIBUTION', 'Histogram needs a positive total count.');
  return Object.freeze({
    kind: 'histogram',
    count: total,
    sample(u) {
      number(u, 'distribution quantile', 0, 1);
      const target = u * total;
      let lo = 0,
        hi = counts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (target < cumulative[mid]) hi = mid;
        else lo = mid + 1;
      }
      if (u === 1) {
        while (lo > 0 && !counts[lo]) lo--;
        return bins[lo + 1];
      }
      const previous = lo ? cumulative[lo - 1] : 0;
      return bins[lo] + ((bins[lo + 1] - bins[lo]) * (target - previous)) / counts[lo];
    },
  });
}
function pick(weights, u) {
  const captured = safeCopy(weights);
  assert(
    captured && !Array.isArray(captured) && typeof captured === 'object',
    'PROCEDURAL_DISTRIBUTION',
    'Categorical weights need a plain record.',
  );
  const entries = Object.entries(captured);
  assert(entries.length > 0 && entries.length <= 256, 'PROCEDURAL_DISTRIBUTION', 'Use 1–256 categorical weights.');
  let total = 0;
  const positive = [];
  for (const [key, value] of entries) {
    const weight = number(value, 'categorical weight', 0, 1e7);
    total += weight;
    if (weight) positive.push([key, total]);
  }
  assert(total > 0, 'PROCEDURAL_DISTRIBUTION', 'Categorical weights need a positive total.');
  number(u, 'categorical quantile', 0, 1);
  return positive.find(([, cumulative]) => u * total < cumulative)?.[0] ?? positive.at(-1)[0];
}
/** Deterministic inverse-CDF samplers. Supply a point's seeded random channel as u. */
export const distribution = Object.freeze({ fromSamples, fromHistogram, pick });
