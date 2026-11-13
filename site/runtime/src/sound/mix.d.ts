// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Captured decoded PCM, explicit timeline offsets and pure time-addressed mixing. */
export function createAudioMix(input: any, spec?: {}): Readonly<{
    duration: number;
    tracks: readonly Readonly<{
        id: any;
        sampleRate: any;
        start: any;
        gain: any;
        role: any;
        duration: number;
    }>[];
    sample: (time: any) => readonly number[];
    render({ from, duration: length, sampleRate }?: {
        from?: number | undefined;
        duration?: number | undefined;
        sampleRate?: number | undefined;
    }): Readonly<{
        sampleRate: number;
        channels: readonly Float32Array<ArrayBuffer>[];
        clippedSamples: number;
    }>;
}>;
/** PCM16 RIFF/WAVE output. Saturates out-of-range samples; render reports clipping separately. */
/** @param {{sampleRate:number,channels:readonly (Float32Array|Float64Array|readonly number[])[],clippedSamples?:number,duration?:number,metadata?:unknown}} input */
export function encodeWav(input: {
    sampleRate: number;
    channels: readonly (Float32Array | Float64Array | readonly number[])[];
    clippedSamples?: number;
    duration?: number;
    metadata?: unknown;
}): Uint8Array<ArrayBuffer>;
