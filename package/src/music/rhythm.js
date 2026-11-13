// Rhythm analysis: an onset-strength envelope, onsets, tempo, beats and bars.
//
// - Onset strength follows SuperFlux (Böck and Widmer, DAFx 2013): positive
//   differences of a log-compressed, log-frequency spectrogram against a
//   maximum-filtered earlier frame, which suppresses vibrato.
// - Tempo comes from the autocorrelation of that envelope, averaged over
//   windows, enhanced at two and four times the lag, with a log-normal prior centred on
//   120 BPM (Ellis, JNMR 2007; Percival and Tzanetakis 2014).
// - Beats come from Ellis's dynamic-programming tracker with a period that may
//   drift slowly, taken from the windowed tempogram.
// - Bars come from a Viterbi pass over beats that rewards bass onsets and
//   harmonic change on the first beat of each bar (Goto 2001; Davies and
//   Plumbley 2006).

import {
  applyFilters,
  logFilterbank,
  mean,
  movingAverage,
  movingMax,
  percentile,
  spectra,
  standardDeviation,
} from './dsp.js';

const TIMBRE = 12;

/** Spectral features at about 100 frames per second. */
export function onsetFeatures(signal, rate) {
  const size = 2 ** Math.round(Math.log2(0.046 * rate)),
    hop = Math.max(1, Math.round(rate / 100)),
    fps = rate / hop,
    filters = logFilterbank(size, rate, 30, Math.min(16000, rate * 0.47), 12),
    bands = filters.length,
    count = Math.ceil(signal.length / hop),
    logBands = new Float32Array(count * bands),
    centroid = new Float32Array(count),
    bandEnergy = new Float32Array(count * 3),
    timbre = new Float32Array(count * TIMBRE),
    scratch = new Float64Array(bands),
    lowLimit = filters.findIndex((f) => f.hz > 200),
    midLimit = filters.findIndex((f) => f.hz > 2000),
    lowEnd = lowLimit < 0 ? bands : lowLimit,
    midEnd = midLimit < 0 ? bands : midLimit,
    dct = Array.from({ length: TIMBRE }, (_, c) =>
      Float64Array.from({ length: bands }, (__, b) => Math.cos((Math.PI * (c + 1) * (b + 0.5)) / bands)),
    ),
    binHz = rate / size;
  spectra(signal, size, hop, (frame, magnitude) => {
    applyFilters(filters, magnitude, scratch);
    let weighted = 0,
      total = 0;
    for (let k = 1; k < magnitude.length; k++) {
      weighted += k * binHz * magnitude[k];
      total += magnitude[k];
    }
    centroid[frame] = total > 1e-9 ? weighted / total : 0;
    let low = 0,
      mid = 0,
      high = 0;
    for (let b = 0; b < bands; b++) {
      const value = Math.log1p(scratch[b]);
      logBands[frame * bands + b] = value;
      if (b < lowEnd) low += scratch[b];
      else if (b < midEnd) mid += scratch[b];
      else high += scratch[b];
    }
    bandEnergy[frame * 3] = low;
    bandEnergy[frame * 3 + 1] = mid;
    bandEnergy[frame * 3 + 2] = high;
    for (let c = 0; c < TIMBRE; c++) {
      let sum = 0;
      for (let b = 0; b < bands; b++) sum += dct[c][b] * logBands[frame * bands + b];
      timbre[frame * TIMBRE + c] = sum;
    }
  });
  // SuperFlux: compare with a frequency-maximum-filtered frame two hops back.
  const lag = 2,
    envelope = new Float64Array(count),
    lowFlux = new Float64Array(count),
    midFlux = new Float64Array(count),
    highFlux = new Float64Array(count);
  for (let n = lag; n < count; n++) {
    let all = 0,
      low = 0,
      mid = 0,
      high = 0;
    for (let b = 0; b < bands; b++) {
      const previous = (n - lag) * bands,
        reference = Math.max(
          logBands[previous + b],
          b > 0 ? logBands[previous + b - 1] : 0,
          b < bands - 1 ? logBands[previous + b + 1] : 0,
        ),
        rise = logBands[n * bands + b] - reference;
      if (rise > 0) {
        all += rise;
        if (b < lowEnd) low += rise;
        else if (b < midEnd) mid += rise;
        else high += rise;
      }
    }
    envelope[n] = all;
    lowFlux[n] = low;
    midFlux[n] = mid;
    highFlux[n] = high;
  }
  return {
    fps,
    hop,
    size,
    count,
    envelope,
    lowFlux,
    midFlux,
    highFlux,
    centroid,
    bandEnergy,
    timbre,
    timbreSize: TIMBRE,
  };
}

/** Normalise an envelope so its 99th percentile is one. */
export function normalise(envelope) {
  const scale = percentile(envelope, 0.99) || 1;
  return Float64Array.from(envelope, (v) => Math.min(1.5, v / scale));
}

/**
 * Onsets by adaptive peak picking (Böck, Krebs and Schedl, ISMIR 2012): a
 * frame is an onset when it is the local maximum within ±30 ms, exceeds the
 * local mean over −100…+70 ms by `delta`, and is at least 30 ms after the
 * previous onset.
 */
