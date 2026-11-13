import { assert, number } from '../core/validate.js';
import { createMusicScore, integer, list, record, SCORE_LIMITS, scoreTick } from './score.js';

const noteFields = ['id', 'tick', 'duration', 'pitch', 'velocity', 'releaseVelocity', 'channel', 'remove'];

/** Apply edits by stable note ID in one validated, immutable operation. */
export function editMusicNotes(input, edits) {
  const score = createMusicScore(input);
  const changes = new Map();
  for (const entry of list(edits, SCORE_LIMITS.events, 'note edits')) {
    const { id, remove = false, ...patch } = record(entry, noteFields, 'note edit');
    assert(typeof id === 'string' && !changes.has(id), 'MUSIC_SCORE', 'Each edited note needs a unique ID.');
    assert(typeof remove === 'boolean', 'MUSIC_SCORE', 'Note removal must be boolean.');
    changes.set(id, { remove, patch });
  }
  const tracks = score.tracks.map((track) => {
    const notes = [];
    for (const note of track.notes) {
      const change = changes.get(note.id);
      if (!change) notes.push(note);
      else {
        if (!change.remove) notes.push({ ...note, ...change.patch });
        changes.delete(note.id);
      }
    }
    return { ...track, notes };
  });
  assert(!changes.size, 'MUSIC_SCORE', 'Note edit refers to an unknown ID.');
  return createMusicScore({ ...score, tracks });
}

/** Copy a phrase by note onset. Source notes and MIDI messages are preserved. */
export function repeatMusicPhrase(input, spec) {
  const score = createMusicScore(input);
  const {
    id,
    start,
    end,
    at,
    tracks: selected,
    transpose = 0,
    velocityScale = 1,
  } = record(spec, ['id', 'start', 'end', 'at', 'tracks', 'transpose', 'velocityScale'], 'phrase repetition');
  scoreTick(start);
  scoreTick(end);
  scoreTick(at);
  integer(transpose, -127, 127, 'phrase transposition');
  number(velocityScale, 'phrase velocity scale', 0, 2);
  assert(
    end > start && typeof id === 'string' && id.length > 0 && id.length <= 64,
    'MUSIC_SCORE',
    'A repetition needs an ID and a nonempty source interval.',
  );
  const trackIds = new Set(score.tracks.map((track) => track.id));
  const selection = selected === undefined ? trackIds : new Set(list(selected, SCORE_LIMITS.tracks, 'phrase tracks'));
  for (const trackId of selection) assert(trackIds.has(trackId), 'MUSIC_SCORE', 'Unknown phrase track.');
  const tracks = score.tracks.map((track, trackIndex) => {
    if (!selection.has(track.id)) return track;
    const copies = [];
    for (const [index, note] of track.notes.entries()) {
      if (note.tick < start || note.tick >= end) continue;
      copies.push({
        ...note,
        id: `${id}:${trackIndex + 1}:${index + 1}`,
        tick: at + note.tick - start,
        pitch: note.pitch + transpose,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity * velocityScale))),
      });
    }
    return { ...track, notes: [...track.notes, ...copies] };
  });
  return createMusicScore({ ...score, endTick: Math.max(score.endTick, at + end - start), tracks });
}
