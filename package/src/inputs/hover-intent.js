import { assert, number, options, text } from '../core/validate.js';
import { isInputSource, managedSource } from './source.js';
import { fresh, freshnessDelay } from './freshness.js';

/**
 * Settle a pointer hit ID using explicit dwell/leave times. Starts only its own
 * subscription/timer, never the caller's pointer source. Speed uses source units/s.
 */
export function hoverIntent(pointer, spec = {}) {
  assert(isInputSource(pointer), 'INVALID_INPUT_SOURCE', 'Hover intent needs a first-party pointer input.');
  options(
    spec,
    [
      'id',
      'maxAge',
      'maxSamples',
      'maxBytes',
      'clock',
      'environment',
      'hit',
      'dwell',
      'fastDwell',
      'leave',
      'speedThreshold',
    ],
    'hover intent',
  );
  assert(typeof spec.hit === 'function', 'INVALID_INPUT_MAPPING', 'Hover intent needs a trusted hit function.');
  const hit = spec.hit,
    dwell = number(spec.dwell ?? 0.05, 'hover dwell', 0, 60),
    fastDwell = number(spec.fastDwell ?? 0.32, 'fast hover dwell', dwell, 60),
    leave = number(spec.leave ?? 0.14, 'hover leave', 0, 60),
    speedThreshold = number(spec.speedThreshold ?? 1000, 'hover speed threshold', 0.000001, 1e9);
  const sourceOptions = {
    kind: 'state',
    unit: 'id',
    space: pointer.space,
    maxAge: pointer.maxAge,
    ...Object.fromEntries(
      ['id', 'maxAge', 'maxSamples', 'maxBytes', 'clock']
        .filter((key) => spec[key] !== undefined)
        .map((key) => [key, spec[key]]),
    ),
  };
  return managedSource(sourceOptions, (ctx) => {
    const environment = spec.environment ?? globalThis;
    assert(
      typeof environment.setTimeout === 'function' && typeof environment.clearTimeout === 'function',
      'INPUT_UNSUPPORTED',
      'Hover intent needs an explicit timer-capable environment.',
    );
    let timer = null,
      settled = null,
      candidate = null,
      deadline = null,
      signature = null,
      lastPoint = null,
      lastEpoch = null,
      emitted = false,
      lastValid = false;
    const clear = () => {
      if (timer !== null) environment.clearTimeout(timer);
      timer = null;
    };
    const publish = (value, valid) => {
      if (!ctx.isCurrent() || (emitted && value === settled && valid === lastValid)) return;
      settled = value;
      lastValid = valid;
      emitted = true;
      ctx.emit(value, { valid });
    };
    const reset = () => {
      candidate = null;
      deadline = null;
      signature = null;
      lastPoint = null;
    };
    const compute = () => {
      clear();
      if (!ctx.isCurrent()) return;
      const view = pointer.snapshot();
      if (!fresh(view)) {
        reset();
        lastEpoch = null;
        publish(null, false);
        return;
      }
      const observation = view.latest,
        value = observation.value;
      assert(
        value && typeof value === 'object' && !Array.isArray(value),
        'INVALID_INPUT_MAPPING',
        'Pointer observations need x, y, active and pointerType fields.',
      );
      const x = number(value.x, 'pointer x'),
        y = number(value.y, 'pointer y');
      assert(
        typeof value.active === 'boolean' && typeof value.pointerType === 'string',
        'INVALID_INPUT_MAPPING',
        'Pointer active is boolean and pointerType is a string.',
      );
      const key = `${view.epoch}:${view.sequence}`,
        changed = signature !== key;
      if (lastEpoch !== view.epoch) {
        reset();
        lastEpoch = view.epoch;
        publish(null, true);
      }
      if (!ctx.isCurrent()) return;
      const available = value.active && value.pointerType !== 'touch' && (value.buttons ?? 0) === 0;
      const target = available ? hit(x, y) : null;
      if (!ctx.isCurrent()) return;
      assert(
        target === null || typeof target === 'string' || typeof target === 'number',
        'INVALID_INPUT_MAPPING',
        'A hover hit is a bounded string/number ID or null.',
      );
      if (typeof target === 'string') text(target, 'hover hit ID', 256);
      if (typeof target === 'number') number(target, 'hover hit ID', -1e9, 1e9);
      let speed = 0;
      if (changed && lastPoint) {
        const dt = observation.time - lastPoint.time,
          distance = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        speed = dt > 0 ? distance / dt : distance ? Infinity : 0;
      }
      if (changed) {
        lastPoint = { x, y, time: observation.time };
        signature = key;
      }
      const now = ctx.now();
      if (target === settled && lastValid) {
        candidate = target;
        deadline = null;
      } else if (deadline === null || target !== candidate) {
        candidate = target;
        deadline = now + (target === null ? leave : speed >= speedThreshold ? fastDwell : dwell);
      } else if (changed && target !== null && speed >= speedThreshold) {
        deadline = Math.max(deadline, now + fastDwell);
      } else if (changed && target !== null && speed < speedThreshold) {
        // An explicit stationary observation can replace the longer sweep delay.
        deadline = Math.min(deadline, now + dwell);
      }
      if (deadline !== null && now >= deadline) {
        deadline = null;
        publish(candidate, true);
      }
      if (!emitted) publish(null, true);
      if (!ctx.isCurrent()) return;
      const expiry = freshnessDelay([view]),
        wait =
          deadline === null ? expiry : Math.min(Math.max(1, Math.ceil((deadline - now) * 1000)), expiry ?? Infinity);
      if (wait !== null && Number.isFinite(wait)) timer = environment.setTimeout(update, wait);
    };
    const update = () => {
      try {
        compute();
      } catch (error) {
        clear();
        ctx.status('error', error);
      }
    };
    const unsubscribe = pointer.subscribe(update);
    update();
    return () => {
      clear();
      unsubscribe();
    };
  });
}
