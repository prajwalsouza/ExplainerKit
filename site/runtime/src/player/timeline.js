import { assert, number, options } from '../core/validate.js';
import { createClock } from './clock.js';
import { sharedFrameHost } from './frame-host.js';
import { isTimeline } from '../motion/timeline.js';

/**
 * @typedef {Object} TimelinePlayerOptions
 * @property {any} [host]
 * @property {(snapshot:any,context:Readonly<{time:number,previousTime:number,backwards:boolean,kind:string}>)=>void} [project]
 * @property {(snapshot:import('../motion/timeline.js').TimelineValuesSnapshot,context:Readonly<{time:number,previousTime:number,backwards:boolean,kind:string}>)=>void} [projectValues]
 * @property {(event:any,context:Readonly<{time:number,previousTime:number,backwards:boolean,kind:string}>)=>void} [onEvent]
 * @property {boolean} [reducedMotion]
 * @property {number} [horizon] Finite playback limit in seconds, at most 86400.
 * @property {number} [maxEvents] Maximum crossings per sample, at most 10000.
 */

/**
 * Run a pure native timeline on the existing player clock. All times are seconds.
 * Construction projects time zero without dispatching events. Crossings are
 * planned before any projection/event callbacks; callbacks are trusted effects.
 * @param {import('../motion/timeline.js').Timeline} timeline
 * @param {TimelinePlayerOptions} spec
 */
