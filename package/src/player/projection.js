import { Scene } from '../core/index.js';
import { assert, options } from '../core/validate.js';
import { createClock } from './clock.js';
import { sharedFrameHost } from './frame-host.js';

/**
 * Play a native scene through an application-owned projection. The existing
 * player clock owns scheduling; the scene owns inputs, tracks and sampling.
 * No renderer or third-party animation engine is installed by this function.
 * @param {Scene} scene
 * @param {{host?:any,project:(frame:any,context:any)=>void,reducedMotion?:boolean}} spec
 */
export function createProjectionPlayer(scene, spec) {
  assert(scene instanceof Scene, 'INVALID_SCENE', 'Use an ExplainerKit scene.');
  options(spec, ['host', 'project', 'reducedMotion'], 'projection player');
  assert(typeof spec.project === 'function', 'INVALID_PROJECTION', 'Provide a trusted frame projection callback.');
  assert(
    spec.reducedMotion === undefined || typeof spec.reducedMotion === 'boolean',
    'INVALID_OPTIONS',
    'reducedMotion must be boolean.',
  );
  const host = sharedFrameHost(spec.host ?? globalThis);
  const now = () => host.performance?.now?.() ?? Date.now();
  let model = scene,
    project = spec.project,
    frame = null,
    view = null,
    cost = null,
    error = null,
    lastDuration = scene.duration,
    resetting = false,
    unsubscribe = () => {};
  const clock = createClock({
    host,
    duration: () => (model ? (lastDuration = model.duration) : lastDuration),
    reducedMotion: spec.reducedMotion,
    sample(time, { reset = false } = {}) {
      const sampledModel = model,
        checkpoint = reset ? sampledModel._checkpoint() : null;
      try {
        if (reset) {
          resetting = true;
          try {
            sampledModel.reset();
          } finally {
            resetting = false;
          }
        }
        const started = now(),
          sampled = sampledModel.sampleView({ time, ambient: time }),
          sampledAt = now();
        project(sampled.frame, { time, ambient: time, view: sampled.view });
        assert(!clock.disposed, 'DISPOSED', 'The player was disposed during projection.');
        const projectedAt = now(),
          nextCost = Object.freeze({
            sampleMS: sampledAt - started,
            projectMS: projectedAt - sampledAt,
            totalMS: projectedAt - started,
          });
        // A projection failure must not commit the new player frame or time.
        frame = sampled.frame;
        view = sampled.view;
        cost = nextCost;
        error = null;
        return { frame, view, ambient: time, cost };
      } catch (cause) {
        if (checkpoint) {
          resetting = true;
          try {
            sampledModel._restore(checkpoint);
          } finally {
            resetting = false;
          }
        }
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
      return frame;
    },
    get view() {
      return view;
    },
    get error() {
      return error;
    },
    get cost() {
      return cost;
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
      return clock.on(name, listener);
    },
    reportError(cause) {
      clock.reportError(cause);
    },
    setDriver(driver) {
      clock.setDriver(driver);
      return player;
    },
    syncTime(seconds, syncOptions) {
      clock.sync(seconds, syncOptions);
      return player;
    },
    seek(seconds, seekOptions = {}) {
      options(seekOptions, ['reset', 'source'], 'projection seek');
      assert(
        seekOptions.reset === undefined || typeof seekOptions.reset === 'boolean',
        'INVALID_OPTIONS',
        'reset must be boolean.',
      );
      clock.seek(seconds, { reset: false, ...seekOptions });
      return player;
    },
    play() {
      clock.play();
      return player;
    },
    pause() {
      clock.pause();
      return player;
    },
    refresh() {
      return clock.refresh();
    },
    profile() {
      assert(!clock.disposed, 'DISPOSED', 'This player has been disposed.');
      return model.profile({ time: clock.time, ambient: clock.time });
    },
    dispose() {
      clock.dispose();
    },
  };
  clock.on('dispose', () => {
    unsubscribe();
    model = project = frame = view = cost = null;
  });
  try {
    unsubscribe = model.onChange(() => {
      if (!resetting) clock.invalidate();
    });
    clock.refresh();
  } catch (cause) {
    clock.dispose();
    throw cause;
  }
  return Object.freeze(player);
}
