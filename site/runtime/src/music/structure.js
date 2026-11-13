// Structure: section boundaries from Foote's checkerboard novelty on a
// beat-synchronous self-similarity matrix (Foote, ICME 2000), with separate
// harmony and timbre views combined (Paulus, Müller and Klapuri, ISMIR 2010
// survey). Sections that sound alike share a letter.

import { cosine, mean } from './dsp.js';

// Calibrated on the test recordings: a repeating loop scored about 0.06 and
// real section changes 0.17 or more.
const MERGE_BELOW = 0.15;

/**
 * Novelty along the diagonal of the self-similarity matrix of `features`
 * (rows of `dimension` values). Only entries inside the kernel are computed,
 * so the cost is rows × (2·half)² rather than rows².
 */
export function novelty(features, rows, dimension, half) {
  const output = new Float64Array(rows),
    taper = Float64Array.from({ length: 2 * half }, (_, i) => {
      const x = (i - half + 0.5) / half;
      return Math.exp(-4 * x * x);
    });
  for (let centre = half; centre <= rows - half; centre++) {
    let sum = 0,
      weight = 0;
    for (let a = 0; a < 2 * half; a++)
      for (let b = a + 1; b < 2 * half; b++) {
        const i = centre - half + a,
          j = centre - half + b,
          sign = a < half === b < half ? 1 : -1,
          w = taper[a] * taper[b];
        sum += sign * w * cosine(features, features, i * dimension, j * dimension, dimension);
        weight += w;
      }
    output[centre] = Math.max(0, sum / weight);
  }
  return output;
}

/** Peaks of a novelty curve at least `gap` rows apart, strongest first. */
export function noveltyPeaks(curve, gap, minimum) {
  const candidates = [];
  for (let i = 1; i < curve.length - 1; i++)
    if (curve[i] >= curve[i - 1] && curve[i] >= curve[i + 1] && curve[i] > minimum) candidates.push(i);
  candidates.sort((a, b) => curve[b] - curve[a]);
  const chosen = [];
  for (const i of candidates) if (chosen.every((j) => Math.abs(i - j) >= gap)) chosen.push(i);
  return chosen;
}

/**
 * Split beats into sections. Returns boundary beat indices (always starting
 * with 0) and a letter for each section.
 */
export function segment(beatFeatures, beats, dimension, downbeat, beatsPerBar, extra = [], detail = beatFeatures) {
  const half = Math.max(2 * beatsPerBar, Math.min(8 * beatsPerBar, Math.max(4 * beatsPerBar, Math.floor(beats / 6)))),
    curve = beats > 2 * half ? novelty(beatFeatures, beats, dimension, half) : new Float64Array(beats),
    inside = Array.from(curve.subarray(half, Math.max(half + 1, beats - half))),
    spread = Math.sqrt(mean(inside.map((v) => (v - mean(inside)) ** 2))),
    threshold = Math.max(0.02, mean(inside) + 0.5 * spread),
    peaks = noveltyPeaks(curve, 4 * beatsPerBar, threshold);
  const snap = (b) => {
    for (let d = 0; d <= Math.ceil(beatsPerBar / 2); d++) {
      if (downbeat[b - d]) return b - d;
      if (downbeat[b + d]) return b + d;
    }
    return b;
  };
  // Boundaries from the caller (sudden intensity changes) are exact, so they
  // win over novelty peaks that fall within two bars of them.
  const fixed = new Set(extra.map(snap).filter((s) => s > beatsPerBar && s < beats - beatsPerBar)),
    chosen = [...fixed];
  for (const b of peaks.map(snap)) {
    if (b <= beatsPerBar || b >= beats - beatsPerBar) continue;
    if (chosen.every((c) => Math.abs(c - b) >= 2 * beatsPerBar)) chosen.push(b);
  }
  const sorted = chosen.sort((a, b) => a - b),
    boundaries = [0];
  for (const b of sorted) {
    const previous = boundaries[boundaries.length - 1];
    if (b - previous >= 2 * beatsPerBar) boundaries.push(b);
    else if (previous !== 0 && !fixed.has(previous) && (fixed.has(b) || curve[b] > curve[previous]))
      boundaries[boundaries.length - 1] = b;
  }
  // Merge neighbours that do not differ by more than their own beat-to-beat
  // variation: the squared difference of means per dimension, divided by the
  // pooled within-section variance (a Fisher separation score).
  const separation = (a, b, c) => {
    let score = 0;
    for (let d = 0; d < dimension; d++) {
      let ma = 0,
        mb = 0;
      for (let i = a; i < b; i++) ma += detail[i * dimension + d] / (b - a);
      for (let i = b; i < c; i++) mb += detail[i * dimension + d] / (c - b);
      let v = 0;
      for (let i = a; i < b; i++) v += (detail[i * dimension + d] - ma) ** 2;
      for (let i = b; i < c; i++) v += (detail[i * dimension + d] - mb) ** 2;
      score += (ma - mb) ** 2 / Math.max(1e-6, v / (c - a));
    }
    return score / dimension;
  };
  for (;;) {
    let weakest = -1,
      weakestScore = Infinity;
    for (let k = 1; k < boundaries.length; k++) {
      if (fixed.has(boundaries[k])) continue;
      const score = separation(boundaries[k - 1], boundaries[k], boundaries[k + 1] ?? beats);
      if (score < weakestScore) {
        weakestScore = score;
        weakest = k;
      }
    }
    if (weakest < 0 || weakestScore >= MERGE_BELOW) break;
    boundaries.splice(weakest, 1);
  }
  // Letters: greedy clustering of section mean features by cosine similarity.
  const means = boundaries.map((start, i) => {
    const end = boundaries[i + 1] ?? beats,
      vector = new Float64Array(dimension);
    for (let b = start; b < end; b++) for (let d = 0; d < dimension; d++) vector[d] += beatFeatures[b * dimension + d];
    return vector.map((v) => v / Math.max(1, end - start));
  });
  const letters = [],
    exemplars = [];
  for (const vector of means) {
    let best = -1,
      similarity = 0.9;
    exemplars.forEach((e, i) => {
      const s = cosine(vector, e);
      if (s > similarity) {
        similarity = s;
        best = i;
      }
    });
    if (best < 0) {
      exemplars.push(vector);
      best = exemplars.length - 1;
    }
    letters.push(best < 26 ? String.fromCharCode(65 + best) : `S${best}`);
  }
  return { boundaries, letters, novelty: curve, noveltyMean: mean(curve) };
}
