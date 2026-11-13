// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Delivery measurements for mono or stereo PCM. Loudness follows the ITU-R
 * BS.1770 method and the range follows EBU Tech 3342. True peak is estimated
 * at four times the sample rate.
 */
export function measureAudio(input: any): Readonly<{
    sampleRate: number;
    duration: number;
    integrated: number;
    momentaryMax: number;
    shortTermMax: number;
    range: number;
    truePeak: number;
    samplePeak: number;
    rms: number;
    crest: number;
    correlation: number;
    dcOffset: number;
    clippedSamples: number;
    bands: Readonly<{
        [k: string]: number;
    }>;
}>;
export const METER_BANDS: readonly (Readonly<{
    id: "sub";
    from: 20;
    to: 60;
}> | Readonly<{
    id: "bass";
    from: 60;
    to: 250;
}> | Readonly<{
    id: "lowMid";
    from: 250;
    to: 500;
}> | Readonly<{
    id: "mid";
    from: 500;
    to: 2000;
}> | Readonly<{
    id: "presence";
    from: 2000;
    to: 6000;
}> | Readonly<{
    id: "air";
    from: 6000;
    to: 20000;
}>)[];
