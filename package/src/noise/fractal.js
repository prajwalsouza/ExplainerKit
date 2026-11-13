import { assert, number, options } from '../core/validate.js';
import { noiseRaw, seedValue } from './vector.js';

function settings(spec) {
  options(
    spec,
    [
      'seed',
      'octaves',
      'lacunarity',
      'gain',
      'rotation',
      'rotationStep',
      'offsetX',
      'offsetY',
      'amplitude',
      'normalization',
    ],
    'fractal noise',
  );
  const seed = seedValue(spec.seed),
    octaves = number(spec.octaves ?? 3, 'fractal octaves', 1, 8);
  assert(Number.isInteger(octaves), 'INVALID_NOISE', 'Fractal octaves must be an integer.');
  return {
    seed,
    octaves,
    lacunarity: number(spec.lacunarity ?? 2.03, 'fractal lacunarity', 1, 8),
    gain: number(spec.gain ?? 0.55, 'fractal gain', 0, 1),
    rotation: number(spec.rotation ?? 0.5, 'fractal rotation'),
    rotationStep: number(spec.rotationStep ?? 1.2, 'fractal rotation step'),
    offsetX: number(spec.offsetX ?? 0, 'fractal offset x'),
    offsetY: number(spec.offsetY ?? 0, 'fractal offset y'),
    amplitude: number(spec.amplitude ?? 1, 'fractal amplitude', 0, 1e7),
    normalization:
      spec.normalization === undefined ? null : number(spec.normalization, 'fractal normalization', 1e-12, 1e7),
  };
}
function fractal(x, y, spec, ridge) {
  number(x, 'fractal x');
  number(y, 'fractal y');
  const p = settings(spec);
  let frequency = 1,
    weight = p.amplitude,
    unitWeight = 1,
    total = 0,
    weights = 0;
  for (let i = 0; i < p.octaves; i++) {
    const angle = p.rotation + i * p.rotationStep,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const a = number((x * c - y * s) * frequency + p.offsetX, 'fractal lattice x');
    const b = number((x * s + y * c) * frequency + p.offsetY, 'fractal lattice y');
    const value = noiseRaw(a, b, 0, p.seed);
    total += weight * (ridge ? 1 - Math.abs(value) : value);
    weights += unitWeight;
    frequency *= p.lacunarity;
    weight *= p.gain;
    unitWeight *= p.gain;
  }
  return number(total / (p.normalization ?? weights), 'fractal result');
}

/** Rotated octave noise; default normalization gives [-amplitude, amplitude]. */
export function fbm(x, y, spec = {}) {
  return fractal(x, y, spec, false);
}
/** Absolute-value ridges; default normalization gives [0, amplitude]. */
export function ridged(x, y, spec = {}) {
  return fractal(x, y, spec, true);
}

/** Domain-warp coordinates, each displaced by at most amount. Does not sample the final field. */
export function warp(x, y, spec = {}) {
  options(spec, ['seed', 'amount'], 'noise warp');
  number(x, 'warp x');
  number(y, 'warp y');
  const seed = seedValue(spec.seed),
    amount = number(spec.amount ?? 1, 'warp amount', 0, 1e7);
  const a = x + amount * noiseRaw(x, y, 0, seed);
  const b = y + amount * noiseRaw(x, y, 0, (seed + 0x9e3779b9) >>> 0);
  return Object.freeze({ x: number(a, 'warped x'), y: number(b, 'warped y') });
}
