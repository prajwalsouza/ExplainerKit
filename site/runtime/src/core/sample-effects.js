import { assert, options } from './validate.js';
import { validateProperty } from './geometry.js';
const active = new Set(),
  suppressed = [],
  keys = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
/** Internal bounded additive-effect installation; callbacks return final transform values. */
export function installHandleEffect(handle, owner, patchFn) {
  assert(
    handle && typeof handle._live === 'function' && typeof handle._scene?._pathTo === 'function',
    'INVALID_EFFECT',
    'Use a live scene handle.',
  );
  handle._live();
  assert(handle._scene._pathTo(handle._record), 'DETACHED_HANDLE', 'Use an attached handle.');
  assert(
    typeof patchFn === 'function' && owner !== undefined,
    'INVALID_EFFECT',
    'An effect needs an owner and pure patch callback.',
  );
  const effects = handle._record.effects ?? new Map();
  assert(!effects.has(owner), 'CHANNEL_OWNED', 'This effect owner is already installed.');
  assert(effects.size < 8, 'RESOURCE_LIMIT', 'Use at most8 sampled effects on one handle.');
  effects.set(owner, patchFn);
  handle._record.effects = effects;
  handle._scene._changed();
  let live = true;
  return () => {
    if (live) {
      effects.delete(owner);
      live = false;
      handle._scene._changed();
    }
  };
}
export function applyHandleEffects(record, props, context) {
  if (context.effects === false || !record.effects?.size) return;
  for (const [owner, callback] of record.effects) {
    if (suppressed.some((predicate) => predicate(owner))) continue;
    assert(
      !active.has(callback),
      'SAMPLE_EFFECT_CYCLE',
      'A sampled effect depends on itself. Use a base geometry query.',
    );
    active.add(callback);
    try {
      const patch = callback(Object.freeze({ ...props }), context);
      options(patch, keys, 'sampled transform effect');
      for (const [key, value] of Object.entries(patch)) props[key] = validateProperty(record.type, key, value);
    } finally {
      active.delete(callback);
    }
  }
}
/** Synchronous query scope, used to measure other effects while excluding one effect family. */
export function withoutHandleEffects(predicate, sample) {
  assert(
    typeof predicate === 'function' && typeof sample === 'function' && suppressed.length < 8,
    'INVALID_EFFECT',
    'Use a bounded synchronous effect query.',
  );
  suppressed.push(predicate);
  try {
    const result = sample();
    assert(!result || typeof result.then !== 'function', 'INVALID_EFFECT', 'Effect queries must be synchronous.');
    return result;
  } finally {
    suppressed.pop();
  }
}
