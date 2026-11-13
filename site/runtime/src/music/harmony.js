// Harmony analysis: tuning, chroma, chords and key.
//
// - Chroma folds a semitone spectrogram into twelve pitch classes after
//   estimating the recording's tuning from spectral peaks (Müller,
//   Fundamentals of Music Processing, 2nd ed., 2021, ch. 3 and 5).
// - Chords are template scores smoothed by a Viterbi pass over beats, the
//   classic template-plus-HMM design (Fujishima 1999; Bello and Pickens 2005;
//   Mauch 2010). Changes are cheaper on strong beats, because harmony usually
//   changes there.
// - Key correlates pitch-class weight with the Krumhansl–Kessler profiles
//   (Krumhansl 1990).

import { fft, hann, hzToMidi, midiToHz } from './dsp.js';

export const PITCH_NAMES = Object.freeze(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
const LOW_MIDI = 28,
  HIGH_MIDI = 96,
  BASS_HIGH = 54,
  TREBLE_LOW = 48;

/** Chord qualities: interval sets above the root, with display suffixes. */
export const CHORD_QUALITIES = Object.freeze({
  maj: Object.freeze({ intervals: [0, 4, 7], suffix: '' }),
  min: Object.freeze({ intervals: [0, 3, 7], suffix: 'm' }),
  7: Object.freeze({ intervals: [0, 4, 7, 10], suffix: '7' }),
  maj7: Object.freeze({ intervals: [0, 4, 7, 11], suffix: 'maj7' }),
  min7: Object.freeze({ intervals: [0, 3, 7, 10], suffix: 'm7' }),
  dim: Object.freeze({ intervals: [0, 3, 6], suffix: 'dim' }),
  sus4: Object.freeze({ intervals: [0, 5, 7], suffix: 'sus4' }),
});
export const CHORD_VOCABULARIES = Object.freeze({
  triads: Object.freeze(['maj', 'min']),
  sevenths: Object.freeze(['maj', 'min', '7', 'maj7', 'min7', 'dim', 'sus4']),
});

/**
 * Pitch spectrogram at a second, coarser hop. The signal is decimated by two
 * again first, so a 4096-point window gives about 2.7 Hz bins, enough to
 * separate semitones down to roughly E1.
 */
export function pitchFeatures(signal, rate, hopSeconds = 0.08) {
  const half = Math.floor(signal.length / 2),
    reduced = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    // A short half-band filter (1/4, 1/2, 1/4) before dropping every other sample.
    const a = signal[2 * i - 1] ?? 0,
      b = signal[2 * i],
      c = signal[2 * i + 1] ?? 0;
    reduced[i] = 0.25 * a + 0.5 * b + 0.25 * c;
  }
  const r = rate / 2,
    size = 4096,
    hop = Math.max(1, Math.round(hopSeconds * r)),
    count = Math.ceil(reduced.length / hop),
    window = hann(size),
    real = new Float64Array(size),
    imag = new Float64Array(size),
    bins = size / 2 + 1,
    binHz = r / size;
  const spectrum = (frame) => {
    const centre = frame * hop;
    for (let i = 0; i < size; i++) {
      const index = centre - size / 2 + i;
      real[i] = index >= 0 && index < reduced.length ? reduced[index] * window[i] : 0;
      imag[i] = 0;
    }
    fft(real, imag);
    const magnitude = new Float64Array(bins);
    for (let k = 0; k < bins; k++) magnitude[k] = Math.hypot(real[k], imag[k]);
    return magnitude;
  };
  // Tuning: the magnitude-weighted circular mean of peak deviations from equal temperament.
  let sx = 0,
    sy = 0;
  const stride = Math.max(1, Math.floor(count / 200));
  for (let frame = 0; frame < count; frame += stride) {
    const m = spectrum(frame);
    for (let k = 2; k < bins - 1; k++) {
      const hz = k * binHz;
      if (hz < 80 || hz > 2000 || m[k] <= m[k - 1] || m[k] <= m[k + 1]) continue;
      const denominator = m[k - 1] - 2 * m[k] + m[k + 1],
        shift = denominator < 0 ? (0.5 * (m[k - 1] - m[k + 1])) / denominator : 0,
        midi = hzToMidi((k + shift) * binHz),
        angle = 2 * Math.PI * (midi - Math.round(midi));
      sx += m[k] * Math.cos(angle);
      sy += m[k] * Math.sin(angle);
    }
  }
  const tuning = sx || sy ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;
  // Semitone filters: a raised-cosine weight one semitone wide around each pitch.
  const semitones = HIGH_MIDI - LOW_MIDI + 1,
    filters = [];
  for (let s = 0; s < semitones; s++) {
    const midi = LOW_MIDI + s,
      lo = Math.max(1, Math.floor(midiToHz(midi - 1, tuning) / binHz)),
      hi = Math.min(bins - 1, Math.ceil(midiToHz(midi + 1, tuning) / binHz)),
      weights = [];
    for (let k = lo; k <= hi; k++) {
      const distance = Math.abs(hzToMidi(k * binHz) - (midi + tuning));
      weights.push(distance < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * distance) : 0);
    }
    const area = weights.reduce((n, w) => n + w, 0) || 1;
    filters.push({ lo, weights: Float64Array.from(weights, (w) => w / area) });
  }
  const pitch = new Float32Array(count * semitones);
  for (let frame = 0; frame < count; frame++) {
    const m = spectrum(frame);
    for (let s = 0; s < semitones; s++) {
      const { lo, weights } = filters[s];
      let sum = 0;
      for (let k = 0; k < weights.length; k++) sum += weights[k] * m[lo + k];
      pitch[frame * semitones + s] = sum;
    }
  }
  return { pitch, semitones, count, step: hop / r, tuning: tuning * 100 };
}

