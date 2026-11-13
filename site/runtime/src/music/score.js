import { assert } from '../core/validate.js';

export const SCORE_LIMITS = Object.freeze({ tracks: 128, events: 100_000, tick: 0x0fffffff });
const validated = new WeakSet();

export function record(value, fields, label) {
  assert(value && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'MUSIC_SCORE', `Invalid ${label}.`);
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert(fields.includes(key) && 'value' in descriptor, 'MUSIC_SCORE', `Invalid field in ${label}.`);
    result[key] = descriptor.value;
  }
  return result;
}

export function list(value, limit, label) {
  assert(Array.isArray(value) && value.length <= limit, 'MUSIC_SCORE', `Invalid or oversized ${label}.`);
  return Array.from({ length: value.length }, (_, index) => {
    const entry = Object.getOwnPropertyDescriptor(value, index);
    assert(entry && 'value' in entry, 'MUSIC_SCORE', `Invalid entry in ${label}.`);
    return entry.value;
  });
}

export function integer(value, min, max, label) {
  assert(Number.isInteger(value) && value >= min && value <= max, 'MUSIC_SCORE', `Invalid ${label}.`);
  return value;
}

function scoreLabel(value, limit) {
  assert(typeof value === 'string' && value.length <= limit, 'MUSIC_SCORE', 'Invalid score label.');
  return value;
}

function id(value, used) {
  assert(
    typeof value === 'string' && value.length > 0 && value.length <= 128 && !used.has(value),
    'MUSIC_SCORE',
    'Score IDs must be unique and nonempty.',
  );
  used.add(value);
  return value;
}

export const scoreTick = (tick) => integer(tick, 0, SCORE_LIMITS.tick, 'score tick');

function changes(input, remaining, fields, normalize, name) {
  const sorted = list(input, remaining, name)
    .map((item) => {
      const entry = record(item, ['tick', ...fields], name);
      return Object.freeze({ tick: scoreTick(entry.tick), ...normalize(entry) });
    })
    .sort((a, b) => a.tick - b.tick);
  for (let i = 1; i < sorted.length; i++) {
    assert(sorted[i - 1].tick !== sorted[i].tick, 'MUSIC_SCORE', `Multiple ${name} changes at one tick.`);
  }
  return Object.freeze(sorted);
}

