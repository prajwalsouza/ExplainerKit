// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface MusicPCMInput {readonly channels: readonly (Float32Array | Float64Array)[]; readonly sampleRate: number; readonly duration?: number; readonly metadata?: Readonly<Record<string, unknown>>; readonly clippedSamples?: number;}
export declare const MAX_MUSIC_SECONDS: number;
export declare function readMusicPCM(input: MusicPCMInput): {channels: readonly (Float32Array | Float64Array)[]; sampleRate: number; length: number; duration: number};
export declare function analysisSignal(pcm: {channels: readonly (Float32Array | Float64Array)[]; sampleRate: number; length: number}): {signal: Float32Array; sampleRate: number; factor: number};