export function pickOnsets(envelope, fps, delta = 0.08) {
  const near = Math.max(1, Math.round(0.03 * fps)),
    maxima = movingMax(envelope, near, near),
    before = Math.round(0.1 * fps),
    after = Math.round(0.07 * fps),
    prefix = new Float64Array(envelope.length + 1),
    onsets = [];
  for (let i = 0; i < envelope.length; i++) prefix[i + 1] = prefix[i] + envelope[i];
  let last = -Infinity;
  for (let i = 0; i < envelope.length; i++) {
    const a = Math.max(0, i - before),
      b = Math.min(envelope.length, i + after + 1),
      local = (prefix[b] - prefix[a]) / (b - a);
    if (envelope[i] === maxima[i] && envelope[i] >= local + delta && i - last > near) {
      onsets.push({ frame: i, strength: envelope[i] });
      last = i;
    }
  }
  return onsets;
}

function autocorrelation(values, from, to, maxLag, output) {
  const m = mean(values, from, to);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = from + lag; i < to; i++) sum += (values[i] - m) * (values[i - lag] - m);
    output[lag] = sum / (to - from);
  }
}

/**
 * Global tempo and a slowly varying local beat period. `range` bounds the
 * answer in BPM. A `hint` replaces the 120 BPM prior centre when the caller
 * knows the rough tempo.
 */
export function estimateTempo(envelope, fps, range = [60, 200], hint = 120) {
  const minLag = Math.max(2, Math.floor((60 * fps) / range[1])),
    maxLag = Math.ceil((60 * fps) / range[0]),
    span = Math.min(maxLag * 4, envelope.length - 1),
    window = Math.min(envelope.length, Math.round(8 * fps)),
    hop = Math.round(2 * fps),
    smoothed = movingAverage(envelope, 1),
    acf = new Float64Array(span + 1),
    sum = new Float64Array(span + 1),
    local = [];
  let windows = 0;
  for (let start = 0; start + window <= envelope.length || windows === 0; start += hop) {
    const end = Math.min(envelope.length, start + window);
    autocorrelation(smoothed, start, end, Math.min(span, end - start - 1), acf);
    const peak = acf[0] || 1;
    for (let lag = 0; lag <= span; lag++) sum[lag] += acf[lag] / peak;
    local.push({ centre: (start + end) / 2, acf: Float64Array.from(acf, (v) => v / peak) });
    windows++;
    if (end === envelope.length) break;
  }
  const score = (curve, lag) => {
    let total = 0;
    // Duple multiples only: a third harmonic would reward triplet levels.
    for (const k of [1, 2, 4]) {
      const at = lag * k;
      if (at > span) break;
      const i = Math.floor(at),
        f = at - i;
      total += ((1 - f) * curve[i] + f * curve[Math.min(span, i + 1)]) / k;
    }
    return total;
  };
  const prior = (lag) => Math.exp(-0.5 * (Math.log2((60 * fps) / lag / hint) / 0.9) ** 2),
    scores = [];
  for (let lag = minLag; lag <= maxLag; lag++)
    scores.push({ lag, value: score(sum, lag) / windows, weighted: (score(sum, lag) / windows) * prior(lag) });
  scores.sort((a, b) => b.weighted - a.weighted);
  const best = scores[0] ?? { lag: (60 * fps) / hint, value: 0 },
    // Parabolic refinement of the period on the enhanced curve.
    left = score(sum, best.lag - 1),
    middle = score(sum, best.lag),
    right = score(sum, best.lag + 1),
    denominator = left - 2 * middle + right,
    shift = denominator < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denominator)) : 0,
    period = best.lag + shift,
    values = scores.map((s) => s.value),
    spread = standardDeviation(values) || 1,
    confidence = Math.max(0, Math.min(1, (best.value - mean(values)) / (4 * spread))),
    candidates = [];
  for (const factor of [0.5, 2 / 3, 1, 1.5, 2]) {
    const lag = period * factor;
    if (lag >= 2 && lag <= span / 2) candidates.push({ bpm: (60 * fps) / lag, score: score(sum, lag) / windows });
  }
  const top = Math.max(...candidates.map((c) => c.score), 1e-9);
  // Local period: the best lag within ±8 % of the global period in each window.
  const periods = local.map(({ centre, acf: curve }) => {
    let bestLag = period,
      bestValue = -Infinity;
    for (let lag = period * 0.92; lag <= period * 1.08; lag += 0.25) {
      const v = score(curve, lag);
      if (v > bestValue) {
        bestValue = v;
        bestLag = lag;
      }
    }
    return { frame: centre, period: bestLag };
  });
  const median = periods.map((p, i) => {
    const neighbourhood = periods
      .slice(Math.max(0, i - 2), i + 3)
      .map((q) => q.period)
      .sort((a, b) => a - b);
    return { frame: p.frame, period: neighbourhood[neighbourhood.length >> 1] };
  });
  return {
    bpm: (60 * fps) / period,
    period,
    confidence,
    candidates: candidates.map((c) => ({ bpm: c.bpm, score: c.score / top })).sort((a, b) => b.score - a.score),
    local: median,
  };
}

