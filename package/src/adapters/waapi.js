import { assert, number, options, safeCopy, text, KitError } from '../core/validate.js';
import { domOwners } from './dom-ownership.js';

function easing(value) {
  text(value, 'native CSS easing', 256);
  const numeric = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
  const cubic = new RegExp(
    `^cubic-bezier\\(\\s*(${numeric})\\s*,\\s*(${numeric})\\s*,\\s*(${numeric})\\s*,\\s*(${numeric})\\s*\\)$`,
    'i',
  ).exec(value);
  if (cubic) {
    const values = cubic.slice(1).map(Number);
    values.forEach((v) => number(v, 'CSS easing control', -1e4, 1e4));
    number(values[0], 'CSS easing x1', 0, 1);
    number(values[2], 'CSS easing x2', 0, 1);
    return value;
  }
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/.exec(value);
  if (steps) {
    number(Number(steps[1]), 'CSS steps', steps[2] === 'jump-none' ? 2 : 1, 2048);
    return value;
  }
  assert(
    ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].includes(value),
    'INVALID_WAAPI',
    'Use a supported native CSS easing.',
  );
  return value;
}
function transform(value) {
  text(value, 'CSS transform', 2048);
  assert(
    value === 'none' ||
      /^(?:(?:translate(?:X|Y|3d)?|rotate(?:X|Y|Z)?|scale(?:X|Y|3d)?|skew(?:X|Y)?|matrix(?:3d)?)\([\d\s.,+\-e%a-z]+\)\s*)+$/i.test(
        value,
      ),
    'INVALID_WAAPI',
    'Use bounded numeric CSS transforms, without CSS variables or resource references.',
  );
  for (const token of value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? [])
    number(Number(token), 'CSS transform number', -1e6, 1e6);
  return value;
}
function frames(input) {
  assert(
    Array.isArray(input) && input.length >= 2 && input.length <= 2048,
    'INVALID_WAAPI',
    'Use 2–2048 dense keyframe records.',
  );
  const captured = safeCopy(input);
  let previous = -1,
    channels = null;
  return Object.freeze(
    captured.map((frame) => {
      options(frame, ['transform', 'opacity', 'offset', 'easing'], 'WAAPI keyframe');
      const current = ['transform', 'opacity'].filter((key) => Object.hasOwn(frame, key));
      assert(
        current.length > 0 && (channels === null || current.join() === channels),
        'INVALID_WAAPI',
        'Every keyframe must declare the same transform/opacity channels.',
      );
      channels = current.join();
      const result = {};
      if ('transform' in frame) result.transform = transform(frame.transform);
      if ('opacity' in frame) result.opacity = number(frame.opacity, 'WAAPI opacity', 0, 1);
      if ('offset' in frame) {
        result.offset = number(frame.offset, 'keyframe offset', 0, 1);
        assert(result.offset >= previous, 'INVALID_WAAPI', 'Keyframe offsets must be nondecreasing.');
        previous = result.offset;
      }
      if ('easing' in frame) result.easing = easing(frame.easing);
      return Object.freeze(result);
    }),
  );
}

