import { assert, number, options, KitError } from '../core/validate.js';
import { Parameter, DataSource } from '../core/data.js';
import { Derived } from '../core/scene.js';

import { domOwners as owners } from './dom-ownership.js';
const CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
const originalStyle = (element) => element.getAttribute('style');
function restoreStyle(element, value) {
  if (value === null) element.removeAttribute('style');
  else element.setAttribute('style', value);
}
function elementCheck(element) {
  assert(
    element?.nodeType === 1 &&
      element.ownerDocument &&
      element.style &&
      typeof element.style.setProperty === 'function',
    'INVALID_DOM',
    'Bind a DOM element with CSS style support.',
  );
}
function captureInputs(scene, input) {
  assert(
    Array.isArray(input) && input.length <= 64,
    'INVALID_BINDING',
    'Each DOM binding accepts at most 64 scene inputs.',
  );
  return Object.freeze(
    Array.from({ length: input.length }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(input, i);
      assert(
        d && 'value' in d && scene._ownsInput(d.value),
        'INVALID_BINDING',
        'Use dense inputs owned by this scene.',
      );
      return d.value;
    }),
  );
}
function read(input, context) {
  return input instanceof Parameter
    ? input.sample(context.time)
    : input instanceof DataSource
      ? input.rows
      : input instanceof Derived
        ? input.sample(context)
        : undefined;
}
function mappingError(cause) {
  if (cause instanceof KitError) return cause;
  return Object.assign(new Error('Trusted DOM mapping failed.'), { code: 'DOM_MAPPING_FAILED', cause });
}
function prepare(value) {
  options(value, CHANNELS, 'DOM pose');
  const x = number(value.x ?? 0, 'DOM x'),
    y = number(value.y ?? 0, 'DOM y'),
    rotation = number(value.rotation ?? 0, 'DOM rotation'),
    scaleX = number(value.scaleX ?? 1, 'DOM scaleX', -1e4, 1e4),
    scaleY = number(value.scaleY ?? 1, 'DOM scaleY', -1e4, 1e4),
    opacity = number(value.opacity ?? 1, 'DOM opacity', 0, 1);
  return Object.freeze({
    transform: `translate(${x}px, ${y}px) rotate(${rotation}rad) scale(${scaleX}, ${scaleY})`,
    opacity: String(opacity),
  });
}

