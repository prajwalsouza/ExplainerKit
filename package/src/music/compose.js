import { assert, number, options } from '../core/validate.js';
import { midiPitch } from '../sound/instruments.js';
import { createMusicScore } from './score.js';

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Chord qualities understood by `chordPitches`, as semitones above the root. */
export const CHORD_SHAPES = Object.freeze({
  '': [0, 4, 7],
  m: [0, 3, 7],
  5: [0, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
});

function pitchClass(name) {
  const match = /^([A-G])([#b]?)$/.exec(name);
  assert(match, 'MUSIC_COMPOSE', `Unknown note name ${String(name).slice(0, 12)}.`);
  return (LETTERS[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? 11 : 0)) % 12;
}

function parseChord(symbol) {
  assert(
    typeof symbol === 'string' && symbol.length <= 16,
    'MUSIC_COMPOSE',
    'A chord symbol is short text such as Dm7 or G/B.',
  );
  const match = /^([A-G][#b]?)([a-z0-9]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
  assert(match && Object.hasOwn(CHORD_SHAPES, match[2]), 'MUSIC_COMPOSE', `Unknown chord symbol ${symbol}.`);
  return {
    root: pitchClass(match[1]),
    shape: CHORD_SHAPES[match[2]],
    bass: match[3] === undefined ? null : pitchClass(match[3]),
  };
}

/**
 * MIDI pitches of a chord symbol in close position, lowest first. `octave`
 * places the root, with octave 4 starting at middle C. A slash chord puts its
 * bass note below the rest.
 */
export function chordPitches(symbol, settings = {}) {
  options(settings, ['octave', 'inversion'], 'chord options');
  const { root, shape, bass } = parseChord(symbol);
  const octave = settings.octave ?? 3,
    inversion = settings.inversion ?? 0;
  assert(Number.isInteger(octave) && octave >= 0 && octave <= 7, 'MUSIC_COMPOSE', 'Chord octaves run from 0 to 7.');
  assert(
    Number.isInteger(inversion) && inversion >= 0 && inversion < shape.length,
    'MUSIC_COMPOSE',
    'The inversion must be below the number of chord notes.',
  );
  const base = (octave + 1) * 12 + root;
  const pitches = shape.map((interval, index) => base + interval + (index < inversion ? 12 : 0)).sort((a, b) => a - b);
  if (bass !== null) {
    let low = base - 12 + ((bass - root + 12) % 12);
    while (low >= pitches[0]) low -= 12;
    pitches.unshift(low);
  }
  return pitches;
}

/**
 * Voice a chord progression so that each voice moves as little as possible.
 * Every voicing stays between `low` and `high` and covers as many chord notes
 * as the number of voices allows.
 */
export function voiceLead(chords, settings = {}) {
  options(settings, ['voices', 'low', 'high', 'top'], 'voice leading options');
  assert(Array.isArray(chords) && chords.length >= 1 && chords.length <= 512, 'MUSIC_COMPOSE', 'Give 1–512 chords.');
  const voices = settings.voices ?? 4,
    low = midiPitch(settings.low ?? 48),
    high = midiPitch(settings.high ?? 74);
  assert(Number.isInteger(voices) && voices >= 2 && voices <= 6, 'MUSIC_COMPOSE', 'Voice 2–6 parts.');
  assert(high - low >= 12 && high - low <= 36, 'MUSIC_COMPOSE', 'The voicing range spans one to three octaves.');
  const top = settings.top === undefined ? null : midiPitch(settings.top);
  let previous = null;
  return chords.map((symbol) => {
    const { root, shape } = parseChord(symbol),
      classes = [...new Set(shape.map((interval) => (root + interval) % 12))],
      pool = [];
    for (let pitch = low; pitch <= high; pitch++) if (classes.includes(pitch % 12)) pool.push(pitch);
    let best = null,
      bestCost = Infinity;
    const chosen = [];
    const visit = (from) => {
      if (chosen.length === voices) {
        const covered = new Set(chosen.map((pitch) => pitch % 12)).size;
        let cost = (Math.min(voices, classes.length) - covered) * 30;
        for (let i = 1; i < voices; i++) {
          const gap = chosen[i] - chosen[i - 1];
          // Close seconds and gaps wider than an octave both make a chord harder to hear as one sound.
          cost += gap < 3 ? 4 : gap > 12 ? (gap - 12) * 2 : 0;
        }
        if (previous) for (let i = 0; i < voices; i++) cost += Math.abs(chosen[i] - previous[i]);
        else cost += Math.abs(chosen[voices - 1] - (top ?? high - 4)) * 2;
        if (cost < bestCost) {
          bestCost = cost;
          best = [...chosen];
        }
        return;
      }
      for (let i = from; i <= pool.length - (voices - chosen.length); i++) {
        chosen.push(pool[i]);
        visit(i + 1);
        chosen.pop();
      }
    };
    visit(0);
    assert(best, 'MUSIC_COMPOSE', `The range is too narrow to voice ${symbol} in ${voices} parts.`);
    previous = best;
    return best;
  });
}

const PATTERNS = {
  up: (count) => Array.from({ length: count }, (_, i) => i),
  down: (count) => Array.from({ length: count }, (_, i) => count - 1 - i),
  updown: (count) => [
    ...Array.from({ length: count }, (_, i) => i),
    ...Array.from({ length: Math.max(0, count - 2) }, (_, i) => count - 2 - i),
  ],
};

/**
 * Turn held pitches into a repeating figure. The result lists notes with a
 * `beat` offset from the start of the figure, ready to place in a part.
 */
export function arpeggiate(pitches, settings = {}) {
  options(settings, ['pattern', 'steps', 'step', 'length', 'velocity', 'accent', 'every'], 'arpeggio options');
  assert(
    Array.isArray(pitches) && pitches.length >= 1 && pitches.length <= 12,
    'MUSIC_COMPOSE',
    'Arpeggiate 1–12 pitches.',
  );
  const sorted = pitches.map(midiPitch).sort((a, b) => a - b);
  const pattern = settings.pattern ?? 'up';
  const order = Array.isArray(pattern) ? pattern : PATTERNS[pattern]?.(sorted.length);
  assert(
    Array.isArray(order) && order.length >= 1 && order.length <= 64,
    'MUSIC_COMPOSE',
    'A pattern is up, down, updown or a list of note indexes.',
  );
  const steps = settings.steps ?? order.length,
    step = number(settings.step ?? 0.5, 'arpeggio step in beats', 0.0625, 8),
    length = number(settings.length ?? step, 'arpeggio note length in beats', 0.03, 16),
    velocity = number(settings.velocity ?? 72, 'arpeggio velocity', 1, 127),
    accent = number(settings.accent ?? 0, 'arpeggio accent', 0, 60),
    every = settings.every ?? 4;
  assert(Number.isInteger(steps) && steps >= 1 && steps <= 256, 'MUSIC_COMPOSE', 'An arpeggio has 1–256 steps.');
  assert(Number.isInteger(every) && every >= 1 && every <= 64, 'MUSIC_COMPOSE', 'Accents repeat every 1–64 steps.');
  return Array.from({ length: steps }, (_, index) => {
    const slot = order[index % order.length];
    assert(
      Number.isInteger(slot) && slot >= 0 && slot < sorted.length,
      'MUSIC_COMPOSE',
      'A pattern index points outside the pitches.',
    );
    return {
      beat: index * step,
      pitch: sorted[slot],
      beats: length,
      velocity: Math.max(1, Math.min(127, Math.round(velocity + (index % every === 0 ? accent : 0)))),
    };
  });
}

/**
 * Build a score from parts written in bars and beats. Bars and beats count
 * from zero. Each part becomes one track on its own MIDI channel, with
 * optional expression points and sustain pedal written as controller messages.
 */
export function arrangeMusic(input) {
  options(input, ['title', 'ppq', 'tempo', 'meter', 'bars', 'parts'], 'arrangement');
  const ppq = input.ppq ?? 480,
    meter = input.meter ?? [4, 4];
  assert(Number.isInteger(ppq) && ppq >= 24 && ppq <= 960, 'MUSIC_COMPOSE', 'Use 24–960 ticks per quarter note.');
  assert(
    Array.isArray(meter) && meter.length === 2 && [1, 2, 4, 8, 16].includes(meter[1]),
    'MUSIC_COMPOSE',
    'The meter is [beats, beat unit].',
  );
  number(meter[0], 'beats per bar', 1, 32);
  const beatTicks = (ppq * 4) / meter[1],
    barTicks = beatTicks * meter[0],
    bars = number(input.bars, 'bar count', 1, 2000);
  const tick = (bar, beat = 0) => {
    number(bar, 'bar', 0, bars);
    number(beat, 'beat', 0, meter[0] * 64);
    return Math.round(bar * barTicks + beat * beatTicks);
  };
  const tempoList =
    typeof input.tempo === 'number' ? [{ bar: 0, bpm: input.tempo }] : (input.tempo ?? [{ bar: 0, bpm: 90 }]);
  assert(
    Array.isArray(tempoList) && tempoList.length >= 1 && tempoList.length <= 256,
    'MUSIC_COMPOSE',
    'Give 1–256 tempo entries.',
  );
  const tempos = new Map();
  let last = null;
  for (const entry of tempoList) {
    options(entry, ['bar', 'beat', 'bpm', 'ramp'], 'tempo entry');
    const at = tick(entry.bar, entry.beat ?? 0),
      bpm = number(entry.bpm, 'tempo in BPM', 20, 400);
    assert(!last || at > last.at, 'MUSIC_COMPOSE', 'Tempo entries must be in ascending order.');
    if (entry.ramp && last) {
      // A ramp is written as one tempo change per beat between the two entries.
      for (let step = last.at + beatTicks; step < at; step += beatTicks) {
        const mix = (step - last.at) / (at - last.at);
        tempos.set(Math.round(step), last.bpm + (bpm - last.bpm) * mix);
      }
    }
    tempos.set(at, bpm);
    last = { at, bpm };
  }
  assert(
    Array.isArray(input.parts) && input.parts.length >= 1 && input.parts.length <= 15,
    'MUSIC_COMPOSE',
    'Arrange 1–15 parts.',
  );
  const tracks = input.parts.map((part, index) => {
    options(part, ['id', 'name', 'notes', 'expression', 'pedal', 'program', 'percussion'], 'arrangement part');
    // Channel 10 is reserved for percussion in General MIDI, so melodic parts skip it.
    const channel = part.percussion ? 9 : index < 9 ? index : index + 1;
    assert(
      Array.isArray(part.notes) && part.notes.length <= 50000,
      'MUSIC_COMPOSE',
      'A part holds up to 50,000 notes.',
    );
    const notes = [];
    for (const entry of part.notes) {
      options(entry, ['bar', 'beat', 'pitch', 'beats', 'velocity'], 'arranged note');
      const start = tick(entry.bar, entry.beat ?? 0),
        duration = Math.max(1, Math.round(number(entry.beats ?? 1, 'note length in beats', 0.01, 512) * beatTicks)),
        velocity = Math.round(number(entry.velocity ?? 72, 'note velocity', 1, 127));
      for (const pitch of Array.isArray(entry.pitch) ? entry.pitch : [entry.pitch]) {
        notes.push({ tick: start, duration, pitch: midiPitch(pitch), velocity, channel });
      }
    }
    // One key or string cannot sound twice at once. Notes of the same pitch that start
    // together are merged, and an earlier note ends where a later one begins.
    notes.sort((x, y) => x.tick - y.tick || x.pitch - y.pitch);
    const sounding = new Map(),
      kept = [];
    for (const note of notes) {
      const earlier = sounding.get(note.pitch);
      if (earlier && earlier.tick === note.tick) {
        earlier.duration = Math.max(earlier.duration, note.duration);
        earlier.velocity = Math.max(earlier.velocity, note.velocity);
        continue;
      }
      if (earlier && earlier.tick + earlier.duration > note.tick) earlier.duration = note.tick - earlier.tick;
      sounding.set(note.pitch, note);
      kept.push(note);
    }
    notes.length = 0;
    notes.push(...kept);
    const messages = [];
    if (part.program !== undefined) {
      messages.push({ tick: 0, status: 0xc0 + channel, data1: number(part.program, 'MIDI program', 0, 127) });
    }
    if (part.expression !== undefined) {
      assert(
        Array.isArray(part.expression) && part.expression.length >= 1 && part.expression.length <= 2048,
        'MUSIC_COMPOSE',
        'Give 1–2048 expression points.',
      );
      const points = part.expression.map((point) => {
        options(point, ['bar', 'beat', 'value'], 'expression point');
        return [tick(point.bar, point.beat ?? 0), number(point.value, 'expression value', 0, 1)];
      });
      for (let i = 1; i < points.length; i++)
        assert(points[i][0] > points[i - 1][0], 'MUSIC_COMPOSE', 'Expression points must be in ascending order.');
      // Controller values are written every sixteenth note so other sequencers hear the same ramps.
      const step = Math.max(1, Math.round(ppq / 4));
      let previous = -1;
      for (let i = 0; i < points.length; i++) {
        const [at, value] = points[i],
          next = points[i + 1];
        for (let position = at; position < (next ? next[0] : at + 1); position += step) {
          const level = next ? value + ((next[1] - value) * (position - at)) / (next[0] - at) : value,
            data = Math.round(level * 127);
          if (data !== previous) messages.push({ tick: position, status: 0xb0 + channel, data1: 11, data2: data });
          previous = data;
        }
      }
    }
    if (part.pedal !== undefined) {
      const changes = part.pedal === 'bar' ? Array.from({ length: bars }, (_, bar) => ({ bar })) : part.pedal;
      assert(
        Array.isArray(changes) && changes.length <= 4096,
        'MUSIC_COMPOSE',
        "Pedal is 'bar' or a list of bar and beat positions.",
      );
      const lift = Math.max(1, Math.round(ppq / 16));
      for (const [i, change] of changes.entries()) {
        options(change, ['bar', 'beat'], 'pedal change');
        const at = tick(change.bar, change.beat ?? 0);
        // The pedal lifts just before each change and goes down again just after it, as a pianist would.
        if (i > 0) messages.push({ tick: Math.max(0, at - lift), status: 0xb0 + channel, data1: 64, data2: 0 });
        messages.push({ tick: at + (i > 0 ? lift : 0), status: 0xb0 + channel, data1: 64, data2: 127 });
      }
      messages.push({ tick: bars * barTicks, status: 0xb0 + channel, data1: 64, data2: 0 });
    }
    return { id: part.id, name: part.name ?? part.id, notes, messages };
  });
  return createMusicScore({
    title: input.title ?? '',
    ppq,
    endTick: bars * barTicks,
    tempos: [...tempos]
      .sort((a, b) => a[0] - b[0])
      .map(([at, bpm]) => ({ tick: at, microsecondsPerQuarter: Math.round(60e6 / bpm) })),
    meters: [{ tick: 0, numerator: meter[0], denominator: meter[1] }],
    tracks,
  });
}