/**
 * Treble and bass chroma for each span of [start, end) seconds. The semitone
 * magnitudes are averaged over the span, then whitened: a local mean over
 * about an octave is subtracted and only the peaks above it are kept, which
 * removes the broadband energy of drums and noise (after Mauch's NNLS chroma,
 * 2010).
 */
export function chromaOver(features, spans) {
  const { pitch, semitones, count, step } = features,
    treble = new Float32Array(spans.length * 12),
    bass = new Float32Array(spans.length * 12),
    energy = new Float32Array(spans.length),
    average = new Float64Array(semitones);
  spans.forEach(([start, end], index) => {
    const a = Math.max(0, Math.min(count - 1, Math.round(start / step))),
      b = Math.max(a + 1, Math.min(count, Math.round(end / step)));
    average.fill(0);
    for (let frame = a; frame < b; frame++)
      for (let s = 0; s < semitones; s++) average[s] += pitch[frame * semitones + s] / (b - a);
    let total = 0;
    for (let s = 0; s < semitones; s++) {
      let floor = 0,
        n = 0;
      for (let k = Math.max(0, s - 6); k <= Math.min(semitones - 1, s + 6); k++) {
        floor += average[k];
        n++;
      }
      const peak = Math.max(0, average[s] - floor / n),
        midi = LOW_MIDI + s,
        pc = midi % 12;
      total += average[s];
      if (midi >= TREBLE_LOW) treble[index * 12 + pc] += peak;
      if (midi <= BASS_HIGH) bass[index * 12 + pc] += peak * (midi <= 40 ? 1 : (BASS_HIGH - midi) / (BASS_HIGH - 40));
    }
    energy[index] = total / semitones;
    for (const target of [treble, bass]) {
      let top = 0;
      for (let pc = 0; pc < 12; pc++) top = Math.max(top, target[index * 12 + pc]);
      if (top > 0) for (let pc = 0; pc < 12; pc++) target[index * 12 + pc] = Math.sqrt(target[index * 12 + pc] / top);
    }
  });
  return { treble, bass, energy };
}

function templates(vocabulary) {
  const list = [];
  for (const quality of CHORD_VOCABULARIES[vocabulary])
    for (let root = 0; root < 12; root++) {
      const vector = new Float64Array(12);
      for (const interval of CHORD_QUALITIES[quality].intervals)
        vector[(root + interval) % 12] = interval === 0 ? 1 : 0.85;
      const norm = Math.hypot(...vector);
      list.push({
        root,
        quality,
        vector: vector.map((v) => v / norm),
        size: CHORD_QUALITIES[quality].intervals.length,
      });
    }
  return list;
}

export function chordName(root, quality) {
  return root < 0 ? 'N' : PITCH_NAMES[root] + CHORD_QUALITIES[quality].suffix;
}

/**
 * Label each beat with a chord. `strength[b]` is how likely beat `b` starts a
 * harmonic change (high on downbeats). Returns per-beat chord indices into the
 * returned `chords` array, where index 0 is "no chord".
 */