/** Project sampled scene values onto existing HTML/CSS elements. No animation loop. */
export function bindDOM(scene, bindings, spec = {}) {
  options(spec, ['player', 'onError', 'reducedMotion'], 'DOM adapter');
  assert(
    scene && typeof scene._ownsInput === 'function' && typeof scene.onChange === 'function',
    'INVALID_BINDING',
    'Use an ExplainerKit scene.',
  );
  assert(
    Array.isArray(bindings) && bindings.length > 0 && bindings.length <= 2048,
    'RESOURCE_LIMIT',
    'Bind 1–2048 DOM elements.',
  );
  let model = scene,
    player = spec.player ?? null,
    onError = spec.onError ?? (() => {});
  const motion = spec.reducedMotion ?? 'respect';
  assert(typeof onError === 'function', 'INVALID_LISTENER', 'onError must be a function.');
  assert(['respect', 'allow'].includes(motion), 'INVALID_DOM', 'reducedMotion must be respect or allow.');
  if (player)
    assert(
      typeof player.on === 'function' && typeof player.time === 'number' && !player.disposed,
      'INVALID_PLAYER',
      'Use an active player with frame/dispose events.',
    );
  const unique = new Set();
  let inputCount = 0;
  const records = Array.from({ length: bindings.length }, (_, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(bindings, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_BINDING', 'DOM bindings must be dense values.');
    const binding = descriptor.value;
    options(binding, ['element', 'inputs', 'map'], 'DOM binding');
    elementCheck(binding.element);
    assert(
      !unique.has(binding.element) && !owners.has(binding.element),
      'DOM_OWNED',
      'An element can have one active DOM binding.',
    );
    unique.add(binding.element);
    assert(typeof binding.map === 'function', 'INVALID_BINDING', 'A DOM binding needs a trusted map callback.');
    const inputs = captureInputs(scene, binding.inputs ?? []);
    inputCount += inputs.length;
    return { element: binding.element, inputs, map: binding.map, original: originalStyle(binding.element) };
  });
  assert(
    records.every((r) => r.element.ownerDocument === records[0].element.ownerDocument),
    'INVALID_DOM',
    'One DOM adapter uses one document.',
  );
  assert(inputCount <= 16384, 'RESOURCE_LIMIT', 'DOM binding input budget exceeded.');
  bindings = null;
  scene = null;
  const host = records[0].element.ownerDocument.defaultView,
    media = motion === 'respect' ? host?.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  let reduced = media?.matches ?? false,
    disposed = false,
    updating = false,
    time = player?.time ?? 0,
    lastError = null;
  let unsubscribeScene = () => {},
    unsubscribeFrame = () => {},
    unsubscribeDispose = () => {};
  const token = Object.freeze({});
  function update(next = player?.time ?? time) {
    assert(!disposed, 'DISPOSED', 'This DOM adapter has been disposed.');
    assert(!updating, 'REENTRANT_SAMPLE', 'A DOM mapping cannot recursively update its adapter.');
    const context = Object.freeze({
      time: number(next, 'DOM time', 0, 86400),
      width: number(player?.frame?.width ?? model.width, 'scene width', 1, 8192),
      height: number(player?.frame?.height ?? model.height, 'scene height', 1, 8192),
      reducedMotion: reduced,
    });
    updating = true;
    try {
      const prepared = records.map((record) => {
        try {
          return prepare(record.map(...record.inputs.map((input) => read(input, context)), context));
        } catch (cause) {
          throw mappingError(cause);
        }
      });
      assert(!disposed, 'DISPOSED', 'This DOM adapter was disposed during sampling.');
      const previous = records.map((record) => originalStyle(record.element));
      try {
        records.forEach((record, i) => {
          record.element.style.setProperty('transform', prepared[i].transform);
          record.element.style.setProperty('opacity', prepared[i].opacity);
        });
      } catch (cause) {
        const rollbackErrors = [];
        for (let i = 0; i < records.length; i++) {
          try {
            restoreStyle(records[i].element, previous[i]);
          } catch (error) {
            rollbackErrors.push(error);
          }
        }
        throw Object.assign(new Error('DOM style commit failed; previous-style restoration was attempted.'), {
          code: 'DOM_COMMIT_FAILED',
          cause,
          rollbackErrors: Object.freeze(rollbackErrors),
        });
      }
      time = context.time;
      lastError = null;
      return context;
    } finally {
      updating = false;
    }
  }
  function guarded(next) {
    if (disposed) return;
    try {
      update(next);
    } catch (error) {
      lastError = error;
      try {
        player?.pause?.();
      } catch {}
      try {
        onError(error);
      } catch {}
      try {
        player?.reportError?.(error);
      } catch {}
    }
  }
  function motionChanged() {
    if (disposed) return;
    reduced = media.matches;
    guarded();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of [
      unsubscribeScene,
      unsubscribeFrame,
      unsubscribeDispose,
      () => media?.removeEventListener?.('change', motionChanged),
    ]) {
      try {
        cleanup();
      } catch {}
    }
    for (const record of records) {
      if (owners.get(record.element) === token) {
        owners.delete(record.element);
        try {
          restoreStyle(record.element, record.original);
        } catch (cause) {
          lastError = Object.assign(new Error('An original DOM style could not be restored.'), {
            code: 'DOM_RESTORE_FAILED',
            cause,
          });
        }
      }
    }
    records.length = 0; // Release DOM nodes, scene inputs and author callbacks after unsubscribe.
    model = null;
    player = null;
    onError = () => {};
    unsubscribeScene = unsubscribeFrame = unsubscribeDispose = () => {};
  }
  const adapter = {
    update,
    dispose,
    get disposed() {
      return disposed;
    },
    get time() {
      return time;
    },
    get reducedMotion() {
      return reduced;
    },
    get error() {
      return lastError;
    },
  };
  // Compute and commit before acquiring ownership or subscriptions. A failed start
  // preserves both the previous styles and the caller's ability to retry.
  for (const record of records) owners.set(record.element, token);
  try {
    update(time);
  } catch (error) {
    dispose();
    throw error;
  }
  try {
    if (player) {
      unsubscribeFrame = player.on('frame', (event) => guarded(event.time));
      unsubscribeDispose = player.on('dispose', dispose);
    }
    // The mounted player's frame event already includes scene changes; avoid a
    // second evaluation at the previous time during seek/reset.
    else unsubscribeScene = model.onChange(() => guarded());
    media?.addEventListener?.('change', motionChanged);
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze(adapter);
}
