import { assert, number, options } from '../core/validate.js';
import { flattenPath } from '../morph/contour.js';

/** Prepared polyline approximation for distance, tangent, trim and path-follow rigs. */
export function measurePath(commands, spec = {}) {
  options(spec, ['tolerance', 'maxPoints'], 'measure path');
  const data = flattenPath(commands, spec),
    { points, cumulative, length, closed } = data;
  function locate(fraction) {
    number(fraction, 'path fraction', 0, 1);
    const d = fraction * length;
    let lo = 1,
      hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    const a = points[lo - 1],
      b = points[lo],
      q = Math.max(0, Math.min(1, (d - cumulative[lo - 1]) / (cumulative[lo] - cumulative[lo - 1])));
    return {
      index: lo,
      x: a.x + (b.x - a.x) * q,
      y: a.y + (b.y - a.y) * q,
      rotation: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
  return Object.freeze({
    length,
    closed,
    points,
    at(fraction) {
      const { x, y, rotation } = locate(fraction);
      return Object.freeze({ x, y, rotation });
    },
    trim(start = 0, end = 1) {
      const a = locate(start),
        b = locate(end);
      assert(end >= start, 'INVALID_PATH_RANGE', 'Trim end must follow start.');
      const output = [Object.freeze(['M', a.x, a.y])];
      if (start !== end) {
        for (let i = a.index; i < b.index; i++) output.push(Object.freeze(['L', points[i].x, points[i].y]));
        output.push(Object.freeze(['L', b.x, b.y]));
      }
      return Object.freeze(output);
    },
  });
}

/** Distribute whole objects along a prepared contour; do not silently deform them. */
export function pathPlacements(commands, spec = {}) {
  options(spec, ['count', 'start', 'end', 'offset', 'rotate', 'tolerance'], 'path placements');
  const count = number(spec.count, 'placement count', 0, 10000);
  assert(Number.isInteger(count), 'INVALID_DISTRIBUTION', 'Count must be an integer.');
  const start = number(spec.start ?? 0, 'placement start', 0, 1),
    end = number(spec.end ?? 1, 'placement end', 0, 1),
    offset = number(spec.offset ?? 0, 'normal offset');
  assert(end >= start, 'INVALID_DISTRIBUTION', 'End must follow start.');
  assert(
    spec.rotate === undefined || typeof spec.rotate === 'boolean',
    'INVALID_DISTRIBUTION',
    'rotate must be boolean.',
  );
  const path = measurePath(commands, { tolerance: spec.tolerance ?? 0.25 });
  return Object.freeze(
    Array.from({ length: count }, (_, i) => {
      const p = path.at(
        start + (end - start) * (count <= 1 ? 0 : i / (path.closed && end - start === 1 ? count : count - 1)),
      );
      return Object.freeze({
        index: i,
        x: p.x - offset * Math.sin(p.rotation),
        y: p.y + offset * Math.cos(p.rotation),
        rotation: spec.rotate === false ? 0 : p.rotation,
      });
    }),
  );
}
