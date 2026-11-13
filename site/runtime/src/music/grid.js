import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { floorIndex } from './dsp.js';

const UNITS = Object.freeze({ bar: null, beat: 1, half: 2, third: 3, quarter: 4, onset: null, section: null });
export const GRID_UNITS = Object.freeze(Object.keys(UNITS));
const MAX_BEATS = 100_000,
  MAX_PINS = 10_000,
  EPSILON = 1e-6;

function sortedTimes(values, name) {
  assert(
    Array.isArray(values) && values.length <= MAX_BEATS,
    'RESOURCE_LIMIT',
    `${name} must be an array of at most ${MAX_BEATS} times.`,
  );
  const out = values.map((v, i) => number(typeof v === 'object' && v !== null ? v.time : v, `${name}[${i}]`, 0, 1e6));
  for (let i = 1; i < out.length; i++)
    assert(out[i] > out[i - 1], 'MUSIC_GRID', `${name} must be strictly increasing.`);
  return out;
}

function fromAnalysis(analysis) {
  const beats = sortedTimes(analysis.beats, 'beats'),
    positions = analysis.beats.map((b, i) => {
      const p = b.position;
      assert(
        Number.isInteger(p) && p >= 0 && p < 16,
        'MUSIC_GRID',
        `beats[${i}].position must be a whole number below 16.`,
      );
      return p;
    });
  return {
    beats,
    positions,
    beatsPerBar: number(analysis.meter?.beatsPerBar ?? 4, 'beats per bar', 1, 16),
    duration: number(analysis.duration, 'duration', 0, 1e6),
    onsets: Array.isArray(analysis.onsets) ? sortedTimes(analysis.onsets, 'onsets') : [],
    sections: Array.isArray(analysis.sections) ? analysis.sections : [],
    events: Array.isArray(analysis.events) ? analysis.events : [],
  };
}

function fromTempo(spec) {
  options(spec, ['tempo', 'beatsPerBar', 'start', 'duration'], 'music grid');
  const tempo = number(spec.tempo, 'tempo', 20, 400),
    beatsPerBar = number(spec.beatsPerBar ?? 4, 'beats per bar', 1, 16),
    start = number(spec.start ?? 0, 'grid start', 0, 1e6),
    duration = number(spec.duration, 'grid duration', 0.001, 1e6),
    length = 60 / tempo,
    count = Math.floor((duration - start) / length + EPSILON) + 1;
  assert(Number.isInteger(beatsPerBar), 'MUSIC_GRID', 'beatsPerBar must be a whole number.');
  assert(count <= MAX_BEATS, 'RESOURCE_LIMIT', `A grid holds at most ${MAX_BEATS} beats.`);
  const beats = Array.from({ length: Math.max(1, count) }, (_, i) => start + i * length);
  return {
    beats,
    positions: beats.map((_, i) => i % beatsPerBar),
    beatsPerBar,
    duration,
    onsets: [],
    sections: [],
    events: [],
  };
}

/**
 * A beat grid for snapping, pinning and pulsing. Pass the result of
 * `analyzeMusic`, or `{tempo, beatsPerBar, start, duration}` for music whose
 * tempo you already know. Times are seconds, and bar and beat numbers start
 * at zero.
 */