/** Build a versioned, immutable score from plain data. Ticks are relative to the beginning of the score. */
export function createMusicScore(input = {}) {
  if (validated.has(input)) return input;
  const source = record(input, ['version', 'title', 'ppq', 'endTick', 'tempos', 'meters', 'tracks'], 'score');
  const version = integer(source.version ?? 1, 1, 1, 'score version');
  const title = scoreLabel(source.title ?? '', 256);
  const ppq = integer(source.ppq ?? 480, 1, 32767, 'ticks per quarter note');
  const tempos = changes(
    source.tempos ?? [],
    SCORE_LIMITS.events,
    ['microsecondsPerQuarter'],
    (item) => ({
      microsecondsPerQuarter: integer(item.microsecondsPerQuarter, 1, 0xffffff, 'tempo'),
    }),
    'tempo',
  );
  const meters = changes(
    source.meters ?? [],
    SCORE_LIMITS.events - tempos.length,
    ['numerator', 'denominator', 'clocks', 'thirtySeconds'],
    (item) => {
      const denominator = integer(item.denominator, 1, 128, 'meter denominator');
      assert((denominator & (denominator - 1)) === 0, 'MUSIC_SCORE', 'Meter denominator must be a power of two.');
      return {
        numerator: integer(item.numerator, 1, 255, 'meter numerator'),
        denominator,
        clocks: integer(item.clocks ?? 24, 0, 255, 'clocks per click'),
        thirtySeconds: integer(item.thirtySeconds ?? 8, 0, 255, '32nd notes per quarter'),
      };
    },
    'meter',
  );

  const trackIds = new Set(),
    noteIds = new Set();
  let remaining = SCORE_LIMITS.events - tempos.length - meters.length;
  let endTick = Math.max(
    source.endTick === undefined ? 0 : scoreTick(source.endTick),
    tempos.at(-1)?.tick ?? 0,
    meters.at(-1)?.tick ?? 0,
  );
  const tracks = list(source.tracks ?? [], SCORE_LIMITS.tracks, 'tracks').map((trackValue, trackIndex) => {
    const track = record(trackValue, ['id', 'name', 'notes', 'messages', 'endTick'], 'track');
    const trackId = id(track.id ?? `track-${trackIndex + 1}`, trackIds);
    const notes = list(track.notes ?? [], remaining, 'notes')
      .map((value, index) => {
        const note = record(
          value,
          ['id', 'tick', 'duration', 'pitch', 'velocity', 'releaseVelocity', 'channel'],
          'note',
        );
        const tick = scoreTick(note.tick);
        return Object.freeze({
          id: id(note.id ?? `note-${trackIndex + 1}-${index + 1}`, noteIds),
          tick,
          duration: integer(note.duration, 0, SCORE_LIMITS.tick - tick, 'note duration'),
          pitch: integer(note.pitch, 0, 127, 'pitch'),
          velocity: integer(note.velocity ?? 80, 1, 127, 'velocity'),
          releaseVelocity: integer(note.releaseVelocity ?? 0, 0, 127, 'release velocity'),
          channel: integer(note.channel ?? 0, 0, 15, 'channel'),
        });
      })
      .sort((a, b) => a.tick - b.tick);
    remaining -= notes.length;
    const messages = list(track.messages ?? [], remaining, 'MIDI messages')
      .map((value) => {
        const message = record(value, ['tick', 'status', 'data1', 'data2'], 'MIDI message');
        const status = integer(message.status, 0xa0, 0xef, 'MIDI message status');
        const oneByte = status >> 4 === 12 || status >> 4 === 13;
        assert(!oneByte || message.data2 === undefined, 'MUSIC_SCORE', 'Unexpected second MIDI data byte.');
        const data = { tick: scoreTick(message.tick), status, data1: integer(message.data1, 0, 127, 'MIDI data') };
        if (!oneByte) data.data2 = integer(message.data2, 0, 127, 'MIDI data');
        return Object.freeze(data);
      })
      .sort((a, b) => a.tick - b.tick);
    remaining -= messages.length;
    let trackEnd = Math.max(track.endTick === undefined ? 0 : scoreTick(track.endTick), messages.at(-1)?.tick ?? 0);
    for (const note of notes) trackEnd = Math.max(trackEnd, note.tick + note.duration);
    endTick = Math.max(endTick, trackEnd);
    return Object.freeze({
      id: trackId,
      name: scoreLabel(track.name ?? '', 256),
      notes: Object.freeze(notes),
      messages: Object.freeze(messages),
      endTick: trackEnd,
    });
  });
  const score = Object.freeze({ version, title, ppq, endTick, tempos, meters, tracks: Object.freeze(tracks) });
  validated.add(score);
  return score;
}

/** Convert fractional ticks and seconds using a piecewise-constant tempo map. */
export function musicScoreTime(input) {
  const score = createMusicScore(input);
  const points = [
    {
      tick: 0,
      seconds: 0,
      rate: (score.tempos[0]?.tick === 0 ? score.tempos[0].microsecondsPerQuarter : 500000) / (score.ppq * 1e6),
    },
  ];
  for (const tempo of score.tempos) {
    if (tempo.tick === 0) continue;
    const previous = points.at(-1);
    points.push({
      tick: tempo.tick,
      seconds: previous.seconds + (tempo.tick - previous.tick) * previous.rate,
      rate: tempo.microsecondsPerQuarter / (score.ppq * 1e6),
    });
  }
  function point(key, value) {
    assert(Number.isFinite(value) && value >= 0, 'MUSIC_SCORE', 'Time must be finite and nonnegative.');
    let low = 0,
      high = points.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (points[mid][key] <= value) low = mid;
      else high = mid;
    }
    return points[low];
  }
  const secondsAt = (tick) => {
    const p = point('tick', tick);
    const seconds = p.seconds + (tick - p.tick) * p.rate;
    assert(Number.isFinite(seconds), 'MUSIC_SCORE', 'Time exceeds numeric range.');
    return seconds;
  };
  const tickAt = (seconds) => {
    const p = point('seconds', seconds);
    const tick = p.tick + (seconds - p.seconds) / p.rate;
    assert(Number.isFinite(tick), 'MUSIC_SCORE', 'Tick exceeds numeric range.');
    return tick;
  };
  return Object.freeze({ secondsAt, tickAt, duration: secondsAt(score.endTick) });
}