export function labelChords(chroma, strength, vocabulary = 'triads') {
  const list = templates(vocabulary),
    n = strength.length,
    states = list.length + 1,
    sharpness = 14,
    loudest = Math.max(1e-9, ...chroma.energy),
    emission = Array.from({ length: n }, () => new Float64Array(states));
  for (let b = 0; b < n; b++) {
    const frame = emission[b],
      quiet = chroma.energy[b] / loudest < 0.08;
    let treblePeak = 0;
    for (let pc = 0; pc < 12; pc++) treblePeak = Math.max(treblePeak, chroma.treble[b * 12 + pc]);
    for (let s = 0; s < list.length; s++) {
      const t = list[s];
      let dot = 0,
        norm = 0;
      for (let pc = 0; pc < 12; pc++) {
        const v = chroma.treble[b * 12 + pc];
        dot += v * t.vector[pc];
        norm += v * v;
      }
      const fit = norm ? dot / Math.sqrt(norm) : 0,
        bass = chroma.bass[b * 12 + t.root];
      // Larger chords fit noise more easily, so they pay a small complexity cost.
      frame[s + 1] = sharpness * (fit + 0.15 * bass - 0.03 * (t.size - 3));
    }
    frame[0] = sharpness * (quiet || treblePeak === 0 ? 1.2 : 0.35);
  }
  // Viterbi with a change cost that depends on the beat's position.
  let score = Float64Array.from(emission[0]);
  const back = Array.from({ length: n }, () => new Int16Array(states));
  for (let b = 1; b < n; b++) {
    const change = Math.log(Math.max(1e-4, 0.25 * strength[b])),
      stay = Math.log(1 - Math.max(1e-4, 0.25 * strength[b])),
      next = new Float64Array(states);
    let bestPrevious = 0;
    for (let s = 1; s < states; s++) if (score[s] > score[bestPrevious]) bestPrevious = s;
    for (let s = 0; s < states; s++) {
      const kept = score[s] + stay,
        moved = score[bestPrevious] + change;
      if (kept >= moved || bestPrevious === s) {
        next[s] = kept + emission[b][s];
        back[b][s] = s;
      } else {
        next[s] = moved + emission[b][s];
        back[b][s] = bestPrevious;
      }
    }
    score = next;
  }
  let state = 0;
  for (let s = 1; s < states; s++) if (score[s] > score[state]) state = s;
  const path = new Int16Array(n);
  for (let b = n - 1; b >= 0; b--) {
    path[b] = state;
    state = back[b][state];
  }
  // A per-beat confidence: softmax probability of the chosen label.
  const confidence = Float64Array.from({ length: n }, (_, b) => {
    const frame = emission[b],
      top = Math.max(...frame);
    let sum = 0;
    for (const v of frame) sum += Math.exp(v - top);
    return Math.exp(frame[path[b]] - top) / sum;
  });
  const chords = [{ root: -1, quality: null }, ...list.map(({ root, quality }) => ({ root, quality }))];
  return { path, chords, confidence };
}

// Krumhansl–Kessler probe-tone profiles, starting on the tonic.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a, b) {
  const ma = a.reduce((n, v) => n + v, 0) / 12,
    mb = b.reduce((n, v) => n + v, 0) / 12;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Best of 24 keys for a twelve-value pitch-class weight profile. */
export function estimateKey(profile) {
  const results = [];
  for (let tonic = 0; tonic < 12; tonic++)
    for (const [mode, shape] of [
      ['major', MAJOR],
      ['minor', MINOR],
    ]) {
      const rotated = Array.from({ length: 12 }, (_, i) => shape[(i - tonic + 12) % 12]);
      results.push({ tonic, mode, score: correlation(profile, rotated) });
    }
  results.sort((a, b) => b.score - a.score);
  const [best, second] = results;
  return {
    tonic: PITCH_NAMES[best.tonic],
    tonicIndex: best.tonic,
    mode: best.mode,
    name: `${PITCH_NAMES[best.tonic]} ${best.mode}`,
    correlation: best.score,
    confidence: Math.max(0, Math.min(1, (best.score - second.score) * 5 + Math.max(0, best.score) * 0.5)),
  };
}

const NUMERALS = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
/**
 * Roman numeral of a chord relative to a tonic, written against the major
 * scale of that tonic (so a minor key reads i, bIII, iv, v, bVI, bVII).
 * Minor and diminished chords use lower case.
 */
export function romanNumeral(root, quality, tonic) {
  if (root < 0) return 'N';
  const numeral = NUMERALS[(root - tonic + 12) % 12],
    lower = quality === 'min' || quality === 'min7' || quality === 'dim',
    text = lower ? numeral.replace(/[IV]+/, (m) => m.toLowerCase()) : numeral;
  const suffix = { maj: '', min: '', 7: '7', maj7: 'maj7', min7: '7', dim: '°', sus4: 'sus4' }[quality];
  return text + suffix;
}