export function musicGrid(source) {
  assert(source && typeof source === 'object', 'MUSIC_GRID', 'musicGrid needs an analysis or {tempo, duration}.');
  const data = 'beats' in source ? fromAnalysis(source) : fromTempo(source),
    { beats, positions, beatsPerBar, duration } = data;
  assert(beats.length > 0, 'MUSIC_GRID', 'The music has no beats to build a grid from.');
  // Bar numbers: a new bar starts at each position 0; a pickup before the first one is bar 0.
  const barOf = [];
  let bar = positions[0] === 0 ? -1 : 0;
  for (let i = 0; i < beats.length; i++) {
    if (positions[i] === 0) bar++;
    barOf.push(Math.max(0, bar));
  }
  const firstOfBar = new Map();
  for (let i = beats.length - 1; i >= 0; i--) firstOfBar.set(barOf[i], i);
  const edge = beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : 0.5,
    firstGap = beats.length > 1 ? beats[1] - beats[0] : edge,
    lastGap = beats.length > 1 ? beats[beats.length - 1] - beats[beats.length - 2] : edge;

  /** Fractional beat index of a time, extrapolating at both ends. */
  function beatIndex(time) {
    if (time <= beats[0]) return (time - beats[0]) / firstGap;
    const i = floorIndex(beats, time);
    if (i >= beats.length - 1) return beats.length - 1 + (time - beats[beats.length - 1]) / lastGap;
    return i + (time - beats[i]) / (beats[i + 1] - beats[i]);
  }
  /** Time of a fractional beat index. */
  function beatTime(index) {
    if (index <= 0) return beats[0] + index * firstGap;
    if (index >= beats.length - 1) return beats[beats.length - 1] + (index - beats.length + 1) * lastGap;
    const i = Math.floor(index);
    return beats[i] + (index - i) * (beats[i + 1] - beats[i]);
  }
  function barStartIndex(barNumber) {
    if (firstOfBar.has(barNumber)) {
      const i = firstOfBar.get(barNumber);
      return i - positions[i];
    }
    const lastBar = barOf[barOf.length - 1],
      i = firstOfBar.get(lastBar);
    return i - positions[i] + (barNumber - lastBar) * beatsPerBar;
  }
  function candidates(unit, from, to) {
    if (unit === 'onset') return data.onsets.filter((t) => t >= from && t <= to);
    if (unit === 'section') return data.sections.map((s) => s.start).filter((t) => t >= from && t <= to);
    const list = [];
    if (unit === 'bar') {
      const a = Math.floor(position(from).bar) - 1,
        b = Math.ceil(position(to).bar) + 1;
      for (let n = Math.max(0, a); n <= b; n++) list.push(beatTime(barStartIndex(n)));
      return list.filter((t) => t >= from && t <= to);
    }
    const division = UNITS[unit],
      a = Math.floor(beatIndex(from) * division) - 1,
      b = Math.ceil(beatIndex(to) * division) + 1;
    assert(b - a <= MAX_BEATS * 4, 'RESOURCE_LIMIT', 'That range holds too many grid times.');
    for (let n = a; n <= b; n++) list.push(beatTime(n / division));
    return list.filter((t) => t >= from && t <= to);
  }
  function readUnit(unit) {
    assert(Object.hasOwn(UNITS, unit), 'MUSIC_GRID', `Unit must be one of ${GRID_UNITS.join(', ')}.`);
    return unit;
  }

  /** Where a time falls: bar, beat within the bar and progress through each. */
  function position(time) {
    number(time, 'time', -1e6, 1e6);
    const index = beatIndex(time),
      whole = Math.floor(index + EPSILON),
      clamped = Math.max(0, Math.min(beats.length - 1, whole)),
      overshoot = whole - clamped;
    // Count beats past the ends against the edge bars.
    let beatInBar = positions[clamped] + overshoot,
      barNumber = barOf[clamped] + Math.floor(beatInBar / beatsPerBar);
    beatInBar = ((beatInBar % beatsPerBar) + beatsPerBar) % beatsPerBar;
    const phase = Math.max(0, Math.min(1, index - whole)),
      gap = whole < 0 ? firstGap : whole >= beats.length - 1 ? lastGap : beats[whole + 1] - beats[whole];
    return Object.freeze({
      bar: barNumber,
      beat: beatInBar,
      beatIndex: index,
      phase,
      barPhase: (beatInBar + phase) / beatsPerBar,
      bpm: 60 / gap,
    });
  }

  function snap(time, unit = 'beat', direction = 'nearest') {
    number(time, 'time', -1e6, 1e6);
    readUnit(unit);
    assert(
      ['nearest', 'next', 'previous'].includes(direction),
      'MUSIC_GRID',
      'direction is nearest, next or previous.',
    );
    const reach = unit === 'section' || unit === 'onset' ? 1e6 : unit === 'bar' ? edge * beatsPerBar * 2.5 : edge * 2.5,
      list = candidates(unit, time - reach, time + reach);
    let best = null;
    for (const t of list) {
      if (direction === 'next' && t <= time + EPSILON) continue;
      if (direction === 'previous' && t >= time - EPSILON) continue;
      if (best === null || Math.abs(t - time) < Math.abs(best - time)) best = t;
    }
    return best;
  }

  /** The time of `{bar, beat, fraction}`, counted from zero. */
  function timeOf(spot) {
    options(spot, ['bar', 'beat', 'fraction'], 'grid position');
    const barNumber = number(spot.bar ?? 0, 'bar', -1e5, 1e5),
      beat = number(spot.beat ?? 0, 'beat', -64, 64),
      fraction = number(spot.fraction ?? 0, 'fraction', -64, 64);
    assert(Number.isInteger(barNumber), 'MUSIC_GRID', 'bar must be a whole number.');
    return beatTime(barStartIndex(barNumber) + beat + fraction);
  }

  function times(unit = 'beat', range = {}) {
    readUnit(unit);
    options(range, ['from', 'to'], 'grid range');
    const from = number(range.from ?? 0, 'from', -1e6, 1e6),
      to = number(range.to ?? duration, 'to', from, 1e6);
    return Object.freeze(candidates(unit, from, to));
  }

  /**
   * A value that jumps to 1 on each grid time and decays exponentially, for
   * driving scale, glow or shake from the beat. `decay` is the time in
   * seconds for the value to fall to about 37 %.
   */
  function pulse(time, spec = {}) {
    options(spec, ['unit', 'decay'], 'grid pulse');
    const unit = readUnit(spec.unit ?? 'beat'),
      decay = number(spec.decay ?? 0.12, 'pulse decay', 0.001, 60),
      last = snap(time + 2 * EPSILON, unit, 'previous');
    return last === null || last > time + EPSILON ? 0 : Math.exp(-(time - last) / decay);
  }

  function findEvent(type, index = 0) {
    const list = data.events.filter((e) => e.type === type);
    return list[index] ?? null;
  }

  function resolve(at, id) {
    if (typeof at === 'number') return number(at, `${id}.at`, -1e6, 1e6);
    assert(at && typeof at === 'object', 'MUSIC_GRID', `${id}.at must be a time or a grid position.`);
    if ('event' in at) {
      options(at, ['event', 'index', 'edge'], `${id}.at`);
      const event = findEvent(text(at.event, 'event type', 64), number(at.index ?? 0, 'event index', 0, 1e5));
      if (!event) return null;
      return at.edge === 'end' ? (event.end ?? event.time) : event.time;
    }
    if ('section' in at) {
      options(at, ['section', 'edge'], `${id}.at`);
      const section =
        typeof at.section === 'number'
          ? data.sections[at.section]
          : data.sections.find((s) => s.label === text(at.section, 'section label', 64));
      if (!section) return null;
      return at.edge === 'end' ? section.end : section.start;
    }
    return timeOf(at);
  }

  /**
   * Resolve actions to times. Each action has an `id` and an `at` (seconds,
   * `{bar, beat, fraction}`, `{event, index, edge}` or `{section, edge}`). The
   * time is snapped to `snap` if given, moved by `beats` along the grid and
   * then by `offset` seconds. Actions whose event or section does not exist
   * are returned with `time: null` and `missing: true`.
   */
  function pin(actions) {
    assert(
      Array.isArray(actions) && actions.length <= MAX_PINS,
      'RESOURCE_LIMIT',
      `Pin at most ${MAX_PINS} actions at once.`,
    );
    const result = actions.map((action, i) => {
      options(action, ['id', 'at', 'snap', 'direction', 'beats', 'offset', 'data'], `pinned action ${i}`);
      const id = text(action.id ?? `action-${i}`, 'action id', 200);
      let time = resolve(action.at, id);
      if (time === null) return Object.freeze({ id, time: null, missing: true, data: safeCopy(action.data ?? null) });
      if (action.snap !== undefined) time = snap(time, action.snap, action.direction ?? 'nearest') ?? time;
      if (action.beats !== undefined) time = beatTime(beatIndex(time) + number(action.beats, `${id}.beats`, -1e4, 1e4));
      if (action.offset !== undefined) time += number(action.offset, `${id}.offset`, -1e4, 1e4);
      const where = position(time);
      return Object.freeze({
        id,
        time,
        bar: where.bar,
        beat: where.beat,
        missing: false,
        data: safeCopy(action.data ?? null),
      });
    });
    return Object.freeze(result.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity)));
  }

  return Object.freeze({
    beatsPerBar,
    duration,
    beats: Object.freeze(beats.slice()),
    bars: Object.freeze([...new Set(barOf)].map((n) => beatTime(barStartIndex(n)))),
    position,
    snap,
    next: (time, unit = 'beat') => snap(time, unit, 'next'),
    previous: (time, unit = 'beat') => snap(time, unit, 'previous'),
    timeOf,
    times,
    pulse,
    pin,
    event: findEvent,
  });
}
