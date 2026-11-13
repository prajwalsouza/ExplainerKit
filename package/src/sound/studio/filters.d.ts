// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Normalized biquad coefficients `[b0, b1, b2, a1, a2]` from the Audio EQ Cookbook formulas. */
export function biquadCoefficients(type: any, frequency: any, rate: any, q?: number, gainDb?: number): number[];
/** Run one biquad over a channel in place using the transposed direct form II. */
export function runBiquad(channel: any, [b0, b1, b2, a1, a2]: [any, any, any, any, any]): void;
/** Parametric equaliser. Each band is a biquad, or a Butterworth cascade for steeper cuts. */
export function equalizer(buffer: any, params: any): void;
/** Level in dB of an EQ band list at each frequency, for drawing a response curve. */
export function filterResponse(bands: any, frequencies: any, sampleRate?: number): any;
/**
 * State-variable filter whose cutoff can move during the sound. The topology
 * preserves its tuning under fast modulation, so sweeps do not click.
 */
export function sweepFilter(buffer: any, params: any): void;
/** Four-pole ladder low-pass with feedback resonance and a saturating input, run at twice the sample rate. */
export function ladderFilter(buffer: any, params: any): void;
/** Linkwitz–Riley fourth-order split. Low plus high reconstructs the input with an all-pass phase shift. */
export function crossover(channel: any, rate: any, frequency: any): Float32Array<ArrayBuffer>[];
export const FILTER_TYPES: readonly string[];