/** Native CSS transform/opacity effects with seconds, captured keyframes and explicit clock ownership. */
export function animateWAAPI(targets, keyframes, spec = {}) {
  options(
    spec,
    ['duration', 'at', 'repeat', 'easing', 'autoplay', 'player', 'reducedMotion', 'onError'],
    'WAAPI options',
  );
  const duration = number(spec.duration ?? 1, 'WAAPI duration', 0, 86400),
    at = number(spec.at ?? 0, 'WAAPI start', 0, 86400),
    repeat = number(spec.repeat ?? 0, 'WAAPI repeat', 0, 1000),
    curve = easing(spec.easing ?? 'linear');
  assert(Number.isInteger(repeat), 'INVALID_WAAPI', 'repeat counts whole additional iterations.');
  const end = number(at + duration * (repeat + 1), 'WAAPI end', 0, 86400),
    autoplay = spec.autoplay ?? false,
    motion = spec.reducedMotion ?? 'respect';
  assert(
    typeof autoplay === 'boolean' && ['respect', 'allow'].includes(motion),
    'INVALID_WAAPI',
    'Use boolean autoplay and reducedMotion respect or allow.',
  );
  const captured = frames(keyframes),
    input = Array.isArray(targets) ? targets : [targets];
  assert(input.length > 0 && input.length <= 2048, 'RESOURCE_LIMIT', 'Animate 1–2048 elements.');
  const elements = Array.from({ length: input.length }, (_, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_WAAPI', 'Targets must be dense values.');
    return descriptor.value;
  });
  let player = spec.player ?? null,
    onError = spec.onError ?? (() => {});
  assert(typeof onError === 'function', 'INVALID_LISTENER', 'onError must be a trusted callback.');
  if (player)
    assert(
      typeof player.on === 'function' &&
        typeof player.seek === 'function' &&
        typeof player.play === 'function' &&
        typeof player.pause === 'function' &&
        typeof player.time === 'number' &&
        !player.disposed,
      'INVALID_PLAYER',
      'Use an active seekable ExplainerKit player.',
    );
  const unique = new Set();
  for (const element of elements) {
    assert(
      element?.nodeType === 1 && element.ownerDocument && element.style,
      'INVALID_DOM',
      'Animate HTML or SVG elements.',
    );
    assert(
      typeof element.animate === 'function',
      'WAAPI_UNSUPPORTED',
      'This element has no native Element.animate support.',
    );
    assert(
      !unique.has(element) && !domOwners.has(element),
      'DOM_OWNED',
      'An element can have one active ExplainerKit DOM or WAAPI owner.',
    );
    unique.add(element);
    const supports = element.ownerDocument.defaultView?.CSS?.supports;
    for (const frame of captured)
      if (frame.transform !== undefined && supports)
        assert(
          supports.call(element.ownerDocument.defaultView.CSS, 'transform', frame.transform),
          'INVALID_WAAPI',
          'This browser refuses the CSS transform.',
        );
  }
  assert(
    elements.every((element) => element.ownerDocument === elements[0].ownerDocument),
    'INVALID_DOM',
    'One WAAPI adapter uses one document.',
  );
  const host = elements[0].ownerDocument.defaultView,
    media = motion === 'respect' ? host?.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  let reduced = media?.matches ?? false,
    disposed = false,
    time = player?.time ?? 0,
    lastError = null;
  const token = Object.freeze({}),
    animations = [];
  let unsubscribeFrame = () => {},
    unsubscribeDispose = () => {};
  function active() {
    assert(!disposed, 'DISPOSED', 'This WAAPI adapter has been disposed.');
  }
  function nativeTransaction(action) {
    let snapshots = [];
    try {
      snapshots = animations.map((animation) => ({
        animation,
        time: animation.currentTime,
        state: animation.playState,
      }));
      action();
      lastError = null;
    } catch (cause) {
      const rollbackErrors = [];
      for (const snapshot of snapshots) {
        try {
          const { animation, state } = snapshot;
          if (state === 'idle') {
            animation.cancel();
            continue;
          }
          animation.pause();
          animation.currentTime = snapshot.time;
          if (state === 'running') animation.play();
          else if (state === 'finished') animation.finish();
        } catch (error) {
          rollbackErrors.push(error);
        }
      }
      lastError = Object.assign(
        new KitError(
          'WAAPI_FAILED',
          'Native WAAPI update failed; previous effect states were restored where supported.',
        ),
        { cause, rollbackErrors: Object.freeze(rollbackErrors) },
      );
      throw lastError;
    }
  }
  function sample(next) {
    active();
    const proposed = number(next, 'WAAPI time', 0, 86400);
    nativeTransaction(() => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = (reduced ? end : proposed) * 1000;
      }
    });
    time = proposed;
  }
  function guarded(next) {
    try {
      sample(next);
    } catch (error) {
      lastError = error;
      try {
        player?.pause();
      } catch {}
      try {
        onError(error);
      } catch {}
      try {
        player?.reportError?.(error);
      } catch {}
    }
  }
  function changed() {
    if (disposed) return;
    reduced = media.matches;
    guarded(player?.time ?? time);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of [unsubscribeFrame, unsubscribeDispose, () => media?.removeEventListener?.('change', changed)])
      try {
        cleanup();
      } catch {}
    for (const animation of animations)
      try {
        animation.cancel();
      } catch {}
    for (const element of elements) if (domOwners.get(element) === token) domOwners.delete(element);
    animations.length = 0;
    elements.length = 0;
    player = null;
    onError = () => {};
    unsubscribeFrame = unsubscribeDispose = () => {};
  }
  const adapter = {
    play() {
      active();
      if (reduced) {
        sample(time);
        return adapter;
      }
      if (player) player.play();
      else
        nativeTransaction(() => {
          for (const animation of animations) animation.play();
        });
      return adapter;
    },
    pause() {
      active();
      if (player) player.pause();
      else sample(Number(animations[0]?.currentTime ?? 0) / 1000);
      return adapter;
    },
    seek(next) {
      active();
      number(next, 'WAAPI time', 0, 86400);
      if (player) player.seek(next);
      else sample(next);
      return adapter;
    },
    finish() {
      active();
      if (player) player.seek(end);
      else sample(end);
      return adapter;
    },
    dispose,
    get disposed() {
      return disposed;
    },
    get time() {
      return !player && !disposed && !reduced ? Number(animations[0]?.currentTime ?? time * 1000) / 1000 : time;
    },
    get duration() {
      return duration;
    },
    get end() {
      return end;
    },
    get reducedMotion() {
      return reduced;
    },
    get error() {
      return lastError;
    },
    get playState() {
      return disposed ? 'idle' : player ? 'paused' : (animations[0]?.playState ?? 'idle');
    },
  };
  // Native support, input validation and all ownership checks precede the first native effect.
  for (const element of elements) domOwners.set(element, token);
  try {
    for (const element of elements) {
      const animation = element.animate(captured, {
        duration: duration * 1000,
        delay: at * 1000,
        iterations: repeat + 1,
        easing: curve,
        fill: 'both',
      });
      animations.push(animation);
      animation.pause();
    }
    sample(time);
    if (player) {
      unsubscribeFrame = player.on('frame', (event) => guarded(event.time));
      unsubscribeDispose = player.on('dispose', dispose);
    }
    media?.addEventListener?.('change', changed);
    if (autoplay) adapter.play();
  } catch (cause) {
    dispose();
    if (cause instanceof KitError) throw cause;
    throw Object.assign(new Error('Native WAAPI construction failed; owned effects were cancelled.'), {
      code: 'WAAPI_FAILED',
      cause,
    });
  }
  return Object.freeze(adapter);
}
export const waapi = Object.freeze({ animate: animateWAAPI });
