import { assert } from '../core/validate.js';
/** Internal shared radial allowance; callers retain their public input/error contracts. */
export function radialReach(total, inner, distance, stretch, compress, softness) {
  assert(
    [total, inner, distance, stretch, compress, softness].every(Number.isFinite) &&
      total > 0 &&
      inner >= 0 &&
      inner <= total &&
      distance >= 0 &&
      stretch >= 1 &&
      stretch <= 4 &&
      compress >= 0.25 &&
      compress <= 1 &&
      softness >= 0,
    'INVALID_RIG_INPUT',
    'Use finite bounded radial reach controls.',
  );
  const scale = Math.max(compress, Math.min(stretch, distance / total)),
    outer = total * scale,
    minimum = inner * scale,
    range = Math.min(softness, outer - minimum),
    start = outer - range;
  return {
    scale,
    outer,
    inner: minimum,
    effectiveDistance:
      range > 0 && distance > start ? start - range * Math.expm1(-(distance - start) / range) : distance,
  };
}
