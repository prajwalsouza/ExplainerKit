import { assert, number, options, text } from '../core/validate.js';

/** Capture trusted callbacks separately from bounded, accessor-free cue descriptors. */
export function captureCues(value = []) {
  assert(Array.isArray(value) && value.length <= 256, 'INVALID_STORY_CUES', 'Use at most 256 story cues.');
  const ids = new Set();
  return Object.freeze(
    Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, index);
      assert(descriptor && 'value' in descriptor, 'INVALID_STORY_CUES', 'Cue lists must be dense data arrays.');
      const cue = descriptor.value;
      options(cue, ['id', 'at', 'enter', 'leave', 'reverse'], 'story cue');
      const id = text(cue.id ?? String(index), 'cue id', 128),
        reverse = cue.reverse ?? 'undo';
      assert(id.length > 0 && !ids.has(id), 'INVALID_STORY_CUES', 'Cue IDs must be unique nonempty strings.');
      ids.add(id);
      assert(
        ['scrub', 'keep', 'undo', 'replay'].includes(reverse),
        'INVALID_STORY_CUES',
        'Use a declared cue reverse policy.',
      );
      assert(
        typeof cue.enter === 'function' && (cue.leave === undefined || typeof cue.leave === 'function'),
        'INVALID_STORY_CUES',
        'A cue needs enter and an optional leave callback.',
      );
      let at = cue.at;
      if (typeof at === 'string') at = text(at, 'cue act', 128);
      else if (typeof at === 'number') at = number(at, 'cue time', 0, 86400);
      else {
        options(at, ['time', 'position'], 'cue location');
        assert(Object.keys(at).length === 1, 'INVALID_STORY_CUES', 'Use one explicit time or position for a cue.');
        at = Object.hasOwn(at, 'time')
          ? Object.freeze({ time: number(at.time, 'cue time', 0, 86400) })
          : Object.freeze({ position: number(at.position, 'cue position', 0, 1e7) });
      }
      return Object.freeze({ id, at, reverse, enter: cue.enter, leave: cue.leave ?? null, index });
    }),
  );
}

/** Resolve locations without touching state, so failed timeline replacements stay transactional. */
export function locateCues(cues, timeline) {
  return cues.map((cue) => {
    let position;
    if (typeof cue.at === 'string') {
      const act = timeline.acts.find((row) => row.id === cue.at);
      assert(act, 'INVALID_STORY_CUES', `Unknown cue act: ${cue.at}.`);
      position = act.start;
    } else if (typeof cue.at === 'object' && Object.hasOwn(cue.at, 'position')) {
      position = number(cue.at.position, 'cue position', 0, timeline.length);
    } else {
      const time = typeof cue.at === 'number' ? cue.at : cue.at.time;
      position = timeline.positionAt(number(time, 'cue time', 0, timeline.duration));
    }
    return { ...cue, position };
  });
}

/** State only: the owning story supplies position/pace and owns all scheduling and disposal. */
export function cueController(cues, timeline, current) {
  let located = locateCues(cues, timeline),
    previous = null,
    busy = false,
    disposed = false;
  const states = cues.map(() => ({ above: false, fired: false }));
  const cancellation = new AbortController();
  return Object.freeze({
    validate(next) {
      assert(!busy, 'STORY_CUE_REENTRANCY', 'A cue callback cannot recursively update its story.');
      return locateCues(cues, next);
    },
    remap(next) {
      located = locateCues(cues, next);
      timeline = next;
    },
    advance(sampled, pace, reduced, position = sampled.position) {
      if (disposed || !current()) return;
      assert(!busy, 'STORY_CUE_REENTRANCY', 'A cue callback cannot recursively advance its story.');
      const direction = previous === null ? 1 : Math.sign(position - previous);
      const moved = previous === null || position !== previous;
      previous = position;
      const ordered = [...located].sort((a, b) => a.position - b.position || a.index - b.index);
      if (direction < 0) ordered.reverse();
      busy = true;
      try {
        for (const cue of ordered) {
          if (disposed || !current()) break;
          const state = states[cue.index],
            above = position >= cue.position;
          let phase = null;
          if (above && !state.above && (!state.fired || cue.reverse !== 'keep')) phase = 'enter';
          else if (!above && state.above && ['undo', 'scrub'].includes(cue.reverse)) phase = 'leave';
          else if (above && state.above && moved && cue.reverse === 'scrub') phase = 'scrub';
          state.above = above;
          if (phase === 'enter') state.fired = true;
          if (!above && cue.reverse === 'replay') state.fired = false;
          if (!phase) continue;
          const callback = phase === 'leave' ? cue.leave : cue.enter;
          if (!callback) continue;
          callback(
            Object.freeze({
              id: cue.id,
              at: cue.position,
              position,
              time: sampled.time,
              progress: Math.max(0, Math.min(1, position / timeline.length)),
              act: sampled.act,
              direction: direction || (above ? 1 : -1),
              pace: pace.pace,
              velocity: pace.velocity,
              speed: pace.speed,
              rushing: !!reduced || pace.pace === 'rushing',
              phase,
              signal: cancellation.signal,
            }),
          );
        }
      } finally {
        busy = false;
      }
    },
    dispose() {
      disposed = true;
      cancellation.abort();
    },
  });
}
