import { assert, number, options } from '../core/validate.js';
import { createClock } from './clock.js';
import { showPlayerError, clearPlayerError } from './errors.js';
import { attachSceneLayer } from './layers.js';
import { animateWAAPI } from '../adapters/waapi.js';
export { attachSceneLayer } from './layers.js';
export { createProjectionPlayer } from './projection.js';
/** @typedef {import('./projection.js').ProjectionPlayer} ProjectionPlayer */
/** @typedef {import('./projection.js').ProjectionOptions} ProjectionOptions */

/** Browser ownership lives here, never in scene/model evaluation. No auto-start. */
export async function mount(input, container, spec = {}) {
  try {
    const scene = typeof input === 'function' ? await input() : input;
    return await mountScene(scene, container, spec);
  } catch (error) {
    if (spec.errorOverlay !== false) showPlayerError(container, error);
    throw error;
  }
}
async function mountScene(scene, container, spec = {}) {
  options(spec, [
    'renderer',
    'responsive',
    'height',
    'pixelRatio',
    'controls',
    'reducedMotion',
    'errorOverlay',
    'debug',
  ]);
  assert(
    spec.errorOverlay === undefined || typeof spec.errorOverlay === 'boolean',
    'INVALID_OPTIONS',
    'errorOverlay must be boolean.',
  );
  assert(spec.debug === undefined || typeof spec.debug === 'boolean', 'INVALID_OPTIONS', 'debug must be boolean.');
  assert(container?.ownerDocument, 'INVALID_CONTAINER', 'Mount into a DOM element.');
  const doc = container.ownerDocument,
    win = doc.defaultView;
  const rendererName = spec.renderer ?? scene.renderer;
  assert(['svg', 'canvas'].includes(rendererName), 'UNSUPPORTED_RENDERER', 'Use svg or canvas.');
  const create =
    rendererName === 'svg'
      ? (await import('../renderers/svg.js')).createSVGRenderer
      : (await import('../renderers/canvas.js')).createCanvasRenderer;
  const stage = doc.createElement('div');
  stage.className = 'explainerkit-stage';
  container.append(stage);
  let renderer;
  try {
    renderer = create(stage, {
      label: scene.label,
      pixelRatio: spec.pixelRatio ?? Math.min(win.devicePixelRatio || 1, 2),
    });
  } catch (e) {
    stage.remove();
    throw e;
  }
  const controlBindings = [];
  let width = scene.width,
    height = scene.height,
    frame = null,
    view = null,
    resetting = false,
    panel = null,
    observer = null,
    resizeFrame = null,
    measuredWidth = null,
    unsubscribe = () => {},
    ambientTime = 0,
    ambientPaused = false,
    ambientStamp = null,
    ambientOverride = null,
    lastCost = null,
    ambientConsumers = 0;
  const debug = spec.debug ? doc.createElement('output') : null;
  if (debug) {
    debug.className = 'explainerkit-debug';
    stage.append(debug);
  }
  const now = () => win.performance?.now?.() ?? Date.now();
  function measure() {
    if (!spec.responsive) return true;
    const bounds = container.getBoundingClientRect();
    measuredWidth = bounds.width;
    if (bounds.width <= 0) return false;
    width = Math.min(8192, bounds.width);
    height =
      spec.height === undefined ? scene.height : typeof spec.height === 'function' ? spec.height(width) : spec.height;
    number(height, 'responsive height', 1, 8192);
    return true;
  }
  function draw(time, { reset = false } = {}) {
    const checkpoint = reset ? scene._checkpoint() : null;
    try {
      if (reset) {
        resetting = true;
        try {
          scene.reset();
        } finally {
          resetting = false;
        }
      }
      if (!measure()) return { frame };
      const stamp = now(),
        running = !ambientPaused && (scene.hasAmbient || ambientConsumers > 0) && !doc.hidden && !clock?.reducedMotion,
        nextAmbient =
          ambientOverride ??
          (running && ambientStamp !== null
            ? Math.min(86400, ambientTime + Math.max(0, (stamp - ambientStamp) / 1000))
            : ambientTime);
      const displayWidth = container.getBoundingClientRect?.().width || width;
      const started = now(),
        sampled = scene.sampleView({ time, width, height, ambient: nextAmbient, displayWidth }),
        sampledAt = now();
      renderer.render(sampled.frame);
      frame = sampled.frame;
      view = sampled.view;
      ambientTime = nextAmbient;
      ambientStamp = running ? stamp : null;
      lastCost = Object.freeze({
        sampleMS: sampledAt - started,
        renderMS: now() - sampledAt,
        totalMS: now() - started,
      });
      if (debug)
        debug.textContent = `${lastCost.totalMS.toFixed(1)} ms/frame · sample ${lastCost.sampleMS.toFixed(1)} · render ${lastCost.renderMS.toFixed(1)}`;
      clearPlayerError(container);
      for (const { parameter, input, output } of controlBindings) {
        const v = parameter.sample(time);
        input.value = String(v);
        output.value = Number(v.toFixed(2)).toString();
      }
      return { frame, view, ...(spec.debug ? { cost: lastCost } : {}) };
    } catch (error) {
      if (checkpoint) scene._restore(checkpoint);
      if (spec.errorOverlay !== false) showPlayerError(container, error);
      throw error;
    }
  }
  let clock;
  try {
    clock = createClock({
      host: win,
      duration: () => scene.duration,
      reducedMotion: spec.reducedMotion,
      sample: draw,
      needsFrame: () =>
        !ambientPaused &&
        (scene.hasAmbient || ambientConsumers > 0) &&
        !doc.hidden &&
        !clock?.reducedMotion &&
        ambientTime < 86400,
    });
  } catch (error) {
    renderer.dispose();
    stage.remove();
    throw error;
  }
  const player = {
    get time() {
      return clock.time;
    },
    get duration() {
      return clock.duration;
    },
    get disposed() {
      return clock.disposed;
    },
    get reducedMotion() {
      return clock.reducedMotion;
    },
    get speed() {
      return clock.speed;
    },
    set speed(v) {
      clock.speed = v;
    },
    get ambientTime() {
      return ambientTime;
    },
    get ambientPaused() {
      return ambientPaused;
    },
    /** Pause only ambient motion; authored playback and manual interactions remain available.
     * @param {boolean} paused
     */
    setAmbientPaused(paused) {
      assert(!clock.disposed, 'DISPOSED', 'This player has been disposed.');
      assert(typeof paused === 'boolean', 'INVALID_OPTIONS', 'Ambient pause must be boolean.');
      if (ambientPaused === paused) return player;
      ambientPaused = paused;
      ambientStamp = null;
      clock.invalidate();
      return player;
    },
    get cost() {
      return lastCost;
    },
    seekAmbient(seconds) {
      assert(!clock.disposed, 'DISPOSED', 'This player has been disposed.');
      ambientOverride = number(seconds, 'ambient time', 0, 86400);
      try {
        clock.refresh();
        ambientStamp = null;
      } finally {
        ambientOverride = null;
      }
      return player;
    },
    profile() {
      return scene.profile({ time: clock.time, width, height, ambient: ambientTime });
    },
    _acquireAmbient() {
      assert(!clock.disposed, 'DISPOSED', 'This player has been disposed.');
      ambientConsumers++;
      clock.invalidate();
      let live = true;
      return () => {
        if (live) {
          live = false;
          ambientConsumers--;
          clock.invalidate();
        }
      };
    },
    /** @param {import('../core/scene.js').Scene} child @param {Parameters<typeof attachSceneLayer>[2]} layerOptions */
    layer(child, layerOptions) {
      return attachSceneLayer(player, child, layerOptions);
    },
    nativeLayer(handle, keyframes, nativeOptions = {}) {
      assert(!clock.disposed, 'DISPOSED', 'This player has been disposed.');
      options(
        nativeOptions,
        ['duration', 'at', 'repeat', 'easing', 'autoplay', 'reducedMotion', 'onError'],
        'native layer options',
      );
      if (typeof handle !== 'string') {
        assert(
          handle?._scene === scene && typeof handle._live === 'function',
          'INVALID_NATIVE_LAYER',
          'Use a group from this player’s scene.',
        );
        handle._live();
      }
      assert(
        typeof renderer.nativeLayer === 'function',
        'RENDER_UNSUPPORTED',
        'Native layers require the SVG renderer.',
      );
      const lease = renderer.nativeLayer(typeof handle === 'string' ? handle : handle?.id);
      let effect,
        unend = () => {},
        disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        unend();
        effect?.dispose();
        lease.dispose();
        if (!clock.disposed) clock.refresh();
      };
      try {
        effect = animateWAAPI(lease.element, keyframes, { ...nativeOptions, player });
        unend = clock.on('dispose', dispose);
      } catch (error) {
        lease.dispose();
        throw error;
      }
      return Object.freeze({
        effect,
        get disposed() {
          return disposed;
        },
        dispose,
      });
    },
    syncTime(time, syncOptions) {
      clock.sync(time, syncOptions);
      return player;
    },
    get playing() {
      return clock.playing;
    },
    get driver() {
      return clock.driver;
    },
    get frame() {
      return frame;
    },
    get view() {
      return view;
    },
    element: stage,
    on: (name, fn) => clock.on(name, fn),
    setDriver(next) {
      clock.setDriver(next);
      return player;
    },
    seek(seconds, seekOptions = {}) {
      clock.seek(seconds, seekOptions);
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
      return clock.refresh()?.frame ?? null;
    },
    reportError: (error) => clock.reportError(error),
    dispose: () => clock.dispose(),
  };
  function guardedDraw() {
    try {
      clock.refresh();
    } catch (error) {
      clock.pause();
      clock.reportError(error);
    }
  }
  const wake = () => {
    ambientStamp = null;
    clock.invalidate();
  };
  doc.addEventListener?.('visibilitychange', wake);
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  motion?.addEventListener?.('change', wake);
  clock.on('dispose', () => {
    observer?.disconnect();
    if (resizeFrame !== null) win.cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
    unsubscribe();
    doc.removeEventListener?.('visibilitychange', wake);
    motion?.removeEventListener?.('change', wake);
    clearPlayerError(container);
    for (const c of controlBindings) c.input.removeEventListener('input', c.handler);
    panel?.remove();
    renderer.dispose();
    stage.remove();
  });
  unsubscribe = scene.onChange(() => {
    if (!resetting && !clock.disposed) guardedDraw();
  });
  if (spec.controls !== false && scene.controls.length) {
    panel = doc.createElement('div');
    panel.className = 'explainerkit-controls';
    for (const { parameter, label, step } of scene.controls) {
      const wrap = doc.createElement('label'),
        caption = doc.createElement('span'),
        input = doc.createElement('input'),
        output = doc.createElement('output');
      caption.textContent = label;
      input.type = 'range';
      input.min = String(parameter.min);
      input.max = String(parameter.max);
      input.step = String(step);
      input.setAttribute('aria-label', label);
      const handler = () => {
        player.pause();
        parameter.set(Number(input.value));
        clock.emit('interact', { label, value: parameter.value });
      };
      input.addEventListener('input', handler);
      wrap.append(caption, input, output);
      panel.append(wrap);
      controlBindings.push({ parameter, input, output, handler });
    }
    container.append(panel);
  }
  // Responsive sampling depends on width. Rendering and error overlays may change
  // height; ignore those notifications and never mutate layout inside an observer.
  const scheduleResize = () => {
    if (clock.disposed || container.getBoundingClientRect().width === measuredWidth || resizeFrame !== null) return;
    resizeFrame = win.requestAnimationFrame(() => {
      resizeFrame = null;
      if (!clock.disposed) guardedDraw();
    });
  };
  observer = spec.responsive && win.ResizeObserver ? new win.ResizeObserver(scheduleResize) : null;
  observer?.observe(container);
  try {
    clock.refresh();
  } catch (error) {
    clock.dispose();
    throw error;
  }
  return player;
}

export { createTimelinePlayer } from './timeline.js';
/** @typedef {import('./timeline.js').TimelinePlayerOptions} TimelinePlayerOptions */
/** @typedef {import('./timeline.js').TimelinePlayer} TimelinePlayer */
/** @typedef {import('./timeline.js').TimelinePlayerContext} TimelinePlayerContext */
