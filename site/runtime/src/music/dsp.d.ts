// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** In-place radix-2 complex FFT. The length must be a power of two. */
export function fft(real: any, imag: any): void;
export function hann(size: any): Float64Array<any>;
/**
 * Short-time magnitude spectra of a mono signal. Frame `i` is centred on
 * sample `i * hop`; samples outside the signal read as zero. The callback
 * receives a reused magnitude buffer of `size / 2 + 1` bins.
 */
export function spectra(signal: any, size: any, hop: any, visit: any, stride?: number): number;
/**
 * Triangular filters spaced logarithmically between two frequencies. Filters
 * that would cover the same FFT bins as a neighbour are merged, so low bands
 * never repeat one bin. Each filter is normalised to unit area.
 */
export function logFilterbank(size: any, rate: any, low: any, high: any, perOctave: any): {
    start: number;
    weights: Float64Array<ArrayBuffer>;
    hz: number;
}[];
export function applyFilters(filters: any, magnitude: any, output: any, offset?: number): void;
export function movingAverage(values: any, radius: any): Float64Array<any>;
export function movingMax(values: any, before: any, after: any): Float64Array<any>;
export function percentile(values: any, p: any): number;
export function mean(values: any, from?: number, to?: any): number;
export function standardDeviation(values: any): number;
/** Rescale so the 5th percentile maps to 0 and the 95th to 1, clamped. */
export function rank(values: any): Float64Array<ArrayBuffer>;
export function cosine(a: any, b: any, offsetA?: number, offsetB?: number, length?: any): number;
/** Interpolate a series sampled every `step` seconds at an arbitrary time. */
export function sampleSeries(values: any, step: any, time: any): any;
/** Index of the last value in a sorted array that is less than or equal to `x`, or -1. */
export function floorIndex(sorted: any, x: any): number;
export function midiToHz(midi: any, tuning?: number): number;
export function hzToMidi(hz: any): number;
export function round(value: any, places?: number): number;
