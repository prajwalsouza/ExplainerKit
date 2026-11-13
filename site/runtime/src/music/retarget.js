// Fit a song to a target length by jumping between bars that sound alike,
// the idea behind music retargeting (Wenner et al., "Scalable Music:
// Automatic Music Retargeting and Synthesis", Eurographics 2013) reduced to
// bar-aligned cuts. Bars are compared using only the stored analysis:
// section letter, chords and intensity. Jumps keep the first and last bars.

import { assert, number, options } from '../core/validate.js';
import { readMusicPCM } from './input.js';
import { mean } from './dsp.js';

function barProfile(analysis) {
  const starts = analysis.downbeats ?? [];
  assert(
    Array.isArray(starts) && starts.length >= 8,
    'MUSIC_RETARGET',
    'Retargeting needs an analysis with at least eight bars.',
  );
  const step = analysis.curves.step;
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? Math.min(analysis.end, start + (start - starts[i - 1])),
      section = analysis.sections.findLast((s) => s.start <= start + 1e-6),
      chords = analysis.chords
        .filter((c) => c.end > start + 1e-6 && c.start < end - 1e-6)
        .map((c) => c.name)
        .join(' '),
      a = Math.floor(start / step),
      z = Math.max(a + 1, Math.floor(end / step));
    return {
      start,
      end,
      label: section?.label ?? null,
      chords,
      intensity: mean(analysis.curves.intensity, a, Math.min(z, analysis.curves.intensity.length)),
    };
  });
}

function match(a, b) {
  return (
    0.4 * (a.label === b.label ? 1 : 0) +
    0.4 * (a.chords === b.chords ? 1 : 0) +
    0.2 * Math.max(0, 1 - 3 * Math.abs(a.intensity - b.intensity))
  );
}

/**
 * Plan bar-aligned jumps that bring the song close to `duration` seconds.
 * Returns the edit list, the resulting length, the leftover difference and
 * where to fade out if the result is still longer than requested.
 */
export function retargetMusic(analysis, spec) {
  options(spec, ['duration', 'maxJumps', 'minSimilarity'], 'music retarget');
  const target = number(spec.duration, 'target duration', 1, 3600),
    maxJumps = number(spec.maxJumps ?? 4, 'maximum jumps', 0, 16),
    minimum = number(spec.minSimilarity ?? 0.7, 'minimum similarity', 0, 1),
    bars = barProfile(analysis),
    first = bars[0].start,
    last = bars[bars.length - 1].end;
  // Segments of source bars, played in order. Start with the whole song.
  let pieces = [{ from: 0, to: bars.length }],
    length = analysis.end - analysis.start;
  const jumps = [],
    used = new Set(),
    playLength = (list) =>
      list.reduce((n, p) => n + bars[p.to - 1].end - bars[p.from].start, 0) +
      (first - analysis.start) +
      (analysis.end - last);
  for (let round = 0; round < maxJumps; round++) {
    const remaining = length - target,
      barLength = (last - first) / bars.length;
    if (Math.abs(remaining) < barLength / 2) break;
    let best = null;
    // A jump plays bars up to i-1, then continues at bar j instead of bar i.
    for (let i = 2; i < bars.length - 1; i++)
      for (let j = 1; j < bars.length - 2; j++) {
        if (i === j || used.has(i) || used.has(j)) continue;
        const home = pieces.find((p) => i > p.from && i < p.to);
        if (!home || j <= home.from || j >= home.to) continue;
        const change = bars[j].start - bars[i].start; // positive skips ahead (shorter)
        if (Math.sign(change) !== Math.sign(remaining)) continue;
        const similarity = 0.5 * match(bars[i], bars[j]) + 0.5 * match(bars[i - 1], bars[j - 1]);
        if (similarity < minimum) continue;
        // Whole-phrase jumps (multiples of four bars) sound most natural.
        const phrase = Math.abs(i - j) % 4 === 0 ? 0.1 : 0,
          miss = Math.abs(Math.abs(change) - Math.abs(remaining)) / Math.max(1, Math.abs(remaining)),
          value = similarity + phrase - miss;
        if (Math.abs(change) > Math.abs(remaining) + barLength) continue;
        if (!best || value > best.value) best = { i, j, similarity, value };
      }
    if (!best) break;
    // Apply the jump inside the piece that currently contains bar i.
    const index = pieces.findIndex((p) => best.i > p.from && best.i < p.to);
    if (index < 0) break;
    const piece = pieces[index];
    pieces = [
      ...pieces.slice(0, index),
      { from: piece.from, to: best.i },
      { from: best.j, to: piece.to },
      ...pieces.slice(index + 1),
    ];
    for (let k = Math.min(best.i, best.j) - 1; k <= Math.max(best.i, best.j); k++) used.add(k);
    jumps.push({
      fromBar: best.i - 1,
      toBar: best.j,
      at: bars[best.i].start,
      to: bars[best.j].start,
      similarity: Math.round(best.similarity * 1000) / 1000,
    });
    length = playLength(pieces);
  }
  // Edits in output time. The first piece includes any audio before bar 0; the last includes audio after the final bar.
  const edits = [];
  let at = 0;
  pieces.forEach((p, k) => {
    const from = k === 0 ? analysis.start : bars[p.from].start,
      to = k === pieces.length - 1 ? analysis.end : bars[p.to - 1].end;
    edits.push({
      at: Math.round(at * 1000) / 1000,
      from: Math.round(from * 1000) / 1000,
      to: Math.round(to * 1000) / 1000,
    });
    at += to - from;
  });
  const result = at,
    fadeOutAt = result > target ? Math.max(0, target - 2) : null;
  return Object.freeze({
    duration: Math.round(result * 1000) / 1000,
    target,
    residual: Math.round((result - target) * 1000) / 1000,
    fadeOutAt,
    jumps: Object.freeze(jumps.map(Object.freeze)),
    edits: Object.freeze(edits.map(Object.freeze)),
  });
}

