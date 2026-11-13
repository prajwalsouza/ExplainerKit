import { assert, number, options } from '../core/validate.js';

export function seedValue(value = 0) {
  number(value, 'seed', 0, 0xffffffff);
  assert(Number.isInteger(value), 'INVALID_SEED', 'A seed must be an unsigned 32-bit integer.');
  return value;
}
/** Integer-coordinate hash, implemented directly; no shared random state. */
export function randomAt(seed, index, channel = 0) {
  let h = (seed ^ Math.imul(index, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10),
  mix = (a, b, t) => a + (b - a) * t;
function lattice(seed, x, y, z) {
  let h = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ Math.imul(z, 0x6c8e9cf5);
  return randomAt(seed, h, 0) * 2 - 1;
}
function sample(x, y, z, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z),
    u = smooth(x - ix),
    v = smooth(y - iy),
    w = smooth(z - iz);
  const plane = (k) =>
    mix(
      mix(lattice(seed, ix, iy, k), lattice(seed, ix + 1, iy, k), u),
      mix(lattice(seed, ix, iy + 1, k), lattice(seed, ix + 1, iy + 1, k), u),
      v,
    );
  return mix(plane(iz), plane(iz + 1), w);
}
export function noise2(x, y, spec = {}) {
  options(spec, ['seed'], 'noise2');
  number(x, 'noise x', -1e7, 1e7);
  number(y, 'noise y', -1e7, 1e7);
  return sample(x, y, 0, seedValue(spec.seed));
}
export function noise3(x, y, z, spec = {}) {
  options(spec, ['seed'], 'noise3');
  for (const [k, v] of Object.entries({ x, y, z })) number(v, `noise ${k}`, -1e7, 1e7);
  return sample(x, y, z, seedValue(spec.seed));
}
/** A bounded coherent vector field, addressed directly by coordinates and time. */
export function noiseField(spec = {}) {
  options(spec, ['seed', 'frequency', 'amplitude', 'octaves', 'lacunarity', 'gain', 'speed'], 'noise field');
  const seed = seedValue(spec.seed),
    frequency = number(spec.frequency ?? 1, 'noise frequency', 1e-8, 1e4),
    amplitude = number(spec.amplitude ?? 1, 'noise amplitude', 0, 1e7),
    octaves = number(spec.octaves ?? 1, 'noise octaves', 1, 8),
    lacunarity = number(spec.lacunarity ?? 2, 'noise lacunarity', 1, 8),
    gain = number(spec.gain ?? 0.5, 'noise gain', 0, 1),
    speed = number(spec.speed ?? 1, 'noise speed', 0, 1e4);
  assert(Number.isInteger(octaves), 'INVALID_NOISE', 'Octaves must be an integer.');
  const scales = Array.from({ length: octaves }, (_, i) => frequency * lacunarity ** i),
    weights = Array.from({ length: octaves }, (_, i) => gain ** i),
    total = weights.reduce((s, v) => s + v, 0);
  return Object.freeze({
    seed,
    frequency,
    amplitude,
    octaves,
    sample(point, time = 0) {
      options(point, ['x', 'y', 'z'], 'noise point');
      const x = number(point.x ?? 0, 'field x'),
        y = number(point.y ?? 0, 'field y'),
        z = number(point.z ?? 0, 'field z');
      number(time, 'noise time', 0, 86400);
      const channel = (offset) => {
        let value = 0;
        for (let i = 0; i < octaves; i++) {
          const f = scales[i],
            a = x * f,
            b = y * f,
            c = (z + time * speed) * f;
          for (const v of [a, b, c]) number(v, 'field lattice coordinate', -1e7, 1e7);
          value += weights[i] * sample(a, b, c, (seed + offset) >>> 0);
        }
        return number((amplitude * value) / total, 'field result');
      };
      return Object.freeze({ x: channel(0), y: channel(0x9e3779b9), z: channel(0x3c6ef372) });
    },
  });
}
/** Unchecked noise for hot loops whose inputs are already validated; seed must come from seedValue. */
export function noiseRaw(x, y, z, seed) {
  return sample(x, y, z, seed);
}
