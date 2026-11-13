// Timed events derived from the analysis curves, beats, sections and chords.
// These are heuristics on measured quantities, not trained detectors. Each
// event records the measurement it came from so that a reader can check it.
//
// Build-ups, drops and breakdowns follow the energy-and-bass description of
// electronic dance music structure in Yadati et al. (ISMIR 2014) and Butler,
// "Unlocking the Groove" (2006): a build raises energy over several bars, a
// drop is a sudden return of full energy and bass on a bar line, and a
// breakdown is a sustained low-energy passage after a fuller one.

import { chordName, estimateKey } from './harmony.js';
import { mean, percentile, round } from './dsp.js';

export function barTable(beats, curves, audibleEnd) {
  const starts = beats.filter((b) => b.position === 0),
    step = curves.step;
  return starts.map((b, i) => {
    const end = starts[i + 1]?.time ?? Math.min(audibleEnd, b.time + (b.time - (starts[i - 1]?.time ?? b.time - 2))),
      a = Math.floor(b.time / step),
      z = Math.max(a + 1, Math.floor(end / step));
    return {
      bar: b.bar,
      beat: b.index,
      start: b.time,
      end,
      intensity: mean(curves.intensity, a, Math.min(z, curves.intensity.length)),
      bass: mean(curves.bass, a, Math.min(z, curves.bass.length)),
      loudness: mean(curves.shortTermLoudness, a, Math.min(z, curves.shortTermLoudness.length)),
    };
  });
}

function progressionOf(beatChord, section, beats) {
  if (!beatChord.length) return null;
  const bars = new Map();
  for (let b = section.startBeat; b <= section.endBeat; b++) {
    const name = chordName(beatChord[b].root, beatChord[b].quality),
      list = bars.get(beats[b].bar) ?? [];
    if (list[list.length - 1] !== name) list.push(name);
    bars.set(beats[b].bar, list);
  }
  const sequence = [...bars.values()].map((list) => list.join(' '));
  if (!sequence.length) return null;
  for (const period of [1, 2, 4, 8]) {
    if (period > sequence.length / 2 && period !== 1) break;
    let match = 0,
      total = 0;
    for (let i = period; i < sequence.length; i++) {
      total++;
      if (sequence[i] === sequence[i - period]) match++;
    }
    if (total && match / total >= 0.7) {
      const chords = sequence.slice(0, period).join(' ').split(' ');
      return { chords: chords.filter((c, i) => c !== chords[i - 1]), bars: period, repeat: round(match / total, 2) };
    }
  }
  return { chords: null, bars: null, repeat: 0 };
}

/**
 * Drops: the first half of a bar is clearly louder (3 LU or more) and heavier
 * in the bass than the fuller half of the bar before it, and the music stays
 * full afterwards. Comparing with the fuller half means a short stop before a
 * bar that simply continues is not mistaken for a drop.
 */
export function findDrops(bars, curves) {
  const step = curves.step,
    half = (series, bar, which) => {
      const middle = (bar.start + bar.end) / 2,
        [t0, t1] = which === 'first' ? [bar.start, middle] : [middle, bar.end];
      return mean(
        series,
        Math.floor(t0 / step),
        Math.max(Math.floor(t0 / step) + 1, Math.min(series.length, Math.floor(t1 / step))),
      );
    },
    fuller = (series, bar) => Math.max(half(series, bar, 'first'), half(series, bar, 'second')),
    levels = bars.map((b) => b.intensity),
    fullLevel = (percentile(levels, 0.1) + percentile(levels, 0.9)) / 2,
    drops = [];
  for (let i = 1; i < bars.length; i++) {
    const lift = half(curves.loudness, bars[i], 'first') - fuller(curves.loudness, bars[i - 1]),
      bassLift = half(curves.bass, bars[i], 'first') - fuller(curves.bass, bars[i - 1]),
      after = mean(bars.slice(i, i + 2).map((b) => b.intensity));
    if (lift >= 3 && bassLift >= 0.2 && after >= fullLevel && drops.every((d) => i - d.index >= 4))
      drops.push({ index: i, lift, bassLift });
  }
  return drops;
}

