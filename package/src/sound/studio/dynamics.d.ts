// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Largest absolute value among each sample and three interpolated points after it. */
export function interSamplePeaks(channel: any, output?: Float32Array<any>): Float32Array<any>;
/** True peak of a stereo buffer in linear gain, estimated at four times the sample rate. */
export function truePeak(left: any, right: any): number;
/**
 * Feed-forward compressor with a soft knee. The detector is stereo-linked and
 * can listen to another signal. Reduction is smoothed in decibels.
 */
export function compressor(buffer: any, params: any, context?: {}): {
    step?: number | undefined;
    reduction?: number[] | undefined;
    maxReduction: number;
    meanReduction: number;
    makeup: any;
};
/** Downward expander. Below the threshold the level falls faster, down to `range` decibels of cut. */
export function gate(buffer: any, params: any, context?: {}): void;
/**
 * Brickwall limiter. It measures peaks between samples, looks ahead so the
 * gain is already down when a peak arrives, and releases exponentially.
 */
export function limiter(buffer: any, params: any): {
    maxReduction: number;
    limitedSamples: number;
};
/** Raise or soften note attacks and sustains from the difference between fast and slow envelopes. */
export function transientShaper(buffer: any, params: any): void;
/** Split into bands with phase-matched crossovers, compress each band and sum the result. */
export function multibandCompressor(buffer: any, params: any, context?: {}): {
    bands: {
        step?: number | undefined;
        reduction?: number[] | undefined;
        maxReduction: number;
        meanReduction: number;
        makeup: any;
    }[];
};
