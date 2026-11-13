import { assert } from '../core/validate.js';
import { SCORE_LIMITS, createMusicScore, scoreTick, record } from './score.js';

const MAX_BYTES = 8 * 1024 * 1024;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const typedArray = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayType = Object.getOwnPropertyDescriptor(typedArray, Symbol.toStringTag).get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArray, 'buffer').get;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(typedArray, 'byteLength').get;
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;

function isUnsharedBuffer(buffer) {
  try {
    arrayBufferByteLength.call(buffer);
    return true;
  } catch {
    return false;
  }
}

function midi(condition, message) {
  assert(condition, 'MUSIC_MIDI', message);
}

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
  }
  get remaining() {
    return this.bytes.length - this.offset;
  }
  byte() {
    midi(this.remaining > 0, 'Unexpected end of MIDI data.');
    return this.bytes[this.offset++];
  }
  data() {
    const value = this.byte();
    midi(value < 128, 'Invalid MIDI channel data byte.');
    return value;
  }
  uint(length) {
    let value = 0;
    for (let i = 0; i < length; i++) value = value * 256 + this.byte();
    return value;
  }
  vlq() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.byte();
      value = value * 128 + (byte & 127);
      if (byte < 128) return value;
    }
    midi(false, 'MIDI variable-length quantity exceeds four bytes.');
  }
  take(length) {
    midi(length <= this.remaining, 'MIDI chunk exceeds its input.');
    const start = this.offset;
    this.offset += length;
    return this.bytes.subarray(start, this.offset);
  }
  tag() {
    return String.fromCharCode(...this.take(4));
  }
}

function timingEvent(map, event, warn) {
  if (map.has(event.tick)) warn('coincident-timing');
  map.set(event.tick, event);
}

function meta(reader, tick, track, state) {
  const type = reader.byte();
  const data = reader.take(reader.vlq());
  const length = (expected) => midi(data.length === expected, 'Invalid MIDI meta event length.');
  switch (type) {
    case 0x2f:
      length(0);
      return true;
    case 0x03:
      if (track.name || data.length > 1024) state.warn('track-name');
      if (!track.name) track.name = decoder.decode(data.subarray(0, 1024)).slice(0, 256);
      break;
    case 0x51:
      length(3);
      timingEvent(
        state.tempos,
        { tick, microsecondsPerQuarter: (data[0] << 16) | (data[1] << 8) | data[2] },
        state.warn,
      );
      break;
    case 0x58:
      length(4);
      timingEvent(
        state.meters,
        { tick, numerator: data[0], denominator: 2 ** data[1], clocks: data[2], thirtySeconds: data[3] },
        state.warn,
      );
      break;
    default:
      state.warn(`meta-${type.toString(16).padStart(2, '0')}`);
  }
  return false;
}

