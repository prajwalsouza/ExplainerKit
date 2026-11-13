import { assert, number } from '../core/validate.js';

function callbackError(cause) {
  let message = 'Listener threw a non-Error value.';
  try {
    if (cause instanceof Error && typeof cause.message === 'string') message = cause.message;
  } catch {
    /* Keep reporting safe. */
  }
  return Object.assign(new Error(message), { code: 'CALLBACK_FAILED', cause });
}

/**
 * One browser timeline for scene players and films. A sample must succeed before
 * its time is committed. Rendering, models and narration remain caller concerns.
 */
export function createClock({
  host,
  duration,
  sample,
  reducedMotion,
  advance = (next) => next,
  needsFrame = () => false,
  maxDelta = Infinity,
}) {
  assert(
    host && typeof host.requestAnimationFrame === 'function' && typeof host.cancelAnimationFrame === 'function',
    'UNSUPPORTED_BROWSER',
    'Playback needs animation-frame scheduling.',
  );
  assert(typeof sample === 'function', 'INVALID_CLOCK', 'A clock needs a sample callback.');
  const getDuration = typeof duration === 'function' ? duration : () => duration;
  const media = host.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let reduced = reducedMotion ?? media?.matches ?? false;
  let time = 0,
    playing = false,
    disposed = false,
    driver = null,
    request = null,
    lastStamp = null,
    speed = 1;
  let sampling = false,
    dirty = false,
    lastResult;
  const listeners = new Map();
  const live = () => assert(!disposed, 'DISPOSED', 'This player has been disposed.');
  const total = () => number(getDuration(), 'duration', 0, 86400);

  function emit(name, value) {
    for (const listener of [...(listeners.get(name) ?? [])]) {
      try {
        listener(value);
      } catch (cause) {
        if (name !== 'error')
          for (const report of [...(listeners.get('error') ?? [])]) {
            try {
              report(callbackError(cause));
            } catch {
              /* Error listeners cannot interrupt cleanup. */
            }
          }
      }
    }
  }
  function cancel() {
    if (request !== null) host.cancelAnimationFrame(request);
    request = null;
  }
  function schedule() {
    if (!disposed && request === null) request = host.requestAnimationFrame(tick);
  }
  function commit(next, kind, reset = false) {
    live();
    assert(!sampling, 'REENTRANT_SAMPLE', 'A sample cannot start another seek or refresh.');
    sampling = true;
    dirty = false;
    let result;
    try {
      result = sample(next, { kind, reset });
    } finally {
      sampling = false;
    }
    // Keep the previous timestamp when sampling or rendering throws.
    time = next;
    lastResult = result;
    emit('frame', { time, ...(result ?? {}) });
    return result;
  }
  function tick(stamp) {
    request = null;
    if (disposed) return;
    let next = time;
    if (playing && driver !== 'media') {
      const delta = lastStamp === null ? 0 : Math.min(maxDelta, Math.max(0, (stamp - lastStamp) / 1000));
      next = number(advance(Math.min(total(), time + delta * speed), time), 'next time', 0, total());
      lastStamp = stamp;
    }
    try {
      commit(next, playing ? 'tick' : 'refresh');
    } catch (error) {
      clock.pause();
      cancel();
      emit('error', error);
      return;
    }
    if (playing && time >= total()) clock.pause();
    if (!disposed && ((playing && driver !== 'media') || needsFrame() || dirty)) schedule();
  }
  const motionChanged = () => {
    if (reducedMotion !== undefined || disposed) return;
    reduced = media.matches;
    if (reduced) {
      clock.pause('reduced-motion');
      emit('motionBlocked', 'Reduced motion enabled: playback paused.');
    }
  };
  const clock = {
    get time() {
      return time;
    },
    get duration() {
      return total();
    },
    get playing() {
      return playing;
    },
    get disposed() {
      return disposed;
    },
    get driver() {
      return driver;
    },
    get reducedMotion() {
      return reduced;
    },
    get speed() {
      return speed;
    },
    set speed(value) {
      live();
      speed = number(value, 'playback speed', 0.1, 16);
      emit('rate', speed);
    },
    on(name, listener) {
      live();
      assert(typeof listener === 'function', 'INVALID_LISTENER', 'An event listener must be a function.');
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => listeners.get(name)?.delete(listener);
    },
    reportError(error) {
      emit('error', error);
    },
    emit(name, value) {
      live();
      emit(name, value);
    },
    setDriver(next) {
      live();
      assert(next === null || next === 'scroll' || next === 'media', 'INVALID_DRIVER', 'Unsupported driver.');
      if (next !== null) assert(driver === null, 'DRIVER_OWNED', 'Detach the existing driver first.');
      clock.pause();
      live();
      driver = next;
      emit('driver', driver);
      return clock;
    },
    seek(seconds, { reset = true, source = 'manual' } = {}) {
      live();
      assert(
        driver === null || source === driver || (driver === 'media' && source === 'manual'),
        'DRIVER_OWNED',
        'Detach scroll before seeking manually.',
      );
      const next = number(seconds, 'seek', 0, total());
      clock.pause();
      cancel();
      live();
      commit(next, 'seek', reset);
      emit('seek', time);
      if (needsFrame() || dirty) schedule();
      return clock;
    },
    sync(seconds, { source = 'media', playing: active = false } = {}) {
      live();
      assert(
        driver === source && source === 'media',
        'DRIVER_OWNED',
        'Only the active media driver can synchronize time.',
      );
      assert(typeof active === 'boolean', 'INVALID_CLOCK', 'Media playing state must be boolean.');
      const next = number(seconds, 'media time', 0, total());
      commit(next, 'media', false);
      const changed = playing !== (active && !reduced);
      playing = active && !reduced;
      cancel();
      lastStamp = null;
      if (changed) emit(playing ? 'play' : 'pause');
      if (needsFrame() || dirty) schedule();
      return clock;
    },
    play() {
      live();
      if (driver === 'media') {
        if (reduced) emit('motionBlocked', 'Reduced motion: use the seek bar or chapter controls.');
        else {
          if (time >= total()) clock.seek(0);
          emit('requestPlay');
        }
        return clock;
      }
      assert(driver === null, 'DRIVER_OWNED', 'Detach scroll before playing.');
      if (reduced) {
        emit('motionBlocked', 'Reduced motion: use the seek bar or chapter controls.');
        return clock;
      }
      if (playing) return clock;
      if (time >= total()) clock.seek(0);
      playing = true;
      lastStamp = null;
      schedule();
      emit('play');
      return clock;
    },
    pause(reason = undefined) {
      if (disposed) return clock;
      playing = false;
      lastStamp = null;
      cancel();
      emit('pause', reason === 'reduced-motion' ? { reason } : undefined);
      if (needsFrame()) schedule();
      return clock;
    },
    refresh() {
      live();
      if (sampling) {
        dirty = true;
        return lastResult;
      }
      const result = commit(time, 'refresh');
      if (needsFrame() || dirty) schedule();
      else if (!playing || driver === 'media') cancel();
      return result;
    },
    invalidate() {
      if (disposed) return;
      dirty = true;
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      driver = null;
      cancel();
      media?.removeEventListener?.('change', motionChanged);
      emit('dispose');
      listeners.clear();
    },
  };
  total();
  media?.addEventListener?.('change', motionChanged);
  return clock;
}
