// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Loudness measured every `step` seconds. `momentary` uses 400 ms blocks and
 * `shortTerm` uses 3 s blocks, both ending at the sample time, and `level`
 * is each step on its own. Values are in
 * LUFS, with -70 standing in for silence so the series stay finite.
 */
export function measureLoudness(pcm: any, step?: number): {
    step: number;
    momentary: Float64Array<ArrayBuffer>;
    shortTerm: Float64Array<ArrayBuffer>;
    level: Float64Array<ArrayBuffer>;
    integrated: number;
};
