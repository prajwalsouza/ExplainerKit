import { assert, number, options } from '../core/validate.js';
import { MAX_MUSIC_SECONDS, analysisSignal, readMusicPCM } from './input.js';
import { measureLoudness } from './loudness.js';
import { chooseMeter, estimateTempo, normalise, onsetFeatures, pickOnsets, trackBars, trackBeats } from './rhythm.js';
import { chordName, chromaOver, estimateKey, labelChords, pitchFeatures, romanNumeral } from './harmony.js';
import { segment } from './structure.js';
import { cosine, mean, movingAverage, percentile, rank, round } from './dsp.js';
import { barTable, deriveEvents, findDrops } from './events.js';

export const MUSIC_ANALYSIS_VERSION = 1;

/**
 * Parse the plain-text beat files that beat trackers write: one beat per line,
 * a time in seconds, then optionally its position in the bar counted from 1
 * (1 is the downbeat). Returns beats for the `beats` option of analyzeMusic,
 * with positions counted from 0.
 */
export function beatsFromText(text) {
  assert(
    typeof text === 'string' && text.length <= 5_000_000,
    'MUSIC_ANALYSIS',
    'Give the beat file as text of at most 5 MB.',
  );
  const beats = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (!fields.length || fields[0].startsWith('#')) continue;
    const time = Number(fields[0]),
      position = fields[1] === undefined ? undefined : Number(fields[1]) - 1;
    assert(
      Number.isFinite(time) && (position === undefined || (Number.isInteger(position) && position >= 0)),
      'MUSIC_ANALYSIS',
      `Could not read the beat line "${line.slice(0, 60)}".`,
    );
    beats.push(position === undefined ? time : { time, position });
    assert(beats.length <= 100_000, 'RESOURCE_LIMIT', 'A beat file holds at most 100000 beats.');
  }
  return beats;
}
const CURVE_STEP = 0.1;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
}

function zscore(values) {
  const m = mean(values),
    s = Math.sqrt(mean(values.map((v) => (v - m) ** 2))) || 1;
  return values.map((v) => (v - m) / s);
}

/** Resample a series that ends each block at (i + 1) · step onto the curve grid. */
function onGrid(series, step, length) {
  return Float64Array.from({ length }, (_, i) => {
    const t = i * CURVE_STEP,
      x = Math.max(0, Math.min(series.length - 1, t / step - 0.5)),
      a = Math.floor(x),
      b = Math.min(series.length - 1, a + 1);
    return series[a] + (series[b] - series[a]) * (x - a);
  });
}

function framesToGrid(values, fps, length, reducer = 'mean') {
  return Float64Array.from({ length }, (_, i) => {
    const a = Math.floor(i * CURVE_STEP * fps),
      b = Math.min(values.length, Math.max(a + 1, Math.floor((i + 1) * CURVE_STEP * fps)));
    if (a >= values.length) return 0;
    let v = reducer === 'max' ? 0 : 0;
    for (let j = a; j < b; j++) v = reducer === 'max' ? Math.max(v, values[j]) : v + values[j];
    return reducer === 'max' ? v : v / (b - a);
  });
}

function readOptions(spec) {
  options(spec, ['tempoRange', 'tempoHint', 'beatsPerBar', 'chords', 'onsetThreshold', 'beats'], 'music analysis');
  const range = spec.tempoRange ?? [60, 200];
  assert(Array.isArray(range) && range.length === 2, 'MUSIC_ANALYSIS', 'tempoRange is [lowBpm, highBpm].');
  const low = number(range[0], 'lowest tempo', 30, 300),
    high = number(range[1], 'highest tempo', low * 1.5, 400);
  const hint = number(spec.tempoHint ?? Math.sqrt(low * high) * (120 / Math.sqrt(60 * 200)), 'tempo hint', low, high);
  const meter = spec.beatsPerBar ?? 'auto';
  assert(
    meter === 'auto' || meter === 2 || meter === 3 || meter === 4 || meter === 6,
    'MUSIC_ANALYSIS',
    'beatsPerBar is auto, 2, 3, 4 or 6.',
  );
  const chords = spec.chords ?? 'triads';
  assert(
    chords === false || chords === 'triads' || chords === 'sevenths',
    'MUSIC_ANALYSIS',
    'chords is triads, sevenths or false.',
  );
  return {
    range: [low, high],
    hint,
    meter,
    chords,
    delta: number(spec.onsetThreshold ?? 0.08, 'onset threshold', 0.005, 1),
    beats: spec.beats === undefined ? null : readBeats(spec.beats),
  };
}

