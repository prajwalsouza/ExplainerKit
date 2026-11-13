// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Novelty along the diagonal of the self-similarity matrix of `features`
 * (rows of `dimension` values). Only entries inside the kernel are computed,
 * so the cost is rows × (2·half)² rather than rows².
 */
export function novelty(features: any, rows: any, dimension: any, half: any): Float64Array<any>;
/** Peaks of a novelty curve at least `gap` rows apart, strongest first. */
export function noveltyPeaks(curve: any, gap: any, minimum: any): number[];
/**
 * Split beats into sections. Returns boundary beat indices (always starting
 * with 0) and a letter for each section.
 */
export function segment(beatFeatures: any, beats: any, dimension: any, downbeat: any, beatsPerBar: any, extra?: any[], detail?: any): {
    boundaries: number[];
    letters: string[];
    novelty: Float64Array<any>;
    noveltyMean: number;
};
