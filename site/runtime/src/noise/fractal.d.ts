// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Pure scalar fractal noise; no clocks or browser resources are installed. */
export interface FractalOptions {
  seed?: number;
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  rotation?: number;
  rotationStep?: number;
  offsetX?: number;
  offsetY?: number;
  amplitude?: number;
  /** Explicit denominator for compatibility with authored, non-normalized fields. */
  normalization?: number;
}
export function fbm(x: number, y: number, options?: FractalOptions): number;
export function ridged(x: number, y: number, options?: FractalOptions): number;
/** Coordinates displaced independently by at most amount, rather than a final noise value. */
export function warp(x: number, y: number, options?: {seed?: number; amount?: number}): Readonly<{x: number; y: number}>;