/**
 * Beats from another tracker, such as a neural model: an array of times in
 * seconds, or of `{time, position}` where position 0 is the downbeat. Either
 * every beat has a position or none does.
 */
function readBeats(input) {
  assert(
    Array.isArray(input) && input.length >= 4 && input.length <= 100_000,
    'MUSIC_ANALYSIS',
    'beats is an array of 4 to 100000 beats.',
  );
  const list = input.map((b, i) => {
    if (typeof b === 'number') return { time: number(b, `beats[${i}]`, 0, MAX_MUSIC_SECONDS), position: null };
    options(b, ['time', 'position'], `beats[${i}]`);
    const position = b.position === undefined ? null : number(b.position, `beats[${i}].position`, 0, 15);
    assert(
      position === null || Number.isInteger(position),
      'MUSIC_ANALYSIS',
      'Beat positions are whole numbers from 0.',
    );
    return { time: number(b.time, `beats[${i}].time`, 0, MAX_MUSIC_SECONDS), position };
  });
  for (let i = 1; i < list.length; i++)
    assert(list[i].time > list[i - 1].time, 'MUSIC_ANALYSIS', 'Beat times must increase.');
  const positioned = list.filter((b) => b.position !== null).length;
  assert(
    positioned === 0 || positioned === list.length,
    'MUSIC_ANALYSIS',
    'Give a position for every beat or for none.',
  );
  return { times: list.map((b) => b.time), positions: positioned ? list.map((b) => b.position) : null };
}

/**
 * Analyse decoded music: loudness, onsets, tempo, beats, bars, chords, key,
 * sections and timed events. The input is `{channels, sampleRate}` with one
 * or two Float32Array or Float64Array channels of at most 900 seconds. The
 * result is frozen plain data that can be stored as JSON and passed to
 * `musicGrid`.
 */