export function createTimelinePlayer(timeline, spec) {
  assert(isTimeline(timeline), 'INVALID_TIMELINE', 'Use a native ExplainerKit timeline.');
  options(
    spec,
    ['host', 'project', 'projectValues', 'onEvent', 'reducedMotion', 'horizon', 'maxEvents'],
    'timeline player',
  );
  const positionalProjection = spec.projectValues !== undefined;
  assert(
    positionalProjection
      ? typeof spec.projectValues === 'function' && spec.project === undefined
      : typeof spec.project === 'function',
    'INVALID_PROJECTION',
    'Provide exactly one trusted project or projectValues callback.',
  );
  assert(
    spec.onEvent === undefined || typeof spec.onEvent === 'function',
    'INVALID_CALLBACK',
    'onEvent must be a function.',
  );
  assert(
    spec.reducedMotion === undefined || typeof spec.reducedMotion === 'boolean',
    'INVALID_OPTIONS',
    'reducedMotion must be boolean.',
  );
  const horizon = number(spec.horizon ?? 86400, 'timeline playback horizon', 0, 86400),
    maxEvents = number(spec.maxEvents ?? 1024, 'timeline event limit', 1, 10000);
  assert(Number.isInteger(maxEvents), 'INVALID_NUMBER', 'The timeline event limit must be an integer.');
  const host = sharedFrameHost(spec.host ?? globalThis);
  let model = timeline,
    project = spec.project,
    projectValues = spec.projectValues,
    onEvent = spec.onEvent,
    frame = null,
    readFrame = null,
    state = null,
    prepared = null,
    error = null,
    initialEvents = true,
    backwards = false,
    restarting = false,
    muted = true,
    lastDuration = 0;
  function duration() {
    if (!model) return lastDuration;
    const total = model.duration;
    assert(
      total === Infinity || (Number.isFinite(total) && total >= 0),
      'INVALID_TIMELINE',
      'Timeline duration must be nonnegative.',
    );
    return (lastDuration = Math.min(total, horizon));
  }
  const clock = createClock({
    host,
    duration,
    reducedMotion: spec.reducedMotion,
    sample(time, { kind = 'refresh' } = {}) {
      const previousTime = clock.time,
        context = Object.freeze({ time, previousTime, backwards: !restarting && time < previousTime, kind });
      try {
        if (positionalProjection && (!prepared || prepared.version !== model.version)) prepared = model.prepare();
        const snapshot = positionalProjection ? prepared.sample(time) : model.sample(time),
          events = muted ? [] : model.eventsBetween(initialEvents ? -1e-9 : previousTime, time, { maxEvents });
        if (positionalProjection) projectValues(snapshot, context);
        else project(snapshot, context);
        assert(!clock.disposed, 'DISPOSED', 'The player was disposed during projection.');
        for (const event of events) {
          onEvent?.(event, context);
          assert(!clock.disposed, 'DISPOSED', 'The player was disposed during an event.');
        }
        state = snapshot;
        error = null;
        backwards = context.backwards;
        if (!muted || ((kind === 'seek' || kind === 'media') && time > 0)) initialEvents = false;
        if (positionalProjection) {
          // Hold this already validated packet. Inspection must never re-run
          // easing/modifier callbacks, including after later seeks or edits.
          let named = null;
          readFrame = () => {
            if (!named) {
              const values = {};
              for (let index = 0; index < snapshot.channels.length; index++)
                values[snapshot.channels[index]] = snapshot.values[index];
              named = Object.freeze({
                values: Object.freeze(values),
                localTime: snapshot.localTime,
                iteration: snapshot.iteration,
                direction: snapshot.direction,
                duration: snapshot.duration,
              });
            }
            return named;
          };
          frame = null;
          return { readFrame };
        }
        readFrame = null;
        frame = snapshot;
        return { frame };
      } catch (cause) {
        error = cause;
        throw cause;
      }
    },
  });
  const player = {
    get time() {
      return clock.time;
    },
    get duration() {
      return clock.duration;
    },
    get progress() {
      return clock.duration ? clock.time / clock.duration : 0;
    },
    get iterationTime() {
      return state?.localTime ?? 0;
    },
    get iteration() {
      return state?.iteration ?? 0;
    },
    get backwards() {
      return backwards;
    },
    get completed() {
      return clock.time >= clock.duration;
    },
    get playing() {
      return clock.playing;
    },
    get disposed() {
      return clock.disposed;
    },
    get reducedMotion() {
      return clock.reducedMotion;
    },
    get frame() {
      return readFrame ? readFrame() : frame;
    },
    get error() {
      return error;
    },
    get speed() {
      return clock.speed;
    },
    set speed(value) {
      clock.speed = value;
    },
    get driver() {
      return clock.driver;
    },
    on(name, listener) {
      if (positionalProjection && name === 'frame') {
        assert(typeof listener === 'function', 'INVALID_CALLBACK', 'Provide a frame listener.');
        return clock.on(name, (event) => {
          const payload = { time: event.time };
          // Each event captures its own reader, so retained/reentrant events
          // cannot observe a later frame. Existing projection mode is unchanged.
          Object.defineProperty(payload, 'frame', { enumerable: true, get: event.readFrame });
          listener(payload);
        });
      }
      return clock.on(name, listener);
    },
    reportError(cause) {
      clock.reportError(cause);
    },
    setDriver(driver) {
      clock.setDriver(driver);
      return player;
    },
    /** @param {number} seconds @param {{mute?:boolean,reset?:boolean,source?:'manual'|'scroll'|'media'}} [seekOptions] */
    seek(seconds, seekOptions = {}) {
      options(seekOptions, ['mute', 'reset', 'source'], 'timeline seek');
      assert(
        seekOptions.reset === undefined || typeof seekOptions.reset === 'boolean',
        'INVALID_OPTIONS',
        'reset must be boolean.',
      );
      assert(
        seekOptions.mute === undefined || typeof seekOptions.mute === 'boolean',
        'INVALID_OPTIONS',
        'mute must be boolean.',
      );
      const previous = muted;
      muted = seekOptions.mute ?? false;
      try {
        clock.seek(seconds, { reset: false, source: seekOptions.source ?? 'manual' });
      } finally {
        muted = previous;
      }
      return player;
    },
    /** @param {number} seconds @param {{source?:'media',playing?:boolean,mute?:boolean}} [syncOptions] */
    syncTime(seconds, syncOptions = {}) {
      options(syncOptions, ['source', 'playing', 'mute'], 'timeline media synchronization');
      assert(
        syncOptions.mute === undefined || typeof syncOptions.mute === 'boolean',
        'INVALID_OPTIONS',
        'mute must be boolean.',
      );
      const previous = muted;
      muted = syncOptions.mute ?? false;
      try {
        clock.sync(seconds, { source: syncOptions.source ?? 'media', playing: syncOptions.playing ?? false });
      } finally {
        muted = previous;
      }
      return player;
    },
    play() {
      muted = false;
      if (clock.duration > 0 && clock.time >= clock.duration && !clock.disposed) player.restart({ play: false });
      clock.play();
      return player;
    },
    pause() {
      clock.pause();
      return player;
    },
    /** @param {{mute?:boolean,play?:boolean}} [restartOptions] */
    restart(restartOptions = {}) {
      options(restartOptions, ['mute', 'play'], 'timeline restart');
      assert(
        restartOptions.play === undefined || typeof restartOptions.play === 'boolean',
        'INVALID_OPTIONS',
        'play must be boolean.',
      );
      const previous = initialEvents;
      initialEvents = true;
      restarting = true;
      try {
        player.seek(0, { mute: restartOptions.mute ?? false });
      } catch (cause) {
        initialEvents = previous;
        throw cause;
      } finally {
        restarting = false;
      }
      if (restartOptions.play !== false) player.play();
      return player;
    },
    refresh() {
      const previous = muted;
      muted = true;
      try {
        const result = clock.refresh();
        return positionalProjection ? { frame: result.readFrame() } : result;
      } finally {
        muted = previous;
      }
    },
    dispose() {
      clock.dispose();
    },
  };
  clock.on('dispose', () => {
    model = project = projectValues = onEvent = frame = readFrame = state = prepared = null;
  });
  try {
    clock.refresh();
  } catch (cause) {
    clock.dispose();
    throw cause;
  }
  muted = false;
  return Object.freeze(player);
}