function periodAt(local, frame, fallback) {
  if (!local.length) return fallback;
  if (frame <= local[0].frame) return local[0].period;
  for (let i = 1; i < local.length; i++)
    if (frame <= local[i].frame) {
      const a = local[i - 1],
        b = local[i],
        t = (frame - a.frame) / (b.frame - a.frame);
      return a.period + (b.period - a.period) * t;
    }
  return local[local.length - 1].period;
}

/**
 * Ellis's dynamic-programming beat tracker. Each frame's score is its local
 * onset strength plus the best earlier score, penalised by how far the gap
 * departs from the expected period on a log scale.
 */
export function trackBeats(envelope, fps, tempo, tightness = 100) {
  const count = envelope.length,
    deviation = standardDeviation(envelope) || 1,
    local = new Float64Array(count),
    cumulative = new Float64Array(count),
    back = new Int32Array(count).fill(-1);
  // Smooth with a Gaussian a thirty-second of a period wide.
  const width = Math.max(1, Math.round(tempo.period / 32)),
    kernel = Float64Array.from({ length: 4 * width + 1 }, (_, i) => Math.exp(-0.5 * ((i - 2 * width) / width) ** 2));
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - 2 * width;
      if (j >= 0 && j < count) sum += kernel[k] * envelope[j];
    }
    local[i] = sum / deviation;
  }
  for (let i = 0; i < count; i++) {
    const period = periodAt(tempo.local, i, tempo.period),
      from = Math.max(0, Math.round(i - 2 * period)),
      to = Math.round(i - period / 2);
    let best = -Infinity,
      bestIndex = -1;
    for (let j = from; j <= to; j++) {
      const v = cumulative[j] - tightness * Math.log((i - j) / period) ** 2;
      if (v > best) {
        best = v;
        bestIndex = j;
      }
    }
    cumulative[i] = local[i] + (bestIndex >= 0 ? Math.max(0, best) : 0);
    back[i] = bestIndex >= 0 && best > 0 ? bestIndex : -1;
  }
  // Start the backtrace from the last strong local maximum of the cumulative score.
  const maxima = [];
  for (let i = 1; i < count - 1; i++)
    if (cumulative[i] >= cumulative[i - 1] && cumulative[i] > cumulative[i + 1]) maxima.push(i);
  const threshold =
    0.5 *
    percentile(
      maxima.map((i) => cumulative[i]),
      0.5,
    );
  let index = maxima.filter((i) => cumulative[i] >= threshold).pop() ?? count - 1;
  const beats = [];
  while (index >= 0) {
    beats.push(index);
    index = back[index];
  }
  beats.reverse();
  // Trim weak beats at the edges, where the tracker extrapolates through silence.
  const strength = beats.map((b) => local[b]),
    floor = 0.5 * Math.sqrt(mean(strength.map((v) => v * v)));
  let first = 0,
    last = beats.length - 1;
  while (first < last && strength[first] <= floor) first++;
  while (last > first && strength[last] <= floor) last--;
  return beats.slice(first, last + 1);
}

/**
 * Assign each beat a position in its bar. Downbeat evidence is a standardised
 * per-beat score; the Viterbi path advances one position per beat and pays a
 * penalty to restart a bar early or late.
 */
export function trackBars(evidence, beatsPerBar, restart = 0.01) {
  const n = evidence.length,
    states = beatsPerBar,
    advance = Math.log(1 - restart),
    jump = Math.log(restart / Math.max(1, states - 1)),
    score = new Float64Array(states),
    next = new Float64Array(states),
    back = Array.from({ length: n }, () => new Int8Array(states));
  const emit = (b, s) => (s === 0 ? 2 * evidence[b] : (-2 * evidence[b]) / (states - 1));
  for (let s = 0; s < states; s++) score[s] = emit(0, s);
  for (let b = 1; b < n; b++) {
    for (let s = 0; s < states; s++) {
      let best = -Infinity,
        from = 0;
      for (let p = 0; p < states; p++) {
        const v = score[p] + ((p + 1) % states === s ? advance : jump);
        if (v > best) {
          best = v;
          from = p;
        }
      }
      next[s] = best + emit(b, s);
      back[b][s] = from;
    }
    score.set(next);
  }
  let state = 0;
  for (let s = 1; s < states; s++) if (score[s] > score[state]) state = s;
  const positions = new Int8Array(n);
  for (let b = n - 1; b >= 0; b--) {
    positions[b] = state;
    state = back[b][state];
  }
  return positions;
}

/** Choose 3 or 4 beats per bar by how strongly one beat phase stands out. */
export function chooseMeter(evidence) {
  const contrast = (m) => {
    let best = -Infinity;
    for (let phase = 0; phase < m; phase++) {
      const on = [],
        off = [];
      evidence.forEach((v, i) => ((i - phase) % m === 0 ? on : off).push(v));
      best = Math.max(best, mean(on) - mean(off));
    }
    return best;
  };
  const four = contrast(4),
    three = contrast(3) * 0.85;
  return { beatsPerBar: three > four ? 3 : 4, contrast: Math.max(three, four) };
}