export function analyzeMusic(input, spec = {}) {
  const settings = readOptions(spec),
    pcm = readMusicPCM(input),
    duration = pcm.duration,
    loud = measureLoudness(pcm, CURVE_STEP),
    { signal, sampleRate } = analysisSignal(pcm),
    of = onsetFeatures(signal, sampleRate),
    fps = of.fps,
    // Band-wise accent: low, mid and high flux are normalised separately and
    // summed, so broadband hi-hats cannot outweigh kick and snare (Scheirer,
    // JASA 1998; Klapuri, Eronen and Astola, IEEE TASLP 2006).
    lowBand = normalise(of.lowFlux),
    midBand = normalise(of.midFlux),
    highBand = normalise(of.highFlux),
    envelope = normalise(Float64Array.from(lowBand, (v, i) => v + midBand[i] + highBand[i])),
    onsetList = pickOnsets(envelope, fps, settings.delta),
    tempo = estimateTempo(envelope, fps, settings.range, settings.hint),
    curveLength = Math.max(1, Math.ceil(duration / CURVE_STEP));

  // Audible extent: momentary loudness within 30 LU of the integrated level.
  const momentary = onGrid(loud.momentary, loud.step, curveLength),
    shortTerm = onGrid(loud.shortTerm, loud.step, curveLength),
    audibleFloor = Math.max(-60, loud.integrated - 30);
  let first = momentary.findIndex((v) => v > audibleFloor),
    last = curveLength - 1 - [...momentary].reverse().findIndex((v) => v > audibleFloor);
  if (first < 0) {
    first = 0;
    last = curveLength - 1;
  }
  const audibleStart = Math.max(0, first * CURVE_STEP - 0.4),
    audibleEnd = Math.min(duration, last * CURVE_STEP);

  // Beats. Fewer than four beats means no usable pulse.
  // A tempo in a 3:2 relation can win the periodicity score in swung or
  // compound metre. Track both and keep the beats that sit on stronger
  // low- and mid-band onsets (kick, bass, snare), because hi-hats mark
  // subdivisions as strongly as beats in the full-band envelope. The same
  // log-normal prior as the estimator weighs the comparison (listeners prefer
  // tempi near 120 BPM; Moelants, 2002).
  const body = normalise(Float64Array.from(of.lowFlux, (v, i) => v + of.midFlux[i])),
    prior = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / settings.hint) / 0.9) ** 2),
    salience = (frames, bpm) =>
      frames.length ? prior(bpm) * mean(frames.map((f) => Math.max(...body.slice(Math.max(0, f - 2), f + 3)))) : 0;
  const external = settings.beats;
  let chosenFrames = external ? [] : trackBeats(envelope, fps, tempo);
  for (const ratio of external ? [] : [1.5, 2 / 3]) {
    const rival = tempo.candidates.find((c) => Math.abs(c.bpm / tempo.bpm / (1 / ratio) - 1) < 0.03 && c.score >= 0.6);
    if (!rival || rival.bpm < settings.range[0] || rival.bpm > settings.range[1]) continue;
    const scaled = {
        ...tempo,
        period: tempo.period * ratio,
        local: tempo.local.map((p) => ({ frame: p.frame, period: p.period * ratio })),
      },
      frames = trackBeats(envelope, fps, scaled);
    // The margin is empirical: it separated the switches needed in the test
    // recordings from the one that was not.
    if (salience(frames, tempo.bpm / ratio) > 1.22 * salience(chosenFrames, tempo.bpm)) {
      chosenFrames = frames;
      Object.assign(tempo, { bpm: tempo.bpm / ratio, period: scaled.period, local: scaled.local });
    }
  }
  let beatFrames = chosenFrames.filter((f) => f / fps >= audibleStart - 0.05 && f / fps <= audibleEnd + 0.05);
  if (beatFrames.length < 4) beatFrames = [];
  let beatTimes = beatFrames.map((f) => f / fps);
  if (external) {
    // External beats replace the tracker. Tempo follows their median spacing.
    assert(external.times.at(-1) <= duration + 0.5, 'MUSIC_ANALYSIS', 'Beat times run past the end of the audio.');
    beatTimes = external.times;
    beatFrames = beatTimes.map((t) => Math.min(of.count - 1, Math.round(t * fps)));
    const gaps = beatTimes
        .slice(1)
        .map((t, i) => t - beatTimes[i])
        .sort((a, b) => a - b),
      bpm = 60 / gaps[gaps.length >> 1];
    Object.assign(tempo, { bpm, period: (60 * fps) / bpm, confidence: 1, local: [] });
  }
  const intervals = beatTimes.slice(1).map((t, i) => t - beatTimes[i]),
    medianInterval = intervals.length ? [...intervals].sort((a, b) => a - b)[intervals.length >> 1] : 60 / tempo.bpm,
    spans = beatTimes.map((t, i) => [t, beatTimes[i + 1] ?? Math.min(duration, t + medianInterval)]);
  const pitch = pitchFeatures(signal, sampleRate),
    chroma = chromaOver(pitch, spans);

  // Downbeat evidence: harmonic change, bass onsets and overall accents.
  const harmonicChange = beatTimes.map((_, b) =>
      b === 0 ? 0 : 1 - cosine(chroma.treble, chroma.treble, b * 12, (b - 1) * 12, 12),
    ),
    near = (values, frame) => {
      let m = 0;
      for (let j = Math.max(0, frame - 3); j <= Math.min(values.length - 1, frame + 3); j++) m = Math.max(m, values[j]);
      return m;
    },
    bassAccent = beatFrames.map((f) => near(of.lowFlux, f)),
    accent = beatFrames.map((f) => near(envelope, f)),
    hz = zscore(harmonicChange),
    bz = zscore(bassAccent),
    az = zscore(accent),
    evidence = beatTimes.map((_, b) => hz[b] + 0.7 * bz[b] + 0.3 * az[b]);
  const givenPositions = external?.positions ?? null,
    meter = givenPositions
      ? { beatsPerBar: settings.meter === 'auto' ? Math.max(...givenPositions) + 1 : settings.meter, contrast: null }
      : settings.meter === 'auto'
        ? beatTimes.length >= 8
          ? chooseMeter(evidence)
          : { beatsPerBar: 4, contrast: 0 }
        : { beatsPerBar: settings.meter, contrast: null },
    beatsPerBar = meter.beatsPerBar,
    positions = givenPositions ?? (beatTimes.length ? trackBars(evidence, beatsPerBar) : new Int8Array(0));
  let barIndex = -1;
  const beats = beatTimes.map((time, index) => {
    if (positions[index] === 0 || barIndex < 0) barIndex++;
    return { time: round(time), index, bar: barIndex, position: positions[index], strength: round(accent[index], 3) };
  });
  const downbeats = beats.filter((b) => b.position === 0).map((b) => b.time);

  // Chords and key.
  const changeStrength = beats.map((b) => (b.position === 0 ? 1 : beatsPerBar === 4 && b.position === 2 ? 0.4 : 0.12));
  let chords = [];
  let beatChord = [];
  if (settings.chords && beats.length) {
    const labelled = labelChords(chroma, changeStrength, settings.chords);
    beatChord = Array.from(labelled.path, (state, b) => ({
      ...labelled.chords[state],
      confidence: labelled.confidence[b],
    }));
    for (let b = 0; b < beats.length; b++) {
      const c = beatChord[b],
        name = chordName(c.root, c.quality),
        previous = chords[chords.length - 1];
      if (previous && previous.name === name) {
        previous.end = round(spans[b][1]);
        previous.beats++;
        previous._confidence += c.confidence;
      } else
        chords.push({
          start: round(spans[b][0]),
          end: round(spans[b][1]),
          name,
          root: c.root,
          quality: c.quality,
          beat: b,
          beats: 1,
          _confidence: c.confidence,
        });
    }
  }
  const profile = new Float64Array(12);
  for (let b = 0; b < beats.length; b++)
    for (let pc = 0; pc < 12; pc++)
      profile[pc] += (chroma.treble[b * 12 + pc] + 0.5 * chroma.bass[b * 12 + pc]) * chroma.energy[b];
  const key = beats.length ? estimateKey([...profile]) : null;
  chords = chords.map(({ _confidence, ...c }) => ({
    ...c,
    numeral: key ? romanNumeral(c.root, c.quality, key.tonicIndex) : null,
    confidence: round(_confidence / c.beats, 3),
  }));

  // Curves on a 0.1 s grid.
  const centroid = framesToGrid(of.centroid, fps, curveLength),
    bassEnergy = framesToGrid(
      Float64Array.from({ length: of.count }, (_, i) => of.bandEnergy[i * 3]),
      fps,
      curveLength,
    ),
    onsetTrain = new Float64Array(curveLength);
  for (const o of onsetList) {
    const i = Math.min(curveLength - 1, Math.floor(o.frame / fps / CURVE_STEP));
    onsetTrain[i] += 1;
  }
  const density = movingAverage(onsetTrain, 10).map((v) => v / CURVE_STEP),
    loudRank = rank(shortTerm.map((v, i) => 0.5 * v + 0.5 * momentary[i])),
    brightRank = rank(movingAverage(centroid, 5)),
    bassRank = rank(
      movingAverage(
        bassEnergy.map((v) => Math.log1p(v)),
        5,
      ),
    ),
    densityRank = rank(density),
    intensity = movingAverage(
      loudRank.map((v, i) => 0.5 * v + 0.2 * densityRank[i] + 0.15 * brightRank[i] + 0.15 * bassRank[i]),
      3,
    );

  const curves = {
    step: CURVE_STEP,
    loudness: Array.from(momentary, (v) => round(v, 2)),
    shortTermLoudness: Array.from(shortTerm, (v) => round(v, 2)),
    intensity: Array.from(intensity, (v) => round(v, 3)),
    brightness: Array.from(centroid, (v) => Math.round(v)),
    bass: Array.from(bassRank, (v) => round(v, 3)),
    onsetDensity: Array.from(density, (v) => round(v, 2)),
  };

  // Sections from beat-synchronous harmony and timbre.
  let sections = [];
  if (beats.length >= 4 * beatsPerBar) {
    const dimension = 25,
      raw = beats.map((b, i) => {
        const [start, end] = spans[i],
          a = Math.floor(start * fps),
          z = Math.max(a + 1, Math.floor(end * fps)),
          vector = new Float64Array(dimension);
        for (let pc = 0; pc < 12; pc++) vector[pc] = chroma.treble[i * 12 + pc];
        for (let f = a; f < Math.min(z, of.count); f++)
          for (let c = 0; c < of.timbreSize; c++) vector[12 + c] += of.timbre[f * of.timbreSize + c] / (z - a);
        vector[24] = intensity[Math.min(curveLength - 1, Math.floor(start / CURVE_STEP))];
        return vector;
      });
    const features = new Float64Array(beats.length * dimension),
      detail = new Float64Array(beats.length * dimension);
    for (let d = 0; d < dimension; d++) {
      const column = zscore(raw.map((v) => v[d]));
      // Smooth over two bars so that a repeating chord loop reads as one texture
      // rather than as a change on every bar.
      const smoothed = movingAverage(column, beatsPerBar),
        weight = d < 12 ? 0.5 : d < 24 ? 1 : 2;
      for (let i = 0; i < beats.length; i++) detail[i * dimension + d] = column[i] * weight;
      for (let i = 0; i < beats.length; i++)
        features[i * dimension + d] = smoothed[i] * (d < 12 ? 0.5 : d < 24 ? 1 : 2);
    }
    // Strong bar-to-bar intensity jumps and drops are exact section boundaries.
    const bars = barTable(beats, curves, audibleEnd),
      jumps = [];
    for (let i = 1; i < bars.length; i++)
      if (Math.abs(bars[i].intensity - bars[i - 1].intensity) > 0.3) jumps.push(bars[i].beat);
    for (const d of findDrops(bars, curves)) jumps.push(bars[d.index].beat);
    const result = segment(
      features,
      beats.length,
      dimension,
      beats.map((b) => b.position === 0),
      beatsPerBar,
      jumps,
      detail,
    );
    sections = result.boundaries.map((startBeat, i) => {
      const endBeat = (result.boundaries[i + 1] ?? beats.length) - 1,
        start = i === 0 ? Math.min(beats[0].time, audibleStart) : beats[startBeat].time,
        end = i === result.boundaries.length - 1 ? audibleEnd : beats[endBeat + 1].time,
        level = mean(
          intensity,
          Math.floor(start / CURVE_STEP),
          Math.max(Math.floor(start / CURVE_STEP) + 1, Math.floor(end / CURVE_STEP)),
        );
      return {
        start: round(start),
        end: round(Math.max(start, end)),
        label: result.letters[i],
        startBeat,
        endBeat,
        startBar: beats[startBeat].bar,
        bars: beats[endBeat].bar - beats[startBeat].bar + 1,
        energy: round(level, 3),
      };
    });
  } else
    sections = [
      {
        start: round(audibleStart),
        end: round(audibleEnd),
        label: 'A',
        startBeat: 0,
        endBeat: Math.max(0, beats.length - 1),
        startBar: 0,
        bars: beats.length ? beats[beats.length - 1].bar + 1 : 0,
        energy: round(mean(intensity), 3),
      },
    ];

  const derived = deriveEvents({
    duration,
    audibleStart,
    audibleEnd,
    beats,
    beatsPerBar,
    sections,
    chords,
    curves,
    integrated: loud.integrated,
    level: onGrid(loud.level, loud.step, curveLength),
    onsets: onsetList.map((o) => ({ time: o.frame / fps, strength: o.strength })),
    tempo,
    fps,
    beatChord,
    chroma,
    key,
  });
  return freeze({
    version: MUSIC_ANALYSIS_VERSION,
    duration: round(duration),
    sampleRate: pcm.sampleRate,
    start: round(audibleStart),
    end: round(audibleEnd),
    loudness: { integrated: round(loud.integrated, 2), peak: round(percentile(momentary, 1), 2) },
    tuning: round(pitch.tuning, 1),
    tempo: {
      bpm: round(tempo.bpm, 2),
      confidence: round(tempo.confidence, 3),
      candidates: tempo.candidates.map((c) => ({ bpm: round(c.bpm, 2), score: round(c.score, 3) })),
      local: tempo.local.map((p) => ({ time: round(p.frame / fps, 2), bpm: round((60 * fps) / p.period, 2) })),
      source: settings.beats ? 'external' : 'estimated',
    },
    meter: {
      beatsPerBar,
      source: settings.beats?.positions ? 'external' : 'estimated',
      confidence: meter.contrast === null ? null : round(Math.max(0, Math.min(1, meter.contrast / 2)), 3),
    },
    key,
    beats,
    downbeats,
    onsets: onsetList.map((o) => ({ time: round(o.frame / fps), strength: round(o.strength, 3) })),
    chords,
    sections: derived.sections,
    events: derived.events,
    curves,
  });
}
