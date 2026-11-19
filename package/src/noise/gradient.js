import { number, options } from '../core/validate.js';
import { randomAt, seedValue } from './vector.js';

// Gradient (Perlin-style) noise. Value noise interpolates random heights at lattice points,
// so a thresholded or sharpened field shows the square lattice. Gradient noise is zero at
// every lattice point and varies through random slopes, which hides the grid.
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;
const G2 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];
const G3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];
function corner(seed, x, y, z) {
  return randomAt(seed, Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ Math.imul(z, 0x6c8e9cf5), 7);
}
function sample2(x, y, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const dot = (cx, cy) => {
    const g = G2[Math.floor(corner(seed, ix + cx, iy + cy, 0) * 8)];
    return g[0] * (fx - cx) + g[1] * (fy - cy);
  };
  const u = fade(fx),
    v = fade(fy);
  // Unit gradients reach at most sqrt(1/2); scaling by sqrt(2) makes the range about [-1, 1].
  const value = mix(mix(dot(0, 0), dot(1, 0), u), mix(dot(0, 1), dot(1, 1), u), v) * Math.SQRT2;
  return Math.max(-1, Math.min(1, value));
}
function sample3(x, y, z, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z),
    fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const dot = (cx, cy, cz) => {
    const g = G3[Math.floor(corner(seed, ix + cx, iy + cy, iz + cz) * 12)];
    return g[0] * (fx - cx) + g[1] * (fy - cy) + g[2] * (fz - cz);
  };
  const u = fade(fx),
    v = fade(fy),
    w = fade(fz);
  const plane = (cz) => mix(mix(dot(0, 0, cz), dot(1, 0, cz), u), mix(dot(0, 1, cz), dot(1, 1, cz), u), v);
  return Math.max(-1, Math.min(1, mix(plane(0), plane(1), w)));
}
/** Seeded 2D gradient noise in [-1, 1]. Zero at integer coordinates; no visible lattice. */
export function gradientNoise2(x, y, spec = {}) {
  options(spec, ['seed'], 'gradientNoise2');
  number(x, 'noise x');
  number(y, 'noise y');
  return sample2(x, y, seedValue(spec.seed));
}
/** Seeded 3D gradient noise in [-1, 1]. Use z as time for a field that drifts. */
export function gradientNoise3(x, y, z, spec = {}) {
  options(spec, ['seed'], 'gradientNoise3');
  number(x, 'noise x');
  number(y, 'noise y');
  number(z, 'noise z');
  return sample3(x, y, z, seedValue(spec.seed));
}
export { sample2 as gradientRaw2, sample3 as gradientRaw3 };
