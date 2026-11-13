import { assert, number, KitError } from '../core/validate.js';
import { randomAt } from '../noise/vector.js';
import { pointSet } from './point-set.js';

/** Variable-radius Poisson proposals; count is a ceiling, not a saturation promise. */
export function densityPoints(spec, seed, domain, budget, count) {
  assert(spec.method === 'poisson', 'PROCEDURAL_METHOD', 'A density callback requires method: poisson.');
  assert(
    spec.spacing === undefined && spec.jitter === undefined,
    'PROCEDURAL_METHOD',
    'Density fields do not use grid spacing or jitter.',
  );
  assert(
    spec.tolerance === undefined &&
      spec.junctions === undefined &&
      spec.offset === undefined &&
      spec.alternate === undefined,
    'PROCEDURAL_REGION',
    'Tolerance, junctions, offset and alternate belong to along-path or network sampling.',
  );
  const min = number(spec.minDistance, 'minimum field spacing', 1e-6, 1e7);
  const max = number(spec.maxDistance ?? min, 'maximum field spacing', min, 1e7);
  assert(max / min <= 64, 'RESOURCE_LIMIT', 'A density field supports at most a 64:1 spacing range.');
  const x = [],
    y = [],
    radii = [],
    grid = new Map(),
    active = [];
  let sequence = 0,
    attempts = 0;
  const random = (channel) => randomAt(seed, sequence++, channel);
  const key = (gx, gy) => `${gx}:${gy}`;
  function radius(px, py) {
    let value;
    try {
      value = spec.density(px, py);
    } catch (cause) {
      const error = new KitError('PROCEDURAL_CALLBACK', 'The point density callback failed.');
      error.cause = cause;
      throw error;
    }
    number(value, 'density field result', 0, 1);
    return value === 0 ? null : min + (1 - value) * (max - min);
  }
  function propose(px, py) {
    budget.tick();
    attempts++;
    px = Math.fround(px);
    py = Math.fround(py);
    if (!domain.contains(px, py)) return false;
    const r = radius(px, py);
    if (r === null) return false;
    const gx = Math.floor((px - domain.x) / max),
      gy = Math.floor((py - domain.y) / max);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        budget.tick();
        for (const i of grid.get(key(gx + dx, gy + dy)) ?? []) {
          budget.tick();
          if (Math.hypot(px - x[i], py - y[i]) < Math.max(r, radii[i])) return false;
        }
      }
    const i = x.length,
      bucketKey = key(gx, gy);
    x.push(px);
    y.push(py);
    radii.push(r);
    active.push(i);
    if (!grid.has(bucketKey)) grid.set(bucketKey, []);
    grid.get(bucketKey).push(i);
    return true;
  }
  // Cover disconnected/nonzero patches before local growth. The fixed proposal ceiling also
  // bounds callback invocation for an identically zero or extremely sparse field.
  const globalAttempts = count === 0 ? 0 : Math.min(1e6, Math.max(256, count * 12));
  for (let i = 0; i < globalAttempts && x.length < count; i++) {
    const p = domain.random(random(41), random(42));
    propose(p[0], p[1]);
  }
  while (active.length && x.length < count) {
    const slot = Math.floor(random(43) * active.length),
      i = active[slot];
    let accepted = false;
    for (let j = 0; j < 30; j++) {
      const angle = random(44) * Math.PI * 2,
        r = radii[i] * Math.sqrt(1 + 3 * random(45));
      if (propose(x[i] + r * Math.cos(angle), y[i] + r * Math.sin(angle))) {
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      active[slot] = active.at(-1);
      active.pop();
    }
  }
  return pointSet(seed, x, y, [Object.freeze([Object.freeze(['spacing', Object.freeze(radii)])])], {
    method: 'poisson',
    densityField: true,
    requested: count,
    attempts,
    work: budget.used,
    minDistance: min,
    maxDistance: max,
    saturated: x.length < count,
    bounds: Object.freeze({ x: domain.x, y: domain.y, width: domain.width, height: domain.height }),
  });
}