export function deriveEvents(context) {
  const { beats, sections, curves, audibleStart, audibleEnd, beatChord, chroma, key, integrated, tempo, fps } = context,
    step = curves.step,
    events = [],
    bars = barTable(beats, curves, audibleEnd),
    beatAt = (time) => {
      let best = null;
      for (const b of beats) if (best === null || Math.abs(b.time - time) < Math.abs(best.time - time)) best = b;
      return best;
    },
    add = (type, time, strength, extra = {}) => {
      const b = beatAt(time);
      events.push({
        type,
        time: round(time),
        strength: round(Math.max(0, Math.min(1, strength)), 3),
        bar: b ? b.bar : null,
        beat: b ? b.index : null,
        ...extra,
      });
    };

  add('start', audibleStart, 1);
  add('end', audibleEnd, 1);

  // Fades: short-term loudness climbing or falling by 10 LU or more across the edge.
  const st = curves.shortTermLoudness,
    edge = Math.min(st.length - 1, Math.round(6 / step)),
    from = Math.floor(audibleStart / step),
    to = Math.min(st.length - 1, Math.floor(audibleEnd / step));
  if (to - from > 2 * edge) {
    const rise = st[from + edge] - st[Math.min(to, from + Math.round(1 / step))];
    if (rise >= 10)
      add('fade-in', audibleStart, Math.min(1, rise / 20), {
        end: round(audibleStart + edge * step),
        measure: `short-term loudness +${round(rise, 1)} LU`,
      });
    const fall = st[to - edge] - st[to];
    if (fall >= 10)
      add('fade-out', (to - edge) * step, Math.min(1, fall / 20), {
        end: round(audibleEnd),
        measure: `short-term loudness −${round(fall, 1)} LU`,
      });
  }

  // Sections: role, progression and local key.
  const levels = sections.map((s) => s.energy),
    median = percentile(levels, 0.5),
    high = percentile(levels, 0.8),
    counts = new Map();
  for (const s of sections) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  const enriched = sections.map((s, i) => {
    const progression = progressionOf(beatChord, s, beats);
    let sectionKey = null;
    if (chroma && s.endBeat - s.startBeat >= 16) {
      const profile = new Array(12).fill(0);
      for (let b = s.startBeat; b <= s.endBeat; b++)
        for (let pc = 0; pc < 12; pc++)
          profile[pc] += (chroma.treble[b * 12 + pc] + 0.5 * chroma.bass[b * 12 + pc]) * chroma.energy[b];
      const k = estimateKey(profile);
      sectionKey = { name: k.name, confidence: round(k.confidence, 3) };
    }
    let role = 'steady';
    const previous = sections[i - 1],
      single = counts.get(s.label) === 1;
    if (i === 0 && sections.length > 2 && s.energy <= median && (single || s.energy < median - 0.1)) role = 'intro';
    else if (
      i === sections.length - 1 &&
      sections.length > 2 &&
      s.energy <= median &&
      (single || s.energy < median - 0.1)
    )
      role = 'outro';
    else if (previous && s.energy <= median - 0.12 && previous.energy > s.energy + 0.12) role = 'breakdown';
    else if (s.energy >= high && s.energy >= median + 0.1) role = 'peak';
    return { ...s, role, repeats: counts.get(s.label), progression, key: sectionKey };
  });
  enriched.forEach((s, i) => {
    if (i > 0)
      add('section', s.start, Math.min(1, 0.4 + Math.abs(s.energy - enriched[i - 1].energy)), {
        label: s.label,
        role: s.role,
      });
    const before = enriched[i - 1];
    if (
      before?.progression?.chords &&
      s.progression?.chords &&
      before.progression.chords.join(' ') !== s.progression.chords.join(' ')
    )
      add('progression-change', s.start, 0.6, { from: before.progression.chords, to: s.progression.chords });
    if (
      before?.key &&
      s.key &&
      before.key.name !== s.key.name &&
      Math.min(before.key.confidence, s.key.confidence) >= 0.3
    )
      add('key-change', s.start, Math.min(before.key.confidence, s.key.confidence), {
        from: before.key.name,
        to: s.key.name,
      });
  });
  if (key && enriched.length) enriched[0].key ??= { name: key.name, confidence: round(key.confidence, 3) };

  const drops = findDrops(bars, curves),
    dropBars = new Set(drops.map((d) => d.index));
  for (const d of drops)
    add('drop', bars[d.index].start, Math.min(1, d.lift / 12 + d.bassLift / 2), {
      measure: `loudness +${round(d.lift, 1)} LU, bass +${round(d.bassLift, 2)}`,
    });

  // Build-ups: two or more bars of rising intensity that end before a drop.
  // Flat bars at the start of a run are trimmed.
  for (let i = 0; i < bars.length - 1;) {
    let j = i,
      dips = 0;
    while (j + 1 < bars.length && !dropBars.has(j + 1)) {
      const delta = bars[j + 1].intensity - bars[j].intensity;
      if (delta > 0.01) j++;
      else if (
        delta > -0.03 &&
        dips === 0 &&
        j + 2 < bars.length &&
        !dropBars.has(j + 2) &&
        bars[j + 2].intensity > bars[j].intensity
      ) {
        dips++;
        j++;
      } else break;
    }
    let s = i;
    while (s < j && bars[s + 1].intensity - bars[s].intensity < 0.02) s++;
    const rise = bars[j].intensity - bars[s].intensity;
    let largest = 0;
    for (let k = s; k < j; k++) largest = Math.max(largest, bars[k + 1].intensity - bars[k].intensity);
    // A build rises gradually: one step may not carry most of the rise. Intensity
    // still settling just after a drop is not a build either.
    if (j - s >= 2 && rise >= 0.15 && largest <= 0.6 * rise && !dropBars.has(s) && !dropBars.has(s - 1)) {
      add('build', bars[s].start, Math.min(1, rise * 2), {
        end: round(bars[j].end),
        bars: j - s + 1,
        measure: `intensity +${round(rise, 2)} over ${j - s + 1} bars`,
      });
      i = j;
    } else i = Math.max(i + 1, j);
  }

  // Breakdowns: two or more quiet bars after a fuller passage.
  const quietLine =
    percentile(
      bars.map((b) => b.intensity),
      0.5,
    ) - 0.15;
  for (let i = 1; i < bars.length;) {
    if (bars[i].intensity <= quietLine && bars[i - 1].intensity > quietLine + 0.1) {
      let j = i;
      while (j + 1 < bars.length && bars[j + 1].intensity <= quietLine + 0.05) j++;
      if (j - i >= 1 && bars[j].end < audibleEnd - 1)
        add('breakdown', bars[i].start, Math.min(1, (bars[i - 1].intensity - bars[i].intensity) * 2), {
          end: round(bars[j].end),
          bars: j - i + 1,
        });
      i = j + 1;
    } else i++;
  }

  // Climax: the four-bar window with the highest mean intensity.
  if (bars.length >= 4) {
    let best = 0,
      bestValue = -Infinity;
    for (let i = 0; i + 4 <= bars.length; i++) {
      const v = mean(bars.slice(i, i + 4).map((b) => b.intensity));
      if (v > bestValue) {
        bestValue = v;
        best = i;
      }
    }
    add('climax', bars[best].start, bestValue, { end: round(bars[best + 3].end) });
  }

  // Pauses: 0.2 s or more inside the song whose 100 ms level is at least 25 LU
  // below the integrated loudness.
  const loud = context.level,
    floor = Math.max(-60, integrated - 25);
  for (let i = Math.floor(audibleStart / step) + 5; i < Math.floor(audibleEnd / step) - 5;) {
    if (loud[i] < floor) {
      let j = i;
      while (j + 1 < loud.length && loud[j + 1] < floor) j++;
      if ((j - i + 1) * step >= 0.2 && j * step < audibleEnd - 0.5)
        add('pause', i * step, Math.min(1, ((j - i + 1) * step) / 2), { end: round((j + 1) * step) });
      i = j + 1;
    } else i++;
  }

  // Hits: onsets far above their neighbourhood, at most one per beat and 64 in all.
  const onsets = context.onsets,
    beatLength = 60 / tempo.bpm,
    hits = [];
  for (let i = 0, lo = 0, hi = 0; i < onsets.length; i++) {
    while (onsets[lo].time < onsets[i].time - 4) lo++;
    while (hi < onsets.length && onsets[hi].time < onsets[i].time + 4) hi++;
    const local = percentile(
      onsets.slice(lo, hi).map((o) => o.strength),
      0.5,
    );
    if (onsets[i].strength >= 0.7 && onsets[i].strength >= 1.8 * local) hits.push(onsets[i]);
  }
  hits.sort((a, b) => b.strength - a.strength);
  const keptHits = [];
  for (const h of hits)
    if (keptHits.length < 64 && keptHits.every((k) => Math.abs(k.time - h.time) >= beatLength * 0.9)) keptHits.push(h);
  for (const h of keptHits) add('hit', h.time, Math.min(1, h.strength / 1.5));

  // Tempo changes: windows whose local tempo departs from the global tempo by 4 % or more.
  let changed = false;
  for (const p of tempo.local) {
    const bpm = (60 * fps) / p.period,
      away = Math.abs(bpm / tempo.bpm - 1) >= 0.04;
    if (away && !changed)
      add('tempo-change', p.frame / fps, Math.min(1, Math.abs(bpm / tempo.bpm - 1) * 5), { bpm: round(bpm, 1) });
    changed = away;
  }

  const order = {
    start: 0,
    'fade-in': 1,
    section: 2,
    'progression-change': 3,
    'key-change': 4,
    drop: 5,
    build: 6,
    breakdown: 7,
    climax: 8,
    pause: 9,
    hit: 10,
    'tempo-change': 11,
    'fade-out': 12,
    end: 13,
  };
  events.sort((a, b) => a.time - b.time || order[a.type] - order[b.type]);
  return { sections: enriched, events };
}
