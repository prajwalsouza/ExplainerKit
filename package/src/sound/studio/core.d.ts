// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function studioRate(value?: number): number;
/** Read caller PCM as `{channels, sampleRate}` without copying. Mono input is duplicated by `stereoCopy`. */
export function readAudio(input: any, name?: string): {
    channels: any[];
    rate: number;
};
/** Copy caller PCM into a mutable stereo working buffer, optionally with silent frames appended. */
export function stereoCopy(input: any, extraFrames?: number, name?: string): {
    left: Float32Array<any>;
    right: Float32Array<any>;
    rate: number;
};
export function audioResult(left: any, right: any, rate: any, extra?: {}): Readonly<{
    sampleRate: any;
    channels: readonly any[];
    duration: number;
}>;
/** Deterministic generator shared by instruments and effects. The same seed gives the same stream. */
export function seeded(seed?: number): () => number;
/** A control value that is either one number or breakpoints in seconds, sampled per frame with linear ramps. */
export function controlCurve(value: any, frames: any, rate: any, name: any, min: any, max: any): {
    constant: any;
    at: null;
} | {
    constant: null;
    at: Float32Array<any>;
};
/** One studio call holds at most 15 minutes of stereo audio and 256 million samples across its buffers. */
export const STUDIO_LIMITS: Readonly<{
    seconds: 900;
    samples: 256000000;
    effects: 64;
}>;
export function dbToGain(db: any): number;
export function gainToDb(gain: any): number;
export function clamp(value: any, low: any, high: any): any;
export function midiToFrequency(midi: any): number;