/**
 * Apply an edit list to decoded PCM with short linear crossfades at each
 * join, and an optional fade-out. A linear fade suits these joins because the
 * two sides are similar bars, so their sum keeps a steady level. The output may hold at most 32 million
 * samples across its channels.
 */
export function renderMusicEdits(input, plan, spec = {}) {
  options(spec, ['crossfade', 'fadeOutAt', 'fadeOut', 'duration'], 'music edit render');
  const pcm = readMusicPCM(input),
    rate = pcm.sampleRate,
    crossfade = number(spec.crossfade ?? 0.03, 'crossfade', 0, 1),
    edits = plan.edits;
  assert(
    Array.isArray(edits) && edits.length >= 1 && edits.length <= 64,
    'MUSIC_RETARGET',
    'An edit plan holds 1–64 edits.',
  );
  const total = edits.reduce((n, e) => {
      number(e.from, 'edit from', 0, pcm.duration);
      number(e.to, 'edit to', e.from, pcm.duration);
      return n + (e.to - e.from);
    }, 0),
    duration = number(spec.duration ?? total, 'render duration', 0.01, total),
    count = Math.round(duration * rate);
  assert(
    count * pcm.channels.length <= 32_000_000,
    'RESOURCE_LIMIT',
    'Edited music exceeds the 32-million-sample render budget.',
  );
  const out = pcm.channels.map(() => new Float32Array(count)),
    half = Math.round((crossfade * rate) / 2);
  let cursor = 0;
  edits.forEach((edit, k) => {
    const a = Math.round(edit.from * rate),
      b = Math.round(edit.to * rate);
    // Each piece reads `half` samples past both of its cut points and fades across them.
    const lead = k === 0 ? 0 : half,
      trail = k === edits.length - 1 ? 0 : half;
    for (let n = -lead; n < b - a + trail; n++) {
      const target = cursor + n,
        sourceIndex = a + n;
      if (target < 0 || target >= count || sourceIndex < 0 || sourceIndex >= pcm.length) continue;
      let g = 1;
      if (n < lead) g *= (n + lead + 0.5) / (2 * lead);
      if (n >= b - a - trail) g *= 1 - (n - (b - a - trail) + 0.5) / (2 * trail);
      for (let c = 0; c < out.length; c++) out[c][target] += pcm.channels[c][sourceIndex] * g;
    }
    cursor += b - a;
  });
  if (spec.fadeOutAt !== undefined && spec.fadeOutAt !== null) {
    const startFade = number(spec.fadeOutAt, 'fade-out start', 0, duration),
      length = number(spec.fadeOut ?? duration - startFade, 'fade-out length', 0.001, 60);
    for (let n = Math.round(startFade * rate); n < count; n++) {
      const g = Math.max(0, 1 - (n / rate - startFade) / length);
      for (const c of out) c[n] *= g;
    }
  }
  return Object.freeze({ channels: Object.freeze(out), sampleRate: rate, duration: count / rate });
}
