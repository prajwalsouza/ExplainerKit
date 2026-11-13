import { spring } from '../physics/index.js';
import { assert, number, options } from '../core/validate.js';

/**
 * @typedef {Object} SpringTimingOptions
 * @property {number} [mass]
 * @property {number} [stiffness]
 * @property {number} [damping]
 * @property {number} [velocity]
 * @property {number} [epsilon]
 * @property {number} [rest]
 * @property {number} [maxDuration]
 */

/**
 * Derive finite native track timing from a normalized analytic spring.
 * Seconds throughout. Authoring performs at most 3001 analytic samples, at
 * 20 ms intervals; playback performs one analytic evaluation per easing call.
 * This is sampled settling, not a guarantee about every intervening instant.
 *
 * @param {SpringTimingOptions} [spec]
 * @returns {Readonly<{duration:number,ease:(progress:number)=>number}>}
 */
export function springTiming(spec = {}) {
  options(spec, ['mass', 'stiffness', 'damping', 'velocity', 'epsilon', 'rest', 'maxDuration'], 'spring timing');
  const epsilon = number(spec.epsilon ?? 0.0005, 'spring settling epsilon', 1e-8, 0.1),
    rest = number(spec.rest ?? 0.2, 'spring settling rest seconds', 0.02, 1),
    maxDuration = number(spec.maxDuration ?? 60, 'spring settling limit seconds', 0.02, 60);
  assert(rest <= maxDuration, 'INVALID_SPRING_TIMING', 'The settling rest window must fit within maxDuration.');
  const physical = {};
  for (const name of ['mass', 'stiffness', 'damping', 'velocity']) {
    if (Object.hasOwn(spec, name)) physical[name] = spec[name];
  }
  const model = spring(physical),
    step = 0.02,
    required = Math.ceil(rest / step) + 1,
    limit = Math.floor(maxDuration / step);
  let consecutive = 0,
    seconds = 0;
  for (let i = 0; i <= limit; i++) {
    consecutive = Math.abs(1 - model.sample(seconds)) < epsilon ? consecutive + 1 : 0;
    if (consecutive >= required) {
      // Quantize the public end to the sampling grid, avoiding floating-point
      // accumulation in scene duration, while retaining the sampled solver time.
      const duration = Math.round(seconds * 1000) / 1000,
        ease = (progress) => {
          number(progress, 'spring timing progress', 0, 1);
          if (progress === 0 || progress === 1) return progress;
          return model.sample(progress * seconds);
        };
      return Object.freeze({ duration, ease: Object.freeze(ease) });
    }
    seconds += step;
  }
  assert(false, 'SPRING_NOT_SETTLED', 'Spring did not settle within maxDuration; increase damping or the time limit.');
}