function readTrack(reader, index, state) {
  const track = { name: '', notes: [], messages: [], endTick: 0 };
  const pending = new Map();
  let tick = 0,
    status = 0,
    ended = false,
    order = 0;
  while (reader.remaining && !ended) {
    midi(--state.remaining >= 0, 'MIDI event limit exceeded.');
    tick = scoreTick(tick + reader.vlq());
    let first = reader.byte();
    if (first === 0xff) {
      ended = meta(reader, tick, track, state);
      status = 0;
      continue;
    }
    if (first === 0xf0 || first === 0xf7) {
      reader.take(reader.vlq());
      state.warn('system-exclusive');
      status = 0;
      continue;
    }
    if (first >= 128) {
      midi(first < 0xf0, 'Unsupported MIDI status.');
      status = first;
      first = reader.data();
    }
    midi(status !== 0, 'MIDI running status has no preceding channel event.');
    const type = status >> 4,
      channel = status & 15;
    const second = type === 12 || type === 13 ? undefined : reader.data();
    if (type !== 8 && type !== 9) {
      track.messages.push({ tick, status, data1: first, ...(second === undefined ? {} : { data2: second }) });
      continue;
    }
    const key = channel * 128 + first;
    if (type === 9 && second > 0) {
      if (!pending.has(key)) pending.set(key, { notes: [], head: 0 });
      pending
        .get(key)
        .notes.push({ id: `note-${index + 1}-${++order}`, tick, pitch: first, channel, velocity: second });
      continue;
    }
    const queue = pending.get(key);
    if (!queue) {
      state.warn('unmatched-note-off');
      continue;
    }
    const note = queue.notes[queue.head++];
    if (queue.head === queue.notes.length) pending.delete(key);
    track.notes.push({ ...note, duration: tick - note.tick, releaseVelocity: type === 8 ? second : 0 });
  }
  midi(ended && !reader.remaining, 'MIDI track must end with an end-of-track event.');
  for (const queue of pending.values()) {
    for (let i = queue.head; i < queue.notes.length; i++) {
      const note = queue.notes[i];
      track.notes.push({ ...note, duration: tick - note.tick });
      state.warn('unterminated-note');
    }
  }
  track.endTick = tick;
  // Preserve note-on order for coincident starts, including equal pitches.
  track.notes.sort((a, b) => a.tick - b.tick || Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
  return track;
}

/** Parse a bounded Standard MIDI File. Unsupported event counts are returned alongside the score. */
export function readMidi(input) {
  midi(
    typedArrayType.call(input) === 'Uint8Array' && isUnsharedBuffer(typedArrayBuffer.call(input)),
    'MIDI input must be Uint8Array bytes.',
  );
  midi(typedArrayByteLength.call(input) <= MAX_BYTES, 'MIDI file exceeds 8 MiB.');
  const reader = new Reader(new Uint8Array(input));
  midi(reader.tag() === 'MThd', 'Missing MIDI header.');
  const header = new Reader(reader.take(reader.uint(4)));
  const format = header.uint(2),
    trackCount = header.uint(2),
    ppq = header.uint(2);
  midi(format === 0 || format === 1, 'Only Standard MIDI File formats 0 and 1 are supported.');
  midi(ppq > 0 && ppq < 32768, 'Only metrical MIDI time division is supported.');
  midi(
    trackCount >= 1 && trackCount <= SCORE_LIMITS.tracks + (format === 1 ? 1 : 0) && (format === 1 || trackCount === 1),
    'Invalid MIDI track count.',
  );
  const warnings = new Map();
  const state = {
    tempos: new Map(),
    meters: new Map(),
    remaining: SCORE_LIMITS.events * 2 + SCORE_LIMITS.tracks * 2 + 2,
    warn(code) {
      warnings.set(code, (warnings.get(code) ?? 0) + 1);
    },
  };
  const tracks = [];
  while (reader.remaining) {
    const tag = reader.tag(),
      body = reader.take(reader.uint(4));
    if (tag !== 'MTrk') {
      state.warn('unknown-chunk');
      continue;
    }
    midi(tracks.length < trackCount, 'More MIDI tracks than declared.');
    tracks.push(readTrack(new Reader(body), tracks.length, state));
  }
  midi(tracks.length === trackCount, 'Fewer MIDI tracks than declared.');
  const conductor = format === 1 && !tracks[0].notes.length && !tracks[0].messages.length ? tracks.shift() : undefined;
  const score = createMusicScore({
    ppq,
    endTick: conductor?.endTick,
    title: conductor?.name ?? (format === 0 ? tracks[0].name : ''),
    tracks,
    tempos: [...state.tempos.values()],
    meters: [...state.meters.values()],
  });
  return Object.freeze({
    format,
    score,
    warnings: Object.freeze([...warnings].map(([code, count]) => Object.freeze({ code, count }))),
  });
}

function vlq(value) {
  const bytes = [value & 127];
  while ((value >>>= 7)) bytes.unshift((value & 127) | 128);
  return bytes;
}

function chunk(tag, bytes) {
  const length = bytes.length;
  const output = new Uint8Array(length + 8);
  output.set([...encoder.encode(tag), length >>> 24, length >>> 16, length >>> 8, length]);
  output.set(bytes, 8);
  return output;
}

function trackName(events, name) {
  if (!name) return;
  const bytes = encoder.encode(name);
  events.push({ tick: 0, priority: -3, bytes: [255, 3, ...vlq(bytes.length), ...bytes] });
}

function trackBytes(events, end) {
  const output = [];
  let previous = 0;
  const active = new Map();
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  for (const event of events) {
    if (event.note) {
      const key = (event.note.channel << 7) + event.note.pitch;
      if (!active.has(key)) active.set(key, { ids: [], head: 0 });
      const queue = active.get(key);
      if (event.on) queue.ids.push(event.note.id);
      else {
        midi(
          queue.ids[queue.head++] === event.note.id,
          'MIDI cannot preserve nested notes with the same channel and pitch.',
        );
        if (queue.head === queue.ids.length) active.delete(key);
      }
    }
    output.push(...vlq(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  output.push(...vlq(end - previous), 255, 47, 0);
  return chunk('MTrk', output);
}

function trackEvents(events, track) {
  for (const message of track.messages) {
    events.push({
      tick: message.tick,
      priority: -2,
      bytes: [message.status, message.data1, ...(message.data2 === undefined ? [] : [message.data2])],
    });
  }
  for (const note of track.notes) {
    events.push({
      tick: note.tick,
      priority: 0,
      bytes: [0x90 | note.channel, note.pitch, note.velocity],
      note,
      on: true,
    });
    events.push({
      tick: note.tick + note.duration,
      priority: note.duration ? -1 : 1,
      bytes: [0x80 | note.channel, note.pitch, note.releaseVelocity],
      note,
    });
  }
}

/** Write metrical SMF, using a conductor track in format 1. */
export function writeMidi(input, options = {}) {
  const score = createMusicScore(input),
    { format = 1 } = record(options, ['format'], 'MIDI options');
  midi(format === 0 || format === 1, 'MIDI format must be 0 or 1.');
  midi(format !== 0 || score.tracks.length <= 1, 'Format 0 requires a score with at most one track.');
  const timing = [];
  trackName(timing, format === 0 ? score.title || score.tracks[0]?.name : score.title);
  for (const { tick, microsecondsPerQuarter: value } of score.tempos) {
    timing.push({ tick, priority: -3, bytes: [255, 81, 3, value >>> 16, (value >>> 8) & 255, value & 255] });
  }
  for (const meter of score.meters) {
    timing.push({
      tick: meter.tick,
      priority: -3,
      bytes: [255, 88, 4, meter.numerator, Math.log2(meter.denominator), meter.clocks, meter.thirtySeconds],
    });
  }
  const chunks = [];
  if (format === 0 && score.tracks[0]) trackEvents(timing, score.tracks[0]);
  chunks.push(trackBytes(timing, score.endTick));
  if (format === 1)
    for (const track of score.tracks) {
      const events = [];
      trackName(events, track.name);
      trackEvents(events, track);
      chunks.push(trackBytes(events, track.endTick));
    }
  const header = chunk('MThd', [0, format, chunks.length >>> 8, chunks.length & 255, score.ppq >>> 8, score.ppq & 255]);
  const output = new Uint8Array(chunks.reduce((length, track) => length + track.length, header.length));
  output.set(header);
  let offset = header.length;
  for (const track of chunks) {
    output.set(track, offset);
    offset += track.length;
  }
  return output;
}
